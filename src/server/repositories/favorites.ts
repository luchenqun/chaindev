import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { favorites } from '@/db/schema/workbench';

type FavoriteInput = {
  userId: string;
  kind: string;
  value: string;
  label?: string | null;
};

export async function addFavorite(input: FavoriteInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    kind: input.kind,
    value: input.value,
    label: input.label ?? null,
    createdAt: Date.now(),
  };

  db.insert(favorites).values(row).run();
  return row;
}

export async function listFavorites(userId: string) {
  return db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt)).all();
}
