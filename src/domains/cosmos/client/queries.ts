'use client';

import 'client-only';

import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { formatCosmosBlock } from '@/domains/cosmos/server/formatters';
import {
  decodeCosmosTransactionSummary,
  extractSender,
  extractTypeLabel,
  findEventAttribute,
  formatCompactHash,
  formatDenomAmount,
  formatReadableDecCoinCollection,
  formatReadableDenomCollection,
  formatReadableTokenAmount,
  getFirstMessage,
  type CosmosRestTxResponse,
} from '@/domains/cosmos/client/tx-helpers';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

type CosmosProvider = NonNullable<ReturnType<typeof readActiveRpcProfileCookie>>;

const COSMOS_BLOCK_TIMESTAMP_CONCURRENCY = 10;

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
        chain_id?: string;
        proposer_address?: string;
        app_hash?: string;
        last_block_id?: { hash?: string };
        last_commit_hash?: string;
        data_hash?: string;
        validators_hash?: string;
        next_validators_hash?: string;
        consensus_hash?: string;
        last_results_hash?: string;
        evidence_hash?: string;
      };
      data?: {
        txs?: string[];
      };
      last_commit?: {
        signatures?: Array<{
          block_id_flag?: number | string;
          validator_address?: string;
          signature?: string | null;
        }>;
      };
    };
  };
};

type TendermintCommitSignature = {
  block_id_flag?: number | string;
  validator_address?: string;
  signature?: string | null;
};

type TendermintCommitResponse = {
  canonical?: boolean;
  result?: {
    signed_header?: {
      header?: {
        height?: string;
        time?: string;
      };
      commit?: {
        signatures?: TendermintCommitSignature[];
      };
    };
  };
};

type TendermintEvent = {
  type?: string;
  attributes?: Array<{
    key?: string;
    value?: string;
    index?: boolean;
  }>;
};

