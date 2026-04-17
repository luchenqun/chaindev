import Link from 'next/link';
import { RelativeTime } from '@/components/relative-time';

type BlockTableProps = {
  blocks: Array<{
    height: string;
    hash: string;
    hashLabel: string;
    proposer: string;
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
};

export function CosmosBlockTable({ blocks, hrefPrefix }: BlockTableProps) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="data-table">
        <thead>
          <tr>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Block
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Age
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Txn
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Proposer
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Proposer Address
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Signatures
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              Size
            </th>
            <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">
              App Hash
            </th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.height} className="border-t border-slate-200">
              <td className="px-4 py-2.5 text-[14px] leading-6">
                <Link href={`${hrefPrefix}/${block.height}`}>
                  <span className="font-medium text-sky-600 hover:text-sky-700">
                    #{block.height}
                  </span>
                </Link>
                <div
                  className="text-[13px] leading-5 text-slate-500"
                  title={block.hash}
                >
                  {block.hashLabel}
                </div>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-600 tabular-nums">
                <div>
                  <RelativeTime timestampMs={block.timestampMs} />
                </div>
                <div className="text-[13px] leading-5 text-slate-500">
                  {block.timeLabel}
                </div>
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 font-medium text-sky-600 tabular-nums">
                {block.txCountLabel}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700">
                {block.proposerLabel}
              </td>
              <td
                className="px-4 py-2.5 text-[14px] leading-6 font-mono text-slate-600"
                title={block.proposer}
              >
                {block.proposerAddressLabel}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700">
                {block.signaturesLabel}
              </td>
              <td className="px-4 py-2.5 text-[14px] leading-6 text-slate-700 tabular-nums">
                {block.blockSizeLabel}
              </td>
              <td
                className="px-4 py-2.5 text-[14px] leading-6 font-mono text-slate-600"
                title={block.appHash}
              >
                {block.appHashLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
