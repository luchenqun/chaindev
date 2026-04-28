'use client';

import 'client-only';

import { DirectEthSecp256k1Wallet, DirectSecp256k1Wallet, type EncodeObject } from '@cosmjs/proto-signing';
import { GasPrice, SigningStargateClient } from '@cosmjs/stargate';
import { MsgWithdrawValidatorCommission } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';

type TendermintStatusResponse = {
  result?: {
    node_info?: {
      network?: string;
    };
  };
};

export type CosmosSigningInput = {
  privateKey: string;
  accountPrefix: string;
  signingAlgorithm: CosmosSigningAlgorithm;
  validatorAddress: string;
  gasPrice: string;
  memo?: string;
};

export type CosmosDelegateInput = CosmosSigningInput & {
  amount: string;
  denom: string;
};

export type CosmosRewardWithdrawalInput = CosmosSigningInput;

export type NormalizedCosmosDelegateInput = Required<CosmosDelegateInput>;
export type NormalizedCosmosSigningInput = Required<CosmosSigningInput>;

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

export function getCosmosAccountPrefixFromValidatorAddress(validatorAddress: string) {
  const value = validatorAddress.trim();
  const markerIndex = value.indexOf('valoper');

  if (markerIndex <= 0) {
    return 'cosmos';
  }

  return value.slice(0, markerIndex);
}

export function normalizeCosmosSigningInput(input: CosmosSigningInput): NormalizedCosmosSigningInput {
  const privateKey = normalizeRequiredText(input.privateKey);
  const accountPrefix = normalizeRequiredText(input.accountPrefix);
  const signingAlgorithm = input.signingAlgorithm;
  const validatorAddress = normalizeRequiredText(input.validatorAddress);
  const gasPrice = normalizeRequiredText(input.gasPrice);
  const memo = normalizeRequiredText(input.memo);

  assertPresent(privateKey, 'Private key');
  assertPresent(accountPrefix, 'Account prefix');
  assertPresent(signingAlgorithm, 'Signing algorithm');
  assertPresent(validatorAddress, 'Validator address');
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
    validatorAddress,
    gasPrice,
    memo,
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

async function createCosmosStakingClient(input: CosmosSigningInput) {
  const normalized = normalizeCosmosSigningInput(input);
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
