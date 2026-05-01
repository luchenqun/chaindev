'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { lookupEvmHistoricalBalanceDirect, type HistoricalBalanceLookupResult } from '@/domains/evm/client/historical-balance';
import { getActiveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { AppShell } from '@/platform/layout/app-shell';

type AssetType = 'native' | 'erc20';
type LookupMode = 'datetime' | 'block-number';

const DATETIME_INPUT_CLASS_NAME =
  'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50';

function buildDefaultSnapshotDateTime() {
  const now = new Date();
  const localTimestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTimestamp.toISOString().slice(0, 19);
}

export default function EvmHistoricalBalancePage() {
  const { showToast } = useToast();
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [assetType, setAssetType] = useState<AssetType>('native');
  const [accountAddress, setAccountAddress] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [lookupMode, setLookupMode] = useState<LookupMode>('datetime');
  const [snapshotDateTime, setSnapshotDateTime] = useState(buildDefaultSnapshotDateTime);
  const [blockNumber, setBlockNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HistoricalBalanceLookupResult | null>(null);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  async function handleLookup() {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const nextResult = await lookupEvmHistoricalBalanceDirect({
        assetType,
        accountAddress,
        tokenAddress,
        lookupMode,
        blockNumber,
        snapshotDateTime,
      });

      setResult(nextResult);
      showToast({
        title: 'Historical balance loaded',
        description: `${nextResult.assetLabel} at block #${nextResult.blockNumber}`,
      });
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Failed to lookup historical balance.';
      setError(message);
      showToast({
        title: 'Lookup failed',
        description: message,
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setAssetType('native');
    setAccountAddress('');
    setTokenAddress('');
    setLookupMode('datetime');
    setSnapshotDateTime(buildDefaultSnapshotDateTime());
    setBlockNumber('');
    setError(null);
    setResult(null);
  }

  return (
    <AppShell mode="evm">
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-2xl font-semibold text-slate-950">Historical Balance Checker</h1>
            <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">
              Lookup the historical native coin or ERC-20 token balance for an account at a specific block number or exact timestamp.
            </p>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Choose an option</label>
                <Select value={assetType} onValueChange={(value) => setAssetType(value as AssetType)}>
                  <SelectTrigger className="h-10 text-left text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Native coin balance</SelectItem>
                    <SelectItem value="erc20">Token (ERC-20) balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {assetType === 'native' ? 'Account Address / Contract Address' : 'Account Address'} <span className="text-rose-500">*</span>
                  </span>
                  <div className="relative">
                    <Input value={accountAddress} placeholder="0x..." className="pr-20" onChange={(event) => setAccountAddress(event.target.value)} />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 inline-flex h-[30px] -translate-y-1/2 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
                      onClick={() => {
                        if (activeKey?.address) {
                          setAccountAddress(activeKey.address);
                        }
                      }}
                      disabled={!activeKey?.address}
                    >
                      Self
                    </button>
                  </div>
                </label>

                {assetType === 'erc20' ? (
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      Token Address <span className="text-rose-500">*</span>
                    </span>
                    <Input value={tokenAddress} placeholder="0x..." onChange={(event) => setTokenAddress(event.target.value)} />
                  </label>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-700">Filter by:</div>
                <div className="flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-slate-700"
                    onClick={() => setLookupMode('datetime')}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border ${lookupMode === 'datetime' ? 'border-sky-600' : 'border-slate-300'}`}>
                      <span className={`size-2.5 rounded-full ${lookupMode === 'datetime' ? 'bg-sky-600' : 'bg-transparent'}`} />
                    </span>
                    Exact Time
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-slate-700"
                    onClick={() => setLookupMode('block-number')}
                  >
                    <span className={`flex size-5 items-center justify-center rounded-full border ${lookupMode === 'block-number' ? 'border-sky-600' : 'border-slate-300'}`}>
                      <span className={`size-2.5 rounded-full ${lookupMode === 'block-number' ? 'bg-sky-600' : 'bg-transparent'}`} />
                    </span>
                    Block Number
                  </button>
                </div>
              </div>

              {lookupMode === 'datetime' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Snapshot Time <span className="text-rose-500">*</span>
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
                    Block Number <span className="text-rose-500">*</span>
                  </span>
                  <Input value={blockNumber} placeholder="0" onChange={(event) => setBlockNumber(event.target.value)} />
                </label>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                <Button size="sm" variant="ghost" className="px-3 text-slate-500 hover:text-slate-900" onClick={handleReset} disabled={submitting}>
                  Reset
                </Button>
                <Button size="sm" className="px-4" onClick={() => void handleLookup()} disabled={submitting}>
                  {submitting ? 'Looking up...' : 'Lookup'}
                </Button>
              </div>
            </div>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            {result ? (
              <section className="space-y-5 border-t border-slate-200 pt-6">
                <h2 className="text-lg font-semibold text-slate-950">Balance Snapshot</h2>
                <div className="grid gap-x-8 gap-y-4 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-slate-500">Provider</div>
                    <div className="font-medium text-slate-950">{result.providerName}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Asset</div>
                    <div className="font-medium text-slate-950">{result.assetLabel}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Account</div>
                    <div className="break-all font-medium text-slate-950">{result.accountAddress}</div>
                  </div>
                  {result.tokenAddress ? (
                    <div>
                      <div className="text-slate-500">Token</div>
                      <div className="break-all font-medium text-slate-950">{result.tokenAddress}</div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-slate-500">Balance</div>
                    <div className="font-medium text-slate-950">{result.amount} {result.symbol}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Block</div>
                    <div className="font-medium text-slate-950">{result.blockExplorerLabel}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Block Time</div>
                    <div className="font-medium text-slate-950">{result.blockTimestampLabel}</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-700">Result JSON</div>
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
