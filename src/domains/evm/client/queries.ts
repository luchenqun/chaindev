'use client';

import 'client-only';

import { formatEther, formatGwei, isAddress } from 'viem';
import { formatLocalizedDateTime, formatLocalizedNumber } from '@/i18n/format';
import { getEvmCurrencyName } from '@/platform/workbench/rpc-profile';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import {
  clearEvmTransactionCache,
  formatEvmValueWeiSortKey,
  getEvmCachedTransactionsByHashes,
  getEvmCachedTransactionsPage,
  getEvmObservedAccountsPage,
  getEvmTransactionCacheSummary,
  hydrateEvmCachedTransactionInputData,
  getLatestCachedTransactionHash,
  rememberEvmTransactionCache,
  validateEvmTransactionCacheShape,
  type EvmCachedTransactionItem,
} from '@/domains/evm/client/transaction-cache';
import { formatEvmAddressSummary, formatEvmBlock, formatEvmTransactionDetail } from '@/domains/evm/server/formatters';

function getActiveEvmProvider() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

export function getActiveEvmCurrencyNameClient() {
  return getEvmCurrencyName(readActiveRpcProfileCookie('evm')?.nativeCurrencySymbol);
}

async function getEvmClientWithProfile() {
  const profile = getActiveEvmProvider();
  return {
    profile,
    client: createEvmClient(profile.rpcUrl),
  };
}

