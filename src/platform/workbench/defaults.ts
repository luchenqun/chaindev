import { privateKeyToAccount } from 'viem/accounts';
import type { RpcProfile } from '@/platform/workbench/rpc-profile';

const DEFAULT_TIMESTAMP = 1;

export const DEFAULT_EVM_PROVIDER_ID = 'default-evm-localnode0';
export const DEFAULT_EVM_PRIVATE_KEY_ID = 'default-evm-alice';
export const DEFAULT_EVM_PRIVATE_KEY_VALUE =
  '0xf78a036930ce63791ea6ea20072986d8c3f16a6811f6a2583b0787c45086f769';

export const DEFAULT_EVM_RPC_PROFILE: RpcProfile = {
  id: DEFAULT_EVM_PROVIDER_ID,
  mode: 'evm',
  name: 'LocalNode0',
  nativeCurrencySymbol: 'QARE',
  rpcUrl: 'http://127.0.0.1:8545',
  restUrl: null,
  wsUrl: null,
  createdAt: DEFAULT_TIMESTAMP,
  updatedAt: DEFAULT_TIMESTAMP,
};

export const DEFAULT_COSMOS_PROVIDER_ID = 'default-cosmos-localnode0';
export const DEFAULT_COSMOS_RPC_PROFILE: RpcProfile = {
  id: DEFAULT_COSMOS_PROVIDER_ID,
  mode: 'cosmos',
  name: 'LocalNode0',
  nativeCurrencySymbol: null,
  rpcUrl: 'http://127.0.0.1:26657',
  restUrl: 'http://127.0.0.1:1317',
  wsUrl: 'ws://127.0.0.1:26657/websocket',
  createdAt: DEFAULT_TIMESTAMP,
  updatedAt: DEFAULT_TIMESTAMP,
};

export function getDefaultGuestRpcProfiles() {
  return [DEFAULT_EVM_RPC_PROFILE, DEFAULT_COSMOS_RPC_PROFILE];
}

export function getDefaultGuestSelectedRpcProfiles() {
  return {
    evm: DEFAULT_EVM_RPC_PROFILE.id,
    cosmos: DEFAULT_COSMOS_RPC_PROFILE.id,
  } as const;
}

export function getDefaultAliceAddress() {
  return privateKeyToAccount(DEFAULT_EVM_PRIVATE_KEY_VALUE).address;
}
