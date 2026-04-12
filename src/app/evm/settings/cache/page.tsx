"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { IconFileDots } from "@tabler/icons-react";
import { RelativeTime } from "@/components/relative-time";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPageSkeleton } from "@/components/ui/loading-placeholders";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { clearEvmTransactionCache, subscribeEvmTransactionCache } from "@/domains/evm/client/transaction-cache";
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from "@/domains/evm/client/address-tags";
import { resolvePreferredToAddressLabel } from "@/domains/evm/client/address-display";
import {
  getEvmCacheDashboardDirect,
  getEvmCacheSummaryDirect,
  getEvmTransactionReceiptSummariesDirect,
  validateActiveEvmCacheDirect,
} from "@/domains/evm/client/queries";
import { AddressLink } from "@/domains/evm/ui/address-link";
import { AppShell } from "@/platform/layout/app-shell";

type CacheDashboard = Awaited<ReturnType<typeof getEvmCacheDashboardDirect>>;
type CacheValidationResult = Awaited<ReturnType<typeof validateActiveEvmCacheDirect>>;

function SummaryCard({
  label,
  value,
  note,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  valueClassName?: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className={`mt-2 min-w-0 text-[30px] font-semibold leading-none text-slate-900 ${valueClassName ?? ""}`}>
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-500">{note}</div>
    </article>
  );
}