function formatLocalDateTime(timestampSeconds: bigint | null | undefined) {
  if (timestampSeconds == null) {
    return 'Unavailable';
  }

  return formatLocalizedDateTime(Number(timestampSeconds) * 1000, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function shortenHash(value: string | null | undefined, start = 10, end = 8) {
  if (!value) {
    return 'Unavailable';
  }

  if (end <= 0) {
    return value.length <= start ? value : `${value.slice(0, start)}...`;
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function shortenAddress(value: string | null | undefined) {
  if (!value) {
    return 'Contract Creation';
  }

  if (value.length <= 15) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatTxValue(value: bigint | undefined, currencyName: string) {
  const amount = Number(formatEther(value ?? 0n));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  if (amount < 0.000001) {
    return `<0.000001 ${currencyName}`;
  }

  return `${amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatGasUsed(value: bigint | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return `${formatLocalizedNumber(value)} Gas`;
}

function formatInteger(value: bigint | number | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return formatLocalizedNumber(Number(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function formatBaseFee(value: bigint | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return `${Number(formatGwei(value))
    .toFixed(3)
    .replace(/\.?0+$/, '')} Gwei`;
}

function formatTransactionFee(value: bigint | null | undefined, currencyName: string) {
  if (value == null) {
    return 'Unavailable';
  }

  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(9).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatAccountBalance(value: bigint, currencyName: string) {
  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  if (amount < 0.000001) {
    return `<0.000001 ${currencyName}`;
  }

  return `${amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatIntervalSeconds(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return 'Unavailable';
  }

  if (seconds < 1) {
    return `${seconds.toFixed(2).replace(/\.?0+$/, '')}s`;
  }

  if (seconds < 10) {
    return `${seconds.toFixed(1).replace(/\.0$/, '')}s`;
  }

  return `${Math.round(seconds)}s`;
}

function derivePollIntervalMs(timestamps: bigint[]) {
  if (timestamps.length < 2) {
    return 12_000;
  }

  const latestTimestamp = timestamps[0];
  const oldestTimestamp = timestamps[timestamps.length - 1];
  const blockDistance = timestamps.length - 1;
  const averageSeconds = (Number(latestTimestamp - oldestTimestamp) / blockDistance) * 0.8;

  return Math.max(100, Math.min(30_000, Math.round(averageSeconds * 1_000)));
}

function derivePollIntervalMsFromRange(latestTimestamp: bigint, oldestTimestamp: bigint, blockSpan: number) {
  if (blockSpan <= 0) {
    return 12_000;
  }

  const averageSeconds = (Number(latestTimestamp - oldestTimestamp) / blockSpan) * 0.8;

  return Math.max(100, Math.min(30_000, Math.round(averageSeconds * 1_000)));
}

const HOME_BLOCK_FETCH_BATCH_SIZE = 12;

type EvmPublicClient = Awaited<ReturnType<typeof getEvmClientWithProfile>>['client'];

const EMPTY_EVM_TRANSACTION_CACHE_SUMMARY = {
  totalTransactions: 0,
  totalObservedAccounts: 0,
  latestSeenTransaction: null,
} satisfies Awaited<ReturnType<typeof getEvmTransactionCacheSummary>>;

function buildEmptyCachedTransactionsPage(page: number, pageSize: number) {
  return {
    page,
    pageSize,
    totalTransactions: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    transactions: [],
  } satisfies Awaited<ReturnType<typeof getEvmCachedTransactionsPage>>;
}

async function getEvmTransactionCacheSummarySafe() {
  return getEvmTransactionCacheSummary().catch(() => EMPTY_EVM_TRANSACTION_CACHE_SUMMARY);
}

async function getEvmCachedTransactionsPageSafe(page: number, pageSize: number) {
  return getEvmCachedTransactionsPage(page, pageSize).catch(() => buildEmptyCachedTransactionsPage(page, pageSize));
}

async function rememberEvmTransactionCacheSafe(items: EvmCachedTransactionItem[]) {
  return rememberEvmTransactionCache(items).catch(() => items);
}

function buildDescendingBlockNumbers(start: bigint, limit: number) {
  const numbers: bigint[] = [];

  for (let cursor = start; cursor >= 0n && numbers.length < limit; cursor -= 1n) {
    numbers.push(cursor);
  }

  return numbers;
}

async function getRecentBlocksChunk(client: EvmPublicClient, start: bigint, limit: number, includeTransactions = true) {
  const blockNumbers = buildDescendingBlockNumbers(start, limit);

  return Promise.all(
    blockNumbers.map((blockNumber) =>
      client.getBlock({
        blockNumber,
        includeTransactions,
      }),
    ),
  );
}

function parseHexQuantity(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatHomeBlockItem(block: { number: bigint; hash: string | null; miner: string; transactions: readonly unknown[]; timestamp?: bigint | null; gasUsed?: bigint | null }) {
  return {
    number: block.number.toString(),
    numberLabel: block.number.toString(),
    hash: block.hash ?? '',
    hashLabel: shortenHash(block.hash),
    miner: block.miner,
    minerLabel: shortenAddress(block.miner),
    txCount: String(block.transactions.length),
    timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
    gasUsedLabel: formatGasUsed(block.gasUsed),
  };
}

type EvmHomeTransactionItem = {
  hash: string;
  hashLabel: string;
  blockNumber: string;
  from: string;
  fromLabel: string;
  to: string | null;
  toLabel: string;
  interactedWith: string | null;
  interactedWithLabel: string;
  methodLabel: string;
  inputData?: string;
  value: string;
  timestampMs: number | null;
  receiptStatus: EvmCachedTransactionItem['receiptStatus'] | undefined;
};

function buildHomeReceiptStatusByHash(transactions: Array<Pick<EvmCachedTransactionItem, 'hash' | 'receiptStatus'>>) {
  return new Map(transactions.map((transaction) => [transaction.hash, transaction.receiptStatus] as const));
}

function formatHomeTransactions(
  transactions: readonly unknown[],
  blockNumber: bigint | number | string,
  timestamp: bigint | null | undefined,
  currencyName: string,
  limit: number,
  receiptStatusByHash?: Map<string, EvmCachedTransactionItem['receiptStatus'] | undefined>,
) {
  const items: EvmHomeTransactionItem[] = [];

  type HomeTransactionLike = {
    hash: string;
    from: string;
    to?: string | null;
    value?: bigint;
    input?: string;
  };

  function isHomeTransactionLike(transaction: unknown): transaction is HomeTransactionLike {
    return typeof transaction === 'object' && transaction !== null && 'hash' in transaction && 'from' in transaction;
  }

  for (const transaction of transactions) {
    if (items.length >= limit) {
      break;
    }

    if (typeof transaction === 'string' || !isHomeTransactionLike(transaction)) {
      continue;
    }

    items.push({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 14, 0),
      blockNumber: blockNumber.toString(),
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      interactedWith: transaction.to ?? null,
      interactedWithLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? '0x',
      value: formatTxValue(transaction.value, currencyName),
      timestampMs: timestamp ? Number(timestamp) * 1000 : null,
      receiptStatus: receiptStatusByHash?.get(transaction.hash),
    });
  }

  return items;
}

function formatCachedHomeTransactions(transactions: EvmCachedTransactionItem[], limit: number) {
  return transactions.slice(0, limit).map((transaction) => ({
    hash: transaction.hash,
    hashLabel: transaction.hashLabel,
    blockNumber: transaction.blockNumber,
    from: transaction.from,
    fromLabel: transaction.fromLabel,
    to: transaction.to,
    toLabel: transaction.toLabel,
    interactedWith: transaction.interactedWith,
    interactedWithLabel: transaction.interactedWithLabel,
    methodLabel: transaction.methodLabel,
    inputData: transaction.inputData,
    value: transaction.amountLabel,
    timestampMs: transaction.timestampMs,
    receiptStatus: transaction.receiptStatus,
  }));
}

export async function getEvmHomeCachedTransactionsDirect(txLimit = 6) {
  const cachedTransactionsPage = await getEvmCachedTransactionsPageSafe(1, txLimit);
  return formatCachedHomeTransactions(cachedTransactionsPage.transactions, txLimit);
}

type PageTransactionLike = {
  hash: string;
  from: string;
  to?: string | null;
  value?: bigint;
  input?: string;
  gas?: bigint;
  gasPrice?: bigint | null;
  nonce?: bigint;
  maxFeePerGas?: bigint | null;
};

function isPageTransactionLike(transaction: unknown): transaction is PageTransactionLike {
  return typeof transaction === 'object' && transaction !== null && 'hash' in transaction && 'from' in transaction;
}

function formatMethodLabel(input: string | undefined, to: string | null | undefined) {
  if (!to) {
    return 'Create';
  }

  if (!input || input === '0x') {
    return 'Transfer';
  }

  return input.slice(0, 10);
}

function formatBlocksPageItem(block: {
  number: bigint;
  hash: string | null;
  miner: string;
  transactions: readonly unknown[];
  timestamp?: bigint | null;
  gasUsed?: bigint | null;
  gasLimit?: bigint | null;
  baseFeePerGas?: bigint | null;
}) {
  const gasUsed = Number(block.gasUsed ?? 0n);
  const gasLimit = Number(block.gasLimit ?? 0n);
  const gasRatio = gasLimit > 0 ? (gasUsed / gasLimit) * 100 : 0;

  return {
    height: block.number.toString(),
    hash: block.hash ?? '',
    timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
    txCount: block.transactions.length,
    miner: block.miner,
    minerLabel: shortenAddress(block.miner),
    gasUsedLabel: formatInteger(block.gasUsed),
    gasUsedPercent: formatPercent(gasRatio),
    gasUsedRatio: Math.max(0, Math.min(100, gasRatio)),
    gasLimitLabel: formatInteger(block.gasLimit),
    baseFeeLabel: formatBaseFee(block.baseFeePerGas),
  };
}

type FormattedTransactionsPageItem = EvmCachedTransactionItem;
export type EvmCacheValidationResult = {
  status: 'empty' | 'valid' | 'cleared' | 'failed';
  label: string;
};

function finalizeTransactionsPageItems(
  currencyName: string,
  transactions: Array<{
    hash: string;
    blockNumber: string;
    timestampMs: number | null;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    interactedWith: string | null;
    interactedWithLabel: string;
    methodLabel: string;
    inputData: string;
    value: bigint | null;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
    nonce: bigint | null;
  }>,
) {
  return transactions.map(
    (transaction): FormattedTransactionsPageItem => ({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 12, 0),
      blockNumber: transaction.blockNumber,
      blockNumberValue: Number.parseInt(transaction.blockNumber, 10),
      timestampMs: transaction.timestampMs,
      from: transaction.from,
      fromLabel: transaction.fromLabel,
      fromLower: transaction.from.toLowerCase(),
      to: transaction.to,
      toLabel: transaction.toLabel,
      toLower: transaction.to?.toLowerCase() ?? null,
      interactedWith: transaction.interactedWith,
      interactedWithLabel: transaction.interactedWithLabel,
      methodLabel: transaction.methodLabel,
      methodKey: transaction.methodLabel.toLowerCase(),
      methodSelector: transaction.inputData && transaction.inputData !== '0x' && transaction.inputData.length >= 10 ? transaction.inputData.slice(0, 10).toLowerCase() : null,
      inputData: transaction.inputData,
      amountLabel: transaction.amountLabel,
      valueWei: (transaction.value ?? 0n).toString(),
      valueWeiSortKey: formatEvmValueWeiSortKey(transaction.value ?? 0n),
      maxTxCostLabel:
        transaction.gas != null && transaction.gasPrice != null
          ? `${Number(formatEther(transaction.gas * transaction.gasPrice))
              .toFixed(6)
              .replace(/\.?0+$/, '')} ${currencyName}`
          : 'Unavailable',
      gasLimitLabel: formatInteger(transaction.gas),
      nonceLabel: formatInteger(transaction.nonce),
    }),
  );
}

function formatTransactionsPageItemsForBlock(
  block: {
    number: bigint;
    timestamp?: bigint | null;
    transactions: readonly unknown[];
  },
  currencyName: string,
  limit = Number.POSITIVE_INFINITY,
) {
  const collected: Array<{
    hash: string;
    blockNumber: string;
    timestampMs: number | null;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    interactedWith: string | null;
    interactedWithLabel: string;
    methodLabel: string;
    inputData: string;
    value: bigint | null;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
    nonce: bigint | null;
  }> = [];

  for (const transaction of block.transactions) {
    if (collected.length >= limit) {
      break;
    }

    if (typeof transaction === 'string' || !isPageTransactionLike(transaction)) {
      continue;
    }

    collected.push({
      hash: transaction.hash,
      blockNumber: block.number.toString(),
      timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      interactedWith: transaction.to ?? null,
      interactedWithLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? '0x',
      value: transaction.value ?? 0n,
      amountLabel: formatTxValue(transaction.value, currencyName),
      gas: transaction.gas ?? null,
      gasPrice: transaction.gasPrice ?? null,
      nonce: transaction.nonce ?? null,
    });
  }

  return finalizeTransactionsPageItems(currencyName, collected);
}

type FormattedPendingTransactionItem = {
  hash: string;
  hashLabel: string;
  from: string;
  fromLabel: string;
  to: string | null;
  toLabel: string;
  interactedWith: string | null;
  interactedWithLabel: string;
  methodLabel: string;
  inputData: string;
  amountLabel: string;
  nonceLabel: string;
  gasPriceLabel: string;
  maxTxCostLabel: string;
};

function formatPendingGasPrice(value: bigint | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return `${Number(formatGwei(value))
    .toFixed(3)
    .replace(/\.?0+$/, '')} Gwei`;
}

function formatPendingTransactions(transactions: readonly unknown[], currencyName: string, limit: number) {
  const items: FormattedPendingTransactionItem[] = [];

  for (const transaction of transactions) {
    if (items.length >= limit) {
      break;
    }

    if (typeof transaction === 'string' || !isPageTransactionLike(transaction)) {
      continue;
    }

    const effectiveGasPrice = transaction.gasPrice ?? transaction.maxFeePerGas ?? null;

    items.push({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 12, 0),
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      interactedWith: transaction.to ?? null,
      interactedWithLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? '0x',
      amountLabel: formatTxValue(transaction.value, currencyName),
      nonceLabel: formatInteger(transaction.nonce),
      gasPriceLabel: formatPendingGasPrice(effectiveGasPrice),
      maxTxCostLabel:
        transaction.gas != null && effectiveGasPrice != null
          ? `${Number(formatEther(transaction.gas * effectiveGasPrice))
              .toFixed(6)
              .replace(/\.?0+$/, '')} ${currencyName}`
          : 'Unavailable',
    });
  }

  return items;
}

export async function getEvmHomeMetricsDirect() {
  const { client } = await getEvmClientWithProfile();
  const [chainId, block, gasPrice] = await Promise.all([client.getChainId(), client.getBlock(), client.getGasPrice()]);

  return {
    latestBlock: block.number.toString(),
    latestBlockTime: formatLocalDateTime(block.timestamp),
    gasPrice: `${Number(formatGwei(gasPrice)).toFixed(3)} Gwei`,
    chainId: String(chainId),
  };
}

export async function getEvmHomeMetricsSupplementDirect(includeChainId = false) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const [chainId, gasPrice, pendingTransactionCountHex, cacheSummary] = await Promise.all([
    includeChainId ? client.getChainId() : Promise.resolve(null),
    client.getGasPrice(),
    client.transport
      .request({
        method: 'eth_getBlockTransactionCountByNumber',
        params: ['pending'] as never,
      })
      .catch(() => null),
    getEvmTransactionCacheSummarySafe(),
  ]);
  const pendingTransactionCount = parseHexQuantity(pendingTransactionCountHex);

  return {
    header: {
      connection: 'Direct JSON-RPC',
      providerName: profile.name,
      nativeCurrency: currencyName,
      chainId: chainId != null ? String(chainId) : null,
    },
    gasPriceLabel: `${Number(formatGwei(gasPrice))
      .toFixed(3)
      .replace(/\.?0+$/, '')} Gwei`,
    pendingTransactionCountLabel: pendingTransactionCount != null ? formatInteger(pendingTransactionCount) : 'Unavailable',
    cacheSummary,
  };
}

export async function getEvmHomeBootstrapDirect(blockLimit = 6, txLimit = 6) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestNumber = await client.getBlockNumber();
  const blockCount = latestNumber >= BigInt(blockLimit - 1) ? blockLimit : Number(latestNumber + 1n);
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const [recentBlocks, cachedTransactionsPage] = await Promise.all([getRecentBlocksChunk(client, latestNumber, blockCount, true), getEvmCachedTransactionsPageSafe(1, txLimit)]);
  const cachedTransactions = formatCachedHomeTransactions(cachedTransactionsPage.transactions, txLimit);
  const rememberedTransactions = await rememberEvmTransactionCacheSafe(recentBlocks.flatMap((block) => formatTransactionsPageItemsForBlock(block, currencyName)));
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);

  const latestBlock = recentBlocks[0];

  if (!latestBlock) {
    return {
      status: {
        latestBlock: 'Unavailable',
        latestBlockNumber: 0,
        latestBlockTime: 'Unavailable',
        latestBlockTimestamp: null,
        pollIntervalMs: 12_000,
      },
      recentBlocks: [],
      transactions: cachedTransactions,
    };
  }

  const fallbackTransactions = recentBlocks
    .flatMap((block) => formatHomeTransactions(block.transactions, block.number, block.timestamp, currencyName, txLimit, receiptStatusByHash))
    .filter((transaction, index, transactions) => transactions.findIndex((candidate) => candidate.hash === transaction.hash) === index);

  return {
    status: {
      latestBlock: latestBlock.number.toString(),
      latestBlockNumber: Number(latestBlock.number),
      latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
      latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
      pollIntervalMs: 12_000,
    },
    recentBlocks: recentBlocks.map((block) => ({
      blockNumber: Number(block.number),
      timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
      txCount: block.transactions.length,
      block: formatHomeBlockItem(block),
      transactions: formatHomeTransactions(block.transactions, block.number, block.timestamp, currencyName, txLimit, receiptStatusByHash),
    })),
    transactions: [...cachedTransactions, ...fallbackTransactions]
      .filter((transaction, index, transactions) => transactions.findIndex((candidate) => candidate.hash === transaction.hash) === index)
      .slice(0, txLimit),
  };
}

export async function getEvmLiveStatusDirect() {
  const { client } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({ blockTag: 'latest' });
  let pollIntervalMs = 12_000;

  if (latestBlock.number > 0n) {
    const oldestBlockNumber = latestBlock.number > 10n ? latestBlock.number - 10n : 0n;
    const oldestBlock = await client.getBlock({
      blockNumber: oldestBlockNumber,
    });

    if (latestBlock.timestamp != null && oldestBlock.timestamp != null) {
      pollIntervalMs = derivePollIntervalMsFromRange(latestBlock.timestamp, oldestBlock.timestamp, Number(latestBlock.number - oldestBlock.number));
    }
  }

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    pollIntervalMs,
  };
}

