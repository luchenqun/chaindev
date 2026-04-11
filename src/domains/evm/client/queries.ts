"use client";

import { formatEther, formatGwei, isAddress } from "viem";
import { getEvmCurrencyName } from "@/platform/workbench/rpc-profile";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";
import { createEvmClient } from "@/domains/evm/server/client";
import {
  clearEvmTransactionCache,
  getEvmCachedTransactionsPage,
  getEvmObservedAccountsPage,
  getEvmTransactionCacheSummary,
  hydrateEvmCachedTransactionInputData,
  getLatestCachedTransactionHash,
  rememberEvmTransactionCache,
  type EvmCachedTransactionItem,
} from "@/domains/evm/client/transaction-cache";
import {
  formatEvmAddressSummary,
  formatEvmBlock,
  formatEvmTransactionDetail,
} from "@/domains/evm/server/formatters";

function getActiveEvmProvider() {
  const profile = readActiveRpcProfileCookie("evm");

  if (!profile) {
    throw new Error("No active EVM provider selected.");
  }

  return profile;
}

export function getActiveEvmCurrencyNameClient() {
  return getEvmCurrencyName(readActiveRpcProfileCookie("evm")?.nativeCurrencySymbol);
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
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(Number(timestampSeconds) * 1000));
}

function shortenHash(value: string | null | undefined, start = 10, end = 8) {
  if (!value) {
    return "Unavailable";
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
    return "Contract Creation";
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

  return `${amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, "")} ${currencyName}`;
}

function formatGasUsed(value: bigint | null | undefined) {
  if (value == null) {
    return "Unavailable";
  }

  const gasUsed = Number(value);

  if (gasUsed >= 1_000_000) {
    return `${(gasUsed / 1_000_000).toFixed(2).replace(/\.?0+$/, "")} M Gas`;
  }

  if (gasUsed >= 1_000) {
    return `${(gasUsed / 1_000).toFixed(1).replace(/\.?0+$/, "")} K Gas`;
  }

  return `${gasUsed} Gas`;
}

function formatInteger(value: bigint | number | null | undefined) {
  if (value == null) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(Number(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatBaseFee(value: bigint | null | undefined) {
  if (value == null) {
    return "Unavailable";
  }

  return `${Number(formatGwei(value)).toFixed(3).replace(/\.?0+$/, "")} Gwei`;
}

function formatTransactionFee(value: bigint | null | undefined, currencyName: string) {
  if (value == null) {
    return "Unavailable";
  }

  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(9).replace(/\.?0+$/, "")} ${currencyName}`;
}

function formatAccountBalance(value: bigint, currencyName: string) {
  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  if (amount < 0.000001) {
    return `<0.000001 ${currencyName}`;
  }

  return `${amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, "")} ${currencyName}`;
}

function formatIntervalSeconds(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "Unavailable";
  }

  if (seconds < 1) {
    return `${seconds.toFixed(2).replace(/\.?0+$/, "")}s`;
  }

  if (seconds < 10) {
    return `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
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

  return Math.max(1_000, Math.min(30_000, Math.round(averageSeconds * 1_000)));
}

function derivePollIntervalMsFromRange(latestTimestamp: bigint, oldestTimestamp: bigint, blockSpan: number) {
  if (blockSpan <= 0) {
    return 12_000;
  }

  const averageSeconds = (Number(latestTimestamp - oldestTimestamp) / blockSpan) * 0.8;

  return Math.max(1_000, Math.min(30_000, Math.round(averageSeconds * 1_000)));
}

function parseHexQuantity(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatHomeBlockItem(block: {
  number: bigint;
  hash: string | null;
  miner: string;
  transactions: readonly unknown[];
  timestamp?: bigint | null;
  gasUsed?: bigint | null;
}) {
  return {
    number: block.number.toString(),
    numberLabel: block.number.toString(),
    hash: block.hash ?? "",
    hashLabel: shortenHash(block.hash),
    miner: block.miner,
    minerLabel: shortenAddress(block.miner),
    txCount: `${block.transactions.length} txns`,
    timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
    gasUsedLabel: formatGasUsed(block.gasUsed),
  };
}

function formatHomeTransactions(
  transactions: readonly unknown[],
  timestamp: bigint | null | undefined,
  currencyName: string,
  limit: number,
) {
  const items: Array<{
    hash: string;
    hashLabel: string;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    value: string;
    timestampMs: number | null;
  }> = [];

  type HomeTransactionLike = {
    hash: string;
    from: string;
    to?: string | null;
    value?: bigint;
  };

  function isHomeTransactionLike(transaction: unknown): transaction is HomeTransactionLike {
    return (
      typeof transaction === "object" &&
      transaction !== null &&
      "hash" in transaction &&
      "from" in transaction
    );
  }

  for (const transaction of transactions) {
    if (items.length >= limit) {
      break;
    }

    if (typeof transaction === "string" || !isHomeTransactionLike(transaction)) {
      continue;
    }

    items.push({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 14, 0),
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      value: formatTxValue(transaction.value, currencyName),
      timestampMs: timestamp ? Number(timestamp) * 1000 : null,
    });
  }

  return items;
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
  return (
    typeof transaction === "object" &&
    transaction !== null &&
    "hash" in transaction &&
    "from" in transaction
  );
}

function formatMethodLabel(input: string | undefined, to: string | null | undefined) {
  if (!to) {
    return "Create";
  }

  if (!input || input === "0x") {
    return "Transfer";
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
    hash: block.hash ?? "",
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
  status: "empty" | "valid" | "cleared" | "failed";
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
    methodLabel: string;
    inputData: string;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
  }>,
) {
  return transactions.map(
    (transaction): FormattedTransactionsPageItem => ({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 12, 0),
      blockNumber: transaction.blockNumber,
      timestampMs: transaction.timestampMs,
      from: transaction.from,
      fromLabel: transaction.fromLabel,
      to: transaction.to,
      toLabel: transaction.toLabel,
      methodLabel: transaction.methodLabel,
      inputData: transaction.inputData,
      amountLabel: transaction.amountLabel,
      maxTxCostLabel:
        transaction.gas != null && transaction.gasPrice != null
          ? `${Number(formatEther(transaction.gas * transaction.gasPrice)).toFixed(6).replace(/\.?0+$/, "")} ${currencyName}`
          : "Unavailable",
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
    methodLabel: string;
    inputData: string;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
  }> = [];

  for (const transaction of block.transactions) {
    if (collected.length >= limit) {
      break;
    }

    if (typeof transaction === "string" || !isPageTransactionLike(transaction)) {
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
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? "0x",
      amountLabel: formatTxValue(transaction.value, currencyName),
      gas: transaction.gas ?? null,
      gasPrice: transaction.gasPrice ?? null,
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
  methodLabel: string;
  inputData: string;
  amountLabel: string;
  nonceLabel: string;
  gasPriceLabel: string;
  maxTxCostLabel: string;
};

function formatPendingGasPrice(value: bigint | null | undefined) {
  if (value == null) {
    return "Unavailable";
  }

  return `${Number(formatGwei(value)).toFixed(3).replace(/\.?0+$/, "")} Gwei`;
}

function formatPendingTransactions(
  transactions: readonly unknown[],
  currencyName: string,
  limit: number,
) {
  const items: FormattedPendingTransactionItem[] = [];

  for (const transaction of transactions) {
    if (items.length >= limit) {
      break;
    }

    if (typeof transaction === "string" || !isPageTransactionLike(transaction)) {
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
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? "0x",
      amountLabel: formatTxValue(transaction.value, currencyName),
      nonceLabel: formatInteger(transaction.nonce),
      gasPriceLabel: formatPendingGasPrice(effectiveGasPrice),
      maxTxCostLabel:
        transaction.gas != null && effectiveGasPrice != null
          ? `${Number(formatEther(transaction.gas * effectiveGasPrice)).toFixed(6).replace(/\.?0+$/, "")} ${currencyName}`
          : "Unavailable",
    });
  }

  return items;
}

export async function getEvmHomeMetricsDirect() {
  const { client } = await getEvmClientWithProfile();
  const [chainId, block, gasPrice] = await Promise.all([
    client.getChainId(),
    client.getBlock(),
    client.getGasPrice(),
  ]);

  return {
    latestBlock: block.number.toString(),
    latestBlockTime: formatLocalDateTime(block.timestamp),
    gasPrice: `${Number(formatGwei(gasPrice)).toFixed(3)} Gwei`,
    chainId: String(chainId),
  };
}

export async function getEvmLiveStatusDirect() {
  const { client } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({ blockTag: "latest" });
  let pollIntervalMs = 12_000;

  if (latestBlock.number > 0n) {
    const oldestBlockNumber = latestBlock.number > 10n ? latestBlock.number - 10n : 0n;
    const oldestBlock = await client.getBlock({ blockNumber: oldestBlockNumber });

    if (latestBlock.timestamp != null && oldestBlock.timestamp != null) {
      pollIntervalMs = derivePollIntervalMsFromRange(
        latestBlock.timestamp,
        oldestBlock.timestamp,
        Number(latestBlock.number - oldestBlock.number),
      );
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
  const transactions: Array<{
    hash: string;
    hashLabel: string;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    value: string;
    timestampMs: number | null;
  }> = [];
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);

  for (let cursor = latestNumber; cursor >= 0n; cursor -= 1n) {
    const includeTransactions = transactions.length < txLimit;
    const block = await client.getBlock({
      blockNumber: cursor,
      includeTransactions,
    });

    if (blocks.length < blockLimit) {
      blocks.push(formatHomeBlockItem(block));
    }

    if (includeTransactions) {
      transactions.push(...formatHomeTransactions(block.transactions, block.timestamp, currencyName, txLimit - transactions.length));
      void rememberEvmTransactionCache(formatTransactionsPageItemsForBlock(block, currencyName));
    }

    if (blocks.length >= blockLimit && transactions.length >= txLimit) {
      break;
    }

    if (cursor === 0n) {
      break;
    }
  }

  return {
    blocks,
    transactions,
  };
}

export async function getEvmHomeSnapshotDirect(blockLimit = 6, txLimit = 6) {
  const { client, profile } = await getEvmClientWithProfile();
  const [chainId, gasPrice, latestNumber] = await Promise.all([
    client.getChainId(),
    client.getGasPrice(),
    client.getBlockNumber(),
  ]);
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
  const transactions: Array<{
    hash: string;
    hashLabel: string;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    value: string;
    timestampMs: number | null;
  }> = [];
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  let latestBlockTimestamp: bigint | undefined;
  const timestamps: bigint[] = [];
  let recentTransactionCount = 0;
  const cacheCandidates: EvmCachedTransactionItem[] = [];

  for (let cursor = latestNumber; cursor >= 0n; cursor -= 1n) {
    const includeTransactions = transactions.length < txLimit;
    const block = await client.getBlock({
      blockNumber: cursor,
      includeTransactions,
    });

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

    if (includeTransactions) {
      transactions.push(...formatHomeTransactions(block.transactions, block.timestamp, currencyName, txLimit - transactions.length));
      cacheCandidates.push(...formatTransactionsPageItemsForBlock(block, currencyName));
    }

    if (timestamps.length >= 11 && blocks.length >= blockLimit && transactions.length >= txLimit) {
      break;
    }

    if (cursor === 0n) {
      break;
    }
  }

  await rememberEvmTransactionCache(cacheCandidates);
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
  const averageBlockTimeSeconds = intervalSamples.length
    ? intervalSamples.reduce((sum, value) => sum + value, 0) / intervalSamples.length
    : null;
  const pendingTransactionCountHex = await client.transport
    .request({
      method: "eth_getBlockTransactionCountByNumber",
      params: ["pending"] as never,
    })
    .catch(() => null);
  const pendingTransactionCount = parseHexQuantity(pendingTransactionCountHex);
  const cacheSummary = await getEvmTransactionCacheSummary();

  return {
    header: {
      connection: "Direct JSON-RPC",
      providerName: profile.name,
      nativeCurrency: currencyName,
      chainId: String(chainId),
    },
    metrics: [
      { label: "Latest Block", value: latestNumber.toString(), subtext: "Current head" },
      { label: "Latest Block Time", value: formatLocalDateTime(latestBlockTimestamp), subtext: "Local formatted time" },
      {
        label: "Average Block Time",
        value: formatIntervalSeconds(averageBlockTimeSeconds),
        subtext: "Sampled from recent blocks",
      },
      {
        label: "Gas Price",
        value: `${Number(formatGwei(gasPrice)).toFixed(3).replace(/\.?0+$/, "")} Gwei`,
        subtext: "Quoted in gwei",
      },
      {
        label: "Pending Tx Count",
        value: pendingTransactionCount != null ? formatInteger(pendingTransactionCount) : "Unavailable",
        subtext:
          pendingTransactionCount != null
            ? "Pending pool snapshot"
            : "Provider does not expose pending pool",
      },
      {
        label: "Recent Tx Count",
        value: formatInteger(recentTransactionCount),
        subtext: `Last ${Math.min(10, timestamps.length)} blocks`,
      },
      {
        label: "Cached Transactions",
        value: formatInteger(cacheSummary.totalTransactions),
        subtext: "Local IndexedDB",
      },
      {
        label: "Observed Accounts",
        value: formatInteger(cacheSummary.totalObservedAccounts),
        subtext: "Derived from cached transactions",
      },
    ],
    activity: {
      blocks,
      transactions,
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
    blockTag: "latest",
    includeTransactions: true,
  });
  void rememberEvmTransactionCache(formatTransactionsPageItemsForBlock(latestBlock, currencyName));

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    block: formatHomeBlockItem(latestBlock),
    transactions: formatHomeTransactions(latestBlock.transactions, latestBlock.timestamp, currencyName, txLimit),
  };
}

export async function getLatestEvmBlockSummaryDirect() {
  const { client } = await getEvmClientWithProfile();
  return formatEvmBlock(await client.getBlock());
}

export async function getRecentEvmBlocksDirect(limit = 8) {
  const { client } = await getEvmClientWithProfile();
  const latestNumber = await client.getBlockNumber();
  const blocks = [];

  for (let cursor = latestNumber; blocks.length < limit; cursor -= 1n) {
    const block = await client.getBlock({ blockNumber: cursor });
    blocks.push(formatEvmBlock(block));

    if (cursor === 0n) {
      break;
    }
  }

  return blocks;
}

export async function getEvmBlocksPageDirect(page = 1, limit = 10) {
  const { client } = await getEvmClientWithProfile();
  const latestNumber = await client.getBlockNumber();
  const totalBlocks = Number(latestNumber) + 1;
  const totalPages = Math.max(1, Math.ceil(totalBlocks / limit));
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const startOffset = BigInt((normalizedPage - 1) * limit);
  const startCursor = latestNumber >= startOffset ? latestNumber - startOffset : 0n;
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

  for (let cursor = startCursor; blocks.length < limit && cursor >= 0n; cursor -= 1n) {
    const block = await client.getBlock({ blockNumber: cursor });
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

    if (cursor === 0n) {
      break;
    }
  }

  const sampleCount = blocks.length || 1;
  const averageBlockTimeMs = derivePollIntervalMs(timestamps) / 0.8;
  const averageBaseFee = baseFeeCount ? `${(totalBaseFee / baseFeeCount).toFixed(3).replace(/\.?0+$/, "")} Gwei` : "Unavailable";

  return {
    page: normalizedPage,
    pageSize: limit,
    totalBlocks,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    summary: [
      { label: "Latest Block", value: latestNumber.toString(), note: "Current head" },
      { label: "Average Block Time", value: `${(averageBlockTimeMs / 1000).toFixed(1).replace(/\.0$/, "")} s`, note: `Last ${blocks.length} blocks` },
      { label: "Average Gas Utilization", value: formatPercent(totalGasRatio / sampleCount), note: `Last ${blocks.length} blocks` },
      { label: "Average Base Fee", value: averageBaseFee, note: `Last ${blocks.length} blocks` },
    ],
    totalLabel: `Total of recent ${blocks.length} blocks`,
    blocks,
  };
}

export async function getEvmTransactionsPageDirect(page = 1, limit = 20) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: "latest",
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

    const blockTransactions = formatTransactionsPageItemsForBlock(
      block,
      currencyName,
      maxTransactions - collected.length,
    );
    collected.push(...blockTransactions);
    void rememberEvmTransactionCache(blockTransactions);

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

export async function getLatestEvmTransactionsDirect(limit = 20) {
  const { client, profile } = await getEvmClientWithProfile();
  const latestBlock = await client.getBlock({
    blockTag: "latest",
    includeTransactions: true,
  });
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const transactions = formatTransactionsPageItemsForBlock(latestBlock, currencyName, limit);
  void rememberEvmTransactionCache(transactions);

  return {
    latestBlockNumber: latestBlock.number.toString(),
    transactions,
  };
}

export async function getEvmPendingTransactionsDirect(limit = 100) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const latestBlock = await client.getBlock({ blockTag: "latest" });
  const pendingBlock = await client.getBlock({
    blockTag: "pending",
    includeTransactions: true,
  });

  let pollIntervalMs = 12_000;

  if (latestBlock.number > 0n) {
    const oldestBlockNumber = latestBlock.number > 10n ? latestBlock.number - 10n : 0n;
    const oldestBlock = await client.getBlock({ blockNumber: oldestBlockNumber });

    if (latestBlock.timestamp != null && oldestBlock.timestamp != null) {
      pollIntervalMs = derivePollIntervalMsFromRange(
        latestBlock.timestamp,
        oldestBlock.timestamp,
        Number(latestBlock.number - oldestBlock.number),
      );
    }
  }

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
  const [chainId, gasPrice, latestNumber] = await Promise.all([
    client.getChainId(),
    client.getGasPrice(),
    client.getBlockNumber(),
  ]);
  const latestCachedTransactionHash = await getLatestCachedTransactionHash();
  let cacheValidationLabel = "Verified";

  if (latestCachedTransactionHash) {
    const existingTransaction = await client.transport.request({
      method: "eth_getTransactionByHash",
      params: [latestCachedTransactionHash] as never,
    });

    if (existingTransaction == null) {
      await clearEvmTransactionCache();
      cacheValidationLabel = "Cleared on provider mismatch";
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
  const recentTransactions: Array<{
    hash: string;
    hashLabel: string;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    value: string;
    timestampMs: number | null;
  }> = [];
  const cacheCandidates: EvmCachedTransactionItem[] = [];

  for (let cursor = latestNumber; cursor >= 0n; cursor -= 1n) {
    const includeTransactions = recentTransactions.length < 5;
    const block = await client.getBlock({
      blockNumber: cursor,
      includeTransactions,
    });

    if (recentBlocks.length < 11) {
      recentBlocks.push({
        number: block.number,
        hash: block.hash ?? null,
        miner: block.miner,
        transactions: block.transactions,
        timestamp: block.timestamp,
        gasUsed: block.gasUsed,
      });
    }

    if (includeTransactions) {
      recentTransactions.push(
        ...formatHomeTransactions(
          block.transactions,
          block.timestamp,
          currencyName,
          5 - recentTransactions.length,
        ),
      );
      cacheCandidates.push(...formatTransactionsPageItemsForBlock(block, currencyName));
    }

    if (recentBlocks.length >= 11 && recentTransactions.length >= 5) {
      break;
    }

    if (cursor === 0n) {
      break;
    }
  }

  await rememberEvmTransactionCache(cacheCandidates);

  const activityBlocks = recentBlocks.slice(0, 5).map((block) => formatHomeBlockItem(block));
  const rhythmRows = recentBlocks.slice(0, 10).map((block, index) => {
    const previousBlock = recentBlocks[index + 1];
    const intervalSeconds =
      block.timestamp != null && previousBlock?.timestamp != null
        ? Number(block.timestamp - previousBlock.timestamp)
        : null;

    return {
      number: block.number.toString(),
      hash: block.hash ?? "",
      intervalSeconds,
      intervalLabel: formatIntervalSeconds(intervalSeconds),
      txCount: block.transactions.length,
      gasUsedLabel: formatGasUsed(block.gasUsed),
      timestampMs: block.timestamp ? Number(block.timestamp) * 1000 : null,
    };
  });
  const intervalSamples = rhythmRows
    .map((row) => row.intervalSeconds)
    .filter((value): value is number => value != null);
  const averageIntervalSeconds = intervalSamples.length
    ? intervalSamples.reduce((sum, value) => sum + value, 0) / intervalSamples.length
    : null;
  const fastestIntervalSeconds = intervalSamples.length ? Math.min(...intervalSamples) : null;
  const slowestIntervalSeconds = intervalSamples.length ? Math.max(...intervalSamples) : null;
  const latestBlock = recentBlocks[0] ?? null;
  const pendingTransactionCountHex = await client.transport
    .request({
      method: "eth_getBlockTransactionCountByNumber",
      params: ["pending"] as never,
    })
    .catch(() => null);
  const pendingTransactionCount = parseHexQuantity(pendingTransactionCountHex);
  const cacheSummary = await getEvmTransactionCacheSummary();

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
      gasPrice: `${Number(formatGwei(gasPrice)).toFixed(3).replace(/\.?0+$/, "")} Gwei`,
      chainId: String(chainId),
      pendingTransactionCount:
        pendingTransactionCount != null ? formatInteger(pendingTransactionCount) : "Unavailable",
    },
    activity: {
      blocks: activityBlocks,
      transactions: recentTransactions,
    },
    rhythm: {
      averageInterval: formatIntervalSeconds(averageIntervalSeconds),
      fastestInterval: formatIntervalSeconds(fastestIntervalSeconds),
      slowestInterval: formatIntervalSeconds(slowestIntervalSeconds),
      recentTransactionCount: formatInteger(
        rhythmRows.reduce((sum, row) => sum + row.txCount, 0),
      ),
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
    pollIntervalMs: latestBlock?.timestamp != null && recentBlocks[10]?.timestamp != null
      ? derivePollIntervalMsFromRange(
          latestBlock.timestamp,
          recentBlocks[10].timestamp,
          Number(latestBlock.number - recentBlocks[10].number),
        )
      : derivePollIntervalMs(
          recentBlocks
            .map((block) => block.timestamp)
            .filter((value): value is bigint => value != null),
        ),
  };
}

export async function validateActiveEvmCacheDirect(): Promise<EvmCacheValidationResult> {
  const { client } = await getEvmClientWithProfile();
  const latestCachedTransactionHash = await getLatestCachedTransactionHash();

  if (!latestCachedTransactionHash) {
    return {
      status: "empty" as const,
      label: "No cached transactions to validate",
    };
  }

  const existingTransaction = await client.transport
    .request({
      method: "eth_getTransactionByHash",
      params: [latestCachedTransactionHash] as never,
    })
    .catch(() => null);

  if (existingTransaction == null) {
    await clearEvmTransactionCache();
    return {
      status: "cleared" as const,
      label: "Cleared on provider mismatch",
    };
  }

  return {
    status: "valid" as const,
    label: "Verified",
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
      connection: "Direct JSON-RPC",
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
  const [chainId, cacheSummary] = await Promise.all([
    client.getChainId(),
    getEvmTransactionCacheSummary(),
  ]);

  return {
    header: {
      connection: "Direct JSON-RPC",
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
    blockTag: "latest",
    includeTransactions: true,
  });
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  let pollIntervalMs = 12_000;

  if (includePollSample && latestBlock.number > 0n) {
    const oldestBlockNumber = latestBlock.number > 10n ? latestBlock.number - 10n : 0n;
    const oldestBlock = await client.getBlock({ blockNumber: oldestBlockNumber });

    if (latestBlock.timestamp != null && oldestBlock.timestamp != null) {
      pollIntervalMs = derivePollIntervalMsFromRange(
        latestBlock.timestamp,
        oldestBlock.timestamp,
        Number(latestBlock.number - oldestBlock.number),
      );
    }
  }

  const transactionsPageItems = formatTransactionsPageItemsForBlock(latestBlock, currencyName, txLimit);
  void rememberEvmTransactionCache(formatTransactionsPageItemsForBlock(latestBlock, currencyName));

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    pollIntervalMs,
    block: formatHomeBlockItem(latestBlock),
    blockPageItem: formatBlocksPageItem(latestBlock),
    transactions: formatHomeTransactions(latestBlock.transactions, latestBlock.timestamp, currencyName, 6),
    transactionsPageItems,
  };
}

export async function getEvmBlockByNumberDirect(number: bigint) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const block = await client.getBlock({ blockNumber: number, includeTransactions: true });
  void rememberEvmTransactionCache(formatTransactionsPageItemsForBlock(block, currencyName));

  return formatEvmBlock({
    ...block,
    currencyName,
  });
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

export async function getEvmTransactionReceiptSummariesDirect(hashes: string[]) {
  const { client, profile } = await getEvmClientWithProfile();
  const currencyName = getEvmCurrencyName(profile.nativeCurrencySymbol);
  const uniqueHashes = [...new Set(hashes)];
  const settled = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
      const effectiveGasPrice = receipt.effectiveGasPrice ?? null;
      const feeValue =
        receipt.gasUsed != null && effectiveGasPrice != null
          ? receipt.gasUsed * effectiveGasPrice
          : null;

      return [
        hash,
        {
          status: receipt.status ?? "unavailable",
          statusLabel:
            receipt.status === "success"
              ? "Success"
              : receipt.status === "reverted"
                ? "Failed"
                : "Unavailable",
          feeLabel: formatTransactionFee(feeValue, currencyName),
        },
      ] as const;
    }),
  );

  return Object.fromEntries(
    settled.map((result, index) => {
      const hash = uniqueHashes[index];

      if (result.status === "fulfilled") {
        return result.value;
      }

      return [
        hash,
        {
          status: "unavailable",
          statusLabel: "Unavailable",
          feeLabel: "Unavailable",
        },
      ] as const;
    }),
  );
}

export async function getEvmTransactionByHashDirect(hash: string) {
  const { client, profile } = await getEvmClientWithProfile();
  const transaction = await client.getTransaction({ hash: hash as `0x${string}` });
  const [receipt, latestBlockNumber] = await Promise.all([
    client.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null),
    client.getBlockNumber().catch(() => null),
  ]);
  const block =
    transaction.blockNumber != null
      ? await client.getBlock({ blockNumber: transaction.blockNumber }).catch(() => null)
      : null;

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
      const transaction = await client.getTransaction({ hash: hash as `0x${string}` });

      return {
        hash,
        inputData: transaction.input ?? "0x",
      };
    }),
  );

  await hydrateEvmCachedTransactionInputData(
    settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );
}

export async function getEvmTransactionDebugTraceDirect(hash: string) {
  return requestEvmRpcDirect("debug_traceTransaction", [hash]);
}

export async function getEvmAddressSummaryDirect(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid EVM address");
  }

  const { client } = await getEvmClientWithProfile();
  const [balance, nonce] = await Promise.all([
    client.getBalance({ address }),
    client.getTransactionCount({ address }),
  ]);

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
  const settled = await Promise.allSettled(
    uniqueAddresses.map(async (address) => [address, await client.getBalance({ address })] as const),
  );

  return Object.fromEntries(
    settled.map((result, index) => {
      const address = uniqueAddresses[index];

      if (result.status === "fulfilled") {
        return [address, formatAccountBalance(result.value[1], currencyName)];
      }

      return [address, "Unavailable"];
    }),
  ) as Record<string, string>;
}

export async function requestEvmRpcDirect(method: string, params: unknown[] = []) {
  const { client } = await getEvmClientWithProfile();

  return client.transport.request({
    method: method as never,
    params: params as never,
  });
}
