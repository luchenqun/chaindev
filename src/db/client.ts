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

function getTableColumns(tableName: string) {
  return sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
}

function ensureAuthSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      username TEXT,
      email TEXT,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      email_verified INTEGER,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS account (
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      PRIMARY KEY (provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS session (
      session_token TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_token (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user(email);
    CREATE UNIQUE INDEX IF NOT EXISTS user_username_unique ON user(username);
  `);

  const userColumns = new Set(getTableColumns("user").map((column) => column.name));

  if (!userColumns.has("username")) {
    sqlite.exec("ALTER TABLE user ADD COLUMN username TEXT");
  }

  if (!userColumns.has("password_hash")) {
    sqlite.exec("ALTER TABLE user ADD COLUMN password_hash TEXT");
  }

  if (!userColumns.has("is_admin")) {
    sqlite.exec("ALTER TABLE user ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }

  sqlite.exec(`
    UPDATE user
    SET is_admin = 1
    WHERE id = (
      SELECT id
      FROM user
      ORDER BY rowid ASC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user
      WHERE is_admin = 1
    );
  `);

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user(email);
    CREATE UNIQUE INDEX IF NOT EXISTS user_username_unique ON user(username);
  `);
}

ensureAuthSchema();

function ensureWorkbenchSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rpc_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      name TEXT NOT NULL,
      native_currency_symbol TEXT,
      rpc_url TEXT NOT NULL,
      rest_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_history (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      method TEXT NOT NULL,
      params_json TEXT NOT NULL,
      result_json TEXT,
      error_json TEXT,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tx_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decode_records (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      decoder TEXT NOT NULL,
      input TEXT NOT NULL,
      output_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_items (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      item_type TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evm_address_tags (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      provider_profile_id TEXT NOT NULL,
      provider_name TEXT,
      address TEXT NOT NULL,
      address_lower TEXT NOT NULL,
      name_tag TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evm_contract_artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'user',
      name TEXT NOT NULL,
      abi_json TEXT NOT NULL,
      bytecode TEXT,
      function_count INTEGER NOT NULL,
      event_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evm_contract_bindings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      address TEXT NOT NULL,
      address_lower TEXT NOT NULL,
      label TEXT NOT NULL,
      chain_id TEXT NOT NULL,
      provider_profile_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evm_private_keys (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      address_lower TEXT NOT NULL,
      security_mode TEXT NOT NULL,
      private_key TEXT,
      encrypted_private_key TEXT,
      iv TEXT,
      salt TEXT,
      auth_tag TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS rpc_profiles_user_id_idx ON rpc_profiles(user_id);
    CREATE INDEX IF NOT EXISTS evm_address_tags_user_id_idx ON evm_address_tags(user_id);
    CREATE INDEX IF NOT EXISTS evm_contract_artifacts_user_id_idx ON evm_contract_artifacts(user_id);
    CREATE INDEX IF NOT EXISTS evm_contract_bindings_user_id_idx ON evm_contract_bindings(user_id);
    CREATE INDEX IF NOT EXISTS evm_private_keys_user_id_idx ON evm_private_keys(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS evm_address_tags_scope_address_unique
      ON evm_address_tags(user_id, provider_profile_id, address_lower);
    CREATE UNIQUE INDEX IF NOT EXISTS evm_contract_bindings_scope_address_unique
      ON evm_contract_bindings(user_id, provider_profile_id, chain_id, address_lower);
    CREATE UNIQUE INDEX IF NOT EXISTS evm_private_keys_user_address_unique
      ON evm_private_keys(user_id, address_lower);
  `);

  const contractArtifactColumns = new Set(getTableColumns("evm_contract_artifacts").map((column) => column.name));

  if (!contractArtifactColumns.has("scope")) {
    sqlite.exec("ALTER TABLE evm_contract_artifacts ADD COLUMN scope TEXT NOT NULL DEFAULT 'user'");
  }
}

ensureWorkbenchSchema();

export const db = drizzle(sqlite, {
  schema: {
    ...authSchema,
    ...workbenchSchema,
  },
});

declare global {
  var __chaindevDevSeedPromise: Promise<void> | undefined;
}

if (process.env.NODE_ENV !== "production") {
  globalThis.__chaindevDevSeedPromise ??= import("@/server/dev/ensure-dev-seed")
    .then(({ ensureDevSeed }) => ensureDevSeed())
    .catch((error) => {
      console.error("Failed to initialize development seed data.", error);
    });
}