export async function getEvmHomeActivityDirect(blockLimit = 4, txLimit = 4) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestNumber = await client.getBlockNumber();
  const blocks: Array<{
    number: string;
    numberLabel: string;
    hash: string;
    hashLabel: string;
    miner: string;
    minerLabel: string;
    txCount: string;
    timestampMs: number | null;
    gasUsedLabel: string;
  }> = [];
  const transactions: EvmHomeTransactionItem[] = [];
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const cacheCandidates: EvmCachedTransactionItem[] = [];
  let cursor = latestNumber;

  while (cursor >= 0n && (blocks.length < blockLimit || transactions.length < txLimit)) {
    const nextBlocks = await getRecentBlocksChunk(client, cursor, Math.max(HOME_BLOCK_FETCH_BATCH_SIZE, blockLimit, txLimit), true);

    for (const block of nextBlocks) {
      if (blocks.length < blockLimit) {
        blocks.push(formatHomeBlockItem(block));
      }

      if (transactions.length < txLimit) {
        transactions.push(...formatHomeTransactions(block.transactions, block.number, block.timestamp, currencyName, txLimit - transactions.length));
      }

      cacheCandidates.push(...formatTransactionsPageItemsForBlock(block, currencyName));

      if (blocks.length >= blockLimit && transactions.length >= txLimit) {
        break;
      }
    }

    const lastBlock = nextBlocks[nextBlocks.length - 1];

    if (!nextBlocks.length || lastBlock?.number === 0n) {
      break;
    }

    cursor = lastBlock.number - 1n;
  }

  const rememberedTransactions = await rememberEvmTransactionCacheSafe(cacheCandidates);
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);

  return {
    blocks,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      receiptStatus: receiptStatusByHash.get(transaction.hash),
    })),
  };
}

