"use client";

import { privateKeyToAccount } from "viem/accounts";
import { type Hex } from "viem";
import { z } from "zod";

const securityModeSchema = z.enum(["encrypted", "plain"]);

const keyItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  address: z.string().min(1),
  addressLower: z.string().min(1),
  securityMode: securityModeSchema,
  encryptedPrivateKey: z.string().nullable(),
  privateKey: z.string().nullable(),
  iv: z.string().nullable(),
  salt: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  lastUsedAt: z.number().int().nonnegative().nullable(),
});

const keyringStoreSchema = z.object({
  items: z.array(keyItemSchema),
  activeKeyId: z.string().nullable(),
});

export type EvmStoredPrivateKey = z.infer<typeof keyItemSchema>;
export type EvmStoredPrivateKeySecurityMode = z.infer<typeof securityModeSchema>;

const STORAGE_KEY = "chaindev-evm-keyring-v1";
const listeners = new Set<() => void>();
const unlockedPrivateKeys = new Map<string, Hex>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getEmptyStore() {
  return {
    items: [],
    activeKeyId: null,
  } satisfies z.infer<typeof keyringStoreSchema>;
}

function readKeyringStore() {
  if (typeof window === "undefined") {
    return getEmptyStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return getEmptyStore();
    }

    const parsed = keyringStoreSchema.parse(JSON.parse(raw));
    const activeKeyId = parsed.activeKeyId && parsed.items.some((item) => item.id === parsed.activeKeyId)
      ? parsed.activeKeyId
      : null;

    return {
      ...parsed,
      activeKeyId,
    };
  } catch {
    return getEmptyStore();
  }
}

function writeKeyringStore(value: z.infer<typeof keyringStoreSchema>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function ensureCryptoSupport() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this browser.");
  }

  return window.crypto;
}

function normalizePrivateKey(privateKey: string) {
  let value = privateKey.trim();

  if (!value) {
    throw new Error("Private key is required.");
  }

  if (!value.startsWith("0x")) {
    value = `0x${value}`;
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Private key must be a 32-byte hex string.");
  }

  return value.toLowerCase() as Hex;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function derivePasswordKey(password: string, salt: Uint8Array) {
  const cryptoApi = ensureCryptoSupport();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPrivateKey(privateKey: Hex, password: string) {
  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    throw new Error("Password is required for encrypted keys.");
  }

  const cryptoApi = ensureCryptoSupport();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const derivedKey = await derivePasswordKey(trimmedPassword, salt);
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    derivedKey,
    encoder.encode(privateKey),
  );

  return {
    encryptedPrivateKey: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

async function decryptPrivateKeyRecord(item: EvmStoredPrivateKey, password: string) {
  if (item.securityMode !== "encrypted") {
    if (!item.privateKey) {
      throw new Error("Stored private key is unavailable.");
    }

    return normalizePrivateKey(item.privateKey);
  }

  if (!item.encryptedPrivateKey || !item.iv || !item.salt) {
    throw new Error("Encrypted private key data is incomplete.");
  }

  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    throw new Error("Password is required.");
  }

  try {
    const derivedKey = await derivePasswordKey(trimmedPassword, fromBase64(item.salt));
    const plaintext = await ensureCryptoSupport().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(fromBase64(item.iv)),
      },
      derivedKey,
      toArrayBuffer(fromBase64(item.encryptedPrivateKey)),
    );

    return normalizePrivateKey(decoder.decode(plaintext));
  } catch {
    throw new Error("Password is incorrect or the private key cannot be decrypted.");
  }
}

function getAddressFromPrivateKey(privateKey: Hex) {
  return privateKeyToAccount(privateKey).address;
}

function sortItems(items: EvmStoredPrivateKey[]) {
  return [...items];
}

function markItemUsed(store: z.infer<typeof keyringStoreSchema>, itemId: string) {
  const previous = store.items.find((item) => item.id === itemId);

  if (!previous) {
    return store;
  }

  const updated: EvmStoredPrivateKey = {
    ...previous,
    lastUsedAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    ...store,
    items: store.items.map((item) => (item.id === itemId ? updated : item)),
  };
}

export function listEvmStoredPrivateKeys() {
  const store = readKeyringStore();
  return sortItems(store.items);
}

export function getEvmStoredPrivateKey(itemId: string) {
  return readKeyringStore().items.find((item) => item.id === itemId) ?? null;
}

export function getActiveEvmStoredPrivateKey() {
  const store = readKeyringStore();

  if (!store.activeKeyId) {
    return null;
  }

  return store.items.find((item) => item.id === store.activeKeyId) ?? null;
}

export function isEvmStoredPrivateKeyUnlocked(itemId: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    return false;
  }

  return item.securityMode === "plain" || unlockedPrivateKeys.has(itemId);
}

export function countUnlockedEvmStoredPrivateKeys() {
  return listEvmStoredPrivateKeys().filter((item) => isEvmStoredPrivateKeyUnlocked(item.id)).length;
}

