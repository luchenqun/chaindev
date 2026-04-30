'use client';

import 'client-only';

import { DirectEthSecp256k1Wallet, DirectSecp256k1Wallet, Registry, type EncodeObject, type GeneratedType } from '@cosmjs/proto-signing';
import { calculateFee, defaultRegistryTypes, GasPrice, SigningStargateClient, type DeliverTxResponse } from '@cosmjs/stargate';
import { MsgExec, MsgGrant, MsgRevoke } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { MsgMultiSend, MsgSend as BankMsgSend, MsgSetSendEnabled } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import {
  MsgCommunityPoolSpend,
  MsgDepositValidatorRewardsPool,
  MsgFundCommunityPool,
  MsgSetWithdrawAddress,
  MsgWithdrawDelegatorReward,
  MsgWithdrawValidatorCommission,
} from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgSubmitEvidence } from 'cosmjs-types/cosmos/evidence/v1beta1/tx';
import { MsgGrantAllowance, MsgPruneAllowances, MsgRevokeAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx';
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1/gov';
import {
  MsgCancelProposal,
  MsgDeposit as GovV1MsgDeposit,
  MsgExecLegacyContent,
  MsgSubmitProposal as GovV1MsgSubmitProposal,
  MsgVote as GovV1MsgVote,
  MsgVoteWeighted as GovV1MsgVoteWeighted,
} from 'cosmjs-types/cosmos/gov/v1/tx';
import {
  MsgDeposit as GovV1Beta1MsgDeposit,
  MsgSubmitProposal as GovV1Beta1MsgSubmitProposal,
  MsgVote as GovV1Beta1MsgVote,
  MsgVoteWeighted as GovV1Beta1MsgVoteWeighted,
} from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { MsgUnjail } from 'cosmjs-types/cosmos/slashing/v1beta1/tx';
import {
  MsgBeginRedelegate,
  MsgCancelUnbondingDelegation,
  MsgCreateValidator,
  MsgDelegate,
  MsgEditValidator,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgCancelUpgrade, MsgSoftwareUpgrade } from 'cosmjs-types/cosmos/upgrade/v1beta1/tx';
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
  gasLimit?: string;
  memo?: string;
};

export type CosmosSigningInput = CosmosBaseSigningInput & {
  validatorAddress: string;
};

export type CosmosDelegateInput = CosmosSigningInput & {
  amount: string;
  denom: string;
};