export async function getEvmHomeSnapshotDirect(blockLimit = 6, txLimit = 6) {
  const { client, profile } = await getEvmClientWithProfile();
  const [chainId, gasPrice, latestNumber] = await Promise.all([client.getChainId(), client.getGasPrice(), client.getBlockNumber()]);
  const blocks: Array<{
    number: string;
    numberLabel: string;
    hash: string;
    hashLabel: string;
    miner: string;
    minerLabel: string;
    txCount: string;
    timestampMs: number | null;
    gasUsedLabel: string;
  }> = [];
  const transactions: EvmHomeTransactionItem[] = [];
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  let latestBlockTimestamp: bigint | undefined;
  const timestamps: bigint[] = [];
  let recentTransactionCount = 0;
  const cacheCandidates: EvmCachedTransactionItem[] = [];
  let cursor = latestNumber;

  while (cursor >= 0n && (timestamps.length < 11 || blocks.length < blockLimit || transactions.length < txLimit)) {
    const nextBlocks = await getRecentBlocksChunk(client, cursor, Math.max(HOME_BLOCK_FETCH_BATCH_SIZE, 11, blockLimit, txLimit), true);

    for (const block of nextBlocks) {
      if (latestBlockTimestamp == null) {
        latestBlockTimestamp = block.timestamp;
      }

      if (block.timestamp != null && timestamps.length < 11) {
        timestamps.push(block.timestamp);
      }

      if (timestamps.length <= 10) {
        recentTransactionCount += block.transactions.length;
      }

      if (blocks.length < blockLimit) {
        blocks.push(formatHomeBlockItem(block));
      }

      if (transactions.length < txLimit) {
        transactions.push(...formatHomeTransactions(block.transactions, block.number, block.timestamp, currencyName, txLimit - transactions.length));
      }

      cacheCandidates.push(...formatTransactionsPageItemsForBlock(block, currencyName));

      if (timestamps.length >= 11 && blocks.length >= blockLimit && transactions.length >= txLimit) {
        break;
      }
    }

    const lastBlock = nextBlocks[nextBlocks.length - 1];

    if (!nextBlocks.length || lastBlock?.number === 0n) {
      break;
    }

    cursor = lastBlock.number - 1n;
  }

  const rememberedTransactions = await rememberEvmTransactionCacheSafe(cacheCandidates);
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);
  const intervalSamples = timestamps
    .slice(0, 10)
    .map((timestamp, index) => {
      const previousTimestamp = timestamps[index + 1];

      if (previousTimestamp == null) {
        return null;
      }

      return Number(timestamp - previousTimestamp);
    })
    .filter((value): value is number => value != null);
  const averageBlockTimeSeconds = intervalSamples.length ? intervalSamples.reduce((sum, value) => sum + value, 0) / intervalSamples.length : null;
  const pendingTransactionCountHex = await client.transport
    .request({
      method: 'eth_getBlockTransactionCountByNumber',
      params: ['pending'] as never,
    })
    .catch(() => null);
  const pendingTransactionCount = parseHexQuantity(pendingTransactionCountHex);
  const cacheSummary = await getEvmTransactionCacheSummarySafe();

  return {
    header: {
      connection: 'Direct JSON-RPC',
      providerName: profile.name,
      nativeCurrency: currencyName,
      chainId: String(chainId),
    },
    metrics: [
      {
        label: 'Latest Block',
        value: latestNumber.toString(),
        subtext: 'Current head',
      },
      {
        label: 'Latest Block Time',
        value: formatLocalDateTime(latestBlockTimestamp),
        subtext: 'Local formatted time',
      },
      {
        label: 'Average Block Time',
        value: formatIntervalSeconds(averageBlockTimeSeconds),
        subtext: 'Sampled from recent blocks',
      },
      {
        label: 'Gas Price',
        value: `${Number(formatGwei(gasPrice))
          .toFixed(3)
          .replace(/\.?0+$/, '')} Gwei`,
        subtext: 'Quoted in gwei',
      },
      {
        label: 'Pending Tx Count',
        value: pendingTransactionCount != null ? formatInteger(pendingTransactionCount) : 'Unavailable',
        subtext: pendingTransactionCount != null ? 'Pending pool snapshot' : 'Provider does not expose pending pool',
      },
      {
        label: 'Recent Tx Count',
        value: formatInteger(recentTransactionCount),
        subtext: `Last ${Math.min(10, timestamps.length)} blocks`,
      },
      {
        label: 'Cached Transactions',
        value: formatInteger(cacheSummary.totalTransactions),
        subtext: 'Local IndexedDB',
      },
      {
        label: 'Observed Accounts',
        value: formatInteger(cacheSummary.totalObservedAccounts),
        subtext: 'Derived from cached transactions',
      },
    ],
    activity: {
      blocks,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        receiptStatus: receiptStatusByHash.get(transaction.hash),
      })),
    },
    latestBlockNumber: Number(latestNumber),
    latestBlockTimestamp: latestBlockTimestamp ? Number(latestBlockTimestamp) : null,
    pollIntervalMs: derivePollIntervalMs(timestamps),
  };
}

export async function getEvmLatestBlockActivityDirect(txLimit = 6) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const latestBlock = await client.getBlock({
    blockTag: 'latest',
    includeTransactions: true,
  });
  const rememberedTransactions = await rememberEvmTransactionCacheSafe(formatTransactionsPageItemsForBlock(latestBlock, currencyName));
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    block: formatHomeBlockItem(latestBlock),
    transactions: formatHomeTransactions(latestBlock.transactions, latestBlock.number, latestBlock.timestamp, currencyName, txLimit, receiptStatusByHash),
  };
}

export async function getLatestEvmBlockSummaryDirect() {
  const { client } = await getEvmClientWithProfile();
  return formatEvmBlock(await client.getBlock());
}

export async function getRecentEvmBlocksDirect(limit = 8) {
  const { client } = await getEvmClientWithProfile();
  const latestNumber = await client.getBlockNumber();
  const count = latestNumber >= BigInt(limit - 1) ? limit : Number(latestNumber + 1n);
  const blocks = await getRecentBlocksChunk(client, latestNumber, count, false);

  return blocks.map((block) => formatEvmBlock(block));
}

