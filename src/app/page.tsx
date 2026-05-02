'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlatformMode } from '@/config/chains';
import { CosmosHomePage } from '@/domains/cosmos/ui/home-page';
import { EvmHomeActivity } from '@/domains/evm/ui/home-activity';
import { EvmHomeMetrics } from '@/domains/evm/ui/home-metrics';
import { AppShell } from '@/platform/layout/app-shell';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';

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

function HomePageShellSkeleton() {
  return (
    <main className="pb-10">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`header-${index}`} className="bg-slate-50 px-5 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`}>
            <div className="border-t border-slate-200" />
            <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {Array.from({ length: 4 }).map((__, columnIndex) => (
                <div key={`row-${rowIndex}-col-${columnIndex}`} className="px-5 py-4">
                  <Skeleton className="mb-2 h-3.5 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<PlatformMode | null>(null);

  useEffect(() => {
    const handleModeChanged = () => {
      setActiveMode(readActivePlatformModeCookie());
    };

    handleModeChanged();

    window.addEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
    window.addEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
    window.addEventListener('chaindev:active-platform-mode-changed', handleModeChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
      window.removeEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
      window.removeEventListener('chaindev:active-platform-mode-changed', handleModeChanged);
    };
  }, []);

  if (activeMode == null) {
    return (
      <AppShell>
        <HomePageShellSkeleton />
      </AppShell>
    );
  }

  return <AppShell mode={activeMode}>{activeMode === 'cosmos' ? <CosmosHomePage /> : <EvmHomePage />}</AppShell>;
}
