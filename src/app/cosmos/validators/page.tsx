'use client';

import { IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getCosmosValidatorsDirect } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 50;

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildPageHref(
  pathname: string,
  searchParams: URLSearchParams,
  page: number,
) {
  const params = new URLSearchParams(searchParams.toString());

  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function CosmosValidatorsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getCosmosValidatorsDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  function handlePageChange(page: number) {
    router.push(
      buildPageHref(pathname, new URLSearchParams(searchParamsText), page),
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosValidatorsDirect(currentPage, PAGE_SIZE);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(
              buildPageHref(
                pathname,
                new URLSearchParams(searchParamsText),
                next.page,
              ),
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load validators.',
          );
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

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, [currentPage, pathname, refreshVersion, router, searchParamsText]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton
          titleWidth="w-28"
          metricCards={4}
          rows={8}
          columns={8}
        />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Validators are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">
            Validators
          </h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {data.totalLabel}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Showing bonded, unbonding, and unbonded validators returned by
                  the active Cosmos REST provider.
                </p>
              </div>
              <div className="flex items-center gap-0 lg:justify-end">
                <PaginationControls
                  page={data.page}
                  totalPages={data.totalPages}
                  hasPreviousPage={data.hasPreviousPage}
                  hasNextPage={data.hasNextPage}
                  disabled={loading}
                  onPageChange={handlePageChange}
                />
                <button
                  type="button"
                  aria-label="Refresh validators"
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
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Name
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Power
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Tokens
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Delegator Shares
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Commission
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Operator
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Jailed
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.validators.length ? (
                  data.validators.map((validator) => (
                    <tr
                      key={validator.operatorAddress}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <Link
                            className="block truncate font-medium text-sky-600 hover:text-sky-700"
                            href={`/cosmos/validator/${validator.operatorAddress}`}
                          >
                            {validator.moniker}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900 tabular-nums">
                        {validator.votingPowerPercentLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">
                        {validator.tokensLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">
                        {validator.delegatorSharesLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">
                        {validator.commissionRateLabel}
                      </td>
                      <td
                        className="px-5 py-3 text-sm text-slate-700 mono"
                        title={validator.operatorAddress}
                      >
                        {validator.operatorAddressLabel}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            validator.jailed
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {validator.jailedLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            validator.status === 'BOND_STATUS_BONDED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : validator.status === 'BOND_STATUS_UNBONDING'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {validator.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No validators were returned by the current provider.
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

export default function CosmosValidatorsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton
            titleWidth="w-28"
            metricCards={4}
            rows={8}
            columns={8}
          />
        </AppShell>
      }
    >
      <CosmosValidatorsPageContent />
    </Suspense>
  );
}
