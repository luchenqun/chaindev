'use client';

import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosSendTxPage() {
  return (
    <AppShell>
      <main className="tool-card">
        <span className="kicker">Cosmos Workbench</span>
        <h1>Send Transaction Draft</h1>
        <p>Save message drafts, account addresses, gas, and memo values for a future signing flow.</p>
        <form className="tool-form">
          <div className="tool-form-grid">
            <input placeholder="From Address" />
            <input placeholder="Memo" />
          </div>
          <textarea placeholder='[{"typeUrl":"/cosmos.bank.v1beta1.MsgSend","value":{}}]' />
          <button className="primary-button" type="button">
            Save Draft
          </button>
        </form>
      </main>
    </AppShell>
  );
}
