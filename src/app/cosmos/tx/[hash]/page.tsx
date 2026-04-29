'use client';

import { IconArrowsExchange, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { copyText } from '@/components/ui/copy-text';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { RelativeTime } from '@/components/relative-time';
import { getCosmosTxByHashDirect } from '@/domains/cosmos/client/queries';
import { formatCosmosAddressForDisplay, type CosmosAddressDisplayMode } from '@/domains/cosmos/ui/address-display';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  formatTimestampWithSeconds,
} from '@/domains/cosmos/ui/detail-primitives';
import { AppShell } from '@/platform/layout/app-shell';

function StatusBadge({ status, label }: { status: 'success' | 'failed'; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {label}
    </span>
  );
}

function TxEventsSection({
  events,
}: {
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
      {events.length ? (
        <div className="grid gap-3">
          {events.map((event, index) => {
            const showIndexedColumn = event.attributes.some((attribute) => !attribute.indexed);

            return (
              <article key={`${event.type}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{`${index + 1}. ${event.type}`}</span>
                  <span className="text-xs text-slate-500">
                    {event.attributes.length} attribute
                    {event.attributes.length === 1 ? '' : 's'}
                  </span>
                </div>

                {event.attributes.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full w-max border-collapse whitespace-nowrap">
                      <thead>
                        <tr>
                          <th className="w-[180px] min-w-[180px] border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Key</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Value</th>
                          {showIndexedColumn ? <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Indexed</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {event.attributes.map((attribute, attributeIndex) => (
                          <tr key={`${event.type}-${attribute.key}-${attributeIndex}`} className="border-t border-slate-200">
                            <td className="w-[180px] min-w-[180px] px-3 py-2 text-sm text-slate-700 mono">{attribute.key || 'Unknown'}</td>
                            <td className="px-3 py-2 text-sm text-slate-900">
                              <div className="flex items-start gap-2">
                                <span className="mono whitespace-pre-wrap break-all">{attribute.value || 'Empty'}</span>
                                <span className="relative inline-flex shrink-0">
                                  <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center text-slate-400 transition hover:text-sky-600"
                                    aria-label="Copy event value"
                                    onClick={() => void handleCopy(attribute.value || '', `${event.type}-${attribute.key}-${attributeIndex}`)}
                                  >
                                    <IconCopy className="size-3.5" stroke={1.8} />
                                  </button>
                                  <span
                                    className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
                                      copiedKey === `${event.type}-${attribute.key}-${attributeIndex}` ? 'opacity-100' : 'opacity-0'
                                    }`}
                                  >
                                    <span className="block whitespace-nowrap">Copied!</span>
                                  </span>
                                </span>
                              </div>
                            </td>
                            {showIndexedColumn ? <td className="px-3 py-2 text-sm text-slate-700">{attribute.indexed ? 'true' : 'false'}</td> : null}
                          </tr>
                        ))}
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
        <div className="empty-state">No transaction events returned.</div>
      )}
    </section>
  );
}

function TxMessagesSection({
  messages,
}: {
  messages: Array<{
    type: string;
    title: string;
    fields: Array<{
      key: string;
      value: string;
    }>;
  }>;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="mb-4">
        <p className="text-base font-semibold text-slate-900">Messages</p>
        <p className="mt-1 text-sm text-slate-500">Decoded from the transaction body returned by the active Cosmos REST endpoint.</p>
      </div>

      {messages.length ? (
        <div className="grid gap-4">
          {messages.map((message, index) => (
            <article key={`${message.type}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{message.title}</span>
                <span className="text-xs text-slate-500 mono">{message.type}</span>
              </div>

              {message.fields.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="w-[180px] min-w-[180px] border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Field</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left text-[12px] font-semibold text-slate-700">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {message.fields.map((field, fieldIndex) => (
                        <tr key={`${field.key}-${fieldIndex}`} className="border-t border-slate-200">
                          <td className="w-[180px] min-w-[180px] px-3 py-2 text-sm text-slate-700 mono">{field.key}</td>
                          <td className="px-3 py-2 text-sm text-slate-900 mono whitespace-pre-wrap break-all align-top">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No message fields returned.</div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No messages returned for this transaction.</div>
      )}
    </section>
  );
}

export default function CosmosTxPage() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash;
  const isValid = useMemo(() => /^[A-Fa-f0-9]{64}$/.test(hash), [hash]);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedSender, setCopiedSender] = useState(false);
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getCosmosTxByHashDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'json'>('overview');
  const [addressDisplayMode, setAddressDisplayMode] = useState<CosmosAddressDisplayMode>('bech32');
  const copyTimeoutRef = useRef<number | null>(null);
  const senderCopyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }

      if (senderCopyTimeoutRef.current != null) {
        window.clearTimeout(senderCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosTxByHashDirect(hash);

        if (!cancelled) {
          setTransaction(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTransaction(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos transaction.');
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [hash, isValid]);

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid transaction hash</h1>
          <p>The transaction hash must be a 32-byte hex string.</p>
        </main>
      </AppShell>
    );
  }

  if (!transaction) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-44" groups={3} rowsPerGroup={4} secondaryCard={false} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load transaction</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasEvents = transaction.eventsCount > 0;
  const resolvedActiveTab = activeTab === 'events' && !hasEvents ? 'overview' : activeTab;
  const transactionHash = transaction.hash;
  const displaySender = transaction.sender !== 'Unknown' ? formatCosmosAddressForDisplay(transaction.sender, addressDisplayMode) : null;

  async function handleCopyHash() {
    await copyText(transactionHash);
    setCopiedHash(true);

    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedHash(false);
      copyTimeoutRef.current = null;
    }, 1600);
  }

  async function handleCopySenderAddress() {
    if (!displaySender) {
      return;
    }

    await copyText(displaySender.full);
    setCopiedSender(true);

    if (senderCopyTimeoutRef.current != null) {
      window.clearTimeout(senderCopyTimeoutRef.current);
    }

    senderCopyTimeoutRef.current = window.setTimeout(() => {
      setCopiedSender(false);
      senderCopyTimeoutRef.current = null;
    }, 1600);
  }

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
              !hasEvents ? 'cursor-not-allowed bg-slate-100 text-slate-300' : resolvedActiveTab === 'events' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
            onClick={() => {
              if (hasEvents) {
                setActiveTab('events');
              }
            }}
            disabled={!hasEvents}
            aria-disabled={!hasEvents}
          >
            {hasEvents ? `Events (${transaction.eventsCount})` : 'Events'}
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
                <DetailGroup plain>
                  <dl>
                    <DetailRow
                      label="Transaction Hash"
                      value={
                        <span className="inline-flex items-start gap-1.5">
                          <span className="mono break-all whitespace-pre-wrap">{transaction.hash}</span>
                          <span className="relative inline-flex shrink-0">
                            <button
                              type="button"
                              className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
                              aria-label="Copy transaction hash"
                              onClick={() => void handleCopyHash()}
                            >
                              <IconCopy className="size-4" stroke={1.8} />
                            </button>
                            <span
                              className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
                                copiedHash ? 'opacity-100' : 'opacity-0'
                              }`}
                            >
                              <span className="block whitespace-nowrap">Copied!</span>
                            </span>
                          </span>
                        </span>
                      }
                    />
                    <DetailRow label="Status" value={<StatusBadge status={transaction.status} label={transaction.statusLabel} />} />
                    <DetailRow
                      label="Block"
                      value={
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/block/${transaction.height}`}>
                          {transaction.height}
                        </Link>
                      }
                    />
                    <DetailRow
                      label="Timestamp"
                      value={
                        transaction.timestampMs ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>
                              <RelativeTime timestampMs={transaction.timestampMs} />
                            </span>
                            <span className="text-slate-500">({formatTimestampWithSeconds(transaction.timestamp, 'Unavailable')})</span>
                          </span>
                        ) : (
                          'Unavailable'
                        )
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label="Type" value={transaction.type} />
                    <DetailRow
                      label="Sender"
                      value={
                        displaySender ? (
                          <span className="inline-flex max-w-full items-center gap-1.5" title={displaySender.full}>
                            <Link className="mono break-all font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                              {displaySender.full}
                            </Link>
                            <ActionIconButton
                              tooltip={addressDisplayMode === 'bech32' ? 'Switch to hex address' : 'Switch to bech32 address'}
                              className="text-slate-400 hover:text-sky-600"
                              onClick={() => setAddressDisplayMode((current) => (current === 'bech32' ? 'hex' : 'bech32'))}
                            >
                              <IconArrowsExchange className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <span className="relative inline-flex shrink-0">
                              <button
                                type="button"
                                className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
                                aria-label="Copy sender address"
                                onClick={() => void handleCopySenderAddress()}
                              >
                                <IconCopy className="size-4" stroke={1.8} />
                              </button>
                              <span
                                className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
                                  copiedSender ? 'opacity-100' : 'opacity-0'
                                }`}
                              >
                                <span className="block whitespace-nowrap">Copied!</span>
                              </span>
                            </span>
                          </span>
                        ) : (
                          'Unknown'
                        )
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label="Code" value={String(transaction.code)} />
                    <DetailRow label="Message Count" value={String(transaction.messageCount)} />
                    <DetailRow label="Transaction Fee" value={transaction.feeLabel} />
                    <DetailRow label="Gas Used / Wanted" value={`${transaction.gasUsedLabel} / ${transaction.gasWantedLabel}`} />
                    <DetailRow label="Memo" value={transaction.memo || '-'} mono={Boolean(transaction.memo)} />
                    <DetailRow label="Raw Log" value={transaction.rawLog || '-'} mono={Boolean(transaction.rawLog)} />
                  </dl>
                </DetailGroup>
              </div>
            </section>

            <TxMessagesSection messages={transaction.messages} />
          </>
        ) : resolvedActiveTab === 'events' ? (
          <TxEventsSection events={transaction.events} />
        ) : (
          <JsonViewPanel value={transaction.rawJson as object} />
        )}
      </main>
    </AppShell>
  );
}
