'use client';

import { IconChevronLeft, IconChevronRight, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { getCosmosBlockByHeightDirect } from '@/domains/cosmos/client/queries';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  CosmosDetailTag as DetailTag,
  formatTimestampWithSeconds,
} from '@/domains/cosmos/ui/detail-primitives';
import { CosmosTransactionHashCell, CosmosTransactionPreviewButton } from '@/domains/cosmos/ui/transaction-list-cells';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

function DetailRowBlockHeight({
  label,
  height,
  canOpenPrevious,
  previousBlockHeight,
  onOpenPrevious,
  onOpenNext,
}: {
  label: string;
  height: string;
  canOpenPrevious: boolean;
  previousBlockHeight: number;
  onOpenPrevious: () => void;
  onOpenNext: () => void;
}) {
  const messages = useMessages();
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 self-start text-sm text-slate-900">
        <span>{height}</span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canOpenPrevious}
          onClick={onOpenPrevious}
          aria-label={messages.common.openBlock.replace('{height}', String(previousBlockHeight))}
        >
          <IconChevronLeft className="size-3" stroke={2} />
        </button>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800"
          onClick={onOpenNext}
          aria-label={messages.common.openBlock.replace('{height}', String(Number(height) + 1))}
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
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.cosmosTxDetail;
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
        <p className="mt-1 text-sm text-slate-500">{translateRuntimeText(summaryLabel, locale)}</p>
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
                    {txMessages.attributeCount.replace('{count}', String(visibleAttributes.length))}
                  </span>
                </div>

                {visibleAttributes.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full w-max border-collapse whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className={`border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 ${keyColumnClassName}`}>{txMessages.key}</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">{txMessages.value}</th>
                          {showIndexedColumn ? <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">{txMessages.indexed}</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAttributes.map((attribute, attributeIndex) => {
                          const copyId = `${event.type}-${index}-${attribute.key}-${attributeIndex}`;

                          return (
                            <tr key={copyId} className="border-t border-slate-200">
                              <td className={`px-3 py-2 text-sm text-slate-700 mono ${keyColumnClassName}`}>
                                {translateRuntimeText(attribute.key || txMessages.unknown, locale)}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-900">
                                <div className="flex items-start gap-2">
                                  <span className="mono whitespace-pre-wrap break-all">{attribute.value || txMessages.emptyValue}</span>
                                  <span className="relative inline-flex">
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition hover:text-sky-600"
                                      aria-label={txMessages.copyEventValue}
                                      onClick={() => void handleCopy(attribute.value || '', copyId)}
                                    >
                                      <IconCopy className="size-3.5" stroke={1.8} />
                                    </button>
                                    <span
                                      className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
                                        copiedKey === copyId ? 'opacity-100' : 'opacity-0'
                                      }`}
                                    >
                                      <span className="block whitespace-nowrap">{messages.common.copied}</span>
                                    </span>
                                  </span>
                                </div>
                              </td>
                              {showIndexedColumn ? <td className="px-3 py-2 text-sm text-slate-700">{attribute.indexed ? txMessages.booleanTrue : txMessages.booleanFalse}</td> : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">{txMessages.noAttributes}</div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">{txMessages.noTransactionEvents}</div>
      )}
    </section>
  );
}

export default function CosmosBlockDetailPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.cosmosTxDetail;
  const router = useRouter();
  const params = useParams<{ height: string }>();
  const searchParams = useSearchParams();
  const height = params.height;
  const isValid = useMemo(() => /^\d+$/.test(height), [height]);
  const initialActiveTab = searchParams.get('tab') === 'transactions' ? 'transactions' : 'overview';
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getCosmosBlockByHeightDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'events' | 'commits' | 'json'>(initialActiveTab);

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
          setErrorMessage(error instanceof Error ? error.message : messages.common.failedToLoadBlockTitle);
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
          <h1>{messages.common.invalidBlockHeightTitle}</h1>
          <p>{messages.common.invalidBlockHeightDescription}</p>
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
          <h1>{messages.common.failedToLoadBlockTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
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
            {txMessages.overview}
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
            {hasTransactions ? `${messages.labels.transactions} (${block.transactionsPage.totalCount})` : messages.labels.transactions}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'events' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('events')}
          >
            {`${txMessages.events} (${block.eventsCount})`}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'commits' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('commits')}
          >
            {`${messages.common.commits} (${block.signaturesCount})`}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            {txMessages.json}
          </button>
        </div>

        {resolvedActiveTab === 'overview' ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                <DetailGroup>
                  <dl>
                    <DetailRowBlockHeight
                      label={messages.homeMetrics.blockHeight}
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
                    <DetailRow label={txMessages.status} value={<DetailTag tone="success">{messages.evmBlocksPage.confirmed}</DetailTag>} />
                    <DetailRow
                      label={messages.cosmosAccountDetail.age}
                      value={
                        block.timestampMs ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              <RelativeTime timestampMs={block.timestampMs} />
                            </span>
                            <span className="text-slate-400">{`(${formatTimestampWithSeconds(block.timestamp, messages.common.unavailable)})`}</span>
                          </div>
                        ) : (
                          block.timeLabel
                        )
                      }
                    />
                    <DetailRow label={messages.labels.transactions} value={block.txCountLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup>
                  <dl>
                    <DetailRow label={messages.cosmosBlockTable.hash} value={block.hash} mono />
                    <DetailRow
                      label={messages.cosmosBlockTable.proposer}
                      value={
                        block.proposerOperatorAddress ? (
                          <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${block.proposerOperatorAddress}`}>
                            {translateRuntimeText(block.proposerLabel, locale)}
                          </Link>
                        ) : (
                          translateRuntimeText(block.proposerLabel, locale)
                        )
                      }
                    />
                    <DetailRow label={messages.cosmosBlockTable.proposerAddress} value={block.proposer} mono />
                    <DetailRow label={messages.common.appHash} value={block.appHash} mono />
                  </dl>
                </DetailGroup>

                <DetailGroup>
                  <dl>
                    <DetailRow label={messages.homeMetrics.chainId} value={block.chainId} />
                    <DetailRow label={messages.evmBlocksPage.blockSize} value={translateRuntimeText(block.blockSizeLabel, locale)} />
                    <DetailRow
                      label={messages.cosmosAccountDetail.gasUsedWanted}
                      value={`${translateRuntimeText(block.gasUsedLabel, locale)} / ${translateRuntimeText(block.gasWantedLabel, locale)}`}
                    />
                    <DetailRow label={messages.common.commits} value={translateRuntimeText(block.signaturesLabel, locale)} />
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
                  {messages.evmBlocksPage.totalTransactionsFound.replace('{count}', String(block.transactionsPage.totalCount))}
                </p>
              </div>
              {block.transactionsPage.totalPages > 1 ? (
                <PaginationControls
                  page={block.transactionsPage.page}
                  totalPages={block.transactionsPage.totalPages}
                  hasPreviousPage={block.transactionsPage.hasPreviousPage}
                  hasNextPage={block.transactionsPage.hasNextPage}
                  plain
                  onPageChange={setCurrentTxPage}
                />
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.hash}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.type}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.block}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.age}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.from}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.gasUsedWanted}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.fee}</th>
                  </tr>
                </thead>
                <tbody>
                  {block.transactionsPage.items.map((transaction) => (
                    <tr key={transaction.hash} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="-ml-1 flex items-center gap-1.5">
                          <CosmosTransactionPreviewButton transaction={transaction} />
                          <CosmosTransactionHashCell hash={transaction.hash} hashLabel={transaction.hashLabel} status={transaction.status} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/block/${transaction.height}`}>
                          {transaction.height}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={block.timestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.sender === txMessages.unknown ? (
                          <span className="text-slate-500">{translateRuntimeText(txMessages.unknown, locale)}</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {translateRuntimeText(transaction.senderLabel, locale)}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {translateRuntimeText(transaction.gasUsedLabel, locale)}/{translateRuntimeText(transaction.gasWantedLabel, locale)}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{translateRuntimeText(transaction.feeLabel, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : resolvedActiveTab === 'events' ? (
          <div className="grid gap-4">
            <CosmosBlockEventSection title={txMessages.beginBlockEvents} summaryLabel={block.beginBlockEventsLabel} events={block.beginBlockEvents} />
            <CosmosBlockEventSection title={txMessages.endBlockEvents} summaryLabel={block.endBlockEventsLabel} events={block.endBlockEvents} />
          </div>
        ) : resolvedActiveTab === 'commits' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{messages.common.commits}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {txMessages.commitsSummary
                    .replace('{visible}', String(visibleCommitSignatures.length))
                    .replace('{total}', String(block.signaturesCount))}
                </p>
              </div>
            </div>

            {visibleCommitSignatures.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.moniker}</th>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.operatorAddress}</th>
                      <th className="border-b border-slate-200 px-4 py-2.5 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosProposals.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCommitSignatures.map((signature) => (
                      <tr key={`${signature.validatorAddress}-${signature.flagLabel}`} className="border-t border-slate-200">
                        <td className="px-4 py-2.5 text-sm text-slate-900">
                          {signature.operatorAddress ? (
                            <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${signature.operatorAddress}`}>
                              {translateRuntimeText(signature.moniker, locale)}
                            </Link>
                          ) : (
                            translateRuntimeText(signature.moniker, locale)
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600 mono">{signature.validatorAddress}</td>
                        <td className="px-4 py-2.5 text-sm">
                          <DetailTag tone={signature.hasSignature ? 'success' : 'neutral'}>{translateRuntimeText(signature.flagLabel, locale)}</DetailTag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">{messages.common.commits} {messages.common.unavailable}</div>
            )}
          </section>
        ) : (
          <JsonViewPanel value={block.rawJson as object} />
        )}
      </main>
    </AppShell>
  );
}
