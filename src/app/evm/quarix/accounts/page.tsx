'use client';

import { fromBech32 } from '@cosmjs/encoding';
import { IconArrowsExchange, IconCode, IconRefresh } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex, formatEther } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { getActiveEvmCurrencyNameClient } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { EVM_AUTH_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
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

type EvmAuthAccountsResponse = {
  accounts?: unknown[];
  pagination?: {
    next_key?: string | null;
    total?: string | number;
  };
};

type EvmAuthAccountsJsonPayload = EvmAuthAccountsResponse | unknown[];

type EvmAuthPageResponse = {
  nextKey?: `0x${string}` | string;
  total?: bigint | number | string;
};

type QuarixEvmAccountItem = {
  evmAddress: string | null;
  cosmosAddress: string | null;
  type: string | null;
  isModuleAccount: boolean;
  permissions: string[];
  sequence: string | null;
  balanceLabel: string;
  balanceExactLabel: string;
};

type QuarixEvmAccountsState = {
  accounts: QuarixEvmAccountItem[];
  response: EvmAuthAccountsResponse;
  page: number;
  pageSize: number;
  totalAccounts: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

const EVM_AUTH_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmAuth')?.abi ?? []) as readonly unknown[];

const PAGE_SIZE = 15;
type AddressDisplayMode = 'hex' | 'bech32';

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function normalizeAddressCandidate(value: unknown) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}

function normalizeStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeNumberLikeValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function deriveEvmAddressFromCosmosAddress(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const { data } = fromBech32(value);

    if (data.length < 20) {
      return null;
    }

    return bytesToHex(data.slice(-20));
  } catch {
    return null;
  }
}

function formatEvmAddressForDisplay(input: { evmAddress: string | null; cosmosAddress: string | null }, mode: AddressDisplayMode) {
  if (mode === 'bech32') {
    return input.cosmosAddress ?? input.evmAddress ?? null;
  }

  return input.evmAddress ?? input.cosmosAddress ?? null;
}

function formatBalanceLabel(value: bigint) {
  const amount = Number(formatEther(value));

  if (!Number.isFinite(amount) || amount === 0) {
    return '0';
  }

  if (amount < 0.000001) {
    return '<0.000001';
  }

  return amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, '');
}

