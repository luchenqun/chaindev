'use client';

import {
  formatCosmosBlock,
  formatCosmosTx,
} from '@/domains/cosmos/server/formatters';
import {
  getRecentCachedCosmosTransactions,
  rememberCosmosTransactionCache,
  type CosmosCachedTransactionItem,
} from '@/domains/cosmos/client/transaction-cache';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

type CosmosProvider = NonNullable<ReturnType<typeof readActiveRpcProfileCookie>>;

type TendermintStatusResponse = {
  result?: {
    node_info?: {
      moniker?: string;
      network?: string;
    };
    sync_info?: {
      latest_block_height?: string;
      latest_block_time?: string;
    };
    validator_info?: {
      address?: string;
    };
  };
};

type TendermintNetInfoResponse = {
  result?: {
    n_peers?: string;
  };
};

type TendermintUnconfirmedTxsResponse = {
  result?: {
    n_txs?: string;
    total?: string;
  };
};

type TendermintBlockMeta = {
  block_id?: { hash?: string };
  header?: {
    height?: string;
    time?: string;
    proposer_address?: string;
    app_hash?: string;
  };
  num_txs?: string;
  block_size?: string;
};

type TendermintBlockchainResponse = {
  result?: {
    block_metas?: TendermintBlockMeta[];
  };
};

type TendermintBlockResponse = {
  result?: {
    block_id?: { hash?: string };
    block?: {
      header?: {
        height?: string;
        time?: string;
      };
    };
  };
};

type TendermintCommitResponse = {
  result?: {
    signed_header?: {
      commit?: {
        signatures?: Array<{
          block_id_flag?: number | string;
          validator_address?: string;
          signature?: string | null;
        }>;
      };
    };
  };
};

type TendermintTxSearchResponse = {
  result?: {
    total_count?: string;
    txs?: TendermintTxSearchItem[];
  };
};

type TendermintTxSearchItem = {
  hash?: string;
  height?: string;
  tx_result?: {
    code?: number;
    gas_wanted?: string;
    gas_used?: string;
  };
};

type TendermintValidatorsResponse = {
  result?: {
    validators?: Array<{
      address?: string;
      pub_key?: { value?: string };
    }>;
  };
};

type CosmosRestTxResponse = {
  tx?: {
    auth_info?: {
      fee?: {
        amount?: Array<{
          denom: string;
          amount: string;
        }>;
      };
    };
    body?: {
      messages?: Array<Record<string, unknown>>;
    };
  };
  tx_response?: {
    txhash?: string;
    height?: string;
    code?: number;
    gas_used?: string;
    gas_wanted?: string;
    raw_log?: string;
    events?: Array<{
      type?: string;
      attributes?: Array<{ key?: string; value?: string }>;
    }>;
  };
};

type CosmosValidatorsResponse = {
  validators?: Array<{
    operator_address?: string;
    consensus_pubkey?: { key?: string };
    description?: { moniker?: string };
    status?: string;
  }>;
  pagination?: {
    total?: string;
  };
};

type CosmosPoolResponse = {
  pool?: {
    bonded_tokens?: string;
    not_bonded_tokens?: string;
  };
};

type CosmosCommunityPoolResponse = {
  pool?: Array<{
    denom: string;
    amount: string;
  }>;
};

type CosmosSupplyResponse = {
  supply?: Array<{
    denom: string;
    amount: string;
  }>;
};

export type CosmosHomeBlockItem = {
  height: string;
  hash: string;
  hashLabel: string;
  proposer: string;
  proposerLabel: string;
  txCount: string;
  timeLabel: string;
  timestampMs: number | null;
};

export type CosmosBlocksPageItem = {
  height: string;
  hash: string;
  hashLabel: string;
  proposer: string;
  proposerLabel: string;
  proposerAddressLabel: string;
  txCount: number;
  txCountLabel: string;
  blockSizeLabel: string;
  appHash: string;
  appHashLabel: string;
  signaturesLabel: string;
  timeLabel: string;
  timestampMs: number | null;
};

export type CosmosLatestBlockFeed = {
  latestBlock: string;
  latestBlockNumber: number;
  latestBlockTime: string;
  latestBlockTimestampMs: number | null;
  blockPageItem: CosmosBlocksPageItem;
};

export type CosmosHomeTransactionItem = {
  hash: string;
  hashLabel: string;
  height: string;
  type: string;
  sender: string;
  senderLabel: string;
  feeLabel: string;
  status: 'success' | 'failed';
  statusLabel: string;
  timestampMs: number | null;
};

export type CosmosHomeSnapshot = {
  header: {
    connection: string;
    providerName: string;
    chainId: string;
    latestBlockTime: string;
  };
  metrics: Array<{
    label: string;
    value: string;
    subtext?: string;
  }>;
  activity: {
    blocks: CosmosHomeBlockItem[];
    transactions: CosmosHomeTransactionItem[];
  };
  latestHeight: number;
  refreshedAt: number;
};

