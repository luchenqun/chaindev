'use client';

import { IconCode, IconDevicesShare, IconFlame, IconNavigationPlus, IconPlayerPause, IconPlayerPlay, IconRefresh, IconSend, IconTransferOut } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Abi, isAddress } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { useToast } from '@/components/ui/toast';
import { resolveEvmStoredPrivateKey, getActiveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { EVM_BANK_MODULE_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import { formatReadableDenom, formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { EVM_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/evm-system-artifacts';

type EvmBankSupplyItem = {
  denom: string;
  amount: bigint | number | string;
};

type EvmBankSupplyResponse = {
  supply: EvmBankSupplyItem[];
};

type QuarixBankActionKind = 'send' | 'multiSend' | 'mintCoins' | 'distributeCoins' | 'burnCoins';

type OutputInput = {
  toAddress: string;
  amount: string;
};

const AUTO_REFRESH_INTERVAL_MS = 12_000;
const BANK_AMOUNT_DECIMALS = 18;
const EVM_BANK_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmBank')?.abi ?? []) as Abi;
const EVM_BANK_TOTAL_SUPPLY_ABI = EVM_BANK_ABI.filter((item) => item.type === 'function' && item.name === 'totalSupply') as Abi;
const EVM_BANK_PRECOMPILE_ADDRESS = EVM_BANK_MODULE_ADDRESS as `0x${string}`;

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function normalizeAmount(value: bigint | number | string) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '0';
  }

  return typeof value === 'string' ? value : '0';
}

function scaleAmountToBankInteger(value: string, decimals = BANK_AMOUNT_DECIMALS) {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error('invalid-amount');
  }

  const [integerPart = '0', decimalPart = ''] = normalized.split('.');

  if (decimalPart.length > decimals) {
    throw new Error('invalid-amount');
  }

  const paddedFraction = decimalPart.padEnd(decimals, '0');
  const digits = `${integerPart}${paddedFraction}`.replace(/^0+(?=\d)/, '') || '0';

  if (digits === '0') {
    throw new Error('invalid-amount');
  }

  return digits;
}

function tryScaleAmountToBankInteger(value: string) {
  try {
    return scaleAmountToBankInteger(value);
  } catch {
    return value.trim();
  }
}

function buildCoinJson(amount: string, denom: string) {
  return JSON.stringify([{ denom: denom.trim(), amount: tryScaleAmountToBankInteger(amount) }]);
}

function buildOutputsJson(outputs: OutputInput[], denom: string) {
  return JSON.stringify(
    outputs.map((item) => ({
      toAddress: item.toAddress.trim(),
      amount: [{ denom: denom.trim(), amount: tryScaleAmountToBankInteger(item.amount) }],
    })),
  );
}

function getFunctionSignature(kind: QuarixBankActionKind) {
  switch (kind) {
    case 'send':
      return 'send(address,address,(string,uint256)[])';
    case 'multiSend':
      return 'multiSend(address,(address,(string,uint256)[])[])';
    case 'mintCoins':
      return 'mintCoins(address,(string,uint256)[])';
    case 'distributeCoins':
      return 'distributeCoins(address,address,(string,uint256)[])';
    case 'burnCoins':
      return 'burnCoins(address,(string,uint256)[])';
  }
}

function validatePositiveReadableAmount(value: string) {
  try {
    scaleAmountToBankInteger(value);
    return true;
  } catch {
    return false;
  }
}

function BankSupplyTooltipCell({
  value,
  className,
}: {
  value: string;
  className: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  return (
    <td className={className}>
      <button
        ref={setAnchor}
        type="button"
        className="inline-flex max-w-full items-center align-top text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(true)}
        onBlur={() => setTooltipOpen(false)}
      >
        <span className="block truncate">{value}</span>
      </button>
      <FloatingTooltip open={tooltipOpen} anchorRef={{ current: anchor }} className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700">
        <span className="block select-text break-all">{value}</span>
      </FloatingTooltip>
    </td>
  );
}

export default function EvmQuarixBankPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const { showToast } = useToast();
  const bankSupplyMessages = messages.cosmosBankSupply;
  const unlockDialog = useEvmPrivateKeyUnlockDialog();
  const [data, setData] = useState<EvmBankSupplyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [actionKind, setActionKind] = useState<QuarixBankActionKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fromAddress, setFromAddress] = useState('');
  const [qoeAddress, setQoeAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [denom, setDenom] = useState('aqrx');
  const [amount, setAmount] = useState('');
  const [outputs, setOutputs] = useState<OutputInput[]>([{ toAddress: '', amount: '' }]);
  const autoRefreshEnabledRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const hasLoadedDataRef = useRef(false);

  useEffect(() => {
    function loadActiveKey() {
      const key = getActiveEvmStoredPrivateKey();
      setActiveKey(key);
      setFromAddress((current) => current || key?.address || '');
      setQoeAddress((current) => current || key?.address || '');
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    autoRefreshEnabledRef.current = autoRefreshEnabled;
  }, [autoRefreshEnabled]);

  useEffect(() => {
    hasLoadedDataRef.current = data != null;
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    function clearPollTimeout() {
      if (pollTimeoutRef.current != null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    }

    function scheduleNextPoll() {
      clearPollTimeout();

      if (!autoRefreshEnabledRef.current) {
        return;
      }

      pollTimeoutRef.current = window.setTimeout(() => {
        void load();
      }, AUTO_REFRESH_INTERVAL_MS);
    }

    async function load() {
      const isInitialLoad = !hasLoadedDataRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const profile = getActiveEvmProfile();
        const client = createEvmClient(profile.rpcUrl);
        const supply = (await client.readContract({
          address: EVM_BANK_PRECOMPILE_ADDRESS,
          abi: EVM_BANK_TOTAL_SUPPLY_ABI,
          functionName: 'totalSupply',
          args: [],
        })) as EvmBankSupplyItem[];

        if (!cancelled) {
          setData({ supply });
          setErrorMessage(null);
          hasLoadedDataRef.current = true;
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : bankSupplyMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
          scheduleNextPoll();
        }
      }
    }

    void load();

    const handleProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      clearPollTimeout();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [bankSupplyMessages.failedToLoadFallback, refreshVersion, autoRefreshEnabled]);

  const supplyItems = useMemo(() => data?.supply ?? [], [data]);
  const totalCount = supplyItems.length;
  const bankActionMessages = bankSupplyMessages.actions;

  function getActionTitle(kind: QuarixBankActionKind) {
    switch (kind) {
      case 'send':
        return messages.labels.bankSend;
      case 'multiSend':
        return messages.labels.bankMultiSend;
      case 'mintCoins':
        return messages.labels.bankMintCoins;
      case 'distributeCoins':
        return messages.labels.bankDistributeCoins;
      case 'burnCoins':
        return messages.labels.bankBurnCoins;
    }
  }

  function getActionDescription(kind: QuarixBankActionKind) {
    switch (kind) {
      case 'send':
        return bankActionMessages.sendDescription;
      case 'multiSend':
        return bankActionMessages.multiSendDescription;
      case 'mintCoins':
        return bankActionMessages.mintCoinsDescription;
      case 'distributeCoins':
        return bankActionMessages.distributeCoinsDescription;
      case 'burnCoins':
        return bankActionMessages.burnCoinsDescription;
    }
  }

  const actionPreviewArgs = useMemo(() => {
    switch (actionKind) {
      case 'send':
        return [fromAddress.trim(), toAddress.trim(), buildCoinJson(amount, denom)];
      case 'multiSend':
        return [fromAddress.trim(), buildOutputsJson(outputs, denom)];
      case 'mintCoins':
        return [qoeAddress.trim(), buildCoinJson(amount, denom)];
      case 'distributeCoins':
        return [qoeAddress.trim(), toAddress.trim(), buildCoinJson(amount, denom)];
      case 'burnCoins':
        return [fromAddress.trim(), buildCoinJson(amount, denom)];
      default:
        return [];
    }
  }, [actionKind, amount, denom, fromAddress, outputs, qoeAddress, toAddress]);

  function openAction(kind: QuarixBankActionKind) {
    setActionKind(kind);
    setActionError(null);
    setToAddress('');
    setAmount('');
    setOutputs([{ toAddress: '', amount: '' }]);
    unlockDialog.setErrorMessage(null);
  }

  function closeActionDialog() {
    setActionKind(null);
    setActionError(null);
    unlockDialog.setErrorMessage(null);
  }

  async function submitAction(password?: string) {
    if (!activeKey || !actionKind) {
      setActionError(messages.quarixEvmValidators.noActiveKey);
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);
      unlockDialog.setErrorMessage(null);

      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      unlockDialog.handleUnlockResolved();

      if (actionKind === 'send') {
        if (!isAddress(fromAddress.trim()) || !isAddress(toAddress.trim()) || !validatePositiveReadableAmount(amount) || !denom.trim()) {
          throw new Error(bankActionMessages.invalidAmount);
        }
      } else if (actionKind === 'multiSend') {
        if (!isAddress(fromAddress.trim()) || !denom.trim() || !outputs.length || outputs.some((item) => !isAddress(item.toAddress.trim()) || !validatePositiveReadableAmount(item.amount))) {
          throw new Error(bankActionMessages.invalidAmount);
        }
      } else if (actionKind === 'mintCoins') {
        if (!isAddress(qoeAddress.trim()) || !validatePositiveReadableAmount(amount) || !denom.trim()) {
          throw new Error(bankActionMessages.invalidAmount);
        }
      } else if (actionKind === 'distributeCoins') {
        if (!isAddress(qoeAddress.trim()) || !isAddress(toAddress.trim()) || !validatePositiveReadableAmount(amount) || !denom.trim()) {
          throw new Error(bankActionMessages.invalidAmount);
        }
      } else if (!isAddress(fromAddress.trim()) || !validatePositiveReadableAmount(amount) || !denom.trim()) {
        throw new Error(bankActionMessages.invalidAmount);
      }

      await writeEvmContractMethodDirect({
        address: EVM_BANK_PRECOMPILE_ADDRESS,
        abiJson: JSON.stringify(EVM_BANK_ABI),
        functionSignature: getFunctionSignature(actionKind),
        rawArgs: actionPreviewArgs,
        privateKey,
        value: '0',
      });

      showToast({
        title: getActionTitle(actionKind),
        description: activeKey.address,
      });

      closeActionDialog();
      if (actionKind === 'mintCoins' || actionKind === 'burnCoins') {
        setRefreshVersion((current) => current + 1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : messages.quarixEvmValidators.failedToBroadcastDelegate;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setActionError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && data == null) {
    return (
      <AppShell mode="evm">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={3} toolbarIcons={1} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell mode="evm">
        <main className="content-panel">
          <h1>{messages.labels.bank}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="evm">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.bank}</h1>
          <p className="mt-2 text-sm text-slate-500">{bankSupplyMessages.pageDescription}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {totalCount
                  ? bankSupplyMessages.totalDenomsLabel.replace('{count}', totalCount.toLocaleString(locale))
                  : bankSupplyMessages.emptyDenomsLabel}
              </p>
              <p className="mt-1 text-sm text-slate-500">{bankSupplyMessages.description}</p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <ActionIconButton tooltip={messages.labels.bankSend} className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openAction('send')}>
                <IconSend className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton tooltip={messages.labels.bankMultiSend} className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openAction('multiSend')}>
                <IconDevicesShare className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton tooltip={messages.labels.bankMintCoins} className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openAction('mintCoins')}>
                <IconNavigationPlus className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton tooltip={messages.labels.bankDistributeCoins} className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openAction('distributeCoins')}>
                <IconTransferOut className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton tooltip={messages.labels.bankBurnCoins} className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openAction('burnCoins')}>
                <IconFlame className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={showRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showRawJson
                    ? 'h-8 w-8 text-sky-600'
                    : 'h-8 w-8 text-slate-400 hover:text-slate-600'
                }
                onClick={() => setShowRawJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={autoRefreshEnabled ? messages.homeMetrics.disableAutoRefresh : messages.homeMetrics.enableAutoRefresh}
                aria-pressed={autoRefreshEnabled}
                className={autoRefreshEnabled ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                {autoRefreshEnabled ? <IconPlayerPause className="size-4" stroke={1.8} /> : <IconPlayerPlay className="size-4" stroke={1.8} />}
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
            <table className="data-table min-w-[1120px] table-fixed">
              <thead>
                <tr>
                  <th className="w-[380px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{bankSupplyMessages.denom}</th>
                  <th className="w-[300px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{bankSupplyMessages.readable}</th>
                  <th className="w-[440px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{bankSupplyMessages.rawAmount}</th>
                </tr>
              </thead>
              <tbody>
                {supplyItems.length ? (
                  supplyItems.map((item) => {
                    const rawAmount = normalizeAmount(item.amount);

                    return (
                      <tr key={item.denom} className="border-t border-slate-200">
                        <BankSupplyTooltipCell value={item.denom} className="px-5 py-3 text-sm text-slate-700" />
                        <BankSupplyTooltipCell
                          value={`${formatReadableTokenAmount(rawAmount)} ${formatReadableDenom(item.denom)}`}
                          className="px-5 py-3 text-sm text-slate-900"
                        />
                        <BankSupplyTooltipCell value={rawAmount} className="px-5 py-3 text-sm tabular-nums text-slate-700" />
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                      0
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showRawJson ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={data as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>

        <ModalDialog
          open={actionKind != null}
          onOpenChange={(open) => {
            if (!open) {
              closeActionDialog();
            }
          }}
          title={actionKind ? getActionTitle(actionKind) : messages.labels.bank}
          description={actionKind ? getActionDescription(actionKind) : undefined}
          maxWidthClassName="max-w-2xl"
          footer={null}
        >
          <div className="space-y-4">
            {(actionKind === 'send' || actionKind === 'multiSend' || actionKind === 'burnCoins') ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">{bankActionMessages.fromAddress}</span>
                <Input value={fromAddress} onChange={(event) => setFromAddress(event.target.value)} placeholder="0x0000000000000000000000000000000000000000" disabled={submitting} />
              </label>
            ) : null}

            {(actionKind === 'mintCoins' || actionKind === 'distributeCoins') ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">{bankActionMessages.qoeAddress}</span>
                <Input value={qoeAddress} onChange={(event) => setQoeAddress(event.target.value)} placeholder="0x0000000000000000000000000000000000000000" disabled={submitting} />
              </label>
            ) : null}

            {(actionKind === 'send' || actionKind === 'distributeCoins') ? (
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">{bankActionMessages.toAddress}</span>
                <Input value={toAddress} onChange={(event) => setToAddress(event.target.value)} placeholder="0x0000000000000000000000000000000000000000" disabled={submitting} />
              </label>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">{bankActionMessages.denom}</span>
                <Input value={denom} onChange={(event) => setDenom(event.target.value)} placeholder="aqrx" disabled={submitting} />
              </label>

              {actionKind !== 'multiSend' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">{bankActionMessages.amount}</span>
                  <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={bankActionMessages.amountPlaceholder} disabled={submitting} />
                </label>
              ) : null}
            </div>

            <p className="-mt-1 text-xs text-slate-500">{bankActionMessages.amountHint}</p>

            {actionKind === 'multiSend' ? (
              <div className="space-y-3">
                {outputs.map((item, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <Input
                      value={item.toAddress}
                      onChange={(event) => setOutputs((current) => current.map((output, outputIndex) => (outputIndex === index ? { ...output, toAddress: event.target.value } : output)))}
                      placeholder="0x0000000000000000000000000000000000000000"
                      disabled={submitting}
                    />
                    <Input
                      value={item.amount}
                      onChange={(event) => setOutputs((current) => current.map((output, outputIndex) => (outputIndex === index ? { ...output, amount: event.target.value } : output)))}
                      placeholder={bankActionMessages.amountPlaceholder}
                      disabled={submitting}
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setOutputs((current) => [...current, { toAddress: '', amount: '' }])} disabled={submitting}>
                    {messages.common.add}
                  </Button>
                </div>
              </div>
            ) : null}

            {actionError ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(actionError, locale)}</div> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeActionDialog} disabled={submitting}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void submitAction()} disabled={submitting}>
                {submitting ? messages.evmTxDetail.sending : messages.common.submit}
              </Button>
            </div>
          </div>
        </ModalDialog>

        <EvmPrivateKeyUnlockDialog
          open={unlockDialog.open}
          password={unlockDialog.password}
          errorMessage={unlockDialog.errorMessage}
          submitting={submitting}
          title={messages.quarixEvmValidators.unlockPrivateKey}
          description={activeKey ? messages.quarixEvmValidators.unlockWithdrawalDescription.replace('{name}', activeKey.name) : messages.quarixEvmValidators.unlockFallbackDescription}
          placeholder={messages.quarixEvmValidators.password}
          confirmLabel={messages.quarixEvmValidators.unlock}
          onOpenChange={(open) => {
            if (!open) {
              unlockDialog.closeDialog();
            }
          }}
          onPasswordChange={unlockDialog.setPassword}
          onConfirm={() => {
            void submitAction(unlockDialog.password);
          }}
        />
      </main>
    </AppShell>
  );
}
