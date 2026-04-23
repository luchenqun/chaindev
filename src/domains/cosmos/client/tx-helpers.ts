'use client';

import { READABLE_DENOM_ALIASES } from '@/domains/cosmos/client/readable-denom-aliases';

type CosmosRestTxEventAttribute = {
  key?: string;
  value?: string;
};

type CosmosRestTxEvent = {
  type?: string;
  attributes?: CosmosRestTxEventAttribute[];
};

export type CosmosRestTxResponse = {
  tx?: {
    memo?: string;
    auth_info?: {
      signer_infos?: Array<{
        public_key?: {
          '@type'?: string;
          key?: string;
        };
      }>;
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
    raw_log?: string;
    logs?: Array<{
      msg_index?: number;
      log?: string;
      events?: Array<{
        type?: string;
        attributes?: Array<{
          key?: string;
          value?: string;
          index?: boolean;
        }>;
      }>;
    }>;
    events?: CosmosRestTxEvent[];
  };
};

export type DecodedCosmosTransactionSummary = {
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

export function formatCompactHash(value: string, start = 8, end = 6) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatDenomAmount(amount: string) {
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

  return `${negative ? '-' : ''}${formattedInteger}${trimmedDecimal ? `.${trimmedDecimal}` : ''}`;
}

export function shortenDenom(denom: string) {
  return denom.length > 12 ? `${denom.slice(0, 8)}...${denom.slice(-4)}` : denom;
}

export function formatReadableTokenAmount(amount: string, decimals = 18) {
  const normalized = amount.trim();

  if (!normalized) {
    return '0';
  }

  if (normalized.includes('.')) {
    return formatDenomAmount(normalized);
  }

  const negative = normalized.startsWith('-');
  const digits = (negative ? normalized.slice(1) : normalized).replace(/^0+(?=\d)/, '') || '0';

  if (decimals <= 0) {
    return formatDenomAmount(`${negative ? '-' : ''}${digits}`);
  }

  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals) || '0';
  const fractionPart = padded.slice(-decimals).replace(/0+$/, '');
  const value = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;

  return formatDenomAmount(`${negative ? '-' : ''}${value}`);
}

export function formatReadableDenom(denom: string) {
  const shortened = shortenDenom(denom);
  return READABLE_DENOM_ALIASES[shortened] ?? READABLE_DENOM_ALIASES[denom] ?? shortened;
}

export function formatReadableDenomCollection(items: Array<{ denom: string; amount: string }> | undefined) {
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

export function formatReadableDecCoinCollection(items: Array<{ denom: string; amount: string }> | undefined) {
  if (!items?.length) {
    return '0';
  }

  const visible = items.slice(0, 2).map((item) => {
    const integerAmount = item.amount.split('.')[0] ?? item.amount;

    return `${formatReadableTokenAmount(integerAmount)} ${formatReadableDenom(item.denom)}`;
  });

  if (items.length > 2) {
    visible.push(`+${items.length - 2} more`);
  }

  return visible.join(', ');
}

export function extractTypeLabel(rawType: string | null | undefined) {
  if (!rawType) {
    return 'Unknown';
  }

  const lastSegment = rawType.split('.').pop()?.replace(/^\//, '') ?? rawType;
  const trimmed = lastSegment.replace(/^Msg/, '');
  return trimmed.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function getFirstMessage(payload: CosmosRestTxResponse): Record<string, unknown> | null {
  const message = payload.tx?.body?.messages?.[0];
  return message && typeof message === 'object' ? message : null;
}

export function findEventAttribute(events: NonNullable<CosmosRestTxResponse['tx_response']>['events'], type: string, key: string) {
  return events?.find((event) => event.type === type)?.attributes?.find((attribute) => attribute.key === key)?.value ?? null;
}

export function extractSender(payload: CosmosRestTxResponse) {
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

  const candidateKeys = ['sender', 'from_address', 'delegator_address', 'voter', 'proposer', 'granter', 'grantee', 'validator_address'] as const;

  for (const key of candidateKeys) {
    const value = message[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return 'Unknown';
}

export function formatSenderLabel(sender: string) {
  if (sender === 'Unknown') {
    return sender;
  }

  return formatCompactHash(sender, 12, 6);
}

export function decodeCosmosTransactionSummary(input: {
  hash: string;
  payload: CosmosRestTxResponse;
  fallbackHeight?: string | null;
  fallbackCode?: number | null;
  fallbackGasUsed?: string | null;
  fallbackGasWanted?: string | null;
  timestamp?: string | null;
}) {
  const txHash = input.payload.tx_response?.txhash ?? input.hash;
  const height = input.payload.tx_response?.height ?? input.fallbackHeight;

  if (!height) {
    throw new Error(`Missing transaction height for ${input.hash}.`);
  }

  const firstMessage = getFirstMessage(input.payload);
  const rawType = typeof firstMessage?.['@type'] === 'string' ? (firstMessage['@type'] as string) : null;
  const sender = extractSender(input.payload);
  const timestamp = input.timestamp ?? input.payload.tx_response?.timestamp ?? null;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
  const status = (input.payload.tx_response?.code ?? input.fallbackCode ?? 1) === 0 ? 'success' : 'failed';

  return {
    hash: txHash,
    hashLabel: formatCompactHash(txHash),
    height,
    type: extractTypeLabel(rawType),
    sender,
    senderLabel: formatSenderLabel(sender),
    feeLabel: formatReadableDenomCollection(input.payload.tx?.auth_info?.fee?.amount),
    gasUsed: input.payload.tx_response?.gas_used ?? input.fallbackGasUsed ?? '0',
    gasWanted: input.payload.tx_response?.gas_wanted ?? input.fallbackGasWanted ?? '0',
    status,
    statusLabel: status === 'success' ? 'Success' : 'Failed',
    timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
  } satisfies DecodedCosmosTransactionSummary;
}