export async function getEvmBlocksPageDirect(page = 1, limit = 10) {
  const { client } = await getEvmClientWithProfile();
  const [latestNumber, earliestBlock] = await Promise.all([client.getBlockNumber(), client.getBlock({ blockNumber: 0n }).catch(() => null)]);
  const earliestNumber = earliestBlock && earliestBlock.number >= 0n && earliestBlock.number <= latestNumber ? earliestBlock.number : 0n;
  const totalBlocks = Number(latestNumber - earliestNumber + 1n);
  const totalPages = Math.max(1, Math.ceil(totalBlocks / limit));
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const startOffset = BigInt((normalizedPage - 1) * limit);
  const startCursor = latestNumber >= earliestNumber + startOffset ? latestNumber - startOffset : earliestNumber;
  const blocks: Array<{
    height: string;
    hash: string;
    timestampMs: number | null;
    txCount: number;
    miner: string;
    minerLabel: string;
    gasUsedLabel: string;
    gasUsedPercent: string;
    gasUsedRatio: number;
    gasLimitLabel: string;
    baseFeeLabel: string;
  }> = [];
  const timestamps: bigint[] = [];
  let totalGasRatio = 0;
  let totalBaseFee = 0;
  let baseFeeCount = 0;

  const blockCount = Number(startCursor - earliestNumber + 1n);
  const nextBlocks = await getRecentBlocksChunk(client, startCursor, Math.min(limit, blockCount), false);

  for (const block of nextBlocks) {
    const gasUsed = Number(block.gasUsed ?? 0n);
    const gasLimit = Number(block.gasLimit ?? 0n);
    const gasRatio = gasLimit > 0 ? (gasUsed / gasLimit) * 100 : 0;

    blocks.push(formatBlocksPageItem(block));

    totalGasRatio += gasRatio;

    if (block.baseFeePerGas != null) {
      totalBaseFee += Number(formatGwei(block.baseFeePerGas));
      baseFeeCount += 1;
    }

    if (block.timestamp != null && timestamps.length < 11) {
      timestamps.push(block.timestamp);
    }
  }

  const sampleCount = blocks.length || 1;
  const averageBlockTimeMs = derivePollIntervalMs(timestamps) / 0.8;
  const averageBaseFee = baseFeeCount ? `${(totalBaseFee / baseFeeCount).toFixed(3).replace(/\.?0+$/, '')} Gwei` : 'Unavailable';

  return {
    page: normalizedPage,
    pageSize: limit,
    totalBlocks,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    summary: [
      {
        label: 'Latest Block',
        value: latestNumber.toString(),
        note: 'Current head',
      },
      {
        label: 'Average Block Time',
        value: `${(averageBlockTimeMs / 1000).toFixed(1).replace(/\.0$/, '')} s`,
        note: `Last ${blocks.length} blocks`,
      },
      {
        label: 'Average Gas Utilization',
        value: formatPercent(totalGasRatio / sampleCount),
        note: `Last ${blocks.length} blocks`,
      },
      {
        label: 'Average Base Fee',
        value: averageBaseFee,
        note: `Last ${blocks.length} blocks`,
      },
    ],
    totalLabel: `Total of recent ${blocks.length} blocks`,
    blocks,
  };
}

export async function getEvmTransactionsPageDirect(page = 1, limit = 20) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: 'latest',
    includeTransactions: true,
  });
  const latestNumber = latestBlock.number;
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const blockWindow = 500;
  const maxTransactions = 1000;
  const oldestNumber = latestNumber >= BigInt(blockWindow - 1) ? latestNumber - BigInt(blockWindow - 1) : 0n;
  const collected: FormattedTransactionsPageItem[] = [];
  let scannedOldestNumber = latestNumber;

  for (let cursor = latestNumber; cursor >= oldestNumber; cursor -= 1n) {
    const block =
      cursor === latestNumber
        ? latestBlock
        : await client.getBlock({
            blockNumber: cursor,
            includeTransactions: true,
          });

    scannedOldestNumber = cursor;

    const blockTransactions = formatTransactionsPageItemsForBlock(block, currencyName, maxTransactions - collected.length);
    collected.push(...blockTransactions);
    void rememberEvmTransactionCacheSafe(blockTransactions);

    if (collected.length >= maxTransactions || cursor === 0n) {
      break;
    }
  }

  const totalTransactions = collected.length;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / limit));
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (normalizedPage - 1) * limit;
  const transactions = collected.slice(pageStart, pageStart + limit);

  return {
    page: normalizedPage,
    pageSize: limit,
    totalTransactions,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    latestBlockNumber: latestNumber.toString(),
    oldestBlockNumber: scannedOldestNumber.toString(),
    title: `More than ${formatInteger(totalTransactions)} transactions found`,
    subtitle: `Showing recent transactions between block #${scannedOldestNumber.toString()} and #${latestNumber.toString()}`,
    transactions,
  };
}

export async function syncLatestEvmTransactionsDirect(input?: { latestCachedBlockNumber?: string | null; maxBlocks?: number; maxTransactions?: number }) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: 'latest',
    includeTransactions: true,
  });
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const maxBlocks = input?.maxBlocks ?? 500;
  const maxTransactions = input?.maxTransactions ?? 1000;
  const cachedLatestBlockNumber = input?.latestCachedBlockNumber && /^\d+$/.test(input.latestCachedBlockNumber) ? BigInt(input.latestCachedBlockNumber) : null;

  if (cachedLatestBlockNumber != null && latestBlock.number <= cachedLatestBlockNumber) {
    return {
      latestBlockNumber: latestBlock.number.toString(),
      scannedBlocks: 0,
      syncedTransactions: 0,
      truncatedByBlockWindow: false,
      truncatedByTransactionLimit: false,
    };
  }

  const floorBlockNumberByWindow = latestBlock.number >= BigInt(maxBlocks - 1) ? latestBlock.number - BigInt(maxBlocks - 1) : latestBlock.number > 0n ? 1n : 0n;
  const floorBlockNumber = cachedLatestBlockNumber != null && cachedLatestBlockNumber + 1n > floorBlockNumberByWindow ? cachedLatestBlockNumber + 1n : floorBlockNumberByWindow;
  const cacheCandidates: EvmCachedTransactionItem[] = [];
  let cursor = latestBlock.number;
  let scannedBlocks = 0;
  let syncedTransactions = 0;

  while (cursor >= floorBlockNumber && syncedTransactions < maxTransactions) {
    const remainingBlocks = Number(cursor - floorBlockNumber + 1n);
    const nextBlocks = await getRecentBlocksChunk(client, cursor, Math.min(HOME_BLOCK_FETCH_BATCH_SIZE, remainingBlocks), true);

    for (const block of nextBlocks) {
      scannedBlocks += 1;

      const remainingTransactions = maxTransactions - syncedTransactions;
      const blockTransactions = formatTransactionsPageItemsForBlock(block, currencyName, remainingTransactions);

      cacheCandidates.push(...blockTransactions);
      syncedTransactions += blockTransactions.length;

      if (syncedTransactions >= maxTransactions || block.number <= floorBlockNumber) {
        break;
      }
    }

    const lastBlock = nextBlocks[nextBlocks.length - 1];

    if (!nextBlocks.length || lastBlock?.number <= floorBlockNumber) {
      break;
    }

    cursor = lastBlock.number - 1n;
  }

  await rememberEvmTransactionCacheSafe(cacheCandidates);

  return {
    latestBlockNumber: latestBlock.number.toString(),
    scannedBlocks,
    syncedTransactions,
    truncatedByBlockWindow: cachedLatestBlockNumber == null ? latestBlock.number >= BigInt(maxBlocks) : latestBlock.number - cachedLatestBlockNumber >= BigInt(maxBlocks),
    truncatedByTransactionLimit: syncedTransactions >= maxTransactions,
  };
}

