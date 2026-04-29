import Link from 'next/link';
import { useCallback } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { cn } from '@/lib/utils';
import { usePushedListItems } from '@/platform/home/use-pushed-list-items';

type BlockTableProps = {
  blocks: Array<{
    height: string;
    hash: string;
    hashLabel: string;
    proposer: string;
    proposerOperatorAddress: string | null;
    proposerLabel: string;
    proposerAddressLabel: string;
    txCountLabel: string;
    blockSizeLabel: string;
    appHash: string;
    appHashLabel: string;
    signaturesLabel: string;
    timeLabel: string;
    timestampMs: number | null;
  }>;
  hrefPrefix: string;
  liveInsertAnimationKey?: number;
  pushAnimationEnabled?: boolean;
  maxVisibleItems?: number;
};

export function CosmosBlockTable({ blocks, hrefPrefix, liveInsertAnimationKey = 0, pushAnimationEnabled = false, maxVisibleItems = DEFAULT_TABLE_PAGE_SIZE }: BlockTableProps) {
  const getBlockKey = useCallback((block: BlockTableProps['blocks'][number]) => `${block.height}-${block.hash}`, []);
  const pushedBlocks = usePushedListItems(blocks, getBlockKey, pushAnimationEnabled, maxVisibleItems, false);
  const hasFullPage = blocks.length >= maxVisibleItems;

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
      <table className="data-table cosmos-block-table">
        <thead className="relative z-10 bg-white">
          <tr>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Block</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Hash</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Age</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Txn</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Proposer</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Signatures</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Size</th>
          </tr>
        </thead>
        <tbody
          key={liveInsertAnimationKey}
          className={cn(
            pushedBlocks.some((block) => block.phase !== 'stable') ? 'pushed-table-list-moving' : liveInsertAnimationKey > 0 && 'cosmos-block-table-live-insert',
          )}
        >
          {pushedBlocks.map(({ item: block, key, phase }) => (
            <tr key={key} className={cn('cosmos-block-table-row', `pushed-table-row-${phase}`)}>
              <td className="px-4 py-2.5 text-[14px] leading-6">
                <Link prefetch={false} href={`${hrefPrefix}/${block.height}`}>
                  <span className="font-medium text-sky-600 hover:text-sky-700">#{block.height}</span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 font-mono text-slate-600" title={block.hash}>
                {block.hashLabel}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-600 tabular-nums">
                <RelativeTime timestampMs={block.timestampMs} />
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 font-medium text-sky-600 tabular-nums">{block.txCountLabel}</td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700">
                <Link prefetch={false}
                  className="font-medium text-sky-600 hover:text-sky-700"
                  href={block.proposerOperatorAddress ? `/cosmos/validator/${block.proposerOperatorAddress}` : '/cosmos/validators'}
                >
                  {block.proposerLabel}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700">{block.signaturesLabel}</td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700 tabular-nums">{block.blockSizeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
