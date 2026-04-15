import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { PlatformMode } from '@/config/chains';
import { db } from '@/db/client';
import { rpcProfiles } from '@/db/schema/workbench';
import type { ImportedRpcProfile } from '@/server/schemas/workbench-migration';

type RpcProfileInput = {
  userId: string;
  mode: PlatformMode;
  name: string;
  nativeCurrencySymbol?: string | null;
  rpcUrl: string;
  restUrl?: string | null;
};

export async function addRpcProfile(input: RpcProfileInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    mode: input.mode,
    name: input.name,
    nativeCurrencySymbol: input.nativeCurrencySymbol ?? null,
    rpcUrl: input.rpcUrl,
    restUrl: input.restUrl ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  db.insert(rpcProfiles).values(row).run();
  return row;
}

export async function importRpcProfiles(
  userId: string,
  profiles: ImportedRpcProfile[],
) {
  for (const profile of profiles) {
    const row = {
      id: `${userId}:${profile.id}`,
      userId,
      mode: profile.mode,
      name: profile.name,
      nativeCurrencySymbol: profile.nativeCurrencySymbol ?? null,
      rpcUrl: profile.rpcUrl,
      restUrl: profile.restUrl ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };

    db.delete(rpcProfiles).where(eq(rpcProfiles.id, row.id)).run();
    db.insert(rpcProfiles).values(row).run();
  }

  return listRpcProfiles(userId);
}

export async function listRpcProfiles(userId: string) {
  return db
    .select()
    .from(rpcProfiles)
    .where(eq(rpcProfiles.userId, userId))
    .orderBy(desc(rpcProfiles.updatedAt))
    .all();
}

export async function getLatestRpcProfileByMode(
  userId: string,
  mode: PlatformMode,
) {
  return (
    db
      .select()
      .from(rpcProfiles)
      .where(and(eq(rpcProfiles.userId, userId), eq(rpcProfiles.mode, mode)))
      .orderBy(desc(rpcProfiles.updatedAt))
      .get() ?? null
  );
}

export async function deleteRpcProfile(userId: string, id: string) {
  const rowCount =
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(rpcProfiles)
      .where(eq(rpcProfiles.userId, userId))
      .get()?.count ?? 0;

  if (rowCount <= 1) {
    throw new Error('At least one provider must remain.');
  }

  db.delete(rpcProfiles)
    .where(and(eq(rpcProfiles.userId, userId), eq(rpcProfiles.id, id)))
    .run();
  return { id };
}

export async function updateRpcProfile(
  userId: string,
  id: string,
  input: RpcProfileInput,
) {
  const updatedAt = Date.now();

  db.update(rpcProfiles)
    .set({
      mode: input.mode,
      name: input.name,
      nativeCurrencySymbol: input.nativeCurrencySymbol ?? null,
      rpcUrl: input.rpcUrl,
      restUrl: input.restUrl ?? null,
      updatedAt,
    })
    .where(and(eq(rpcProfiles.userId, userId), eq(rpcProfiles.id, id)))
    .run();

  return (
    db
      .select()
      .from(rpcProfiles)
      .where(and(eq(rpcProfiles.userId, userId), eq(rpcProfiles.id, id)))
      .get() ?? null
  );
}
