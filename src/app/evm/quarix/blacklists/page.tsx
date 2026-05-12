'use client';

import { IconCode, IconPointerBolt, IconPointerOff, IconRefresh } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAddress } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { useToast } from '@/components/ui/toast';
import { resolveEvmStoredPrivateKey, getActiveEvmStoredPrivateKey, isEvmStoredPrivateKeyUnlocked, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { EVM_BLACKLIST_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { EVM_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/evm-system-artifacts';

type PageRequest = {
  key: `0x${string}`;
  offset: bigint;
  limit: bigint;
  countTotal: boolean;
  reverse: boolean;
};

type EvmBlacklistPageResponse = {
  nextKey?: `0x${string}` | string;
  total?: bigint | number | string;
};

type EvmQuarixBlacklistsState = {
  blacklists: string[];
  pages: string[][];
  total: number | null;
  response: {
    blacklists: string[];
    pagination?: {
      total?: string;
    };
  };
};

const EVM_BLACKLIST_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmBlacklist')?.abi ?? []) as readonly unknown[];
const BLACKLISTS_PAGE_LIMIT = 200n;

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

async function requestAllQuarixEvmBlacklists(): Promise<EvmQuarixBlacklistsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const pages: string[][] = [];
  const blacklists: string[] = [];
  let page = 1;
  let total: number | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const pageRequest: PageRequest = {
      key: '0x',
      offset: BigInt((page - 1) * Number(BLACKLISTS_PAGE_LIMIT)),
      limit: BLACKLISTS_PAGE_LIMIT,
      countTotal: true,
      reverse: false,
    };
    const [pageItems, pageResponse] = (await client.readContract({
      address: EVM_BLACKLIST_ADDRESS,
      abi: EVM_BLACKLIST_ABI,
      functionName: 'blacklists',
      args: [pageRequest],
    })) as readonly [readonly string[], EvmBlacklistPageResponse];
    const normalizedItems = pageItems.map((item) => item.trim()).filter((item) => item.length > 0);

    pages.push(normalizedItems);
    blacklists.push(...normalizedItems);

    const responseTotal = Number.parseInt(String(pageResponse?.total ?? ''), 10);

    if (Number.isFinite(responseTotal)) {
      total = responseTotal;
    }

    hasNextPage = Boolean(pageResponse?.nextKey && pageResponse.nextKey !== '0x');
    page += 1;
  }

  return {
    blacklists,
    pages,
    total,
    response: {
      blacklists,
      ...(total != null ? { pagination: { total: String(total) } } : {}),
    },
  };
}

export default function EvmQuarixBlacklistsPage() {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixEvmBlacklists;
  const [data, setData] = useState<EvmQuarixBlacklistsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBlacklistAddress, setNewBlacklistAddress] = useState('');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRemoveAddress, setPendingRemoveAddress] = useState<string | null>(null);
  const hasLoadedDataRef = useRef(false);
  const unlockDialog = useEvmPrivateKeyUnlockDialog();

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isInitialLoad = !hasLoadedDataRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await requestAllQuarixEvmBlacklists();

        if (!cancelled) {
          setData(next);
          hasLoadedDataRef.current = true;
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : pageMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    const handleActiveRpcProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [pageMessages.failedToLoadFallback, refreshVersion]);

  const blacklists = useMemo(() => data?.blacklists ?? [], [data]);

  async function submitAddBlacklist(password?: string) {
    if (!activeKey) {
      setCreateError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    const normalizedAddress = newBlacklistAddress.trim();

    if (!isAddress(normalizedAddress)) {
      setCreateError(pageMessages.invalidAddress);
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);

      unlockDialog.handleUnlockResolved();

      await writeEvmContractMethodDirect({
        address: EVM_BLACKLIST_ADDRESS,
        abiJson: JSON.stringify(EVM_BLACKLIST_ABI),
        functionSignature: 'addToBlacklist(address)',
        rawArgs: [normalizedAddress],
        privateKey,
        value: '0',
      });

      showToast({
        title: pageMessages.addedTitle,
        description: normalizedAddress,
      });

      setCreateDialogOpen(false);
      setNewBlacklistAddress('');
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : pageMessages.failedToAddFallback;

      if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setCreateError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRemoveBlacklist(address: string, password?: string) {
    if (!activeKey) {
      setCreateError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);

      unlockDialog.handleUnlockResolved();

      await writeEvmContractMethodDirect({
        address: EVM_BLACKLIST_ADDRESS,
        abiJson: JSON.stringify(EVM_BLACKLIST_ABI),
        functionSignature: 'removeFromBlacklist(address)',
        rawArgs: [address],
        privateKey,
        value: '0',
      });

      showToast({
        title: pageMessages.removedTitle,
        description: address,
      });

      setRemoveDialogOpen(false);
      setPendingRemoveAddress(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : pageMessages.failedToRemoveFallback;

      if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setCreateError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSubmit() {
    if (!activeKey) {
      setCreateError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    if (!newBlacklistAddress.trim()) {
      setCreateError(pageMessages.addressRequired);
      return;
    }

    if (!isAddress(newBlacklistAddress.trim())) {
      setCreateError(pageMessages.invalidAddress);
      return;
    }

    if (!isEvmStoredPrivateKeyUnlocked(activeKey.id) && activeKey.securityMode === 'encrypted') {
      unlockDialog.openDialog();
      return;
    }

    await submitAddBlacklist();
  }

  async function handleRemove(address: string) {
    if (!activeKey) {
      setCreateError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    setPendingRemoveAddress(address);
    setCreateError(null);
    setRemoveDialogOpen(true);
  }

  async function handleRemoveSubmit() {
    if (!activeKey) {
      setCreateError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    if (!pendingRemoveAddress?.trim()) {
      setCreateError(pageMessages.addressRequired);
      return;
    }

    if (!isAddress(pendingRemoveAddress.trim())) {
      setCreateError(pageMessages.invalidAddress);
      return;
    }

    if (!isEvmStoredPrivateKeyUnlocked(activeKey.id) && activeKey.securityMode === 'encrypted') {
      unlockDialog.openDialog();
      return;
    }

    await submitRemoveBlacklist(pendingRemoveAddress.trim());
  }

  if (loading && data == null) {
    return (
      <AppShell mode="evm">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={2} toolbarIcons={1} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell mode="evm">
        <main className="content-panel">
          <h1>{pageMessages.title}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="evm">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{pageMessages.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{pageMessages.description}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {blacklists.length ? pageMessages.totalBlacklistsLabel.replace('{count}', blacklists.length.toLocaleString(locale)) : pageMessages.emptyBlacklistsLabel}
              </p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <ActionIconButton
                tooltip={pageMessages.addBlacklist}
                className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700"
                onClick={() => {
                  setCreateDialogOpen(true);
                  setCreateError(null);
                }}
              >
                <IconPointerOff className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={pageMessages.removeBlacklist}
                className="h-8 w-8 rounded-md text-slate-400 hover:text-sky-600"
                onClick={() => {
                  setPendingRemoveAddress('');
                  setCreateError(null);
                  setRemoveDialogOpen(true);
                }}
              >
                <IconPointerBolt className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={showRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showRawJson
                    ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                    : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                }
                onClick={() => setShowRawJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={messages.common.refresh}
                className={refreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[860px] table-fixed">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[620px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.index}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{pageMessages.actions}</th>
                </tr>
              </thead>
              <tbody>
                {blacklists.length ? (
                  blacklists.map((address, index) => (
                    <tr key={`${address}-${index}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-500">{(index + 1).toLocaleString(locale)}</td>
                      <td className="px-5 py-3 text-sm">
                        <AddressLink address={address} href={`/evm/address/${address}`} label={address} className="font-medium text-sky-600 hover:text-sky-700" />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-end gap-0">
                          <ActionIconButton
                            className={submitting && pendingRemoveAddress === address ? 'cursor-wait text-sky-600' : 'text-slate-400 hover:text-sky-600'}
                            tooltip={pageMessages.removeBlacklist}
                            aria-label={pageMessages.removeBlacklist}
                            onClick={() => void handleRemove(address)}
                          >
                            <IconPointerBolt className="size-4" stroke={1.8} />
                          </ActionIconButton>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.emptyBlacklistsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showRawJson ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={data.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>
      </main>

      <ModalDialog
        open={createDialogOpen}
        onOpenChange={(nextOpen) => {
          setCreateDialogOpen(nextOpen);

          if (!nextOpen) {
            setCreateError(null);
            setNewBlacklistAddress('');
          }
        }}
        title={pageMessages.addBlacklist}
        description={activeKey ? pageMessages.addBlacklistDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.selectGlobalKeyFirst}
        maxWidthClassName="max-w-lg"
        footer={null}
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">{pageMessages.address}</label>
            <Input
              value={newBlacklistAddress}
              onChange={(event) => setNewBlacklistAddress(event.target.value)}
              placeholder="0x0000000000000000000000000000000000000000"
              disabled={submitting}
            />
          </div>
          {createError ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(createError, locale)}</div> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setCreateDialogOpen(false)}
              disabled={submitting}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              onClick={() => void handleCreateSubmit()}
              disabled={submitting}
            >
              {submitting ? messages.evmTxDetail.sending : messages.common.add}
            </button>
          </div>
        </div>
      </ModalDialog>

      <ModalDialog
        open={removeDialogOpen}
        onOpenChange={(nextOpen) => {
          setRemoveDialogOpen(nextOpen);

          if (!nextOpen) {
            setCreateError(null);
            setPendingRemoveAddress(null);
          }
        }}
        title={pageMessages.removeBlacklist}
        description={activeKey ? pageMessages.removeBlacklistDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.selectGlobalKeyFirst}
        maxWidthClassName="max-w-lg"
        footer={null}
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">{pageMessages.address}</label>
            <Input
              value={pendingRemoveAddress ?? ''}
              onChange={(event) => setPendingRemoveAddress(event.target.value)}
              placeholder="0x0000000000000000000000000000000000000000"
              disabled={submitting}
            />
          </div>
          {createError ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(createError, locale)}</div> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={submitting}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              onClick={() => void handleRemoveSubmit()}
              disabled={submitting}
            >
              {submitting ? messages.evmTxDetail.sending : pageMessages.removeBlacklist}
            </button>
          </div>
        </div>
      </ModalDialog>

      <EvmPrivateKeyUnlockDialog
        open={unlockDialog.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            unlockDialog.closeDialog();
            setPendingRemoveAddress(null);
            return;
          }

          unlockDialog.setOpen(true);
        }}
        password={unlockDialog.password}
        onPasswordChange={unlockDialog.setPassword}
        errorMessage={unlockDialog.errorMessage}
        submitting={submitting}
        title={messages.privateKeys.unlockPrivateKey}
        description={messages.privateKeys.unlockContinueDescription}
        placeholder={messages.privateKeys.enterPassword}
        confirmLabel={messages.privateKeys.unlock}
        onConfirm={() => {
          if (pendingRemoveAddress) {
            void submitRemoveBlacklist(pendingRemoveAddress.trim(), unlockDialog.password);
            return;
          }

          void submitAddBlacklist(unlockDialog.password);
        }}
      />
    </AppShell>
  );
}
