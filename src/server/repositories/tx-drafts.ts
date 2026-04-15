import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { txDrafts } from '@/db/schema/workbench';

type TxDraftInput = {
  userId: string;
  mode: string;
  title: string;
  payloadJson: string;
};

export async function addTxDraft(input: TxDraftInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    mode: input.mode,
    title: input.title,
    payloadJson: input.payloadJson,
    updatedAt: Date.now(),
  };

  db.insert(txDrafts).values(row).run();
  return row;
}

export async function listTxDrafts(userId: string) {
  return db
    .select()
    .from(txDrafts)
    .where(eq(txDrafts.userId, userId))
    .orderBy(desc(txDrafts.updatedAt))
    .all();
}
