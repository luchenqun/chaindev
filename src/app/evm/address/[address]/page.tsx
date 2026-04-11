"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteEvmAddressTag,
  getEvmAddressTag,
  getEvmAddressTags,
  subscribeEvmAddressTags,
  upsertEvmAddressTag,
} from "@/domains/evm/client/address-tags";
import {
  getEvmAddressCacheSnapshot,
  MAX_CACHED_EVM_TRANSACTIONS,
  subscribeEvmTransactionCache,
} from "@/domains/evm/client/transaction-cache";
import { AddressLink } from "@/domains/evm/ui/address-link";
import { getActiveEvmCurrencyNameClient, getEvmAddressSummaryDirect } from "@/domains/evm/client/queries";
import { AppShell } from "@/platform/layout/app-shell";

const VISIBLE_TRANSACTIONS = 25;

function AddressPageSkeleton() {
  return (
    <main className="section-block">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-[520px]" />
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
          >
            <Skeleton className="h-7 w-28" />
            <div className="mt-5 space-y-5">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex}>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-2 h-5 w-48" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-md" />
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-7 w-80" />
          <Skeleton className="mt-2 h-4 w-[520px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {Array.from({ length: 9 }).map((_, index) => (
                  <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200">
                  {Array.from({ length: 9 }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-5 py-3">
                      <Skeleton
                        className={`h-4 ${
                          columnIndex === 0
                            ? "w-32"
                            : columnIndex === 4 || columnIndex === 5
                              ? "w-28"
                              : "w-20"
                        }`}
                      />
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

function formatBalanceLabel(balance: string, currencyName: string) {
  const amount = Number.parseFloat(balance);

  if (!Number.isFinite(amount)) {
    return `${balance} ${currencyName}`;
  }

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(6).replace(/\.?0+$/, "")} ${currencyName}`;
}

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function getDirection(transaction: {
  from: string;
  to: string | null;
}, normalizedAddress: string) {
  const fromMatches = transaction.from.toLowerCase() === normalizedAddress;
  const toMatches = transaction.to?.toLowerCase() === normalizedAddress;

  if (fromMatches && toMatches) {
    return { label: "SELF", className: "bg-slate-100 text-slate-600" };
  }

  if (fromMatches) {
    return { label: "OUT", className: "bg-amber-50 text-amber-700" };
  }

  return { label: "IN", className: "bg-emerald-50 text-emerald-700" };
}

function AddressMetric({
  label,
  value,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export default function EvmAddressPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(address), [address]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getEvmAddressSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [addressCacheSnapshot, setAddressCacheSnapshot] = useState<Awaited<ReturnType<typeof getEvmAddressCacheSnapshot>>>({
    totalTransactions: 0,
    transactions: [],
    latestSeenTransaction: null,
    firstSeenTransaction: null,
    inboundCount: 0,
    outboundCount: 0,
    selfCount: 0,
  });
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const currencyName = getActiveEvmCurrencyNameClient();

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function loadAddressCache() {
      const nextSnapshot = await getEvmAddressCacheSnapshot(address, VISIBLE_TRANSACTIONS);

      if (!cancelled) {
        setAddressCacheSnapshot(nextSnapshot);
      }
    }

    void loadAddressCache();

    const unsubscribe = subscribeEvmTransactionCache(() => {
      void loadAddressCache();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [address, isValid]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    function loadTag() {
      const nextTag = getEvmAddressTag(address);
      setNameTag(nextTag);
      setTagInput(nextTag ?? "");
    }

    loadTag();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadTag();
    });

    const handleProfileChanged = () => {
      loadTag();
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, [address, isValid]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmAddressSummaryDirect(address);

        if (!cancelled) {
          setSummary(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load address summary.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [address, isValid]);

  const normalizedAddress = address.toLowerCase();
  const visibleTransactions = addressCacheSnapshot.transactions;
  const latestSeenTransaction = addressCacheSnapshot.latestSeenTransaction;
  const firstSeenTransaction = addressCacheSnapshot.firstSeenTransaction;
  const inboundCount = addressCacheSnapshot.inboundCount;
  const outboundCount = addressCacheSnapshot.outboundCount;
  const selfCount = addressCacheSnapshot.selfCount;
  const visibleAddresses = useMemo(
    () =>
      [...new Set(
        visibleTransactions.flatMap((transaction) => [
          transaction.from,
          ...(transaction.to ? [transaction.to] : []),
        ]),
      )],
    [visibleTransactions],
  );

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

  function handleSaveTag() {
    if (tagInput.trim()) {
      upsertEvmAddressTag(address, tagInput);
    } else {
      deleteEvmAddressTag(address);
    }

    setTagEditorOpen(false);
  }

  function handleRemoveTag() {
    deleteEvmAddressTag(address);
    setTagInput("");
    setTagEditorOpen(false);
  }

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid address</h1>
          <p>The address must be a 20-byte hex string.</p>
        </main>
      </AppShell>
    );
  }

  if (!summary) {
    if (!errorMessage) {
      return (
        <AppShell>
          <AddressPageSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load address</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Address</h1>
            <span className="text-sm font-medium text-slate-500 mono">{summary.address}</span>
            {nameTag ? (
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {nameTag}
              </span>
            ) : null}
            <button
              type="button"
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
              onClick={() => {
                setTagInput(nameTag ?? "");
                setTagEditorOpen((current) => !current);
              }}
            >
              {tagEditorOpen ? "Cancel" : nameTag ? "Edit Tag" : "Add Tag"}
            </button>
          </div>
          {tagEditorOpen ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-[240px]"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Enter name tag"
              />
              <Button size="sm" type="button" onClick={handleSaveTag}>
                Save
              </Button>
              {nameTag ? (
                <Button size="sm" type="button" variant="outline" onClick={handleRemoveTag}>
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
            <div className="mt-5 space-y-5">
              <AddressMetric label={`${currencyName} Balance`} value={formatBalanceLabel(summary.balance, currencyName)} />
              <AddressMetric label="Nonce" value={summary.nonce.toLocaleString("en-US")} />
              <AddressMetric
                label="Observed Transactions"
                value={addressCacheSnapshot.totalTransactions.toLocaleString("en-US")}
                subtext={`Showing latest ${visibleTransactions.length} cached records`}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">More Info</h2>
            <div className="mt-5 space-y-5">
              <AddressMetric
                label="Latest Seen"
                value={
                  latestSeenTransaction ? (
                    <span className="text-base font-semibold text-slate-900">
                      <RelativeTime timestampMs={latestSeenTransaction.timestampMs} />
                    </span>
                  ) : (
                    "Not cached yet"
                  )
                }
                subtext={
                  latestSeenTransaction ? `Block #${latestSeenTransaction.blockNumber}` : "Browse blocks or txs first"
                }
              />
              <AddressMetric
                label="First Seen In Cache"
                value={
                  firstSeenTransaction ? (
                    <span className="text-base font-semibold text-slate-900">
                      <RelativeTime timestampMs={firstSeenTransaction.timestampMs} />
                    </span>
                  ) : (
                    "Not cached yet"
                  )
                }
                subtext={
                  firstSeenTransaction ? `Block #${firstSeenTransaction.blockNumber}` : "No cached transaction history yet"
                }
              />
              <AddressMetric
                label="Directions"
                value={`${inboundCount} In / ${outboundCount} Out / ${selfCount} Self`}
              />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">Cache Window</h2>
            <div className="mt-5 space-y-5">
              <AddressMetric
                label="Cached Transactions"
                value={addressCacheSnapshot.totalTransactions.toLocaleString("en-US")}
                subtext={`IndexedDB cap: ${MAX_CACHED_EVM_TRANSACTIONS.toLocaleString("en-US")}`}
              />
              <AddressMetric
                label="Address Coverage"
                value={addressCacheSnapshot.totalTransactions ? `${addressCacheSnapshot.totalTransactions} matched` : "No cached matches"}
                subtext="Only transactions seen from recent block queries are cached locally"
              />
              <AddressMetric
                label="Refresh Note"
                value="IndexedDB cache"
                subtext="If the newest cached transaction hash no longer resolves on the current provider, the local cache is cleared"
              />
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="inline-flex rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
            Transactions
          </button>
          <button type="button" disabled className="inline-flex cursor-not-allowed rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
            Internal Transactions
          </button>
          <button type="button" disabled className="inline-flex cursor-not-allowed rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
            Token Transfers
          </button>
          <button type="button" disabled className="inline-flex cursor-not-allowed rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-300">
            Analytics
          </button>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">
              Latest {visibleTransactions.length} from a total of {addressCacheSnapshot.totalTransactions.toLocaleString("en-US")} cached transactions
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Showing IndexedDB-cached transactions where the address appears in either the `from` or `to` field.
            </p>
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
                    Direction
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
                    Max Tx Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.length ? (
                  visibleTransactions.map((transaction) => {
                    const direction = getDirection(transaction, normalizedAddress);

                    return (
                      <tr key={transaction.hash} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                            {transaction.hashLabel}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {transaction.methodLabel}
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
                          <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${direction.className}`}>
                            {direction.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <AddressLink
                            address={transaction.from}
                            href={`/evm/address/${transaction.from}`}
                            label={
                              nameTagsByAddress[transaction.from] ??
                              (transaction.from.toLowerCase() === normalizedAddress ? formatAddressLabel(transaction.from) : transaction.fromLabel)
                            }
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        </td>
                        <td className="px-5 py-3 text-sm">
                          {transaction.to ? (
                            <AddressLink
                              address={transaction.to}
                              href={`/evm/address/${transaction.to}`}
                              label={
                                nameTagsByAddress[transaction.to] ??
                                (transaction.to.toLowerCase() === normalizedAddress ? formatAddressLabel(transaction.to) : transaction.toLabel)
                              }
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          ) : (
                            <span className="text-slate-500">Contract Creation</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">
                          {transaction.amountLabel}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                          {transaction.maxTxCostLabel}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                      No cached transactions for this address yet. Browse recent blocks or the tx list first so matching transactions can be written into IndexedDB.
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
