import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { decodeRecords } from '@/db/schema/workbench';

type DecodeRecordInput = {
  userId: string;
  mode: string;
  decoder: string;
  input: string;
  outputJson: string;
};

export async function addDecodeRecord(input: DecodeRecordInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    mode: input.mode,
    decoder: input.decoder,
    input: input.input,
    outputJson: input.outputJson,
    createdAt: Date.now(),
  };

  db.insert(decodeRecords).values(row).run();
  return row;
}

export async function listDecodeRecords(userId: string) {
  return db.select().from(decodeRecords).where(eq(decodeRecords.userId, userId)).orderBy(desc(decodeRecords.createdAt)).all();
}
