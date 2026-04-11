"use client";

import { MetricCardsSkeleton } from "@/components/ui/loading-placeholders";
import { useEvmHomeData } from "@/domains/evm/ui/home-data-provider";

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
  { label: "Latest Block", value: "Unavailable" },
  { label: "Latest Block Time", value: "Unavailable" },
  { label: "Average Block Time", value: "Unavailable" },
  { label: "Gas Price", value: "Unavailable" },
  { label: "Pending Tx Count", value: "Unavailable" },
  { label: "Recent Tx Count", value: "Unavailable" },
  { label: "Cached Transactions", value: "Unavailable" },
  { label: "Observed Accounts", value: "Unavailable" },
];

const fallbackHeader: HeaderItem[] = [
  { label: "Connection", value: "Direct JSON-RPC" },
  { label: "Provider Name", value: "Unavailable" },
  { label: "Native Currency", value: "Unavailable" },
  { label: "Chain ID", value: "Unavailable" },
];

function MetricCard({ label, value, subtext }: Metric) {
  return (
    <div className="px-5 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={subtext ? "mb-1 text-2xl font-semibold text-slate-900" : "text-2xl font-semibold text-slate-900"}>
        {value}
      </p>
      {subtext ? <p className="text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export function EvmHomeMetrics() {
  const { snapshot, errorMessage } = useEvmHomeData();
  const metrics = (snapshot?.metrics as Metric[] | undefined) ?? fallbackMetrics;
  const firstRowMetrics = metrics.slice(0, 4);
  const secondRowMetrics = metrics.slice(4, 8);
  const headerItems = snapshot
    ? [
        { label: "Connection", value: snapshot.header.connection },
        { label: "Provider Name", value: snapshot.header.providerName },
        { label: "Native Currency", value: snapshot.header.nativeCurrency },
        { label: "Chain ID", value: snapshot.header.chainId },
      ]
    : fallbackHeader;

  if (!snapshot && !errorMessage) {
      return <MetricCardsSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {headerItems.map((item) => (
          <div key={item.label} className="bg-slate-50 px-5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
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
