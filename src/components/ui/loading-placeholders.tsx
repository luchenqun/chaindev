import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewCardsSkeleton({
  cards = 3,
  entries = 2,
}: {
  cards?: number;
  entries?: number;
}) {
  return (
    <main className="section-block">
      <div className="page-header">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-52" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <section className="card-grid">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="content-panel space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </section>
      <section className="entry-grid">
        {Array.from({ length: entries }).map((_, index) => (
          <div key={index} className="content-panel space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </section>
    </main>
  );
}

export function MetricCardsSkeleton({
  headerItems = 4,
  metrics = 8,
}: {
  headerItems?: number;
  metrics?: number;
}) {
  const firstRowMetrics = Math.min(4, metrics);
  const secondRowMetrics = Math.max(0, metrics - firstRowMetrics);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {Array.from({ length: headerItems }).map((_, index) => (
          <div key={index} className="bg-slate-50 px-5 py-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200" />
      <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {Array.from({ length: firstRowMetrics }).map((_, index) => (
          <div key={index} className="px-5 py-4">
            <Skeleton className="mb-2 h-3.5 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>
      {secondRowMetrics > 0 ? <div className="border-t border-slate-200" /> : null}
      {secondRowMetrics > 0 ? (
        <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {Array.from({ length: secondRowMetrics }).map((_, index) => (
            <div key={index} className="px-5 py-4">
              <Skeleton className="mb-2 h-3.5 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeActivitySkeleton() {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid border-t border-slate-200 pt-1">
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className={`grid grid-cols-[auto_130px_minmax(0,1fr)_auto] items-center gap-4 py-4 ${
                  rowIndex ? "border-t border-slate-200" : ""
                }`}
              >
                <Skeleton className="size-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid border-t border-slate-200 pt-1">
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className={`grid grid-cols-[auto_160px_minmax(0,1fr)_auto] items-center gap-3 py-4 ${
                  rowIndex ? "border-t border-slate-200" : ""
                }`}
              >
                <Skeleton className="size-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function PendingTransactionsSkeleton() {
  return (
    <main className="section-block">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <Skeleton className="h-8 w-52" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-7 w-60" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {Array.from({ length: 8 }).map((_, index) => (
                  <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200">
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-5 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export function ListPageSkeleton({
  titleWidth = "w-28",
  metricCards = 0,
  rows = 8,
  columns = 8,
  showToolbar = true,
}: {
  titleWidth?: string;
  metricCards?: number;
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
}) {
  return (
    <main className="section-block">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <Skeleton className={`h-8 ${titleWidth}`} />
      </div>
      {metricCards > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: metricCards }).map((_, index) => (
            <article key={index} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-3 h-9 w-36" />
              <Skeleton className="mt-3 h-4 w-28" />
            </article>
          ))}
        </section>
      ) : null}
      <section className={`${metricCards > 0 ? "mt-4 " : ""}overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]`}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-7 w-60" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
          {showToolbar ? (
            <div className="flex items-center gap-2 lg:justify-end">
              <Skeleton className="h-8 w-56 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {Array.from({ length: columns }).map((_, index) => (
                  <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200">
                  {Array.from({ length: columns }).map((_, columnIndex) => (
                    <td key={columnIndex} className="px-5 py-3">
                      <Skeleton className={`h-4 ${columnIndex === 0 ? "w-32" : columnIndex === columns - 1 ? "w-20" : "w-24"}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export function DetailPageSkeleton({
  titleWidth = "w-28",
  showTabs = true,
  groups = 3,
  rowsPerGroup = 4,
  secondaryCard = true,
}: {
  titleWidth?: string;
  showTabs?: boolean;
  groups?: number;
  rowsPerGroup?: number;
  secondaryCard?: boolean;
}) {
  return (
    <main className="section-block">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className={`h-8 ${titleWidth}`} />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>

      {showTabs ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="p-5">
          {Array.from({ length: groups }).map((_, groupIndex) => (
            <div
              key={groupIndex}
              className={groupIndex ? "border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0" : "pb-2.5 last:pb-0"}
            >
              {Array.from({ length: rowsPerGroup }).map((__, rowIndex) => (
                <div key={rowIndex} className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {secondaryCard ? (
        <section className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="p-5">
            <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export function SimpleDetailSkeleton() {
  return (
    <main className="content-grid">
      <section className="content-panel space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-full" />
      </section>
      <section className="detail-card">
        <dl className="detail-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <dt><Skeleton className="h-4 w-20" /></dt>
              <dd><Skeleton className="h-4 w-56" /></dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