type TendermintBlockResultsResponse = {
  result?: {
    height?: string;
    txs_results?: Array<{
      code?: number;
      data?: string;
      log?: string;
      gas_wanted?: string;
      gas_used?: string;
      events?: TendermintEvent[];
    }>;
    begin_block_events?: TendermintEvent[];
    end_block_events?: TendermintEvent[];
    finalize_block_events?: TendermintEvent[];
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

type CosmosValidatorsResponse = {
  validators?: Array<{
    operator_address?: string;
    consensus_pubkey?: { key?: string };
    description?: {
      moniker?: string;
      identity?: string;
      website?: string;
      security_contact?: string;
      details?: string;
    };
    status?: string;
    jailed?: boolean;
    tokens?: string;
    delegator_shares?: string;
    min_self_delegation?: string;
    unbonding_height?: string;
    commission?: {
      commission_rates?: {
        rate?: string;
      };
    };
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

type CosmosAuthAccountsResponse = {
  accounts?: unknown[];
  pagination?: {
    total?: string;
    next_key?: string | null;
  };
};

type CosmosDelegationsResponse = {
  delegation_responses?: Array<{
    delegation?: {
      delegator_address?: string;
      validator_address?: string;
      shares?: string;
    };
    balance?: {
      denom?: string;
      amount?: string;
    };
  }>;
  pagination?: {
    total?: string;
  };
};

type CosmosValidatorResponse = {
  validator?: NonNullable<CosmosValidatorsResponse['validators']>[number] & {
    unbonding_time?: string;
  };
};

type CosmosValidatorDelegatorRewardsResponse = {
  rewards?: Array<{
    denom: string;
    amount: string;
  }>;
};

type CosmosValidatorCommissionResponse = {
  commission?: {
    commission?: Array<{
      denom: string;
      amount: string;
    }>;
  };
};

type CosmosValidatorOutstandingRewardsResponse = {
  rewards?: {
    rewards?: Array<{
      denom: string;
      amount: string;
    }>;
  };
};

type CosmosGovTallyResult = {
  yes_count?: string;
  no_count?: string;
  abstain_count?: string;
  no_with_veto_count?: string;
};

type CosmosGovProposalsResponse = {
  proposals?: Array<{
    id?: string;
    proposal_id?: string;
    title?: string;
    summary?: string;
    metadata?: string;
    status?: string;
    content?: Record<string, unknown>;
    submit_time?: string;
    deposit_end_time?: string;
    voting_start_time?: string;
    voting_end_time?: string;
    total_deposit?: Array<{
      denom: string;
      amount: string;
    }>;
    final_tally_result?: CosmosGovTallyResult;
    messages?: Array<Record<string, unknown>>;
  }>;
  pagination?: {
    total?: string;
  };
};

type CosmosGovProposalTallyResponse = {
  tally?: CosmosGovTallyResult;
};

type CosmosGovProposalResponse = {
  proposal?: NonNullable<CosmosGovProposalsResponse['proposals']>[number];
};

type CosmosGovProposalVotesResponse = {
  votes?: Array<{
    voter?: string;
    option?: string;
    options?: Array<{
      option?: string;
      metadata?: string;
      weight?: string;
    }>;
    metadata?: string;
  }>;
  pagination?: {
    total?: string;
  };
};

export type CosmosHomeBlockItem = {
  height: string;
  hash: string;
  hashLabel: string;
  proposer: string;
  proposerOperatorAddress: string | null;
  proposerLabel: string;
  txCount: string;
  blockSizeLabel: string;
  timeLabel: string;
  timestampMs: number | null;
};

export type CosmosBlocksPageItem = {
  height: string;
  hash: string;
  hashLabel: string;
  proposer: string;
  proposerOperatorAddress: string | null;
  proposerLabel: string;
  proposerAddressLabel: string;
  txCount: number;
  txCountLabel: string;
  gasUsedLabel: string;
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
  lastCommitHeight?: string | null;
  lastCommitSignaturesLabel?: string | null;
};

export type CosmosTransactionsPageItem = {
  hash: string;
  hashLabel: string;
  height: string;
  type: string;
  sender: string;
  senderLabel: string;
  messageCount: number;
  target: string | null;
  targetLabel: string | null;
  feeLabel: string;
  gasUsedLabel: string;
  gasWantedLabel: string;
  status: 'success' | 'failed';
  statusLabel: string;
  timeLabel: string;
  timestampMs: number | null;
};

export type CosmosBlockDetailTransactionItem = {
  hash: string;
  hashLabel: string;
  height: string;
  type: string;
  sender: string;
  senderLabel: string;
  feeLabel: string;
  gasUsedLabel: string;
  gasWantedLabel: string;
  status: 'success' | 'failed';
  statusLabel: string;
  rawLog: string;
  messageCount: number;
  rawJson: {
    search: TendermintTxSearchItem;
    detail: CosmosRestTxResponse | null;
  };
};

export type CosmosBlockDetailEventItem = {
  type: string;
  attributes: Array<{
    key: string;
    value: string;
    indexed: boolean;
  }>;
};

export type CosmosBlockDetail = {
  height: string;
  hash: string;
  hashLabel: string;
  timestamp: string | null;
  timeLabel: string;
  timestampMs: number | null;
  chainId: string;
  proposer: string;
  proposerOperatorAddress: string | null;
  proposerLabel: string;
  proposerMoniker: string | null;
  appHash: string;
  appHashLabel: string;
  txCount: number;
  txCountLabel: string;
  gasUsedLabel: string;
  gasWantedLabel: string;
  blockSizeLabel: string;
  signaturesLabel: string;
  signaturesCount: number;
  canonicalLabel: string;
  eventsCount: number;
  beginBlockEventsLabel: string;
  endBlockEventsLabel: string;
  beginBlockEventsPreview: string[];
  endBlockEventsPreview: string[];
  beginBlockEvents: CosmosBlockDetailEventItem[];
  endBlockEvents: CosmosBlockDetailEventItem[];
  commitSignatures: Array<{
    validatorAddress: string;
    operatorAddress: string | null;
    moniker: string;
    flagLabel: string;
    hasSignature: boolean;
  }>;
  transactionsPage: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    items: CosmosBlockDetailTransactionItem[];
  };
  rawJson: {
    blockMeta: TendermintBlockMeta | null;
    block: TendermintBlockResponse['result'] | null;
    commit: TendermintCommitResponse | null;
    blockResults: TendermintBlockResultsResponse | null;
    txSearch: TendermintTxSearchResponse | null;
    txDetails: Array<{
      hash: string;
      detail: CosmosRestTxResponse | null;
    }>;
  };
};

export type CosmosTxDetailMessageItem = {
  type: string;
  title: string;
  fields: Array<{
    key: string;
    value: string;
  }>;
};

export type CosmosTxDetail = {
  hash: string;
  height: string;
  code: number;
  status: 'success' | 'failed';
  statusLabel: string;
  type: string;
  sender: string;
  senderLabel: string;
  target: string | null;
  targetLabel: string | null;
  timestamp: string | null;
  timestampLabel: string;
  timestampMs: number | null;
  feeLabel: string;
  memo: string;
  gasUsedLabel: string;
  gasWantedLabel: string;
  rawLog: string;
  messageCount: number;
  messages: CosmosTxDetailMessageItem[];
  eventsCount: number;
  events: CosmosBlockDetailEventItem[];
  rawJson: {
    transaction: CosmosRestTxResponse;
    blockTimestamp: string | null;
  };
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

export type CosmosAccountsPageItem = {
  address: string;
  addressLabel: string;
  sequence: number;
  sequenceLabel: string;
  accountNumber: number;
  accountNumberLabel: string;
  type: string;
  balances: Array<{
    denom: string;
    amount: string;
  }>;
  balancesLabel: string;
  readableBalancesLabel: string;
  rawJson: unknown;
};

export type CosmosValidatorsPageItem = {
  moniker: string;
  operatorAddress: string;
  operatorAddressLabel: string;
  accountAddress: string | null;
  accountAddressLabel: string | null;
  status: string;
  statusLabel: string;
  jailed: boolean;
  jailedLabel: string;
  tokens: string;
  tokensLabel: string;
  delegatorSharesLabel: string;
  votingPowerPercentLabel: string;
  commissionRateLabel: string;
  website: string | null;
  identity: string | null;
  details: string | null;
  rawJson: unknown;
};

export type CosmosValidatorDetailDelegationItem = {
  delegatorAddress: string;
  delegatorAddressLabel: string;
  amountLabel: string;
  sharesLabel: string;
  kindLabel: string;
  rawJson: {
    delegation?: {
      delegator_address?: string;
      validator_address?: string;
      shares?: string;
    };
    balance?: {
      denom?: string;
      amount?: string;
    };
  };
};

export type CosmosValidatorDetail = {
  moniker: string;
  operatorAddress: string;
  operatorAddressLabel: string;
  accountAddress: string | null;
  accountAddressLabel: string | null;
  consensusPubkey: string | null;
  status: string;
  statusLabel: string;
  jailed: boolean;
  jailedLabel: string;
  tokensLabel: string;
  delegatorSharesLabel: string;
  votingPowerPercentLabel: string;
  commissionRateLabel: string;
  minSelfDelegationLabel: string;
  selfBondLabel: string;
  accountBalances: Array<{
    denom: string;
    amount: string;
  }>;
  accountBalancesLabel: string;
  accountReadableBalancesLabel: string;
  stakeRewardsLabel: string;
  commissionRewardsLabel: string;
  outstandingRewardsLabel: string;
  identity: string | null;
  website: string | null;
  securityContact: string | null;
  details: string | null;
  unbondingHeightLabel: string | null;
  unbondingTime: string | null;
  transactionsPage: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    items: CosmosTransactionsPageItem[];
  };
  delegationsCount: number;
  delegations: CosmosValidatorDetailDelegationItem[];
  rawJson: {
    validator: CosmosValidatorResponse['validator'] | null;
    delegations: CosmosDelegationsResponse;
    balances: {
      balances?: Array<{
        denom: string;
        amount: string;
      }>;
    } | null;
    stakeRewards: CosmosValidatorDelegatorRewardsResponse | null;
    commissionRewards: CosmosValidatorCommissionResponse | null;
    outstandingRewards: CosmosValidatorOutstandingRewardsResponse | null;
    txSearch: TendermintTxSearchResponse;
    txDetails: Array<{
      hash: string;
      detail: CosmosRestTxResponse | null;
    }>;
  };
};

export type CosmosAccountDetailDelegationItem = {
  validatorAddress: string;
  validatorAddressLabel: string;
  validatorMoniker: string | null;
  amountLabel: string;
  sharesLabel: string;
  rawJson: {
    delegation?: {
      delegator_address?: string;
      validator_address?: string;
      shares?: string;
    };
    balance?: {
      denom?: string;
      amount?: string;
    };
  };
};

export type CosmosAccountDetail = {
  address: string;
  addressLabel: string;
  type: string;
  sequence: number;
  sequenceLabel: string;
  accountNumber: number;
  accountNumberLabel: string;
  balances: Array<{
    denom: string;
    amount: string;
  }>;
  balancesLabel: string;
  readableBalancesLabel: string;
  transactionsPage: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    items: CosmosTransactionsPageItem[];
  };
  delegationsCount: number;
  delegations: CosmosAccountDetailDelegationItem[];
  rawJson: {
    account: unknown;
    balances: {
      balances?: Array<{
        denom: string;
        amount: string;
      }>;
    };
    delegations: CosmosDelegationsResponse;
    txDetails: Array<{
      hash: string;
      detail: CosmosRestTxResponse | null;
    }>;
  };
};

export type CosmosProposalPageItem = {
  id: string;
  title: string;
  typeLabel: string;
  submitTime: string | null;
  submitTimeLabel: string;
  depositEndTime: string | null;
  depositEndTimeLabel: string;
  votingStartTime: string | null;
  votingStartTimeLabel: string;
  votingEndTime: string | null;
  votingEndTimeLabel: string;
  totalDepositLabel: string;
  tallyLabel: string;
  status: string;
  statusLabel: string;
  rawJson: {
    proposal: NonNullable<CosmosGovProposalsResponse['proposals']>[number];
    tally: CosmosGovProposalTallyResponse | null;
  };
};

export type CosmosProposalsPage = {
  page: number;
  pageSize: number;
  totalProposals: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  totalLabel: string;
  proposals: CosmosProposalPageItem[];
};

export type CosmosProposalDetailVoteItem = {
  voter: string;
  voterLabel: string;
  optionLabel: string;
  rawJson: NonNullable<CosmosGovProposalVotesResponse['votes']>[number];
};

export type CosmosProposalDetail = {
  id: string;
  title: string;
  summary: string;
  metadataLabel: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  submitTime: string | null;
  submitTimeLabel: string;
  depositEndTime: string | null;
  depositEndTimeLabel: string;
  votingStartTime: string | null;
  votingStartTimeLabel: string;
  votingEndTime: string | null;
  votingEndTimeLabel: string;
  totalDepositLabel: string;
  tallyLabel: string;
  votesPage: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    items: CosmosProposalDetailVoteItem[];
  };
  rawJson: {
    proposal: NonNullable<CosmosGovProposalsResponse['proposals']>[number] | null;
    tally: CosmosGovProposalTallyResponse | null;
    votes: CosmosGovProposalVotesResponse | null;
  };
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
  proposerOperatorAddressByAddress: Map<string, string>;
};

export type CosmosValidatorMaps = Omit<CachedCosmosValidatorMaps, 'providerId' | 'cachedAt'>;

const COSMOS_VALIDATOR_CACHE_TTL_MS = 60_000;
const COSMOS_FETCH_TIMEOUT_MS = 8_000;
let cachedCosmosValidatorMaps: CachedCosmosValidatorMaps | null = null;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), COSMOS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...init,
      signal: init?.signal ?? controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatInteger(value: string | number | bigint | null | undefined, fallback = 'Unavailable') {
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

function formatCosmosGasLabel(value: string | number | bigint | null | undefined) {
  if (value == null) {
    return '-- Gas';
  }

  const normalized = String(value).trim();

  if (!/^\d+$/.test(normalized)) {
    return '-- Gas';
  }

  const gasUsed = Number(normalized);

  if (gasUsed >= 1_000_000) {
    return `${(gasUsed / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} M Gas`;
  }

  if (gasUsed >= 1_000) {
    return `${(gasUsed / 1_000).toFixed(1).replace(/\.?0+$/, '')} K Gas`;
  }

  return `${gasUsed} Gas`;
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
    second: '2-digit',
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

  if ('base_account' in account && account.base_account && typeof account.base_account === 'object') {
    return normalizeBaseAccount(account.base_account);
  }

  const value = account as { sequence?: string; account_number?: string };

  return {
    sequence: Number(value.sequence ?? 0),
    accountNumber: Number(value.account_number ?? 0),
  };
}

function normalizeAccountAddress(account: unknown): string | null {
  if (!account || typeof account !== 'object') {
    return null;
  }

  if ('base_account' in account && account.base_account && typeof account.base_account === 'object') {
    return normalizeAccountAddress(account.base_account);
  }

  const value = account as { address?: string };

  return typeof value.address === 'string' && value.address.trim() ? value.address : null;
}

function extractCosmosModuleAccountName(account: unknown): string | null {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const value = account as {
    name?: unknown;
    module_name?: unknown;
    base_account?: unknown;
  };

  const rawName =
    typeof value.name === 'string' && value.name.trim() ? value.name.trim() : typeof value.module_name === 'string' && value.module_name.trim() ? value.module_name.trim() : null;

  if (rawName) {
    return rawName.replace(/_tokens_pool$/, '');
  }

  if (value.base_account && typeof value.base_account === 'object') {
    return extractCosmosModuleAccountName(value.base_account);
  }

  return null;
}

function formatCosmosAccountType(account: unknown, rawType: string | null | undefined) {
  return extractCosmosModuleAccountName(account) ?? extractTypeLabel(rawType);
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

function formatBytes(value: string | number | null | undefined, fallback = 'Unavailable') {
  if (value == null) {
    return fallback;
  }

  const bytes = typeof value === 'number' ? value : Number.parseInt(String(value), 10);

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

function formatDenomCollection(items: Array<{ denom: string; amount: string }> | undefined, maxVisible = 2) {
  if (!items?.length) {
    return '0';
  }

  const visible = items.slice(0, maxVisible).map((item) => {
    return `${formatDenomAmount(item.amount)} ${item.denom}`;
  });

  if (items.length > maxVisible) {
    visible.push(`+${items.length - maxVisible} more`);
  }

  return visible.join(', ');
}

function formatCosmosCommissionRate(value: string | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 'Unavailable';
  }

  return `${(parsed * 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function formatCosmosValidatorStatusLabel(status: string | undefined) {
  if (!status) {
    return 'Unknown';
  }

  return status
    .replace(/^BOND_STATUS_/, '')
    .toLowerCase()
    .replace(/(^\w)|_(\w)/g, (_, first, next) => String(first ?? next).toUpperCase())
    .replace(/_/g, ' ');
}

function formatVotingPowerPercent(tokens: string | undefined, status: string | undefined, jailed: boolean | undefined, bondedTokenTotal: bigint) {
  const normalizedTokens = BigInt(tokens ?? '0');
  const active = status === 'BOND_STATUS_BONDED' && !jailed && normalizedTokens > 0n;

  if (!active || bondedTokenTotal <= 0n) {
    return '0%';
  }

  const basisPoints = (normalizedTokens * 10_000n) / bondedTokenTotal;
  const integerPart = basisPoints / 100n;
  const fractionPart = String(basisPoints % 100n).padStart(2, '0');

  return `${integerPart.toString()}.${fractionPart}`.replace(/\.00$/, '') + '%';
}

function deriveCosmosAccountAddressFromValidator(address: string) {
  if (!address) {
    return null;
  }

  if (address.startsWith('0x')) {
    return address;
  }

  try {
    const { prefix, data } = fromBech32(address);

    if (!prefix.includes('valoper')) {
      return address;
    }

    return toBech32(prefix.replace('valoper', ''), data);
  } catch {
    return null;
  }
}

function safeJsonParse(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractCosmosProposalTitle(proposal: NonNullable<CosmosGovProposalsResponse['proposals']>[number]) {
  if (proposal.title?.trim()) {
    return proposal.title.trim();
  }

  const parsedMetadata = safeJsonParse(proposal.metadata);

  if (parsedMetadata && typeof parsedMetadata === 'object') {
    const metadataTitle = (parsedMetadata as { title?: unknown }).title;

    if (typeof metadataTitle === 'string' && metadataTitle.trim()) {
      return metadataTitle.trim();
    }
  }

  if (proposal.summary?.trim()) {
    return proposal.summary.trim();
  }

  const firstMessage = proposal.messages?.[0];

  if (firstMessage && typeof firstMessage === 'object') {
    const messageTitle = (firstMessage as { title?: unknown }).title;

    if (typeof messageTitle === 'string' && messageTitle.trim()) {
      return messageTitle.trim();
    }

    const plan = (firstMessage as { plan?: unknown }).plan;

    if (plan && typeof plan === 'object') {
      const planName = (plan as { name?: unknown }).name;

      if (typeof planName === 'string' && planName.trim()) {
        return planName.trim();
      }
    }
  }

  if (proposal.metadata?.trim()) {
    return proposal.metadata.trim();
  }

  return 'Untitled Proposal';
}

function extractCosmosProposalType(proposal: NonNullable<CosmosGovProposalsResponse['proposals']>[number]) {
  const firstMessage = proposal.messages?.[0];

  if (firstMessage && typeof firstMessage === 'object') {
    const rawType = (firstMessage as { '@type'?: unknown })['@type'];

    if (typeof rawType === 'string' && rawType.trim()) {
      return extractTypeLabel(rawType).replace(/ Proposal$/, '');
    }
  }

  return 'Unknown';
}

function formatCosmosProposalTallyLabel(tally: CosmosGovTallyResult | undefined | null) {
  if (!tally) {
    return '-';
  }

  const oneMillion = 1_000_000n;
  const oneQuadrillion = 10_000_000_000_000_000n;
  const oneMicroUnit = 1_000_000n;
  const oneEtherUnit = 1_000_000_000_000_000_000n;

  function formatTallyAmount(value: string | undefined) {
    const normalized = (value ?? '0').trim();

    if (!/^-?\d+$/.test(normalized)) {
      return '0';
    }

    const amount = BigInt(normalized);
    const negative = amount < 0n;
    const absolute = negative ? -amount : amount;

    if (absolute > oneQuadrillion) {
      const integerPart = absolute / oneEtherUnit;
      const fractionPart = String(absolute % oneEtherUnit)
        .padStart(18, '0')
        .replace(/0+$/, '')
        .slice(0, 6);

      return formatDenomAmount(`${negative ? '-' : ''}${integerPart.toString()}${fractionPart ? `.${fractionPart}` : ''}`);
    }

    if (absolute > oneMillion && absolute < oneQuadrillion) {
      const integerPart = absolute / oneMicroUnit;
      const fractionPart = String(absolute % oneMicroUnit)
        .padStart(6, '0')
        .replace(/0+$/, '')
        .slice(0, 6);

      return formatDenomAmount(`${negative ? '-' : ''}${integerPart.toString()}${fractionPart ? `.${fractionPart}` : ''}`);
    }

    return formatInteger(absolute, '0');
  }

  return [
    `Yes ${formatTallyAmount(tally.yes_count)}`,
    `No ${formatTallyAmount(tally.no_count)}`,
    `Abstain ${formatTallyAmount(tally.abstain_count)}`,
    `Veto ${formatTallyAmount(tally.no_with_veto_count)}`,
  ].join(' / ');
}

function formatCosmosProposalStatusLabel(status: string | undefined) {
  if (!status) {
    return 'Unknown';
  }

  return status
    .replace(/^PROPOSAL_STATUS_/, '')
    .toLowerCase()
    .replace(/(^\w)|_(\w)/g, (_, first, next) => String(first ?? next).toUpperCase())
    .replace(/_/g, ' ');
}

function formatCosmosProposalVoteOptionLabel(option: string | undefined) {
  if (!option) {
    return 'Unknown';
  }

  return option
    .replace(/^VOTE_OPTION_/, '')
    .toLowerCase()
    .replace(/(^\w)|_(\w)/g, (_, first, next) => String(first ?? next).toUpperCase())
    .replace(/_/g, ' ');
}

function calculateAverageBlockTime(blocks: Array<{ timestampMs: number | null }>) {
  const timestamps = blocks.map((block) => block.timestampMs).filter((value): value is number => value != null);

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
  return fetchJson<TendermintUnconfirmedTxsResponse>(`${profile.rpcUrl}/num_unconfirmed_txs`);
}

async function getBlockchainDirect(profile: CosmosProvider, latestHeight: number, limit: number) {
  const minHeight = Math.max(1, latestHeight - limit + 1);
  return getBlockchainRangeDirect(profile, minHeight, latestHeight);
}

async function getBlockchainRangeDirect(profile: CosmosProvider, minHeight: number, maxHeight: number) {
  return fetchJson<TendermintBlockchainResponse>(`${profile.rpcUrl}/blockchain?minHeight=${minHeight}&maxHeight=${maxHeight}`);
}

async function getTxSearchDirect(profile: CosmosProvider, perPage: number) {
  return fetchJson<TendermintTxSearchResponse>(`${profile.rpcUrl}/tx_search?query=%22tx.height%20%3E%200%22&prove=false&page=1&per_page=${perPage}&order_by=%22desc%22`);
}

async function getTxSearchByHeightDirect(profile: CosmosProvider, height: number, page: number, perPage: number) {
  const query = encodeURIComponent(`"tx.height = ${height}"`);
  const orderBy = encodeURIComponent('"desc"');

  return fetchJson<TendermintTxSearchResponse>(`${profile.rpcUrl}/tx_search?query=${query}&prove=false&page=${page}&per_page=${perPage}&order_by=${orderBy}`);
}

async function getTxSearchWithQueryDirect(profile: CosmosProvider, query: string, page: number, perPage: number) {
  const encodedQuery = encodeURIComponent(`"${query}"`);
  const orderBy = encodeURIComponent('"desc"');

  return fetchJson<TendermintTxSearchResponse>(`${profile.rpcUrl}/tx_search?query=${encodedQuery}&prove=false&page=${page}&per_page=${perPage}&order_by=${orderBy}`);
}

async function getRestValidatorsDirect(profile: CosmosProvider) {
  return fetchJson<CosmosValidatorsResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=200&pagination.count_total=true`);
}

async function getRpcValidatorsDirect(profile: CosmosProvider, height: number) {
  return fetchJson<TendermintValidatorsResponse>(`${profile.rpcUrl}/validators?height=${height}&page=1&per_page=200`);
}

async function getCosmosValidatorMapsDirect(profile: CosmosProvider, height: number) {
  const now = Date.now();

  if (cachedCosmosValidatorMaps && cachedCosmosValidatorMaps.providerId === profile.id && now - cachedCosmosValidatorMaps.cachedAt < COSMOS_VALIDATOR_CACHE_TTL_MS) {
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
    (restValidatorsPayload.validators ?? []).map((validator) => [validator.consensus_pubkey?.key ?? '', validator.description?.moniker ?? 'Unknown']),
  );
  const operatorAddressByPubKey = new Map((restValidatorsPayload.validators ?? []).map((validator) => [validator.consensus_pubkey?.key ?? '', validator.operator_address ?? '']));
  const proposerMonikerByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [validator.address ?? '', monikerByPubKey.get(validator.pub_key?.value ?? '') ?? 'Unknown']),
  );
  const proposerOperatorAddressByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [validator.address ?? '', operatorAddressByPubKey.get(validator.pub_key?.value ?? '') ?? '']),
  );
  const nextCache = {
    providerId: profile.id,
    cachedAt: now,
    monikerByPubKey,
    proposerMonikerByAddress,
    proposerOperatorAddressByAddress,
  };

  cachedCosmosValidatorMaps = nextCache;
  return nextCache;
}

