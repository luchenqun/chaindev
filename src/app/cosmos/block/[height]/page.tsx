'use client';

import JsonView from '@uiw/react-json-view';
import { IconChevronLeft, IconChevronRight, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { getCosmosBlockByHeightDirect } from '@/domains/cosmos/client/queries';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  CosmosDetailTag as DetailTag,
  COSMOS_JSON_VIEW_STYLE as JSON_VIEW_STYLE,
  formatTimestampWithSeconds,
} from '@/domains/cosmos/ui/detail-primitives';
import { AppShell } from '@/platform/layout/app-shell';

function DetailRowBlockHeight({
  height,
  canOpenPrevious,
  previousBlockHeight,
  onOpenPrevious,
  onOpenNext,
}: {
  height: string;
  canOpenPrevious: boolean;
  previousBlockHeight: number;
  onOpenPrevious: () => void;
  onOpenNext: () => void;
}) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">Block Height</dt>
      <dd className="flex flex-wrap items-center gap-2 self-start text-sm text-slate-900">
        <span>{height}</span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canOpenPrevious}
          onClick={onOpenPrevious}
          aria-label={`Open block ${previousBlockHeight}`}
        >
          <IconChevronLeft className="size-3" stroke={2} />
        </button>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800"
          onClick={onOpenNext}
          aria-label={`Open block ${Number(height) + 1}`}
        >
          <IconChevronRight className="size-3" stroke={2} />
        </button>
      </dd>
    </div>
  );
}

