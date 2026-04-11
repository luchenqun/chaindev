"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { RelativeTime } from "@/components/relative-time";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewCardsSkeleton } from "@/components/ui/loading-placeholders";
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from "@/domains/evm/client/address-tags";
import { getEvmOverviewDirect } from "@/domains/evm/client/queries";
import { AddressLink } from "@/domains/evm/ui/address-link";
import { AppShell } from "@/platform/layout/app-shell";

type EvmOverviewData = Awaited<ReturnType<typeof getEvmOverviewDirect>>;

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function OverviewMetricCard({
  eyebrow,
  title,
  value,
  note,
}: {
  eyebrow: string;
  title: string;
  value: ReactNode;
  note: ReactNode;
}) {
  return (
    <Card className="h-full rounded-3xl">
      <CardHeader className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
        <CardTitle className="text-sm text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        <div className="mt-2 text-sm text-slate-500">{note}</div>
      </CardContent>
    </Card>
  );
}

function QuickAccessCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full rounded-3xl transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(14,116,144,0.10)]">
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Quick Access</p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function EvmOverviewPage() {
  const [overview, setOverview] = useState<EvmOverviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | null = null;

    function clearScheduledLoad() {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    async function load() {
      clearScheduledLoad();

      try {
        const next = await getEvmOverviewDirect();

        if (disposed) {
          return;
        }

        setOverview(next);
        setErrorMessage(null);
        timeoutId = window.setTimeout(() => {
          void load();
        }, next.pollIntervalMs);
      } catch (error) {
        if (disposed) {
          return;
        }

        setOverview(null);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load EVM overview.");
        timeoutId = window.setTimeout(() => {
          void load();
        }, 12_000);
      }
    }

    function handleProfileChanged() {
      void load();
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      disposed = true;
      clearScheduledLoad();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, []);

  const visibleAddresses = useMemo(() => {
    if (!overview) {
      return [];
    }

    return [
      ...new Set(
        [
          ...overview.activity.blocks.map((block) => block.miner),
          ...overview.activity.transactions.flatMap((transaction) => [
            transaction.from,
            ...(transaction.to ? [transaction.to] : []),
          ]),
        ],
      ),
    ];
  }, [overview]);

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

  if (!overview) {
    if (!errorMessage) {
      return (
        <AppShell>
          <OverviewCardsSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <span className="kicker">Chain Overview</span>
          <h1>Node is temporarily unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,0.96)_55%,rgba(248,250,252,0.96))] px-5 py-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:px-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <span className="kicker">Chain Overview</span>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Chain Overview</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Live state from the selected EVM RPC provider
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              <StatusPill label="Connection" value="Direct JSON-RPC" />
              <StatusPill label="Provider Name" value={overview.header.providerName} />
              <StatusPill label="Native Currency" value={overview.header.nativeCurrency} />
            </div>
          </div>
        </section>

        <section>
          <SectionHeading title="Core State" description="Answer the current state of the chain first." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OverviewMetricCard
              eyebrow="Latest Block"
              title="Latest Block"
              value={overview.core.latestBlock}
              note={<RelativeTime timestampMs={overview.core.latestBlockTimestampMs} />}
            />
            <OverviewMetricCard
              eyebrow="Latest Block Time"
              title="Latest Block Time"
              value={overview.core.latestBlockTime}
              note="Local formatted time"
            />
            <OverviewMetricCard
              eyebrow="Average Block Time"
              title="Average Block Time"
              value={overview.core.averageBlockTime}
              note="Sampled from recent blocks"
            />
            <OverviewMetricCard
              eyebrow="Gas Price"
              title="Gas Price"
              value={overview.core.gasPrice}
              note="Quoted in gwei"
            />
            <OverviewMetricCard
              eyebrow="Chain ID"
              title="Chain ID"
              value={overview.core.chainId}
              note="Selected provider"
            />
            <OverviewMetricCard
              eyebrow="Pending Tx Count"
              title="Pending Tx Count"
              value={overview.core.pendingTransactionCount}
              note={
                overview.core.pendingTransactionCount === "Unavailable"
                  ? "Provider does not expose pending pool"
                  : "Pending block transaction count"
              }
            />
          </div>
        </section>

        <section>
          <SectionHeading
            title="Recent Chain Activity"
            description="Split recent activity into blocks and transactions."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle>Recent Blocks</CardTitle>
                <CardDescription>Latest 5 blocks from the selected provider</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {overview.activity.blocks.length ? (
                  overview.activity.blocks.map((block) => (
                    <div
                      key={`${block.number}-${block.hash}`}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 md:grid-cols-[120px_110px_minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Block</p>
                        <Link
                          className="mt-1 block text-sm font-semibold text-sky-600 hover:text-sky-700"
                          href={`/evm/block/${block.number}`}
                        >
                          #{block.numberLabel}
                        </Link>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Age</p>
                        <p className="mt-1 text-sm text-slate-700">
                          <RelativeTime timestampMs={block.timestampMs} />
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Miner</p>
                        <div className="mt-1 truncate text-sm text-slate-700">
                          <AddressLink
                            address={block.miner}
                            href={`/evm/address/${block.miner}`}
                            label={nameTagsByAddress[block.miner] ?? block.minerLabel}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Txn</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{block.txCount}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Recent Blocks" message="No recent blocks were returned by the provider." />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest 5 transactions sampled from recent blocks</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {overview.activity.transactions.length ? (
                  overview.activity.transactions.map((transaction) => (
                    <div
                      key={transaction.hash}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 md:grid-cols-[140px_110px_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hash</p>
                        <Link
                          className="mt-1 block truncate text-sm font-semibold text-sky-600 hover:text-sky-700"
                          href={`/evm/tx/${transaction.hash}`}
                        >
                          {transaction.hashLabel}
                        </Link>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Age</p>
                        <p className="mt-1 text-sm text-slate-700">
                          <RelativeTime timestampMs={transaction.timestampMs} />
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">From</p>
                        <div className="mt-1 truncate text-sm text-slate-700">
                          <AddressLink
                            address={transaction.from}
                            href={`/evm/address/${transaction.from}`}
                            label={nameTagsByAddress[transaction.from] ?? transaction.fromLabel}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">To</p>
                        <div className="mt-1 truncate text-sm text-slate-700">
                          {transaction.to ? (
                            <AddressLink
                              address={transaction.to}
                              href={`/evm/address/${transaction.to}`}
                              label={nameTagsByAddress[transaction.to] ?? transaction.toLabel}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          ) : (
                            <span>{transaction.toLabel}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Amount</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{transaction.value}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Recent Transactions"
                    message="No recent transactions were found in the latest sampled blocks."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <SectionHeading
            title="Block Rhythm"
            description="Show chain rhythm, not only the latest head state."
          />
          <Card className="rounded-3xl">
            <CardHeader className="pb-4">
              <CardTitle>Block Rhythm</CardTitle>
              <CardDescription>Recent interval sampling from the latest 10 blocks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Average Interval</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{overview.rhythm.averageInterval}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Fastest Interval</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{overview.rhythm.fastestInterval}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Slowest Interval</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{overview.rhythm.slowestInterval}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recent Tx Count</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{overview.rhythm.recentTransactionCount}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="hidden grid-cols-[120px_120px_100px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
                  <span>Block</span>
                  <span>Interval</span>
                  <span>Txn</span>
                  <span>Gas Used</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {overview.rhythm.blocks.map((block) => (
                    <div
                      key={`${block.number}-${block.hash}`}
                      className="grid gap-3 px-4 py-3 md:grid-cols-[120px_120px_100px_140px] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">Block</p>
                        <Link
                          className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                          href={`/evm/block/${block.number}`}
                        >
                          #{block.number}
                        </Link>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">Interval</p>
                        <p className="text-sm text-slate-700">{block.intervalLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">Txn</p>
                        <p className="text-sm text-slate-700">{block.txCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:hidden">Gas Used</p>
                        <p className="text-sm text-slate-700">{block.gasUsedLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <SectionHeading
            title="Local Cache"
            description="Show what has already been indexed locally under the current provider."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OverviewMetricCard
              eyebrow="Cached Transactions"
              title="Cached Transactions"
              value={overview.cache.cachedTransactions}
              note="Stored in local IndexedDB from recent scans"
            />
            <OverviewMetricCard
              eyebrow="Observed Accounts"
              title="Observed Accounts"
              value={overview.cache.observedAccounts}
              note="Derived from cached transaction participants"
            />
            <OverviewMetricCard
              eyebrow="Latest Cached Transaction"
              title="Latest Cached Transaction"
              value={
                overview.cache.latestCachedTransaction ? (
                  <Link
                    className="text-sky-600 hover:text-sky-700"
                    href={`/evm/tx/${overview.cache.latestCachedTransaction.hash}`}
                  >
                    {overview.cache.latestCachedTransaction.hashLabel}
                  </Link>
                ) : (
                  "Unavailable"
                )
              }
              note={
                overview.cache.latestCachedTransaction ? (
                  <span>
                    <RelativeTime timestampMs={overview.cache.latestCachedTransaction.timestampMs} />
                    {` - Block #${overview.cache.latestCachedTransaction.blockNumber}`}
                  </span>
                ) : (
                  "No cached transaction snapshot yet"
                )
              }
            />
            <OverviewMetricCard
              eyebrow="Cache Validation"
              title="Cache Validation"
              value={overview.cache.validation}
              note="Validated against the currently selected provider"
            />
          </div>
        </section>

        <section>
          <SectionHeading title="Quick Access" description="Jump directly into the most-used EVM pages." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <QuickAccessCard href="/evm/blocks" title="Blocks" description="Browse recent blocks and miners" />
            <QuickAccessCard
              href="/evm/txs"
              title="Transactions"
              description="Inspect recent transactions and receipts"
            />
            <QuickAccessCard
              href="/evm/accounts"
              title="Accounts"
              description="Explore locally observed accounts"
            />
            <QuickAccessCard
              href="/evm/tools/rpc"
              title="RPC Debug"
              description="Send raw RPC requests to the provider"
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