export async function getCosmosValidatorMapsForHeightDirect(height: number | string): Promise<CosmosValidatorMaps> {
  const profile = getActiveCosmosProvider();
  const normalizedHeight = typeof height === 'number' ? height : Number.parseInt(height, 10);
  const maps = await getCosmosValidatorMapsDirect(profile, Number.isFinite(normalizedHeight) ? normalizedHeight : 0);

  return {
    monikerByPubKey: maps.monikerByPubKey,
    proposerMonikerByAddress: maps.proposerMonikerByAddress,
    proposerOperatorAddressByAddress: maps.proposerOperatorAddressByAddress,
  };
}

async function getCommitDirect(profile: CosmosProvider, height: string) {
  return fetchJson<TendermintCommitResponse>(`${profile.rpcUrl}/commit?height=${height}`);
}

async function getBlockResultsDirect(profile: CosmosProvider, height: string) {
  return fetchJson<TendermintBlockResultsResponse>(`${profile.rpcUrl}/block_results?height=${height}`);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

async function getBlockTimestampsByHeights(profile: CosmosProvider, heights: string[]) {
  const uniqueHeights = [...new Set(heights.filter(Boolean))];
  const entries = await mapWithConcurrency(uniqueHeights, COSMOS_BLOCK_TIMESTAMP_CONCURRENCY, async (height) => {
    try {
      const payload = await fetchJson<TendermintBlockResponse>(`${profile.rpcUrl}/block?height=${height}`);
      return [height, payload.result?.block?.header?.time ?? null] as const;
    } catch {
      return [height, null] as const;
    }
  });

  return new Map(entries);
}

async function getDecodedLatestTransactions(input: { profile: CosmosProvider; txs: TendermintTxSearchItem[]; blockTimeByHeight: Map<string, string | null>; txLimit: number }) {
  const txs = input.txs.slice(0, input.txLimit);
  const detailResults = await Promise.allSettled(txs.map((tx) => fetchJson<CosmosRestTxResponse>(`${input.profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`)));
  const nextTransactions: CosmosHomeTransactionItem[] = [];

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
    const decoded = decodeCosmosTransactionSummary({
      hash: tx.hash,
      payload: detail,
      fallbackHeight: tx.height,
      fallbackCode: tx.tx_result?.code,
      fallbackGasUsed: tx.tx_result?.gas_used,
      fallbackGasWanted: tx.tx_result?.gas_wanted,
      timestamp: input.blockTimeByHeight.get(tx.height) ?? null,
    });
    const item: CosmosHomeTransactionItem = {
      hash: decoded.hash,
      hashLabel: decoded.hashLabel,
      height: decoded.height,
      type: decoded.type,
      sender: decoded.sender,
      senderLabel: decoded.senderLabel,
      feeLabel: decoded.feeLabel,
      status: decoded.status,
      statusLabel: decoded.statusLabel,
      timestampMs: decoded.timestampMs,
    };

    nextTransactions.push(item);
  });

  return nextTransactions;
}

export async function getCosmosOverviewDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await getStatusDirect(profile);

  return {
    chainLabel: profile.name,
    latestHeight: payload.result?.sync_info?.latest_block_height ?? 'Unavailable',
    latestBlockTime: formatLocalTimestamp(payload.result?.sync_info?.latest_block_time),
    chainId: payload.result?.node_info?.network ?? 'Unavailable',
  };
}

export async function getRecentCosmosBlocksDirect(limit = 8) {
  const profile = getActiveCosmosProvider();
  const status = await getStatusDirect(profile);
  const latestHeight = Number(status.result?.sync_info?.latest_block_height ?? 0);
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

function formatCosmosCommitSummary(signatures: TendermintCommitSignature[] | undefined) {
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
  const parts = [...counts.entries()].sort((left, right) => left[0] - right[0]).map(([flag, count]) => `${labels.get(flag) ?? `Flag ${flag}`}: ${count}`);

  return parts.join(' · ');
}

function getCosmosCommitFlagLabel(flag: number) {
  const labels = new Map<number, string>([
    [1, 'Absent'],
    [2, 'Commit'],
    [3, 'Nil'],
  ]);

  return labels.get(flag) ?? `Flag ${flag}`;
}

function summarizeCosmosEvents(events: TendermintEvent[] | undefined) {
  if (!events?.length) {
    return {
      label: '0 events',
      preview: [] as string[],
    };
  }

  const counts = new Map<string, number>();

  events.forEach((event) => {
    const type = event.type?.trim() || 'unknown';
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });

  const preview = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] === left[1]) {
        return left[0].localeCompare(right[0]);
      }

      return right[1] - left[1];
    })
    .slice(0, 6)
    .map(([type, count]) => (count > 1 ? `${type} (${count})` : type));

  return {
    label: `${formatInteger(events.length, '0')} events`,
    preview,
  };
}

function isLikelyBase64(value: string) {
  if (!value || value.length < 4 || value.length % 4 !== 0) {
    return false;
  }

  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isMostlyReadableText(value: string) {
  if (!value) {
    return false;
  }

  let readable = 0;

  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      readable += 1;
    }
  }

  return readable / value.length >= 0.85;
}

