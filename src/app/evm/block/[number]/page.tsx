'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconLanguage, IconMinus, IconPlus } from '@tabler/icons-react';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { RelativeTime } from '@/components/relative-time';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { resolvePreferredAddressLabel, resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { subscribeEvmContractRegistry } from '@/domains/evm/client/contract-registry';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { getEvmBlockByNumberDirect } from '@/domains/evm/client/queries';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { TransactionHashCell, TransactionMethodBadge, TransactionPreviewButton } from '@/domains/evm/ui/transaction-list-cells';

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{translateRuntimeText(label, locale)}</dt>
      <dd className={mono ? 'self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono' : 'self-start text-sm text-slate-900'}>{value}</dd>
    </div>
  );
}

function DetailRowWithAction({ label, value, action, mono = false }: { label: string; value: React.ReactNode; action: React.ReactNode; mono?: boolean }) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="flex items-center gap-0.5 text-sm font-medium text-slate-500">
        <span>{translateRuntimeText(label, locale)}</span>
        {action}
      </dt>
      <dd className={mono ? 'self-start break-all whitespace-pre-wrap text-left text-sm text-slate-900 mono' : 'self-start text-left text-sm text-slate-900'}>{value}</dd>
    </div>
  );
}

function DetailRowBlockHeight({
  label,
  height,
  canOpenPrevious,
  previousBlockNumber,
  onOpenPrevious,
  onOpenNext,
}: {
  label: string;
  height: string;
  canOpenPrevious: boolean;
  previousBlockNumber: number;
  onOpenPrevious: () => void;
  onOpenNext: () => void;
}) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{translateRuntimeText(label, locale)}</dt>
      <dd className="flex flex-wrap items-center gap-2 self-start text-sm text-slate-900">
        <span>{height}</span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canOpenPrevious}
          onClick={onOpenPrevious}
          aria-label={label}
        >
          <IconChevronLeft className="size-3" stroke={2} />
        </button>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800"
          onClick={onOpenNext}
          aria-label={label}
        >
          <IconChevronRight className="size-3" stroke={2} />
        </button>
      </dd>
    </div>
  );
}

function DetailGroup({ children, separated = false }: { children: React.ReactNode; separated?: boolean }) {
  return <div className={separated ? 'border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0' : 'pb-2.5 last:pb-0'}>{children}</div>;
}

function decodeHexToAscii(value: string) {
  if (!value.startsWith('0x')) {
    return value;
  }

  const hex = value.slice(2);

  if (!hex || hex.length % 2 !== 0) {
    return null;
  }

  let output = '';

  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);

    if (Number.isNaN(byte)) {
      return null;
    }

    if (byte === 0) {
      continue;
    }

    output += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
  }

  return output || null;
}