export default function EvmCacheSettingsPage() {
  const [data, setData] = useState<CacheDashboard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<CacheValidationResult | null>(null);
  const [actionLoading, setActionLoading] = useState<"validate" | "clear" | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [transactionPage, setTransactionPage] = useState(1);
  const [accountPage, setAccountPage] = useState(1);
  const [receiptLookupEnabled, setReceiptLookupEnabled] = useState(false);
  const [receiptDetailsByHash, setReceiptDetailsByHash] = useState<
    Record<string, { status: string; statusLabel: string; feeLabel: string }>
  >({});
  const [receiptLoading, setReceiptLoading] = useState(false);

  const visibleAddresses = useMemo(
    () =>
      data
        ? [
            ...new Set(
              [
                ...data.cachedTransactions.transactions.flatMap((transaction) => [
                  transaction.from,
                  ...(transaction.to ? [transaction.to] : []),
                ]),
                ...data.observedAccounts.accounts.map((account) => account.address),
              ],
            ),
          ]
        : [],
    [data],
  );
  const cachedTransactionHashesKey = useMemo(
    () => data?.cachedTransactions.transactions.map((transaction) => transaction.hash).join(",") ?? "",
    [data],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setLoading(true);
      }

      try {
        const next = await getEvmCacheDashboardDirect(transactionPage, accountPage);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);

          if (next.cachedTransactions.page !== transactionPage) {
            setTransactionPage(next.cachedTransactions.page);
          }

          if (next.observedAccounts.page !== accountPage) {
            setAccountPage(next.observedAccounts.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load cache settings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const unsubscribe = subscribeEvmTransactionCache(() => {
      void (async () => {
        try {
          const nextSummary = await getEvmCacheSummaryDirect();

          if (cancelled) {
            return;
          }

          setData((current) =>
            current
              ? {
                  ...current,
                  header: nextSummary.header,
                  summary: nextSummary.summary,
                }
              : current,
          );
        } catch {
          // Ignore background summary refresh failures and keep the current page state stable.
        }
      })();
    });

    const handleProfileChanged = () => {
      setActionState(null);
      setClearDialogOpen(false);
      setTransactionPage(1);
      setAccountPage(1);
      void (async () => {
        await validateActiveEvmCacheDirect().catch(() => null);
        await load();
      })();
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, [accountPage, transactionPage]);

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

  useEffect(() => {
    if (!receiptLookupEnabled || !data?.cachedTransactions.transactions.length) {
      setReceiptDetailsByHash({});
      setReceiptLoading(false);
      return;
    }

    let cancelled = false;

    async function loadReceiptDetails() {
      setReceiptLoading(true);

      try {
        const nextDetails = await getEvmTransactionReceiptSummariesDirect(
          data.cachedTransactions.transactions.map((transaction) => transaction.hash),
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
  }, [cachedTransactionHashesKey, data, receiptLookupEnabled]);

  async function reloadCurrentPages() {
    const next = await getEvmCacheDashboardDirect(transactionPage, accountPage);
    setData(next);
    setErrorMessage(null);
    setTransactionPage(next.cachedTransactions.page);
    setAccountPage(next.observedAccounts.page);
  }

  async function handleValidate() {
    setActionLoading("validate");

    try {
      const result = await validateActiveEvmCacheDirect();
      setActionState(result);
      setClearDialogOpen(false);
      await reloadCurrentPages();
    } catch (error) {
      setActionState({
        status: "failed",
        label: error instanceof Error ? error.message : "Failed to validate cache.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClear() {
    setActionLoading("clear");

    try {
      await clearEvmTransactionCache();
      setActionState({
        status: "cleared",
        label: "Cleared current local EVM cache.",
      });
      setClearDialogOpen(false);
      await reloadCurrentPages();
    } catch (error) {
      setActionState({
        status: "failed",
        label: error instanceof Error ? error.message : "Failed to clear cache.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const validationToneClassName =
    actionState?.status === "valid"
      ? "text-emerald-600"
      : actionState?.status === "cleared"
        ? "text-amber-600"
        : actionState?.status === "failed"
          ? "text-rose-600"
          : "text-slate-900";

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-32" metricCards={4} rows={5} columns={3} showToolbar={false} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Cache settings are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Cache</h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage the local IndexedDB cache used by the active EVM provider.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
                actionLoading === "validate"
                  ? "cursor-wait border-sky-200 bg-sky-50 text-sky-600"
                  : "border-slate-200 bg-white text-slate-700 hover:text-slate-900"
              }`}
              disabled={actionLoading != null}
              onClick={() => void handleValidate()}
            >
              {actionLoading === "validate" ? "Validating..." : "Validate Cache"}
            </button>
            <button
              type="button"
              className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
                actionLoading === "clear"
                  ? "cursor-wait border-rose-200 bg-rose-50 text-rose-600"
                  : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
              }`}
              disabled={actionLoading != null}
              onClick={() => setClearDialogOpen(true)}
            >
              {actionLoading === "clear" ? "Clearing..." : "Clear Cache"}
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Cached Transactions"
            value={data.summary.cachedTransactions.toLocaleString("en-US")}
            note="Stored in local IndexedDB"
          />
          <SummaryCard
            label="Observed Accounts"
            value={data.summary.observedAccounts.toLocaleString("en-US")}
            note="Derived from cached transaction participants"
          />
          <SummaryCard
            label="Latest Cached Transaction"
            value={
              data.summary.latestCachedTransaction ? (
                <Link
                  className="block truncate text-[22px] leading-tight text-sky-600 hover:text-sky-700"
                  href={`/evm/tx/${data.summary.latestCachedTransaction.hash}`}
                  title={data.summary.latestCachedTransaction.hash}
                >
                  {data.summary.latestCachedTransaction.hashLabel}
                </Link>
              ) : (
                "Unavailable"
              )
            }
            valueClassName="text-[22px] leading-tight"
            note={
              data.summary.latestCachedTransaction ? (
                <span>
                  <RelativeTime timestampMs={data.summary.latestCachedTransaction.timestampMs} />
                  {` - Block #${data.summary.latestCachedTransaction.blockNumber}`}
                </span>
              ) : (
                "No cached transaction snapshot yet"
              )
            }
          />
          <SummaryCard
            label="Validation Status"
            value={<span className={validationToneClassName}>{actionState?.label ?? "Not checked"}</span>}
            note="Run validation against the active provider"
          />
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">Cached Transactions</p>
              <p className="mt-1 text-sm text-slate-500">
                Browse paged cached transactions captured from recent scans.
              </p>
            </div>
            <div className="flex items-center gap-2 self-end lg:self-auto">
              <PaginationControls
                page={data.cachedTransactions.page}
                totalPages={data.cachedTransactions.totalPages}
                hasPreviousPage={data.cachedTransactions.hasPreviousPage}
                hasNextPage={data.cachedTransactions.hasNextPage}
                disabled={loading}
                onPageChange={setTransactionPage}
              />
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
                    Hash
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
                  ) : null}
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Cached Age
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.cachedTransactions.transactions.length ? (
                  data.cachedTransactions.transactions.map((transaction) => {
                    const receiptDetail = receiptDetailsByHash[transaction.hash];

                    return (
                      <tr key={transaction.hash} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          <div className="flex flex-col gap-0.5">
                            <Link
                              className="font-medium text-sky-600 hover:text-sky-700"
                              href={`/evm/tx/${transaction.hash}`}
                            >
                              {transaction.hashLabel}
                            </Link>
                            <span className="text-xs text-slate-400">Block #{transaction.blockNumber}</span>
                          </div>
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
                            <span className="text-slate-500">{transaction.toLabel}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <div className="flex flex-col gap-0.5">
                            <span>{transaction.methodLabel}</span>
                            <span className="text-xs text-slate-400">{transaction.amountLabel}</span>
                          </div>
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
                        ) : null}
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <RelativeTime timestampMs={transaction.timestampMs} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-500" colSpan={receiptLookupEnabled ? 7 : 5}>
                      No cached transactions are available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">Observed Accounts</p>
              <p className="mt-1 text-sm text-slate-500">
                Browse paged locally observed accounts under the current provider cache.
              </p>
            </div>
            <PaginationControls
              page={data.observedAccounts.page}
              totalPages={data.observedAccounts.totalPages}
              hasPreviousPage={data.observedAccounts.hasPreviousPage}
              hasNextPage={data.observedAccounts.hasNextPage}
              disabled={loading}
              onPageChange={setAccountPage}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Address
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Observed Txn Count
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Last Seen
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.observedAccounts.accounts.length ? (
                  data.observedAccounts.accounts.map((account) => (
                    <tr key={account.address} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <AddressLink
                          address={account.address}
                          href={`/evm/address/${account.address}`}
                          label={nameTagsByAddress[account.address] ?? account.addressLabel}
                          className="font-medium text-sky-600 hover:text-sky-700"
                        />
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {account.totalTxCount.toLocaleString("en-US")}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            <RelativeTime timestampMs={account.lastSeenTimestampMs} />
                          </span>
                          <span className="text-xs text-slate-400">Block #{account.lastSeenBlockNumber}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-500" colSpan={3}>
                      No observed accounts are cached yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          title="Clear Cache"
          description="Clear all locally cached EVM transactions and observed accounts from IndexedDB?"
          confirmLabel="Clear Cache"
          onConfirm={() => {
            void handleClear();
          }}
        />
      </main>
    </AppShell>
  );
}
