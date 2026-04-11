"use client";

import { IconFileDots, IconRefresh } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ListPageSkeleton } from "@/components/ui/loading-placeholders";
import { RelativeTime } from "@/components/relative-time";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from "@/domains/evm/client/address-tags";
import { resolvePreferredToAddressLabel } from "@/domains/evm/client/address-display";
import { subscribeEvmContractRegistry } from "@/domains/evm/client/contract-registry";
import { resolveEvmTransactionMethodLabel } from "@/domains/evm/client/transaction-decoder";
import { AddressLink } from "@/domains/evm/ui/address-link";
import {
  getEvmTransactionReceiptSummariesDirect,
  getEvmTransactionsPageDirect,
} from "@/domains/evm/client/queries";
import { useEvmHomeData } from "@/domains/evm/ui/home-data-provider";
import { AppShell } from "@/platform/layout/app-shell";

const PAGE_SIZE = 20;

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? "1", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildPageHref(pathname: string, searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams.toString());

  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function EvmTransactionsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { latestFeed } = useEvmHomeData();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get("page"));
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvmTransactionsPageDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [receiptLookupEnabled, setReceiptLookupEnabled] = useState(false);
  const [receiptDetailsByHash, setReceiptDetailsByHash] = useState<
    Record<string, { status: string; statusLabel: string; feeLabel: string }>
  >({});
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [decodeVersion, setDecodeVersion] = useState(0);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const transactionHashesKey = useMemo(
    () => data?.transactions.map((transaction) => transaction.hash).join(",") ?? "",
    [data],
  );
  const visibleAddresses = useMemo(
    () =>
      [...new Set(
        data?.transactions.flatMap((transaction) => [
          transaction.from,
          ...(transaction.to ? [transaction.to] : []),
        ]) ?? [],
      )],
    [data],
  );
  const decodedMethodLabelByHash = useMemo(
    () => {
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
    },
    [data, decodeVersion],
  );

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getEvmTransactionsPageDirect(currentPage, PAGE_SIZE);

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
          setErrorMessage(error instanceof Error ? error.message : "Failed to load transactions.");
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

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, [currentPage, pathname, router, searchParamsText]);

  useEffect(() => {
    if (!autoRefreshEnabled || currentPage !== 1 || !latestFeed) {
      return;
    }

    setData((current) => {
      if (!current) {
        return current;
      }

      const mergedTransactions = [
        ...latestFeed.transactionsPageItems,
        ...current.transactions.filter(
          (transaction) => !latestFeed.transactionsPageItems.some((item) => item.hash === transaction.hash),
        ),
      ].slice(0, PAGE_SIZE);
      const nextTotalTransactions = Math.min(
        1000,
        current.totalTransactions +
          latestFeed.transactionsPageItems.filter(
            (transaction) => !current.transactions.some((item) => item.hash === transaction.hash),
          ).length,
      );
      const totalPages = Math.max(1, Math.ceil(nextTotalTransactions / current.pageSize));

      return {
        ...current,
        totalTransactions: nextTotalTransactions,
        totalPages,
        hasNextPage: totalPages > current.page,
        latestBlockNumber: latestFeed.latestBlock,
        title: `More than ${nextTotalTransactions.toLocaleString("en-US")} transactions found`,
        subtitle: `Showing recent transactions between block #${current.oldestBlockNumber} and #${latestFeed.latestBlock}`,
        transactions: mergedTransactions,
      };
    });
  }, [autoRefreshEnabled, currentPage, latestFeed]);

  useEffect(() => {
    if (!receiptLookupEnabled || !data?.transactions.length) {
      setReceiptDetailsByHash({});
      setReceiptLoading(false);
      return;
    }

    const transactions = data.transactions;
    let cancelled = false;

    async function loadReceiptDetails() {
      setReceiptLoading(true);

      try {
        const nextDetails = await getEvmTransactionReceiptSummariesDirect(
          transactions.map((transaction) => transaction.hash),
        );

        if (!cancelled) {
          setReceiptDetailsByHash(nextDetails);
        }
      } finally {
        if (!cancelled) {
          setReceiptLoading(false);
        }
      }
    }

    void loadReceiptDetails();

    return () => {
      cancelled = true;
    };
  }, [data, receiptLookupEnabled, transactionHashesKey]);

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
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

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
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
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Transactions</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{data.title}</p>
              <p className="mt-1 text-sm text-slate-500">{data.subtitle}</p>
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
                aria-label={autoRefreshEnabled ? "Disable auto refresh" : "Enable auto refresh"}
                aria-pressed={autoRefreshEnabled}
                title={autoRefreshEnabled ? "Auto refresh enabled" : "Auto refresh disabled"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                  autoRefreshEnabled
                    ? "border-sky-200 bg-sky-50 text-sky-600"
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-600"
                }`}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </button>
              <button
                type="button"
                aria-label={receiptLookupEnabled ? "Disable receipt lookup" : "Enable receipt lookup"}
                aria-pressed={receiptLookupEnabled}
                title={receiptLookupEnabled ? "Receipt lookup enabled" : "Receipt lookup disabled"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${
                  receiptLookupEnabled
                    ? "border-sky-200 bg-sky-50 text-sky-600"
                    : "border-slate-200 bg-white text-slate-400 hover:text-slate-600"
                } ${receiptLoading ? "cursor-wait" : ""}`}
                onClick={() => setReceiptLookupEnabled((current) => !current)}
              >
                <IconFileDots className="size-4" stroke={1.8} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
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
                  {receiptLookupEnabled ? (
                    <>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                        Txn Fee
                      </th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                        Status
                      </th>
                    </>
                  ) : (
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Max Tx Cost
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.transactions.length ? (
                  data.transactions.map((transaction) => {
                    const receiptDetail = receiptDetailsByHash[transaction.hash];

                    return (
                    <tr key={transaction.hash} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                          {transaction.hashLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
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
                          label={nameTagsByAddress[transaction.from] ?? transaction.fromLabel}
                          className="font-medium text-sky-600 hover:text-sky-700"
                        />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.to ? (
                          <AddressLink
                            address={transaction.to}
                            href={`/evm/address/${transaction.to}`}
                            label={resolvePreferredToAddressLabel(transaction.to, {
                              nameTagsByAddress,
                              fallbackLabel: transaction.toLabel,
                            })}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        ) : (
                          <span className="text-slate-500">Contract Creation</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">
                        {transaction.amountLabel}
                      </td>
                      {receiptLookupEnabled ? (
                        <>
                          <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                            {receiptDetail ? receiptDetail.feeLabel : <span className="text-slate-400">--</span>}
                          </td>
                          <td className="px-5 py-3 text-sm">
                            {receiptDetail ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                  receiptDetail.status === "success"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : receiptDetail.status === "reverted"
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {receiptDetail.statusLabel}
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                          {transaction.maxTxCostLabel}
                        </td>
                      )}
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={receiptLookupEnabled ? 9 : 8} className="px-5 py-10 text-center text-sm text-slate-500">
                      No transactions found in the current block window.
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
