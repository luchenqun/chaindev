'use client';

import { IconPlayerPause, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';
import { formatReadableDenom, formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type CosmosSupplyItem = {
  denom: string;
  amount: string;
};

type CosmosSupplyResponse = {
  supply?: CosmosSupplyItem[];
  pagination?: {
    next_key?: string | null;
    total?: string;
  };
};

type CosmosStatusResponse = {
  result?: {
    sync_info?: {
      latest_block_height?: string;
      latest_block_time?: string;
    };
  };
};

type TendermintBlockResponse = {
  result?: {
    block?: {
      header?: {
        height?: string;
        time?: string;
      };
    };
  };
};

function clampPollIntervalMs(value: number) {
  return Math.max(1_000, Math.min(30_000, value));
}

function BankSupplyTooltipCell({
  value,
  className,
}: {
  value: string;
  className: string;
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
    <td className={className}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex max-w-full items-center align-top text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="block truncate">{value}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{value}</span>
      </FloatingTooltip>
    </td>
  );
}

export default function CosmosBankSupplyPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const bankSupplyMessages = messages.cosmosBankSupply;
  const [data, setData] = useState<CosmosSupplyResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const autoRefreshEnabledRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const pollIntervalMsRef = useRef(12_000);
  const pollIntervalInitializedRef = useRef(false);
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
      }, pollIntervalMsRef.current);
    }

    async function updatePollInterval(profile: ReturnType<typeof getActiveCosmosProvider>) {
      try {
        const response = await fetch(`${profile.rpcUrl}/status`);

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CosmosStatusResponse;
        const latestHeight = Number.parseInt(payload.result?.sync_info?.latest_block_height ?? '0', 10);
        const latestBlockTime = payload.result?.sync_info?.latest_block_time ? new Date(payload.result.sync_info.latest_block_time).getTime() : null;

        if (!Number.isFinite(latestHeight) || latestHeight < 1 || !latestBlockTime || !Number.isFinite(latestBlockTime)) {
          return;
        }

        const previousHeight = Math.max(1, latestHeight - 10);
        const blockSpan = latestHeight - previousHeight;

        if (blockSpan <= 0) {
          pollIntervalMsRef.current = 12_000;
          pollIntervalInitializedRef.current = true;
          return;
        }

        const blockResponse = await fetch(`${profile.rpcUrl}/block?height=${previousHeight}`);

        if (!blockResponse.ok) {
          return;
        }

        const blockPayload = (await blockResponse.json()) as TendermintBlockResponse;
        const previousBlockTime = blockPayload.result?.block?.header?.time ? new Date(blockPayload.result.block.header.time).getTime() : null;

        if (!previousBlockTime || !Number.isFinite(previousBlockTime)) {
          return;
        }

        const averageIntervalMs = (latestBlockTime - previousBlockTime) / blockSpan;

        if (!Number.isFinite(averageIntervalMs) || averageIntervalMs <= 0) {
          return;
        }

        pollIntervalMsRef.current = clampPollIntervalMs(Math.round(averageIntervalMs));
        pollIntervalInitializedRef.current = true;
      } catch {
        return;
      }
    }

    async function load() {
      const isInitialLoad = !hasLoadedDataRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const profile = getActiveCosmosProvider();

        if (autoRefreshEnabledRef.current && !pollIntervalInitializedRef.current) {
          await updatePollInterval(profile);
        }

        const response = await fetch(`${profile.restUrl}/cosmos/bank/v1beta1/supply`);

        if (!response.ok) {
          throw new Error(`${bankSupplyMessages.failedToLoadFallback} (${response.status})`);
        }

        const next = (await response.json()) as CosmosSupplyResponse;

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : bankSupplyMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          if (isInitialLoad) {
            setLoading(false);
          }

          setRefreshing(false);
          scheduleNextPoll();
        }
      }
    }

    void load();

    const handleProfileChanged = () => {
      pollIntervalInitializedRef.current = false;
      pollIntervalMsRef.current = 12_000;
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      clearPollTimeout();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [bankSupplyMessages.failedToLoadFallback, refreshVersion, autoRefreshEnabled]);

  useEffect(() => {
    if (autoRefreshEnabled) {
      pollIntervalInitializedRef.current = false;
      return;
    }

    pollIntervalInitializedRef.current = false;
    pollIntervalMsRef.current = 12_000;
  }, [autoRefreshEnabled]);

  const supplyItems = useMemo(() => data?.supply ?? [], [data]);
  const totalCount = supplyItems.length;

  if (loading && data == null) {
    return (
      <AppShell mode="cosmos">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={3} toolbarIcons={2} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell mode="cosmos">
        <main className="content-panel">
          <h1>{messages.labels.bankSupply}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="cosmos">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.bankSupply}</h1>
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
                  supplyItems.map((item) => (
                    <tr key={item.denom} className="border-t border-slate-200">
                      <BankSupplyTooltipCell value={item.denom} className="px-5 py-3 text-sm text-slate-700" />
                      <BankSupplyTooltipCell
                        value={`${formatReadableTokenAmount(item.amount)} ${formatReadableDenom(item.denom)}`}
                        className="px-5 py-3 text-sm text-slate-900"
                      />
                      <BankSupplyTooltipCell value={item.amount} className="px-5 py-3 text-sm tabular-nums text-slate-700" />
                    </tr>
                  ))
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
