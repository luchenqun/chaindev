import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rpcProfiles = sqliteTable('rpc_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  mode: text('mode').notNull(),
  name: text('name').notNull(),
  nativeCurrencySymbol: text('native_currency_symbol'),
  rpcUrl: text('rpc_url').notNull(),
  restUrl: text('rest_url'),
  wsUrl: text('ws_url'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const evmAddressTags = sqliteTable('evm_address_tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  providerProfileId: text('provider_profile_id').notNull(),
  providerName: text('provider_name'),
  address: text('address').notNull(),
  addressLower: text('address_lower').notNull(),
  nameTag: text('name_tag').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const cosmosAddressTags = sqliteTable('cosmos_address_tags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  providerProfileId: text('provider_profile_id').notNull(),
  providerName: text('provider_name'),
  address: text('address').notNull(),
  addressLower: text('address_lower').notNull(),
  nameTag: text('name_tag').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const evmContractArtifacts = sqliteTable('evm_contract_artifacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  scope: text('scope').notNull(),
  name: text('name').notNull(),
  abiJson: text('abi_json').notNull(),
  bytecode: text('bytecode'),
  functionCount: integer('function_count').notNull(),
  eventCount: integer('event_count').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const evmContractBindings = sqliteTable('evm_contract_bindings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  artifactId: text('artifact_id').notNull(),
  address: text('address').notNull(),
  addressLower: text('address_lower').notNull(),
  label: text('label').notNull(),
  chainId: text('chain_id').notNull(),
  providerProfileId: text('provider_profile_id').notNull(),
  providerName: text('provider_name').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const evmPrivateKeys = sqliteTable('evm_private_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  addressLower: text('address_lower').notNull(),
  securityMode: text('security_mode').notNull(),
  privateKey: text('private_key'),
  encryptedPrivateKey: text('encrypted_private_key'),
  iv: text('iv'),
  salt: text('salt'),
  authTag: text('auth_tag'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lastUsedAt: integer('last_used_at'),
});
