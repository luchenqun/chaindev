'use client';

import { IconCode, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import {
  getQuarixAllocateInvestmentProgramPools,
  getQuarixInvestmentProgramPools,
  type QuarixAllocatedInvestmentProgramPool,
  type QuarixInvestmentProgramPool,
  type QuarixStakingCollectionState,
} from '@/domains/cosmos/client/quarix-staking';
import { CosmosAddressLink } from '@/domains/cosmos/ui/address-link';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';

type QueryState<T> = {
  data: QuarixStakingCollectionState<T> | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

function stringifyCellValue(value: unknown) {
  if (value == null || value === '') {
    return '--';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatTokenAmountWithPrecision(value: unknown, precision = 18) {
  const rawValue = stringifyCellValue(value);

  if (rawValue === '--' || !/^\d+$/.test(rawValue)) {
    return rawValue;
  }

  const raw = BigInt(rawValue);
  const divisor = 10n ** BigInt(precision);
  const whole = raw / divisor;
  const fraction = raw % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fraction.toString().padStart(precision, '0').replace(/0+$/, '')}`;
}

function PoolValueCell({ value }: { value: unknown }) {
  return <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{stringifyCellValue(value)}</td>;
}

function formatDecimalPercent(value: unknown) {
  const rawValue = stringifyCellValue(value);

  if (rawValue === '--') {
    return rawValue;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return rawValue;
  }

  return `${(parsed * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function PercentValueCell({ value }: { value: unknown }) {
  return <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{formatDecimalPercent(value)}</td>;
}

function StakingAmountCell({ value }: { value: unknown }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const rawValue = stringifyCellValue(value);
  const displayValue = formatTokenAmountWithPrecision(value);
  const hasRawTooltip = rawValue !== '--';

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (!hasRawTooltip) {
      return;
    }

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

  if (!hasRawTooltip) {
    return <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{displayValue}</td>;
  }

  return (
    <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex max-w-full items-center align-top text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="block truncate">{displayValue}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{rawValue}</span>
      </FloatingTooltip>
    </td>
  );
}

function createQueryState<T>(): QueryState<T> {
  return {
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  };
}

export function QuarixStakingPanels() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixStaking;
  const [investmentProgramPoolsState, setInvestmentProgramPoolsState] = useState<QueryState<QuarixInvestmentProgramPool>>(() => createQueryState());
  const [allocateInvestmentProgramPoolsState, setAllocateInvestmentProgramPoolsState] = useState<QueryState<QuarixAllocatedInvestmentProgramPool>>(() => createQueryState());
  const [showInvestmentProgramPoolsJson, setShowInvestmentProgramPoolsJson] = useState(false);
  const [showAllocateInvestmentProgramPoolsJson, setShowAllocateInvestmentProgramPoolsJson] = useState(false);
  const investmentProgramPoolsLoadedRef = useRef(false);
  const allocateInvestmentProgramPoolsLoadedRef = useRef(false);

  const loadInvestmentProgramPools = useCallback(async () => {
    const isInitialLoad = !investmentProgramPoolsLoadedRef.current;

    setInvestmentProgramPoolsState((current) => ({
      ...current,
      loading: isInitialLoad,
      refreshing: !isInitialLoad,
      error: null,
    }));

    try {
      const next = await getQuarixInvestmentProgramPools();

      investmentProgramPoolsLoadedRef.current = true;
      setInvestmentProgramPoolsState({
        data: next,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      setInvestmentProgramPoolsState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : pageMessages.failedToLoadFallback,
      }));
    }
  }, [pageMessages.failedToLoadFallback]);

  const loadAllocateInvestmentProgramPools = useCallback(async () => {
    const isInitialLoad = !allocateInvestmentProgramPoolsLoadedRef.current;

    setAllocateInvestmentProgramPoolsState((current) => ({
      ...current,
      loading: isInitialLoad,
      refreshing: !isInitialLoad,
      error: null,
    }));

    try {
      const next = await getQuarixAllocateInvestmentProgramPools();

      allocateInvestmentProgramPoolsLoadedRef.current = true;
      setAllocateInvestmentProgramPoolsState({
        data: next,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (error) {
      setAllocateInvestmentProgramPoolsState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : pageMessages.failedToLoadFallback,
      }));
    }
  }, [pageMessages.failedToLoadFallback]);

  useEffect(() => {
    void loadInvestmentProgramPools();
    void loadAllocateInvestmentProgramPools();

    const handleActiveRpcProfileChanged = () => {
      void loadInvestmentProgramPools();
      void loadAllocateInvestmentProgramPools();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [loadAllocateInvestmentProgramPools, loadInvestmentProgramPools]);

  const investmentProgramPools = useMemo(() => investmentProgramPoolsState.data?.items ?? [], [investmentProgramPoolsState.data]);
  const allocateInvestmentProgramPools = useMemo(() => allocateInvestmentProgramPoolsState.data?.items ?? [], [allocateInvestmentProgramPoolsState.data]);

  return (
    <div className="mt-4 space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{pageMessages.investmentProgramPools}</p>
            {investmentProgramPoolsState.error ? <p className="mt-2 text-sm text-rose-600">{translateRuntimeText(investmentProgramPoolsState.error, locale)}</p> : null}
          </div>
          <div className="flex items-center gap-0 lg:justify-end">
            <ActionIconButton
              tooltip={showInvestmentProgramPoolsJson ? messages.common.hideRawJson : messages.common.showRawJson}
              className={
                showInvestmentProgramPoolsJson
                  ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                  : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
              }
              onClick={() => setShowInvestmentProgramPoolsJson((current) => !current)}
            >
              <IconCode className="size-4" stroke={1.8} />
            </ActionIconButton>
            <ActionIconButton
              tooltip={messages.common.refresh}
              className={investmentProgramPoolsState.refreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
              onClick={() => void loadInvestmentProgramPools()}
            >
              <IconRefresh className="size-4" stroke={1.8} />
            </ActionIconButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1360px] table-fixed">
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[180px]" />
              <col className="w-[260px]" />
              <col className="w-[190px]" />
              <col className="w-[190px]" />
              <col className="w-[220px]" />
              <col className="w-[230px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.id}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.name}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.details}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.royaltyFee}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.votingWeight}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.maxStaking}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.currentStaking}</th>
              </tr>
            </thead>
            <tbody>
              {investmentProgramPools.length ? (
                investmentProgramPools.map((pool, index) => (
                  <tr key={`${stringifyCellValue(pool.id)}-${index}`} className="border-t border-slate-200">
                    <PoolValueCell value={pool.id} />
                    <PoolValueCell value={pool.name} />
                    <PoolValueCell value={pool.details} />
                    <PercentValueCell value={pool.royalty_fee ?? pool.royaltyFee} />
                    <PoolValueCell value={pool.voting_weight ?? pool.votingWeight} />
                    <StakingAmountCell value={pool.max_staking ?? pool.maxStaking} />
                    <StakingAmountCell value={pool.current_staking ?? pool.currentStaking} />
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    {pageMessages.emptyItemsLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {showInvestmentProgramPoolsJson && investmentProgramPoolsState.data ? (
          <div className="border-t border-slate-200 px-5 py-4">
            <JsonViewPanel value={investmentProgramPoolsState.data.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{pageMessages.allocateInvestmentProgramPools}</p>
            {allocateInvestmentProgramPoolsState.error ? <p className="mt-2 text-sm text-rose-600">{translateRuntimeText(allocateInvestmentProgramPoolsState.error, locale)}</p> : null}
          </div>
          <div className="flex items-center gap-0 lg:justify-end">
            <ActionIconButton
              tooltip={showAllocateInvestmentProgramPoolsJson ? messages.common.hideRawJson : messages.common.showRawJson}
              className={
                showAllocateInvestmentProgramPoolsJson
                  ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                  : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
              }
              onClick={() => setShowAllocateInvestmentProgramPoolsJson((current) => !current)}
            >
              <IconCode className="size-4" stroke={1.8} />
            </ActionIconButton>
            <ActionIconButton
              tooltip={messages.common.refresh}
              className={allocateInvestmentProgramPoolsState.refreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
              onClick={() => void loadAllocateInvestmentProgramPools()}
            >
              <IconRefresh className="size-4" stroke={1.8} />
            </ActionIconButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px] table-fixed">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[580px]" />
              <col className="w-[160px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.item}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.validatorAddress}</th>
                <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.ippId}</th>
              </tr>
            </thead>
            <tbody>
              {allocateInvestmentProgramPools.length ? (
                allocateInvestmentProgramPools.map((pool, index) => {
                  const validatorAddress = pool.validator_address ?? pool.validatorAddress ?? '';

                  return (
                    <tr key={`${validatorAddress}-${stringifyCellValue(pool.ipp_id ?? pool.ippId)}-${index}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-500">{(index + 1).toLocaleString(locale)}</td>
                      <td className="px-5 py-3 text-sm">
                        {validatorAddress ? (
                          <CosmosAddressLink href={`/cosmos/validator/${validatorAddress}`} label={validatorAddress} copyValue={validatorAddress} prefetch={false} />
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                      <PoolValueCell value={pool.ipp_id ?? pool.ippId} />
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                    {pageMessages.emptyItemsLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {showAllocateInvestmentProgramPoolsJson && allocateInvestmentProgramPoolsState.data ? (
          <div className="border-t border-slate-200 px-5 py-4">
            <JsonViewPanel value={allocateInvestmentProgramPoolsState.data.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        ) : null}
      </section>
    </div>
  );
}
