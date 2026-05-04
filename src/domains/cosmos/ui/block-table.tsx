import Link from 'next/link';
import { useCallback } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
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
    gasUsedLabel?: string;
    blockSizeLabel?: string;
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
  const messages = useMessages();
  const { locale } = useLocale();
  const tableMessages = messages.cosmosBlockTable;
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
      <table className="data-table cosmos-block-table min-w-[1120px] table-fixed">
        <colgroup>
          <col className="w-[10%]" />
          <col className="w-[25%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[11%]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="relative z-10 bg-white">
          <tr>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.block}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.hash}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.age}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.txn}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.gasUsed}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.proposer}</th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{tableMessages.signatures}</th>
          </tr>
        </thead>
        <tbody
          key={liveInsertAnimationKey}
          className={cn(pushedBlocks.some((block) => block.phase !== 'stable') ? 'pushed-table-list-moving' : liveInsertAnimationKey > 0 && 'cosmos-block-table-live-insert')}
        >
          {pushedBlocks.map(({ item: block, key, phase }) => (
            <tr key={key} className={cn('cosmos-block-table-row', `pushed-table-row-${phase}`)}>
              <td className="px-4 py-2.5 text-[14px] leading-6">
                <Link prefetch={false} href={`${hrefPrefix}/${block.height}`}>
                  <span className="font-medium text-sky-600 hover:text-sky-700">{block.height}</span>
                </Link>
              </td>
              <td className="truncate px-4 py-2.5 font-mono text-[14px] leading-6 text-slate-600" title={block.hash}>
                {block.hashLabel}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-600 tabular-nums">
                <RelativeTime timestampMs={block.timestampMs} />
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 font-medium tabular-nums">
                <Link prefetch={false} className="text-sky-600 hover:text-sky-700" href={`${hrefPrefix}/${block.height}?tab=transactions`}>
                  {block.txCountLabel}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-600 tabular-nums">
                {translateRuntimeText(block.gasUsedLabel ?? block.blockSizeLabel ?? tableMessages.gasFallback, locale)}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700">
                <Link
                  prefetch={false}
                  className="block truncate font-medium text-sky-600 hover:text-sky-700"
                  href={block.proposerOperatorAddress ? `/cosmos/validator/${block.proposerOperatorAddress}` : '/cosmos/validators'}
                >
                  {translateRuntimeText(block.proposerLabel, locale)}
                </Link>
              </td>
              <td className="truncate px-4 py-2.5 text-[14px] leading-6 text-slate-700">{translateRuntimeText(block.signaturesLabel, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