export function getActiveCosmosProvider() {
  const profile = readActiveRpcProfileCookie('cosmos');

  if (!profile) {
    throw new Error('No active Cosmos provider selected.');
  }

  if (!profile.restUrl) {
    throw new Error('The selected Cosmos provider is missing a REST URL.');
  }

  return profile;
}

type CachedCosmosValidatorMaps = {
  providerId: string;
  cachedAt: number;
  monikerByPubKey: Map<string, string>;
  proposerMonikerByAddress: Map<string, string>;
};

const COSMOS_VALIDATOR_CACHE_TTL_MS = 60_000;
let cachedCosmosValidatorMaps: CachedCosmosValidatorMaps | null = null;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatInteger(
  value: string | number | bigint | null | undefined,
  fallback = 'Unavailable',
) {
  if (value == null) {
    return fallback;
  }

  const normalized = String(value).trim();

  if (!normalized || !/^-?\d+$/.test(normalized)) {
    return fallback;
  }

  const negative = normalized.startsWith('-');
  const digits = negative ? normalized.slice(1) : normalized;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}`;
}

function formatCompactHash(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatLocalTimestamp(value: string | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function normalizeBaseAccount(account: unknown): {
  sequence: number;
  accountNumber: number;
} {
  if (!account || typeof account !== 'object') {
    return { sequence: 0, accountNumber: 0 };
  }

  if (
    'base_account' in account &&
    account.base_account &&
    typeof account.base_account === 'object'
  ) {
    return normalizeBaseAccount(account.base_account);
  }

  const value = account as { sequence?: string; account_number?: string };

  return {
    sequence: Number(value.sequence ?? 0),
    accountNumber: Number(value.account_number ?? 0),
  };
}

function formatDurationSeconds(seconds: number | null) {
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

function formatDenomAmount(amount: string) {
  const normalized = amount.trim();

  if (!normalized) {
    return '0';
  }

  const negative = normalized.startsWith('-');
  const value = negative ? normalized.slice(1) : normalized;
  const [integerPart = '0', decimalPart = ''] = value.split('.');
  const integer = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedDecimal = decimalPart.replace(/0+$/, '').slice(0, 6);

  return `${negative ? '-' : ''}${formattedInteger}${
    trimmedDecimal ? `.${trimmedDecimal}` : ''
  }`;
}

const READABLE_DENOM_ALIASES: Record<string, string> = {
  aevmos: 'evmos',
  aethos: 'ethos',
  aqare: 'qare',
  aqrx: 'qrx',
  avoucher: 'voucher',
  aqvoucher: 'qvoucher',
  athbs: 'thbs',
  acbo: 'cbo',
  azkme: 'zkme',
  azeta: 'zeta',
  aabtc: 'abtc',
  aakk: 'akk',
  apepe: 'pepe',
  ahopp: 'hopp',
  amoca: 'moca',
};

function shortenDenom(denom: string) {
  return denom.length > 12
    ? `${denom.slice(0, 8)}...${denom.slice(-4)}`
    : denom;
}

function formatReadableTokenAmount(amount: string, decimals = 18) {
  const normalized = amount.trim();

  if (!normalized) {
    return '0';
  }

  if (normalized.includes('.')) {
    return formatDenomAmount(normalized);
  }

  const negative = normalized.startsWith('-');
  const digits = (negative ? normalized.slice(1) : normalized).replace(
    /^0+(?=\d)/,
    '',
  ) || '0';

  if (decimals <= 0) {
    return formatDenomAmount(`${negative ? '-' : ''}${digits}`);
  }

  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals) || '0';
  const fractionPart = padded.slice(-decimals).replace(/0+$/, '');
  const value = fractionPart
    ? `${integerPart}.${fractionPart}`
    : integerPart;

  return formatDenomAmount(`${negative ? '-' : ''}${value}`);
}

function formatReadableDenom(denom: string) {
  const shortened = shortenDenom(denom);
  return READABLE_DENOM_ALIASES[shortened] ?? READABLE_DENOM_ALIASES[denom] ?? shortened;
}

function formatReadableDenomCollection(
  items: Array<{ denom: string; amount: string }> | undefined,
) {
  if (!items?.length) {
    return '0';
  }

  const visible = items.slice(0, 2).map((item) => {
    return `${formatReadableTokenAmount(item.amount)} ${formatReadableDenom(item.denom)}`;
  });

  if (items.length > 2) {
    visible.push(`+${items.length - 2} more`);
  }

  return visible.join(', ');
}

function formatBytes(
  value: string | number | null | undefined,
  fallback = 'Unavailable',
) {
  if (value == null) {
    return fallback;
  }

  const bytes =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return fallback;
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function formatDenomCollection(
  items: Array<{ denom: string; amount: string }> | undefined,
) {
  if (!items?.length) {
    return '0';
  }

  const visible = items.slice(0, 2).map((item) => {
    return `${formatDenomAmount(item.amount)} ${item.denom}`;
  });

  if (items.length > 2) {
    visible.push(`+${items.length - 2} more`);
  }

  return visible.join(', ');
}

function extractTypeLabel(rawType: string | null | undefined) {
  if (!rawType) {
    return 'Unknown';
  }

  const lastSegment = rawType.split('.').pop()?.replace(/^\//, '') ?? rawType;
  const trimmed = lastSegment.replace(/^Msg/, '');
  return trimmed.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function getFirstMessage(
  payload: CosmosRestTxResponse,
): Record<string, unknown> | null {
  const message = payload.tx?.body?.messages?.[0];
  return message && typeof message === 'object' ? message : null;
}

function findEventAttribute(
  events: NonNullable<CosmosRestTxResponse['tx_response']>['events'],
  type: string,
  key: string,
) {
  return (
    events
      ?.find((event) => event.type === type)
      ?.attributes?.find((attribute) => attribute.key === key)?.value ?? null
  );
}

function extractSender(payload: CosmosRestTxResponse) {
  const eventSender =
    findEventAttribute(payload.tx_response?.events, 'message', 'sender') ??
    findEventAttribute(payload.tx_response?.events, 'transfer', 'sender') ??
    findEventAttribute(payload.tx_response?.events, 'coin_spent', 'spender') ??
    findEventAttribute(payload.tx_response?.events, 'proposal_vote', 'voter');

  if (eventSender) {
    return eventSender;
  }

  const message = getFirstMessage(payload);

  if (!message) {
    return 'Unknown';
  }

  const candidateKeys = [
    'sender',
    'from_address',
    'delegator_address',
    'voter',
    'proposer',
    'granter',
    'grantee',
    'validator_address',
  ] as const;

  for (const key of candidateKeys) {
    const value = message[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return 'Unknown';
}

function formatSenderLabel(sender: string) {
  if (sender === 'Unknown') {
    return sender;
  }

  return formatCompactHash(sender, 12, 6);
}

function calculateAverageBlockTime(
  blocks: Array<{ timestampMs: number | null }>,
) {
  const timestamps = blocks
    .map((block) => block.timestampMs)
    .filter((value): value is number => value != null);

  if (timestamps.length < 2) {
    return null;
  }

  const samples = timestamps
    .slice(0, -1)
    .map((timestamp, index) => (timestamp - timestamps[index + 1]) / 1000)
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (!samples.length) {
    return null;
  }

  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

async function getStatusDirect(profile: CosmosProvider) {
  return fetchJson<TendermintStatusResponse>(`${profile.rpcUrl}/status`);
}

async function getNetInfoDirect(profile: CosmosProvider) {
  return fetchJson<TendermintNetInfoResponse>(`${profile.rpcUrl}/net_info`);
}

async function getUnconfirmedTxsDirect(profile: CosmosProvider) {
  return fetchJson<TendermintUnconfirmedTxsResponse>(
    `${profile.rpcUrl}/num_unconfirmed_txs`,
  );
}

async function getBlockchainDirect(
  profile: CosmosProvider,
  latestHeight: number,
  limit: number,
) {
  const minHeight = Math.max(1, latestHeight - limit + 1);
  return getBlockchainRangeDirect(profile, minHeight, latestHeight);
}

async function getBlockchainRangeDirect(
  profile: CosmosProvider,
  minHeight: number,
  maxHeight: number,
) {
  return fetchJson<TendermintBlockchainResponse>(
    `${profile.rpcUrl}/blockchain?minHeight=${minHeight}&maxHeight=${maxHeight}`,
  );
}

async function getTxSearchDirect(
  profile: CosmosProvider,
  perPage: number,
) {
  return fetchJson<TendermintTxSearchResponse>(
    `${profile.rpcUrl}/tx_search?query=%22tx.height%20%3E%200%22&prove=false&page=1&per_page=${perPage}&order_by=%22desc%22`,
  );
}

async function getRestValidatorsDirect(profile: CosmosProvider) {
  return fetchJson<CosmosValidatorsResponse>(
    `${profile.restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=200&pagination.count_total=true`,
  );
}

async function getRpcValidatorsDirect(
  profile: CosmosProvider,
  height: number,
) {
  return fetchJson<TendermintValidatorsResponse>(
    `${profile.rpcUrl}/validators?height=${height}&page=1&per_page=200`,
  );
}

async function getCosmosValidatorMapsDirect(
  profile: CosmosProvider,
  height: number,
) {
  const now = Date.now();

  if (
    cachedCosmosValidatorMaps &&
    cachedCosmosValidatorMaps.providerId === profile.id &&
    now - cachedCosmosValidatorMaps.cachedAt < COSMOS_VALIDATOR_CACHE_TTL_MS
  ) {
    return cachedCosmosValidatorMaps;
  }

  const [restValidatorsPayload, rpcValidatorsPayload] = await Promise.all([
    getRestValidatorsDirect(profile).catch(() => ({
      validators: [],
      pagination: { total: '0' },
    })),
    getRpcValidatorsDirect(profile, height).catch(() => ({
      result: { validators: [] },
    })),
  ]);
  const monikerByPubKey = new Map(
    (restValidatorsPayload.validators ?? []).map((validator) => [
      validator.consensus_pubkey?.key ?? '',
      validator.description?.moniker ?? 'Unknown',
    ]),
  );
  const proposerMonikerByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [
      validator.address ?? '',
      monikerByPubKey.get(validator.pub_key?.value ?? '') ?? 'Unknown',
    ]),
  );
  const nextCache = {
    providerId: profile.id,
    cachedAt: now,
    monikerByPubKey,
    proposerMonikerByAddress,
  };

  cachedCosmosValidatorMaps = nextCache;
  return nextCache;
}

async function getCommitDirect(profile: CosmosProvider, height: string) {
  return fetchJson<TendermintCommitResponse>(
    `${profile.rpcUrl}/commit?height=${height}`,
  );
}

async function getBlockTimestampsByHeights(
  profile: CosmosProvider,
  heights: string[],
) {
  const uniqueHeights = [...new Set(heights.filter(Boolean))];
  const entries = await Promise.all(
    uniqueHeights.map(async (height) => {
      const payload = await fetchJson<TendermintBlockResponse>(
        `${profile.rpcUrl}/block?height=${height}`,
      );

      return [height, payload.result?.block?.header?.time ?? null] as const;
    }),
  );

  return new Map(entries);
}

async function getDecodedLatestTransactions(input: {
  profile: CosmosProvider;
  txs: TendermintTxSearchItem[];
  blockTimeByHeight: Map<string, string | null>;
  txLimit: number;
}) {
  const txs = input.txs.slice(0, input.txLimit);
  const detailResults = await Promise.allSettled(
    txs.map((tx) =>
      fetchJson<CosmosRestTxResponse>(
        `${input.profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`,
      ),
    ),
  );
  const nextTransactions: CosmosHomeTransactionItem[] = [];
  const cacheCandidates: CosmosCachedTransactionItem[] = [];

  detailResults.forEach((result, index) => {
    const tx = txs[index];

    if (!tx?.hash || !tx.height) {
      return;
    }

    const detail =
      result.status === 'fulfilled'
        ? result.value
        : ({
            tx_response: {
              txhash: tx.hash,
              height: tx.height,
              code: tx.tx_result?.code ?? 1,
              gas_used: tx.tx_result?.gas_used ?? '0',
              gas_wanted: tx.tx_result?.gas_wanted ?? '0',
              events: [],
            },
          } satisfies CosmosRestTxResponse);
    const firstMessage = getFirstMessage(detail);
    const rawType =
      typeof firstMessage?.['@type'] === 'string'
        ? (firstMessage['@type'] as string)
        : null;
    const sender = extractSender(detail);
    const timestamp = input.blockTimeByHeight.get(tx.height) ?? null;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
    const status =
      (detail.tx_response?.code ?? tx.tx_result?.code ?? 1) === 0
        ? 'success'
        : 'failed';
    const gasUsed = detail.tx_response?.gas_used ?? tx.tx_result?.gas_used ?? '0';
    const gasWanted =
      detail.tx_response?.gas_wanted ?? tx.tx_result?.gas_wanted ?? '0';
    const feeLabel = formatReadableDenomCollection(
      detail.tx?.auth_info?.fee?.amount,
    );
    const item: CosmosHomeTransactionItem = {
      hash: tx.hash,
      hashLabel: formatCompactHash(tx.hash),
      height: tx.height,
      type: extractTypeLabel(rawType),
      sender,
      senderLabel: formatSenderLabel(sender),
      feeLabel,
      status,
      statusLabel: status === 'success' ? 'Success' : 'Failed',
      timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
    };

    nextTransactions.push(item);
    cacheCandidates.push({
      providerProfileId: input.profile.id,
      hash: item.hash,
      height: item.height,
      timestampMs: item.timestampMs,
      typeLabel: item.type,
      sender: item.sender,
      senderLabel: item.senderLabel,
      feeLabel: item.feeLabel,
      gasUsed,
      gasWanted,
      status: item.status,
      statusLabel: item.statusLabel,
    });
  });

  if (cacheCandidates.length) {
    await rememberCosmosTransactionCache(cacheCandidates);
  }

  return nextTransactions;
}

export async function getCosmosOverviewDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await getStatusDirect(profile);

  return {
    chainLabel: profile.name,
    latestHeight:
      payload.result?.sync_info?.latest_block_height ?? 'Unavailable',
    latestBlockTime: formatLocalTimestamp(
      payload.result?.sync_info?.latest_block_time,
    ),
    chainId: payload.result?.node_info?.network ?? 'Unavailable',
  };
}

export async function getRecentCosmosBlocksDirect(limit = 8) {
  const profile = getActiveCosmosProvider();
  const status = await getStatusDirect(profile);
  const latestHeight = Number(
    status.result?.sync_info?.latest_block_height ?? 0,
  );
  const payload = await getBlockchainDirect(profile, latestHeight, limit);
  const blocks = (payload.result?.block_metas ?? [])
    .map((block) => {
      if (!block.block_id?.hash || !block.header?.height) {
        return null;
      }

      return formatCosmosBlock({
        blockId: { hash: block.block_id.hash },
        block: {
          header: {
            height: block.header.height,
            time: block.header.time,
          },
        },
      });
    })
    .filter((block): block is ReturnType<typeof formatCosmosBlock> => block != null)
    .sort((left, right) => Number(right.height) - Number(left.height));

  return blocks.slice(0, limit);
}

function formatCosmosCommitSummary(
  signatures:
    | Array<{
        block_id_flag?: number | string;
        signature?: string | null;
      }>
    | undefined,
) {
  if (!signatures?.length) {
    return 'Unavailable';
  }

  const counts = new Map<number, number>();

  signatures.forEach((signature) => {
    const flag = Number.parseInt(String(signature.block_id_flag ?? 0), 10);
    counts.set(flag, (counts.get(flag) ?? 0) + 1);
  });

  const labels = new Map<number, string>([
    [1, 'Absent'],
    [2, 'Commit'],
    [3, 'Nil'],
  ]);
  const parts = [...counts.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([flag, count]) => `${labels.get(flag) ?? `Flag ${flag}`}: ${count}`);

  return parts.join(' · ');
}

function formatCosmosBlocksPageItem(input: {
  block: TendermintBlockMeta;
  signatures?: Array<{
    block_id_flag?: number | string;
    validator_address?: string;
    signature?: string | null;
  }>;
  proposerMonikerByAddress: Map<string, string>;
}) {
  const height = input.block.header?.height ?? '0';
  const hash = input.block.block_id?.hash ?? 'Unavailable';
  const timestamp = input.block.header?.time;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
  const proposer = input.block.header?.proposer_address ?? 'Unknown';
  const proposerMoniker = input.proposerMonikerByAddress.get(proposer) ?? null;
  const proposerLabel =
    proposerMoniker && proposerMoniker !== 'Unknown'
      ? proposerMoniker
      : formatCompactHash(proposer, 10, 6);
  const appHash = input.block.header?.app_hash ?? 'Unavailable';

  return {
    height,
    hash,
    hashLabel: formatCompactHash(hash, 10, 8),
    proposer,
    proposerLabel,
    proposerAddressLabel:
      proposer === 'Unknown' ? proposer : formatCompactHash(proposer, 12, 8),
    txCount: Number.parseInt(input.block.num_txs ?? '0', 10) || 0,
    txCountLabel: formatInteger(input.block.num_txs ?? '0', '0'),
    blockSizeLabel: formatBytes(input.block.block_size),
    appHash,
    appHashLabel: formatCompactHash(appHash, 10, 8),
    signaturesLabel: formatCosmosCommitSummary(input.signatures),
    timeLabel: formatLocalTimestamp(timestamp),
    timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
  } satisfies CosmosBlocksPageItem;
}

export async function getCosmosBlocksPageDirect(
  requestedPage = 1,
  pageSize = 20,
) {
  const profile = getActiveCosmosProvider();
  const statusPayload = await getStatusDirect(profile);
  const latestHeight = Number(
    statusPayload.result?.sync_info?.latest_block_height ?? 0,
  );
  const totalBlocks = Math.max(0, latestHeight);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalBlocks, 1) / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  if (totalBlocks === 0) {
    return {
      page,
      pageSize,
      totalBlocks,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
      totalLabel: 'No blocks returned',
      summary: [
        {
          label: 'Latest Block',
          value: '0',
          note: 'The selected Cosmos provider did not return a latest height.',
        },
        {
          label: 'Average Block Time',
          value: 'Unavailable',
          note: 'Not enough block data to compute a sample window.',
        },
        {
          label: 'Validator Count',
          value: '0',
          note: 'Validator metadata is unavailable for this provider.',
        },
        {
          label: 'Current Range',
          value: 'Unavailable',
          note: 'No block heights were returned for this page.',
        },
      ],
      blocks: [] as CosmosBlocksPageItem[],
    };
  }

  const pageMaxHeight = Math.max(1, latestHeight - (page - 1) * pageSize);
  const pageMinHeight = Math.max(1, pageMaxHeight - pageSize + 1);
  const [blockchainPayload, restValidatorsPayload, validatorMaps] = await Promise.all([
    getBlockchainRangeDirect(profile, pageMinHeight, pageMaxHeight),
    getRestValidatorsDirect(profile).catch(() => ({
      validators: [],
      pagination: { total: '0' },
    })),
    getCosmosValidatorMapsDirect(profile, pageMaxHeight),
  ]);
  const blockMetas = [...(blockchainPayload.result?.block_metas ?? [])].sort(
    (left, right) =>
      Number(right.header?.height ?? 0) - Number(left.header?.height ?? 0),
  );
  const commitPayloads = await Promise.allSettled(
    blockMetas.map((block) =>
      block.header?.height
        ? getCommitDirect(profile, block.header.height)
        : Promise.reject(new Error('Missing block height.')),
    ),
  );
  const blocks = blockMetas.map((block, index) => {
    const commitResult = commitPayloads[index];
    const signatures =
      commitResult?.status === 'fulfilled'
        ? commitResult.value.result?.signed_header?.commit?.signatures
        : undefined;

    return formatCosmosBlocksPageItem({
      block,
      signatures,
      proposerMonikerByAddress: validatorMaps.proposerMonikerByAddress,
    });
  });
  const averageBlockTime = calculateAverageBlockTime(blocks);
  const topBlock = blocks[0]?.height ?? String(pageMaxHeight);
  const bottomBlock =
    blocks[blocks.length - 1]?.height ?? String(pageMinHeight);

  return {
    page,
    pageSize,
    totalBlocks,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    totalLabel: `${formatInteger(totalBlocks)} blocks`,
    summary: [
      {
        label: 'Latest Block',
        value: formatInteger(latestHeight),
        note: `Current head reported by ${profile.name}.`,
      },
      {
        label: 'Average Block Time',
        value: formatDurationSeconds(averageBlockTime),
        note: `Computed from the ${blocks.length.toLocaleString('en-US')} blocks on this page.`,
      },
      {
        label: 'Validator Count',
        value: formatInteger(restValidatorsPayload.pagination?.total ?? '0'),
        note: 'Count returned by the selected Cosmos REST endpoint.',
      },
      {
        label: 'Current Range',
        value: `#${topBlock} - #${bottomBlock}`,
        note: `Showing page ${page} of ${totalPages}.`,
      },
    ],
    blocks,
  };
}

