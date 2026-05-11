'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { useToast } from '@/components/ui/toast';
import { lookupEvmHistoricalTokenSupplyDirect, type HistoricalTokenSupplyLookupResult } from '@/domains/evm/client/historical-token-supply';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type LookupMode = 'datetime' | 'block-number';

const DATETIME_INPUT_CLASS_NAME =
  'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50';

function buildDefaultSnapshotDateTime() {
  const now = new Date();
  const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTimestamp.toISOString().slice(0, 19);
}

export default function EvmTokenSupplyPage() {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.tokenSupply;
  const commonMessages = messages.common;
  const [tokenAddress, setTokenAddress] = useState('');
  const [lookupMode, setLookupMode] = useState<LookupMode>('datetime');
  const [snapshotDateTime, setSnapshotDateTime] = useState(buildDefaultSnapshotDateTime);
  const [blockNumber, setBlockNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoricalTokenSupplyLookupResult | null>(null);

  async function handleLookup() {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const nextResult = await lookupEvmHistoricalTokenSupplyDirect({
        tokenAddress,
        lookupMode,
        blockNumber,
        snapshotDateTime,
      });

      setResult(nextResult);
      showToast({
        title: pageMessages.loaded,
        description: translateRuntimeText(`${nextResult.symbol} at block #${nextResult.blockNumber}`, locale),
      });
    } catch (lookupError) {
      const message = lookupError instanceof Error ? translateRuntimeText(lookupError.message, locale) : pageMessages.failed;
      setError(message);
      showToast({
        title: pageMessages.failedTitle,
        description: message,
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setTokenAddress('');
    setLookupMode('datetime');
    setSnapshotDateTime(buildDefaultSnapshotDateTime());
    setBlockNumber('');
    setError(null);
    setResult(null);
  }

  return (
    <AppShell mode="evm">
      <main className="section-block">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-2xl font-semibold text-slate-950">{pageMessages.title}</h1>
            <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">{pageMessages.description}</p>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="space-y-6">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {pageMessages.tokenContractAddress} <span className="text-rose-500">*</span>
                </span>
                <Input value={tokenAddress} placeholder="0x..." onChange={(event) => setTokenAddress(event.target.value)} />
              </label>

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">{pageMessages.filterBy}</div>
                <div className="flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-slate-700"
                    onClick={() => setLookupMode('datetime')}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border ${lookupMode === 'datetime' ? 'border-sky-600' : 'border-slate-300'}`}>
                      <span className={`size-2.5 rounded-full ${lookupMode === 'datetime' ? 'bg-sky-600' : 'bg-transparent'}`} />
                    </span>
                    {pageMessages.exactTime}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-slate-700"
                    onClick={() => setLookupMode('block-number')}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border ${lookupMode === 'block-number' ? 'border-sky-600' : 'border-slate-300'}`}>
                      <span className={`size-2.5 rounded-full ${lookupMode === 'block-number' ? 'bg-sky-600' : 'bg-transparent'}`} />
                    </span>
                    {pageMessages.blockNumber}
                  </button>
                </div>
              </div>

              {lookupMode === 'datetime' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {pageMessages.snapshotTime} <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    step="1"
                    value={snapshotDateTime}
                    onChange={(event) => setSnapshotDateTime(event.target.value)}
                    className={DATETIME_INPUT_CLASS_NAME}
                  />
                </label>
              ) : (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {pageMessages.blockNumber} <span className="text-rose-500">*</span>
                  </span>
                  <Input value={blockNumber} placeholder="0" onChange={(event) => setBlockNumber(event.target.value)} />
                </label>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <Button size="sm" variant="ghost" className="px-3 text-slate-500 hover:text-slate-900" onClick={handleReset} disabled={submitting}>
                  {commonMessages.reset}
                </Button>
                <Button size="sm" className="px-4" onClick={() => void handleLookup()} disabled={submitting}>
                  {submitting ? pageMessages.lookingUp : pageMessages.lookup}
                </Button>
              </div>
            </div>

            {error ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{translateRuntimeText(error, locale)}</div> : null}

            {result ? (
              <section className="space-y-5 border-t border-slate-200 pt-6">
                <h2 className="text-lg font-semibold text-slate-950">{pageMessages.snapshot}</h2>
                <div className="grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-slate-500">{pageMessages.provider}</div>
                    <div className="font-medium text-slate-950">{translateRuntimeText(result.providerName, locale)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{pageMessages.token}</div>
                    <div className="font-medium text-slate-950">{translateRuntimeText(result.name, locale)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{pageMessages.tokenAddress}</div>
                    <div className="break-all font-medium text-slate-950">{result.tokenAddress}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{pageMessages.supply}</div>
                    <div className="font-medium text-slate-950">
                      {result.supply} {result.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">{commonMessages.block}</div>
                    <div className="font-medium text-slate-950">{translateRuntimeText(result.blockExplorerLabel, locale)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">{pageMessages.blockTime}</div>
                    <div className="font-medium text-slate-950">{result.blockTimestampLabel}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-700">{commonMessages.resultJson}</div>
                  <JsonViewPanel value={result} initialFullyExpanded={false} />
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
