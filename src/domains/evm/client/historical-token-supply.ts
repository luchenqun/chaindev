'use client';

import 'client-only';

import { erc20Abi, formatUnits, isAddress } from 'viem';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

type HistoricalTokenSupplyLookupMode = 'datetime' | 'block-number';

export type HistoricalTokenSupplyLookupInput = {
  tokenAddress: string;
  lookupMode: HistoricalTokenSupplyLookupMode;
  blockNumber?: string;
  snapshotDateTime?: string;
};

export type HistoricalTokenSupplyLookupResult = {
  lookupMode: HistoricalTokenSupplyLookupMode;
  providerName: string;
  tokenAddress: string;
  blockNumber: string;
  blockHash: string;
  blockTimestampMs: number;
  blockTimestampLabel: string;
  blockExplorerLabel: string;
  supply: string;
  rawSupply: string;
  decimals: number;
  symbol: string;
  name: string;
};

function getActiveEvmProvider() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function formatSnapshotTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestampMs));
}

function normalizeTokenAddress(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Token contract address is required.');
  }

  if (!isAddress(trimmedValue)) {
    throw new Error('Token contract address must be a valid EVM address.');
  }

  return trimmedValue as `0x${string}`;
}

function normalizeBlockNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Block number is required.');
  }

  if (!/^\d+$/.test(trimmedValue)) {
    throw new Error('Block number must be a positive integer.');
  }

  return BigInt(trimmedValue);
}

function normalizeSnapshotDateTime(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error('Snapshot time is required.');
  }

  const timestampMs = new Date(trimmedValue).getTime();

  if (!Number.isFinite(timestampMs)) {
    throw new Error('Snapshot time is invalid.');
  }

  return timestampMs;
}

async function resolveHistoricalBlockNumber(input: {
  client: ReturnType<typeof createEvmClient>;
  lookupMode: HistoricalTokenSupplyLookupMode;
  blockNumber?: string;
  snapshotDateTime?: string;
}) {
  if (input.lookupMode === 'block-number') {
    return normalizeBlockNumber(input.blockNumber ?? '');
  }

  const targetTimestampMs = normalizeSnapshotDateTime(input.snapshotDateTime ?? '');
  const latestBlock = await input.client.getBlock({ blockTag: 'latest' });

  if (latestBlock.timestamp == null) {
    throw new Error('Latest block timestamp is unavailable.');
  }

  const latestTimestampMs = Number(latestBlock.timestamp) * 1000;

  if (targetTimestampMs > latestTimestampMs) {
    throw new Error('Snapshot time cannot be later than the latest block time.');
  }

  let low = 0n;
  let high = latestBlock.number;
  let bestBlockNumber = 0n;

  while (low <= high) {
    const mid = (low + high) / 2n;
    const block = await input.client.getBlock({ blockNumber: mid });
    const blockTimestampMs = Number(block.timestamp ?? 0n) * 1000;

    if (blockTimestampMs <= targetTimestampMs) {
      bestBlockNumber = mid;
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }

  return bestBlockNumber;
}

export async function lookupEvmHistoricalTokenSupplyDirect(input: HistoricalTokenSupplyLookupInput): Promise<HistoricalTokenSupplyLookupResult> {
  const profile = getActiveEvmProvider();
  const client = createEvmClient(profile.rpcUrl);
  const tokenAddress = normalizeTokenAddress(input.tokenAddress);
  const resolvedBlockNumber = await resolveHistoricalBlockNumber({
    client,
    lookupMode: input.lookupMode,
    blockNumber: input.blockNumber,
    snapshotDateTime: input.snapshotDateTime,
  });
  const block = await client.getBlock({ blockNumber: resolvedBlockNumber });

  if (!block.hash) {
    throw new Error('Block hash is unavailable.');
  }

  const [rawSupply, decimals, symbol, name] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'totalSupply',
      blockNumber: resolvedBlockNumber,
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'name',
    }),
  ]);

  const normalizedSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : 'ERC-20';
  const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : 'Unknown Token';

  return {
    lookupMode: input.lookupMode,
    providerName: profile.name,
    tokenAddress,
    blockNumber: resolvedBlockNumber.toString(),
    blockHash: block.hash,
    blockTimestampMs: Number(block.timestamp ?? 0n) * 1000,
    blockTimestampLabel: formatSnapshotTimestamp(Number(block.timestamp ?? 0n) * 1000),
    blockExplorerLabel: `Block #${resolvedBlockNumber.toString()}`,
    supply: formatUnits(rawSupply, decimals),
    rawSupply: rawSupply.toString(),
    decimals,
    symbol: normalizedSymbol,
    name: normalizedName,
  };
}