export async function getCosmosLatestBlockFeedDirect(height: number | string) {
  const profile = getActiveCosmosProvider();
  const normalizedHeight =
    typeof height === 'number' ? height : Number.parseInt(height, 10);

  if (!Number.isFinite(normalizedHeight) || normalizedHeight < 0) {
    throw new Error('Invalid Cosmos block height.');
  }

  const [blockchainPayload, commitPayload, validatorMaps] = await Promise.all([
    getBlockchainRangeDirect(profile, normalizedHeight, normalizedHeight),
    getCommitDirect(profile, String(normalizedHeight)).catch(() => ({
      result: { signed_header: { commit: { signatures: [] } } },
    })),
    getCosmosValidatorMapsDirect(profile, normalizedHeight),
  ]);
  const blockMeta = blockchainPayload.result?.block_metas?.[0];

  if (!blockMeta?.header?.height || !blockMeta.block_id?.hash) {
    throw new Error('Failed to load the latest Cosmos block details.');
  }

  const blockPageItem = formatCosmosBlocksPageItem({
    block: blockMeta,
    signatures: commitPayload.result?.signed_header?.commit?.signatures,
    proposerMonikerByAddress: validatorMaps.proposerMonikerByAddress,
  });

  return {
    latestBlock: blockPageItem.height,
    latestBlockNumber: Number.parseInt(blockPageItem.height, 10) || 0,
    latestBlockTime: blockPageItem.timeLabel,
    latestBlockTimestampMs: blockPageItem.timestampMs,
    blockPageItem,
  } satisfies CosmosLatestBlockFeed;
}

