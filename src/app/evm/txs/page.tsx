'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { isAddress, parseEther } from 'viem';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { RelativeTime } from '@/components/relative-time';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from '@/domains/evm/client/address-tags';
import { resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { subscribeEvmContractRegistry } from '@/domains/evm/client/contract-registry';
import {
  getEvmCachedTransactionsPage,
  getEvmTransactionCacheSummary,
  searchEvmCachedTransactions,
} from '@/domains/evm/client/transaction-cache';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { syncLatestEvmTransactionsDirect } from '@/domains/evm/client/queries';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import {
  TransactionHashCell,
  TransactionPreviewButton,
} from '@/domains/evm/ui/transaction-list-cells';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 20;

type TransactionsPageData = {
  page: number;
  pageSize: number;
  totalTransactions: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  latestBlockNumber: string;
  oldestBlockNumber: string;
  title: string;
  subtitle: string;
  transactions: Awaited<
    ReturnType<typeof getEvmCachedTransactionsPage>
  >['transactions'];
};

type TransactionSearchFormState = {
  from: string;
  to: string;
  method: string;
  status: 'any' | 'success' | 'reverted';
  startTime: string;
  endTime: string;
  startBlock: string;
  endBlock: string;
  minAmount: string;
  maxAmount: string;
};

type AppliedTransactionSearchFilters = {
  hasFilters: boolean;
  fromAddress: string | null;
  toAddress: string | null;
  methodQuery: string | null;
  receiptStatus: 'success' | 'reverted' | null;
  startTimeMs: number | null;
  endTimeMs: number | null;
  startBlockNumber: number | null;
  endBlockNumber: number | null;
  minValueWei: bigint | null;
  maxValueWei: bigint | null;
};

const EMPTY_TRANSACTION_SEARCH_FORM: TransactionSearchFormState = {
  from: '',
  to: '',
  method: '',
  status: 'any',
  startTime: '',
  endTime: '',
  startBlock: '',
  endBlock: '',
  minAmount: '',
  maxAmount: '',
};

const EMPTY_APPLIED_TRANSACTION_SEARCH: AppliedTransactionSearchFilters = {
  hasFilters: false,
  fromAddress: null,
  toAddress: null,
  methodQuery: null,
  receiptStatus: null,
  startTimeMs: null,
  endTimeMs: null,
  startBlockNumber: null,
  endBlockNumber: null,
  minValueWei: null,
  maxValueWei: null,
};

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

function buildCachedTransactionsPageData(input: {
  page: Awaited<ReturnType<typeof getEvmCachedTransactionsPage>>;
  latestCachedTransaction: Awaited<
    ReturnType<typeof getEvmTransactionCacheSummary>
  >['latestSeenTransaction'];
}): TransactionsPageData {
  const { page, latestCachedTransaction } = input;
  const latestBlockNumber =
    latestCachedTransaction?.blockNumber ?? 'Unavailable';
  const oldestBlockNumber =
    page.transactions[page.transactions.length - 1]?.blockNumber ??
    latestCachedTransaction?.blockNumber ??
    'Unavailable';

  return {
    ...page,
    latestBlockNumber,
    oldestBlockNumber,
    title: page.totalTransactions
      ? `${page.totalTransactions.toLocaleString('en-US')} cached recent transactions`
      : 'No cached transactions yet',
    subtitle: page.totalTransactions
      ? `Showing cached transactions up to block #${latestBlockNumber}`
      : 'Loading latest on-chain transactions will populate this table.',
    transactions: page.transactions,
  };
}

function buildFilteredTransactionsPageData(input: {
  page: Awaited<ReturnType<typeof searchEvmCachedTransactions>>;
  latestCachedTransaction: Awaited<
    ReturnType<typeof getEvmTransactionCacheSummary>
  >['latestSeenTransaction'];
  filters: AppliedTransactionSearchFilters;
}): TransactionsPageData {
  const { page, latestCachedTransaction, filters } = input;
  const latestBlockNumber =
    latestCachedTransaction?.blockNumber ?? 'Unavailable';
  const oldestBlockNumber =
    page.transactions[page.transactions.length - 1]?.blockNumber ??
    latestCachedTransaction?.blockNumber ??
    'Unavailable';
  const activeParts = [
    filters.fromAddress ? `from ${filters.fromAddress}` : null,
    filters.toAddress ? `to ${filters.toAddress}` : null,
    filters.methodQuery ? `method ${filters.methodQuery}` : null,
    filters.receiptStatus
      ? `status ${filters.receiptStatus === 'reverted' ? 'failed' : filters.receiptStatus}`
      : null,
    filters.startTimeMs != null || filters.endTimeMs != null
      ? 'time range'
      : null,
    filters.startBlockNumber != null || filters.endBlockNumber != null
      ? 'block range'
      : null,
    filters.minValueWei != null || filters.maxValueWei != null
      ? 'amount range'
      : null,
  ].filter(Boolean);

  return {
    ...page,
    latestBlockNumber,
    oldestBlockNumber,
    title: page.totalTransactions
      ? `${page.totalTransactions.toLocaleString('en-US')} cached matching transactions`
      : 'No cached transactions matched',
    subtitle: activeParts.length
      ? `Searching cached transactions by ${activeParts.join(', ')}`
      : 'Searching cached transactions.',
    transactions: page.transactions,
  };
}

function parseTransactionSearchForm(form: TransactionSearchFormState): {
  error: string | null;
  filters: AppliedTransactionSearchFilters;
} {
  const from = form.from.trim();
  const to = form.to.trim();
  const method = form.method.trim().toLowerCase();
  const status = form.status === 'any' ? null : form.status;
  const hasFilters = Object.values(form).some((value) => value.trim() !== '');

  if (!hasFilters) {
    return {
      error: null,
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  if (from && !isAddress(from)) {
    return {
      error: 'From must be a valid EVM address.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  if (to && !isAddress(to)) {
    return {
      error: 'To must be a valid EVM address.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  const startTimeMs = form.startTime
    ? new Date(form.startTime).getTime()
    : null;
  const endTimeMs = form.endTime ? new Date(form.endTime).getTime() : null;

  if (
    (form.startTime && !Number.isFinite(startTimeMs)) ||
    (form.endTime && !Number.isFinite(endTimeMs))
  ) {
    return {
      error: 'Time range is invalid.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  if (startTimeMs != null && endTimeMs != null && startTimeMs > endTimeMs) {
    return {
      error: 'Start time must not be later than end time.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  const startBlockNumber = form.startBlock
    ? Number.parseInt(form.startBlock, 10)
    : null;
  const endBlockNumber = form.endBlock
    ? Number.parseInt(form.endBlock, 10)
    : null;

  if (
    (form.startBlock && !/^\d+$/.test(form.startBlock.trim())) ||
    (form.endBlock && !/^\d+$/.test(form.endBlock.trim())) ||
    (startBlockNumber != null && startBlockNumber < 0) ||
    (endBlockNumber != null && endBlockNumber < 0)
  ) {
    return {
      error: 'Block range must use non-negative integers.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  if (
    startBlockNumber != null &&
    endBlockNumber != null &&
    startBlockNumber > endBlockNumber
  ) {
    return {
      error: 'Start block must not be greater than end block.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }

  try {
    const minValueWei = form.minAmount.trim()
      ? parseEther(form.minAmount.trim())
      : null;
    const maxValueWei = form.maxAmount.trim()
      ? parseEther(form.maxAmount.trim())
      : null;

    if (
      minValueWei != null &&
      maxValueWei != null &&
      minValueWei > maxValueWei
    ) {
      return {
        error: 'Min amount must not be greater than max amount.',
        filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
      };
    }

    return {
      error: null,
      filters: {
        hasFilters: true,
        fromAddress: from || null,
        toAddress: to || null,
        methodQuery: method || null,
        receiptStatus: status,
        startTimeMs,
        endTimeMs,
        startBlockNumber,
        endBlockNumber,
        minValueWei,
        maxValueWei,
      },
    };
  } catch {
    return {
      error: 'Amount range is invalid.',
      filters: EMPTY_APPLIED_TRANSACTION_SEARCH,
    };
  }
}

function TransactionsAutoRefreshBridge(props: {
  enabled: boolean;
  onLatestFeed: (
    latestFeed: NonNullable<ReturnType<typeof useEvmHomeData>['latestFeed']>,
  ) => void;
}) {
  const { latestFeed } = useEvmHomeData();
  const onLatestFeedRef = useRef(props.onLatestFeed);

  useEffect(() => {
    onLatestFeedRef.current = props.onLatestFeed;
  }, [props.onLatestFeed]);

  useEffect(() => {
    if (!props.enabled || !latestFeed) {
      return;
    }

    onLatestFeedRef.current(latestFeed);
  }, [latestFeed, props.enabled]);

  return null;
}

function EvmTransactionsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<TransactionsPageData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState<TransactionSearchFormState>(
    EMPTY_TRANSACTION_SEARCH_FORM,
  );
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(
    null,
  );
  const [activeSearchFilters, setActiveSearchFilters] =
    useState<AppliedTransactionSearchFilters>(EMPTY_APPLIED_TRANSACTION_SEARCH);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<
    Record<string, string | null>
  >({});
  const [decodeVersion, setDecodeVersion] = useState(0);
  const [syncingLatest, setSyncingLatest] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cacheRefreshVersion, setCacheRefreshVersion] = useState(0);
  const hasLoadedDataRef = useRef(false);
  const visibleAddresses = useMemo(
    () => [
      ...new Set(
        data?.transactions.flatMap((transaction) => [
          transaction.from,
          ...(transaction.to ? [transaction.to] : []),
        ]) ?? [],
      ),
    ],
    [data],
  );
  const decodedMethodLabelByHash = useMemo(() => {
    void decodeVersion;

    return Object.fromEntries(
      (data?.transactions ?? []).map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [data, decodeVersion]);

  function handlePageChange(page: number) {
    router.push(
      buildPageHref(pathname, new URLSearchParams(searchParamsText), page),
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function load(showSkeleton = false) {
      if (showSkeleton || !hasLoadedDataRef.current) {
        setLoading(true);
      }

      try {
        const [cachedPage, cacheSummary] = await Promise.all([
          activeSearchFilters.hasFilters
            ? searchEvmCachedTransactions({
                page: currentPage,
                pageSize: PAGE_SIZE,
                fromAddress: activeSearchFilters.fromAddress,
                toAddress: activeSearchFilters.toAddress,
                methodQuery: activeSearchFilters.methodQuery,
                receiptStatus: activeSearchFilters.receiptStatus,
                startTimeMs: activeSearchFilters.startTimeMs,
                endTimeMs: activeSearchFilters.endTimeMs,
                startBlockNumber: activeSearchFilters.startBlockNumber,
                endBlockNumber: activeSearchFilters.endBlockNumber,
                minValueWei: activeSearchFilters.minValueWei,
                maxValueWei: activeSearchFilters.maxValueWei,
              })
            : getEvmCachedTransactionsPage(currentPage, PAGE_SIZE),
          getEvmTransactionCacheSummary(),
        ]);

        if (!cancelled) {
          const next = activeSearchFilters.hasFilters
            ? buildFilteredTransactionsPageData({
                page: cachedPage,
                latestCachedTransaction: cacheSummary.latestSeenTransaction,
                filters: activeSearchFilters,
              })
            : buildCachedTransactionsPageData({
                page: cachedPage,
                latestCachedTransaction: cacheSummary.latestSeenTransaction,
              });

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
              : 'Failed to load transactions.',
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
    activeSearchFilters,
    cacheRefreshVersion,
    currentPage,
    pathname,
    router,
    searchParamsText,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function syncLatest() {
      setSyncingLatest(true);
      setSyncStatusMessage('Loading latest on-chain transactions...');

      try {
        const cacheSummary = await getEvmTransactionCacheSummary();
        const result = await syncLatestEvmTransactionsDirect({
          latestCachedBlockNumber:
            cacheSummary.latestSeenTransaction?.blockNumber ?? null,
        });

        if (cancelled) {
          return;
        }

        if (result.syncedTransactions > 0) {
          setCacheRefreshVersion((current) => current + 1);
          setSyncStatusMessage(null);
          return;
        }

        if (
          result.truncatedByBlockWindow ||
          result.truncatedByTransactionLimit
        ) {
          setSyncStatusMessage('Latest sync reached the temporary scan limit.');
        } else {
          setSyncStatusMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncStatusMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load latest transactions.',
          );
        }
      } finally {
        if (!cancelled) {
          setSyncingLatest(false);
        }
      }
    }

    void syncLatest();

    const handleProfileChanged = () => {
      void syncLatest();
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
  }, []);

  function handleAutoRefreshFeed(
    latestFeed: NonNullable<ReturnType<typeof useEvmHomeData>['latestFeed']>,
  ) {
    if (currentPage !== 1 || activeSearchFilters.hasFilters || !data) {
      return;
    }

    const hasNewTransactions = latestFeed.transactionsPageItems.some(
      (transaction) =>
        !data.transactions.some((item) => item.hash === transaction.hash),
    );

    if (hasNewTransactions) {
      setCacheRefreshVersion((version) => version + 1);
    }
  }

  function handleSearchInputChange<
    Key extends keyof TransactionSearchFormState,
  >(key: Key, value: TransactionSearchFormState[Key]) {
    setSearchErrorMessage(null);
    setSearchForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleApplySearch() {
    const next = parseTransactionSearchForm(searchForm);
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
    setSearchForm(EMPTY_TRANSACTION_SEARCH_FORM);
    setSearchErrorMessage(null);
    setActiveSearchFilters(EMPTY_APPLIED_TRANSACTION_SEARCH);

    if (currentPage !== 1) {
      router.push(
        buildPageHref(pathname, new URLSearchParams(searchParamsText), 1),
      );
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      unsubscribe();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, []);

  useEffect(() => {
    function loadVisibleTags() {
      setNameTagsByAddress(getEvmAddressTags(visibleAddresses));
    }

    loadVisibleTags();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadVisibleTags();
    });

    const handleProfileChanged = () => {
      loadVisibleTags();
    };

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      unsubscribe();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, [visibleAddresses]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-28" rows={8} columns={8} />
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
      {autoRefreshEnabled && !activeSearchFilters.hasFilters ? (
        <TransactionsAutoRefreshBridge
          enabled={currentPage === 1}
          onLatestFeed={handleAutoRefreshFeed}
        />
      ) : null}
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
                {data.title}
              </p>
              <p className="mt-1 text-sm text-slate-500">{data.subtitle}</p>
              {syncingLatest || syncStatusMessage ? (
                <p className="mt-2 text-xs text-sky-600">
                  {syncingLatest
                    ? 'Loading latest on-chain transactions...'
                    : syncStatusMessage}
                </p>
              ) : null}
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
                    ? 'Edit cache search filters'
                    : 'Search cached transactions'
                }
                aria-pressed={activeSearchFilters.hasFilters}
                title={
                  activeSearchFilters.hasFilters
                    ? 'Cache search filters active'
                    : 'Search cached transactions'
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
                    ? 'Auto refresh is unavailable while cache search filters are active.'
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
                    Method
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
                    To
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Amount
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Txn Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.length ? (
                  data.transactions.map((transaction) => {
                    const decodedMethodLabel =
                      decodedMethodLabelByHash[transaction.hash] ??
                      transaction.methodLabel;

                    return (
                      <tr
                        key={transaction.hash}
                        className="border-t border-slate-200"
                      >
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <TransactionPreviewButton
                              transaction={transaction}
                              methodLabel={decodedMethodLabel}
                            />
                            <TransactionHashCell
                              hash={transaction.hash}
                              hashLabel={transaction.hashLabel}
                              receiptStatus={transaction.receiptStatus}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {decodedMethodLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums">
                          <Link
                            className="font-medium text-sky-600 hover:text-sky-700"
                            href={`/evm/block/${transaction.blockNumber}`}
                          >
                            {transaction.blockNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <RelativeTime timestampMs={transaction.timestampMs} />
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <AddressLink
                            address={transaction.from}
                            href={`/evm/address/${transaction.from}`}
                            label={
                              nameTagsByAddress[transaction.from] ??
                              transaction.fromLabel
                            }
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {transaction.to ? (
                            <AddressLink
                              address={transaction.to}
                              href={`/evm/address/${transaction.to}`}
                              label={resolvePreferredToAddressLabel(
                                transaction.to,
                                {
                                  nameTagsByAddress,
                                  fallbackLabel: transaction.toLabel,
                                },
                              )}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          ) : (
                            <span className="text-slate-500">
                              Contract Creation
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">
                          {transaction.amountLabel}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                          {transaction.feeLabel ?? (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No cached transactions available yet.
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
        title="Search Cached Transactions"
        description="Filter cached transactions by address, method, time, block range, or amount range."
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
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              From
            </span>
            <input
              value={searchForm.from}
              onChange={(event) =>
                handleSearchInputChange('from', event.target.value)
              }
              placeholder="0x..."
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              To
            </span>
            <input
              value={searchForm.to}
              onChange={(event) =>
                handleSearchInputChange('to', event.target.value)
              }
              placeholder="0x..."
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Start Time
            </span>
            <input
              type="datetime-local"
              value={searchForm.startTime}
              onChange={(event) =>
                handleSearchInputChange('startTime', event.target.value)
              }
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              End Time
            </span>
            <input
              type="datetime-local"
              value={searchForm.endTime}
              onChange={(event) =>
                handleSearchInputChange('endTime', event.target.value)
              }
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
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Min Amount
            </span>
            <input
              value={searchForm.minAmount}
              onChange={(event) =>
                handleSearchInputChange('minAmount', event.target.value)
              }
              placeholder="0"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Max Amount
            </span>
            <input
              value={searchForm.maxAmount}
              onChange={(event) =>
                handleSearchInputChange('maxAmount', event.target.value)
              }
              placeholder="0"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Method
            </span>
            <input
              value={searchForm.method}
              onChange={(event) =>
                handleSearchInputChange('method', event.target.value)
              }
              placeholder="transfer / create / 0xa9059cbb"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status
            </span>
            <Select
              value={searchForm.status}
              onValueChange={(value: TransactionSearchFormState['status']) =>
                handleSearchInputChange('status', value)
              }
            >
              <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="reverted">Failed</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        {searchErrorMessage ? (
          <p className="mt-4 text-sm text-rose-600">{searchErrorMessage}</p>
        ) : null}
      </ModalDialog>
    </AppShell>
  );
}

export default function EvmTransactionsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-28" rows={8} columns={8} />
        </AppShell>
      }
    >
      <EvmTransactionsPageContent />
    </Suspense>
  );
}
