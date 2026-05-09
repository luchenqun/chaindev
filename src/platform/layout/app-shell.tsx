import { ReactNode } from 'react';
import type { PlatformMode } from '@/config/chains';
import { CosmosChainStateBootstrap } from '@/domains/cosmos/ui/cosmos-chain-state-bootstrap';
import { RemoteWorkbenchSync } from '@/platform/layout/remote-workbench-sync';
import { SiteFooter } from '@/platform/layout/site-footer';
import { TopNav } from '@/platform/layout/top-nav';

export function AppShell({ children, mode }: { children: ReactNode; mode?: PlatformMode }) {
  return (
    <div className="app-shell">
      <RemoteWorkbenchSync />
      <CosmosChainStateBootstrap />
      <TopNav mode={mode} />
      <div className="page-frame">{children}</div>
      <SiteFooter />
    </div>
  );
}