export async function getCosmosBlockByHeightDirect(height: number) {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<TendermintBlockResponse>(
    `${profile.rpcUrl}/block?height=${height}`,
  );

  if (
    !payload.result?.block_id?.hash ||
    !payload.result.block?.header?.height
  ) {
    throw new Error('Failed to load Cosmos block.');
  }

  return formatCosmosBlock({
    blockId: { hash: payload.result.block_id.hash },
    block: {
      header: {
        height: payload.result.block.header.height,
        time: payload.result.block.header.time,
      },
    },
  });
}

export async function getCosmosTxByHashDirect(hash: string) {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<CosmosRestTxResponse>(
    `${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`,
  );
  const tx = payload.tx_response;

  if (!tx?.txhash || !tx.height) {
    throw new Error('Failed to load Cosmos transaction.');
  }

  return formatCosmosTx({
    hash: tx.txhash,
    height: Number(tx.height),
    code: tx.code ?? 0,
    gasUsed: Number(tx.gas_used ?? 0),
    rawLog: tx.raw_log ?? '',
  });
}

export async function getCosmosAccountSummaryDirect(address: string) {
  const profile = getActiveCosmosProvider();
  const [balancesPayload, accountPayload] = await Promise.all([
    fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(
      `${profile.restUrl}/cosmos/bank/v1beta1/balances/${address}`,
    ),
    fetchJson<{ account?: unknown }>(
      `${profile.restUrl}/cosmos/auth/v1beta1/accounts/${address}`,
    ).catch(() => ({
      account: null,
    })),
  ]);
  const baseAccount = normalizeBaseAccount(accountPayload.account);

  return {
    address,
    balances: balancesPayload.balances ?? [],
    sequence: baseAccount.sequence,
    accountNumber: baseAccount.accountNumber,
  };
}

