import { z } from 'zod';
import { type PlatformMode } from '@/config/chains';
import {
  DEFAULT_COSMOS_RPC_PROFILE,
  DEFAULT_EVM_RPC_PROFILE,
} from '@/platform/workbench/defaults';

export const platformModeSchema = z.enum(['evm', 'cosmos']);
export const ACTIVE_PLATFORM_MODE_COOKIE_NAME = 'chaindev-active-platform-mode';

const baseRpcProfileDraftSchema = z.object({
  name: z.string().trim().min(1, 'Provider name is required.'),
  rpcUrl: z.string().trim().url('A valid RPC URL is required.'),
});

export const rpcProfileDraftSchema = z.discriminatedUnion('mode', [
  baseRpcProfileDraftSchema.extend({
    mode: z.literal('evm'),
    nativeCurrencySymbol: z
      .string()
      .trim()
      .min(1, 'Currency name is required.'),
  }),
  baseRpcProfileDraftSchema.extend({
    mode: z.literal('cosmos'),
    restUrl: z.string().trim().url('A valid REST URL is required.'),
    wsUrl: z
      .string()
      .trim()
      .url('A valid WebSocket URL is required.')
      .or(z.literal(''))
      .optional()
      .transform((value) => value?.trim() || ''),
  }),
]);

export type RpcProfileDraft = z.infer<typeof rpcProfileDraftSchema>;

export const rpcProfileSchema = z.object({
  id: z.string().min(1),
  mode: platformModeSchema,
  name: z.string().min(1),
  nativeCurrencySymbol: z.string().min(1).nullable(),
  rpcUrl: z.string().url(),
  restUrl: z.string().url().nullable(),
  wsUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type RpcProfile = z.infer<typeof rpcProfileSchema>;

export type SelectedRpcProfileMap = Partial<Record<PlatformMode, string>>;

export const LOCAL_RPC_PROFILES_STORAGE_KEY = 'chaindev-rpc-profiles-v1';
export const LOCAL_SELECTED_RPC_PROFILES_STORAGE_KEY =
  'chaindev-selected-rpc-profiles-v1';

export function getActiveRpcProfileCookieName(mode: PlatformMode) {
  return `chaindev-active-rpc-profile-${mode}`;
}

export function serializeActiveRpcProfileCookie(profile: RpcProfile) {
  return encodeURIComponent(JSON.stringify(profile));
}

export function parseActiveRpcProfileCookie(raw: string | undefined) {
  if (!raw) {
    return null;
  }

  try {
    return rpcProfileSchema.parse(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}

export function getGuestFallbackRpcProfile(mode: PlatformMode) {
  if (mode === 'evm') {
    return DEFAULT_EVM_RPC_PROFILE;
  }

  return DEFAULT_COSMOS_RPC_PROFILE;
}

export function getDefaultActivePlatformMode(): PlatformMode {
  return 'evm';
}

export function isPlatformMode(value: string): value is PlatformMode {
  return value === 'evm' || value === 'cosmos';
}

export function getEvmCurrencyName(symbol: string | null | undefined) {
  return symbol?.trim() || 'ETH';
}
