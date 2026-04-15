import { formatEther, formatGwei } from 'viem';

function formatInteger(value: bigint | number | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return new Intl.NumberFormat('en-US').format(Number(value));
}

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function formatTimestamp(timestamp: bigint | null | undefined) {
  if (timestamp == null) {
    return null;
  }

  return Number(timestamp) * 1000;
}

function formatTimestampLabel(timestamp: bigint | null | undefined) {
  if (timestamp == null) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(new Date(Number(timestamp) * 1000));
}

function formatBytes(value: bigint | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return `${formatInteger(value)} bytes`;
}

function formatBaseFee(value: bigint | null | undefined) {
  if (value == null) {
    return 'Unavailable';
  }

  return `${Number(formatGwei(value))
    .toFixed(3)
    .replace(/\.?0+$/, '')} Gwei`;
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        toJsonSafe(entryValue),
      ]),
    );
  }

  return value;
}

function formatDisplayAmount(
  value: bigint | null | undefined,
  currencyName: string,
) {
  const amount = Number(formatEther(value ?? 0n));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(6).replace(/\.?0+$/, '')} ${currencyName}`;
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

export function formatEvmBlock(block: {
  number: bigint;
  hash: string | null;
  parentHash: string;
  miner: string;
  currencyName?: string;
  transactions: readonly unknown[];
  timestamp?: bigint | null;
  gasUsed?: bigint | null;
  gasLimit?: bigint | null;
  baseFeePerGas?: bigint | null;
  size?: bigint | null;
  difficulty?: bigint | null;
  totalDifficulty?: bigint | null;
  nonce?: string | null;
  stateRoot?: string | null;
  receiptsRoot?: string | null;
  transactionsRoot?: string | null;
  withdrawalsRoot?: string | null;
  sha3Uncles?: string | null;
  extraData?: string | null;
  blobGasUsed?: bigint | null;
  withdrawals?: readonly unknown[] | null;
}) {
  const gasUsed = Number(block.gasUsed ?? 0n);
  const gasLimit = Number(block.gasLimit ?? 0n);
  const gasUsedRatio = gasLimit > 0 ? (gasUsed / gasLimit) * 100 : 0;
  const transactions = block.transactions
    .filter(
      (
        transaction,
      ): transaction is {
        hash: string;
        from: string;
        to?: string | null;
        value?: bigint;
        gas?: bigint;
        gasPrice?: bigint | null;
        input?: string;
        nonce?: number;
      } =>
        typeof transaction === 'object' &&
        transaction !== null &&
        'hash' in transaction &&
        'from' in transaction,
    )
    .map((transaction) => ({
      hash: transaction.hash,
      hashLabel: shortenHash(transaction.hash, 12, 0),
      blockNumber: block.number.toString(),
      timestampMs: formatTimestamp(block.timestamp),
      from: transaction.from,
      fromLabel: shortenAddress(transaction.from),
      to: transaction.to ?? null,
      toLabel: shortenAddress(transaction.to),
      methodLabel: formatMethodLabel(transaction.input, transaction.to),
      inputData: transaction.input ?? '0x',
      valueLabel: formatDisplayAmount(
        transaction.value,
        block.currencyName ?? 'ETH',
      ),
      maxTxCostLabel:
        transaction.gas != null && transaction.gasPrice != null
          ? `${Number(formatEther(transaction.gas * transaction.gasPrice))
              .toFixed(6)
              .replace(/\.?0+$/, '')} ${block.currencyName ?? 'ETH'}`
          : 'Unavailable',
      gasLabel: formatInteger(transaction.gas),
      nonce: transaction.nonce ?? null,
    }));

  return {
    height: block.number.toString(),
    hash: block.hash ?? '',
    txCount: block.transactions.length,
    timestamp: formatTimestamp(block.timestamp),
    timestampLabel: formatTimestampLabel(block.timestamp),
    miner: block.miner,
    gasUsedLabel: formatInteger(block.gasUsed),
    gasUsedPercent: formatPercent(gasUsedRatio),
    gasLimitLabel: formatInteger(block.gasLimit),
    baseFeeLabel: formatBaseFee(block.baseFeePerGas),
    sizeLabel: formatBytes(block.size),
    difficultyLabel: formatInteger(block.difficulty),
    totalDifficultyLabel: formatInteger(block.totalDifficulty),
    blobGasUsedLabel: formatInteger(block.blobGasUsed),
    withdrawalsCount: block.withdrawals?.length ?? 0,
    parentHash: block.parentHash,
    stateRoot: block.stateRoot ?? 'Unavailable',
    receiptsRoot: block.receiptsRoot ?? 'Unavailable',
    transactionsRoot: block.transactionsRoot ?? 'Unavailable',
    withdrawalsRoot: block.withdrawalsRoot ?? 'Unavailable',
    sha3Uncles: block.sha3Uncles ?? 'Unavailable',
    nonce: block.nonce ?? 'Unavailable',
    extraData: block.extraData ?? 'Unavailable',
    transactions,
    rawJson: toJsonSafe(block),
  };
}

export function formatEvmTransaction(transaction: {
  hash: string;
  blockNumber?: bigint | null;
  from: string;
  to?: string | null;
  value?: bigint;
  nonce?: number;
  gas?: bigint;
}) {
  return {
    hash: transaction.hash,
    blockNumber: transaction.blockNumber?.toString() ?? null,
    from: transaction.from,
    to: transaction.to ?? null,
    value: formatEther(transaction.value ?? BigInt(0)),
    nonce: transaction.nonce ?? null,
    gas: transaction.gas?.toString() ?? null,
  };
}

function formatDetailedAmount(
  value: bigint | null | undefined,
  currencyName: string,
) {
  if (value == null) {
    return `0 ${currencyName}`;
  }

  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(6).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatDetailedFee(
  value: bigint | null | undefined,
  currencyName: string,
) {
  if (value == null) {
    return 'Unavailable';
  }

  const amount = Number(formatEther(value));

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(9).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatMethodLabel(
  input: string | null | undefined,
  to: string | null | undefined,
) {
  if (!to) {
    return 'Contract Creation';
  }

  if (!input || input === '0x') {
    return 'Transfer';
  }

  return input.slice(0, 10);
}

function formatTransactionTypeLabel(value: string | null | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  if (value.toLowerCase() === 'eip1559') {
    return 'EIP-1559';
  }

  return value.toUpperCase();
}

function formatGasFeeValue(value: bigint | null | undefined) {
  if (value == null) {
    return null;
  }

  return `${formatGwei(value)} Gwei`;
}

function formatTransactionGasFeesLabel(input: {
  type?: string | null;
  baseFeePerGas?: bigint | null;
  gasPrice?: bigint | null;
  maxFeePerGas?: bigint | null;
  maxPriorityFeePerGas?: bigint | null;
  effectiveGasPrice?: bigint | null;
}) {
  const type = input.type?.toLowerCase();

  if (type === 'eip1559') {
    const parts = [
      ['Base', formatGasFeeValue(input.baseFeePerGas)],
      ['Max', formatGasFeeValue(input.maxFeePerGas ?? input.effectiveGasPrice)],
      [
        'Max Priority',
        formatGasFeeValue(
          input.maxPriorityFeePerGas ?? input.effectiveGasPrice,
        ),
      ],
    ]
      .filter(([, value]) => value !== null)
      .map(([label, value]) => `${label}: ${value}`);

    return parts.length ? parts.join(' | ') : 'Unavailable';
  }

  const baseLabel = formatGasFeeValue(
    input.gasPrice ?? input.effectiveGasPrice,
  );

  return baseLabel ? `Base: ${baseLabel}` : 'Unavailable';
}

export function formatEvmTransactionDetail(input: {
  currencyName: string;
  latestBlockNumber: bigint | null;
  transaction: {
    hash: string;
    blockNumber?: bigint | null;
    from: string;
    to?: string | null;
    value?: bigint;
    nonce?: number;
    gas?: bigint;
    gasPrice?: bigint | null;
    maxFeePerGas?: bigint | null;
    maxPriorityFeePerGas?: bigint | null;
    input?: string;
    transactionIndex?: number | null;
    type?: string | null;
  };
  receipt: {
    status?: 'success' | 'reverted' | null;
    gasUsed?: bigint | null;
    effectiveGasPrice?: bigint | null;
    contractAddress?: string | null;
    logs?: readonly unknown[];
  } | null;
  block: {
    timestamp?: bigint | null;
    baseFeePerGas?: bigint | null;
  } | null;
}) {
  const { transaction, receipt, block, latestBlockNumber, currencyName } =
    input;
  const blockNumber = transaction.blockNumber ?? null;
  const gasLimit = transaction.gas ?? null;
  const gasUsed = receipt?.gasUsed ?? null;
  const gasUsedRatio =
    gasLimit != null && gasUsed != null && Number(gasLimit) > 0
      ? (Number(gasUsed) / Number(gasLimit)) * 100
      : null;
  const effectiveGasPrice =
    receipt?.effectiveGasPrice ?? transaction.gasPrice ?? null;
  const feeValue =
    gasUsed != null && effectiveGasPrice != null
      ? gasUsed * effectiveGasPrice
      : null;
  const confirmations =
    latestBlockNumber != null &&
    blockNumber != null &&
    latestBlockNumber >= blockNumber
      ? latestBlockNumber - blockNumber + 1n
      : null;
  const status =
    receipt?.status ?? (blockNumber != null ? 'success' : 'pending');
  const interactedWith = transaction.to ?? receipt?.contractAddress ?? null;

  return {
    hash: transaction.hash,
    blockNumber: blockNumber?.toString() ?? null,
    confirmationsLabel:
      confirmations != null ? formatInteger(confirmations) : null,
    timestampMs: formatTimestamp(block?.timestamp),
    timestampLabel: formatTimestampLabel(block?.timestamp),
    status,
    statusLabel:
      status === 'success'
        ? 'Success'
        : status === 'reverted'
          ? 'Failed'
          : 'Pending',
    from: transaction.from,
    fromLabel: shortenAddress(transaction.from),
    to: transaction.to ?? null,
    toLabel: shortenAddress(transaction.to),
    interactedWith,
    interactedWithLabel: shortenAddress(interactedWith),
    contractAddress: receipt?.contractAddress ?? null,
    valueLabel: formatDetailedAmount(transaction.value, currencyName),
    feeLabel: formatDetailedFee(feeValue, currencyName),
    gasPriceLabel:
      effectiveGasPrice != null
        ? `${formatGwei(effectiveGasPrice)} Gwei`
        : 'Unavailable',
    gasFeesLabel: formatTransactionGasFeesLabel({
      type: transaction.type,
      baseFeePerGas: block?.baseFeePerGas,
      gasPrice: transaction.gasPrice,
      maxFeePerGas: transaction.maxFeePerGas,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
      effectiveGasPrice,
    }),
    gasLimitLabel: formatInteger(gasLimit),
    gasUsedLabel: formatInteger(gasUsed),
    gasUsedPercent:
      gasUsedRatio != null ? formatPercent(gasUsedRatio) : 'Unavailable',
    nonceLabel:
      transaction.nonce != null ? String(transaction.nonce) : 'Unavailable',
    positionLabel:
      transaction.transactionIndex != null
        ? String(transaction.transactionIndex)
        : 'Unavailable',
    typeLabel: formatTransactionTypeLabel(transaction.type),
    methodLabel: formatMethodLabel(transaction.input, transaction.to),
    inputData: transaction.input ?? '0x',
    logsCount: receipt?.logs?.length ?? 0,
    logs: toJsonSafe(receipt?.logs ?? []),
    rawJson: toJsonSafe({
      transaction,
      receipt,
      block,
    }),
  };
}

export function formatEvmAddressSummary(input: {
  address: string;
  balance: bigint;
  nonce: number;
}) {
  return {
    address: input.address,
    balance: formatEther(input.balance),
    nonce: input.nonce,
  };
}
