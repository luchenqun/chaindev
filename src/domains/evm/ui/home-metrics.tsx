'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { MetricCardsSkeleton } from '@/components/ui/loading-placeholders';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';

type Metric = {
  label: string;
  value: string;
  subtext?: string;
};

type HeaderItem = {
  label: string;
  value: string;
};

const fallbackMetrics: Metric[] = [
  { label: 'Latest Block', value: 'Unavailable' },
  { label: 'Latest Block Time', value: 'Unavailable' },
  { label: 'Average Block Time', value: 'Unavailable' },
  { label: 'Gas Price', value: 'Unavailable' },
  { label: 'Pending Tx Count', value: 'Unavailable' },
  { label: 'Recent Tx Count', value: 'Unavailable' },
  { label: 'Cached Transactions', value: 'Unavailable' },
  { label: 'Observed Accounts', value: 'Unavailable' },
];

const fallbackHeader: HeaderItem[] = [
  { label: 'Connection', value: 'Direct JSON-RPC' },
  { label: 'Provider Name', value: 'Unavailable' },
  { label: 'Native Currency', value: 'Unavailable' },
  { label: 'Chain ID', value: 'Unavailable' },
];

function MetricCard({ label, value, subtext }: Metric) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        {subtext ? (
          <span className="group relative inline-flex">
            <span className="inline-flex items-center justify-center text-slate-300">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[220px] -translate-x-1/2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {subtext}
            </span>
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function EvmHomeMetrics() {
  const { snapshot, errorMessage } = useEvmHomeData();
  const metrics =
    (snapshot?.metrics as Metric[] | undefined) ?? fallbackMetrics;
  const firstRowMetrics = metrics.slice(0, 4);
  const secondRowMetrics = metrics.slice(4, 8);
  const headerItems = snapshot
    ? [
        { label: 'Connection', value: snapshot.header.connection },
        { label: 'Provider Name', value: snapshot.header.providerName },
        { label: 'Native Currency', value: snapshot.header.nativeCurrency },
        { label: 'Chain ID', value: snapshot.header.chainId },
      ]
    : fallbackHeader;

  if (!snapshot && !errorMessage) {
    return <MetricCardsSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {headerItems.map((item) => (
          <div key={item.label} className="bg-slate-50 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {item.value}
            </p>
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
