import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { requestHistory } from "@/db/schema/workbench";

type RequestHistoryInput = {
  userId: string;
  mode: string;
  method: string;
  paramsJson: string;
  resultJson?: string | null;
  errorJson?: string | null;
  durationMs: number;
};

export async function addRequestHistory(input: RequestHistoryInput) {
  const row = {
    id: randomUUID(),
    userId: input.userId,
    mode: input.mode,
    method: input.method,
    paramsJson: input.paramsJson,
    resultJson: input.resultJson ?? null,
    errorJson: input.errorJson ?? null,
    durationMs: input.durationMs,
    createdAt: Date.now(),
  };

  db.insert(requestHistory).values(row).run();
  return row;
}

export async function listRequestHistory(userId: string) {
  return db
    .select()
    .from(requestHistory)
    .where(eq(requestHistory.userId, userId))
    .orderBy(desc(requestHistory.createdAt))
    .all();
}
