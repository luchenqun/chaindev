'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { AddressLink } from '@/domains/evm/ui/address-link';

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
};

export function EvmBlockTable({ blocks, hrefPrefix }: BlockTableProps) {
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const minerAddresses = useMemo(() => [...new Set(blocks.map((block) => block.miner))], [blocks]);

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
    <div className="overflow-x-auto bg-white">
      <table className="data-table">
        <thead>
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
        <tbody>
          {blocks.map((block) => (
            <tr key={block.height} className="border-t border-slate-200">
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
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700 tabular-nums">
                {block.gasUsedLabel} <span className="text-slate-500">({block.gasUsedPercent})</span>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700 tabular-nums">{block.gasLimitLabel}</td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700 tabular-nums">{block.baseFeeLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
