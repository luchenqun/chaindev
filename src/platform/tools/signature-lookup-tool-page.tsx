'use client';

import { IconCopy } from '@tabler/icons-react';
import { type KeyboardEvent, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/platform/layout/app-shell';

type SignatureRecord = {
  id: number;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
};

type FourByteApiResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: SignatureRecord[];
};

type LookupKind = 'function' | 'event';

function normalizeSignatureQuery(value: string): { normalized: string; kind: LookupKind } {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    throw new Error('Signature is required.');
  }

  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (/^0x[0-9a-f]{8}$/.test(normalized)) {
    return { normalized, kind: 'function' };
  }

  if (/^0x[0-9a-f]{64}$/.test(normalized)) {
    return { normalized, kind: 'event' };
  }

  throw new Error('Enter a valid 4-byte function selector or 32-byte event topic.');
}

export function SignatureLookupToolPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SignatureRecord[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [lookupKind, setLookupKind] = useState<LookupKind>('function');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);

    try {
      const { normalized, kind } = normalizeSignatureQuery(query);
      const endpoint = kind === 'event' ? 'event-signatures' : 'signatures';
      const response = await fetch(`https://www.4byte.directory/api/v1/${endpoint}/?hex_signature=${encodeURIComponent(normalized)}`);

      if (!response.ok) {
        throw new Error(`Lookup failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as FourByteApiResponse;
      const sortedResults = [...payload.results].sort((left, right) => left.id - right.id);
      setResults(sortedResults);
      setSearchedQuery(normalized);
      setLookupKind(kind);
    } catch (searchError) {
      setResults([]);
      setSearchedQuery('');
      setError(searchError instanceof Error ? searchError.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || loading) {
      return;
    }

    void handleSearch();
  }

  async function handleCopy(field: string, value: string) {
    await copyText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1200);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="shrink-0 text-2xl font-semibold text-slate-950">Signature Lookup</h1>
              <p className="min-w-0 truncate text-sm text-slate-500">Query text signatures from 4byte.directory.</p>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <section className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-center">
                <Input
                  value={query}
                  className="h-12 text-lg font-semibold text-slate-900 placeholder:text-sm placeholder:font-normal placeholder:text-slate-400"
                  placeholder="Enter a 4-byte function selector such as `0xa9059cbb`, or a 32-byte event topic such as `0xddf252ad...`."
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button type="button" className="h-12 text-base font-semibold" disabled={loading} onClick={() => void handleSearch()}>
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </section>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            {results.length ? (
              <section className="border-t border-slate-200 pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Results</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {results.length} {lookupKind} match{results.length > 1 ? 'es' : ''} found for {searchedQuery}.
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[980px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">ID</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Text Signature</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bytes Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((item) => (
                        <tr key={`${item.id}-${item.hex_signature}`} className="border-t border-slate-200 align-top">
                          <td className="px-4 py-3 text-sm font-semibold text-slate-600">{item.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <span className="min-w-0 break-all font-mono text-sm text-slate-950">{item.text_signature}</span>
                              <ActionIconButton
                                tooltip={copiedField === `text-${item.id}` ? 'Copied' : 'Copy text signature'}
                                aria-label={copiedField === `text-${item.id}` ? 'Text signature copied' : 'Copy text signature'}
                                className="shrink-0 text-slate-400 hover:text-sky-600"
                                onClick={() => void handleCopy(`text-${item.id}`, item.text_signature)}
                              >
                                <IconCopy className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-sky-600">{item.hex_signature}</span>
                              <ActionIconButton
                                tooltip={copiedField === `hex-${item.id}` ? 'Copied' : 'Copy bytes signature'}
                                aria-label={copiedField === `hex-${item.id}` ? 'Bytes signature copied' : 'Copy bytes signature'}
                                className="shrink-0 text-slate-400 hover:text-sky-600"
                                onClick={() => void handleCopy(`hex-${item.id}`, item.hex_signature)}
                              >
                                <IconCopy className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : searchedQuery ? (
              <section className="border-t border-slate-200 pt-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No signatures were found for {searchedQuery}.</div>
              </section>
            ) : (
              <section className="border-t border-dashed border-slate-300 px-4 py-8 text-center">
                <div className="mx-auto max-w-2xl">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ready</div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">Search results will appear here</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Look up a function selector or event topic to see candidate signatures returned by 4byte.directory.
                  </p>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
