'use client';

import type { ReactNode } from 'react';

export function formatTimestampWithSeconds(value: string | null | undefined, fallback = '-') {
  if (!value) {
    return fallback;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

export function CosmosDetailRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={mono ? 'self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono' : 'self-start text-sm text-slate-900'}>{value}</dd>
    </div>
  );
}

export function CosmosDetailGroup({ children, separated = false, plain = false }: { children: ReactNode; separated?: boolean; plain?: boolean }) {
  if (plain) {
    return <div className="pb-2.5 last:pb-0">{children}</div>;
  }

  return <div className={separated ? 'border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0' : 'border-t border-slate-200 py-2.5 first:border-t-0'}>{children}</div>;
}

export function CosmosDetailTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const className =
    tone === 'success'
      ? 'inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
      : tone === 'danger'
        ? 'inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700'
        : tone === 'warning'
          ? 'inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'
          : 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600';

  return <span className={className}>{children}</span>;
}
