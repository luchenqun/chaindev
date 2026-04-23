'use client';

import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

export type CosmosAddressTagItem = {
  address: string;
  addressLower: string;
  nameTag: string;
  updatedAt: number;
};

type ServerAddressTagItem = CosmosAddressTagItem & {
  providerProfileId: string;
  providerName: string | null;
};

type AddressTagCache = Record<string, CosmosAddressTagItem[]>;

const listeners = new Set<() => void>();

let cache: AddressTagCache = {};
let loadingPromise: Promise<void> | null = null;
let loaded = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeAddress(address: string) {
  const normalized = address.trim().toLowerCase();

  if (!normalized) {
    throw new Error('Invalid Cosmos address');
  }

  return normalized;
}

function getActiveTagScope() {
  return readActiveRpcProfileCookie('cosmos')?.id ?? 'default';
}

function sortItems(items: CosmosAddressTagItem[]) {
  return [...items].sort((left, right) => right.updatedAt - left.updatedAt || left.address.localeCompare(right.address));
}

function getScopedItems(scope = getActiveTagScope()) {
  return cache[scope] ?? [];
}

function mapServerData(items: ServerAddressTagItem[]) {
  return items.reduce<AddressTagCache>((accumulator, item) => {
    const scopeItems = accumulator[item.providerProfileId] ?? [];

    scopeItems.push({
      address: item.address,
      addressLower: item.addressLower,
      nameTag: item.nameTag,
      updatedAt: item.updatedAt,
    });

    accumulator[item.providerProfileId] = scopeItems;
    return accumulator;
  }, {});
}

async function parseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

function createAuthRequiredError() {
  const error = new Error('AUTH_REQUIRED');
  error.name = 'AuthRequiredError';
  return error;
}

function ensureLoaded() {
  if (loaded || loadingPromise) {
    return;
  }

  loadingPromise = syncCosmosAddressTagsFromServer().finally(() => {
    loadingPromise = null;
  });
}

export async function syncCosmosAddressTagsFromServer() {
  const response = await fetch('/api/workbench/cosmos/address-tags', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    cache = {};
    loaded = true;
    emitChange();
    return;
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to load address tags.'));
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: ServerAddressTagItem[];
  };
  cache = mapServerData(body.data);
  loaded = true;
  emitChange();
}

export function getCosmosAddressTag(address: string) {
  ensureLoaded();

  const addressLower = normalizeAddress(address);
  return getScopedItems().find((item) => item.addressLower === addressLower)?.nameTag ?? null;
}

export function getCosmosAddressTags(addresses: string[]) {
  ensureLoaded();

  const scopedItems = getScopedItems();

  return Object.fromEntries(
    addresses
      .filter((address) => Boolean(address.trim()))
      .map((address) => [address, scopedItems.find((item) => item.addressLower === address.trim().toLowerCase())?.nameTag ?? null]),
  ) as Record<string, string | null>;
}

export async function upsertCosmosAddressTag(address: string, nameTag: string) {
  const normalizedNameTag = nameTag.trim();

  if (!normalizedNameTag) {
    return deleteCosmosAddressTag(address);
  }

  const activeProfile = readActiveRpcProfileCookie('cosmos');

  if (!activeProfile) {
    throw new Error('No active Cosmos provider selected.');
  }

  const response = await fetch('/api/workbench/cosmos/address-tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      providerProfileId: activeProfile.id,
      providerName: activeProfile.name,
      address,
      nameTag: normalizedNameTag,
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to save name tag.'));
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: ServerAddressTagItem;
  };
  const scope = body.data.providerProfileId;
  const nextItem: CosmosAddressTagItem = {
    address: body.data.address,
    addressLower: body.data.addressLower,
    nameTag: body.data.nameTag,
    updatedAt: body.data.updatedAt,
  };

  cache = {
    ...cache,
    [scope]: sortItems([nextItem, ...getScopedItems(scope).filter((item) => item.addressLower !== nextItem.addressLower)]),
  };
  loaded = true;
  emitChange();
}

export async function deleteCosmosAddressTag(address: string) {
  const activeProfile = readActiveRpcProfileCookie('cosmos');

  if (!activeProfile) {
    throw new Error('No active Cosmos provider selected.');
  }

  const response = await fetch(
    `/api/workbench/cosmos/address-tags?providerProfileId=${encodeURIComponent(activeProfile.id)}&address=${encodeURIComponent(address)}`,
    {
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to delete name tag.'));
  }

  const normalizedAddressLower = normalizeAddress(address);
  cache = {
    ...cache,
    [activeProfile.id]: getScopedItems(activeProfile.id).filter((item) => item.addressLower !== normalizedAddressLower),
  };
  loaded = true;
  emitChange();
}

export function subscribeCosmosAddressTags(listener: () => void) {
  listeners.add(listener);
  ensureLoaded();

  return () => {
    listeners.delete(listener);
  };
}
