'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { cn } from '@/lib/utils';
import { usePushedListItems } from '@/platform/home/use-pushed-list-items';

type BlockTableProps = {
  blocks: Array<{
    height: string;
    hash: string;
    txCount: number;
    timestampMs: number | null;
    miner: string;
    minerLabel: string;
    gasUsedLabel: string;
    gasUsedPercent: string;
    gasUsedRatio: number;
    gasLimitLabel: string;
    baseFeeLabel: string;
  }>;
  hrefPrefix: string;
  liveInsertAnimationKey?: number;
  pushAnimationEnabled?: boolean;
  maxVisibleItems?: number;
};

export function EvmBlockTable({ blocks, hrefPrefix, liveInsertAnimationKey = 0, pushAnimationEnabled = false, maxVisibleItems = DEFAULT_TABLE_PAGE_SIZE }: BlockTableProps) {
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const minerAddresses = useMemo(() => [...new Set(blocks.map((block) => block.miner))], [blocks]);
  const getBlockKey = useCallback((block: BlockTableProps['blocks'][number]) => `${block.height}-${block.hash}`, []);
  const pushedBlocks = usePushedListItems(blocks, getBlockKey, pushAnimationEnabled, maxVisibleItems, false);
  const hasFullPage = blocks.length >= maxVisibleItems;

  useEffect(() => {
    function loadMinerTags() {
      setNameTagsByAddress(getEvmAddressTags(minerAddresses));
    }

    loadMinerTags();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadMinerTags();
    });

    const handleProfileChanged = () => {
      loadMinerTags();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [minerAddresses]);

  return (
    <div
      className={cn('overflow-x-auto overflow-y-hidden bg-white', (hasFullPage || pushedBlocks.length > blocks.length) && 'pushed-table-viewport')}
      style={
        {
          '--pushed-table-bottom-trim': '0.35rem',
          '--pushed-table-header-height': '2.75rem',
          '--pushed-table-visible-rows': blocks.length,
          '--pushed-table-row-height': '2.8125rem',
        } as React.CSSProperties
      }
    >
      <table className="data-table evm-block-table min-w-[1040px] table-fixed">
        <colgroup>
          <col className="w-[105px]" />
          <col className="w-[95px]" />
          <col className="w-[75px]" />
          <col className="w-[245px]" />
          <col className="w-[180px]" />
          <col className="w-[160px]" />
          <col className="w-[180px]" />
        </colgroup>
        <thead className="relative z-10 bg-white">
          <tr>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Block</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Age</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Txn</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Miner</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Gas Used</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Gas Limit</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Base Fee</th>
          </tr>
        </thead>
        <tbody
          key={liveInsertAnimationKey}
          className={cn(pushedBlocks.some((block) => block.phase !== 'stable') ? 'pushed-table-list-moving' : liveInsertAnimationKey > 0 && 'evm-block-table-live-insert')}
        >
          {pushedBlocks.map(({ item: block, key, phase }) => (
            <tr key={key} className={cn('evm-block-table-row', `pushed-table-row-${phase}`)}>
              <td className="px-4 py-2.5 text-[14px] leading-6 tabular-nums">
                <Link prefetch={false} className="font-medium text-sky-600 hover:text-sky-700" href={`${hrefPrefix}/${block.height}`}>
                  {block.height}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-600 tabular-nums">
                <RelativeTime timestampMs={block.timestampMs} />
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 font-medium text-sky-600 tabular-nums">{block.txCount}</td>
              <td className="px-4 py-2.5 text-[14px] leading-6">
                <AddressLink
                  address={block.miner}
                  href={`/evm/address/${block.miner}`}
                  label={nameTagsByAddress[block.miner] ?? block.minerLabel}
                  className="font-medium text-sky-600 hover:text-sky-700"
                />
              </td>
              <td className="truncate px-4 py-2.5 text-[14px] leading-6 tabular-nums text-slate-700">
                {block.gasUsedLabel} <span className="text-slate-500">({block.gasUsedPercent})</span>
              </td>
              <td className="truncate px-4 py-2.5 text-[14px] leading-6 tabular-nums text-slate-700">{block.gasLimitLabel}</td>
              <td className="truncate px-4 py-2.5 text-[14px] leading-6 tabular-nums text-slate-700">{block.baseFeeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
