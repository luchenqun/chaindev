"use client";

import { formatEther, formatGwei, isAddress } from "viem";
import { getEvmCurrencyName } from "@/platform/workbench/rpc-profile";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";
import { createEvmClient } from "@/domains/evm/server/client";
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

type FormattedTransactionsPageItem = {
  hash: string;
  hashLabel: string;
  blockNumber: string;
  timestampMs: number | null;
  from: string;
  fromLabel: string;
  to: string | null;
  toLabel: string;
  methodLabel: string;
  amountLabel: string;
  maxTxCostLabel: string;
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
      amountLabel: transaction.amountLabel,
      maxTxCostLabel:
        transaction.gas != null && transaction.gasPrice != null
          ? `${Number(formatEther(transaction.gas * transaction.gasPrice)).toFixed(6).replace(/\.?0+$/, "")} ${currencyName}`
          : "Unavailable",
    }),
  );
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

    if (blocks.length < blockLimit) {
      blocks.push(formatHomeBlockItem(block));
    }

    if (includeTransactions) {
      transactions.push(...formatHomeTransactions(block.transactions, block.timestamp, currencyName, txLimit - transactions.length));
    }

    if (blocks.length >= blockLimit && transactions.length >= txLimit) {
      break;
    }

    if (cursor === 0n) {
      break;
    }
  }

  return {
    metrics: [
      { label: "Latest Block", value: latestNumber.toString() },
      { label: "Latest Block Time", value: formatLocalDateTime(latestBlockTimestamp) },
      { label: "Gas Price", value: `${Number(formatGwei(gasPrice)).toFixed(3)} Gwei` },
      { label: "Chain ID", value: String(chainId) },
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
  const collected: Array<{
    hash: string;
    blockNumber: string;
    timestampMs: number | null;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    methodLabel: string;
    amountLabel: string;
    gasPrice: bigint | null;
  }> = [];
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

    for (const transaction of block.transactions) {
      if (collected.length >= maxTransactions) {
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
        amountLabel: formatTxValue(transaction.value, currencyName),
        gas: transaction.gas ?? null,
        gasPrice: transaction.gasPrice ?? null,
      });
    }

    if (collected.length >= maxTransactions || cursor === 0n) {
      break;
    }
  }

  const totalTransactions = collected.length;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / limit));
  const normalizedPage = Math.max(1, Math.min(page, totalPages));
  const pageStart = (normalizedPage - 1) * limit;
  const currentPageTransactions = collected.slice(pageStart, pageStart + limit);
  const transactions = finalizeTransactionsPageItems(currencyName, currentPageTransactions);

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
  const collected: Array<{
    hash: string;
    blockNumber: string;
    timestampMs: number | null;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    methodLabel: string;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
  }> = [];

  for (const transaction of latestBlock.transactions) {
    if (collected.length >= limit) {
      break;
    }

    if (typeof transaction === "string" || !isPageTransactionLike(transaction)) {
      continue;
    }

    collected.push({
      hash: transaction.hash,
      blockNumber: latestBlock.number.toString(),
      timestampMs: latestBlock.timestamp ? Number(latestBlock.timestamp) * 1000 : null,
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      amountLabel: formatTxValue(transaction.value, currencyName),
      gas: transaction.gas ?? null,
      gasPrice: transaction.gasPrice ?? null,
    });
  }

  return {
    latestBlockNumber: latestBlock.number.toString(),
    transactions: finalizeTransactionsPageItems(currencyName, collected),
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

  const collected: Array<{
    hash: string;
    blockNumber: string;
    timestampMs: number | null;
    from: string;
    fromLabel: string;
    to: string | null;
    toLabel: string;
    methodLabel: string;
    amountLabel: string;
    gas: bigint | null;
    gasPrice: bigint | null;
  }> = [];

  for (const transaction of latestBlock.transactions) {
    if (collected.length >= txLimit) {
      break;
    }

    if (typeof transaction === "string" || !isPageTransactionLike(transaction)) {
      continue;
    }

    collected.push({
      hash: transaction.hash,
      blockNumber: latestBlock.number.toString(),
      timestampMs: latestBlock.timestamp ? Number(latestBlock.timestamp) * 1000 : null,
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      amountLabel: formatTxValue(transaction.value, currencyName),
      gas: transaction.gas ?? null,
      gasPrice: transaction.gasPrice ?? null,
    });
  }

  return {
    latestBlock: latestBlock.number.toString(),
    latestBlockNumber: Number(latestBlock.number),
    latestBlockTime: formatLocalDateTime(latestBlock.timestamp),
    latestBlockTimestamp: latestBlock.timestamp ? Number(latestBlock.timestamp) : null,
    pollIntervalMs,
    block: formatHomeBlockItem(latestBlock),
    blockPageItem: formatBlocksPageItem(latestBlock),
    transactions: formatHomeTransactions(latestBlock.transactions, latestBlock.timestamp, currencyName, 6),
    transactionsPageItems: finalizeTransactionsPageItems(currencyName, collected),
  };
}

export async function getEvmBlockByNumberDirect(number: bigint) {
  const { client, profile } = await getEvmClientWithProfile();
  return formatEvmBlock({
    ...(await client.getBlock({ blockNumber: number, includeTransactions: true })),
    currencyName: getEvmCurrencyName(profile.nativeCurrencySymbol),
  });
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

export async function requestEvmRpcDirect(method: string, params: unknown[] = []) {
  const { client } = await getEvmClientWithProfile();

  return client.transport.request({
    method: method as never,
    params: params as never,
  });
}