export type CosmosSendTokensInput = CosmosBaseSigningInput & {
  recipientAddress: string;
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

export type CosmosGenericMessageInput = CosmosBaseSigningInput & {
  messageTypeUrl: string;
  messageJson: string;
};

export type NormalizedCosmosDelegateInput = Required<CosmosDelegateInput>;
export type NormalizedCosmosSendTokensInput = Required<CosmosSendTokensInput>;
export type NormalizedCosmosBaseSigningInput = Required<CosmosBaseSigningInput>;
export type NormalizedCosmosSigningInput = Required<CosmosSigningInput>;
export type NormalizedCosmosProposalVoteInput = Required<CosmosProposalVoteInput>;
export type NormalizedCosmosProposalDepositInput = Required<CosmosProposalDepositInput>;
export type NormalizedCosmosSubmitGovProposalInput = Required<CosmosSubmitGovProposalInput>;
export type NormalizedCosmosGenericMessageInput = Required<CosmosGenericMessageInput>;

export type CosmosSigningAlgorithm = 'ethsecp256k1' | 'secp256k1';

export type CosmosDelegateResult = {
  delegatorAddress: string;
  transactionHash: string;
  height: number;
  gasUsed: bigint;
  gasWanted: bigint;
  response: DeliverTxResponse;
};

export type CosmosBroadcastResult = CosmosDelegateResult;

type CosmosGeneratedMessageType = {
  typeUrl: string;
  fromJSON(object: unknown): unknown;
};

type CosmosGenericMessageDescriptor = {
  module: string;
  label: string;
  messageType: CosmosGeneratedMessageType;
  template: Record<string, unknown>;
};

export const COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER = '__COSMOS_ADDRESS__';
export const COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER = '__COSMOS_VALIDATOR__';
const COIN_TEMPLATE = { denom: 'uatom', amount: '1' };
const ANY_TEMPLATE = { typeUrl: '', value: '' };

const COSMOS_GENERIC_MESSAGE_DESCRIPTORS: CosmosGenericMessageDescriptor[] = [
  {
    module: 'authz',
    label: 'Authz Grant',
    messageType: MsgGrant,
    template: {
      granter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      grantee: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      grant: {
        authorization: { typeUrl: '/cosmos.bank.v1beta1.SendAuthorization', value: '' },
        expiration: '2026-12-31T00:00:00Z',
      },
    },
  },
  {
    module: 'authz',
    label: 'Authz Exec',
    messageType: MsgExec,
    template: {
      grantee: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      msgs: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: '' }],
    },
  },
  {
    module: 'authz',
    label: 'Authz Revoke',
    messageType: MsgRevoke,
    template: {
      granter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      grantee: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      msgTypeUrl: '/cosmos.bank.v1beta1.MsgSend',
    },
  },
  {
    module: 'bank',
    label: 'Bank Send',
    messageType: BankMsgSend,
    template: {
      fromAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      toAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      amount: [COIN_TEMPLATE],
    },
  },
  {
    module: 'bank',
    label: 'Bank Multi Send',
    messageType: MsgMultiSend,
    template: {
      inputs: [{ address: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER, coins: [COIN_TEMPLATE] }],
      outputs: [{ address: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER, coins: [COIN_TEMPLATE] }],
    },
  },
  {
    module: 'bank',
    label: 'Bank Set Send Enabled',
    messageType: MsgSetSendEnabled,
    template: {
      authority: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      sendEnabled: [{ denom: 'uatom', enabled: true }],
      useDefaultFor: [],
    },
  },
  {
    module: 'distribution',
    label: 'Set Withdraw Address',
    messageType: MsgSetWithdrawAddress,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      withdrawAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'distribution',
    label: 'Withdraw Delegator Reward',
    messageType: MsgWithdrawDelegatorReward,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'distribution',
    label: 'Withdraw Validator Commission',
    messageType: MsgWithdrawValidatorCommission,
    template: {
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'distribution',
    label: 'Fund Community Pool',
    messageType: MsgFundCommunityPool,
    template: {
      amount: [COIN_TEMPLATE],
      depositor: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'distribution',
    label: 'Community Pool Spend',
    messageType: MsgCommunityPoolSpend,
    template: {
      authority: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      recipient: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      amount: [COIN_TEMPLATE],
    },
  },
  {
    module: 'distribution',
    label: 'Deposit Validator Rewards Pool',
    messageType: MsgDepositValidatorRewardsPool,
    template: {
      depositor: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      amount: [COIN_TEMPLATE],
    },
  },
  {
    module: 'evidence',
    label: 'Submit Evidence',
    messageType: MsgSubmitEvidence,
    template: {
      submitter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      evidence: ANY_TEMPLATE,
    },
  },
  {
    module: 'feegrant',
    label: 'Grant Allowance',
    messageType: MsgGrantAllowance,
    template: {
      granter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      grantee: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      allowance: ANY_TEMPLATE,
    },
  },
  {
    module: 'feegrant',
    label: 'Revoke Allowance',
    messageType: MsgRevokeAllowance,
    template: {
      granter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      grantee: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'feegrant',
    label: 'Prune Allowances',
    messageType: MsgPruneAllowances,
    template: {
      pruner: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Submit Proposal',
    messageType: GovV1MsgSubmitProposal,
    template: {
      messages: [ANY_TEMPLATE],
      initialDeposit: [COIN_TEMPLATE],
      proposer: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      metadata: '',
      title: '',
      summary: '',
      expedited: false,
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Exec Legacy Content',
    messageType: MsgExecLegacyContent,
    template: {
      content: ANY_TEMPLATE,
      authority: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Vote',
    messageType: GovV1MsgVote,
    template: {
      proposalId: '1',
      voter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      option: 'VOTE_OPTION_YES',
      metadata: '',
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Vote Weighted',
    messageType: GovV1MsgVoteWeighted,
    template: {
      proposalId: '1',
      voter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      options: [{ option: 'VOTE_OPTION_YES', weight: '1.000000000000000000' }],
      metadata: '',
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Deposit',
    messageType: GovV1MsgDeposit,
    template: {
      proposalId: '1',
      depositor: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      amount: [COIN_TEMPLATE],
    },
  },
  {
    module: 'gov',
    label: 'Gov v1 Cancel Proposal',
    messageType: MsgCancelProposal,
    template: {
      proposalId: '1',
      proposer: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'gov',
    label: 'Gov v1beta1 Submit Proposal',
    messageType: GovV1Beta1MsgSubmitProposal,
    template: {
      content: ANY_TEMPLATE,
      initialDeposit: [COIN_TEMPLATE],
      proposer: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'gov',
    label: 'Gov v1beta1 Vote',
    messageType: GovV1Beta1MsgVote,
    template: {
      proposalId: '1',
      voter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      option: 'VOTE_OPTION_YES',
    },
  },
  {
    module: 'gov',
    label: 'Gov v1beta1 Vote Weighted',
    messageType: GovV1Beta1MsgVoteWeighted,
    template: {
      proposalId: '1',
      voter: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      options: [{ option: 'VOTE_OPTION_YES', weight: '1.000000000000000000' }],
    },
  },
  {
    module: 'gov',
    label: 'Gov v1beta1 Deposit',
    messageType: GovV1Beta1MsgDeposit,
    template: {
      proposalId: '1',
      depositor: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      amount: [COIN_TEMPLATE],
    },
  },
  {
    module: 'slashing',
    label: 'Slashing Unjail',
    messageType: MsgUnjail,
    template: {
      validatorAddr: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
    },
  },
  {
    module: 'staking',
    label: 'Create Validator',
    messageType: MsgCreateValidator,
    template: {
      description: {
        moniker: '',
        identity: '',
        website: '',
        securityContact: '',
        details: '',
      },
      commission: {
        rate: '0.100000000000000000',
        maxRate: '0.200000000000000000',
        maxChangeRate: '0.010000000000000000',
      },
      minSelfDelegation: '1',
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      pubkey: { typeUrl: '/cosmos.crypto.ed25519.PubKey', value: '' },
      value: COIN_TEMPLATE,
    },
  },
  {
    module: 'staking',
    label: 'Edit Validator',
    messageType: MsgEditValidator,
    template: {
      description: {
        moniker: '',
        identity: '',
        website: '',
        securityContact: '',
        details: '',
      },
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      commissionRate: '0.100000000000000000',
      minSelfDelegation: '1',
    },
  },
  {
    module: 'staking',
    label: 'Delegate',
    messageType: MsgDelegate,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      amount: COIN_TEMPLATE,
    },
  },
  {
    module: 'staking',
    label: 'Begin Redelegate',
    messageType: MsgBeginRedelegate,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorSrcAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      validatorDstAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      amount: COIN_TEMPLATE,
    },
  },
  {
    module: 'staking',
    label: 'Undelegate',
    messageType: MsgUndelegate,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      amount: COIN_TEMPLATE,
    },
  },
  {
    module: 'staking',
    label: 'Cancel Unbonding Delegation',
    messageType: MsgCancelUnbondingDelegation,
    template: {
      delegatorAddress: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      validatorAddress: COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
      amount: COIN_TEMPLATE,
      creationHeight: '1',
    },
  },
  {
    module: 'upgrade',
    label: 'Software Upgrade',
    messageType: MsgSoftwareUpgrade,
    template: {
      authority: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
      plan: {
        name: '',
        time: '1970-01-01T00:00:00Z',
        height: '1',
        info: '',
        upgradedClientState: ANY_TEMPLATE,
      },
    },
  },
  {
    module: 'upgrade',
    label: 'Cancel Upgrade',
    messageType: MsgCancelUpgrade,
    template: {
      authority: COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
    },
  },
];

export const COSMOS_GENERIC_MESSAGE_TYPES = COSMOS_GENERIC_MESSAGE_DESCRIPTORS.map((descriptor) => ({
  module: descriptor.module,
  label: descriptor.label,
  typeUrl: descriptor.messageType.typeUrl,
  template: descriptor.template,
}));

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
  const gasLimit = normalizeRequiredText(input.gasLimit);
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

  if (gasLimit && !/^[1-9]\d*$/.test(gasLimit)) {
    throw new Error('Gas limit must be a positive integer.');
  }

  return {
    privateKey,
    accountPrefix,
    signingAlgorithm,
    gasPrice,
    gasLimit,
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

export function normalizeCosmosSendTokensInput(input: CosmosSendTokensInput): NormalizedCosmosSendTokensInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const recipientAddress = normalizeRequiredText(input.recipientAddress);
  const amount = normalizeRequiredText(input.amount);
  const denom = normalizeRequiredText(input.denom);

  assertPresent(recipientAddress, 'Recipient address');
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
    recipientAddress,
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

function normalizeCosmosGenericMessageInput(input: CosmosGenericMessageInput): NormalizedCosmosGenericMessageInput {
  const normalized = normalizeCosmosBaseSigningInput(input);
  const messageTypeUrl = normalizeRequiredText(input.messageTypeUrl);
  const messageJson = normalizeRequiredText(input.messageJson);

  assertPresent(messageTypeUrl, 'Message type');
  assertPresent(messageJson, 'Message JSON');

  return {
    ...normalized,
    messageTypeUrl,
    messageJson,
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

function parseCosmosMessageValue(messageJson: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(messageJson);
  } catch {
    throw new Error('Message JSON must be valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Message JSON must be an object.');
  }

  return parsed as Record<string, unknown>;
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

function createCosmosSigningRegistry() {
  const registry = new Registry(defaultRegistryTypes);

  for (const descriptor of COSMOS_GENERIC_MESSAGE_DESCRIPTORS) {
    registry.register(descriptor.messageType.typeUrl, descriptor.messageType as unknown as GeneratedType);
  }

  return registry;
}

async function createCosmosSigningClient(input: CosmosBaseSigningInput, registry = createCosmosSigningRegistry()) {
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
    registry,
  });

  return {
    client,
    delegatorAddress,
    normalized,
  };
}

function resolveCosmosFee(input: NormalizedCosmosBaseSigningInput) {
  if (!input.gasLimit) {
    return 'auto';
  }

  return calculateFee(Number(input.gasLimit), input.gasPrice);
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
      resolveCosmosFee(normalized),
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
      response: result,
    };
  } finally {
    client.disconnect();
  }
}

export async function sendCosmosTokens(input: CosmosSendTokensInput): Promise<CosmosBroadcastResult> {
  const normalized = normalizeCosmosSendTokensInput(input);
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  try {
    const result = await client.sendTokens(
      delegatorAddress,
      normalized.recipientAddress,
      [
        {
          amount: normalized.amount,
          denom: normalized.denom,
        },
      ],
      resolveCosmosFee(normalized),
      normalized.memo,
    );

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Send transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
    };
  } finally {
    client.disconnect();
  }
}

export async function broadcastCosmosGenericMessage(input: CosmosGenericMessageInput): Promise<CosmosBroadcastResult> {
  const normalized = normalizeCosmosGenericMessageInput(input);
  const descriptor = COSMOS_GENERIC_MESSAGE_DESCRIPTORS.find((item) => item.messageType.typeUrl === normalized.messageTypeUrl);

  if (!descriptor) {
    throw new Error('Unsupported Cosmos message type.');
  }

  const messageValue = descriptor.messageType.fromJSON(parseCosmosMessageValue(normalized.messageJson));
  const { client, delegatorAddress } = await createCosmosSigningClient(normalized);

  try {
    const result = await client.signAndBroadcast(
      delegatorAddress,
      [
        {
          typeUrl: descriptor.messageType.typeUrl,
          value: messageValue,
        },
      ],
      resolveCosmosFee(normalized),
      normalized.memo,
    );

    if (result.code !== 0) {
      throw new Error(result.rawLog || `${descriptor.label} transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
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
      resolveCosmosFee(normalized),
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
      response: result,
    };
  } finally {
    client.disconnect();
  }
}

export async function withdrawCosmosDelegatorRewards(input: CosmosRewardWithdrawalInput): Promise<CosmosDelegateResult> {
  const { client, delegatorAddress, normalized } = await createCosmosStakingClient(input);

  try {
    const result = await client.withdrawRewards(delegatorAddress, normalized.validatorAddress, resolveCosmosFee(normalized), normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Withdraw rewards transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
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
    const result = await client.signAndBroadcast(delegatorAddress, [message], resolveCosmosFee(normalized), normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Withdraw commission transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
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
      value: GovV1MsgVote.fromPartial({
        proposalId: BigInt(normalized.proposalId),
        voter: delegatorAddress,
        option: toCosmosGovVoteOption(normalized.option),
        metadata: normalized.metadata,
      }),
    };
    const result = await client.signAndBroadcast(delegatorAddress, [message], resolveCosmosFee(normalized), normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Vote transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
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
      value: GovV1MsgDeposit.fromPartial({
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
    const result = await client.signAndBroadcast(delegatorAddress, [message], resolveCosmosFee(normalized), normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Deposit transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
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
      value: GovV1MsgSubmitProposal.fromPartial({
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
    const result = await client.signAndBroadcast(delegatorAddress, [message], resolveCosmosFee(normalized), normalized.memo);

    if (result.code !== 0) {
      throw new Error(result.rawLog || `Submit proposal transaction failed with code ${result.code}.`);
    }

    return {
      delegatorAddress,
      transactionHash: result.transactionHash,
      height: result.height,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      response: result,
    };
  } finally {
    client.disconnect();
  }
}
