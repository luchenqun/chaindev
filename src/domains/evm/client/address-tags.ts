"use client";

import { isAddress } from "viem";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";

type EvmAddressTagRecord = {
  address: string;
  addressLower: string;
  nameTag: string;
  tagType: "manual";
  source: "user";
  updatedAt: number;
};

type EvmAddressTagScopeMap = Record<string, Record<string, EvmAddressTagRecord>>;

const STORAGE_KEY = "chaindev-evm-address-tags-v1";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function getActiveTagScope() {
  const profile = readActiveRpcProfileCookie("evm");
  return profile?.id ?? "default";
}

function readTagStore() {
  if (typeof window === "undefined") {
    return {} satisfies EvmAddressTagScopeMap;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {} satisfies EvmAddressTagScopeMap;
    }

    return JSON.parse(raw) as EvmAddressTagScopeMap;
  } catch {
    return {} satisfies EvmAddressTagScopeMap;
  }
}

function writeTagStore(value: EvmAddressTagScopeMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function normalizeAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid EVM address");
  }

  return address.toLowerCase();
}

export function getEvmAddressTag(address: string) {
  const addressLower = normalizeAddress(address);
  const store = readTagStore();
  const scope = getActiveTagScope();
  return store[scope]?.[addressLower]?.nameTag ?? null;
}

export function getEvmAddressTags(addresses: string[]) {
  const scope = getActiveTagScope();
  const store = readTagStore();
  const scopeEntries = store[scope] ?? {};

  return Object.fromEntries(
    addresses
      .filter((address) => isAddress(address))
      .map((address) => [address, scopeEntries[address.toLowerCase()]?.nameTag ?? null]),
  ) as Record<string, string | null>;
}

export function upsertEvmAddressTag(address: string, nameTag: string) {
  const normalizedNameTag = nameTag.trim();

  if (!normalizedNameTag) {
    deleteEvmAddressTag(address);
    return;
  }

  const addressLower = normalizeAddress(address);
  const scope = getActiveTagScope();
  const store = readTagStore();
  const nextScopeEntries = {
    ...(store[scope] ?? {}),
    [addressLower]: {
      address,
      addressLower,
      nameTag: normalizedNameTag,
      tagType: "manual",
      source: "user",
      updatedAt: Date.now(),
    } satisfies EvmAddressTagRecord,
  };

  writeTagStore({
    ...store,
    [scope]: nextScopeEntries,
  });
  emitChange();
}

export function deleteEvmAddressTag(address: string) {
  const addressLower = normalizeAddress(address);
  const scope = getActiveTagScope();
  const store = readTagStore();
  const scopeEntries = { ...(store[scope] ?? {}) };

  if (!(addressLower in scopeEntries)) {
    return;
  }

  delete scopeEntries[addressLower];

  writeTagStore({
    ...store,
    [scope]: scopeEntries,
  });
  emitChange();
}

export function subscribeEvmAddressTags(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
