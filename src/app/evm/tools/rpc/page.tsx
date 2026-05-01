'use client';

import { IconExternalLink, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { requestEvmRpcDirect } from '@/domains/evm/client/queries';
import {
  createEvmRpcParamsTemplate,
  EVM_RPC_METHOD_CATALOG,
  getEvmRpcCategoryLabel,
  type EvmRpcMethodCategory,
} from '@/domains/evm/lib/rpc-method-catalog';
import { AppShell } from '@/platform/layout/app-shell';

const JSON_TEXTAREA_CLASS_NAME =
  'min-h-28 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100';
const EVM_RPC_PARAMS_CACHE_KEY = 'chaindev-evm-rpc-params-v1';

const CATEGORY_OPTIONS: Array<{ value: EvmRpcMethodCategory; label: string; description: string }> = [
  {
    value: 'ethereum-json-rpc',
    label: 'Ethereum JSON-RPC API',
    description: 'Core Ethereum protocol methods for blockchain interaction, account management, and transaction processing',
  },
  {
    value: 'debug',
    label: 'Debug API',
    description: 'Development and debugging utilities for deep blockchain analysis and transaction inspection',
  },
  {
    value: 'trace',
    label: 'Trace API',
    description: 'Transaction tracing tools for debugging smart contracts and analyzing internal transaction flows',
  },
];

function formatParamsTemplate(methodName: string) {
  const definition = EVM_RPC_METHOD_CATALOG.find((item) => item.name === methodName);

  if (!definition) {
    return '[]';
  }

  return JSON.stringify(createEvmRpcParamsTemplate(definition), null, 2);
}

function readEvmRpcParamsCache() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>;
  }

  try {
    const rawValue = window.localStorage.getItem(EVM_RPC_PARAMS_CACHE_KEY);

    if (!rawValue) {
      return {} as Record<string, string>;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(Object.entries(parsedValue).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {} as Record<string, string>;
  }
}

function writeEvmRpcParamsCache(cache: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EVM_RPC_PARAMS_CACHE_KEY, JSON.stringify(cache));
}

function getCachedEvmRpcParams(methodName: string) {
  return readEvmRpcParamsCache()[methodName] ?? null;
}

function persistEvmRpcParams(methodName: string, paramsJson: string) {
  const currentCache = readEvmRpcParamsCache();
  writeEvmRpcParamsCache({
    ...currentCache,
    [methodName]: paramsJson,
  });
}

