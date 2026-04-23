'use client';

import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosEncodeDecodePage() {
  return (
    <AppShell>
      <main className="tools-grid">
        <section className="tool-card">
          <span className="kicker">Cosmos Workbench</span>
          <h1>Encode / Decode Tool</h1>
          <p>Provide entry points for Bech32, message encoding, and raw byte decoding with room for a protobuf registry later.</p>
          <form className="tool-form">
            <select defaultValue="bech32">
              <option value="bech32">Bech32</option>
              <option value="message">Message</option>
              <option value="bytes">Bytes</option>
            </select>
            <textarea placeholder="Paste address, bytes or message payload here" />
            <button className="primary-button" type="button">
              Transform
            </button>
          </form>
        </section>
        <section className="tool-card">
          <span className="kicker">Output</span>
          <h2>Result Preview</h2>
          <div className="empty-state">Encoding, decoding, and detailed error output can be shown here later.</div>
        </section>
      </main>
    </AppShell>
  );
}
