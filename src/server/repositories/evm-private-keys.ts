import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { db } from '@/db/client';
import { evmPrivateKeys } from '@/db/schema/workbench';
import { decryptEvmPrivateKey, encryptEvmPrivateKey } from '@/server/security/evm-private-key-encryption';

function normalizePrivateKey(privateKey: string) {
  let value = privateKey.trim();

  if (!value) {
    throw new Error('Private key is required.');
  }

  if (!value.startsWith('0x')) {
    value = `0x${value}`;
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Private key must be a 32-byte hex string.');
  }

  return value.toLowerCase();
}

function normalizeName(name: string) {
  const value = name.trim();

  if (!value) {
    throw new Error('Key name is required.');
  }

  return value;
}

export async function listServerEvmPrivateKeys(userId: string) {
  return db.select().from(evmPrivateKeys).where(eq(evmPrivateKeys.userId, userId)).orderBy(desc(evmPrivateKeys.updatedAt)).all();
}

export async function createServerEvmPrivateKey(input: { userId: string; name: string; privateKey: string; securityMode: 'plain' | 'encrypted'; password?: string }) {
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const address = privateKeyToAccount(normalizedPrivateKey as `0x${string}`).address;
  const addressLower = address.toLowerCase();
  const duplicate = await db.query.evmPrivateKeys.findFirst({
    where: and(eq(evmPrivateKeys.userId, input.userId), eq(evmPrivateKeys.addressLower, addressLower)),
  });

  if (duplicate) {
    throw new Error('This private key address already exists.');
  }

  const now = Date.now();
  const encryptedPayload = input.securityMode === 'encrypted' ? encryptEvmPrivateKey(normalizedPrivateKey, input.password ?? '') : null;
  const row = {
    id: randomUUID(),
    userId: input.userId,
    name: normalizeName(input.name),
    address,
    addressLower,
    securityMode: input.securityMode,
    privateKey: input.securityMode === 'plain' ? normalizedPrivateKey : null,
    encryptedPrivateKey: encryptedPayload?.encryptedPrivateKey ?? null,
    iv: encryptedPayload?.iv ?? null,
    salt: encryptedPayload?.salt ?? null,
    authTag: encryptedPayload?.authTag ?? null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };

  db.insert(evmPrivateKeys).values(row).run();
  return row;
}

export async function renameServerEvmPrivateKey(userId: string, id: string, name: string) {
  db.update(evmPrivateKeys)
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

export async function updateServerEvmPrivateKey(input: { userId: string; id: string; name: string; privateKey: string; securityMode: 'plain' | 'encrypted'; password?: string }) {
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const address = privateKeyToAccount(normalizedPrivateKey as `0x${string}`).address;
  const addressLower = address.toLowerCase();
  const duplicate = await db.query.evmPrivateKeys.findFirst({
    where: and(eq(evmPrivateKeys.userId, input.userId), eq(evmPrivateKeys.addressLower, addressLower)),
  });

  if (duplicate && duplicate.id !== input.id) {
    throw new Error('This private key address already exists.');
  }

  const encryptedPayload = input.securityMode === 'encrypted' ? encryptEvmPrivateKey(normalizedPrivateKey, input.password ?? '') : null;

  db.update(evmPrivateKeys)
    .set({
      name: normalizeName(input.name),
      address,
      addressLower,
      securityMode: input.securityMode,
      privateKey: input.securityMode === 'plain' ? normalizedPrivateKey : null,
      encryptedPrivateKey: encryptedPayload?.encryptedPrivateKey ?? null,
      iv: encryptedPayload?.iv ?? null,
      salt: encryptedPayload?.salt ?? null,
      authTag: encryptedPayload?.authTag ?? null,
      updatedAt: Date.now(),
    })
    .where(and(eq(evmPrivateKeys.userId, input.userId), eq(evmPrivateKeys.id, input.id)))
    .run();

  return (
    (await db.query.evmPrivateKeys.findFirst({
      where: and(eq(evmPrivateKeys.userId, input.userId), eq(evmPrivateKeys.id, input.id)),
    })) ?? null
  );
}

export async function unlockServerEvmPrivateKey(userId: string, id: string, password: string) {
  const item =
    (await db.query.evmPrivateKeys.findFirst({
      where: and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)),
    })) ?? null;

  if (!item) {
    return null;
  }

  if (item.securityMode === 'plain') {
    if (!item.privateKey) {
      throw new Error('Stored private key is unavailable.');
    }

    return {
      id: item.id,
      privateKey: item.privateKey,
    };
  }

  if (!item.encryptedPrivateKey || !item.iv || !item.salt || !item.authTag) {
    throw new Error('Stored private key is unavailable.');
  }

  return {
    id: item.id,
    privateKey: decryptEvmPrivateKey(
      {
        encryptedPrivateKey: item.encryptedPrivateKey,
        iv: item.iv,
        salt: item.salt,
        authTag: item.authTag,
      },
      password,
    ),
  };
}

export async function deleteServerEvmPrivateKey(userId: string, id: string) {
  const rowCount =
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(evmPrivateKeys)
      .where(eq(evmPrivateKeys.userId, userId))
      .get()?.count ?? 0;

  if (rowCount <= 1) {
    throw new Error('At least one private key must remain.');
  }

  db.delete(evmPrivateKeys)
    .where(and(eq(evmPrivateKeys.userId, userId), eq(evmPrivateKeys.id, id)))
    .run();
  return { id };
}

export async function touchServerEvmPrivateKeyLastUsed(userId: string, id: string) {
  db.update(evmPrivateKeys)
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
    throw new Error('Invalid private key address.');
  }

  return address.toLowerCase();
}
