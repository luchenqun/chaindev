'use client';

import type { PlatformMode } from '@/config/chains';
import {
  getActiveRpcProfileCookieName,
  getGuestFallbackRpcProfile,
  LOCAL_RPC_PROFILES_STORAGE_KEY,
  LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY,
  parseActiveRpcProfileCookie,
  type RpcProfile,
  type RpcProfileDraft,
  type SelectedRpcProfileMap,
} from '@/platform/workbench/rpc-profile';
import {
  getDefaultGuestRpcProfiles,
  getDefaultGuestSelectedRpcProfiles,
} from '@/platform/workbench/defaults';

type RpcProfilesResponse = {
  ok: boolean;
  data: RpcProfile[];
};

function readJsonStorage<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function notifyActiveRpcProfileChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('chaindev:active-rpc-profile-changed'));
}

function createAuthRequiredError() {
  const error = new Error('AUTH_REQUIRED');
  error.name = 'AuthRequiredError';
  return error;
}

export function listLocalRpcProfiles() {
  return readJsonStorage<RpcProfile[]>(LOCAL_RPC_PROFILES_STORAGE_KEY, []);
}

export function listLocalRpcProfilesByMode(mode: PlatformMode) {
  return listLocalRpcProfiles().filter((profile) => profile.mode === mode);
}

export function getLocalSelectedRpcProfiles() {
  return readJsonStorage<SelectedRpcProfileMap>(
    LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY,
    {},
  );
}

export function replaceLocalRpcProfiles(profiles: RpcProfile[]) {
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, profiles);
}

export function replaceLocalSelectedRpcProfiles(
  selected: SelectedRpcProfileMap,
) {
  writeJsonStorage(LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY, selected);
}

export function setLocalSelectedRpcProfile(
  mode: PlatformMode,
  profileId: string | null,
) {
  const next = {
    ...getLocalSelectedRpcProfiles(),
  };

  if (profileId) {
    next[mode] = profileId;
  } else {
    delete next[mode];
  }

  writeJsonStorage(LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY, next);
}

export function saveLocalRpcProfile(input: RpcProfileDraft) {
  const now = Date.now();
  const profile: RpcProfile = {
    id: crypto.randomUUID(),
    mode: input.mode,
    name: input.name,
    nativeCurrencySymbol:
      input.mode === 'evm' ? input.nativeCurrencySymbol : null,
    rpcUrl: input.rpcUrl,
    restUrl: input.mode === 'cosmos' ? input.restUrl : null,
    createdAt: now,
    updatedAt: now,
  };
  const next = [profile, ...listLocalRpcProfiles()];
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, next);
  setLocalSelectedRpcProfile(profile.mode, profile.id);
  return profile;
}

export function updateLocalRpcProfile(
  profileId: string,
  input: RpcProfileDraft,
) {
  const profiles = listLocalRpcProfiles();
  const previous = profiles.find((profile) => profile.id === profileId);

  if (!previous) {
    throw new Error('Provider not found.');
  }

  const updated: RpcProfile = {
    ...previous,
    mode: input.mode,
    name: input.name,
    nativeCurrencySymbol:
      input.mode === 'evm' ? input.nativeCurrencySymbol : null,
    rpcUrl: input.rpcUrl,
    restUrl: input.mode === 'cosmos' ? input.restUrl : null,
    updatedAt: Date.now(),
  };
  const next = [
    updated,
    ...profiles.filter((profile) => profile.id !== profileId),
  ];
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, next);
  setLocalSelectedRpcProfile(updated.mode, updated.id);
  return updated;
}

export function deleteLocalRpcProfile(mode: PlatformMode, profileId: string) {
  const remaining = listLocalRpcProfiles().filter(
    (profile) => profile.id !== profileId,
  );
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, remaining);

  const selected = getLocalSelectedRpcProfiles();
  if (selected[mode] === profileId) {
    const fallback = remaining.find((profile) => profile.mode === mode) ?? null;
    setLocalSelectedRpcProfile(mode, fallback?.id ?? null);
    return fallback;
  }

  return (
    remaining.find(
      (profile) => profile.mode === mode && profile.id === selected[mode],
    ) ?? null
  );
}

export async function fetchRpcProfiles() {
  const response = await fetch('/api/workbench/rpc-profiles', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    return {
      source: 'guest' as const,
      profiles: getDefaultGuestRpcProfiles(),
      selected: getDefaultGuestSelectedRpcProfiles(),
    };
  }

  if (!response.ok) {
    throw new Error('Failed to load RPC providers.');
  }

  const body = (await response.json()) as RpcProfilesResponse;

  if (!body.data.length) {
    return {
      source: 'server' as const,
      profiles: [],
      selected: getLocalSelectedRpcProfiles(),
    };
  }

  return {
    source: 'server' as const,
    profiles: body.data,
    selected: getLocalSelectedRpcProfiles(),
  };
}

export async function createRpcProfile(input: RpcProfileDraft) {
  const response = await fetch('/api/workbench/rpc-profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? 'Failed to save RPC provider.');
  }

  const body = (await response.json()) as { ok: boolean; data: RpcProfile };
  setLocalSelectedRpcProfile(body.data.mode, body.data.id);

  return {
    source: 'server' as const,
    profile: body.data,
  };
}

export async function editRpcProfile(
  profileId: string,
  input: RpcProfileDraft,
) {
  const response = await fetch('/api/workbench/rpc-profiles', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: profileId,
      profile: input,
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? 'Failed to update RPC provider.');
  }

  const body = (await response.json()) as { ok: boolean; data: RpcProfile };
  setLocalSelectedRpcProfile(body.data.mode, body.data.id);

  return {
    source: 'server' as const,
    profile: body.data,
  };
}

export async function removeRpcProfile(mode: PlatformMode, profileId: string) {
  const response = await fetch(
    `/api/workbench/rpc-profiles?id=${encodeURIComponent(profileId)}`,
    {
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? 'Failed to delete RPC provider.');
  }

  const body = (await response.json()) as { ok: boolean; data: { id: string } };
  return {
    source: 'server' as const,
    fallbackProfile: null,
    deletedId: body.data.id,
  };
}

export function writeActiveRpcProfileCookie(profile: RpcProfile | null) {
  const name = getActiveRpcProfileCookieName(profile?.mode ?? 'evm');

  if (!profile) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    notifyActiveRpcProfileChanged();
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(profile))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  notifyActiveRpcProfileChanged();
}

export function clearActiveRpcProfileCookie(mode: PlatformMode) {
  document.cookie = `${getActiveRpcProfileCookieName(mode)}=; Max-Age=0; Path=/; SameSite=Lax`;
  notifyActiveRpcProfileChanged();
}

export function readActiveRpcProfileCookie(mode: PlatformMode) {
  if (typeof document === 'undefined') {
    return getGuestFallbackRpcProfile(mode);
  }

  const pair = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${getActiveRpcProfileCookieName(mode)}=`));

  if (!pair) {
    return getGuestFallbackRpcProfile(mode);
  }

  return (
    parseActiveRpcProfileCookie(pair.slice(pair.indexOf('=') + 1)) ??
    getGuestFallbackRpcProfile(mode)
  );
}
