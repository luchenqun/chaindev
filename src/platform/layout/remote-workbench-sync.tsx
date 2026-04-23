'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { syncCosmosAddressTagsFromServer } from '@/domains/cosmos/client/address-tags';
import { syncEvmAddressTagsFromServer } from '@/domains/evm/client/address-tags';
import { syncEvmContractRegistryFromServer } from '@/domains/evm/client/contract-registry';
import { syncEvmKeyringFromServer } from '@/domains/evm/client/keyring';

export function RemoteWorkbenchSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    void Promise.allSettled([syncEvmKeyringFromServer(), syncEvmAddressTagsFromServer(), syncCosmosAddressTagsFromServer(), syncEvmContractRegistryFromServer()]);
  }, [status]);

  return null;
}
