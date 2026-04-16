import { z } from 'zod';

export const importedRpcProfileSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['evm', 'cosmos']),
  name: z.string().trim().min(1),
  nativeCurrencySymbol: z.string().trim().min(1).nullable(),
  rpcUrl: z.string().url(),
  restUrl: z.string().url().nullable(),
  wsUrl: z.string().url().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const importedEvmAddressTagSchema = z.object({
  providerProfileId: z.string().trim().min(1),
  providerName: z.string().trim().min(1).nullable().optional(),
  address: z.string().trim().min(1),
  addressLower: z.string().trim().min(1).optional(),
  nameTag: z.string().trim().min(1),
  updatedAt: z.number().int().nonnegative(),
});

export const importedEvmContractArtifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  abiJson: z.string().trim().min(1),
  bytecode: z.string().trim().nullable(),
  functionCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const importedEvmContractBindingSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  address: z.string().trim().min(1),
  addressLower: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  chainId: z.string().trim().min(1),
  providerProfileId: z.string().trim().min(1),
  providerName: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type ImportedRpcProfile = z.infer<typeof importedRpcProfileSchema>;
export type ImportedEvmAddressTag = z.infer<typeof importedEvmAddressTagSchema>;
export type ImportedEvmContractArtifact = z.infer<
  typeof importedEvmContractArtifactSchema
>;
export type ImportedEvmContractBinding = z.infer<
  typeof importedEvmContractBindingSchema
>;
