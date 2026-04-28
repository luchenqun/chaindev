import { fromBech32, toHex } from '@cosmjs/encoding';

export type CosmosAddressDisplayMode = 'bech32' | 'hex';

export function formatCompactCosmosAddress(value: string, start = 14, end = 10) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatCosmosAddressForDisplay(address: string, mode: CosmosAddressDisplayMode) {
  if (mode === 'bech32') {
    return {
      full: address,
      label: formatCompactCosmosAddress(address, 14, 10),
    };
  }

  try {
    const { data } = fromBech32(address);
    const hexAddress = `0x${toHex(data)}`;

    return {
      full: hexAddress,
      label: formatCompactCosmosAddress(hexAddress, 8, 6),
    };
  } catch {
    return {
      full: address,
      label: formatCompactCosmosAddress(address, 14, 10),
    };
  }
}
