'use client';

import type { PlatformMode } from '@/config/chains';
import {
  ACTIVE_PLATFORM_MODE_COOKIE_NAME,
  getDefaultActivePlatformMode,
  getActiveRpcProfileCookieName,
  getGuestFallbackRpcProfile,
  LOCAL_RPC_PROFILES_STORAGE_KEY,
  LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY,
  parseActiveRpcProfileCookie,
  type RpcProfile,
  type RpcProfileDraft,
  type SelectedRpcProfileMap,
} from '@/platform/workbench/rpc-profile';
import { getDefaultGuestRpcProfiles, getDefaultGuestSelectedRpcProfiles } from '@/platform/workbench/defaults';

type RpcProfilesResponse = {
  ok: boolean;
  data: RpcProfile[];
};

function getRpcProfileDedupKey(profile: RpcProfile) {
  return JSON.stringify({
    mode: profile.mode,
    name: profile.name,
    nativeCurrencySymbol: profile.nativeCurrencySymbol ?? null,
    rpcUrl: profile.rpcUrl,
    restUrl: profile.restUrl ?? null,
    wsUrl: profile.wsUrl ?? null,
  });
}

function dedupeRpcProfiles(profiles: RpcProfile[]) {
  const deduped = new Map<string, RpcProfile>();

  for (const profile of profiles) {
    const key = getRpcProfileDedupKey(profile);

    if (!deduped.has(key)) {
      deduped.set(key, profile);
    }
  }

  return [...deduped.values()];
}

function filterSelectedRpcProfiles(profiles: RpcProfile[], selected: SelectedRpcProfileMap) {
  const profileIds = new Set(profiles.map((profile) => profile.id));

  return Object.fromEntries(Object.entries(selected).filter(([, profileId]) => profileId && profileIds.has(profileId))) as SelectedRpcProfileMap;
}

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

function notifyRpcProfilesChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('chaindev:rpc-profiles-changed'));
}

function areJsonValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasActiveRpcProfileCookie(mode: PlatformMode) {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.cookie.split('; ').some((item) => item.startsWith(`${getActiveRpcProfileCookieName(mode)}=`));
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
  return readJsonStorage<SelectedRpcProfileMap>(LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY, {});
}

export function replaceLocalRpcProfiles(profiles: RpcProfile[]) {
  if (areJsonValuesEqual(listLocalRpcProfiles(), profiles)) {
    return false;
  }

  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, profiles);
  notifyRpcProfilesChanged();
  return true;
}

export function replaceLocalSelectedRpcProfiles(selected: SelectedRpcProfileMap) {
  if (areJsonValuesEqual(getLocalSelectedRpcProfiles(), selected)) {
    return false;
  }

  writeJsonStorage(LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY, selected);
  notifyRpcProfilesChanged();
  return true;
}

export function syncGuestRpcDefaults() {
  const profiles = getDefaultGuestRpcProfiles();
  const selected = getDefaultGuestSelectedRpcProfiles();

  replaceLocalRpcProfiles(profiles);
  replaceLocalSelectedRpcProfiles(selected);

  writeActiveRpcProfileCookie(profiles.find((profile) => profile.id === selected.evm) ?? getGuestFallbackRpcProfile('evm'));
  writeActiveRpcProfileCookie(profiles.find((profile) => profile.id === selected.cosmos) ?? getGuestFallbackRpcProfile('cosmos'));

  return {
    profiles,
    selected,
  };
}

export function setLocalSelectedRpcProfile(mode: PlatformMode, profileId: string | null) {
  const next = {
    ...getLocalSelectedRpcProfiles(),
  };

  if (profileId) {
    next[mode] = profileId;
  } else {
    delete next[mode];
  }

  writeJsonStorage(LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY, next);
  notifyRpcProfilesChanged();
}

export function saveLocalRpcProfile(input: RpcProfileDraft) {
  const now = Date.now();
  const profile: RpcProfile = {
    id: crypto.randomUUID(),
    mode: input.mode,
    name: input.name,
    nativeCurrencySymbol: input.mode === 'evm' ? input.nativeCurrencySymbol : null,
    rpcUrl: input.rpcUrl,
    restUrl: input.mode === 'cosmos' ? input.restUrl : null,
    wsUrl: input.mode === 'cosmos' ? input.wsUrl || null : null,
    createdAt: now,
    updatedAt: now,
  };
  const next = [profile, ...listLocalRpcProfiles()];
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, next);
  setLocalSelectedRpcProfile(profile.mode, profile.id);
  notifyRpcProfilesChanged();
  return profile;
}

