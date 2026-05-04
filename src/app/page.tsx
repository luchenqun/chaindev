'use client';

import { CosmosHomePage } from '@/domains/cosmos/ui/home-page';
import { EvmHomeActivity } from '@/domains/evm/ui/home-activity';
import { EvmHomeMetrics } from '@/domains/evm/ui/home-metrics';
import { AppShell } from '@/platform/layout/app-shell';
import { useActivePlatformMode } from '@/platform/workbench/active-platform-mode-provider';

function EvmHomePage() {
  return (
    <main className="pb-10">
      <section>
        <EvmHomeMetrics />
      </section>
      <EvmHomeActivity />
    </main>
  );
}

export default function HomePage() {
  const { activeMode } = useActivePlatformMode();

  return <AppShell mode={activeMode}>{activeMode === 'cosmos' ? <CosmosHomePage /> : <EvmHomePage />}</AppShell>;
}
