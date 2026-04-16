'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/toast';
import { CosmosHomeDataProvider } from '@/domains/cosmos/ui/home-data-provider';
import { EvmHomeDataProvider } from '@/domains/evm/ui/home-data-provider';
import { writeActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';

function ActivePlatformModeSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/cosmos')) {
      writeActivePlatformModeCookie('cosmos');
      return;
    }

    if (pathname.startsWith('/evm')) {
      writeActivePlatformModeCookie('evm');
    }
  }, [pathname]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ActivePlatformModeSync />
        <EvmHomeDataProvider>
          <CosmosHomeDataProvider>{children}</CosmosHomeDataProvider>
        </EvmHomeDataProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
