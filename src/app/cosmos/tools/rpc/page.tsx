'use client';

import { FormEvent, useState } from 'react';
import { requestCosmosRpcDirect } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosRpcPage() {
  const [endpoint, setEndpoint] = useState('/status');
  const [method, setMethod] = useState('GET');
  const [payload, setPayload] = useState('{}');
  const [result, setResult] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const body = await requestCosmosRpcDirect({
        endpoint,
        method,
        payload: method === 'GET' ? undefined : JSON.parse(payload),
      });
      setResult(JSON.stringify(body, null, 2));
    } catch (error) {
      setResult(
        JSON.stringify(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Failed to execute Cosmos request.',
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
          <span className="kicker">Cosmos Workbench</span>
          <h1>RPC / REST Debug</h1>
          <p>Debug Cosmos RPC and REST interfaces directly from the browser against the active provider.</p>
          <form className="tool-form" onSubmit={handleSubmit}>
            <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} />
            <button className="primary-button" type="submit">
              Run
            </button>
          </form>
        </section>
        <section className="tool-card">
          <span className="kicker">Response</span>
          <h2>Raw Result</h2>
          <pre className="mono">{result || 'Submit a request to inspect the node response.'}</pre>
        </section>
      </main>
    </AppShell>
  );
}
