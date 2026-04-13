import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "@/db/client";
import { evmPrivateKeys } from "@/db/schema/workbench";
import {
  DEFAULT_EVM_PRIVATE_KEY_ID,
  DEFAULT_EVM_PRIVATE_KEY_VALUE,
} from "@/platform/workbench/defaults";

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

  return value.toLowerCase();
}

function normalizeName(name: string) {
  const value = name.trim();

  if (!value) {
    throw new Error("Key name is required.");
  }

  return value;
}

function buildDefaultPrivateKeyRow(userId: string) {
  const privateKey = normalizePrivateKey(DEFAULT_EVM_PRIVATE_KEY_VALUE);
  const address = privateKeyToAccount(privateKey as `0x${string}`).address;
  const now = Date.now();

  return {
    id: `${userId}:${DEFAULT_EVM_PRIVATE_KEY_ID}`,
    userId,
    name: "Alice",
    address,
    addressLower: address.toLowerCase(),
    privateKey,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };
}

export async function listServerEvmPrivateKeys(userId: string) {
  const items = db
    .select()
    .from(evmPrivateKeys)
    .where(eq(evmPrivateKeys.userId, userId))
    .orderBy(desc(evmPrivateKeys.updatedAt))
    .all();

  if (items.length) {
    return items;
  }

  const defaultRow = buildDefaultPrivateKeyRow(userId);
  db.insert(evmPrivateKeys).values(defaultRow).run();
  return [defaultRow];
}

export async function createServerEvmPrivateKey(input: {
  userId: string;
  name: string;
  privateKey: string;
}) {
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const address = privateKeyToAccount(normalizedPrivateKey as `0x${string}`).address;
  const addressLower = address.toLowerCase();
  const duplicate = await db.query.evmPrivateKeys.findFirst({
    where: and(eq(evmPrivateKeys.userId, input.userId), eq(evmPrivateKeys.addressLower, addressLower)),
  });

  if (duplicate) {
    throw new Error("This private key address already exists.");
  }

  const now = Date.now();
  const row = {
    id: randomUUID(),
    userId: input.userId,
    name: normalizeName(input.name),
    address,
    addressLower,
    privateKey: normalizedPrivateKey,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };

  db.insert(evmPrivateKeys).values(row).run();
  return row;
}

export async function renameServerEvmPrivateKey(userId: string, id: string, name: string) {
  db
    .update(evmPrivateKeys)
    .set({
      name: normalizeName(name),
      updatedAt: Date.now(),
    })
    .where(and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)))
    .run();

  return (
    (await db.query.evmPrivateKeys.findFirst({
      where: and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)),
    })) ?? null
  );
}

export async function deleteServerEvmPrivateKey(userId: string, id: string) {
  db.delete(evmPrivateKeys).where(and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id))).run();
  return { id };
}

export async function touchServerEvmPrivateKeyLastUsed(userId: string, id: string) {
  db
    .update(evmPrivateKeys)
    .set({
      lastUsedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)))
    .run();

  return (
    (await db.query.evmPrivateKeys.findFirst({
      where: and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)),
    })) ?? null
  );
}

export function validateServerEvmPrivateKeyAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid private key address.");
  }

  return address.toLowerCase();
}
