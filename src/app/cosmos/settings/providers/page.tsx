'use client';

import { AppShell } from '@/platform/layout/app-shell';
import { AccountWorkbenchShell } from '@/platform/layout/account-workbench-shell';
import { RpcProviderManager } from '@/platform/workbench/rpc-provider-manager';

export default function CosmosProvidersPage() {
  return (
    <AppShell mode="cosmos">
      <AccountWorkbenchShell mode="cosmos">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Providers</h1>
          <p className="mt-2 text-sm text-slate-500">View saved providers as a list, add new endpoints, and manage the active explorer context from settings.</p>
        </div>
        <RpcProviderManager mode="cosmos" variant="page" />
      </AccountWorkbenchShell>
    </AppShell>
  );
}
