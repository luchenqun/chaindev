'use client';

import { useEffect } from 'react';
import { refreshCosmosChainState } from '@/domains/cosmos/client/chain-state';

export function CosmosChainStateBootstrap() {
  useEffect(() => {
    void refreshCosmosChainState();

    const handleActiveRpcProfileChanged = () => {
      void refreshCosmosChainState();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, []);

  return null;
}
