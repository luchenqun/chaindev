'use client';

import { useMessages } from '@/i18n/locale-provider';
import { AppShell } from '@/platform/layout/app-shell';
import { AccountWorkbenchShell } from '@/platform/layout/account-workbench-shell';
import { RpcProviderManager } from '@/platform/workbench/rpc-provider-manager';

export default function ProvidersPage() {
  const messages = useMessages();

  return (
    <AppShell>
      <AccountWorkbenchShell mode="evm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.provider.pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{messages.provider.pageDescription}</p>
        </div>
        <RpcProviderManager mode="evm" variant="page" />
      </AccountWorkbenchShell>
    </AppShell>
  );
}
