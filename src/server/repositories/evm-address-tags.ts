import { desc, eq } from "drizzle-orm";
import { isAddress } from "viem";
import { db } from "@/db/client";
import { evmAddressTags } from "@/db/schema/workbench";
import type { ImportedEvmAddressTag } from "@/server/schemas/workbench-migration";

function getScopedImportId(userId: string, localId: string) {
  return `${userId}:${localId}`;
}

function normalizeAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid EVM address.");
  }

  return address.toLowerCase();
}

export async function listServerEvmAddressTags(userId: string) {
  return db
    .select()
    .from(evmAddressTags)
    .where(eq(evmAddressTags.userId, userId))
    .orderBy(desc(evmAddressTags.updatedAt));
}

export async function importServerEvmAddressTags(userId: string, tags: ImportedEvmAddressTag[]) {
  for (const tag of tags) {
    const normalizedAddressLower = tag.addressLower?.toLowerCase() ?? normalizeAddress(tag.address);
    const scopedId = getScopedImportId(
      userId,
      `${tag.providerProfileId}:${normalizedAddressLower}`,
    );

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