function decodeCosmosEventField(value: string | undefined, skipDecode = false) {
  if (!value) {
    return '';
  }

  if (skipDecode || !isLikelyBase64(value) || typeof globalThis.atob !== 'function') {
    return value;
  }

  try {
    const decoded = globalThis.atob(value);
    return isMostlyReadableText(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

function formatCosmosDetailedEvents(events: TendermintEvent[] | undefined) {
  if (!events?.length) {
    return [] as CosmosBlockDetailEventItem[];
  }

  return events.map((event) => ({
    type: event.type?.trim() || 'unknown',
    attributes: (event.attributes ?? []).map((attribute) => ({
      key: decodeCosmosEventField(attribute.key),
      value: decodeCosmosEventField(attribute.value, attribute.key === 'signature'),
      indexed: Boolean(attribute.index),
    })),
  }));
}

function formatCosmosTxMessageValue(value: unknown): string {
  if (value == null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value || 'Empty';
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatCosmosTxMessages(messages: Array<Record<string, unknown>> | undefined) {
  return (messages ?? []).map((message) => {
    const rawType = typeof message['@type'] === 'string' ? message['@type'] : null;
    const fields = Object.entries(message)
      .filter(([key]) => key !== '@type')
      .map(([key, value]) => ({
        key,
        value: formatCosmosTxMessageValue(value),
      }));

    return {
      type: rawType ?? 'Unknown',
      title: extractTypeLabel(rawType),
      fields,
    } satisfies CosmosTxDetailMessageItem;
  });
}

function extractCosmosTxTarget(payload: CosmosRestTxResponse) {
  const eventTarget =
    findEventAttribute(payload.tx_response?.events, 'transfer', 'recipient') ??
    findEventAttribute(payload.tx_response?.events, 'coin_received', 'receiver') ??
    findEventAttribute(payload.tx_response?.events, 'message', 'module') ??
    findEventAttribute(payload.tx_response?.events, 'delegate', 'validator') ??
    findEventAttribute(payload.tx_response?.events, 'proposal_vote', 'proposal_id');

  if (eventTarget) {
    return eventTarget;
  }

  const message = getFirstMessage(payload);

  if (!message) {
    return null;
  }

  const candidateKeys = ['to_address', 'recipient', 'receiver', 'validator_address', 'proposal_id', 'contract', 'grantee', 'authority'] as const;

  for (const key of candidateKeys) {
    const value = message[key];

    if (typeof value === 'string' && value.trim() && value !== extractSender(payload)) {
      return value;
    }
  }

  return null;
}

function getCosmosEventAttributeValue(event: TendermintEvent, targetKey: string) {
  const attribute = (event.attributes ?? []).find((item) => {
    return decodeCosmosEventField(item.key) === targetKey;
  });

  return attribute ? decodeCosmosEventField(attribute.value, decodeCosmosEventField(attribute.key) === 'signature') : null;
}

function splitFinalizeBlockEvents(events: TendermintEvent[] | undefined) {
  const beginEvents: TendermintEvent[] = [];
  const endEvents: TendermintEvent[] = [];

  (events ?? []).forEach((event) => {
    const mode = getCosmosEventAttributeValue(event, 'mode');

    if (mode === 'BeginBlock') {
      beginEvents.push(event);
      return;
    }

    endEvents.push(event);
  });

  return { beginEvents, endEvents };
}

function formatCosmosBlockDetailTransaction(input: { tx: TendermintTxSearchItem; detail: CosmosRestTxResponse | null }) {
  const fallbackDetail =
    input.detail ??
    ({
      tx_response: {
        txhash: input.tx.hash,
        height: input.tx.height,
        code: input.tx.tx_result?.code ?? 1,
        gas_used: input.tx.tx_result?.gas_used ?? '0',
        gas_wanted: input.tx.tx_result?.gas_wanted ?? '0',
        raw_log: '',
        events: [],
      },
    } satisfies CosmosRestTxResponse);
  const decoded = decodeCosmosTransactionSummary({
    hash: input.tx.hash ?? 'Unavailable',
    payload: fallbackDetail,
    fallbackHeight: input.tx.height ?? null,
    fallbackCode: input.tx.tx_result?.code,
    fallbackGasUsed: input.tx.tx_result?.gas_used,
    fallbackGasWanted: input.tx.tx_result?.gas_wanted,
  });

  return {
    hash: decoded.hash,
    hashLabel: decoded.hashLabel,
    height: decoded.height,
    type: decoded.type,
    sender: decoded.sender,
    senderLabel: decoded.senderLabel,
    feeLabel: decoded.feeLabel,
    gasUsedLabel: formatInteger(decoded.gasUsed, '0'),
    gasWantedLabel: formatInteger(decoded.gasWanted, '0'),
    status: decoded.status,
    statusLabel: decoded.statusLabel,
    rawLog: fallbackDetail.tx_response?.raw_log ?? '',
    messageCount: fallbackDetail.tx?.body?.messages?.length ?? 0,
    rawJson: {
      search: input.tx,
      detail: input.detail,
    },
  } satisfies CosmosBlockDetailTransactionItem;
}

function formatCosmosTransactionsPageItem(input: { tx: TendermintTxSearchItem; detail: CosmosRestTxResponse | null; timestamp: string | null }) {
  const fallbackDetail =
    input.detail ??
    ({
      tx_response: {
        txhash: input.tx.hash,
        height: input.tx.height,
        code: input.tx.tx_result?.code ?? 1,
        gas_used: input.tx.tx_result?.gas_used ?? '0',
        gas_wanted: input.tx.tx_result?.gas_wanted ?? '0',
        raw_log: '',
        events: [],
      },
    } satisfies CosmosRestTxResponse);
  const timestamp = fallbackDetail.tx_response?.timestamp ?? input.timestamp ?? null;
  const decoded = decodeCosmosTransactionSummary({
    hash: input.tx.hash ?? 'Unavailable',
    payload: fallbackDetail,
    fallbackHeight: input.tx.height ?? null,
    fallbackCode: input.tx.tx_result?.code,
    fallbackGasUsed: input.tx.tx_result?.gas_used,
    fallbackGasWanted: input.tx.tx_result?.gas_wanted,
    timestamp,
  });
  const target = extractCosmosTxTarget(fallbackDetail);

  return {
    hash: decoded.hash,
    hashLabel: decoded.hashLabel,
    height: decoded.height,
    type: decoded.type,
    sender: decoded.sender,
    senderLabel: decoded.senderLabel,
    messageCount: fallbackDetail.tx?.body?.messages?.length ?? 0,
    target,
    targetLabel: target && target !== 'Unknown' ? (target.length > 20 ? formatCompactHash(target, 14, 8) : target) : null,
    feeLabel: decoded.feeLabel,
    gasUsedLabel: formatInteger(decoded.gasUsed, '0'),
    gasWantedLabel: formatInteger(decoded.gasWanted, '0'),
    status: decoded.status,
    statusLabel: decoded.statusLabel,
    timeLabel: formatLocalTimestamp(timestamp ?? undefined),
    timestampMs: decoded.timestampMs,
  } satisfies CosmosTransactionsPageItem;
}

function sumCosmosBlockGas(
  txResults:
    | Array<{
        gas_wanted?: string;
        gas_used?: string;
      }>
    | undefined,
) {
  return (txResults ?? []).reduce(
    (totals, txResult) => {
      const gasUsed = BigInt(txResult.gas_used ?? '0');
      const gasWanted = BigInt(txResult.gas_wanted ?? '0');

      return {
        gasUsed: totals.gasUsed + gasUsed,
        gasWanted: totals.gasWanted + gasWanted,
      };
    },
    {
      gasUsed: 0n,
      gasWanted: 0n,
    },
  );
}

function getCosmosBlockGasAmount(blockResults: TendermintBlockResultsResponse | null | undefined) {
  const result = blockResults?.result;
  const blockGasEvent = [...(result?.finalize_block_events ?? []), ...(result?.end_block_events ?? []), ...(result?.begin_block_events ?? [])].find(
    (event) => decodeCosmosEventField(event.type) === 'block_gas',
  );
  const blockGasAmount = blockGasEvent ? getCosmosEventAttributeValue(blockGasEvent, 'amount') : null;

  if (blockGasAmount) {
    return blockGasAmount;
  }

  return sumCosmosBlockGas(result?.txs_results).gasUsed;
}

function formatCosmosBlocksPageItem(input: {
  block: TendermintBlockMeta;
  blockResults?: TendermintBlockResultsResponse | null;
  signatures?: Array<{
    block_id_flag?: number | string;
    validator_address?: string;
    signature?: string | null;
  }>;
  commitCanonical?: boolean | null;
  proposerMonikerByAddress: Map<string, string>;
  proposerOperatorAddressByAddress: Map<string, string>;
}) {
  const height = input.block.header?.height ?? '0';
  const hash = input.block.block_id?.hash ?? 'Unavailable';
  const timestamp = input.block.header?.time;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
  const proposer = input.block.header?.proposer_address ?? 'Unknown';
  const proposerMoniker = input.proposerMonikerByAddress.get(proposer) ?? null;
  const proposerOperatorAddress = input.proposerOperatorAddressByAddress.get(proposer) ?? null;
  const proposerLabel = proposerMoniker && proposerMoniker !== 'Unknown' ? proposerMoniker : formatCompactHash(proposer, 10, 6);
  const appHash = input.block.header?.app_hash ?? 'Unavailable';

  return {
    height,
    hash,
    hashLabel: formatCompactHash(hash, 10, 8),
    proposer,
    proposerOperatorAddress,
    proposerLabel,
    proposerAddressLabel: proposer === 'Unknown' ? proposer : formatCompactHash(proposer, 12, 8),
    txCount: Number.parseInt(input.block.num_txs ?? '0', 10) || 0,
    txCountLabel: formatInteger(input.block.num_txs ?? '0', '0'),
    gasUsedLabel: formatCosmosGasLabel(getCosmosBlockGasAmount(input.blockResults)),
    blockSizeLabel: formatBytes(input.block.block_size),
    appHash,
    appHashLabel: formatCompactHash(appHash, 10, 8),
    signaturesLabel: input.commitCanonical === false ? 'Pending' : formatCosmosCommitSummary(input.signatures),
    timeLabel: formatLocalTimestamp(timestamp),
    timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
  } satisfies CosmosBlocksPageItem;
}

export async function getCosmosBlocksPageDirect(requestedPage = 1, pageSize = 20) {
  const profile = getActiveCosmosProvider();
  const statusPayload = await getStatusDirect(profile);
  const latestHeight = Number(statusPayload.result?.sync_info?.latest_block_height ?? 0);
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
  const blockMetas = [...(blockchainPayload.result?.block_metas ?? [])].sort((left, right) => Number(right.header?.height ?? 0) - Number(left.header?.height ?? 0));
  const commitPayloads = await Promise.allSettled(
    blockMetas.map((block) => (block.header?.height ? getCommitDirect(profile, block.header.height) : Promise.reject(new Error('Missing block height.')))),
  );
  const blockResultsPayloads = await Promise.allSettled(
    blockMetas.map((block) => (block.header?.height ? getBlockResultsDirect(profile, block.header.height) : Promise.reject(new Error('Missing block height.')))),
  );
  const blocks = blockMetas.map((block, index) => {
    const commitResult = commitPayloads[index];
    const blockResultsResult = blockResultsPayloads[index];
    const signatures = commitResult?.status === 'fulfilled' ? commitResult.value.result?.signed_header?.commit?.signatures : undefined;

    return formatCosmosBlocksPageItem({
      block,
      blockResults: blockResultsResult?.status === 'fulfilled' ? blockResultsResult.value : null,
      signatures,
      commitCanonical: commitResult?.status === 'fulfilled' ? commitResult.value.canonical : null,
      proposerMonikerByAddress: validatorMaps.proposerMonikerByAddress,
      proposerOperatorAddressByAddress: validatorMaps.proposerOperatorAddressByAddress,
    });
  });
  const averageBlockTime = calculateAverageBlockTime(blocks);
  const topBlock = blocks[0]?.height ?? String(pageMaxHeight);
  const bottomBlock = blocks[blocks.length - 1]?.height ?? String(pageMinHeight);

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

export async function getCosmosTransactionsPageDirect(input?: { requestedPage?: number; pageSize?: number; query?: string }) {
  const profile = getActiveCosmosProvider();
  const requestedPage = Math.max(1, Math.trunc(input?.requestedPage ?? 1));
  const pageSize = Math.max(1, Math.trunc(input?.pageSize ?? 20));
  const query = input?.query?.trim() || 'tx.height > 0';
  const [statusPayload, txSearchPayload] = await Promise.all([getStatusDirect(profile), getTxSearchWithQueryDirect(profile, query, requestedPage, pageSize)]);
  const latestHeight = Number(statusPayload.result?.sync_info?.latest_block_height ?? 0);
  const totalTransactions = Number.parseInt(txSearchPayload.result?.total_count ?? '0', 10) || 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalTransactions, 1) / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const searchPayload = page === requestedPage ? txSearchPayload : await getTxSearchWithQueryDirect(profile, query, page, pageSize);
  const txs = searchPayload.result?.txs ?? [];
  const heights = txs.map((tx) => tx.height ?? '').filter(Boolean);
  const [blockTimeByHeight, detailResults] = await Promise.all([
    getBlockTimestampsByHeights(profile, heights),
    Promise.allSettled(
      txs.map((tx) => {
        if (!tx.hash) {
          return Promise.resolve(null);
        }

        return fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`);
      }),
    ),
  ]);
  const transactions = txs.map((tx, index) =>
    formatCosmosTransactionsPageItem({
      tx,
      detail: detailResults[index]?.status === 'fulfilled' ? detailResults[index].value : null,
      timestamp: blockTimeByHeight.get(tx.height ?? '') ?? null,
    }),
  );
  const topBlock = transactions[0]?.height ?? 'Unavailable';
  const bottomBlock = transactions[transactions.length - 1]?.height ?? 'Unavailable';

  return {
    page,
    pageSize,
    query,
    totalTransactions,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    totalLabel: totalTransactions ? `${formatInteger(totalTransactions)} transactions` : 'No transactions returned',
    summary: [
      {
        label: 'Latest Block',
        value: formatInteger(latestHeight),
        note: `Current head reported by ${profile.name}.`,
      },
      {
        label: 'Query',
        value: query,
        note: 'RPC tx_search query for this page.',
      },
      {
        label: 'Results',
        value: formatInteger(totalTransactions, '0'),
        note: `Showing page ${page} of ${totalPages}.`,
      },
      {
        label: 'Current Range',
        value: topBlock === 'Unavailable' ? 'Unavailable' : `#${topBlock} - #${bottomBlock}`,
        note: `Loaded ${transactions.length} transactions on this page.`,
      },
    ],
    transactions,
  };
}

export async function getCosmosTransactionsByBlockDirect(height: string | number, limit = 20) {
  const profile = getActiveCosmosProvider();
  const normalizedHeight = typeof height === 'number' ? height : Number.parseInt(height, 10);

  if (!Number.isFinite(normalizedHeight) || normalizedHeight < 1) {
    throw new Error('Invalid Cosmos block height.');
  }

  const txSearchPayload = await getTxSearchByHeightDirect(profile, normalizedHeight, 1, Math.max(1, Math.trunc(limit)));
  const txs = txSearchPayload.result?.txs ?? [];

  if (!txs.length) {
    return [] as CosmosTransactionsPageItem[];
  }

  const [blockTimeByHeight, detailResults] = await Promise.all([
    getBlockTimestampsByHeights(profile, [String(normalizedHeight)]),
    Promise.allSettled(
      txs.map((tx) => {
        if (!tx.hash) {
          return Promise.resolve(null);
        }

        return fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`);
      }),
    ),
  ]);

  return txs.map((tx, index) =>
    formatCosmosTransactionsPageItem({
      tx,
      detail: detailResults[index]?.status === 'fulfilled' ? detailResults[index].value : null,
      timestamp: blockTimeByHeight.get(tx.height ?? String(normalizedHeight)) ?? null,
    }),
  );
}

export async function getCosmosTransactionsByHashesDirect(hashes: string[]) {
  const profile = getActiveCosmosProvider();
  const uniqueHashes = [...new Set(hashes.map((hash) => hash.trim().toUpperCase()).filter(Boolean))];

  if (!uniqueHashes.length) {
    return [] as CosmosTransactionsPageItem[];
  }

  const detailResults = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const detail = await fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`);

      return formatCosmosTransactionsPageItem({
        tx: {
          hash,
          height: detail.tx_response?.height,
          tx_result: {
            code: detail.tx_response?.code,
            gas_used: detail.tx_response?.gas_used,
            gas_wanted: detail.tx_response?.gas_wanted,
          },
        },
        detail,
        timestamp: detail.tx_response?.timestamp ?? null,
      });
    }),
  );

  return detailResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

export async function getCosmosLatestBlockFeedDirect(height: number | string, options: { includeCommit?: boolean } = {}) {
  const profile = getActiveCosmosProvider();
  const normalizedHeight = typeof height === 'number' ? height : Number.parseInt(height, 10);
  const includeCommit = options.includeCommit ?? true;

  if (!Number.isFinite(normalizedHeight) || normalizedHeight < 0) {
    throw new Error('Invalid Cosmos block height.');
  }

  const [blockchainPayload, commitPayload, blockResultsPayload, validatorMaps] = await Promise.all([
    getBlockchainRangeDirect(profile, normalizedHeight, normalizedHeight),
    includeCommit
      ? getCommitDirect(profile, String(normalizedHeight)).catch(() => ({
          canonical: null,
          result: { signed_header: { commit: { signatures: [] } } },
        }))
      : Promise.resolve(null),
    getBlockResultsDirect(profile, String(normalizedHeight)).catch(() => null),
    getCosmosValidatorMapsDirect(profile, normalizedHeight),
  ]);
  const blockMeta = blockchainPayload.result?.block_metas?.[0];

  if (!blockMeta?.header?.height || !blockMeta.block_id?.hash) {
    throw new Error('Failed to load the latest Cosmos block details.');
  }

  const blockPageItem = formatCosmosBlocksPageItem({
    block: blockMeta,
    blockResults: blockResultsPayload,
    signatures: commitPayload?.result?.signed_header?.commit?.signatures,
    commitCanonical: commitPayload?.canonical ?? null,
    proposerMonikerByAddress: validatorMaps.proposerMonikerByAddress,
    proposerOperatorAddressByAddress: validatorMaps.proposerOperatorAddressByAddress,
  });

  return {
    latestBlock: blockPageItem.height,
    latestBlockNumber: Number.parseInt(blockPageItem.height, 10) || 0,
    latestBlockTime: blockPageItem.timeLabel,
    latestBlockTimestampMs: blockPageItem.timestampMs,
    blockPageItem,
  } satisfies CosmosLatestBlockFeed;
}

export async function getCosmosBlockByHeightDirect(height: number, requestedTxPage = 1, txPageSize = 20) {
  const profile = getActiveCosmosProvider();
  const normalizedHeight = Number.parseInt(String(height), 10);

  if (!Number.isFinite(normalizedHeight) || normalizedHeight < 1) {
    throw new Error('Invalid Cosmos block height.');
  }

  const requestedPage = Math.max(1, Math.trunc(requestedTxPage));
  const pageSize = Math.max(1, Math.trunc(txPageSize));
  const [blockchainPayload, blockPayload, commitPayload, blockResultsPayload, validatorMaps] = await Promise.all([
    getBlockchainRangeDirect(profile, normalizedHeight, normalizedHeight),
    fetchJson<TendermintBlockResponse>(`${profile.rpcUrl}/block?height=${normalizedHeight}`),
    getCommitDirect(profile, String(normalizedHeight)).catch(() => null),
    getBlockResultsDirect(profile, String(normalizedHeight)).catch(() => null),
    getCosmosValidatorMapsDirect(profile, normalizedHeight),
  ]);
  const blockMeta = blockchainPayload.result?.block_metas?.[0];
  const blockResult = blockPayload.result;

  if (!blockMeta?.block_id?.hash || !blockMeta.header?.height || !blockResult?.block?.header?.height) {
    throw new Error('Failed to load Cosmos block.');
  }

  const timestamp = blockMeta.header.time ?? blockResult.block.header.time ?? null;
  const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
  const proposer = blockMeta.header.proposer_address ?? blockResult.block.header.proposer_address ?? 'Unknown';
  const proposerMoniker = validatorMaps.proposerMonikerByAddress.get(proposer) ?? null;
  const proposerOperatorAddress = validatorMaps.proposerOperatorAddressByAddress.get(proposer) ?? null;
  const proposerLabel = proposerMoniker && proposerMoniker !== 'Unknown' ? proposerMoniker : formatCompactHash(proposer, 10, 6);
  const appHash = blockMeta.header.app_hash ?? blockResult.block.header.app_hash ?? 'Unavailable';
  const txCount = Number.parseInt(blockMeta.num_txs ?? String(blockResult.block.data?.txs?.length ?? 0), 10) || 0;
  const commitSignatures = commitPayload?.result?.signed_header?.commit?.signatures ?? blockResult.block.last_commit?.signatures ?? [];
  const rawBeginBlockEvents = blockResultsPayload?.result?.begin_block_events ?? [];
  const rawEndBlockEvents = blockResultsPayload?.result?.end_block_events ?? [];
  const rawFinalizeBlockEvents = blockResultsPayload?.result?.finalize_block_events ?? [];
  const finalizeBlockEventGroups = splitFinalizeBlockEvents(rawFinalizeBlockEvents);
  const beginBlockEvents = rawBeginBlockEvents.length ? rawBeginBlockEvents : finalizeBlockEventGroups.beginEvents;
  const endBlockEvents = rawEndBlockEvents.length ? rawEndBlockEvents : finalizeBlockEventGroups.endEvents;
  const beginBlockEventSummary = summarizeCosmosEvents(beginBlockEvents);
  const endBlockEventSummary = summarizeCosmosEvents(endBlockEvents);
  const detailedBeginBlockEvents = formatCosmosDetailedEvents(beginBlockEvents);
  const detailedEndBlockEvents = formatCosmosDetailedEvents(endBlockEvents);
  const gasTotals = sumCosmosBlockGas(blockResultsPayload?.result?.txs_results);
  const txSearchFallback = {
    result: {
      total_count: String(txCount),
      txs: [] as TendermintTxSearchItem[],
    },
  } satisfies TendermintTxSearchResponse;
  let txSearchPayload = txCount > 0 ? await getTxSearchByHeightDirect(profile, normalizedHeight, requestedPage, pageSize).catch(() => txSearchFallback) : txSearchFallback;
  const totalCount = Number.parseInt(txSearchPayload.result?.total_count ?? String(txCount), 10) || txCount;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const page = Math.min(requestedPage, totalPages);

  if (txCount > 0 && page !== requestedPage) {
    txSearchPayload = await getTxSearchByHeightDirect(profile, normalizedHeight, page, pageSize).catch(() => txSearchFallback);
  }

  const txs = txSearchPayload.result?.txs ?? [];
  const txDetailResults = await Promise.allSettled(
    txs.map((tx) => {
      if (!tx.hash) {
        return Promise.resolve(null);
      }

      return fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`);
    }),
  );
  const transactions = txs.map((tx, index) =>
    formatCosmosBlockDetailTransaction({
      tx,
      detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
    }),
  );

  return {
    height: blockMeta.header.height,
    hash: blockMeta.block_id.hash,
    hashLabel: formatCompactHash(blockMeta.block_id.hash, 10, 8),
    timestamp,
    timeLabel: formatLocalTimestamp(timestamp ?? undefined),
    timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
    chainId: blockResult.block.header.chain_id ?? 'Unavailable',
    proposer,
    proposerOperatorAddress,
    proposerLabel,
    proposerMoniker,
    appHash,
    appHashLabel: formatCompactHash(appHash, 10, 8),
    txCount,
    txCountLabel: formatInteger(txCount, '0'),
    gasUsedLabel: formatInteger(gasTotals.gasUsed, '0'),
    gasWantedLabel: formatInteger(gasTotals.gasWanted, '0'),
    blockSizeLabel: formatBytes(blockMeta.block_size),
    signaturesLabel: formatCosmosCommitSummary(commitSignatures),
    signaturesCount: commitSignatures.length,
    canonicalLabel: commitPayload?.canonical == null ? 'Unknown' : commitPayload.canonical ? 'Yes' : 'No',
    eventsCount: detailedBeginBlockEvents.length + detailedEndBlockEvents.length,
    beginBlockEventsLabel: beginBlockEventSummary.label,
    endBlockEventsLabel: endBlockEventSummary.label,
    beginBlockEventsPreview: beginBlockEventSummary.preview,
    endBlockEventsPreview: endBlockEventSummary.preview,
    beginBlockEvents: detailedBeginBlockEvents,
    endBlockEvents: detailedEndBlockEvents,
    commitSignatures: commitSignatures.map((signature) => {
      const flag = Number.parseInt(String(signature.block_id_flag ?? 0), 10);

      return {
        validatorAddress: signature.validator_address ?? 'Unavailable',
        operatorAddress: validatorMaps.proposerOperatorAddressByAddress.get(signature.validator_address ?? '') ?? null,
        moniker: validatorMaps.proposerMonikerByAddress.get(signature.validator_address ?? '') ?? 'Unknown',
        flagLabel: getCosmosCommitFlagLabel(flag),
        hasSignature: Boolean(signature.signature),
      };
    }),
    transactionsPage: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      items: transactions,
    },
    rawJson: {
      blockMeta,
      block: blockResult,
      commit: commitPayload,
      blockResults: blockResultsPayload,
      txSearch: txSearchPayload,
      txDetails: txs.map((tx, index) => ({
        hash: tx.hash ?? 'Unavailable',
        detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
      })),
    },
  } satisfies CosmosBlockDetail;
}

export async function getCosmosTxByHashDirect(hash: string) {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`);
  const tx = payload.tx_response;

  if (!tx?.txhash || !tx.height) {
    throw new Error('Failed to load Cosmos transaction.');
  }

  const blockTimestamps = await getBlockTimestampsByHeights(profile, [tx.height]);
  const blockTimestamp = blockTimestamps.get(tx.height) ?? null;
  const timestamp = tx.timestamp ?? blockTimestamp;
  const decoded = decodeCosmosTransactionSummary({
    hash: tx.txhash,
    payload,
    fallbackHeight: tx.height,
    fallbackCode: tx.code,
    fallbackGasUsed: tx.gas_used,
    fallbackGasWanted: tx.gas_wanted,
    timestamp,
  });
  const target = extractCosmosTxTarget(payload);
  const events = formatCosmosDetailedEvents(tx.events);
  const code = tx.code ?? 0;

  return {
    hash: decoded.hash,
    height: decoded.height,
    code,
    status: decoded.status,
    statusLabel: decoded.statusLabel,
    type: decoded.type,
    sender: decoded.sender,
    senderLabel: decoded.senderLabel,
    target,
    targetLabel: target && target !== 'Unknown' ? (target.length > 20 ? formatCompactHash(target, 14, 8) : target) : null,
    timestamp: timestamp ?? null,
    timestampLabel: formatLocalTimestamp(timestamp ?? undefined),
    timestampMs: decoded.timestampMs,
    feeLabel: decoded.feeLabel,
    memo: payload.tx?.body?.memo ?? payload.tx?.memo ?? '',
    gasUsedLabel: formatInteger(decoded.gasUsed, '0'),
    gasWantedLabel: formatInteger(decoded.gasWanted, '0'),
    rawLog: tx.raw_log ?? '',
    messageCount: payload.tx?.body?.messages?.length ?? 0,
    messages: formatCosmosTxMessages(payload.tx?.body?.messages),
    eventsCount: events.length,
    events,
    rawJson: {
      transaction: payload,
      blockTimestamp,
    },
  } satisfies CosmosTxDetail;
}

export async function getCosmosAccountsPageDirect(requestedPage = 1, pageSize = 20) {
  const profile = getActiveCosmosProvider();
  const page = Math.max(1, Math.trunc(requestedPage));
  const limit = Math.max(1, Math.trunc(pageSize));
  const offset = (page - 1) * limit;
  const payload = await fetchJson<CosmosAuthAccountsResponse>(
    `${profile.restUrl}/cosmos/auth/v1beta1/accounts?pagination.count_total=true&pagination.offset=${offset}&pagination.limit=${limit}`,
  );
  const totalAccounts = Number.parseInt(payload.pagination?.total ?? '0', 10) || (payload.accounts?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalAccounts, 1) / limit));
  const normalizedPage = Math.min(page, totalPages);

  if (normalizedPage !== page) {
    return getCosmosAccountsPageDirect(normalizedPage, limit);
  }

  const accounts = (payload.accounts ?? []).filter((account) => normalizeAccountAddress(account));
  const balanceResults = await Promise.allSettled(
    accounts.map((account) =>
      fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(`${profile.restUrl}/cosmos/bank/v1beta1/balances/${normalizeAccountAddress(account)}`),
    ),
  );
  const items = accounts.map((account, index) => {
    const address = normalizeAccountAddress(account) ?? 'Unavailable';
    const baseAccount = normalizeBaseAccount(account);
    const rawType = typeof (account as { '@type'?: unknown })['@type'] === 'string' ? ((account as { '@type': string })['@type'] as string) : null;
    const balances = balanceResults[index]?.status === 'fulfilled' ? (balanceResults[index].value.balances ?? []) : [];

    return {
      address,
      addressLabel: formatCompactHash(address, 14, 10),
      sequence: baseAccount.sequence,
      sequenceLabel: formatInteger(baseAccount.sequence, '0'),
      accountNumber: baseAccount.accountNumber,
      accountNumberLabel: formatInteger(baseAccount.accountNumber, '0'),
      type: formatCosmosAccountType(account, rawType),
      balances,
      balancesLabel: formatDenomCollection(balances),
      readableBalancesLabel: formatReadableDenomCollection(balances),
      rawJson: account,
    } satisfies CosmosAccountsPageItem;
  });
  const topAccount = items[0]?.accountNumberLabel ?? 'Unavailable';
  const bottomAccount = items[items.length - 1]?.accountNumberLabel ?? 'Unavailable';

  return {
    page: normalizedPage,
    pageSize: limit,
    totalAccounts,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    totalLabel: totalAccounts ? `${formatInteger(totalAccounts)} accounts` : 'No accounts returned',
    summary: [
      {
        label: 'Total Accounts',
        value: formatInteger(totalAccounts, '0'),
        note: `Count returned by ${profile.name}.`,
      },
      {
        label: 'Current Page',
        value: String(normalizedPage),
        note: `Showing page ${normalizedPage} of ${totalPages}.`,
      },
      {
        label: 'Page Size',
        value: String(limit),
        note: 'Accounts loaded per page.',
      },
      {
        label: 'Account Range',
        value: topAccount === 'Unavailable' ? 'Unavailable' : `#${topAccount} - #${bottomAccount}`,
        note: `Loaded ${items.length} accounts on this page.`,
      },
    ],
    accounts: items,
  };
}

export async function getCosmosAccountDetailDirect(input: { address: string; txPage?: number; txPageSize?: number }) {
  const profile = getActiveCosmosProvider();
  const address = input.address.trim();
  const requestedTxPage = Math.max(1, Math.trunc(input.txPage ?? 1));
  const txPageSize = Math.max(1, Math.trunc(input.txPageSize ?? 10));
  const txQuery = `message.sender='${address}'`;
  const [balancesPayload, accountPayload, delegationsPayload, txSearchPayload] = await Promise.all([
    fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(`${profile.restUrl}/cosmos/bank/v1beta1/balances/${address}`),
    fetchJson<{ account?: unknown }>(`${profile.restUrl}/cosmos/auth/v1beta1/accounts/${address}`).catch(() => ({
      account: null,
    })),
    fetchJson<CosmosDelegationsResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=200&pagination.count_total=true`).catch(() => ({
      delegation_responses: [],
      pagination: { total: '0' },
    })),
    getTxSearchWithQueryDirect(profile, txQuery, requestedTxPage, txPageSize).catch(() => ({
      result: {
        total_count: '0',
        txs: [],
      },
    })),
  ]);
  const baseAccount = normalizeBaseAccount(accountPayload.account);
  const rawType =
    typeof (accountPayload.account as { '@type'?: unknown } | null)?.['@type'] === 'string' ? ((accountPayload.account as { '@type': string })['@type'] as string) : null;
  const balances = balancesPayload.balances ?? [];
  const totalTransactions = Number.parseInt(txSearchPayload.result?.total_count ?? '0', 10) || 0;
  const txTotalPages = Math.max(1, Math.ceil(Math.max(totalTransactions, 1) / txPageSize));
  const txPage = Math.min(requestedTxPage, txTotalPages);
  const effectiveTxSearchPayload =
    txPage === requestedTxPage
      ? txSearchPayload
      : await getTxSearchWithQueryDirect(profile, txQuery, txPage, txPageSize).catch(() => ({
          result: {
            total_count: '0',
            txs: [],
          },
        }));
  const txs = effectiveTxSearchPayload.result?.txs ?? [];
  const txHeights = txs.map((tx) => tx.height ?? '').filter(Boolean);
  const blockTimeByHeight = await getBlockTimestampsByHeights(profile, txHeights);
  const txDetailResults = await Promise.allSettled(
    txs.map((tx) => {
      if (!tx.hash) {
        return Promise.resolve(null);
      }

      return fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`);
    }),
  );
  const transactions = txs.map((tx, index) =>
    formatCosmosTransactionsPageItem({
      tx,
      detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
      timestamp: blockTimeByHeight.get(tx.height ?? '') ?? null,
    }),
  );
  const restValidatorsPayload = await getRestValidatorsDirect(profile).catch(() => ({
    validators: [],
    pagination: { total: '0' },
  }));
  const monikerByOperatorAddress = new Map(
    (restValidatorsPayload.validators ?? []).map((validator) => [validator.operator_address ?? '', validator.description?.moniker ?? 'Unknown']),
  );
  const delegations = (delegationsPayload.delegation_responses ?? []).map((item) => {
    const validatorAddress = item.delegation?.validator_address ?? 'Unavailable';
    const balanceItem = item.balance?.denom
      ? [
          {
            denom: item.balance.denom,
            amount: item.balance.amount ?? '0',
          },
        ]
      : [];

    return {
      validatorAddress,
      validatorAddressLabel: formatCompactHash(validatorAddress, 14, 10),
      validatorMoniker: monikerByOperatorAddress.get(validatorAddress) ?? null,
      amountLabel: formatReadableDenomCollection(balanceItem),
      sharesLabel: formatDenomAmount(item.delegation?.shares ?? '0'),
      rawJson: item,
    } satisfies CosmosAccountDetailDelegationItem;
  });

  return {
    address,
    addressLabel: formatCompactHash(address, 14, 10),
    type: formatCosmosAccountType(accountPayload.account, rawType),
    sequence: baseAccount.sequence,
    sequenceLabel: formatInteger(baseAccount.sequence, '0'),
    accountNumber: baseAccount.accountNumber,
    accountNumberLabel: formatInteger(baseAccount.accountNumber, '0'),
    balances,
    balancesLabel: formatDenomCollection(balances),
    readableBalancesLabel: formatReadableDenomCollection(balances),
    transactionsPage: {
      page: txPage,
      pageSize: txPageSize,
      totalCount: totalTransactions,
      totalPages: txTotalPages,
      hasPreviousPage: txPage > 1,
      hasNextPage: txPage < txTotalPages,
      items: transactions,
    },
    delegationsCount: Number.parseInt(delegationsPayload.pagination?.total ?? '0', 10) || delegations.length,
    delegations,
    rawJson: {
      account: accountPayload.account,
      balances: balancesPayload,
      delegations: delegationsPayload,
      txDetails: txs.map((tx, index) => ({
        hash: tx.hash ?? 'Unavailable',
        detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
      })),
    },
  } satisfies CosmosAccountDetail;
}

export async function getCosmosAccountSummaryDirect(address: string) {
  const profile = getActiveCosmosProvider();
  const [balancesPayload, accountPayload] = await Promise.all([
    fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(`${profile.restUrl}/cosmos/bank/v1beta1/balances/${address}`),
    fetchJson<{ account?: unknown }>(`${profile.restUrl}/cosmos/auth/v1beta1/accounts/${address}`).catch(() => ({
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

export async function getCosmosValidatorsDirect(requestedPage = 1, pageSize = 50) {
  const profile = getActiveCosmosProvider();
  const page = Math.max(1, Math.trunc(requestedPage));
  const limit = Math.max(1, Math.trunc(pageSize));
  const offset = (page - 1) * limit;
  const [payload, poolPayload, overview] = await Promise.all([
    fetchJson<CosmosValidatorsResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/validators?pagination.count_total=true&pagination.offset=${offset}&pagination.limit=${limit}`),
    fetchJson<CosmosPoolResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/pool`).catch(() => ({
      pool: {
        bonded_tokens: '0',
        not_bonded_tokens: '0',
      },
    })),
    getCosmosOverviewDirect().catch(() => ({
      latestHeight: 'Unavailable',
    })),
  ]);
  const totalValidators = Number.parseInt(payload.pagination?.total ?? '0', 10) || (payload.validators?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalValidators, 1) / limit));
  const normalizedPage = Math.min(page, totalPages);

  if (normalizedPage !== page) {
    return getCosmosValidatorsDirect(normalizedPage, limit);
  }

  const bondedTokenTotal = BigInt(poolPayload.pool?.bonded_tokens ?? '0');
  const validators = (payload.validators ?? [])
    .map((validator) => {
      const accountAddress = deriveCosmosAccountAddressFromValidator(validator.operator_address ?? '');

      return {
        moniker: validator.description?.moniker ?? 'Unnamed',
        operatorAddress: validator.operator_address ?? 'Unavailable',
        operatorAddressLabel: formatCompactHash(validator.operator_address ?? 'Unavailable', 14, 10),
        accountAddress,
        accountAddressLabel: accountAddress ? formatCompactHash(accountAddress, 14, 10) : null,
        status: validator.status ?? 'Unknown',
        statusLabel: formatCosmosValidatorStatusLabel(validator.status),
        jailed: Boolean(validator.jailed),
        jailedLabel: validator.jailed ? 'Yes' : 'No',
        tokens: validator.tokens ?? '0',
        tokensLabel: formatReadableTokenAmount(validator.tokens ?? '0'),
        delegatorSharesLabel: formatDenomAmount(validator.delegator_shares ?? '0'),
        votingPowerPercentLabel: formatVotingPowerPercent(validator.tokens, validator.status, validator.jailed, bondedTokenTotal),
        commissionRateLabel: formatCosmosCommissionRate(validator.commission?.commission_rates?.rate),
        website: validator.description?.website ?? null,
        identity: validator.description?.identity ?? null,
        details: validator.description?.details ?? null,
        rawJson: validator,
      } satisfies CosmosValidatorsPageItem;
    })
    .sort((left, right) => {
      const leftPower = Number.parseFloat(left.votingPowerPercentLabel) || 0;
      const rightPower = Number.parseFloat(right.votingPowerPercentLabel) || 0;

      if (leftPower !== rightPower) {
        return rightPower - leftPower;
      }

      return left.moniker.localeCompare(right.moniker);
    });
  const activeCount = validators.filter((validator) => validator.status === 'BOND_STATUS_BONDED' && !validator.jailed).length;
  const jailedCount = validators.filter((validator) => validator.jailed).length;

  return {
    page: normalizedPage,
    pageSize: limit,
    totalValidators,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    totalLabel: totalValidators ? `${formatInteger(totalValidators)} validators` : 'No validators returned',
    summary: [
      {
        label: 'Total Validators',
        value: formatInteger(totalValidators, '0'),
        note: `Count returned by ${profile.name}.`,
      },
      {
        label: 'Bonded',
        value: formatInteger(activeCount, '0'),
        note: 'Validators currently in bonded status on this page.',
      },
      {
        label: 'Jailed',
        value: formatInteger(jailedCount, '0'),
        note: 'Validators flagged as jailed on this page.',
      },
      {
        label: 'Latest Block',
        value: String(overview.latestHeight ?? 'Unavailable'),
        note: 'Current chain height reported by the active provider.',
      },
    ],
    validators,
  };
}

export async function getCosmosValidatorDetailDirect(input: { address: string; txPage?: number; txPageSize?: number }) {
  const profile = getActiveCosmosProvider();
  const address = input.address.trim();
  const requestedTxPage = Math.max(1, Math.trunc(input.txPage ?? 1));
  const txPageSize = Math.max(1, Math.trunc(input.txPageSize ?? 10));

  if (!address) {
    throw new Error('Validator address is required.');
  }

  const [validatorPayload, delegationsPayload, poolPayload] = await Promise.all([
    fetchJson<CosmosValidatorResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/validators/${encodeURIComponent(address)}`),
    fetchJson<CosmosDelegationsResponse>(
      `${profile.restUrl}/cosmos/staking/v1beta1/validators/${encodeURIComponent(address)}/delegations?pagination.limit=200&pagination.count_total=true`,
    ).catch(() => ({
      delegation_responses: [],
      pagination: { total: '0' },
    })),
    fetchJson<CosmosPoolResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/pool`).catch(() => ({
      pool: {
        bonded_tokens: '0',
        not_bonded_tokens: '0',
      },
    })),
  ]);
  const validator = validatorPayload.validator;

  if (!validator?.operator_address) {
    throw new Error('Failed to load Cosmos validator.');
  }

  const accountAddress = deriveCosmosAccountAddressFromValidator(validator.operator_address);
  const txQueryAddress = accountAddress ?? validator.operator_address;
  const txQuery = `message.sender='${txQueryAddress}'`;
  const txSearchPayload = await getTxSearchWithQueryDirect(profile, txQuery, requestedTxPage, txPageSize).catch(() => ({
    result: {
      total_count: '0',
      txs: [],
    },
  }));
  const totalTransactions = Number.parseInt(txSearchPayload.result?.total_count ?? '0', 10) || 0;
  const txTotalPages = Math.max(1, Math.ceil(Math.max(totalTransactions, 1) / txPageSize));
  const txPage = Math.min(requestedTxPage, txTotalPages);
  const effectiveTxSearchPayload =
    txPage === requestedTxPage
      ? txSearchPayload
      : await getTxSearchWithQueryDirect(profile, txQuery, txPage, txPageSize).catch(() => ({
          result: {
            total_count: '0',
            txs: [],
          },
        }));
  const txs = effectiveTxSearchPayload.result?.txs ?? [];
  const txHeights = txs.map((tx) => tx.height ?? '').filter(Boolean);
  const blockTimeByHeight = await getBlockTimestampsByHeights(profile, txHeights);
  const txDetailResults = await Promise.allSettled(
    txs.map((tx) => {
      if (!tx.hash) {
        return Promise.resolve(null);
      }

      return fetchJson<CosmosRestTxResponse>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${tx.hash}`);
    }),
  );
  const transactions = txs.map((tx, index) =>
    formatCosmosTransactionsPageItem({
      tx,
      detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
      timestamp: blockTimeByHeight.get(tx.height ?? '') ?? null,
    }),
  );
  const [balancesPayload, stakeRewardsPayload, commissionRewardsPayload, outstandingRewardsPayload] = await Promise.all([
    accountAddress
      ? fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(`${profile.restUrl}/cosmos/bank/v1beta1/balances/${accountAddress}`).catch(() => null)
      : null,
    accountAddress
      ? fetchJson<CosmosValidatorDelegatorRewardsResponse>(
          `${profile.restUrl}/cosmos/distribution/v1beta1/delegators/${encodeURIComponent(accountAddress)}/rewards/${encodeURIComponent(validator.operator_address)}`,
        ).catch(() => null)
      : Promise.resolve(null),
    fetchJson<CosmosValidatorCommissionResponse>(`${profile.restUrl}/cosmos/distribution/v1beta1/validators/${encodeURIComponent(validator.operator_address)}/commission`).catch(
      () => null,
    ),
    fetchJson<CosmosValidatorOutstandingRewardsResponse>(
      `${profile.restUrl}/cosmos/distribution/v1beta1/validators/${encodeURIComponent(validator.operator_address)}/outstanding_rewards`,
    ).catch(() => null),
  ]);
  const validatorDelegations = delegationsPayload.delegation_responses ?? [];
  const delegations = validatorDelegations.map((item) => {
    const delegatorAddress = item.delegation?.delegator_address ?? 'Unavailable';
    const balanceItem = item.balance?.denom
      ? [
          {
            denom: item.balance.denom,
            amount: item.balance.amount ?? '0',
          },
        ]
      : [];
    const isSelfBond = accountAddress != null && delegatorAddress === accountAddress;

    return {
      delegatorAddress,
      delegatorAddressLabel: formatCompactHash(delegatorAddress, 14, 10),
      amountLabel: formatReadableDenomCollection(balanceItem),
      sharesLabel: formatDenomAmount(item.delegation?.shares ?? '0'),
      kindLabel: isSelfBond ? 'Self Bond' : 'Delegation',
      rawJson: item,
    } satisfies CosmosValidatorDetailDelegationItem;
  });
  const selfBondEntry = validatorDelegations.find((item) => item.delegation?.delegator_address === accountAddress);
  const selfBondAmount = selfBondEntry?.balance?.denom
    ? formatReadableDenomCollection([
        {
          denom: selfBondEntry.balance.denom,
          amount: selfBondEntry.balance.amount ?? '0',
        },
      ])
    : '0';
  const bondedTokenTotal = BigInt(poolPayload.pool?.bonded_tokens ?? '0');
  const accountBalances = balancesPayload?.balances ?? [];

  return {
    moniker: validator.description?.moniker ?? 'Unnamed',
    operatorAddress: validator.operator_address,
    operatorAddressLabel: formatCompactHash(validator.operator_address, 14, 10),
    accountAddress,
    accountAddressLabel: accountAddress ? formatCompactHash(accountAddress, 14, 10) : null,
    consensusPubkey: validator.consensus_pubkey?.key ?? null,
    status: validator.status ?? 'Unknown',
    statusLabel: formatCosmosValidatorStatusLabel(validator.status),
    jailed: Boolean(validator.jailed),
    jailedLabel: validator.jailed ? 'Yes' : 'No',
    tokensLabel: formatReadableTokenAmount(validator.tokens ?? '0'),
    delegatorSharesLabel: formatDenomAmount(validator.delegator_shares ?? '0'),
    votingPowerPercentLabel: formatVotingPowerPercent(validator.tokens, validator.status, validator.jailed, bondedTokenTotal),
    commissionRateLabel: formatCosmosCommissionRate(validator.commission?.commission_rates?.rate),
    minSelfDelegationLabel: formatDenomAmount(validator.min_self_delegation ?? '0'),
    selfBondLabel: selfBondAmount,
    accountBalances,
    accountBalancesLabel: formatDenomCollection(accountBalances, accountBalances.length),
    accountReadableBalancesLabel: formatReadableDenomCollection(accountBalances, accountBalances.length),
    stakeRewardsLabel: formatReadableDecCoinCollection(stakeRewardsPayload?.rewards),
    commissionRewardsLabel: formatReadableDecCoinCollection(commissionRewardsPayload?.commission?.commission),
    outstandingRewardsLabel: formatReadableDecCoinCollection(outstandingRewardsPayload?.rewards?.rewards),
    identity: validator.description?.identity ?? null,
    website: validator.description?.website ?? null,
    securityContact: validator.description?.security_contact ?? null,
    details: validator.description?.details ?? null,
    unbondingHeightLabel: validator.unbonding_height && validator.unbonding_height !== '0' ? formatInteger(validator.unbonding_height) : null,
    unbondingTime: 'unbonding_time' in validator ? (validator.unbonding_time ?? null) : null,
    transactionsPage: {
      page: txPage,
      pageSize: txPageSize,
      totalCount: totalTransactions,
      totalPages: txTotalPages,
      hasPreviousPage: txPage > 1,
      hasNextPage: txPage < txTotalPages,
      items: transactions,
    },
    delegationsCount: Number.parseInt(delegationsPayload.pagination?.total ?? '0', 10) || delegations.length,
    delegations,
    rawJson: {
      validator,
      delegations: delegationsPayload,
      balances: balancesPayload,
      stakeRewards: stakeRewardsPayload,
      commissionRewards: commissionRewardsPayload,
      outstandingRewards: outstandingRewardsPayload,
      txSearch: effectiveTxSearchPayload,
      txDetails: txs.map((tx, index) => ({
        hash: tx.hash ?? 'Unavailable',
        detail: txDetailResults[index]?.status === 'fulfilled' ? txDetailResults[index].value : null,
      })),
    },
  } satisfies CosmosValidatorDetail;
}

export async function getCosmosProposalsDirect(requestedPage = 1, pageSize = 15): Promise<CosmosProposalsPage> {
  const profile = getActiveCosmosProvider();
  const page = Math.max(1, Math.trunc(requestedPage));
  const limit = Math.max(1, Math.trunc(pageSize));
  const offset = (page - 1) * limit;
  const payload = await fetchJson<CosmosGovProposalsResponse>(
    `${profile.restUrl}/cosmos/gov/v1/proposals?pagination.count_total=true&pagination.offset=${offset}&pagination.limit=${limit}`,
  );
  const totalProposals = Number.parseInt(payload.pagination?.total ?? '0', 10) || (payload.proposals?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalProposals, 1) / limit));
  const normalizedPage = Math.min(page, totalPages);

  if (normalizedPage !== page) {
    return getCosmosProposalsDirect(normalizedPage, limit);
  }

  const proposals = payload.proposals ?? [];
  const tallyResponses = await Promise.allSettled(
    proposals.map((proposal) => {
      const id = proposal.id ?? proposal.proposal_id;

      if (!id) {
        return Promise.resolve(null);
      }

      return fetchJson<CosmosGovProposalTallyResponse>(`${profile.restUrl}/cosmos/gov/v1/proposals/${id}/tally`);
    }),
  );

  return {
    page: normalizedPage,
    pageSize: limit,
    totalProposals,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
    totalLabel: totalProposals ? `${formatInteger(totalProposals)} proposals` : 'No proposals returned',
    proposals: proposals
      .map((proposal, index) => {
        const id = proposal.id ?? proposal.proposal_id ?? 'Unavailable';
        const tallyResponse = tallyResponses[index]?.status === 'fulfilled' ? tallyResponses[index].value : null;
        const tally = tallyResponse?.tally ?? proposal.final_tally_result;

        return {
          id,
          title: extractCosmosProposalTitle(proposal),
          typeLabel: extractCosmosProposalType(proposal),
          submitTime: proposal.submit_time ?? null,
          submitTimeLabel: formatLocalTimestamp(proposal.submit_time),
          depositEndTime: proposal.deposit_end_time ?? null,
          depositEndTimeLabel: formatLocalTimestamp(proposal.deposit_end_time),
          votingStartTime: proposal.voting_start_time ?? null,
          votingStartTimeLabel: formatLocalTimestamp(proposal.voting_start_time),
          votingEndTime: proposal.voting_end_time ?? null,
          votingEndTimeLabel: formatLocalTimestamp(proposal.voting_end_time),
          totalDepositLabel: formatReadableDenomCollection(proposal.total_deposit),
          tallyLabel: formatCosmosProposalTallyLabel(tally),
          status: proposal.status ?? 'Unknown',
          statusLabel: formatCosmosProposalStatusLabel(proposal.status),
          rawJson: {
            proposal,
            tally: tallyResponse,
          },
        } satisfies CosmosProposalPageItem;
      })
      .sort((left, right) => {
        const leftId = Number.parseInt(left.id, 10);
        const rightId = Number.parseInt(right.id, 10);

        if (Number.isFinite(leftId) && Number.isFinite(rightId)) {
          return rightId - leftId;
        }

        return right.id.localeCompare(left.id);
      }),
  };
}

export async function getCosmosProposalByIdDirect(id: string, requestedVotePage = 1, votePageSize = 20): Promise<CosmosProposalDetail> {
  const profile = getActiveCosmosProvider();
  const proposalId = id.trim();

  if (!proposalId) {
    throw new Error('Proposal id is required.');
  }

  const votePage = Math.max(1, Math.trunc(requestedVotePage));
  const limit = Math.max(1, Math.trunc(votePageSize));
  const offset = (votePage - 1) * limit;
  const [proposalPayload, tallyPayload, votesPayload] = await Promise.all([
    fetchJson<CosmosGovProposalResponse>(`${profile.restUrl}/cosmos/gov/v1/proposals/${encodeURIComponent(proposalId)}`),
    fetchJson<CosmosGovProposalTallyResponse>(`${profile.restUrl}/cosmos/gov/v1/proposals/${encodeURIComponent(proposalId)}/tally`).catch(() => null),
    fetchJson<CosmosGovProposalVotesResponse>(
      `${profile.restUrl}/cosmos/gov/v1/proposals/${encodeURIComponent(proposalId)}/votes?pagination.count_total=true&pagination.offset=${offset}&pagination.limit=${limit}`,
    ).catch(() => ({
      votes: [],
      pagination: { total: '0' },
    })),
  ]);
  const proposal = proposalPayload.proposal;

  if (!proposal) {
    throw new Error('Failed to load Cosmos proposal.');
  }

  const totalVotes = Number.parseInt(votesPayload.pagination?.total ?? '0', 10) || (votesPayload.votes?.length ?? 0);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalVotes, 1) / limit));
  const page = Math.min(votePage, totalPages);
  const effectiveVotesPayload =
    page === votePage
      ? votesPayload
      : await fetchJson<CosmosGovProposalVotesResponse>(
          `${profile.restUrl}/cosmos/gov/v1/proposals/${encodeURIComponent(proposalId)}/votes?pagination.count_total=true&pagination.offset=${(page - 1) * limit}&pagination.limit=${limit}`,
        ).catch(() => ({
          votes: [],
          pagination: { total: '0' },
        }));

  return {
    id: proposal.id ?? proposal.proposal_id ?? proposalId,
    title: extractCosmosProposalTitle(proposal),
    summary: proposal.summary?.trim() || '-',
    metadataLabel: proposal.metadata?.trim() || '-',
    typeLabel: extractCosmosProposalType(proposal),
    status: proposal.status ?? 'Unknown',
    statusLabel: formatCosmosProposalStatusLabel(proposal.status),
    submitTime: proposal.submit_time ?? null,
    submitTimeLabel: formatLocalTimestamp(proposal.submit_time),
    depositEndTime: proposal.deposit_end_time ?? null,
    depositEndTimeLabel: formatLocalTimestamp(proposal.deposit_end_time),
    votingStartTime: proposal.voting_start_time ?? null,
    votingStartTimeLabel: formatLocalTimestamp(proposal.voting_start_time),
    votingEndTime: proposal.voting_end_time ?? null,
    votingEndTimeLabel: formatLocalTimestamp(proposal.voting_end_time),
    totalDepositLabel: formatReadableDenomCollection(proposal.total_deposit),
    tallyLabel: formatCosmosProposalTallyLabel(tallyPayload?.tally ?? proposal.final_tally_result),
    votesPage: {
      page,
      pageSize: limit,
      totalCount: totalVotes,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
      items: (effectiveVotesPayload.votes ?? []).map((vote) => {
        const voter = vote.voter ?? 'Unavailable';
        const optionLabel = vote.options?.length
          ? vote.options
              .map((item) => {
                const label = formatCosmosProposalVoteOptionLabel(item.option);
                return item.weight?.trim() ? `${label} (${formatDenomAmount(item.weight)})` : label;
              })
              .join(', ')
          : formatCosmosProposalVoteOptionLabel(vote.option);

        return {
          voter,
          voterLabel: formatCompactHash(voter, 14, 10),
          optionLabel,
          rawJson: vote,
        } satisfies CosmosProposalDetailVoteItem;
      }),
    },
    rawJson: {
      proposal,
      tally: tallyPayload,
      votes: effectiveVotesPayload,
    },
  } satisfies CosmosProposalDetail;
}

export async function getCosmosHomeSnapshotDirect(blockLimit = 6, txLimit = 6): Promise<CosmosHomeSnapshot> {
  const profile = getActiveCosmosProvider();
  const [
    statusPayload,
    netInfoPayload,
    unconfirmedPayload,
    txSearchPayload,
    restValidatorsPayload,
    proposalsPayload,
    poolPayload,
    communityPoolPayload,
    supplyPayload,
  ] = await Promise.all([
    getStatusDirect(profile),
    getNetInfoDirect(profile).catch(() => ({ result: { n_peers: '0' } })),
    getUnconfirmedTxsDirect(profile).catch(() => ({
      result: { n_txs: '0', total: '0' },
    })),
    getTxSearchDirect(profile, txLimit).catch(() => ({ result: { total_count: '0', txs: [] } })),
    getRestValidatorsDirect(profile).catch(() => ({ validators: [], pagination: { total: '0' } })),
    fetchJson<CosmosGovProposalsResponse>(`${profile.restUrl}/cosmos/gov/v1/proposals?pagination.count_total=true&pagination.limit=1`).catch(() => ({
      proposals: [],
      pagination: { total: '0' },
    })),
    fetchJson<CosmosPoolResponse>(`${profile.restUrl}/cosmos/staking/v1beta1/pool`).catch(() => ({ pool: { bonded_tokens: '0', not_bonded_tokens: '0' } })),
    fetchJson<CosmosCommunityPoolResponse>(`${profile.restUrl}/cosmos/distribution/v1beta1/community_pool`).catch(() => ({ pool: [] })),
    fetchJson<CosmosSupplyResponse>(`${profile.restUrl}/cosmos/bank/v1beta1/supply`).catch(() => ({ supply: [] })),
  ]);
  const latestHeight = Number(statusPayload.result?.sync_info?.latest_block_height ?? 0);
  const [blockchainPayload, rpcValidatorsPayload] = await Promise.all([
    getBlockchainDirect(profile, latestHeight, Math.max(blockLimit, 10)).catch(() => ({ result: { block_metas: [] } })),
    getRpcValidatorsDirect(profile, latestHeight).catch(() => ({
      result: { validators: [] },
    })),
  ]);
  const blockMetas = [...(blockchainPayload.result?.block_metas ?? [])].sort((left, right) => Number(right.header?.height ?? 0) - Number(left.header?.height ?? 0));
  const monikerByPubKey = new Map(
    (restValidatorsPayload.validators ?? []).map((validator) => [validator.consensus_pubkey?.key ?? '', validator.description?.moniker ?? 'Unknown']),
  );
  const operatorAddressByPubKey = new Map((restValidatorsPayload.validators ?? []).map((validator) => [validator.consensus_pubkey?.key ?? '', validator.operator_address ?? '']));
  const proposerMonikerByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [validator.address ?? '', monikerByPubKey.get(validator.pub_key?.value ?? '') ?? 'Unknown']),
  );
  const proposerOperatorAddressByAddress = new Map(
    (rpcValidatorsPayload.result?.validators ?? []).map((validator) => [validator.address ?? '', operatorAddressByPubKey.get(validator.pub_key?.value ?? '') ?? '']),
  );
  const blocks: CosmosHomeBlockItem[] = blockMetas.slice(0, blockLimit).map((block) => {
    const height = block.header?.height ?? '0';
    const timestamp = block.header?.time;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : null;
    const proposer = block.header?.proposer_address ?? 'Unknown';
    const proposerMoniker = proposerMonikerByAddress.get(proposer) ?? statusPayload.result?.node_info?.moniker ?? proposer;

    return {
      height,
      hash: block.block_id?.hash ?? 'Unavailable',
      hashLabel: formatCompactHash(block.block_id?.hash ?? 'Unavailable'),
      proposer,
      proposerOperatorAddress: proposerOperatorAddressByAddress.get(proposer) ?? null,
      proposerLabel: proposerMoniker && proposerMoniker !== 'Unknown' ? proposerMoniker : formatCompactHash(proposer, 10, 6),
      txCount: formatInteger(block.num_txs ?? '0', '0'),
      blockSizeLabel: formatCosmosGasLabel(null),
      timeLabel: formatLocalTimestamp(timestamp),
      timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
    };
  });
  const blockTimeByHeight = new Map(blockMetas.map((block) => [block.header?.height ?? '', block.header?.time ?? null]));
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

  const averageBlockTime = calculateAverageBlockTime(blocks);

  return {
    header: {
      connection: profile.wsUrl ? 'RPC + WebSocket' : 'RPC Polling',
      providerName: profile.name,
      chainId: statusPayload.result?.node_info?.network ?? 'Unavailable',
      latestBlockTime: formatLocalTimestamp(statusPayload.result?.sync_info?.latest_block_time),
    },
    metrics: [
      {
        label: 'Moniker',
        value: statusPayload.result?.node_info?.moniker ?? profile.name ?? 'Unavailable',
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
        value: formatInteger(unconfirmedPayload.result?.n_txs ?? unconfirmedPayload.result?.total, '0'),
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
        label: 'Proposals',
        value: formatInteger(proposalsPayload.pagination?.total ?? String(proposalsPayload.proposals?.length ?? 0), '0'),
      },
      {
        label: 'Bonded Tokens',
        value: formatReadableTokenAmount(poolPayload.pool?.bonded_tokens ?? '0'),
      },
      {
        label: 'Not Bonded Tokens',
        value: formatReadableTokenAmount(poolPayload.pool?.not_bonded_tokens ?? '0'),
      },
      {
        label: 'Community Pool',
        value: formatReadableDecCoinCollection(communityPoolPayload.pool),
      },
      {
        label: 'Bank Supply',
        value: formatReadableDenomCollection(supplyPayload.supply),
      },
    ],
    activity: {
      blocks,
      transactions: latestTransactions.slice(0, txLimit),
    },
    latestHeight,
    refreshedAt: Date.now(),
  };
}

export async function requestCosmosRpcDirect(input: { endpoint: string; method: string; payload?: unknown; useRpc?: boolean }) {
  const profile = getActiveCosmosProvider();
  const baseUrl = input.useRpc ? profile.rpcUrl : profile.restUrl;
  const target = input.endpoint.startsWith('http') ? input.endpoint : `${baseUrl}${input.endpoint}`;
  const response = await fetch(target, {
    method: input.method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: input.method === 'GET' ? undefined : input.payload ? JSON.stringify(input.payload) : undefined,
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