export function updateLocalRpcProfile(profileId: string, input: RpcProfileDraft) {
  const profiles = listLocalRpcProfiles();
  const previous = profiles.find((profile) => profile.id === profileId);

  if (!previous) {
    throw new Error('Provider not found.');
  }

  const updated: RpcProfile = {
    ...previous,
    mode: input.mode,
    name: input.name,
    nativeCurrencySymbol: input.mode === 'evm' ? input.nativeCurrencySymbol : null,
    rpcUrl: input.rpcUrl,
    restUrl: input.mode === 'cosmos' ? input.restUrl : null,
    wsUrl: input.mode === 'cosmos' ? input.wsUrl || null : null,
    updatedAt: Date.now(),
  };
  const next = [updated, ...profiles.filter((profile) => profile.id !== profileId)];
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, next);
  setLocalSelectedRpcProfile(updated.mode, updated.id);
  notifyRpcProfilesChanged();
  return updated;
}

export function deleteLocalRpcProfile(mode: PlatformMode, profileId: string) {
  const remaining = listLocalRpcProfiles().filter((profile) => profile.id !== profileId);
  writeJsonStorage(LOCAL_RPC_PROFILES_STORAGE_KEY, remaining);
  notifyRpcProfilesChanged();

  const selected = getLocalSelectedRpcProfiles();
  if (selected[mode] === profileId) {
    const fallback = remaining.find((profile) => profile.mode === mode) ?? null;
    setLocalSelectedRpcProfile(mode, fallback?.id ?? null);
    return fallback;
  }

  return remaining.find((profile) => profile.mode === mode && profile.id === selected[mode]) ?? null;
}

export async function fetchRpcProfiles() {
  const response = await fetch('/api/workbench/rpc-profiles', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    const guestDefaults = syncGuestRpcDefaults();

    return {
      source: 'guest' as const,
      profiles: guestDefaults.profiles,
      selected: guestDefaults.selected,
    };
  }

  if (!response.ok) {
    throw new Error('Failed to load RPC providers.');
  }

  const body = (await response.json()) as RpcProfilesResponse;

  if (!body.data.length) {
    const selected = filterSelectedRpcProfiles([], getLocalSelectedRpcProfiles());

    return {
      source: 'server' as const,
      profiles: [],
      selected,
    };
  }

  const profiles = dedupeRpcProfiles(body.data);
  const selected = filterSelectedRpcProfiles(profiles, getLocalSelectedRpcProfiles());

  return {
    source: 'server' as const,
    profiles,
    selected,
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
  notifyRpcProfilesChanged();

  return {
    source: 'server' as const,
    profile: body.data,
  };
}

export async function editRpcProfile(profileId: string, input: RpcProfileDraft) {
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
  notifyRpcProfilesChanged();

  return {
    source: 'server' as const,
    profile: body.data,
  };
}

export async function removeRpcProfile(mode: PlatformMode, profileId: string) {
  const response = await fetch(`/api/workbench/rpc-profiles?id=${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
  });

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
  notifyRpcProfilesChanged();
  return {
    source: 'server' as const,
    fallbackProfile: null,
    deletedId: body.data.id,
  };
}

export function writeActiveRpcProfileCookie(profile: RpcProfile | null) {
  const name = getActiveRpcProfileCookieName(profile?.mode ?? 'evm');

  if (!profile) {
    if (!hasActiveRpcProfileCookie('evm')) {
      return;
    }

    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    notifyActiveRpcProfileChanged();
    return;
  }

  const current = readActiveRpcProfileCookie(profile.mode);

  if (areJsonValuesEqual(current, profile)) {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(profile))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  notifyActiveRpcProfileChanged();
}

export function writeActivePlatformModeCookie(mode: PlatformMode) {
  const previous = readActivePlatformModeCookie();

  document.cookie = `${ACTIVE_PLATFORM_MODE_COOKIE_NAME}=${mode}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;

  if (previous !== mode) {
    window.dispatchEvent(new CustomEvent('chaindev:active-platform-mode-changed'));
  }
}

export function readActivePlatformModeCookie() {
  if (typeof document === 'undefined') {
    return getDefaultActivePlatformMode();
  }

  const pair = document.cookie.split('; ').find((item) => item.startsWith(`${ACTIVE_PLATFORM_MODE_COOKIE_NAME}=`));

  if (!pair) {
    return getDefaultActivePlatformMode();
  }

  const value = pair.slice(pair.indexOf('=') + 1);
  return value === 'cosmos' ? 'cosmos' : getDefaultActivePlatformMode();
}

export function clearActiveRpcProfileCookie(mode: PlatformMode) {
  document.cookie = `${getActiveRpcProfileCookieName(mode)}=; Max-Age=0; Path=/; SameSite=Lax`;
  notifyActiveRpcProfileChanged();
}

export function readActiveRpcProfileCookie(mode: PlatformMode) {
  if (typeof document === 'undefined') {
    return getGuestFallbackRpcProfile(mode);
  }

  const pair = document.cookie.split('; ').find((item) => item.startsWith(`${getActiveRpcProfileCookieName(mode)}=`));

  if (!pair) {
    return getGuestFallbackRpcProfile(mode);
  }

  return parseActiveRpcProfileCookie(pair.slice(pair.indexOf('=') + 1)) ?? getGuestFallbackRpcProfile(mode);
}
