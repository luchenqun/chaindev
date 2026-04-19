import { z } from 'zod';

const bootstrapEvmProviderSchema = z.object({
  name: z.string().trim().min(1),
  nativeCurrencySymbol: z.string().trim().min(1).nullable().optional(),
  rpcUrl: z.string().trim().url(),
  restUrl: z.string().trim().url().nullable().optional(),
  wsUrl: z.string().trim().url().nullable().optional(),
});

const bootstrapCosmosProviderSchema = z.object({
  name: z.string().trim().min(1),
  nativeCurrencySymbol: z.string().trim().min(1).nullable().optional(),
  rpcUrl: z.string().trim().url(),
  restUrl: z.string().trim().url(),
  wsUrl: z.string().trim().url().nullable().optional(),
});

const bootstrapPrivateKeySchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/);

const bootstrapPrivateKeyNameSchema = z.string().trim().min(1);

function parseBootstrapJsonEnv<T>(
  key: string,
  schema: z.ZodSchema<T>,
  fallback: T,
) {
  const raw = process.env[key]?.trim();

  if (!raw) {
    return fallback;
  }

  try {
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      `Invalid ${key} environment variable: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    );
  }
}

export function readBootstrapEvmProvider() {
  return parseBootstrapJsonEnv('BOOTSTRAP_EVM_PROVIDER', bootstrapEvmProviderSchema, {
    name: 'LocalNode0',
    nativeCurrencySymbol: 'QARE',
    rpcUrl: 'http://127.0.0.1:8545',
    restUrl: null,
    wsUrl: null,
  });
}

export function readBootstrapCosmosProvider() {
  return parseBootstrapJsonEnv(
    'BOOTSTRAP_COSMOS_PROVIDER',
    bootstrapCosmosProviderSchema,
    {
      name: 'LocalNode0',
      nativeCurrencySymbol: null,
      rpcUrl: 'http://127.0.0.1:26657',
      restUrl: 'http://127.0.0.1:1317',
      wsUrl: 'ws://127.0.0.1:26657/websocket',
    },
  );
}

export function readBootstrapPrivateKey() {
  const raw = process.env.BOOTSTRAP_PRIVATE_KEY?.trim();

  if (!raw) {
    return '0xf78a036930ce63791ea6ea20072986d8c3f16a6811f6a2583b0787c45086f769';
  }

  return bootstrapPrivateKeySchema.parse(raw).toLowerCase();
}

export function readBootstrapPrivateKeyName() {
  const raw = process.env.BOOTSTRAP_PRIVATE_KEY_NAME?.trim();

  if (!raw) {
    return 'Alice';
  }

  return bootstrapPrivateKeyNameSchema.parse(raw);
}
