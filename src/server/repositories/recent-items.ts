import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { recentItems } from "@/db/schema/workbench";

type RecentItemInput = {
  userId: string;
  mode: string;
  itemType: string;
  value: string;
};

export async function addRecentItem(input: RecentItemInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    mode: input.mode,
    itemType: input.itemType,
    value: input.value,
    createdAt: Date.now(),
  };

  db.insert(recentItems).values(row).run();
  return row;
}

export async function listRecentItems(userId: string) {
  return db.select().from(recentItems).where(eq(recentItems.userId, userId)).orderBy(desc(recentItems.createdAt)).all();
}
