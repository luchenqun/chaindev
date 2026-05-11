'use client';

import 'client-only';

import { isQuarixEvmChainId } from '@/domains/evm/chain-features';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import type { RpcProfile } from '@/platform/workbench/rpc-profile';

export const EVM_CHAIN_STATE_CHANGED_EVENT = 'chaindev:evm-chain-state-changed';

export type EvmChainState = {
  profileId: string | null;
  rpcUrl: string | null;
  chainId: string | null;
  isQuarix: boolean;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

const initialEvmChainState: EvmChainState = {
  profileId: null,
  rpcUrl: null,
  chainId: null,
  isQuarix: false,
  loading: false,
  error: null,
  fetchedAt: null,
};

let evmChainState: EvmChainState = initialEvmChainState;
let refreshSequence = 0;
let inFlightRefresh: Promise<EvmChainState> | null = null;

function areChainStatesEqual(left: EvmChainState, right: EvmChainState) {
  return (
    left.profileId === right.profileId &&
    left.rpcUrl === right.rpcUrl &&
    left.chainId === right.chainId &&
    left.isQuarix === right.isQuarix &&
    left.loading === right.loading &&
    left.error === right.error &&
    left.fetchedAt === right.fetchedAt
  );
}

function emitEvmChainStateChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(EVM_CHAIN_STATE_CHANGED_EVENT, { detail: evmChainState }));
}

function setEvmChainState(next: EvmChainState) {
  if (areChainStatesEqual(evmChainState, next)) {
    return evmChainState;
  }

  evmChainState = next;
  emitEvmChainStateChanged();
  return evmChainState;
}

function resetEvmChainStateForProfile(profile: RpcProfile | null | undefined) {
  const isSameProfile = Boolean(profile) && evmChainState.profileId === profile?.id && evmChainState.rpcUrl === profile?.rpcUrl;

  return setEvmChainState({
    profileId: profile?.id ?? null,
    rpcUrl: profile?.rpcUrl ?? null,
    chainId: isSameProfile ? evmChainState.chainId : null,
    isQuarix: isSameProfile ? evmChainState.isQuarix : false,
    loading: Boolean(profile?.rpcUrl),
    error: null,
    fetchedAt: isSameProfile ? evmChainState.fetchedAt : null,
  });
}

export function getEvmChainState() {
  return evmChainState;
}

export function isEvmChainStateForProfile(profile: RpcProfile | null | undefined) {
  if (!profile) {
    return false;
  }

  return evmChainState.profileId === profile.id && evmChainState.rpcUrl === profile.rpcUrl;
}

export function isActiveEvmQuarixChainForProfile(profile: RpcProfile | null | undefined) {
  return isEvmChainStateForProfile(profile) && evmChainState.isQuarix;
}

export function subscribeEvmChainState(listener: (state: EvmChainState) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStateChanged = () => listener(evmChainState);

  window.addEventListener(EVM_CHAIN_STATE_CHANGED_EVENT, handleStateChanged);
  return () => window.removeEventListener(EVM_CHAIN_STATE_CHANGED_EVENT, handleStateChanged);
}

export async function refreshEvmChainState() {
  if (typeof window === 'undefined') {
    return evmChainState;
  }

  const profile = readActiveRpcProfileCookie('evm');
  const sequence = ++refreshSequence;

  if (!profile?.rpcUrl) {
    return resetEvmChainStateForProfile(profile);
  }

  resetEvmChainStateForProfile(profile);

  const refreshPromise = createEvmClient(profile.rpcUrl)
    .getChainId()
    .then((chainId) => {
      if (sequence !== refreshSequence) {
        return evmChainState;
      }

      const normalizedChainId = String(chainId);

      return setEvmChainState({
        profileId: profile.id,
        rpcUrl: profile.rpcUrl,
        chainId: normalizedChainId,
        isQuarix: isQuarixEvmChainId(normalizedChainId),
        loading: false,
        error: null,
        fetchedAt: Date.now(),
      });
    })
    .catch((error) => {
      if (sequence !== refreshSequence) {
        return evmChainState;
      }

      return setEvmChainState({
        profileId: profile.id,
        rpcUrl: profile.rpcUrl,
        chainId: null,
        isQuarix: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load EVM chain id.',
        fetchedAt: Date.now(),
      });
    })
    .finally(() => {
      inFlightRefresh = null;
    });

  inFlightRefresh = refreshPromise;
  return refreshPromise;
}

export function ensureEvmChainState() {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const profile = readActiveRpcProfileCookie('evm');

  if (profile?.rpcUrl && isEvmChainStateForProfile(profile) && evmChainState.fetchedAt != null) {
    return Promise.resolve(evmChainState);
  }

  return refreshEvmChainState();
}
