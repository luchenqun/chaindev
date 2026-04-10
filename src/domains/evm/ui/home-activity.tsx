"use client";

import { IconBox, IconFileText } from "@tabler/icons-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { HomeActivitySkeleton } from "@/components/ui/loading-placeholders";
import { useEvmHomeData } from "@/domains/evm/ui/home-data-provider";

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-6 text-sm text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function formatRelativeAge(timestampMs: number | null, nowMs: number) {
  if (!timestampMs) {
    return "Unavailable";
  }

  const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));

  if (seconds < 60) {
    return `${seconds} secs ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} mins ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hrs ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export function EvmHomeActivity() {
  const { snapshot, errorMessage, nowMs } = useEvmHomeData();
  const activity = snapshot?.activity ?? null;

  if (!snapshot && !errorMessage) {
    return <HomeActivitySkeleton />;
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Blocks</h2>
            <Link className="text-sm font-medium text-sky-600" href="/evm/blocks">
              VIEW ALL BLOCKS
            </Link>
          </div>
          <div className="grid border-t border-slate-200 pt-1">
            {activity?.blocks.length ? (
              activity.blocks.map((block, index) => (
                <div
                  key={`${block.number}-${block.hash}`}
                  className={`grid grid-cols-[auto_130px_minmax(0,1fr)_auto] items-center gap-4 py-4 ${
                    index ? "border-t border-slate-200" : ""
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <IconBox className="size-5" stroke={1.8} />
                  </div>
                  <div className="min-w-0">
                    <Link className="block text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/evm/block/${block.number}`}>
                      {block.numberLabel}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{formatRelativeAge(block.timestampMs, nowMs)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-600">
                      Miner{" "}
                      <Link className="font-semibold text-sky-600 hover:text-sky-700" href={`/evm/address/${block.miner}`}>
                        {block.minerLabel}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{block.txCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {block.gasUsedLabel}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Latest Blocks"
                message={errorMessage ?? "Add an EVM provider first to load latest block data."}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Transactions</h2>
            <Link className="text-sm font-medium text-sky-600" href="/evm/txs">
              VIEW ALL TRANSACTIONS
            </Link>
          </div>
          <div className="grid border-t border-slate-200 pt-1">
            {activity?.transactions.length ? (
              activity.transactions.map((transaction, index) => (
                <div
                  key={`${transaction.hash}-${index}`}
                  className={`grid grid-cols-[auto_160px_minmax(0,1fr)_auto] items-center gap-3 py-4 ${
                    index ? "border-t border-slate-200" : ""
                  }`}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <IconFileText className="size-5" stroke={1.8} />
                  </div>
                  <div className="min-w-0">
                    <Link className="block truncate text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                      {transaction.hashLabel}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{formatRelativeAge(transaction.timestampMs, nowMs)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-600">
                      From{" "}
                      <Link className="font-semibold text-sky-600 hover:text-sky-700" href={`/evm/address/${transaction.from}`}>
                        {transaction.fromLabel}
                      </Link>
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      To{" "}
                      {transaction.to ? (
                        <Link className="font-semibold text-sky-600 hover:text-sky-700" href={`/evm/address/${transaction.to}`}>
                          {transaction.toLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-500">{transaction.toLabel}</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {transaction.value}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="Latest Transactions"
                message={errorMessage ?? "Add an EVM provider first to load recent transactions."}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
