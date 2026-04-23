'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/toast';
import { CosmosHomeDataProvider } from '@/domains/cosmos/ui/home-data-provider';
import { syncEvmKeyringFromServer } from '@/domains/evm/client/keyring';
import { EvmHomeDataProvider } from '@/domains/evm/ui/home-data-provider';
import { syncGuestRpcDefaults, writeActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';

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

function GuestWorkbenchDefaultsSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    syncGuestRpcDefaults();
    void syncEvmKeyringFromServer().catch(() => undefined);
  }, [status]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ActivePlatformModeSync />
        <GuestWorkbenchDefaultsSync />
        <EvmHomeDataProvider>
          <CosmosHomeDataProvider>{children}</CosmosHomeDataProvider>
        </EvmHomeDataProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
