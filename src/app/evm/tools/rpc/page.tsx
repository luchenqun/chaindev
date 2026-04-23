'use client';

import { FormEvent, useState } from 'react';
import { requestEvmRpcDirect } from '@/domains/evm/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

export default function EvmRpcPage() {
  const [method, setMethod] = useState('eth_blockNumber');
  const [params, setParams] = useState('[]');
  const [result, setResult] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const parsedParams = JSON.parse(params) as unknown[];
      const payload = await requestEvmRpcDirect(method, parsedParams);
      setResult(JSON.stringify({ method, params: parsedParams, result: payload }, null, 2));
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to execute RPC request.',
          },
          null,
          2,
        ),
      );
    }
  }

  return (
    <AppShell>
      <main className="tools-grid">
        <section className="tool-card">
          <span className="kicker">EVM Workbench</span>
          <h1>EVM RPC Debug</h1>
          <p>Send JSON-RPC requests directly from the browser to the active EVM provider.</p>
          <form className="tool-form" onSubmit={handleSubmit}>
            <input value={method} onChange={(event) => setMethod(event.target.value)} />
            <textarea value={params} onChange={(event) => setParams(event.target.value)} />
            <button className="primary-button" type="submit">
              Run
            </button>
          </form>
        </section>
        <section className="tool-card">
          <span className="kicker">Response</span>
          <h2>Raw Result</h2>
          <pre className="mono">{result || 'Submit a request to view the upstream response.'}</pre>
        </section>
      </main>
    </AppShell>
  );
}
