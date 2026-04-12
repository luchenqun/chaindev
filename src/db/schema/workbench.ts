import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rpcProfiles = sqliteTable("rpc_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  name: text("name").notNull(),
  nativeCurrencySymbol: text("native_currency_symbol"),
  rpcUrl: text("rpc_url").notNull(),
  restUrl: text("rest_url"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const requestHistory = sqliteTable("request_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  method: text("method").notNull(),
  paramsJson: text("params_json").notNull(),
  resultJson: text("result_json"),
  errorJson: text("error_json"),
  durationMs: integer("duration_ms").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const txDrafts = sqliteTable("tx_drafts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  title: text("title").notNull(),
  payloadJson: text("payload_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const decodeRecords = sqliteTable("decode_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  decoder: text("decoder").notNull(),
  input: text("input").notNull(),
  outputJson: text("output_json").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  label: text("label"),
  createdAt: integer("created_at").notNull(),
});

export const recentItems = sqliteTable("recent_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  itemType: text("item_type").notNull(),
  value: text("value").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const evmAddressTags = sqliteTable("evm_address_tags", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  providerProfileId: text("provider_profile_id").notNull(),
  providerName: text("provider_name"),
  address: text("address").notNull(),
  addressLower: text("address_lower").notNull(),
  nameTag: text("name_tag").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const evmContractArtifacts = sqliteTable("evm_contract_artifacts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  abiJson: text("abi_json").notNull(),
  bytecode: text("bytecode"),
  functionCount: integer("function_count").notNull(),
  eventCount: integer("event_count").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const evmContractBindings = sqliteTable("evm_contract_bindings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  artifactId: text("artifact_id").notNull(),
  address: text("address").notNull(),
  addressLower: text("address_lower").notNull(),
  label: text("label").notNull(),
  chainId: text("chain_id").notNull(),
  providerProfileId: text("provider_profile_id").notNull(),
  providerName: text("provider_name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