export default function EvmBlockDetailPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const blockMessages = messages.evmBlocksPage;
  const router = useRouter();
  const params = useParams<{ number: string }>();
  const searchParams = useSearchParams();
  const number = params.number;
  const isValid = useMemo(() => /^\d+$/.test(number), [number]);
  const initialActiveTab = searchParams.get('tab') === 'transactions' ? 'transactions' : 'overview';
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getEvmBlockByNumberDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'json'>(initialActiveTab);
  const [extraDataView, setExtraDataView] = useState<'hex' | 'ascii'>('hex');
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [decodeVersion, setDecodeVersion] = useState(0);
  const visibleAddresses = useMemo(
    () => [...new Set(block?.transactions.flatMap((transaction) => [transaction.from, ...(transaction.interactedWith ? [transaction.interactedWith] : transaction.to ? [transaction.to] : [])]) ?? [])],
    [block],
  );
  const decodedMethodLabelByHash = useMemo(() => {
    void decodeVersion;

    return Object.fromEntries(
      (block?.transactions ?? []).map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [block, decodeVersion]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmBlockByNumberDirect(BigInt(number));

        if (!cancelled) {
          setBlock(next);
          setErrorMessage(null);
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
  }, [isValid, number]);

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, []);

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

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{messages.common.invalidBlockNumberTitle}</h1>
          <p>{messages.common.invalidBlockNumberDescription}</p>
        </main>
      </AppShell>
    );
  }

  if (!block) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-20" groups={3} rowsPerGroup={4} />
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

  const previousBlockNumber = Number(block.height) - 1;
  const canOpenPrevious = previousBlockNumber >= 0;
  const decodedExtraData = decodeHexToAscii(block.extraData);
  const hasTransactions = block.transactions.length > 0;
  const currentBlock = block;
  const resolvedActiveTab = activeTab === 'transactions' && !hasTransactions ? 'overview' : activeTab;
  void currentBlock;

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.common.block}</h1>
            <span className="text-sm font-medium text-slate-500">{block.height}</span>
          </div>
        </div>

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
            {hasTransactions ? `${messages.labels.transactions} (${block.transactions.length})` : messages.labels.transactions}
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
                      previousBlockNumber={previousBlockNumber}
                      onOpenPrevious={() => {
                        if (canOpenPrevious) {
                          router.push(`/evm/block/${previousBlockNumber}`);
                        }
                      }}
                      onOpenNext={() => router.push(`/evm/block/${Number(block.height) + 1}`)}
                    />
                    <DetailRow label={blockMessages.status} value={<span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{blockMessages.confirmed}</span>} />
                    <DetailRow
                      label={messages.common.timestamp}
                      value={
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span>
                            <RelativeTime timestampMs={block.timestamp} />
                          </span>
                          <span className="text-slate-500">({translateRuntimeText(block.timestampLabel, locale)})</span>
                        </span>
                      }
                    />
                    <DetailRow
                      label={messages.labels.transactions}
                      value={
                        hasTransactions ? (
                          <button type="button" className="font-medium text-sky-600 transition hover:text-sky-700" onClick={() => setActiveTab('transactions')}>
                            {block.txCount} {messages.labels.transactions.toLowerCase()}
                          </button>
                        ) : (
                          `${block.txCount} ${messages.labels.transactions.toLowerCase()}`
                        )
                      }
                    />
                    <DetailRow
                      label={messages.common.miner}
                      value={
                        <AddressLink
                          address={block.miner}
                          href={`/evm/address/${block.miner}`}
                          label={nameTagsByAddress[block.miner] ?? block.miner}
                          className="font-medium text-sky-600 hover:text-sky-700 mono"
                          tooltipClassName="max-w-[90vw]"
                        />
                      }
                    />
                    <DetailRow
                      label={blockMessages.withdrawals}
                      value={
                        block.withdrawalsCount
                          ? translateRuntimeText(`${block.withdrawalsCount} ${blockMessages.withdrawals.toLowerCase()}`, locale)
                          : translateRuntimeText(`0 ${blockMessages.withdrawals.toLowerCase()}`, locale)
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label={blockMessages.blockSize} value={translateRuntimeText(block.sizeLabel, locale)} />
                    <DetailRow
                      label={blockMessages.gasUsed}
                      value={
                        <span>
                          {translateRuntimeText(block.gasUsedLabel, locale)} <span className="text-slate-500">({translateRuntimeText(block.gasUsedPercent, locale)})</span>
                        </span>
                      }
                    />
                    <DetailRow label={messages.common.gasLimit} value={translateRuntimeText(block.gasLimitLabel, locale)} />
                    <DetailRow label={blockMessages.baseFeePerGas} value={translateRuntimeText(block.baseFeeLabel, locale)} />
                    <DetailRow label={blockMessages.difficulty} value={translateRuntimeText(block.difficultyLabel, locale)} />
                    <DetailRow label={blockMessages.totalDifficulty} value={translateRuntimeText(block.totalDifficultyLabel, locale)} />
                    <DetailRow label={blockMessages.blobGasUsed} value={translateRuntimeText(block.blobGasUsedLabel, locale)} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRowWithAction
                      label={messages.common.extraData}
                      action={
                        <button
                          type="button"
                          className="inline-flex size-4 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700"
                          onClick={() => setExtraDataView((current) => (current === 'hex' ? 'ascii' : 'hex'))}
                          aria-label={extraDataView === 'hex' ? messages.common.convertExtraDataToAscii : messages.common.showExtraDataAsHex}
                          title={extraDataView === 'hex' ? messages.common.hexToAscii : messages.common.showHex}
                        >
                          <IconLanguage className="size-3.5" stroke={1.8} />
                        </button>
                      }
                      value={extraDataView === 'hex' ? translateRuntimeText(block.extraData, locale) : (decodedExtraData ?? messages.common.asciiUnavailable)}
                      mono
                    />
                  </dl>
                </DetailGroup>
              </div>
            </section>

            <section className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                {!showMoreDetails ? (
                  <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
                    <dt className="text-sm font-medium text-slate-500">{blockMessages.moreDetails}</dt>
                    <dd>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                        onClick={() => setShowMoreDetails(true)}
                      >
                        <IconPlus className="size-4" stroke={2} />
                        {blockMessages.showMore}
                      </button>
                    </dd>
                  </div>
                ) : (
                  <div className="mt-0 pt-0">
                    <dl>
                      <DetailRow label={messages.common.hash} value={block.hash} mono />
                      <DetailRow
                        label={messages.common.parentHash}
                        value={
                          canOpenPrevious ? (
                            <Link className="text-sky-600 hover:text-sky-700 mono" href={`/evm/block/${previousBlockNumber}`}>
                              {block.parentHash}
                            </Link>
                          ) : (
                            block.parentHash
                          )
                        }
                        mono
                      />
                      <DetailRow label={messages.common.stateRoot} value={translateRuntimeText(block.stateRoot, locale)} mono />
                      <DetailRow label={blockMessages.transactionsRoot} value={translateRuntimeText(block.transactionsRoot, locale)} mono />
                      <DetailRow label={messages.common.receiptsRoot} value={translateRuntimeText(block.receiptsRoot, locale)} mono />
                      <DetailRow label={blockMessages.withdrawalsRoot} value={translateRuntimeText(block.withdrawalsRoot, locale)} mono />
                      <DetailRow label={messages.common.nonce} value={translateRuntimeText(block.nonce, locale)} mono />
                      <DetailRow label={messages.common.sha3Uncles} value={translateRuntimeText(block.sha3Uncles, locale)} mono />
                    </dl>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
                        <dt className="text-sm font-medium text-slate-500">{blockMessages.moreDetails}</dt>
                        <dd>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                            onClick={() => setShowMoreDetails(false)}
                          >
                            <IconMinus className="size-4" stroke={2} />
                            {blockMessages.showLess}
                          </button>
                        </dd>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : resolvedActiveTab === 'transactions' ? (
          <div className="p-5">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">{blockMessages.totalTransactionsFound.replace('{count}', String(block.transactions.length))}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.hash}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.method}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.block}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.age}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.from}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.to}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{blockMessages.amount}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{blockMessages.txnFee}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.transactions.map((transaction) => {
                      const decodedMethodLabel = decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel;

                      return (
                        <tr key={transaction.hash} className="border-t border-slate-200">
                          <td className="px-5 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <TransactionPreviewButton transaction={transaction} methodLabel={decodedMethodLabel} />
                              <TransactionHashCell {...transaction} />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm">
                            <TransactionMethodBadge methodLabel={decodedMethodLabel} />
                          </td>
                          <td className="px-5 py-3 text-sm tabular-nums">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-700">
                            <RelativeTime timestampMs={transaction.timestampMs} />
                          </td>
                          <td className="px-5 py-3 text-sm">
                            <AddressLink
                              address={transaction.from}
                              href={`/evm/address/${transaction.from}`}
                              label={resolvePreferredAddressLabel(transaction.from, {
                                nameTagsByAddress,
                                fallbackLabel: transaction.fromLabel,
                              })}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          </td>
                          <td className="px-5 py-3 text-sm">
                            {transaction.interactedWith ? (
                              <AddressLink
                                address={transaction.interactedWith}
                                href={`/evm/address/${transaction.interactedWith}`}
                                label={resolvePreferredToAddressLabel(transaction.interactedWith, {
                                  nameTagsByAddress,
                                  fallbackLabel: transaction.interactedWithLabel ?? transaction.toLabel,
                                })}
                                className="font-medium text-sky-600 hover:text-sky-700"
                              />
                            ) : (
                              <span className="text-slate-500">{translateRuntimeText(transaction.toLabel, locale)}</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">{translateRuntimeText(transaction.valueLabel, locale)}</td>
                          <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                            {transaction.feeLabel ? translateRuntimeText(transaction.feeLabel, locale) : <span className="text-slate-400">--</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <JsonViewPanel value={block.rawJson as object} />
        )}
      </main>
    </AppShell>
  );
}
