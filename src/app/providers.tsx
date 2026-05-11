'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/toast';
import { CosmosChainStateBootstrap } from '@/domains/cosmos/ui/cosmos-chain-state-bootstrap';
import { CosmosHomeDataProvider } from '@/domains/cosmos/ui/home-data-provider';
import { syncEvmKeyringFromServer } from '@/domains/evm/client/keyring';
import { EvmChainStateBootstrap } from '@/domains/evm/ui/evm-chain-state-bootstrap';
import { EvmHomeDataProvider } from '@/domains/evm/ui/home-data-provider';
import { LocaleProvider } from '@/i18n/locale-provider';
import type { Locale } from '@/i18n/config';
import { setClientAuthenticated } from '@/platform/auth/client-session-state';
import { ActivePlatformModeProvider } from '@/platform/workbench/active-platform-mode-provider';
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
    setClientAuthenticated(status === 'authenticated');

    if (status !== 'unauthenticated') {
      return;
    }

    syncGuestRpcDefaults();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    void syncEvmKeyringFromServer().catch(() => undefined);
  }, [status]);

  return null;
}

export function AppProviders({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  return (
    <SessionProvider>
      <LocaleProvider initialLocale={initialLocale}>
        <ToastProvider>
          <ActivePlatformModeProvider>
            <ActivePlatformModeSync />
            <GuestWorkbenchDefaultsSync />
            <EvmChainStateBootstrap />
            <CosmosChainStateBootstrap />
            <EvmHomeDataProvider>
              <CosmosHomeDataProvider>{children}</CosmosHomeDataProvider>
            </EvmHomeDataProvider>
          </ActivePlatformModeProvider>
        </ToastProvider>
      </LocaleProvider>
    </SessionProvider>
  );
}
