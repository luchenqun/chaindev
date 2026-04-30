'use client';

import 'client-only';

import { DirectEthSecp256k1Wallet, DirectSecp256k1Wallet, Registry, type EncodeObject } from '@cosmjs/proto-signing';
import { defaultRegistryTypes, GasPrice, SigningStargateClient } from '@cosmjs/stargate';
import { MsgWithdrawValidatorCommission } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1/gov';
import { MsgDeposit, MsgSubmitProposal, MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';

type TendermintStatusResponse = {
  result?: {
    node_info?: {
      network?: string;
    };
  };
};

type CosmosBech32PrefixResponse = {
  bech32_prefix?: string;
  bech32Prefix?: string;
};

export type CosmosBaseSigningInput = {
  privateKey: string;
  accountPrefix: string;
  signingAlgorithm: CosmosSigningAlgorithm;
  gasPrice: string;
  memo?: string;
};

export type CosmosSigningInput = CosmosBaseSigningInput & {
  validatorAddress: string;
};

export type CosmosDelegateInput = CosmosSigningInput & {
  amount: string;
  denom: string;
};

export type CosmosRewardWithdrawalInput = CosmosSigningInput;
export type CosmosProposalVoteOption = 'yes' | 'abstain' | 'no' | 'no_with_veto';
export type CosmosProposalVoteInput = CosmosBaseSigningInput & {
  proposalId: string;
  option: CosmosProposalVoteOption;
  metadata?: string;
};
export type CosmosProposalDepositInput = CosmosBaseSigningInput & {
  proposalId: string;
  amount: string;
  denom: string;
};
export type CosmosSubmitGovProposalInput = CosmosBaseSigningInput & {
  title: string;
  summary: string;
  metadata?: string;
  messagesJson: string;
  depositAmount: string;
  depositDenom: string;
};

export type NormalizedCosmosDelegateInput = Required<CosmosDelegateInput>;
export type NormalizedCosmosBaseSigningInput = Required<CosmosBaseSigningInput>;
export type NormalizedCosmosSigningInput = Required<CosmosSigningInput>;
export type NormalizedCosmosProposalVoteInput = Required<CosmosProposalVoteInput>;
export type NormalizedCosmosProposalDepositInput = Required<CosmosProposalDepositInput>;
export type NormalizedCosmosSubmitGovProposalInput = Required<CosmosSubmitGovProposalInput>;

export type CosmosSigningAlgorithm = 'ethsecp256k1' | 'secp256k1';

export type CosmosDelegateResult = {
  delegatorAddress: string;
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
};

function assertPresent(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
}

function normalizeRequiredText(value: string | undefined) {
  return (value ?? '').trim();
}

function normalizePrivateKey(privateKey: string) {
  const value = privateKey.trim().replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Private key must be a 32-byte hex value.');
  }

  const bytes = new Uint8Array(32);

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return bytes;
}

function normalizeCosmosBaseSigningInput(input: CosmosBaseSigningInput): NormalizedCosmosBaseSigningInput {
  const privateKey = normalizeRequiredText(input.privateKey);
  const accountPrefix = normalizeRequiredText(input.accountPrefix);
  const signingAlgorithm = input.signingAlgorithm;
  const gasPrice = normalizeRequiredText(input.gasPrice);
  const memo = normalizeRequiredText(input.memo);

  assertPresent(privateKey, 'Private key');
  assertPresent(accountPrefix, 'Account prefix');
  assertPresent(signingAlgorithm, 'Signing algorithm');
  assertPresent(gasPrice, 'Gas price');

  if (signingAlgorithm !== 'ethsecp256k1' && signingAlgorithm !== 'secp256k1') {
    throw new Error('Unsupported signing algorithm.');
  }

  try {
    GasPrice.fromString(gasPrice);
  } catch {
    throw new Error('Gas price must look like 0.025uatom.');
  }

  return {
    privateKey,
    accountPrefix,
    signingAlgorithm,
    gasPrice,
    memo,
  };
}

