'use client';

import { PendingTransactionsPanel } from '@/domains/evm/ui/pending-transactions-panel';
import { AppShell } from '@/platform/layout/app-shell';

export default function EvmPendingTransactionsPage() {
  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Pending Transactions</h1>
        </div>

        <PendingTransactionsPanel />
      </main>
    </AppShell>
  );
}