function CosmosBlockEventSection({
  title,
  summaryLabel,
  events,
}: {
  title: string;
  summaryLabel: string;
  events: Array<{
    type: string;
    attributes: Array<{
      key: string;
      value: string;
      indexed: boolean;
    }>;
  }>;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const keyColumnClassName = 'w-[180px] min-w-[180px] whitespace-nowrap text-left';

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy(value: string, copyId: string) {
    await copyText(value);
    setCopiedKey(copyId);

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopiedKey((current) => (current === copyId ? null : current));
      timeoutRef.current = null;
    }, 1600);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{summaryLabel}</p>
      </div>

      {events.length ? (
        <div className="grid gap-3">
          {events.map((event, index) => {
            const visibleAttributes = event.attributes.filter((attribute) => attribute.key !== 'mode');
            const showIndexedColumn = visibleAttributes.some((attribute) => !attribute.indexed);

            return (
              <article key={`${event.type}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <DetailTag>{`${index + 1}. ${event.type}`}</DetailTag>
                  <span className="text-xs text-slate-500">
                    {visibleAttributes.length} attribute
                    {visibleAttributes.length === 1 ? '' : 's'}
                  </span>
                </div>

                {visibleAttributes.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full w-max border-collapse whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className={`border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 ${keyColumnClassName}`}>Key</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Value</th>
                          {showIndexedColumn ? <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Indexed</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAttributes.map((attribute, attributeIndex) => {
                          const copyId = `${event.type}-${index}-${attribute.key}-${attributeIndex}`;

                          return (
                            <tr key={copyId} className="border-t border-slate-200">
                              <td className={`px-3 py-2 text-sm text-slate-700 mono ${keyColumnClassName}`}>{attribute.key || 'Unknown'}</td>
                              <td className="px-3 py-2 text-sm text-slate-900">
                                <div className="flex items-start gap-2">
                                  <span className="mono whitespace-pre-wrap break-all">{attribute.value || 'Empty'}</span>
                                  <span className="relative inline-flex">
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition hover:text-sky-600"
                                      aria-label="Copy value"
                                      onClick={() => void handleCopy(attribute.value || '', copyId)}
                                    >
                                      <IconCopy className="size-3.5" stroke={1.8} />
                                    </button>
                                    <span
                                      className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
                                        copiedKey === copyId ? 'opacity-100' : 'opacity-0'
                                      }`}
                                    >
                                      <span className="block whitespace-nowrap">Copied!</span>
                                    </span>
                                  </span>
                                </div>
                              </td>
                              {showIndexedColumn ? <td className="px-3 py-2 text-sm text-slate-700">{attribute.indexed ? 'true' : 'false'}</td> : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">No attributes returned.</div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No events returned.</div>
      )}
    </section>
  );
}

export default function CosmosBlockDetailPage() {
  const router = useRouter();
  const params = useParams<{ height: string }>();
  const height = params.height;
  const isValid = useMemo(() => /^\d+$/.test(height), [height]);
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getCosmosBlockByHeightDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'events' | 'commits' | 'json'>('overview');

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosBlockByHeightDirect(Number(height), currentTxPage, 20);

        if (!cancelled) {
          setBlock(next);
          setErrorMessage(null);

          if (next.transactionsPage.page !== currentTxPage) {
            setCurrentTxPage(next.transactionsPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setBlock(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos block.');
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [currentTxPage, height, isValid]);

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid block height</h1>
          <p>The block height must be a non-negative integer.</p>
        </main>
      </AppShell>
    );
  }

  if (!block) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-24" groups={3} rowsPerGroup={4} secondaryCard={true} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load block</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasTransactions = block.transactionsPage.totalCount > 0;
  const resolvedActiveTab = activeTab === 'transactions' && !hasTransactions ? 'overview' : activeTab;
  const previousBlockHeight = Math.max(1, Number(block.height) - 1);
  const canOpenPrevious = Number(block.height) > 1;
  const visibleCommitSignatures = block.commitSignatures.slice(0, 12);

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'overview' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              !hasTransactions ? 'cursor-not-allowed bg-slate-100 text-slate-300' : resolvedActiveTab === 'transactions' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
            onClick={() => {
              if (hasTransactions) {
                setActiveTab('transactions');
              }
            }}
            disabled={!hasTransactions}
            aria-disabled={!hasTransactions}
          >
            {hasTransactions ? `Transactions (${block.transactionsPage.totalCount})` : 'Transactions'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'events' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('events')}
          >
            {`Events (${block.eventsCount})`}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'commits' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('commits')}
          >
            {`Commits (${block.signaturesCount})`}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === 'overview' ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                <DetailGroup>
                  <dl>
                    <DetailRowBlockHeight
                      height={block.height}
                      canOpenPrevious={canOpenPrevious}
                      previousBlockHeight={previousBlockHeight}
                      onOpenPrevious={() => {
                        if (canOpenPrevious) {
                          router.push(`/cosmos/block/${previousBlockHeight}`);
                        }
                      }}
                      onOpenNext={() => router.push(`/cosmos/block/${Number(block.height) + 1}`)}
                    />
                    <DetailRow label="Status" value={<DetailTag tone="success">Confirmed</DetailTag>} />
                    <DetailRow
                      label="Age"
                      value={
                        block.timestampMs ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              <RelativeTime timestampMs={block.timestampMs} />
                            </span>
                            <span className="text-slate-400">{`(${formatTimestampWithSeconds(block.timestamp, 'Unavailable')})`}</span>
                          </div>
                        ) : (
                          block.timeLabel
                        )
                      }
                    />
                    <DetailRow label="Transactions" value={block.txCountLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup>
                  <dl>
                    <DetailRow label="Hash" value={block.hash} mono />
                    <DetailRow
                      label="Proposer"
                      value={
                        block.proposerOperatorAddress ? (
                          <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${block.proposerOperatorAddress}`}>
                            {block.proposerLabel}
                          </Link>
                        ) : (
                          block.proposerLabel
                        )
                      }
                    />
                    <DetailRow label="Proposer Address" value={block.proposer} mono />
                    <DetailRow label="App Hash" value={block.appHash} mono />
                  </dl>
                </DetailGroup>

                <DetailGroup>
                  <dl>
                    <DetailRow label="Chain ID" value={block.chainId} />
                    <DetailRow label="Block Size" value={block.blockSizeLabel} />
                    <DetailRow label="Gas Used / Wanted" value={`${block.gasUsedLabel} / ${block.gasWantedLabel}`} />
                    <DetailRow label="Signatures" value={block.signaturesLabel} />
                  </dl>
                </DetailGroup>
              </div>
            </section>
          </>
        ) : resolvedActiveTab === 'transactions' ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">
                  {block.transactionsPage.totalCount} transaction
                  {block.transactionsPage.totalCount === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Page {block.transactionsPage.page} of {block.transactionsPage.totalPages} for block #{block.height}.
                </p>
              </div>
              {block.transactionsPage.totalPages > 1 ? (
                <PaginationControls
                  page={block.transactionsPage.page}
                  totalPages={block.transactionsPage.totalPages}
                  hasPreviousPage={block.transactionsPage.hasPreviousPage}
                  hasNextPage={block.transactionsPage.hasNextPage}
                  onPageChange={setCurrentTxPage}
                />
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Transaction Hash</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Sender</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Messages</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Gas Used / Wanted</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Fee</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {block.transactionsPage.items.map((transaction) => (
                    <tr key={transaction.hash} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${transaction.hash}`}>
                          {transaction.hashLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{transaction.type}</td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.sender === 'Unknown' ? (
                          <span className="text-slate-500">Unknown</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {transaction.senderLabel}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{transaction.messageCount}</td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.gasUsedLabel}/{transaction.gasWantedLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{transaction.feeLabel}</td>
                      <td className="px-5 py-3 text-sm">
                        <DetailTag tone={transaction.status === 'success' ? 'success' : 'danger'}>{transaction.statusLabel}</DetailTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : resolvedActiveTab === 'events' ? (
          <div className="grid gap-4">
            <CosmosBlockEventSection title="Begin Block Events" summaryLabel={block.beginBlockEventsLabel} events={block.beginBlockEvents} />
            <CosmosBlockEventSection title="End Block Events" summaryLabel={block.endBlockEventsLabel} events={block.endBlockEvents} />
          </div>
        ) : resolvedActiveTab === 'commits' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">Commits</p>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {visibleCommitSignatures.length} of {block.signaturesCount} signatures.
                </p>
              </div>
            </div>

            {visibleCommitSignatures.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Moniker</th>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Validator</th>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCommitSignatures.map((signature) => (
                      <tr key={`${signature.validatorAddress}-${signature.flagLabel}`} className="border-t border-slate-200">
                        <td className="px-4 py-2.5 text-sm text-slate-900">
                          {signature.operatorAddress ? (
                            <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${signature.operatorAddress}`}>
                              {signature.moniker}
                            </Link>
                          ) : (
                            signature.moniker
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600 mono">{signature.validatorAddress}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <DetailTag tone={signature.hasSignature ? 'success' : 'neutral'}>{signature.flagLabel}</DetailTag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No commit signatures returned.</div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView
              className="json-view-wrap"
              value={block.rawJson as object}
              collapsed={false}
              shortenTextAfterLength={0}
              enableClipboard={false}
              displayDataTypes={false}
              displayObjectSize={false}
              style={JSON_VIEW_STYLE}
            />
          </section>
        )}
      </main>
      <style jsx global>{`
        .json-view-wrap .w-rjv-value {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>
    </AppShell>
  );
}