export function getCosmosAccountPrefixFromValidatorAddress(validatorAddress: string) {
  const value = validatorAddress.trim();
  const markerIndex = value.indexOf('valoper');

  if (markerIndex <= 0) {
    return 'cosmos';
  }

  return value.slice(0, markerIndex);
}

export async function getActiveCosmosAccountPrefixDirect() {
  const profile = getActiveCosmosProvider();

  try {
    const response = await fetch(`${profile.restUrl}/cosmos/auth/v1beta1/bech32`, { cache: 'no-store' });

    if (!response.ok) {
      return 'cosmos';
    }

    const payload = (await response.json()) as CosmosBech32PrefixResponse;
    const prefix = (payload.bech32_prefix ?? payload.bech32Prefix ?? '').trim();

    return prefix || 'cosmos';
  } catch {
    return 'cosmos';
  }
}

export function normalizeCosmosSigningInput(input: CosmosSigningInput): NormalizedCosmosSigningInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const validatorAddress = normalizeRequiredText(input.validatorAddress);

  assertPresent(validatorAddress, 'Validator address');

  return {
    ...normalized,
    validatorAddress,
  };
}

export function normalizeCosmosDelegateInput(input: CosmosDelegateInput): NormalizedCosmosDelegateInput {
  const normalized = normalizeCosmosSigningInput(input);
  const amount = normalizeRequiredText(input.amount);
  const denom = normalizeRequiredText(input.denom);

  assertPresent(amount, 'Amount');
  assertPresent(denom, 'Denom');

  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error('Amount must be a whole-number base unit amount.');
  }

  if (/\s/.test(denom)) {
    throw new Error('Denom cannot contain whitespace.');
  }

  return {
    ...normalized,
    amount,
    denom,
  };
}

function normalizeCosmosProposalVoteInput(input: CosmosProposalVoteInput): NormalizedCosmosProposalVoteInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const proposalId = normalizeRequiredText(input.proposalId);
  const option = input.option;
  const metadata = normalizeRequiredText(input.metadata);

  assertPresent(proposalId, 'Proposal id');
  assertPresent(option, 'Vote option');

  if (!/^[1-9]\d*$/.test(proposalId)) {
    throw new Error('Proposal id must be a positive integer.');
  }

  if (!['yes', 'abstain', 'no', 'no_with_veto'].includes(option)) {
    throw new Error('Unsupported vote option.');
  }

  return {
    ...normalized,
    proposalId,
    option,
    metadata,
  };
}

function normalizeCosmosProposalDepositInput(input: CosmosProposalDepositInput): NormalizedCosmosProposalDepositInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const proposalId = normalizeRequiredText(input.proposalId);
  const amount = normalizeRequiredText(input.amount);
  const denom = normalizeRequiredText(input.denom);

  assertPresent(proposalId, 'Proposal id');
  assertPresent(amount, 'Deposit amount');
  assertPresent(denom, 'Deposit denom');

  if (!/^[1-9]\d*$/.test(proposalId)) {
    throw new Error('Proposal id must be a positive integer.');
  }

  if (!/^[1-9]\d*$/.test(amount)) {
    throw new Error('Deposit amount must be a whole-number base unit amount.');
  }

  if (/\s/.test(denom)) {
    throw new Error('Deposit denom cannot contain whitespace.');
  }

  return {
    ...normalized,
    proposalId,
    amount,
    denom,
  };
}

