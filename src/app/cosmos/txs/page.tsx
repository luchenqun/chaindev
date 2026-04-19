'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getCosmosTransactionsPageDirect } from '@/domains/cosmos/client/queries';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 20;

type CosmosTransactionSearchFormState = {
  hash: string;
  sender: string;
  recipient: string;
  moduleName: string;
  action: string;
  startBlock: string;
  endBlock: string;
};

type AppliedCosmosTransactionSearchFilters = {
  hasFilters: boolean;
  hash: string | null;
  sender: string | null;
  recipient: string | null;
  moduleName: string | null;
  action: string | null;
  startBlockNumber: number | null;
  endBlockNumber: number | null;
};

const EMPTY_COSMOS_TRANSACTION_SEARCH_FORM: CosmosTransactionSearchFormState = {
  hash: '',
  sender: '',
  recipient: '',
  moduleName: '',
  action: '',
  startBlock: '',
  endBlock: '',
};

const EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH: AppliedCosmosTransactionSearchFilters =
  {
    hasFilters: false,
    hash: null,
    sender: null,
    recipient: null,
    moduleName: null,
    action: null,
    startBlockNumber: null,
    endBlockNumber: null,
  };

function containsQueryQuote(value: string) {
  return /['"]/.test(value);
}

function isLikelyCosmosTxHash(value: string) {
  return /^[A-Fa-f0-9]{64}$/.test(value);
}

function describeActiveFilters(filters: AppliedCosmosTransactionSearchFilters) {
  return [
    filters.hash ? `hash ${filters.hash}` : null,
    filters.sender ? `sender ${filters.sender}` : null,
    filters.recipient ? `recipient ${filters.recipient}` : null,
    filters.moduleName ? `module ${filters.moduleName}` : null,
    filters.action ? `action ${filters.action}` : null,
    filters.startBlockNumber != null || filters.endBlockNumber != null
      ? 'block range'
      : null,
  ].filter(Boolean);
}

function buildCosmosTransactionsSearchQuery(
  filters: AppliedCosmosTransactionSearchFilters,
) {
  const clauses: string[] = [];

  if (filters.hash) {
    clauses.push(`tx.hash='${filters.hash}'`);
  } else {
    clauses.push('tx.height > 0');
  }

  if (filters.sender) {
    clauses.push(`message.sender='${filters.sender}'`);
  }

  if (filters.recipient) {
    clauses.push(`transfer.recipient='${filters.recipient}'`);
  }

  if (filters.moduleName) {
    clauses.push(`message.module='${filters.moduleName}'`);
  }

  if (filters.action) {
    clauses.push(`message.action='${filters.action}'`);
  }

  if (filters.startBlockNumber != null) {
    clauses.push(`tx.height >= ${filters.startBlockNumber}`);
  }

  if (filters.endBlockNumber != null) {
    clauses.push(`tx.height <= ${filters.endBlockNumber}`);
  }

  return clauses.join(' AND ');
}

function parseCosmosTransactionSearchForm(
  form: CosmosTransactionSearchFormState,
): {
  error: string | null;
  filters: AppliedCosmosTransactionSearchFilters;
} {
  const hash = form.hash.trim().toUpperCase();
  const sender = form.sender.trim();
  const recipient = form.recipient.trim();
  const moduleName = form.moduleName.trim();
  const action = form.action.trim();
  const hasFilters = Object.values(form).some((value) => value.trim() !== '');

  if (!hasFilters) {
    return {
      error: null,
      filters: EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    };
  }

  if (hash && !isLikelyCosmosTxHash(hash)) {
    return {
      error: 'Transaction hash must be a 64-character hex string.',
      filters: EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    };
  }

  if (
    [sender, recipient, moduleName, action].some((value) =>
      containsQueryQuote(value),
    )
  ) {
    return {
      error: 'Filter values must not contain quotation marks.',
      filters: EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    };
  }

  const startBlockNumber = form.startBlock.trim()
    ? Number.parseInt(form.startBlock.trim(), 10)
    : null;
  const endBlockNumber = form.endBlock.trim()
    ? Number.parseInt(form.endBlock.trim(), 10)
    : null;

  if (
    (form.startBlock.trim() && !/^\d+$/.test(form.startBlock.trim())) ||
    (form.endBlock.trim() && !/^\d+$/.test(form.endBlock.trim())) ||
    (startBlockNumber != null && startBlockNumber < 0) ||
    (endBlockNumber != null && endBlockNumber < 0)
  ) {
    return {
      error: 'Block range must use non-negative integers.',
      filters: EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    };
  }

  if (
    startBlockNumber != null &&
    endBlockNumber != null &&
    startBlockNumber > endBlockNumber
  ) {
    return {
      error: 'Start block must not be greater than end block.',
      filters: EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    };
  }

  return {
    error: null,
    filters: {
      hasFilters: true,
      hash: hash || null,
      sender: sender || null,
      recipient: recipient || null,
      moduleName: moduleName || null,
      action: action || null,
      startBlockNumber,
      endBlockNumber,
    },
  };
}

function CosmosTransactionsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const { latestFeed } = useCosmosHomeData();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getCosmosTransactionsPageDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState<CosmosTransactionSearchFormState>(
    EMPTY_COSMOS_TRANSACTION_SEARCH_FORM,
  );
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(
    null,
  );
  const [activeSearchFilters, setActiveSearchFilters] =
    useState<AppliedCosmosTransactionSearchFilters>(
      EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH,
    );
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasLoadedDataRef = useRef(false);
  const currentQuery = useMemo(
    () => buildCosmosTransactionsSearchQuery(activeSearchFilters),
    [activeSearchFilters],
  );
  const activeFilterDescriptions = useMemo(
    () => describeActiveFilters(activeSearchFilters),
    [activeSearchFilters],
  );
  const liveBlockKey =
    autoRefreshEnabled &&
    !activeSearchFilters.hasFilters &&
    currentPage === 1
      ? latestFeed?.latestBlock ?? ''
      : '';

  function handlePageChange(page: number) {
    router.push(
      buildPageHref(pathname, new URLSearchParams(searchParamsText), page),
    );
  }

  function handleSearchInputChange<
    Key extends keyof CosmosTransactionSearchFormState,
  >(key: Key, value: CosmosTransactionSearchFormState[Key]) {
    setSearchErrorMessage(null);
    setSearchForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleApplySearch() {
    const next = parseCosmosTransactionSearchForm(searchForm);
    setSearchErrorMessage(next.error);

    if (next.error) {
      return;
    }

    setActiveSearchFilters(next.filters);
    setSearchDialogOpen(false);

    if (currentPage !== 1) {
      router.push(
        buildPageHref(pathname, new URLSearchParams(searchParamsText), 1),
      );
    }
  }

  function handleClearSearch() {
    setSearchForm(EMPTY_COSMOS_TRANSACTION_SEARCH_FORM);
    setSearchErrorMessage(null);
    setActiveSearchFilters(EMPTY_APPLIED_COSMOS_TRANSACTION_SEARCH);

    if (currentPage !== 1) {
      router.push(
        buildPageHref(pathname, new URLSearchParams(searchParamsText), 1),
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(showSkeleton = false) {
      if (showSkeleton || !hasLoadedDataRef.current) {
        setLoading(true);
      }

      try {
        const next = await getCosmosTransactionsPageDirect({
          requestedPage: currentPage,
          pageSize: PAGE_SIZE,
          query: currentQuery,
        });

        if (!cancelled) {
          setData(next);
          hasLoadedDataRef.current = true;
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
          hasLoadedDataRef.current = false;
          setData(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load Cosmos transactions.',
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
      void load(true);
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
  }, [
    currentPage,
    currentQuery,
    liveBlockKey,
    pathname,
    router,
    searchParamsText,
  ]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-28" rows={8} columns={9} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Transactions are unavailable</h1>
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
            Transactions
          </h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {data.totalTransactions
                  ? `${data.totalTransactions.toLocaleString('en-US')} matching transactions`
                  : activeSearchFilters.hasFilters
                    ? 'No transactions matched'
                    : 'No transactions returned'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {activeFilterDescriptions.length
                  ? `Searching direct Cosmos RPC transactions by ${activeFilterDescriptions.join(', ')}.`
                  : 'Querying the selected Cosmos RPC provider directly.'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Page {data.page} of {data.totalPages}.
              </p>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
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
                aria-label={
                  activeSearchFilters.hasFilters
                    ? 'Edit transaction filters'
                    : 'Search transactions'
                }
                aria-pressed={activeSearchFilters.hasFilters}
                title={
                  activeSearchFilters.hasFilters
                    ? 'Transaction filters active'
                    : 'Search transactions'
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                  activeSearchFilters.hasFilters
                    ? 'border-sky-200 bg-sky-50 text-sky-600'
                    : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                }`}
                onClick={() => setSearchDialogOpen(true)}
              >
                <IconSearch className="size-4" stroke={1.8} />
              </button>
              <button
                type="button"
                aria-label={
                  autoRefreshEnabled
                    ? 'Disable auto refresh'
                    : 'Enable auto refresh'
                }
                aria-pressed={autoRefreshEnabled}
                title={
                  activeSearchFilters.hasFilters
                    ? 'Auto refresh is unavailable while transaction filters are active.'
                    : autoRefreshEnabled
                      ? 'Auto refresh enabled'
                      : 'Auto refresh disabled'
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                  autoRefreshEnabled
                    ? 'border-sky-200 bg-sky-50 text-sky-600'
                    : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                } ${activeSearchFilters.hasFilters ? 'cursor-not-allowed opacity-40' : ''}`}
                disabled={activeSearchFilters.hasFilters}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Transaction Hash
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Type
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Block
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Age
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    From
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Gas Used / Wanted
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Fee
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.length ? (
                  data.transactions.map((transaction) => (
                    <tr
                      key={transaction.hash}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/tx/${transaction.hash}`}
                        >
                          {transaction.hashLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/block/${transaction.height}`}
                        >
                          {transaction.height}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={transaction.timestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.sender !== 'Unknown' ? (
                          <Link
                            className="font-medium text-sky-600 hover:text-sky-700"
                            href={`/cosmos/account/${transaction.sender}`}
                          >
                            {transaction.senderLabel}
                          </Link>
                        ) : (
                          <span className="text-slate-500">Unknown</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.gasUsedLabel}/{transaction.gasWantedLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {transaction.feeLabel}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            transaction.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {transaction.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      {activeSearchFilters.hasFilters
                        ? 'No transactions matched the current filters.'
                        : 'No transactions returned by the selected Cosmos RPC provider.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <ModalDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        title="Search Transactions"
        description="Filter direct Cosmos RPC transactions by hash, address, module, action, or block range."
        maxWidthClassName="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              onClick={handleClearSearch}
            >
              Clear
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              onClick={() => setSearchDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={handleApplySearch}
            >
              Search
            </button>
          </>
        }
      >
        <div className="grid gap-3 pb-1 md:grid-cols-2">
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Transaction Hash
            </span>
            <input
              value={searchForm.hash}
              onChange={(event) =>
                handleSearchInputChange('hash', event.target.value)
              }
              placeholder="B7D332964F6A101E3511ED197FE240268E34A7F8141C937F8B7B658ED11EE8A1"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sender
            </span>
            <input
              value={searchForm.sender}
              onChange={(event) =>
                handleSearchInputChange('sender', event.target.value)
              }
              placeholder="quarix1..."
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recipient
            </span>
            <input
              value={searchForm.recipient}
              onChange={(event) =>
                handleSearchInputChange('recipient', event.target.value)
              }
              placeholder="quarix1..."
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Module
            </span>
            <input
              value={searchForm.moduleName}
              onChange={(event) =>
                handleSearchInputChange('moduleName', event.target.value)
              }
              placeholder="bank"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Action
            </span>
            <input
              value={searchForm.action}
              onChange={(event) =>
                handleSearchInputChange('action', event.target.value)
              }
              placeholder="/cosmos.bank.v1beta1.MsgSend"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Start Block
            </span>
            <input
              value={searchForm.startBlock}
              onChange={(event) =>
                handleSearchInputChange('startBlock', event.target.value)
              }
              placeholder="0"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              End Block
            </span>
            <input
              value={searchForm.endBlock}
              onChange={(event) =>
                handleSearchInputChange('endBlock', event.target.value)
              }
              placeholder="0"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
        </div>
        {searchErrorMessage ? (
          <p className="mt-4 text-sm text-rose-600">{searchErrorMessage}</p>
        ) : null}
      </ModalDialog>
    </AppShell>
  );
}

export default function CosmosTransactionsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-28" rows={8} columns={9} />
        </AppShell>
      }
    >
      <CosmosTransactionsPageContent />
    </Suspense>
  );
}
