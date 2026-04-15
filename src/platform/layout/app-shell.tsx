import { ReactNode } from 'react';
import { RemoteWorkbenchSync } from '@/platform/layout/remote-workbench-sync';
import { TopNav } from '@/platform/layout/top-nav';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <RemoteWorkbenchSync />
      <TopNav />
      <div className="page-frame">{children}</div>
    </div>
  );
}
