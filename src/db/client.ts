import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as authSchema from "@/db/schema/auth";
import * as workbenchSchema from "@/db/schema/workbench";

const configuredDatabaseUrl = process.env.DATABASE_URL;
const databasePath = configuredDatabaseUrl
  ? configuredDatabaseUrl.startsWith("/")
    ? configuredDatabaseUrl
    : join(/* turbopackIgnore: true */ process.cwd(), configuredDatabaseUrl.replace(/^\.\//, ""))
  : join(process.cwd(), "data", "chaindev.sqlite");

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, {
  schema: {
    ...authSchema,
    ...workbenchSchema,
  },
});
