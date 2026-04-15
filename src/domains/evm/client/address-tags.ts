'use client';

import { isAddress } from 'viem';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

export type EvmAddressTagItem = {
  address: string;
  addressLower: string;
  nameTag: string;
  updatedAt: number;
};

type ServerAddressTagItem = EvmAddressTagItem & {
  providerProfileId: string;
  providerName: string | null;
};

type AddressTagCache = Record<string, EvmAddressTagItem[]>;

const listeners = new Set<() => void>();

let cache: AddressTagCache = {};
let loadingPromise: Promise<void> | null = null;
let loaded = false;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error('Invalid EVM address');
  }

  return address.toLowerCase();
}

function getActiveTagScope() {
  return readActiveRpcProfileCookie('evm')?.id ?? 'default';
}

function sortItems(items: EvmAddressTagItem[]) {
  return [...items].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt ||
      left.address.localeCompare(right.address),
  );
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

  loadingPromise = syncEvmAddressTagsFromServer().finally(() => {
    loadingPromise = null;
  });
}

export async function syncEvmAddressTagsFromServer() {
  const response = await fetch('/api/workbench/evm/address-tags', {
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

export function getEvmAddressTag(address: string) {
  ensureLoaded();

  const addressLower = normalizeAddress(address);
  return (
    getScopedItems().find((item) => item.addressLower === addressLower)
      ?.nameTag ?? null
  );
}

export function getEvmAddressTags(addresses: string[]) {
  ensureLoaded();

  const scopedItems = getScopedItems();

  return Object.fromEntries(
    addresses
      .filter((address) => isAddress(address))
      .map((address) => [
        address,
        scopedItems.find((item) => item.addressLower === address.toLowerCase())
          ?.nameTag ?? null,
      ]),
  ) as Record<string, string | null>;
}

export function listEvmAddressTags(): EvmAddressTagItem[] {
  ensureLoaded();
  return sortItems(getScopedItems());
}

export async function upsertEvmAddressTag(address: string, nameTag: string) {
  const normalizedNameTag = nameTag.trim();

  if (!normalizedNameTag) {
    return deleteEvmAddressTag(address);
  }

  const activeProfile = readActiveRpcProfileCookie('evm');

  if (!activeProfile) {
    throw new Error('No active EVM provider selected.');
  }

  const response = await fetch('/api/workbench/evm/address-tags', {
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
  const nextItem: EvmAddressTagItem = {
    address: body.data.address,
    addressLower: body.data.addressLower,
    nameTag: body.data.nameTag,
    updatedAt: body.data.updatedAt,
  };

  cache = {
    ...cache,
    [scope]: sortItems([
      nextItem,
      ...getScopedItems(scope).filter(
        (item) => item.addressLower !== nextItem.addressLower,
      ),
    ]),
  };
  loaded = true;
  emitChange();
}

export async function deleteEvmAddressTag(address: string) {
  const activeProfile = readActiveRpcProfileCookie('evm');

  if (!activeProfile) {
    throw new Error('No active EVM provider selected.');
  }

  const response = await fetch(
    `/api/workbench/evm/address-tags?providerProfileId=${encodeURIComponent(activeProfile.id)}&address=${encodeURIComponent(address)}`,
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
    [activeProfile.id]: getScopedItems(activeProfile.id).filter(
      (item) => item.addressLower !== normalizedAddressLower,
    ),
  };
  loaded = true;
  emitChange();
}

export async function clearEvmAddressTags() {
  const activeProfile = readActiveRpcProfileCookie('evm');

  if (!activeProfile) {
    throw new Error('No active EVM provider selected.');
  }

  const response = await fetch(
    `/api/workbench/evm/address-tags?providerProfileId=${encodeURIComponent(activeProfile.id)}&clear=1`,
    {
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to clear name tags.'));
  }

  cache = {
    ...cache,
    [activeProfile.id]: [],
  };
  loaded = true;
  emitChange();
}

export function subscribeEvmAddressTags(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
