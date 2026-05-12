'use client';

import { IconPlayerPause, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Abi } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
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

const AUTO_REFRESH_INTERVAL_MS = 12_000;
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

export default function EvmQuarixBankSupplyPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const bankSupplyMessages = messages.cosmosBankSupply;
  const [data, setData] = useState<EvmBankSupplyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const autoRefreshEnabledRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const hasLoadedDataRef = useRef(false);

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
          <h1>{messages.labels.bankSupply}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="evm">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.bankSupply}</h1>
          <p className="mt-2 text-sm text-slate-500">{translateRuntimeText('Showing the total supply list returned by the active Quarix EVM bank precompile.', locale)}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {totalCount
                  ? bankSupplyMessages.totalDenomsLabel.replace('{count}', totalCount.toLocaleString(locale))
                  : bankSupplyMessages.emptyDenomsLabel}
              </p>
              <p className="mt-1 text-sm text-slate-500">{translateRuntimeText('Showing the total supply list returned by the active Quarix EVM bank precompile.', locale)}</p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
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
        </section>

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.evmTxDetail.rawJson}</h2>
          <div className="mt-4">
            <JsonViewPanel value={data as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
