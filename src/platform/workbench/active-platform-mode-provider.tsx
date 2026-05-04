'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PlatformMode } from '@/config/chains';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';

type ActivePlatformModeContextValue = {
  activeMode: PlatformMode;
};

const ActivePlatformModeContext = createContext<ActivePlatformModeContextValue | null>(null);

export function ActivePlatformModeProvider({ children }: { children: ReactNode }) {
  const [activeMode, setActiveMode] = useState<PlatformMode>(() => {
    try {
      return readActivePlatformModeCookie();
    } catch {
      return 'evm';
    }
  });

  useEffect(() => {
    const handleModeChanged = () => {
      try {
        setActiveMode(readActivePlatformModeCookie());
      } catch {
        setActiveMode('evm');
      }
    };

    handleModeChanged();
    window.addEventListener('chaindev:active-platform-mode-changed', handleModeChanged);

    return () => {
      window.removeEventListener('chaindev:active-platform-mode-changed', handleModeChanged);
    };
  }, []);

  const value = useMemo(
    () => ({
      activeMode,
    }),
    [activeMode],
  );

  return <ActivePlatformModeContext.Provider value={value}>{children}</ActivePlatformModeContext.Provider>;
}

export function useActivePlatformMode() {
  const context = useContext(ActivePlatformModeContext);

  if (!context) {
    throw new Error('useActivePlatformMode must be used within ActivePlatformModeProvider.');
  }

  return context;
}
