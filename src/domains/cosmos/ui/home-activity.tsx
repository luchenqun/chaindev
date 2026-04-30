'use client';

import { IconAlertCircle, IconBox, IconFileText } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HomeActivitySkeleton } from '@/components/ui/loading-placeholders';
import { formatRelativeAge } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';
import { usePushedListItems } from '@/platform/home/use-pushed-list-items';

type HomeActivityViewportStyle = React.CSSProperties & {
  '--home-activity-visible-items': number;
  '--home-activity-entering-rows'?: number;
};

const HOME_ACTIVITY_VISIBLE_ITEMS = 6;

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-6 text-sm text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyTransactionState() {
  return (
    <div className="flex h-full min-h-[8rem] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <IconFileText className="size-5" stroke={1.8} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">No recent transactions</p>
      <p className="mt-1 max-w-72 text-sm text-slate-500">The selected Cosmos provider returned no transaction data.</p>
    </div>
  );
}

export function CosmosHomeActivity() {
  const { snapshot, errorMessage, nowMs } = useCosmosHomeData();
  const blockItems = snapshot?.activity.blocks ?? [];
  const transactionItems = snapshot?.activity.transactions ?? [];
  const transactionVisibleItems = transactionItems.length || 1;
  const getBlockKey = useCallback((block: (typeof blockItems)[number]) => `${block.height}-${block.hash}`, []);
  const getTransactionKey = useCallback((transaction: (typeof transactionItems)[number]) => transaction.hash, []);
  const pushedBlockItems = usePushedListItems(blockItems, getBlockKey, true, HOME_ACTIVITY_VISIBLE_ITEMS);
  const pushedTransactionItems = usePushedListItems(transactionItems, getTransactionKey, true, HOME_ACTIVITY_VISIBLE_ITEMS);
  const pushedTransactionEnteringRows = pushedTransactionItems.filter((item) => item.phase === 'entering').length || 1;

  if (!snapshot && !errorMessage) {
    return <HomeActivitySkeleton />;
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Blocks</h2>
            <Link prefetch={false} className="text-sm font-medium text-sky-600" href="/cosmos/blocks">
              VIEW ALL BLOCKS
            </Link>
          </div>
          <div
            className="home-activity-push-viewport overflow-hidden border-t border-slate-200 pt-1"
            style={{ '--home-activity-visible-items': blockItems.length } as HomeActivityViewportStyle}
          >
            {pushedBlockItems.length ? (
              <div className={cn('grid', pushedBlockItems.some((item) => item.phase !== 'stable') && 'home-activity-push-list-moving')}>
                {pushedBlockItems.map(({ item: block, key, phase }, index) => (
                  <div key={key} className={cn('home-activity-push-row', index ? 'border-t border-slate-200' : '', `home-activity-push-row-${phase}`)}>
                    <div className="home-activity-push-row-content">
                      <div className="grid grid-cols-[40px_minmax(110px,0.75fr)_minmax(0,1fr)_120px] items-center gap-4 py-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                          <IconBox className="size-5" stroke={1.8} />
                        </div>
                        <div className="min-w-0">
                          <Link prefetch={false} className="block text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/cosmos/block/${block.height}`}>
                            {block.height}
                          </Link>
                          <p className="mt-1 text-sm text-slate-500">{formatRelativeAge(block.timestampMs, nowMs)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700">
                            Validated By{' '}
                            <Link
                              prefetch={false}
                              className="font-semibold text-sky-600 hover:text-sky-700"
                              href={block.proposerOperatorAddress ? `/cosmos/validator/${block.proposerOperatorAddress}` : '/cosmos/validators'}
                            >
                              {block.proposerLabel}
                            </Link>
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            <Link
                              prefetch={false}
                              className="font-semibold text-sky-600 hover:text-sky-700"
                              href={`/cosmos/block/${block.height}?tab=transactions`}
                            >
                              {block.txCount} txs
                            </Link>
                          </p>
                        </div>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-right text-xs text-slate-600">{block.blockSizeLabel}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Latest Blocks" message={errorMessage ?? 'Add a Cosmos provider first to load latest block data.'} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Transactions</h2>
            <Link prefetch={false} className="text-sm font-medium text-sky-600" href="/cosmos/txs">
              VIEW ALL TRANSACTIONS
            </Link>
          </div>
          <div
            className="home-activity-push-viewport overflow-hidden border-t border-slate-200 pt-1"
            style={
              {
                '--home-activity-visible-items': transactionVisibleItems,
                '--home-activity-entering-rows': pushedTransactionEnteringRows,
              } as HomeActivityViewportStyle
            }
          >
            {pushedTransactionItems.length ? (
              <div className={cn('grid', pushedTransactionItems.some((item) => item.phase !== 'stable') && 'home-activity-push-list-moving')}>
                {pushedTransactionItems.map(({ item: transaction, key, phase }, index) => (
                  <div key={key} className={cn('home-activity-push-row', index ? 'border-t border-slate-200' : '', `home-activity-push-row-${phase}`)}>
                    <div className="home-activity-push-row-content">
                      <div className="grid grid-cols-[40px_minmax(190px,1.15fr)_minmax(0,1fr)_130px] items-center gap-4 py-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <IconFileText className="size-5" stroke={1.8} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-0.5">
                            {transaction.status === 'failed' ? <IconAlertCircle className="size-4 shrink-0 text-rose-500" stroke={2} /> : null}
                            <Link prefetch={false} className="block truncate text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${transaction.hash}`}>
                              {transaction.hashLabel}
                            </Link>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            Height {transaction.height} · {formatRelativeAge(transaction.timestampMs, nowMs)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700">{transaction.type}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            <Link prefetch={false} className="text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                              {transaction.senderLabel}
                            </Link>
                          </p>
                        </div>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-right text-xs text-slate-600">{transaction.feeLabel}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyTransactionState />
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