export async function createEvmStoredPrivateKey(input: {
  name: string;
  privateKey: string;
  securityMode: EvmStoredPrivateKeySecurityMode;
  password?: string;
}) {
  const store = readKeyringStore();
  const now = Date.now();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Key name is required.");
  }

  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const address = getAddressFromPrivateKey(normalizedPrivateKey);
  const addressLower = address.toLowerCase();

  if (store.items.some((item) => item.addressLower === addressLower)) {
    throw new Error("This private key address already exists.");
  }

  let encryptedPrivateKey: string | null = null;
  let privateKey: string | null = null;
  let iv: string | null = null;
  let salt: string | null = null;

  if (input.securityMode === "encrypted") {
    const encrypted = await encryptPrivateKey(normalizedPrivateKey, input.password ?? "");
    encryptedPrivateKey = encrypted.encryptedPrivateKey;
    iv = encrypted.iv;
    salt = encrypted.salt;
  } else {
    privateKey = normalizedPrivateKey;
  }

  const item: EvmStoredPrivateKey = {
    id: crypto.randomUUID(),
    name,
    address,
    addressLower,
    securityMode: input.securityMode,
    encryptedPrivateKey,
    privateKey,
    iv,
    salt,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };

  const nextStore = {
    items: [item, ...store.items],
    activeKeyId: store.activeKeyId ?? item.id,
  } satisfies z.infer<typeof keyringStoreSchema>;

  writeKeyringStore(nextStore);

  if (item.securityMode === "plain") {
    unlockedPrivateKeys.set(item.id, normalizedPrivateKey);
  }

  emitChange();
  return item;
}

export function renameEvmStoredPrivateKey(itemId: string, name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Key name is required.");
  }

  const store = readKeyringStore();
  const previous = store.items.find((item) => item.id === itemId);

  if (!previous) {
    throw new Error("Private key entry not found.");
  }

  const updated: EvmStoredPrivateKey = {
    ...previous,
    name: trimmedName,
    updatedAt: Date.now(),
  };

  writeKeyringStore({
    ...store,
    items: store.items.map((item) => (item.id === itemId ? updated : item)),
  });
  emitChange();
  return updated;
}

export function setActiveEvmStoredPrivateKey(itemId: string) {
  const store = readKeyringStore();

  if (!store.items.some((item) => item.id === itemId)) {
    throw new Error("Selected private key was not found.");
  }

  writeKeyringStore({
    ...store,
    activeKeyId: itemId,
  });
  emitChange();
}

export function deleteEvmStoredPrivateKey(itemId: string) {
  const store = readKeyringStore();
  const remainingItems = store.items.filter((item) => item.id !== itemId);
  const nextActiveKeyId =
    store.activeKeyId === itemId ? (remainingItems[0]?.id ?? null) : store.activeKeyId;

  unlockedPrivateKeys.delete(itemId);
  writeKeyringStore({
    items: remainingItems,
    activeKeyId: nextActiveKeyId,
  });
  emitChange();
}

export async function unlockEvmStoredPrivateKey(itemId: string, password: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    throw new Error("Private key entry not found.");
  }

  const normalizedPrivateKey = await decryptPrivateKeyRecord(item, password);
  unlockedPrivateKeys.set(item.id, normalizedPrivateKey);
  emitChange();
  return item;
}

export function lockEvmStoredPrivateKey(itemId: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item || item.securityMode !== "encrypted") {
    return;
  }

  unlockedPrivateKeys.delete(itemId);
  emitChange();
}

export async function peekEvmStoredPrivateKey(itemId: string, password?: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    throw new Error("Private key entry not found.");
  }

  if (item.securityMode === "plain") {
    if (!item.privateKey) {
      throw new Error("Stored private key is unavailable.");
    }

    return normalizePrivateKey(item.privateKey);
  }

  const cachedPrivateKey = unlockedPrivateKeys.get(item.id);

  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  if (!password) {
    throw new Error("Password is required.");
  }

  return decryptPrivateKeyRecord(item, password);
}

export async function resolveEvmStoredPrivateKey(itemId: string, password?: string) {
  const item = getEvmStoredPrivateKey(itemId);

  if (!item) {
    throw new Error("Private key entry not found.");
  }

  if (item.securityMode === "plain") {
    if (!item.privateKey) {
      throw new Error("Stored private key is unavailable.");
    }

    const normalizedPrivateKey = normalizePrivateKey(item.privateKey);
    const nextStore = markItemUsed(readKeyringStore(), item.id);
    writeKeyringStore(nextStore);
    unlockedPrivateKeys.set(item.id, normalizedPrivateKey);
    emitChange();
    return normalizedPrivateKey;
  }

  const cachedPrivateKey = unlockedPrivateKeys.get(item.id);

  if (cachedPrivateKey) {
    const nextStore = markItemUsed(readKeyringStore(), item.id);
    writeKeyringStore(nextStore);
    emitChange();
    return cachedPrivateKey;
  }

  const normalizedPrivateKey = await decryptPrivateKeyRecord(item, password ?? "");
  unlockedPrivateKeys.set(item.id, normalizedPrivateKey);
  const nextStore = markItemUsed(readKeyringStore(), item.id);
  writeKeyringStore(nextStore);
  emitChange();
  return normalizedPrivateKey;
}

export function subscribeEvmKeyring(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
