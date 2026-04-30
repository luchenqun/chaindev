'use client';

import { IconAlertCircle, IconBox, IconFileText } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HomeActivitySkeleton } from '@/components/ui/loading-placeholders';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { resolvePreferredAddressLabel, resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { formatRelativeAge } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { usePushedListItems } from '@/platform/home/use-pushed-list-items';

type HomeActivityViewportStyle = React.CSSProperties & {
  '--home-activity-visible-items': number;
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

export function EvmHomeActivity() {
  const { snapshot, errorMessage, nowMs } = useEvmHomeData();
  const activity = snapshot?.activity ?? null;
  const blockItems = activity?.blocks ?? [];
  const transactionItems = activity?.transactions ?? [];
  const getBlockKey = useCallback((block: (typeof blockItems)[number]) => `${block.number}-${block.hash}`, []);
  const getTransactionKey = useCallback((transaction: (typeof transactionItems)[number]) => transaction.hash, []);
  const pushedBlockItems = usePushedListItems(blockItems, getBlockKey, true, HOME_ACTIVITY_VISIBLE_ITEMS);
  const pushedTransactionItems = usePushedListItems(transactionItems, getTransactionKey, true, HOME_ACTIVITY_VISIBLE_ITEMS);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const visibleAddresses = useMemo(
    () => [
      ...new Set([
        ...(activity?.blocks.map((block) => block.miner) ?? []),
        ...(activity?.transactions.flatMap((transaction) => [transaction.from, ...(transaction.to ? [transaction.to] : [])]) ?? []),
      ]),
    ],
    [activity],
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

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [visibleAddresses]);

  if (!snapshot && !errorMessage) {
    return <HomeActivitySkeleton />;
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Blocks</h2>
            <Link prefetch={false} className="text-sm font-medium text-sky-600" href="/evm/blocks">
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
                      <div className="grid grid-cols-[40px_minmax(120px,0.8fr)_minmax(0,1fr)_120px] items-center gap-4 py-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                          <IconBox className="size-5" stroke={1.8} />
                        </div>
                        <div className="min-w-0">
                          <Link prefetch={false} className="block text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/evm/block/${block.number}`}>
                            {block.numberLabel}
                          </Link>
                          <p className="mt-1 text-sm text-slate-500">{formatRelativeAge(block.timestampMs, nowMs)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-600">
                            Miner{' '}
                            <AddressLink
                              address={block.miner}
                              href={`/evm/address/${block.miner}`}
                              label={nameTagsByAddress[block.miner] ?? block.minerLabel}
                              className="font-semibold text-sky-600 hover:text-sky-700"
                              showCopyButton={false}
                            />
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{block.txCount}</p>
                        </div>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-right text-xs text-slate-600">{block.gasUsedLabel}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Latest Blocks" message={errorMessage ?? 'Add an EVM provider first to load latest block data.'} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Latest Transactions</h2>
            <Link prefetch={false} className="text-sm font-medium text-sky-600" href="/evm/txs">
              VIEW ALL TRANSACTIONS
            </Link>
          </div>
          <div
            className="home-activity-push-viewport overflow-hidden border-t border-slate-200 pt-1"
            style={{ '--home-activity-visible-items': transactionItems.length } as HomeActivityViewportStyle}
          >
            {pushedTransactionItems.length ? (
              <div className={cn('grid', pushedTransactionItems.some((item) => item.phase !== 'stable') && 'home-activity-push-list-moving')}>
                {pushedTransactionItems.map(({ item: transaction, key, phase }, index) => (
                  <div key={key} className={cn('home-activity-push-row', index ? 'border-t border-slate-200' : '', `home-activity-push-row-${phase}`)}>
                    <div className="home-activity-push-row-content">
                      <div className="grid grid-cols-[40px_minmax(170px,1fr)_minmax(0,1fr)_120px] items-center gap-3 py-4">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                          <IconFileText className="size-5" stroke={1.8} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-0.5">
                            {transaction.receiptStatus === 'reverted' ? <IconAlertCircle className="size-4 shrink-0 text-rose-500" stroke={2} /> : null}
                            <Link prefetch={false} className="block truncate text-sm font-semibold text-sky-600 hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                              {transaction.hashLabel}
                            </Link>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            Block #{transaction.blockNumber} · {formatRelativeAge(transaction.timestampMs, nowMs)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-600">
                            From{' '}
                            <AddressLink
                              address={transaction.from}
                              href={`/evm/address/${transaction.from}`}
                              label={resolvePreferredAddressLabel(transaction.from, {
                                nameTagsByAddress,
                                fallbackLabel: transaction.fromLabel,
                              })}
                              className="font-semibold text-sky-600 hover:text-sky-700"
                              showCopyButton={false}
                            />
                          </p>
                          <p className="truncate text-sm text-slate-600">
                            To{' '}
                            {transaction.to ? (
                              <AddressLink
                                address={transaction.to}
                                href={`/evm/address/${transaction.to}`}
                                label={resolvePreferredToAddressLabel(transaction.to, {
                                  nameTagsByAddress,
                                  fallbackLabel: transaction.toLabel,
                                })}
                                className="font-semibold text-sky-600 hover:text-sky-700"
                                showCopyButton={false}
                              />
                            ) : (
                              <span className="text-slate-500">{transaction.toLabel}</span>
                            )}
                          </p>
                        </div>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-right text-xs text-slate-600">{transaction.value}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Latest Transactions" message={errorMessage ?? 'Add an EVM provider first to load recent transactions.'} />
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
