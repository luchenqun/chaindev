'use client';

import { type Hex } from 'viem';
import { z } from 'zod';
import { DEFAULT_EVM_PRIVATE_KEY_ID, DEFAULT_EVM_PRIVATE_KEY_NAME, DEFAULT_EVM_PRIVATE_KEY_VALUE, getDefaultAliceAddress } from '@/platform/workbench/defaults';

const serverKeyItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  address: z.string().min(1),
  addressLower: z.string().min(1),
  securityMode: z.enum(['encrypted', 'plain']),
  privateKey: z.string().min(1).nullable(),
  encryptedPrivateKey: z.string().min(1).nullable(),
  iv: z.string().min(1).nullable(),
  salt: z.string().min(1).nullable(),
  authTag: z.string().min(1).nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  lastUsedAt: z.number().int().nonnegative().nullable(),
});

const serverKeyListResponseSchema = z.object({
  ok: z.boolean(),
  data: z.array(serverKeyItemSchema),
});

const serverKeyResponseSchema = z.object({
  ok: z.boolean(),
  data: serverKeyItemSchema,
});

const unlockedPrivateKeyResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({
    id: z.string().min(1),
    privateKey: z.string().min(1),
  }),
});

export type EvmStoredPrivateKeySecurityMode = 'encrypted' | 'plain';
export type EvmStoredPrivateKey = {
  id: string;
  name: string;
  address: string;
  addressLower: string;
  securityMode: EvmStoredPrivateKeySecurityMode;
  encryptedPrivateKey: string | null;
  privateKey: string | null;
  iv: string | null;
  salt: string | null;
  authTag: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

type KeyringSource = 'guest' | 'server';

const ACTIVE_KEY_COOKIE_NAME = 'chaindev-active-evm-private-key-id';
const listeners = new Set<() => void>();

let cache: {
  items: EvmStoredPrivateKey[];
  activeKeyId: string | null;
  source: KeyringSource;
  loaded: boolean;
} = {
  items: [],
  activeKeyId: null,
  source: 'guest',
  loaded: false,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getGuestDefaultKey(): EvmStoredPrivateKey {
  const address = getDefaultAliceAddress();

  return {
    id: DEFAULT_EVM_PRIVATE_KEY_ID,
    name: DEFAULT_EVM_PRIVATE_KEY_NAME,
    address,
    addressLower: address.toLowerCase(),
    securityMode: 'plain',
    encryptedPrivateKey: null,
    privateKey: DEFAULT_EVM_PRIVATE_KEY_VALUE,
    iv: null,
    salt: null,
    authTag: null,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
  };
}

function getFallbackStore() {
  const item = getGuestDefaultKey();

  return {
    items: [item],
    activeKeyId: item.id,
    source: 'guest' as const,
    loaded: true,
  };
}

function readActiveKeyCookie() {
  if (typeof document === 'undefined') {
    return null;
  }

  const pair = document.cookie.split('; ').find((item) => item.startsWith(`${ACTIVE_KEY_COOKIE_NAME}=`));

  return pair ? decodeURIComponent(pair.slice(pair.indexOf('=') + 1)) : null;
}

function writeActiveKeyCookie(value: string | null) {
  if (typeof document === 'undefined') {
    return;
  }

  if (!value) {
    document.cookie = `${ACTIVE_KEY_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    return;
  }

  document.cookie = `${ACTIVE_KEY_COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
}

function mapServerItem(item: z.infer<typeof serverKeyItemSchema>): EvmStoredPrivateKey {
  return {
    id: item.id,
    name: item.name,
    address: item.address,
    addressLower: item.addressLower,
    securityMode: item.securityMode,
    encryptedPrivateKey: item.encryptedPrivateKey,
    privateKey: item.privateKey,
    iv: item.iv,
    salt: item.salt,
    authTag: item.authTag,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastUsedAt: item.lastUsedAt,
  };
}

function mergeServerKeyItem(current: EvmStoredPrivateKey | undefined, next: EvmStoredPrivateKey) {
  if (!current || next.securityMode !== 'encrypted' || !current.privateKey) {
    return next;
  }

  return {
    ...next,
    privateKey: current.privateKey,
  };
}

function applyCache(items: EvmStoredPrivateKey[], source: KeyringSource) {
  const cookieActiveKeyId = readActiveKeyCookie();
  const activeKeyId = cookieActiveKeyId && items.some((item) => item.id === cookieActiveKeyId) ? cookieActiveKeyId : (items[0]?.id ?? null);

  cache = {
    items,
    activeKeyId,
    source,
    loaded: true,
  };

  writeActiveKeyCookie(activeKeyId);
  emitChange();
  return cache;
}

function getCache() {
  if (!cache.loaded) {
    cache = getFallbackStore();
  }

  return cache;
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

async function requestKeyring(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  return response;
}

export async function syncEvmKeyringFromServer() {
  const response = await fetch('/api/workbench/evm/private-keys', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    return applyCache(getFallbackStore().items, 'guest');
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to load private keys.'));
  }

  const body = serverKeyListResponseSchema.parse(await response.json());
  const previousItemsById = new Map(getCache().items.map((item) => [item.id, item]));
  return applyCache(
    body.data.map(mapServerItem).map((item) => mergeServerKeyItem(previousItemsById.get(item.id), item)),
    'server',
  );
}

export function getEvmKeyringSource() {
  return getCache().source;
}

export function listEvmStoredPrivateKeys() {
  return getCache().items;
}

export function getEvmStoredPrivateKey(itemId: string) {
  return getCache().items.find((item) => item.id === itemId) ?? null;
}

export function getActiveEvmStoredPrivateKey() {
  const store = getCache();
  return store.items.find((item) => item.id === store.activeKeyId) ?? store.items[0] ?? null;
}

export function isEvmStoredPrivateKeyUnlocked(itemId: string) {
  const item = getCache().items.find((candidate) => candidate.id === itemId);
  return Boolean(item && (item.securityMode === 'plain' || item.privateKey));
}

export function countUnlockedEvmStoredPrivateKeys() {
  return getCache().items.filter((item) => item.securityMode === 'plain' || item.privateKey).length;
}

export async function createEvmStoredPrivateKey(input: { name: string; privateKey: string; securityMode: EvmStoredPrivateKeySecurityMode; password?: string }) {
  const response = await requestKeyring('/api/workbench/evm/private-keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      privateKey: input.privateKey,
      securityMode: input.securityMode,
      password: input.securityMode === 'encrypted' ? input.password : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to save private key.'));
  }

  const body = serverKeyResponseSchema.parse(await response.json());
  const item = mapServerItem(body.data);
  const store = getCache();
  applyCache([item, ...store.items.filter((current) => current.id !== item.id)], 'server');
  return item;
}

export async function renameEvmStoredPrivateKey(itemId: string, name: string) {
  const response = await requestKeyring('/api/workbench/evm/private-keys', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: itemId,
      name,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to rename private key.'));
  }

  const body = serverKeyResponseSchema.parse(await response.json());
  const item = mapServerItem(body.data);
  const store = getCache();
  applyCache(
    store.items.map((current) => (current.id === item.id ? mergeServerKeyItem(current, item) : current)),
    'server',
  );
  return item;
}

export async function updateEvmStoredPrivateKey(input: { id: string; name: string; privateKey: string; securityMode: EvmStoredPrivateKeySecurityMode; password?: string }) {
  const response = await requestKeyring('/api/workbench/evm/private-keys', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: input.id,
      action: 'update',
      name: input.name,
      privateKey: input.privateKey,
      securityMode: input.securityMode,
      password: input.securityMode === 'encrypted' ? input.password : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to update private key.'));
  }

  const body = serverKeyResponseSchema.parse(await response.json());
  const item = mapServerItem(body.data);
  const store = getCache();
  applyCache(
    store.items.map((current) => (current.id === item.id ? mergeServerKeyItem(current, item) : current)),
    'server',
  );
  return item;
}

export function setActiveEvmStoredPrivateKey(itemId: string) {
  const store = getCache();

  if (!store.items.some((item) => item.id === itemId)) {
    throw new Error('Selected private key was not found.');
  }

  cache = {
    ...store,
    activeKeyId: itemId,
  };
  writeActiveKeyCookie(itemId);
  emitChange();
}

export async function deleteEvmStoredPrivateKey(itemId: string) {
  const response = await requestKeyring(`/api/workbench/evm/private-keys?id=${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to delete private key.'));
  }

  const store = getCache();
  const remainingItems = store.items.filter((item) => item.id !== itemId);

  if (!remainingItems.length && store.source === 'server') {
    await syncEvmKeyringFromServer();
    return;
  }

  applyCache(remainingItems, store.source);
}

export async function unlockEvmStoredPrivateKey(itemId: string, password: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    throw new Error('Private key entry not found.');
  }

  if (item.securityMode === 'plain') {
    return item;
  }

  const response = await requestKeyring('/api/workbench/evm/private-keys', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: itemId,
      action: 'unlock',
      password,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to unlock private key.'));
  }

  const body = unlockedPrivateKeyResponseSchema.parse(await response.json());
  const unlockedItem = {
    ...item,
    privateKey: body.data.privateKey,
  };
  const store = getCache();
  applyCache(
    store.items.map((current) => (current.id === itemId ? unlockedItem : current)),
    store.source,
  );
  return unlockedItem;
}

export function lockEvmStoredPrivateKey(itemId: string) {
  const store = getCache();
  const item = store.items.find((candidate) => candidate.id === itemId);

  if (!item || item.securityMode !== 'encrypted' || !item.privateKey) {
    return;
  }

  applyCache(
    store.items.map((current) =>
      current.id === itemId
        ? {
            ...current,
            privateKey: null,
          }
        : current,
    ),
    store.source,
  );
}

export async function peekEvmStoredPrivateKey(itemId: string, password?: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    throw new Error('Stored private key is unavailable.');
  }

  if (item.securityMode === 'encrypted') {
    if (item.privateKey) {
      return item.privateKey as Hex;
    }

    if (!password) {
      throw new Error('Password is required.');
    }

    return (await unlockEvmStoredPrivateKey(itemId, password)).privateKey as Hex;
  }

  if (!item.privateKey) {
    throw new Error('Stored private key is unavailable.');
  }

  return item.privateKey as Hex;
}

async function touchLastUsed(itemId: string) {
  const response = await fetch('/api/workbench/evm/private-keys', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: itemId,
      action: 'touch',
    }),
  });

  if (!response.ok) {
    return;
  }

  const body = serverKeyResponseSchema.parse(await response.json());
  const item = mapServerItem(body.data);
  const store = getCache();
  applyCache(
    store.items.map((current) => (current.id === item.id ? mergeServerKeyItem(current, item) : current)),
    store.source,
  );
}

export async function resolveEvmStoredPrivateKey(itemId: string, password?: string) {
  const privateKey = await peekEvmStoredPrivateKey(itemId, password);
  void touchLastUsed(itemId);
  return privateKey;
}

export function subscribeEvmKeyring(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
