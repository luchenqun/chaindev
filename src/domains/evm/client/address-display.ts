'use client';

import { listEvmContractBindings } from '@/domains/evm/client/contract-registry';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

export function resolvePreferredToAddressLabel(
  address: string,
  options?: {
    nameTagsByAddress?: Record<string, string | null>;
    fallbackLabel?: string;
  },
) {
  const taggedLabel = options?.nameTagsByAddress?.[address];

  if (taggedLabel) {
    return taggedLabel;
  }

  const profile = readActiveRpcProfileCookie('evm');

  if (profile) {
    const binding = listEvmContractBindings().find((item) => item.providerProfileId === profile.id && item.addressLower === address.toLowerCase());

    if (binding?.label) {
      return binding.label;
    }
  }

  return options?.fallbackLabel ?? address;
}