export async function syncEvmTransactionsByBlockRangeDirect(input: { startBlockNumber: string; endBlockNumber: string; maxBlocks?: number; maxTransactions?: number }) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const requestedStartBlockNumber = BigInt(input.startBlockNumber);
  const endBlockNumber = BigInt(input.endBlockNumber);
  const startBlockNumber = requestedStartBlockNumber === 0n ? 1n : requestedStartBlockNumber;
  const maxBlocks = input.maxBlocks ?? Number.POSITIVE_INFINITY;
  const maxTransactions = input.maxTransactions ?? Number.POSITIVE_INFINITY;
  const cacheCandidates: EvmCachedTransactionItem[] = [];
  let cursor = endBlockNumber;
  let scannedBlocks = 0;
  let syncedTransactions = 0;

  if (endBlockNumber < startBlockNumber) {
    return {
      startBlockNumber: requestedStartBlockNumber.toString(),
      endBlockNumber: endBlockNumber.toString(),
      scannedBlocks: 0,
      syncedTransactions: 0,
      truncatedByBlockWindow: false,
      truncatedByTransactionLimit: false,
    };
  }

  while (cursor >= startBlockNumber && scannedBlocks < maxBlocks && syncedTransactions < maxTransactions) {
    const remainingBlocksInRange = Number(cursor - startBlockNumber + 1n);
    const remainingBlocksByLimit = maxBlocks - scannedBlocks;
    const nextBlocks = await getRecentBlocksChunk(client, cursor, Math.min(HOME_BLOCK_FETCH_BATCH_SIZE, remainingBlocksInRange, remainingBlocksByLimit), true);

    for (const block of nextBlocks) {
      scannedBlocks += 1;

      const remainingTransactions = maxTransactions - syncedTransactions;
      const blockTransactions = formatTransactionsPageItemsForBlock(block, currencyName, remainingTransactions);

      cacheCandidates.push(...blockTransactions);
      syncedTransactions += blockTransactions.length;

      if (block.number <= startBlockNumber || scannedBlocks >= maxBlocks || syncedTransactions >= maxTransactions) {
        break;
      }
    }

    const lastBlock = nextBlocks[nextBlocks.length - 1];

    if (!nextBlocks.length || lastBlock?.number <= startBlockNumber || scannedBlocks >= maxBlocks || syncedTransactions >= maxTransactions) {
      break;
    }

    cursor = lastBlock.number - 1n;
  }

  await rememberEvmTransactionCacheSafe(cacheCandidates);

  return {
    startBlockNumber: requestedStartBlockNumber.toString(),
    endBlockNumber: endBlockNumber.toString(),
    scannedBlocks,
    syncedTransactions,
    truncatedByBlockWindow: Number.isFinite(maxBlocks) && endBlockNumber - startBlockNumber + 1n > BigInt(scannedBlocks),
    truncatedByTransactionLimit: syncedTransactions >= maxTransactions,
  };
}

export async function getLatestEvmTransactionsDirect(limit = 20) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: 'latest',
    includeTransactions: true,
  });
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const transactions = formatTransactionsPageItemsForBlock(latestBlock, currencyName, limit);
  void rememberEvmTransactionCacheSafe(transactions);

  return {
    latestBlockNumber: latestBlock.number.toString(),
    transactions,
  };
}

export async function getEvmPendingTransactionsDirect(limit = 100, pollIntervalMs = 12_000) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const pendingBlock = await client.getBlock({
    blockTag: 'pending',
    includeTransactions: true,
  });

  const transactions = formatPendingTransactions(pendingBlock.transactions, currencyName, limit);

  return {
    totalTransactions: pendingBlock.transactions.length,
    displayedTransactions: transactions.length,
    pollIntervalMs,
    title: `${formatInteger(pendingBlock.transactions.length)} pending transactions`,
    subtitle: `Live mempool snapshot from the selected provider. Refreshing every ${Math.max(1, Math.round(pollIntervalMs / 1000))}s.`,
    transactions,
  };
}

