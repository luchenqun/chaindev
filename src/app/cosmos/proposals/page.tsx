'use client';

import { IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getCosmosProposalsDirect } from '@/domains/cosmos/client/queries';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { formatTimestampWithSeconds } from '@/domains/cosmos/ui/detail-primitives';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 15;

function StatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === 'PROPOSAL_STATUS_PASSED'
      ? 'inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
      : status === 'PROPOSAL_STATUS_REJECTED' || status === 'PROPOSAL_STATUS_FAILED'
        ? 'inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700'
        : status === 'PROPOSAL_STATUS_VOTING_PERIOD'
          ? 'inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'
          : 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600';

  return <span className={className}>{label}</span>;
}

function CosmosProposalsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<ReturnType<typeof getCosmosProposalsDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosProposalsDirect(currentPage, PAGE_SIZE);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load proposals.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
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
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [currentPage, pathname, refreshVersion, router, searchParamsText]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-24" rows={8} columns={8} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load proposals</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Proposals</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">{data.totalLabel}</p>
                <p className="mt-1 text-sm text-slate-500">Showing governance proposals returned by the active Cosmos REST provider.</p>
              </div>
              <div className="flex items-center gap-0 lg:justify-end">
                <PaginationControls
                  page={data.page}
                  totalPages={data.totalPages}
                  hasPreviousPage={data.hasPreviousPage}
                  hasNextPage={data.hasNextPage}
                  disabled={loading}
                  plain
                  onPageChange={handlePageChange}
                />
                <button
                  type="button"
                  aria-label="Refresh proposals"
                  className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                  onClick={() => setRefreshVersion((current) => current + 1)}
                >
                  <IconRefresh className="size-4" stroke={1.8} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-full max-w-[360px] border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Proposal</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Submit Time</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Deposit End</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Vote Start</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Vote End</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Tally</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.proposals.length ? (
                  data.proposals.map((proposal) => (
                    <tr key={proposal.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50/70" onClick={() => router.push(`/cosmos/proposals/${proposal.id}`)}>
                      <td className="w-full max-w-[360px] px-4 py-3 text-sm" title={`#${proposal.id}. ${proposal.title}`}>
                        <Link prefetch={false} className="inline-block max-w-[360px] truncate align-middle font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/proposals/${proposal.id}`}>
                          {`#${proposal.id}. ${proposal.title}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{proposal.typeLabel}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatTimestampWithSeconds(proposal.submitTime)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatTimestampWithSeconds(proposal.depositEndTime)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatTimestampWithSeconds(proposal.votingStartTime)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">{formatTimestampWithSeconds(proposal.votingEndTime)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700" title={proposal.tallyLabel}>
                        <div className="min-w-[280px] truncate">{proposal.tallyLabel}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={proposal.status} label={proposal.statusLabel} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      No proposals were returned by the current provider.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export default function CosmosProposalsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-24" rows={8} columns={8} />
        </AppShell>
      }
    >
      <CosmosProposalsPageContent />
    </Suspense>
  );
}