function normalizeCosmosSubmitGovProposalInput(input: CosmosSubmitGovProposalInput): NormalizedCosmosSubmitGovProposalInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const title = normalizeRequiredText(input.title);
  const summary = normalizeRequiredText(input.summary);
  const metadata = normalizeRequiredText(input.metadata);
  const messagesJson = normalizeRequiredText(input.messagesJson);
  const depositAmount = normalizeRequiredText(input.depositAmount);
  const depositDenom = normalizeRequiredText(input.depositDenom);

  assertPresent(title, 'Title');
  assertPresent(summary, 'Summary');
  assertPresent(messagesJson, 'Messages JSON');
  assertPresent(depositAmount, 'Deposit amount');
  assertPresent(depositDenom, 'Deposit denom');

  if (!/^[1-9]\d*$/.test(depositAmount)) {
    throw new Error('Deposit amount must be a whole-number base unit amount.');
  }

  if (/\s/.test(depositDenom)) {
    throw new Error('Deposit denom cannot contain whitespace.');
  }

  return {
    ...normalized,
    title,
    summary,
    metadata,
    messagesJson,
    depositAmount,
    depositDenom,
  };
}

function parseCosmosProposalMessages(messagesJson: string): EncodeObject[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(messagesJson);
  } catch {
    throw new Error('Messages JSON must be valid JSON.');
  }

  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error('Messages JSON must be a non-empty array.');
  }

  return parsed.map((message, index) => {
    if (!message || typeof message !== 'object') {
      throw new Error(`Message #${index + 1} must be an object.`);
    }

    const candidate = message as { typeUrl?: unknown; value?: unknown };

    if (typeof candidate.typeUrl !== 'string' || !candidate.typeUrl.trim()) {
      throw new Error(`Message #${index + 1} is missing typeUrl.`);
    }

    if (!candidate.value || typeof candidate.value !== 'object') {
      throw new Error(`Message #${index + 1} is missing value.`);
    }

    return {
      typeUrl: candidate.typeUrl.trim(),
      value: candidate.value,
    };
  });
}

function toCosmosGovVoteOption(option: CosmosProposalVoteOption) {
  switch (option) {
    case 'yes':
      return VoteOption.VOTE_OPTION_YES;
    case 'abstain':
      return VoteOption.VOTE_OPTION_ABSTAIN;
    case 'no':
      return VoteOption.VOTE_OPTION_NO;
    case 'no_with_veto':
      return VoteOption.VOTE_OPTION_NO_WITH_VETO;
  }
}

