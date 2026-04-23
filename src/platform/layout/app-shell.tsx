import { ReactNode } from 'react';
import type { PlatformMode } from '@/config/chains';
import { RemoteWorkbenchSync } from '@/platform/layout/remote-workbench-sync';
import { TopNav } from '@/platform/layout/top-nav';

export function AppShell({ children, mode }: { children: ReactNode; mode?: PlatformMode }) {
  return (
    <div className="app-shell">
      <RemoteWorkbenchSync />
      <TopNav mode={mode} />
      <div className="page-frame">{children}</div>
    </div>
  );
}
