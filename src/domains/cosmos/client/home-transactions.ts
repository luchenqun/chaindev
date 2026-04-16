'use client';

import {
  rememberCosmosTransactionCache,
  type CosmosCachedTransactionItem,
} from '@/domains/cosmos/client/transaction-cache';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';

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
    timestamp?: string;
    events?: Array<{
      type?: string;
      attributes?: Array<{ key?: string; value?: string }>;
    }>;
  };
};

type DecodedCosmosHomeTransaction = {
  hash: string;
  hashLabel: string;
  height: string;
  type: string;
  sender: string;
  senderLabel: string;
  feeLabel: string;
  gasUsed: string;
  gasWanted: string;
  status: 'success' | 'failed';
  statusLabel: string;
  timestampMs: number | null;
};

function formatCompactHash(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
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

function decodeCosmosHomeTransaction(
  hash: string,
  payload: CosmosRestTxResponse,
): DecodedCosmosHomeTransaction {
  const txHash = payload.tx_response?.txhash ?? hash;
  const height = payload.tx_response?.height;

  if (!height) {
    throw new Error(`Missing transaction height for ${hash}.`);
  }

  const firstMessage = getFirstMessage(payload);
  const rawType =
    typeof firstMessage?.['@type'] === 'string'
      ? (firstMessage['@type'] as string)
      : null;
  const sender = extractSender(payload);
  const timestamp = payload.tx_response?.timestamp;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
  const status = (payload.tx_response?.code ?? 1) === 0 ? 'success' : 'failed';

  return {
    hash: txHash,
    hashLabel: formatCompactHash(txHash),
    height,
    type: extractTypeLabel(rawType),
    sender,
    senderLabel: formatSenderLabel(sender),
    feeLabel: formatDenomCollection(payload.tx?.auth_info?.fee?.amount),
    gasUsed: payload.tx_response?.gas_used ?? '0',
    gasWanted: payload.tx_response?.gas_wanted ?? '0',
    status,
    statusLabel: status === 'success' ? 'Success' : 'Failed',
    timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
  };
}

export async function decodeCosmosHomeTransactionsByHashes(
  hashes: string[],
) {
  const uniqueHashes = [...new Set(hashes.map((hash) => hash.trim()).filter(Boolean))];

  if (!uniqueHashes.length) {
    return [] as DecodedCosmosHomeTransaction[];
  }

  const profile = getActiveCosmosProvider();
  const results = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const response = await fetch(
        `${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const body = (await response.json()) as CosmosRestTxResponse;
      return decodeCosmosHomeTransaction(hash, body);
    }),
  );
  const transactions = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const cacheCandidates: CosmosCachedTransactionItem[] = transactions.map((transaction) => ({
    providerProfileId: profile.id,
    hash: transaction.hash,
    height: transaction.height,
    timestampMs: transaction.timestampMs,
    typeLabel: transaction.type,
    sender: transaction.sender,
    senderLabel: transaction.senderLabel,
    feeLabel: transaction.feeLabel,
    gasUsed: transaction.gasUsed,
    gasWanted: transaction.gasWanted,
    status: transaction.status,
    statusLabel: transaction.statusLabel,
  }));

  if (cacheCandidates.length) {
    await rememberCosmosTransactionCache(cacheCandidates);
  }

  return transactions;
}
