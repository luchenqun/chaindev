import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { cosmosAddressTags } from '@/db/schema/workbench';

function getScopedImportId(userId: string, localId: string) {
  return `${userId}:${localId}`;
}

function normalizeAddress(address: string) {
  const normalized = address.trim().toLowerCase();

  if (!normalized) {
    throw new Error('Invalid Cosmos address.');
  }

  return normalized;
}

export async function listServerCosmosAddressTags(userId: string) {
  return db.select().from(cosmosAddressTags).where(eq(cosmosAddressTags.userId, userId)).orderBy(desc(cosmosAddressTags.updatedAt));
}

export async function upsertServerCosmosAddressTag(input: {
  userId: string;
  providerProfileId: string;
  providerName: string | null;
  address: string;
  nameTag: string;
}) {
  const normalizedAddressLower = normalizeAddress(input.address);
  const trimmedNameTag = input.nameTag.trim();

  if (!trimmedNameTag) {
    throw new Error('Name tag is required.');
  }

  const id = getScopedImportId(input.userId, `${input.providerProfileId}:${normalizedAddressLower}`);
  const existing = await db.query.cosmosAddressTags.findFirst({
    where: eq(cosmosAddressTags.id, id),
  });
  const now = Date.now();

  db.delete(cosmosAddressTags).where(eq(cosmosAddressTags.id, id)).run();
  db.insert(cosmosAddressTags)
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

export async function deleteServerCosmosAddressTag(input: { userId: string; providerProfileId: string; address: string }) {
  const normalizedAddressLower = normalizeAddress(input.address);

  db.delete(cosmosAddressTags)
    .where(
      and(
        eq(cosmosAddressTags.userId, input.userId),
        eq(cosmosAddressTags.providerProfileId, input.providerProfileId),
        eq(cosmosAddressTags.addressLower, normalizedAddressLower),
      ),
    )
    .run();

  return {
    providerProfileId: input.providerProfileId,
    addressLower: normalizedAddressLower,
  };
}

export async function clearServerCosmosAddressTags(userId: string, providerProfileId: string) {
  db.delete(cosmosAddressTags)
    .where(and(eq(cosmosAddressTags.userId, userId), eq(cosmosAddressTags.providerProfileId, providerProfileId)))
    .run();

  return { providerProfileId };
}