export async function getEvmOverviewDirect() {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const [chainId, gasPrice, latestNumber] = await Promise.all([client.getChainId(), client.getGasPrice(), client.getBlockNumber()]);
  const latestCachedTransactionHash = await getLatestCachedTransactionHash();
  let cacheValidationLabel = 'Verified';

  if (latestCachedTransactionHash) {
    const existingTransaction = await client.transport.request({
      method: 'eth_getTransactionByHash',
      params: [latestCachedTransactionHash] as never,
    });

    if (existingTransaction == null) {
      await clearEvmTransactionCache();
      cacheValidationLabel = 'Cleared on provider mismatch';
    }
  }

  const recentBlocks: Array<{
    number: bigint;
    hash: string | null;
    miner: string;
    transactions: readonly unknown[];
    timestamp?: bigint | null;
    gasUsed?: bigint | null;
  }> = [];
  const recentTransactions: EvmHomeTransactionItem[] = [];
  const cacheCandidates: EvmCachedTransactionItem[] = [];

  const recentBlockCount = latestNumber >= 10n ? 11 : Number(latestNumber + 1n);
  const recentBlockBatch = await getRecentBlocksChunk(client, latestNumber, recentBlockCount, true);

  for (const block of recentBlockBatch) {
    recentBlocks.push({
      number: block.number,
      hash: block.hash ?? null,
      miner: block.miner,
      transactions: block.transactions,
      timestamp: block.timestamp,
      gasUsed: block.gasUsed,
    });

    if (recentTransactions.length < 5) {
      recentTransactions.push(...formatHomeTransactions(block.transactions, block.number, block.timestamp, currencyName, 5 - recentTransactions.length));
      cacheCandidates.push(...formatTransactionsPageItemsForBlock(block, currencyName));
    }
  }

  const rememberedTransactions = await rememberEvmTransactionCacheSafe(cacheCandidates);
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);

  const activityBlocks = recentBlocks.slice(0, 5).map((block) => formatHomeBlockItem(block));
  const rhythmRows = recentBlocks.slice(0, 10).map((block, index) => {
    const previousBlock = recentBlocks[index + 1];
    const intervalSeconds = block.timestamp != null && previousBlock?.timestamp != null ? Number(block.timestamp - previousBlock.timestamp) : null;

    return {
      number: block.number.toString(),
      hash: block.hash ?? '',
      intervalSeconds,
      intervalLabel: formatIntervalSeconds(intervalSeconds),
      txCount: block.transactions.length,
      gasUsedLabel: formatGasUsed(block.gasUsed),
      timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
    };
  });
  const intervalSamples = rhythmRows.map((row) => row.intervalSeconds).filter((value): value is number => value != null);
  const averageIntervalSeconds = intervalSamples.length ? intervalSamples.reduce((sum, value) => sum + value, 0) / intervalSamples.length : null;
  const fastestIntervalSeconds = intervalSamples.length ? Math.min(...intervalSamples) : null;
  const slowestIntervalSeconds = intervalSamples.length ? Math.max(...intervalSamples) : null;
  const latestBlock = recentBlocks[0] ?? null;
  const pendingTransactionCountHex = await client.transport
    .request({
      method: 'eth_getBlockTransactionCountByNumber',
      params: ['pending'] as never,
    })
    .catch(() => null);
  const pendingTransactionCount = parseHexQuantity(pendingTransactionCountHex);
  const cacheSummary = await getEvmTransactionCacheSummarySafe();

  return {
    header: {
      providerName: profile.name,
      nativeCurrency: currencyName,
    },
    core: {
      latestBlock: latestNumber.toString(),
      latestBlockTimestampMs: latestBlock?.timestamp ? Number(latestBlock.timestamp) * 1000 : null,
      latestBlockTime: formatLocalDateTime(latestBlock?.timestamp),
      averageBlockTime: formatIntervalSeconds(averageIntervalSeconds),
      gasPrice: `${Number(formatGwei(gasPrice))
        .toFixed(3)
        .replace(/\.?0+$/, '')} Gwei`,
      chainId: String(chainId),
      pendingTransactionCount: pendingTransactionCount != null ? formatInteger(pendingTransactionCount) : 'Unavailable',
    },
    activity: {
      blocks: activityBlocks,
      transactions: recentTransactions.map((transaction) => ({
        ...transaction,
        receiptStatus: receiptStatusByHash.get(transaction.hash),
      })),
    },
    rhythm: {
      averageInterval: formatIntervalSeconds(averageIntervalSeconds),
      fastestInterval: formatIntervalSeconds(fastestIntervalSeconds),
      slowestInterval: formatIntervalSeconds(slowestIntervalSeconds),
      recentTransactionCount: formatInteger(rhythmRows.reduce((sum, row) => sum + row.txCount, 0)),
      blocks: rhythmRows,
    },
    cache: {
      cachedTransactions: formatInteger(cacheSummary.totalTransactions),
      observedAccounts: formatInteger(cacheSummary.totalObservedAccounts),
      latestCachedTransaction: cacheSummary.latestSeenTransaction
        ? {
            hash: cacheSummary.latestSeenTransaction.hash,
            hashLabel: shortenHash(cacheSummary.latestSeenTransaction.hash, 18, 0),
            blockNumber: cacheSummary.latestSeenTransaction.blockNumber,
            timestampMs: cacheSummary.latestSeenTransaction.timestampMs,
          }
        : null,
      validation: cacheValidationLabel,
    },
    pollIntervalMs:
      latestBlock?.timestamp != null && recentBlocks[10]?.timestamp != null
        ? derivePollIntervalMsFromRange(latestBlock.timestamp, recentBlocks[10].timestamp, Number(latestBlock.number - recentBlocks[10].number))
        : derivePollIntervalMs(recentBlocks.map((block) => block.timestamp).filter((value): value is bigint => value != null)),
  };
}

export async function validateActiveEvmCacheDirect(): Promise<EvmCacheValidationResult> {
  const { client } = await getEvmClientWithProfile();
  const shapeValidation = await validateEvmTransactionCacheShape();

  if (shapeValidation.status !== 'valid') {
    return shapeValidation;
  }

  const latestCachedTransactionHash = await getLatestCachedTransactionHash().catch(() => null);

  if (!latestCachedTransactionHash) {
    return {
      status: 'empty' as const,
      label: 'No cached transactions to validate',
    };
  }

  const existingTransaction = await client.transport
    .request({
      method: 'eth_getTransactionByHash',
      params: [latestCachedTransactionHash] as never,
    })
    .catch(() => null);

  if (existingTransaction == null) {
    await clearEvmTransactionCache().catch(() => undefined);
    return {
      status: 'cleared' as const,
      label: 'Cleared on provider mismatch',
    };
  }

  return {
    status: 'valid' as const,
    label: 'Verified',
  };
}

export async function getEvmCacheDashboardDirect(cachedTransactionsPage = 1, observedAccountsPage = 1) {
  const { client, profile } = await getEvmClientWithProfile();
  const [chainId, cacheSummary, observedAccounts, cachedTransactions] = await Promise.all([
    client.getChainId(),
    getEvmTransactionCacheSummary(),
    getEvmObservedAccountsPage(observedAccountsPage, 10),
    getEvmCachedTransactionsPage(cachedTransactionsPage, 10),
  ]);

  return {
    header: {
      connection: 'Direct JSON-RPC',
      providerName: profile.name,
      nativeCurrency: getEvmCurrencyName(profile.nativeCurrencySymbol),
      chainId: String(chainId),
    },
    summary: {
      cachedTransactions: cacheSummary.totalTransactions,
      observedAccounts: cacheSummary.totalObservedAccounts,
      latestCachedTransaction: cacheSummary.latestSeenTransaction
        ? {
            hash: cacheSummary.latestSeenTransaction.hash,
            hashLabel: shortenHash(cacheSummary.latestSeenTransaction.hash, 18, 0),
            blockNumber: cacheSummary.latestSeenTransaction.blockNumber,
            timestampMs: cacheSummary.latestSeenTransaction.timestampMs,
          }
        : null,
    },
    cachedTransactions,
    observedAccounts,
  };
}

export async function getEvmCacheSummaryDirect() {
  const { client, profile } = await getEvmClientWithProfile();
  const [chainId, cacheSummary] = await Promise.all([client.getChainId(), getEvmTransactionCacheSummary()]);

  return {
    header: {
      connection: 'Direct JSON-RPC',
      providerName: profile.name,
      nativeCurrency: getEvmCurrencyName(profile.nativeCurrencySymbol),
      chainId: String(chainId),
    },
    summary: {
      cachedTransactions: cacheSummary.totalTransactions,
      observedAccounts: cacheSummary.totalObservedAccounts,
      latestCachedTransaction: cacheSummary.latestSeenTransaction
        ? {
            hash: cacheSummary.latestSeenTransaction.hash,
            hashLabel: shortenHash(cacheSummary.latestSeenTransaction.hash, 18, 0),
            blockNumber: cacheSummary.latestSeenTransaction.blockNumber,
            timestampMs: cacheSummary.latestSeenTransaction.timestampMs,
          }
        : null,
    },
  };
}

