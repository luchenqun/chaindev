'use client';

import { AppShell } from '@/platform/layout/app-shell';

export default function EvmDecodePage() {
  return (
    <AppShell>
      <main className="tools-grid">
        <section className="tool-card">
          <span className="kicker">EVM Workbench</span>
          <h1>Decode Tool</h1>
          <p>A starter workflow for calldata, event logs, and arbitrary hexadecimal payload decoding.</p>
          <form className="tool-form">
            <select defaultValue="calldata">
              <option value="calldata">Calldata</option>
              <option value="event">Event Log</option>
            </select>
            <textarea placeholder="Paste hex payload here" />
            <button className="primary-button" type="button">
              Decode
            </button>
          </form>
        </section>
        <section className="tool-card">
          <span className="kicker">Output</span>
          <h2>Decoded Result</h2>
          <div className="empty-state">ABI-aware decoding and result persistence can be added here later.</div>
        </section>
      </main>
    </AppShell>
  );
}