export default function EvmRpcPage() {
  const [category, setCategory] = useState<EvmRpcMethodCategory>('ethereum-json-rpc');
  const [selectedMethodName, setSelectedMethodName] = useState('eth_blockNumber');
  const [search, setSearch] = useState('');
  const [paramsJson, setParamsJson] = useState(formatParamsTemplate('eth_blockNumber'));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodsInCategory = useMemo(() => EVM_RPC_METHOD_CATALOG.filter((item) => item.category === category), [category]);
  const selectedMethod = useMemo(() => EVM_RPC_METHOD_CATALOG.find((item) => item.name === selectedMethodName) ?? null, [selectedMethodName]);
  const filteredMethods = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return methodsInCategory;
    }

    return methodsInCategory.filter((method) => method.name.toLowerCase().includes(normalizedSearch));
  }, [methodsInCategory, search]);

  useEffect(() => {
    if (!methodsInCategory.some((item) => item.name === selectedMethodName)) {
      const nextMethodName = methodsInCategory[0]?.name ?? '';
      setSelectedMethodName(nextMethodName);
      setParamsJson(formatParamsTemplate(nextMethodName));
      setResult(null);
      setError(null);
    }
  }, [methodsInCategory, selectedMethodName]);

  useEffect(() => {
    if (!selectedMethod) {
      return;
    }

    setParamsJson(getCachedEvmRpcParams(selectedMethod.name) ?? formatParamsTemplate(selectedMethod.name));
    setResult(null);
    setError(null);
  }, [selectedMethodName, selectedMethod]);

  async function handleRun() {
    if (!selectedMethod) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const parsed = JSON.parse(paramsJson) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error('Params must be a JSON array.');
      }

      persistEvmRpcParams(selectedMethod.name, paramsJson);
      const payload = await requestEvmRpcDirect(selectedMethod.name, parsed);
      setResult(payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : { result: payload });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to execute RPC request.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCategory = CATEGORY_OPTIONS.find((item) => item.value === category) ?? CATEGORY_OPTIONS[0];

  return (
    <AppShell mode="evm">
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex min-w-0 items-baseline justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="shrink-0 text-2xl font-semibold text-slate-950">EVM RPC API</h1>
                <p className="min-w-0 truncate text-sm text-slate-500">Call Ethereum, debug, and trace RPC methods directly from the browser.</p>
              </div>
              <span className="shrink-0 text-sm text-slate-500">{methodsInCategory.length} methods</span>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 lg:border-r lg:border-b-0">
              <div className="space-y-3 border-b border-slate-200 p-4">
                <Select value={category} onValueChange={(value) => setCategory(value as EvmRpcMethodCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <p className="text-xs leading-5 text-slate-500">{selectedCategory.description}</p>
                </div>
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" stroke={1.8} />
                  <Input value={search} placeholder="Search RPC method" className="pl-9" onChange={(event) => setSearch(event.target.value)} />
                </div>
              </div>
              <div className="max-h-[720px] overflow-y-auto p-2">
                {filteredMethods.map((method) => {
                  const active = method.name === selectedMethodName;

                  return (
                    <button
                      key={method.name}
                      type="button"
                      className={
                        active
                          ? 'block w-full rounded-xl bg-sky-50 px-3 py-2.5 text-left text-sky-700'
                          : 'block w-full rounded-xl px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                      }
                      onClick={() => setSelectedMethodName(method.name)}
                    >
                      <span className="block truncate text-sm font-medium">{method.name}</span>
                      <span className="mt-1 block line-clamp-2 text-xs text-slate-500">{method.summary}</span>
                    </button>
                  );
                })}
                {!filteredMethods.length ? <div className="px-3 py-8 text-center text-sm text-slate-500">No RPC methods found.</div> : null}
              </div>
            </aside>

            <section className="min-w-0 p-6">
              {selectedMethod ? (
                <div className="space-y-5">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold uppercase text-slate-700">
                        {getEvmRpcCategoryLabel(selectedMethod.category)}
                      </span>
                      <span className="truncate font-mono text-sm text-slate-700">{selectedMethod.name}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-slate-950">{selectedMethod.name}</h2>
                      <Link
                        href={selectedMethod.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800"
                      >
                        <span>QuickNode Docs</span>
                        <IconExternalLink className="size-4" stroke={1.8} />
                      </Link>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{selectedMethod.summary}</p>
                  </div>

                  {selectedMethod.notes?.length ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {selectedMethod.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Parameters</h3>
                    {selectedMethod.params.length ? (
                      <div className="mt-3 space-y-3">
                        {selectedMethod.params.map((param, index) => (
                          <div key={`${selectedMethod.name}-${param.name}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm text-slate-900">{param.name}</span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{param.type}</span>
                              {param.required ? <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">required</span> : null}
                            </div>
                            {param.description ? <p className="mt-1 text-sm leading-6 text-slate-500">{param.description}</p> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">This RPC method does not require parameters.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Params</label>
                    <JsonInput
                      value={paramsJson}
                      onChange={setParamsJson}
                      placeholder="[]"
                      textareaClassName={`mt-1 ${JSON_TEXTAREA_CLASS_NAME}`}
                    />
                    <p className="mt-2 text-xs text-slate-500">Use a JSON array in the exact argument order expected by the upstream RPC method.</p>
                  </div>

                  {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

                  <div className="flex justify-end border-t border-slate-200 pt-4">
                    <Button type="button" disabled={submitting} onClick={() => void handleRun()}>
                      {submitting ? 'Running...' : 'Run'}
                    </Button>
                  </div>

                  {result ? (
                    <div className="border-t border-slate-200 pt-4">
                      <JsonViewPanel className="max-h-[900px] overflow-y-auto overflow-x-hidden bg-slate-50 shadow-none" jsonClassName="whitespace-pre-wrap break-all" value={result} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No RPC methods available.</div>
              )}
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
