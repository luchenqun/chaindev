'use client';

import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';

type HeaderItem = {
  label: string;
  value: string;
};

type Metric = {
  label: string;
  value: string;
  subtext?: string;
};

const fallbackHeader: HeaderItem[] = [
  { label: 'Connection', value: 'Unavailable' },
  { label: 'Provider Name', value: 'Unavailable' },
  { label: 'Chain ID', value: 'Unavailable' },
  { label: 'Latest Block Time', value: 'Unavailable' },
];

function CosmosHomeMetricsSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`header-${index}`} className="bg-slate-50 px-5 py-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>

      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`}>
          <div className="border-t border-slate-200" />
          <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            {Array.from({ length: 4 }).map((__, columnIndex) => (
              <div key={`row-${rowIndex}-col-${columnIndex}`} className="px-5 py-4">
                <Skeleton className="mb-2 h-3.5 w-24" />
                <Skeleton className={`h-8 ${rowIndex === 2 && columnIndex >= 2 ? 'w-44' : 'w-32'}`} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t border-slate-200" />
      <div className="bg-slate-50 px-5 py-2">
        <Skeleton className="h-4 w-80" />
      </div>
    </section>
  );
}

function MetricCard({ label, value, subtext }: Metric) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{value}</p>
      {subtext ? <p className="mt-2 text-xs leading-5 text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export function CosmosHomeMetrics() {
  const { snapshot, errorMessage, connectionMode, autoRefreshEnabled, setAutoRefreshEnabled } = useCosmosHomeData();

  if (!snapshot && !errorMessage) {
    return <CosmosHomeMetricsSkeleton />;
  }

  const headerItems = snapshot
    ? [
        { label: 'Connection', value: snapshot.header.connection },
        { label: 'Provider Name', value: snapshot.header.providerName },
        { label: 'Chain ID', value: snapshot.header.chainId },
        { label: 'Latest Block Time', value: snapshot.header.latestBlockTime },
      ]
    : fallbackHeader;
  const metrics = snapshot?.metrics ?? [];
  const firstRow = metrics.slice(0, 4);
  const secondRow = metrics.slice(4, 8);
  const thirdRow = metrics.slice(8);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {headerItems.map((item) => (
          <div key={item.label} className="bg-slate-50 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
      {metrics.length ? <div className="border-t border-slate-200" /> : null}
      {firstRow.length ? (
        <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {firstRow.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      ) : null}
      {secondRow.length ? <div className="border-t border-slate-200" /> : null}
      {secondRow.length ? (
        <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {secondRow.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      ) : null}
      {thirdRow.length ? <div className="border-t border-slate-200" /> : null}
      {thirdRow.length ? (
        <div className={`grid divide-y divide-slate-200 ${thirdRow.length >= 4 ? 'lg:grid-cols-4 lg:divide-x lg:divide-y-0' : 'lg:grid-cols-2 lg:divide-x lg:divide-y-0'}`}>
          {thirdRow.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      ) : null}
      {errorMessage ? <div className="border-t border-slate-200 bg-rose-50 px-5 py-3 text-sm text-rose-600">{errorMessage}</div> : null}
      {snapshot ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2 text-xs text-slate-500">
          <span>
            {connectionMode === 'ws'
              ? `Live updates via WebSocket. ${autoRefreshEnabled ? 'HTTP snapshot refresh is enabled.' : 'HTTP snapshot refresh is disabled by default.'}`
              : 'Auto refresh via HTTP polling.'}
          </span>
          <ActionIconButton
            tooltip={autoRefreshEnabled ? 'Disable auto refresh' : 'Enable auto refresh'}
            aria-pressed={autoRefreshEnabled}
            className={autoRefreshEnabled ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}
            onClick={() => setAutoRefreshEnabled((current) => !current)}
          >
            {autoRefreshEnabled ? <IconPlayerPause className="size-4" stroke={1.8} /> : <IconPlayerPlay className="size-4" stroke={1.8} />}
          </ActionIconButton>
        </div>
      ) : null}
    </section>
  );
}