export async function getCosmosValidatorsDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<CosmosValidatorsResponse>(
    `${profile.restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=20`,
  );

  return payload.validators ?? [];
}

export async function getCosmosProposalsDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    proposals?: Array<{
      id: string;
      title?: string;
      status?: string;
      metadata?: string;
    }>;
  }>(`${profile.restUrl}/cosmos/gov/v1/proposals?pagination.limit=20`);

  return (payload.proposals ?? []).map((proposal) => ({
    ...proposal,
    title: proposal.title ?? proposal.metadata ?? 'Untitled Proposal',
  }));
}

export async function getCosmosHomeSnapshotDirect(
  blockLimit = 6,
  txLimit = 6,
): Promise<CosmosHomeSnapshot> {
  const profile = getActiveCosmosProvider();
  const [
    statusPayload,
    netInfoPayload,
    unconfirmedPayload,
    txSearchPayload,
    restValidatorsPayload,
    poolPayload,
    communityPoolPayload,
    supplyPayload,
    cachedTransactions,
  ] = await Promise.all([
    getStatusDirect(profile),
    getNetInfoDirect(profile).catch(() => ({ result: { n_peers: '0' } })),
    getUnconfirmedTxsDirect(profile).catch(() => ({
      result: { n_txs: '0', total: '0' },
    })),
    getTxSearchDirect(profile, txLimit),
    getRestValidatorsDirect(profile),
    fetchJson<CosmosPoolResponse>(
      `${profile.restUrl}/cosmos/staking/v1beta1/pool`,
    ),
    fetchJson<CosmosCommunityPoolResponse>(
      `${profile.restUrl}/cosmos/distribution/v1beta1/community_pool`,
    ),
    fetchJson<CosmosSupplyResponse>(
      `${profile.restUrl}/cosmos/bank/v1beta1/supply`,
    ),
    getRecentCachedCosmosTransactions(txLimit).catch(() => []),
  ]);
  const latestHeight = Number(
    statusPayload.result?.sync_info?.latest_block_height ?? 0,
  );
  const [blockchainPayload, rpcValidatorsPayload] = await Promise.all([
    getBlockchainDirect(profile, latestHeight, Math.max(blockLimit, 10)),
    getRpcValidatorsDirect(profile, latestHeight).catch(() => ({
      result: { validators: [] },
    })),
  ]);
  const blockMetas = [...(blockchainPayload.result?.block_metas ?? [])].sort(
    (left, right) =>
      Number(right.header?.height ?? 0) - Number(left.header?.height ?? 0),
  );
  const monikerByPubKey = new Map(
    (restValidatorsPayload.validators ?? []).map((validator) => [
      validator.consensus_pubkey?.key ?? '',
      validator.description?.moniker ?? 'Unknown',
    ]),
  );
  const proposerMonikerByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [
      validator.address ?? '',
      monikerByPubKey.get(validator.pub_key?.value ?? '') ?? 'Unknown',
    ]),
  );
  const blocks: CosmosHomeBlockItem[] = blockMetas.slice(0, blockLimit).map(
    (block) => {
      const height = block.header?.height ?? '0';
      const timestamp = block.header?.time;
      const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
      const proposer = block.header?.proposer_address ?? 'Unknown';
      const proposerMoniker =
        proposerMonikerByAddress.get(proposer) ??
        statusPayload.result?.node_info?.moniker ??
        proposer;

      return {
        height,
        hash: block.block_id?.hash ?? 'Unavailable',
        hashLabel: formatCompactHash(block.block_id?.hash ?? 'Unavailable'),
        proposer,
        proposerLabel:
          proposerMoniker && proposerMoniker !== 'Unknown'
            ? proposerMoniker
            : formatCompactHash(proposer, 10, 6),
        txCount: formatInteger(block.num_txs ?? '0', '0'),
        timeLabel: formatLocalTimestamp(timestamp),
        timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
      };
    },
  );
  const blockTimeByHeight = new Map(
    blockMetas.map((block) => [block.header?.height ?? '', block.header?.time ?? null]),
  );
  const missingHeights = (txSearchPayload.result?.txs ?? [])
    .slice(0, txLimit)
    .map((tx) => tx.height ?? '')
    .filter((height) => height && !blockTimeByHeight.has(height));

  if (missingHeights.length) {
    const missingTimes = await getBlockTimestampsByHeights(profile, missingHeights);
    missingTimes.forEach((value, key) => {
      blockTimeByHeight.set(key, value);
    });
  }

  const latestTransactions = await getDecodedLatestTransactions({
    profile,
    txs: txSearchPayload.result?.txs ?? [],
    blockTimeByHeight,
    txLimit,
  });
  const mergedTransactions = [...latestTransactions];

  for (const cached of cachedTransactions) {
    if (mergedTransactions.some((item) => item.hash === cached.hash)) {
      continue;
    }

    mergedTransactions.push({
      hash: cached.hash,
      hashLabel: formatCompactHash(cached.hash),
      height: cached.height,
      type: cached.typeLabel,
      sender: cached.sender,
      senderLabel: cached.senderLabel,
      feeLabel: cached.feeLabel ?? 'Unavailable',
      status: cached.status,
      statusLabel: cached.statusLabel,
      timestampMs: cached.timestampMs,
    });

    if (mergedTransactions.length >= txLimit) {
      break;
    }
  }

  const averageBlockTime = calculateAverageBlockTime(blocks);

  return {
    header: {
      connection: profile.wsUrl ? 'RPC + WebSocket' : 'RPC Polling',
      providerName: profile.name,
      chainId: statusPayload.result?.node_info?.network ?? 'Unavailable',
      latestBlockTime: formatLocalTimestamp(
        statusPayload.result?.sync_info?.latest_block_time,
      ),
    },
    metrics: [
      {
        label: 'Moniker',
        value:
          statusPayload.result?.node_info?.moniker ?? profile.name ?? 'Unavailable',
      },
      {
        label: 'Block Height',
        value: formatInteger(latestHeight),
      },
      {
        label: 'Confirmed Txs',
        value: formatInteger(txSearchPayload.result?.total_count),
      },
      {
        label: 'Unconfirmed Txs',
        value: formatInteger(
          unconfirmedPayload.result?.n_txs ?? unconfirmedPayload.result?.total,
          '0',
        ),
      },
      {
        label: 'Validator Count',
        value: formatInteger(restValidatorsPayload.pagination?.total ?? '0'),
      },
      {
        label: 'Peer Count',
        value: formatInteger(netInfoPayload.result?.n_peers ?? '0'),
      },
      {
        label: 'Average Block Time',
        value: formatDurationSeconds(averageBlockTime),
      },
      {
        label: 'Bonded Tokens',
        value: formatReadableTokenAmount(poolPayload.pool?.bonded_tokens ?? '0'),
      },
      {
        label: 'Not Bonded Tokens',
        value: formatReadableTokenAmount(
          poolPayload.pool?.not_bonded_tokens ?? '0',
        ),
      },
      {
        label: 'Community Pool',
        value: formatDenomCollection(communityPoolPayload.pool),
      },
      {
        label: 'Bank Supply',
        value: formatReadableDenomCollection(supplyPayload.supply),
      },
    ],
    activity: {
      blocks,
      transactions: mergedTransactions.slice(0, txLimit),
    },
    latestHeight,
    refreshedAt: Date.now(),
  };
}

export async function requestCosmosRpcDirect(input: {
  endpoint: string;
  method: string;
  payload?: unknown;
  useRpc?: boolean;
}) {
  const profile = getActiveCosmosProvider();
  const baseUrl = input.useRpc ? profile.rpcUrl : profile.restUrl;
  const target = input.endpoint.startsWith('http')
    ? input.endpoint
    : `${baseUrl}${input.endpoint}`;
  const response = await fetch(target, {
    method: input.method,
    headers: {
      'Content-Type': 'application/json',
    },
    body:
      input.method === 'GET'
        ? undefined
        : input.payload
          ? JSON.stringify(input.payload)
          : undefined,
  });
  const text = await response.text();

  try {
    return {
      endpoint: target,
      status: response.status,
      result: JSON.parse(text),
    };
  } catch {
    return {
      endpoint: target,
      status: response.status,
      result: text,
    };
  }
}
