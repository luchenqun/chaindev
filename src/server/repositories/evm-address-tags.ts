import { and, desc, eq } from 'drizzle-orm';
import { isAddress } from 'viem';
import { db } from '@/db/client';
import { evmAddressTags } from '@/db/schema/workbench';
import type { ImportedEvmAddressTag } from '@/server/schemas/workbench-import';

function getScopedImportId(userId: string, localId: string) {
  return `${userId}:${localId}`;
}

function normalizeAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error('Invalid EVM address.');
  }

  return address.toLowerCase();
}

export async function listServerEvmAddressTags(userId: string) {
  return db.select().from(evmAddressTags).where(eq(evmAddressTags.userId, userId)).orderBy(desc(evmAddressTags.updatedAt));
}

export async function upsertServerEvmAddressTag(input: { userId: string; providerProfileId: string; providerName: string | null; address: string; nameTag: string }) {
  const normalizedAddressLower = normalizeAddress(input.address);
  const trimmedNameTag = input.nameTag.trim();

  if (!trimmedNameTag) {
    throw new Error('Name tag is required.');
  }

  const id = getScopedImportId(input.userId, `${input.providerProfileId}:${normalizedAddressLower}`);
  const existing = await db.query.evmAddressTags.findFirst({
    where: eq(evmAddressTags.id, id),
  });
  const now = Date.now();

  db.delete(evmAddressTags).where(eq(evmAddressTags.id, id)).run();
  db.insert(evmAddressTags)
    .values({
      id,
      userId: input.userId,
      providerProfileId: input.providerProfileId,
      providerName: input.providerName,
      address: input.address,
      addressLower: normalizedAddressLower,
      nameTag: trimmedNameTag,
      updatedAt: now,
    })
    .run();

  return {
    id,
    userId: input.userId,
    providerProfileId: input.providerProfileId,
    providerName: input.providerName,
    address: input.address,
    addressLower: normalizedAddressLower,
    nameTag: trimmedNameTag,
    updatedAt: existing?.updatedAt ?? now,
  };
}

export async function deleteServerEvmAddressTag(input: { userId: string; providerProfileId: string; address: string }) {
  const normalizedAddressLower = normalizeAddress(input.address);

  db.delete(evmAddressTags)
    .where(and(eq(evmAddressTags.userId, input.userId), eq(evmAddressTags.providerProfileId, input.providerProfileId), eq(evmAddressTags.addressLower, normalizedAddressLower)))
    .run();

  return {
    providerProfileId: input.providerProfileId,
    addressLower: normalizedAddressLower,
  };
}

export async function clearServerEvmAddressTags(userId: string, providerProfileId: string) {
  db.delete(evmAddressTags)
    .where(and(eq(evmAddressTags.userId, userId), eq(evmAddressTags.providerProfileId, providerProfileId)))
    .run();

  return { providerProfileId };
}

export async function importServerEvmAddressTags(userId: string, tags: ImportedEvmAddressTag[]) {
  for (const tag of tags) {
    const normalizedAddressLower = tag.addressLower?.toLowerCase() ?? normalizeAddress(tag.address);
    const scopedId = getScopedImportId(userId, `${tag.providerProfileId}:${normalizedAddressLower}`);

    db.delete(evmAddressTags).where(eq(evmAddressTags.id, scopedId)).run();
    db.insert(evmAddressTags)
      .values({
        id: scopedId,
        userId,
        providerProfileId: tag.providerProfileId,
        providerName: tag.providerName ?? null,
        address: tag.address,
        addressLower: normalizedAddressLower,
        nameTag: tag.nameTag.trim(),
        updatedAt: tag.updatedAt,
      })
      .run();
  }

  return listServerEvmAddressTags(userId);
}