async function getCosmosChainId(rpcUrl: string) {
  const response = await fetch(`${rpcUrl}/status`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to read chain id: ${response.status}`);
  }

  const payload = (await response.json()) as TendermintStatusResponse;
  const chainId = payload.result?.node_info?.network?.trim();

  if (!chainId) {
    throw new Error('The selected Cosmos RPC did not return a chain id.');
  }

  return chainId;
}

async function createCosmosSigningClient(input: CosmosBaseSigningInput) {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const profile = getActiveCosmosProvider();
  await getCosmosChainId(profile.rpcUrl);

  const privateKeyBytes = normalizePrivateKey(normalized.privateKey);
  const signer =
    normalized.signingAlgorithm === 'ethsecp256k1'
      ? await DirectEthSecp256k1Wallet.fromKey(privateKeyBytes, normalized.accountPrefix)
      : await DirectSecp256k1Wallet.fromKey(privateKeyBytes, normalized.accountPrefix);
  const accounts = await signer.getAccounts();
  const delegatorAddress = accounts[0]?.address;

  if (!delegatorAddress) {
    throw new Error('Failed to derive a Cosmos account from the selected private key.');
  }

  const client = await SigningStargateClient.connectWithSigner(profile.rpcUrl, signer, {
    gasPrice: GasPrice.fromString(normalized.gasPrice),
  });

  return {
    client,
    delegatorAddress,
    normalized,
  };
}

async function createCosmosStakingClient(input: CosmosSigningInput) {
  const normalized = normalizeCosmosSigningInput(input);
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  return {
    client,
    delegatorAddress,
    normalized,
  };
}

export async function delegateCosmosTokens(input: CosmosDelegateInput): Promise<CosmosDelegateResult> {
  const normalized = normalizeCosmosDelegateInput(input);
  const { client, delegatorAddress } = await createCosmosStakingClient(normalized);

  try {
    const result = await client.delegateTokens(
      delegatorAddress,
      normalized.validatorAddress,
      {
        amount: normalized.amount,
        denom: normalized.denom,
      },
      'auto',
      normalized.memo,
    );

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Delegate transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function undelegateCosmosTokens(input: CosmosDelegateInput): Promise<CosmosDelegateResult> {
  const normalized = normalizeCosmosDelegateInput(input);
  const { client, delegatorAddress } = await createCosmosStakingClient(normalized);

  try {
    const result = await client.undelegateTokens(
      delegatorAddress,
      normalized.validatorAddress,
      {
        amount: normalized.amount,
        denom: normalized.denom,
      },
      'auto',
      normalized.memo,
    );

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Undelegate transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function withdrawCosmosDelegatorRewards(input: CosmosRewardWithdrawalInput): Promise<CosmosDelegateResult> {
  const { client, delegatorAddress, normalized } = await createCosmosStakingClient(input);

  try {
    const result = await client.withdrawRewards(delegatorAddress, normalized.validatorAddress, 'auto', normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Withdraw rewards transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function withdrawCosmosValidatorCommission(input: CosmosRewardWithdrawalInput): Promise<CosmosDelegateResult> {
  const { client, delegatorAddress, normalized } = await createCosmosStakingClient(input);

  try {
    const message: EncodeObject = {
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
      value: MsgWithdrawValidatorCommission.fromPartial({
        validatorAddress: normalized.validatorAddress,
      }),
    };
    const result = await client.signAndBroadcast(delegatorAddress, [message], 'auto', normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Withdraw commission transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function voteCosmosProposal(input: CosmosProposalVoteInput): Promise<CosmosDelegateResult> {
  const normalized = normalizeCosmosProposalVoteInput(input);
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  try {
    const message: EncodeObject = {
      typeUrl: '/cosmos.gov.v1.MsgVote',
      value: MsgVote.fromPartial({
        proposalId: BigInt(normalized.proposalId),
        voter: delegatorAddress,
        option: toCosmosGovVoteOption(normalized.option),
        metadata: normalized.metadata,
      }),
    };
    const result = await client.signAndBroadcast(delegatorAddress, [message], 'auto', normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Vote transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function depositCosmosProposal(input: CosmosProposalDepositInput): Promise<CosmosDelegateResult> {
  const normalized = normalizeCosmosProposalDepositInput(input);
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  try {
    const message: EncodeObject = {
      typeUrl: '/cosmos.gov.v1.MsgDeposit',
      value: MsgDeposit.fromPartial({
        proposalId: BigInt(normalized.proposalId),
        depositor: delegatorAddress,
        amount: [
          {
            amount: normalized.amount,
            denom: normalized.denom,
          },
        ],
      }),
    };
    const result = await client.signAndBroadcast(delegatorAddress, [message], 'auto', normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Deposit transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}

export async function submitCosmosGovProposal(input: CosmosSubmitGovProposalInput): Promise<CosmosDelegateResult> {
  const normalized = normalizeCosmosSubmitGovProposalInput(input);
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  try {
    const registry = new Registry(defaultRegistryTypes);
    const proposalMessages = parseCosmosProposalMessages(normalized.messagesJson).map((proposalMessage) => registry.encodeAsAny(proposalMessage));
    const message: EncodeObject = {
      typeUrl: '/cosmos.gov.v1.MsgSubmitProposal',
      value: MsgSubmitProposal.fromPartial({
        messages: proposalMessages,
        initialDeposit: [
          {
            amount: normalized.depositAmount,
            denom: normalized.depositDenom,
          },
        ],
        proposer: delegatorAddress,
        metadata: normalized.metadata,
        title: normalized.title,
        summary: normalized.summary,
        expedited: false,
      }),
    };
    const result = await client.signAndBroadcast(delegatorAddress, [message], 'auto', normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Submit proposal transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
    };
  } finally {
    client.disconnect();
  }
}
