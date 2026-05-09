'use client';

import 'client-only';

import { isQuarixChainId } from '@/domains/cosmos/chain-features';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import type { RpcProfile } from '@/platform/workbench/rpc-profile';

export const COSMOS_CHAIN_STATE_CHANGED_EVENT = 'chaindev:cosmos-chain-state-changed';

type TendermintStatusResponse = {
  result?: {
    node_info?: {
      network?: string;
    };
  };
};

export type CosmosChainState = {
  profileId: string | null;
  rpcUrl: string | null;
  restUrl: string | null;
  chainId: string | null;
  isQuarix: boolean;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

const initialCosmosChainState: CosmosChainState = {
  profileId: null,
  rpcUrl: null,
  restUrl: null,
  chainId: null,
  isQuarix: false,
  loading: false,
  error: null,
  fetchedAt: null,
};

let cosmosChainState: CosmosChainState = initialCosmosChainState;
let refreshSequence = 0;
let inFlightRefresh: Promise<CosmosChainState> | null = null;

function areChainStatesEqual(left: CosmosChainState, right: CosmosChainState) {
  return (
    left.profileId === right.profileId &&
    left.rpcUrl === right.rpcUrl &&
    left.restUrl === right.restUrl &&
    left.chainId === right.chainId &&
    left.isQuarix === right.isQuarix &&
    left.loading === right.loading &&
    left.error === right.error &&
    left.fetchedAt === right.fetchedAt
  );
}

function emitCosmosChainStateChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(COSMOS_CHAIN_STATE_CHANGED_EVENT, { detail: cosmosChainState }));
}

function setCosmosChainState(next: CosmosChainState) {
  if (areChainStatesEqual(cosmosChainState, next)) {
    return cosmosChainState;
  }

  cosmosChainState = next;
  emitCosmosChainStateChanged();
  return cosmosChainState;
}

function resetCosmosChainStateForProfile(profile: RpcProfile | null | undefined) {
  const isSameProfile =
    Boolean(profile) &&
    cosmosChainState.profileId === profile?.id &&
    cosmosChainState.rpcUrl === profile?.rpcUrl &&
    cosmosChainState.restUrl === profile?.restUrl;

  return setCosmosChainState({
    profileId: profile?.id ?? null,
    rpcUrl: profile?.rpcUrl ?? null,
    restUrl: profile?.restUrl ?? null,
    chainId: isSameProfile ? cosmosChainState.chainId : null,
    isQuarix: isSameProfile ? cosmosChainState.isQuarix : false,
    loading: Boolean(profile?.rpcUrl),
    error: null,
    fetchedAt: isSameProfile ? cosmosChainState.fetchedAt : null,
  });
}

export function getCosmosChainState() {
  return cosmosChainState;
}

export function isCosmosChainStateForProfile(profile: RpcProfile | null | undefined) {
  if (!profile) {
    return false;
  }

  return cosmosChainState.profileId === profile.id && cosmosChainState.rpcUrl === profile.rpcUrl && cosmosChainState.restUrl === profile.restUrl;
}

export function isActiveCosmosQuarixChainForProfile(profile: RpcProfile | null | undefined) {
  return isCosmosChainStateForProfile(profile) && cosmosChainState.isQuarix;
}

export function subscribeCosmosChainState(listener: (state: CosmosChainState) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStateChanged = () => listener(cosmosChainState);

  window.addEventListener(COSMOS_CHAIN_STATE_CHANGED_EVENT, handleStateChanged);
  return () => window.removeEventListener(COSMOS_CHAIN_STATE_CHANGED_EVENT, handleStateChanged);
}

export async function refreshCosmosChainState() {
  if (typeof window === 'undefined') {
    return cosmosChainState;
  }

  const profile = readActiveRpcProfileCookie('cosmos');
  const sequence = ++refreshSequence;

  if (!profile?.rpcUrl) {
    return resetCosmosChainStateForProfile(profile);
  }

  resetCosmosChainStateForProfile(profile);

  const refreshPromise = fetch(`${profile.rpcUrl}/status`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load Cosmos status: ${response.status}`);
      }

      return (await response.json()) as TendermintStatusResponse;
    })
    .then((payload) => {
      if (sequence !== refreshSequence) {
        return cosmosChainState;
      }

      const chainId = payload.result?.node_info?.network?.trim() || null;

      return setCosmosChainState({
        profileId: profile.id,
        rpcUrl: profile.rpcUrl,
        restUrl: profile.restUrl,
        chainId,
        isQuarix: isQuarixChainId(chainId),
        loading: false,
        error: null,
        fetchedAt: Date.now(),
      });
    })
    .catch((error) => {
      if (sequence !== refreshSequence) {
        return cosmosChainState;
      }

      return setCosmosChainState({
        profileId: profile.id,
        rpcUrl: profile.rpcUrl,
        restUrl: profile.restUrl,
        chainId: null,
        isQuarix: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load Cosmos status.',
        fetchedAt: Date.now(),
      });
    })
    .finally(() => {
      inFlightRefresh = null;
    });

  inFlightRefresh = refreshPromise;
  return refreshPromise;
}

export function ensureCosmosChainState() {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const profile = readActiveRpcProfileCookie('cosmos');

  if (profile?.rpcUrl && isCosmosChainStateForProfile(profile) && cosmosChainState.fetchedAt != null) {
    return Promise.resolve(cosmosChainState);
  }

  return refreshCosmosChainState();
}
