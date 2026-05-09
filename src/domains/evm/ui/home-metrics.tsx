'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { MetricCardsSkeleton } from '@/components/ui/loading-placeholders';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';

type Metric = {
  label: string;
  value: string;
  subtext?: string;
};

type HeaderItem = {
  label: string;
  value: string;
};

function translateMetricLabel(label: string, metricMessages: ReturnType<typeof useMessages>['homeMetrics']) {
  const labelMap: Record<string, string> = {
    'Latest Block': metricMessages.latestBlock,
    'Latest Block Time': metricMessages.latestBlockTime,
    'Average Block Time': metricMessages.averageBlockTime,
    'Gas Price': metricMessages.gasPrice,
    'Pending Tx Count': metricMessages.pendingTxCount,
    'Recent Tx Count': metricMessages.recentTxCount,
    'Cached Transactions': metricMessages.cachedTransactions,
    'Observed Accounts': metricMessages.observedAccounts,
  };

  return labelMap[label] ?? label;
}

function MetricCard({ label, value, subtext }: Metric) {
  const tooltipTriggerRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {subtext ? (
          <span
            ref={tooltipTriggerRef}
            className="inline-flex"
            onBlur={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            tabIndex={0}
          >
            <span className="inline-flex items-center justify-center text-slate-300 outline-none">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <FloatingTooltip
              open={tooltipOpen}
              anchorRef={tooltipTriggerRef}
              className="w-[220px] whitespace-normal border border-slate-200 bg-white leading-5 text-slate-700"
            >
              {subtext}
            </FloatingTooltip>
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function EvmHomeMetrics() {
  const messages = useMessages();
  const { locale } = useLocale();
  const metricMessages = messages.homeMetrics;
  const { snapshot, errorMessage } = useEvmHomeData();
  const fallbackMetrics: Metric[] = [
    { label: metricMessages.latestBlock, value: messages.common.unavailable },
    { label: metricMessages.latestBlockTime, value: messages.common.unavailable },
    { label: metricMessages.averageBlockTime, value: messages.common.unavailable },
    { label: metricMessages.gasPrice, value: messages.common.unavailable },
    { label: metricMessages.pendingTxCount, value: messages.common.unavailable },
    { label: metricMessages.recentTxCount, value: messages.common.unavailable },
    { label: metricMessages.cachedTransactions, value: messages.common.unavailable },
    { label: metricMessages.observedAccounts, value: messages.common.unavailable },
  ];
  const fallbackHeader: HeaderItem[] = [
    { label: metricMessages.connection, value: metricMessages.directJsonRpc },
    { label: metricMessages.providerName, value: messages.common.unavailable },
    { label: metricMessages.nativeCurrency, value: messages.common.unavailable },
    { label: metricMessages.chainId, value: messages.common.unavailable },
  ];
  const metrics =
    (snapshot?.metrics as Metric[] | undefined)?.map((metric) => ({
      ...metric,
      label: translateMetricLabel(metric.label, metricMessages),
    })) ?? fallbackMetrics;
  const firstRowMetrics = metrics.slice(0, 4);
  const secondRowMetrics = metrics.slice(4, 8);
  const headerItems = snapshot
    ? [
        { label: metricMessages.connection, value: snapshot.header.connection },
        { label: metricMessages.providerName, value: snapshot.header.providerName },
        { label: metricMessages.nativeCurrency, value: snapshot.header.nativeCurrency },
        { label: metricMessages.chainId, value: snapshot.header.chainId },
      ]
    : fallbackHeader;

  if (!snapshot && !errorMessage) {
    return <MetricCardsSkeleton headerItems={4} metricRows={[4, 4]} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {headerItems.map((item) => (
          <div key={item.label} className="bg-slate-50 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{translateRuntimeText(item.label, locale)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{translateRuntimeText(item.value, locale)}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200" />
      <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {firstRowMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
      <div className="border-t border-slate-200" />
      <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {secondRowMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}
