import { privateKeyToAccount } from 'viem/accounts';
import type { RpcProfile } from '@/platform/workbench/rpc-profile';
import {
  readBootstrapCosmosProvider,
  readBootstrapEvmProvider,
  readBootstrapPrivateKey,
  readBootstrapPrivateKeyName,
} from '@/platform/workbench/bootstrap-config';

const DEFAULT_TIMESTAMP = 1;
const bootstrapEvmProvider = readBootstrapEvmProvider();
const bootstrapCosmosProvider = readBootstrapCosmosProvider();

export const DEFAULT_EVM_PROVIDER_ID = 'default-evm-localnode0';
export const DEFAULT_EVM_PRIVATE_KEY_ID = 'default-evm-alice';
export const DEFAULT_EVM_PRIVATE_KEY_NAME = readBootstrapPrivateKeyName();
export const DEFAULT_EVM_PRIVATE_KEY_VALUE = readBootstrapPrivateKey();

export const DEFAULT_EVM_RPC_PROFILE: RpcProfile = {
  id: DEFAULT_EVM_PROVIDER_ID,
  mode: 'evm',
  name: bootstrapEvmProvider.name,
  nativeCurrencySymbol: bootstrapEvmProvider.nativeCurrencySymbol ?? 'QARE',
  rpcUrl: bootstrapEvmProvider.rpcUrl,
  restUrl: bootstrapEvmProvider.restUrl ?? null,
  wsUrl: bootstrapEvmProvider.wsUrl ?? null,
  createdAt: DEFAULT_TIMESTAMP,
  updatedAt: DEFAULT_TIMESTAMP,
};

export const DEFAULT_COSMOS_PROVIDER_ID = 'default-cosmos-localnode0';
export const DEFAULT_COSMOS_RPC_PROFILE: RpcProfile = {
  id: DEFAULT_COSMOS_PROVIDER_ID,
  mode: 'cosmos',
  name: bootstrapCosmosProvider.name,
  nativeCurrencySymbol: bootstrapCosmosProvider.nativeCurrencySymbol ?? null,
  rpcUrl: bootstrapCosmosProvider.rpcUrl,
  restUrl: bootstrapCosmosProvider.restUrl,
  wsUrl: bootstrapCosmosProvider.wsUrl ?? null,
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
  return privateKeyToAccount(
    DEFAULT_EVM_PRIVATE_KEY_VALUE as `0x${string}`,
  ).address;
}
