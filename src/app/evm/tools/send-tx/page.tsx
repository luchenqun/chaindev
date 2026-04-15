'use client';

import { AppShell } from '@/platform/layout/app-shell';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { getEvmCurrencyName } from '@/platform/workbench/rpc-profile';

export default function EvmSendTxPage() {
  const currencyName = getEvmCurrencyName(
    readActiveRpcProfileCookie('evm')?.nativeCurrencySymbol,
  );

  return (
    <AppShell>
      <main className="tool-card">
        <span className="kicker">EVM Workbench</span>
        <h1>Send Transaction Draft</h1>
        <p>
          The first version provides a draft form that future signing, gas
          estimation, and persistence can build on.
        </p>
        <form className="tool-form">
          <div className="tool-form-grid">
            <input placeholder="From Address" />
            <input placeholder="To Address" />
          </div>
          <div className="tool-form-grid">
            <input placeholder={`Value in ${currencyName}`} />
            <input placeholder="Gas Limit" />
          </div>
          <textarea placeholder='{"data":"0x"}' />
          <button className="primary-button" type="button">
            Save Draft
          </button>
        </form>
      </main>
    </AppShell>
  );
}