export async function getEvmLatestFeedDirect(txLimit = 20, includePollSample = true) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: 'latest',
    includeTransactions: true,
  });
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  let pollIntervalMs = 12_000;

  if (includePollSample && latestBlock.number > 0n) {
    const oldestBlockNumber = latestBlock.number > 10n ? latestBlock.number - 10n : 0n;
    const oldestBlock = await client.getBlock({
      blockNumber: oldestBlockNumber,
    });

    if (latestBlock.timestamp != null && oldestBlock.timestamp != null) {
      pollIntervalMs = derivePollIntervalMsFromRange(latestBlock.timestamp, oldestBlock.timestamp, Number(latestBlock.number - oldestBlock.number));
    }
  }

  const rememberedTransactions = await rememberEvmTransactionCacheSafe(formatTransactionsPageItemsForBlock(latestBlock, currencyName));
  const receiptStatusByHash = buildHomeReceiptStatusByHash(rememberedTransactions);
  const transactionsPageItems = rememberedTransactions.slice(0, txLimit);

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    pollIntervalMs,
    block: formatHomeBlockItem(latestBlock),
    blockPageItem: formatBlocksPageItem(latestBlock),
    transactions: formatHomeTransactions(latestBlock.transactions, latestBlock.number, latestBlock.timestamp, currencyName, txLimit, receiptStatusByHash),
    transactionsPageItems,
  };
}

export async function getEvmBlockByNumberDirect(number: bigint) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const block = await client.getBlock({
    blockNumber: number,
    includeTransactions: true,
  });
  const pageItems = formatTransactionsPageItemsForBlock(block, currencyName);
  await rememberEvmTransactionCacheSafe(pageItems);
  const cachedTransactionsByHash = await getEvmCachedTransactionsByHashes(pageItems.map((transaction) => transaction.hash));
  const formattedBlock = formatEvmBlock({
    ...block,
    currencyName,
  });

  return {
    ...formattedBlock,
    transactions: formattedBlock.transactions.map((transaction) => {
      const cachedTransaction = cachedTransactionsByHash[transaction.hash];

      return {
        ...transaction,
        interactedWith: cachedTransaction?.interactedWith ?? transaction.to,
        interactedWithLabel: cachedTransaction?.interactedWithLabel ?? shortenAddress(cachedTransaction?.interactedWith ?? transaction.to),
        receiptStatus: cachedTransaction?.receiptStatus,
        receiptStatusLabel: cachedTransaction?.receiptStatusLabel,
        feeLabel: cachedTransaction?.feeLabel,
        gasUsedLabel: cachedTransaction?.gasUsedLabel,
        gasLimitLabel: cachedTransaction?.gasLimitLabel ?? transaction.gasLabel,
        effectiveGasPriceLabel: cachedTransaction?.effectiveGasPriceLabel,
        nonceLabel: cachedTransaction?.nonceLabel ?? String(transaction.nonce ?? 'Unavailable'),
      };
    }),
  };
}

export async function hasEvmTransactionByHashDirect(hash: string) {
  const { client } = await getEvmClientWithProfile();

  try {
    await client.getTransaction({ hash: hash as `0x${string}` });
    return true;
  } catch {
    return false;
  }
}

export async function getEvmBlockNumberByHashDirect(hash: string) {
  const { client } = await getEvmClientWithProfile();

  try {
    const block = await client.getBlock({
      blockHash: hash as `0x${string}`,
      includeTransactions: false,
    });

    return block.number ?? null;
  } catch {
    return null;
  }
}

export async function getEvmTransactionReceiptSummariesDirect(hashes: string[]) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const uniqueHashes = [...new Set(hashes)];
  const settled = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const receipt = await client.getTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      const effectiveGasPrice = receipt.effectiveGasPrice ?? null;
      const feeValue = receipt.gasUsed != null && effectiveGasPrice != null ? receipt.gasUsed * effectiveGasPrice : null;

      return [
        hash,
        {
          status: receipt.status ?? 'unavailable',
          statusLabel: receipt.status === 'success' ? 'Success' : receipt.status === 'reverted' ? 'Failed' : 'Unavailable',
          feeLabel: formatTransactionFee(feeValue, currencyName),
        },
      ] as const;
    }),
  );

  return Object.fromEntries(
    settled.map((result, index) => {
      const hash = uniqueHashes[index];

      if (result.status === 'fulfilled') {
        return result.value;
      }

      return [
        hash,
        {
          status: 'unavailable',
          statusLabel: 'Unavailable',
          feeLabel: 'Unavailable',
        },
      ] as const;
    }),
  );
}

export async function getEvmTransactionByHashDirect(hash: string) {
  const { client, profile } = await getEvmClientWithProfile();
  const transaction = await client.getTransaction({
    hash: hash as `0x${string}`,
  });
  const [receipt, latestBlockNumber] = await Promise.all([
    client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null),
    client.getBlockNumber().catch(() => null),
  ]);
  const block = transaction.blockNumber != null ? await client.getBlock({ blockNumber: transaction.blockNumber }).catch(() => null) : null;

  return formatEvmTransactionDetail({
    currencyName: getEvmCurrencyName(profile.nativeCurrencySymbol),
    latestBlockNumber,
    transaction,
    receipt,
    block,
  });
}

export async function hydrateEvmCachedTransactionInputsByHashDirect(hashes: string[]) {
  const uniqueHashes = [...new Set(hashes.filter((hash) => /^0x[a-fA-F0-9]{64}$/.test(hash)))];

  if (!uniqueHashes.length) {
    return;
  }

  const { client } = await getEvmClientWithProfile();
  const settled = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const transaction = await client.getTransaction({
        hash: hash as `0x${string}`,
      });

      return {
        hash,
        inputData: transaction.input ?? '0x',
      };
    }),
  );

  await hydrateEvmCachedTransactionInputData(settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])));
}

export async function getEvmTransactionDebugTraceDirect(hash: string) {
  return requestEvmRpcDirect('debug_traceTransaction', [hash]);
}

export async function getEvmAddressSummaryDirect(address: string) {
  if (!isAddress(address)) {
    throw new Error('Invalid EVM address');
  }

  const { client } = await getEvmClientWithProfile();
  const [balance, nonce] = await Promise.all([client.getBalance({ address }), client.getTransactionCount({ address })]);

  return formatEvmAddressSummary({
    address,
    balance,
    nonce,
  });
}

export async function getEvmAddressBalancesDirect(addresses: string[]) {
  const uniqueAddresses = [...new Set(addresses)].filter((address): address is `0x${string}` => isAddress(address));

  if (!uniqueAddresses.length) {
    return {};
  }

  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const settled = await Promise.allSettled(uniqueAddresses.map(async (address) => [address, await client.getBalance({ address })] as const));

  return Object.fromEntries(
    settled.map((result, index) => {
      const address = uniqueAddresses[index];

      if (result.status === 'fulfilled') {
        return [
          address,
          {
            formatted: formatAccountBalance(result.value[1], currencyName),
            wei: result.value[1].toString(),
          },
        ];
      }

      return [
        address,
        {
          formatted: 'Unavailable',
          wei: null,
        },
      ];
    }),
  ) as Record<string, { formatted: string; wei: string | null }>;
}

export async function requestEvmRpcDirect(method: string, params: unknown[] = []) {
  const { client } = await getEvmClientWithProfile();

  return client.transport.request({
    method: method as never,
    params: params as never,
  });
}
