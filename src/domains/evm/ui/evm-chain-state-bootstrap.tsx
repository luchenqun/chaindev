'use client';

import { useEffect } from 'react';
import { refreshEvmChainState } from '@/domains/evm/client/chain-state';

export function EvmChainStateBootstrap() {
  useEffect(() => {
    void refreshEvmChainState();

    const handleActiveRpcProfileChanged = () => {
      void refreshEvmChainState();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, []);

  return null;
}
