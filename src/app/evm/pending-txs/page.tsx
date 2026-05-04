'use client';

import { PendingTransactionsPanel } from '@/domains/evm/ui/pending-transactions-panel';
import { useMessages } from '@/i18n/locale-provider';
import { AppShell } from '@/platform/layout/app-shell';

export default function EvmPendingTransactionsPage() {
  const messages = useMessages();

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.pendingTransactions.title}</h1>
        </div>

        <PendingTransactionsPanel />
      </main>
    </AppShell>
  );
}
