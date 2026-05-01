'use client';

import 'client-only';

import { erc20Abi, formatUnits, isAddress } from 'viem';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { getEvmCurrencyName } from '@/platform/workbench/rpc-profile';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

type HistoricalBalanceAssetType = 'native' | 'erc20';
type HistoricalBalanceLookupMode = 'datetime' | 'block-number';

export type HistoricalBalanceLookupInput = {
  assetType: HistoricalBalanceAssetType;
  accountAddress: string;
  tokenAddress?: string;
  lookupMode: HistoricalBalanceLookupMode;
  blockNumber?: string;
  snapshotDateTime?: string;
};

export type HistoricalBalanceLookupResult = {
  assetType: HistoricalBalanceAssetType;
  lookupMode: HistoricalBalanceLookupMode;
  providerName: string;
  assetLabel: string;
  accountAddress: string;
  tokenAddress: string | null;
  blockNumber: string;
  blockHash: string;
  blockTimestampMs: number;
  blockTimestampLabel: string;
  blockExplorerLabel: string;
  amount: string;
  rawBalance: string;
  decimals: number;
  symbol: string;
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

function normalizeAddress(label: string, value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${label} is required.`);
  }

  if (!isAddress(trimmedValue)) {
    throw new Error(`${label} must be a valid EVM address.`);
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
  lookupMode: HistoricalBalanceLookupMode;
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

export async function lookupEvmHistoricalBalanceDirect(input: HistoricalBalanceLookupInput): Promise<HistoricalBalanceLookupResult> {
  const profile = getActiveEvmProvider();
  const client = createEvmClient(profile.rpcUrl);
  const accountAddress = normalizeAddress(input.assetType === 'native' ? 'Account address / contract address' : 'Account address', input.accountAddress);
  const tokenAddress = input.assetType === 'erc20' ? normalizeAddress('Token address', input.tokenAddress ?? '') : null;
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

  if (input.assetType === 'native') {
    const rawBalance = await client.getBalance({
      address: accountAddress,
      blockNumber: resolvedBlockNumber,
    });
    const symbol = getEvmCurrencyName(profile.nativeCurrencySymbol);

    return {
      assetType: 'native',
      lookupMode: input.lookupMode,
      providerName: profile.name,
      assetLabel: `Native Coin (${symbol})`,
      accountAddress,
      tokenAddress: null,
      blockNumber: resolvedBlockNumber.toString(),
      blockHash: block.hash,
      blockTimestampMs: Number(block.timestamp ?? 0n) * 1000,
      blockTimestampLabel: formatSnapshotTimestamp(Number(block.timestamp ?? 0n) * 1000),
      blockExplorerLabel: `Block #${resolvedBlockNumber.toString()}`,
      amount: formatUnits(rawBalance, 18),
      rawBalance: rawBalance.toString(),
      decimals: 18,
      symbol,
    };
  }

  const [rawBalance, decimals, symbol] = await Promise.all([
    client.readContract({
      address: tokenAddress!,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [accountAddress],
      blockNumber: resolvedBlockNumber,
    }),
    client.readContract({
      address: tokenAddress!,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    client.readContract({
      address: tokenAddress!,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
  ]);

  return {
    assetType: 'erc20',
    lookupMode: input.lookupMode,
    providerName: profile.name,
    assetLabel: `Token (ERC-20${typeof symbol === 'string' && symbol.trim() ? ` • ${symbol.trim()}` : ''})`,
    accountAddress,
    tokenAddress,
    blockNumber: resolvedBlockNumber.toString(),
    blockHash: block.hash,
    blockTimestampMs: Number(block.timestamp ?? 0n) * 1000,
    blockTimestampLabel: formatSnapshotTimestamp(Number(block.timestamp ?? 0n) * 1000),
    blockExplorerLabel: `Block #${resolvedBlockNumber.toString()}`,
    amount: formatUnits(rawBalance, decimals),
    rawBalance: rawBalance.toString(),
    decimals,
    symbol: typeof symbol === 'string' && symbol.trim() ? symbol.trim() : 'ERC-20',
  };
}
