'use client';

import { fromBech32, toHex } from '@cosmjs/encoding';
import { IconAdjustmentsHorizontal, IconArrowsExchange, IconCode, IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getCosmosAccountsPageDirect } from '@/domains/cosmos/client/queries';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 20;

function formatCompactValue(value: string, start = 14, end = 10) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatAccountAddressForDisplay(address: string, mode: 'bech32' | 'hex') {
  if (mode === 'bech32') {
    return {
      full: address,
      label: formatCompactValue(address, 14, 10),
    };
  }

  try {
    const { data } = fromBech32(address);
    const hexAddress = `0x${toHex(data)}`;

    return {
      full: hexAddress,
      label: hexAddress,
    };
  } catch {
    return {
      full: address,
      label: formatCompactValue(address, 14, 10),
    };
  }
}

function CosmosAccountsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<ReturnType<typeof getCosmosAccountsPageDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [balanceDisplayMode, setBalanceDisplayMode] = useState<'readable' | 'accurate'>('readable');
  const [addressDisplayMode, setAddressDisplayMode] = useState<'bech32' | 'hex'>('bech32');

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosAccountsPageDirect(currentPage, PAGE_SIZE);

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
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos accounts.');
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
        <ListPageSkeleton titleWidth="w-24" metricCards={0} rows={8} columns={4} toolbarIcons={3} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Accounts are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Accounts</h1>
        </div>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">{data.totalLabel}</p>
                <p className="mt-1 text-sm text-slate-500">Browse accounts returned directly by the active Cosmos REST provider.</p>
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
                <ActionIconButton
                  tooltip={balanceDisplayMode === 'readable' ? 'Switch to accurate balances' : 'Switch to readable balances'}
                  tooltipPlacement="bottom"
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={() => setBalanceDisplayMode((current) => (current === 'readable' ? 'accurate' : 'readable'))}
                >
                  {balanceDisplayMode === 'readable' ? <IconAdjustmentsHorizontal className="size-4" stroke={1.8} /> : <IconCode className="size-4" stroke={1.8} />}
                </ActionIconButton>
                <ActionIconButton
                  tooltip={addressDisplayMode === 'bech32' ? 'Switch to hex addresses' : 'Switch to bech32 addresses'}
                  tooltipPlacement="bottom"
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={() => setAddressDisplayMode((current) => (current === 'bech32' ? 'hex' : 'bech32'))}
                >
                  <IconArrowsExchange className="size-4" stroke={1.8} />
                </ActionIconButton>
                <ActionIconButton
                  tooltip="Refresh accounts"
                  tooltipPlacement="bottom"
                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  onClick={() => setRefreshVersion((current) => current + 1)}
                >
                  <IconRefresh className="size-4" stroke={1.8} />
                </ActionIconButton>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Address</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Balances</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Seq</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.length ? (
                  data.accounts.map((account) => {
                    const displayAddress = formatAccountAddressForDisplay(account.address, addressDisplayMode);

                    return (
                      <tr key={account.address} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm" title={displayAddress.full}>
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${account.address}`}>
                            {displayAddress.label}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">{balanceDisplayMode === 'readable' ? account.readableBalancesLabel : account.balancesLabel}</td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{account.sequenceLabel}</td>
                        <td className="px-5 py-3 text-sm text-slate-700">{account.type}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                      No accounts were returned by the current provider.
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

export default function CosmosAccountsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-24" metricCards={0} rows={8} columns={4} toolbarIcons={3} />
        </AppShell>
      }
    >
      <CosmosAccountsPageContent />
    </Suspense>
  );
}
