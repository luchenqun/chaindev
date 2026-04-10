"use client";

import { MetricCardsSkeleton } from "@/components/ui/loading-placeholders";
import { useEvmHomeData } from "@/domains/evm/ui/home-data-provider";

type Metric = {
  label: string;
  value: string;
  subtext?: string;
};

const fallbackMetrics: Metric[] = [
  { label: "Latest Block", value: "Unavailable" },
  { label: "Latest Block Time", value: "Unavailable" },
  { label: "Gas Price", value: "Unavailable" },
  { label: "Chain ID", value: "Unavailable" },
];

function MetricCard({ label, value, subtext }: Metric) {
  return (
    <div className="border-r border-slate-200 px-5 py-4 last:border-r-0 max-lg:border-r-0 max-lg:border-b max-lg:last:border-b-0">
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

  if (!snapshot && !errorMessage) {
    return <MetricCardsSkeleton />;
  }

  return (
    <div className="grid lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}
