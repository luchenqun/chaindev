'use client';

import { useEffect, useState } from 'react';
import { EvmHomeActivity } from '@/domains/evm/ui/home-activity';
import { EvmHomeMetrics } from '@/domains/evm/ui/home-metrics';
import { CosmosHomePage } from '@/domains/cosmos/ui/home-page';
import { AppShell } from '@/platform/layout/app-shell';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';
import type { PlatformMode } from '@/config/chains';

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
  const [activeMode, setActiveMode] = useState<PlatformMode>(() => readActivePlatformModeCookie());

  useEffect(() => {
    const handleModeChanged = () => {
      setActiveMode(readActivePlatformModeCookie());
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
    window.addEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
    window.addEventListener('chaindev:active-platform-mode-changed', handleModeChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
      window.removeEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
      window.removeEventListener('chaindev:active-platform-mode-changed', handleModeChanged);
    };
  }, []);

  return <AppShell mode={activeMode}>{activeMode === 'cosmos' ? <CosmosHomePage /> : <EvmHomePage />}</AppShell>;
}