function formatExactBalanceLabel(value: bigint, currencyName: string) {
  return `${formatEther(value)} ${currencyName}`;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function formatAccountTypeLabel(record: Record<string, unknown>) {
  const rawType = normalizeStringValue(record['@type']) ?? normalizeStringValue(record.type);
  const module = resolveNestedRecord(record, 'module');
  const moduleName =
    normalizeStringValue(record.name) ??
    normalizeStringValue(record.module_name) ??
    normalizeStringValue(record.moduleName) ??
    normalizeStringValue(module?.name) ??
    normalizeStringValue(module?.module_name) ??
    normalizeStringValue(module?.moduleName);
  const permissions = [
    ...normalizeStringArray(record.permissions),
    ...normalizeStringArray(module?.permissions),
  ];

  if (moduleName) {
    return {
      label: moduleName,
      isModuleAccount: true,
      permissions,
    };
  }

  if (!rawType) {
    return {
      label: null,
      isModuleAccount: false,
      permissions: [],
    };
  }

  const normalizedType = rawType.replace(/^\//, '');

  if (normalizedType === 'cosmos.auth.v1beta1.BaseAccount') {
    return {
      label: 'Base Account',
      isModuleAccount: false,
      permissions: [],
    };
  }

  const lastSegment = normalizedType.split('.').at(-1) ?? normalizedType;
  return {
    label: lastSegment.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    isModuleAccount: false,
    permissions: [],
  };
}

function resolveNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function mapAccountItem(item: unknown, index: number) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const baseAccount = resolveNestedRecord(record, 'base_account') ?? resolveNestedRecord(record, 'baseAccount');
  const evmAccount = resolveNestedRecord(record, 'base_vesting_account') ?? resolveNestedRecord(record, 'baseVestingAccount');
  const source = baseAccount ?? evmAccount ?? record;

  const cosmosAddress =
    normalizeStringValue(source.address) ??
    normalizeStringValue(record.address) ??
    normalizeStringValue(resolveNestedRecord(record, 'account')?.address) ??
    null;
  const evmAddress =
    normalizeAddressCandidate(record.evm_address) ??
    normalizeAddressCandidate(record.evmAddress) ??
    normalizeAddressCandidate(source.evm_address) ??
    normalizeAddressCandidate(source.evmAddress) ??
    normalizeAddressCandidate(record.address) ??
    deriveEvmAddressFromCosmosAddress(cosmosAddress);
  const accountType = formatAccountTypeLabel(record);

  return {
    evmAddress,
    cosmosAddress,
    type: accountType.label,
    isModuleAccount: accountType.isModuleAccount,
    permissions: accountType.permissions,
    sequence: normalizeNumberLikeValue(source.sequence),
    balanceLabel: '0',
    balanceExactLabel: '0',
  } satisfies QuarixEvmAccountItem;
}

function ModuleAccountTypeBadge({
  label,
  permissions,
}: {
  label: string;
  permissions: string[];
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 outline-none"
        tabIndex={0}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        {label}
      </span>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[320px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Permissions</p>
          {permissions.length ? (
            permissions.map((permission) => (
              <p key={permission} className="break-all text-sm">
                {permission}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-500">No permissions</p>
          )}
        </div>
      </FloatingTooltip>
    </>
  );
}

function EvmAccountBalanceTooltip({
  label,
  exactLabel,
}: {
  label: string;
  exactLabel: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-w-0 max-w-full items-center text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="truncate">{label}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{exactLabel}</span>
      </FloatingTooltip>
    </>
  );
}

async function requestQuarixEvmAccounts(requestedPage: number): Promise<QuarixEvmAccountsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const currencyName = getActiveEvmCurrencyNameClient();
  const page = Math.max(1, Math.trunc(requestedPage));
  const pageRequest: PageRequest = {
    key: '0x',
    offset: BigInt((page - 1) * PAGE_SIZE),
    limit: BigInt(PAGE_SIZE),
    countTotal: true,
    reverse: false,
  };

  const result = (await client.readContract({
    address: EVM_AUTH_ADDRESS,
    abi: EVM_AUTH_ABI,
    functionName: 'accountsAsJSON',
    args: [pageRequest],
  })) as readonly [string, EvmAuthPageResponse];
  const [accountsJson, pageResponse] = result;

  const parsed = JSON.parse(accountsJson) as EvmAuthAccountsJsonPayload;
  const response = Array.isArray(parsed) ? ({ accounts: parsed } satisfies EvmAuthAccountsResponse) : parsed;
  const sourceAccounts = Array.isArray(parsed) ? parsed : Array.isArray(response.accounts) ? response.accounts : [];
  const mappedAccounts = sourceAccounts.map(mapAccountItem).filter((item): item is QuarixEvmAccountItem => item != null);
  const balanceEntries = await Promise.allSettled(
    mappedAccounts.map(async (account) => {
      if (!account.evmAddress) {
        return [account.evmAddress, null] as const;
      }

      const balance = await client.getBalance({ address: account.evmAddress as `0x${string}` });
      return [account.evmAddress, balance] as const;
    }),
  );
  const balancesByAddress = new Map<string, bigint>();

  for (const entry of balanceEntries) {
    if (entry.status !== 'fulfilled') {
      continue;
    }

    const [address, balance] = entry.value;

    if (address && balance != null) {
      balancesByAddress.set(address.toLowerCase(), balance);
    }
  }

  const accounts = mappedAccounts.map((account) => ({
    ...account,
    balanceLabel: account.evmAddress ? formatBalanceLabel(balancesByAddress.get(account.evmAddress.toLowerCase()) ?? 0n) : '0',
    balanceExactLabel: formatExactBalanceLabel(account.evmAddress ? (balancesByAddress.get(account.evmAddress.toLowerCase()) ?? 0n) : 0n, currencyName),
  }));
  const pageResponseTotal = Number.parseInt(String(pageResponse?.total ?? ''), 10);
  const jsonPaginationTotal = Number.parseInt(String(response.pagination?.total ?? ''), 10);
  const totalAccounts = Math.max(accounts.length, Number.isFinite(pageResponseTotal) ? pageResponseTotal : 0, Number.isFinite(jsonPaginationTotal) ? jsonPaginationTotal : 0);
  const totalPages = Math.max(1, Math.ceil(totalAccounts / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const hasNextPage = Boolean(pageResponse?.nextKey && pageResponse.nextKey !== '0x') || normalizedPage < totalPages;

  return {
    accounts,
    response,
    page: normalizedPage,
    pageSize: PAGE_SIZE,
    totalAccounts,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage,
  };
}

export default function EvmQuarixAccountsPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixEvmAccounts;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<QuarixEvmAccountsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [addressDisplayMode, setAddressDisplayMode] = useState<AddressDisplayMode>('hex');
  const hasLoadedDataRef = useRef(false);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

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
        const next = await requestQuarixEvmAccounts(currentPage);

        if (!cancelled) {
          setData(next);
          hasLoadedDataRef.current = true;
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
          }
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
  }, [currentPage, pageMessages.failedToLoadFallback, pathname, refreshVersion, router, searchParamsText]);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  if (loading && data == null) {
    return (
      <AppShell mode="evm">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={5} toolbarIcons={1} />
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
                {data.totalAccounts ? pageMessages.totalAccountsLabel.replace('{count}', data.totalAccounts.toLocaleString(locale)) : pageMessages.emptyAccountsLabel}
              </p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <PaginationControls
                page={data.page}
                totalPages={data.totalPages}
                hasPreviousPage={data.hasPreviousPage}
                hasNextPage={data.hasNextPage}
                disabled={loading || refreshing}
                plain
                onPageChange={handlePageChange}
              />
              <ActionIconButton
                tooltip={addressDisplayMode === 'hex' ? messages.cosmosTxDetail.switchToBech32 : messages.cosmosTxDetail.switchToHex}
                className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700"
                onClick={() => setAddressDisplayMode((current) => (current === 'hex' ? 'bech32' : 'hex'))}
              >
                <IconArrowsExchange className="size-4" stroke={1.8} />
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
            <table className="data-table min-w-[1100px] table-fixed">
              <colgroup>
                <col className="w-[360px]" />
                <col className="w-[140px]" />
                <col className="w-[180px]" />
                <col className="w-[180px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.balances}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.sequence}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.evmTxDetail.type}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length ? (
                  accounts.map((account, index) => {
                    const displayAddress = formatEvmAddressForDisplay(account, addressDisplayMode);

                    return (
                      <tr key={`${account.evmAddress ?? account.cosmosAddress ?? index}-${index}`} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          {account.evmAddress?.startsWith('0x') && displayAddress ? (
                            <AddressLink address={displayAddress} href={`/evm/address/${account.evmAddress}`} label={displayAddress} className="font-medium text-sky-600 hover:text-sky-700" />
                          ) : displayAddress ? (
                            <span className="text-slate-700">{displayAddress}</span>
                          ) : (
                            <span className="text-slate-500">{pageMessages.unavailableValue}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                          <EvmAccountBalanceTooltip label={account.balanceLabel} exactLabel={account.balanceExactLabel} />
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{account.sequence ?? pageMessages.unavailableValue}</td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          {account.isModuleAccount && account.type ? (
                            <ModuleAccountTypeBadge label={account.type} permissions={account.permissions} />
                          ) : (
                            account.type ?? pageMessages.unavailableValue
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.emptyAccountsLabel}
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
    </AppShell>
  );
}
