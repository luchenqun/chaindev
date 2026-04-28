'use client';

import 'client-only';

import { createPublicClient, createWalletClient, encodeDeployData, encodeFunctionData, formatEther, formatGwei, parseEther, parseGwei, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getContractConstructor, getContractFunctionBySignature, parseContractAbiJson, parseContractFunctionArgs } from '@/domains/evm/client/abi-utils';
import { createEvmTransport } from '@/domains/evm/lib/transport';
import { getEvmCurrencyName } from '@/platform/workbench/rpc-profile';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

const EVM_GAS_LIMIT_MULTIPLIER = 1.35;
const EVM_GAS_LIMIT_MULTIPLIER_SCALE = 100n;
const EVM_GAS_LIMIT_MULTIPLIER_NUMERATOR = BigInt(Math.round(EVM_GAS_LIMIT_MULTIPLIER * Number(EVM_GAS_LIMIT_MULTIPLIER_SCALE)));

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function getActiveEvmClients() {
  const profile = getActiveEvmProfile();
  const transport = createEvmTransport(profile.rpcUrl);

  return {
    profile,
    publicClient: createPublicClient({ transport }),
  };
}

function normalizePrivateKey(privateKey: string) {
  const value = privateKey.trim();

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Private key must be a 32-byte hex string.');
  }

  return value as Hex;
}

function formatNativeAmount(value: bigint, currencyName: string) {
  return `${Number(formatEther(value))
    .toFixed(6)
    .replace(/\.?0+$/, '')} ${currencyName}`;
}

function parseNativeValue(value: string) {
  return value.trim() ? parseEther(value.trim()) : 0n;
}

function parseGasLimit(gasLimit: string) {
  const value = gasLimit.trim();

  if (!value) {
    throw new Error('Gas limit is required for force send.');
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('Gas limit must be a positive integer.');
  }

  const normalizedValue = BigInt(value);

  if (normalizedValue <= 0n) {
    throw new Error('Gas limit must be greater than zero.');
  }

  return normalizedValue;
}

function applyGasLimitMultiplier(gasLimit: bigint) {
  return (gasLimit * EVM_GAS_LIMIT_MULTIPLIER_NUMERATOR + (EVM_GAS_LIMIT_MULTIPLIER_SCALE - 1n)) / EVM_GAS_LIMIT_MULTIPLIER_SCALE;
}

function parseGasPrice(gasPrice: string) {
  const value = gasPrice.trim();

  if (!value) {
    throw new Error('Gas price is required for force send.');
  }

  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Gas price must be a valid Gwei value.');
  }

  return parseGwei(value);
}

function isAutoTransactionFieldValue(value: string | undefined) {
  if (!value) {
    return true;
  }

  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || normalizedValue === 'auto';
}

function parseFeePerGas(value: string, fieldLabel: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldLabel} is required for force send.`);
  }

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new Error(`${fieldLabel} must be a valid Gwei value.`);
  }

  return parseGwei(normalizedValue);
}

function parseNonce(nonce: string) {
  const value = nonce.trim();

  if (!value) {
    throw new Error('Nonce is required for force send.');
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('Nonce must be a non-negative integer.');
  }

  return Number(value);
}

function normalizeDeployBytecode(bytecode: string) {
  const value = bytecode.trim();

  if (!value) {
    throw new Error('Contract bytecode is required for deployment.');
  }

  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Contract bytecode must be a valid hex string.');
  }

  return value as Hex;
}

function normalizeTransactionData(data: string | undefined) {
  const value = data?.trim();

  if (!value || value === '0x') {
    return undefined;
  }

  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Transaction data must be a valid hex string.');
  }

  return value as Hex;
}

function formatGweiValue(value: bigint) {
  return Number(formatGwei(value))
    .toFixed(3)
    .replace(/\.?0+$/, '');
}

function formatEip1559GasLabel(maxFeePerGas: bigint, maxPriorityFeePerGas: bigint) {
  return `Max Fee ${formatGweiValue(maxFeePerGas)} Gwei / Priority Fee ${formatGweiValue(maxPriorityFeePerGas)} Gwei`;
}

async function getReceiptBlockTimestamp(publicClient: ReturnType<typeof getActiveEvmClients>['publicClient'], blockNumber: bigint) {
  const block = await publicClient.getBlock({ blockNumber });
  return Number(block.timestamp);
}

async function getManualWriteFeeDefaults(publicClient: ReturnType<typeof getActiveEvmClients>['publicClient']) {
  try {
    const fees = await publicClient.estimateFeesPerGas({
      chain: undefined,
      type: 'eip1559',
    });

    return {
      transactionType: 'EIP1559' as const,
      gasPrice: '',
      maxFeePerGas: formatGweiValue(fees.maxFeePerGas),
      maxPriorityFeePerGas: formatGweiValue(fees.maxPriorityFeePerGas),
      gasPriceLabel: formatEip1559GasLabel(fees.maxFeePerGas, fees.maxPriorityFeePerGas),
    };
  } catch {
    const gasPrice = await publicClient.getGasPrice();

    return {
      transactionType: 'LEGACY' as const,
      gasPrice: formatGweiValue(gasPrice),
      maxFeePerGas: '',
      maxPriorityFeePerGas: '',
      gasPriceLabel: `${formatGweiValue(gasPrice)} Gwei`,
    };
  }
}

export async function getActiveEvmContractEnvironmentDirect() {
  const { profile, publicClient } = getActiveEvmClients();
  const chainId = await publicClient.getChainId();

  return {
    providerProfileId: profile.id,
    providerName: profile.name,
    chainId: String(chainId),
    nativeCurrency: getEvmCurrencyName(profile.nativeCurrencySymbol),
  };
}

export async function readEvmContractMethodDirect(input: { address: string; abiJson: string; functionSignature: string; rawArgs: string[] }) {
  const { publicClient } = getActiveEvmClients();
  const fn = getContractFunctionBySignature(input.abiJson, input.functionSignature);
  const args = parseContractFunctionArgs(fn.inputs, input.rawArgs);

  const result = await publicClient.readContract({
    address: input.address as `0x${string}`,
    abi: JSON.parse(input.abiJson),
    functionName: fn.name,
    args,
  } as never);

  return {
    functionName: fn.name,
    functionSignature: fn.signature,
    result,
  };
}

export async function prepareEvmContractWriteDirect(input: { address: string; abiJson: string; functionSignature: string; rawArgs: string[]; privateKey: string; value: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const fn = getContractFunctionBySignature(input.abiJson, input.functionSignature);
  const args = parseContractFunctionArgs(fn.inputs, input.rawArgs);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const value = input.value.trim() ? parseEther(input.value.trim()) : 0n;

  if (fn.stateMutability !== 'payable' && value > 0n) {
    throw new Error('Only payable contract methods can send native value.');
  }

  const estimatedGas = await publicClient.estimateContractGas({
    account,
    address: input.address as `0x${string}`,
    abi: JSON.parse(input.abiJson),
    functionName: fn.name,
    args,
    value: value > 0n ? value : undefined,
  } as never);
  const bufferedEstimatedGas = applyGasLimitMultiplier(estimatedGas);
  const gasPrice = await publicClient.getGasPrice();

  return {
    accountAddress: account.address,
    functionName: fn.name,
    functionSignature: fn.signature,
    args,
    estimatedGas: bufferedEstimatedGas.toString(),
    gasPrice: gasPrice.toString(),
    gasPriceLabel: `${formatGweiValue(gasPrice)} Gwei`,
    valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
  };
}

export async function getEvmContractWriteManualDefaultsDirect(input: {
  address: string;
  abiJson: string;
  functionSignature: string;
  rawArgs: string[];
  privateKey: string;
  value: string;
}) {
  const { profile, publicClient } = getActiveEvmClients();
  const fn = getContractFunctionBySignature(input.abiJson, input.functionSignature);
  const args = parseContractFunctionArgs(fn.inputs, input.rawArgs);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const value = input.value.trim() ? parseEther(input.value.trim()) : 0n;

  if (fn.stateMutability !== 'payable' && value > 0n) {
    throw new Error('Only payable contract methods can send native value.');
  }

  const [feeDefaults, nonce] = await Promise.all([getManualWriteFeeDefaults(publicClient), publicClient.getTransactionCount({ address: account.address })]);

  try {
    const estimatedGas = await publicClient.estimateContractGas({
      account,
      address: input.address as `0x${string}`,
      abi: JSON.parse(input.abiJson),
      functionName: fn.name,
      args,
      value: value > 0n ? value : undefined,
    } as never);
    const bufferedEstimatedGas = applyGasLimitMultiplier(estimatedGas);

    return {
      accountAddress: account.address,
      functionName: fn.name,
      functionSignature: fn.signature,
      estimatedGas: bufferedEstimatedGas.toString(),
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: null,
    };
  } catch (error) {
    return {
      accountAddress: account.address,
      functionName: fn.name,
      functionSignature: fn.signature,
      estimatedGas: '',
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: error instanceof Error ? error.message : 'Simulation failed.',
    };
  }
}

export async function getEvmTransactionManualDefaultsDirect(input: { to: string; privateKey: string; value: string; data?: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const value = parseNativeValue(input.value);
  const data = normalizeTransactionData(input.data);

  const [feeDefaults, nonce] = await Promise.all([getManualWriteFeeDefaults(publicClient), publicClient.getTransactionCount({ address: account.address })]);

  try {
    const estimatedGas = await publicClient.estimateGas({
      account,
      to: input.to as `0x${string}`,
      data,
      value: value > 0n ? value : undefined,
    });
    const bufferedEstimatedGas = applyGasLimitMultiplier(estimatedGas);

    return {
      accountAddress: account.address,
      estimatedGas: bufferedEstimatedGas.toString(),
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: null,
    };
  } catch (error) {
    return {
      accountAddress: account.address,
      estimatedGas: '',
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: error instanceof Error ? error.message : 'Simulation failed.',
    };
  }
}

export async function writeEvmContractMethodDirect(input: { address: string; abiJson: string; functionSignature: string; rawArgs: string[]; privateKey: string; value: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const fn = getContractFunctionBySignature(input.abiJson, input.functionSignature);
  const args = parseContractFunctionArgs(fn.inputs, input.rawArgs);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    transport: createEvmTransport(profile.rpcUrl),
  });
  const value = input.value.trim() ? parseEther(input.value.trim()) : 0n;

  if (fn.stateMutability !== 'payable' && value > 0n) {
    throw new Error('Only payable contract methods can send native value.');
  }

  const simulation = await publicClient.simulateContract({
    account,
    address: input.address as `0x${string}`,
    abi: JSON.parse(input.abiJson),
    functionName: fn.name,
    args,
    value: value > 0n ? value : undefined,
  } as never);
  const gas = simulation.request.gas
    ? applyGasLimitMultiplier(simulation.request.gas)
    : applyGasLimitMultiplier(
        await publicClient.estimateContractGas({
          account,
          address: input.address as `0x${string}`,
          abi: JSON.parse(input.abiJson),
          functionName: fn.name,
          args,
          value: value > 0n ? value : undefined,
        } as never),
      );

  const hash = await walletClient.writeContract({
    ...simulation.request,
    gas,
  } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const blockTimestamp = await getReceiptBlockTimestamp(publicClient, receipt.blockNumber);

  return {
    hash,
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice:
        receipt.effectiveGasPrice !== null
          ? `${Number(formatGwei(receipt.effectiveGasPrice))
              .toFixed(3)
              .replace(/\.?0+$/, '')} Gwei`
          : 'Unavailable',
    },
  };
}

export async function forceWriteEvmContractMethodDirect(input: {
  address: string;
  abiJson: string;
  functionSignature: string;
  rawArgs: string[];
  privateKey: string;
  transactionType: 'LEGACY' | 'EIP1559';
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}) {
  const { profile, publicClient } = getActiveEvmClients();
  const fn = getContractFunctionBySignature(input.abiJson, input.functionSignature);
  const abi = parseContractAbiJson(input.abiJson);
  const args = parseContractFunctionArgs(fn.inputs, input.rawArgs);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    transport: createEvmTransport(profile.rpcUrl),
  });
  const value = input.value.trim() ? parseEther(input.value.trim()) : 0n;
  const gas = parseGasLimit(input.gasLimit);
  const nonce = isAutoTransactionFieldValue(input.nonce) ? undefined : parseNonce(input.nonce ?? '');
  const feeParameters =
    input.transactionType === 'LEGACY'
      ? {
          type: 'legacy' as const,
          ...(isAutoTransactionFieldValue(input.gasPrice) ? {} : { gasPrice: parseGasPrice(input.gasPrice ?? '') }),
        }
      : (() => {
          if (isAutoTransactionFieldValue(input.maxFeePerGas) || isAutoTransactionFieldValue(input.maxPriorityFeePerGas)) {
            return {
              type: 'eip1559' as const,
            };
          }

          const maxFeePerGas = parseFeePerGas(input.maxFeePerGas ?? '', 'Max fee per gas');
          const maxPriorityFeePerGas = parseFeePerGas(input.maxPriorityFeePerGas ?? '', 'Max priority fee per gas');

          if (maxFeePerGas < maxPriorityFeePerGas) {
            throw new Error('Max fee per gas cannot be less than max priority fee per gas.');
          }

          return {
            type: 'eip1559' as const,
            maxFeePerGas,
            maxPriorityFeePerGas,
          };
        })();

  const data = encodeFunctionData({
    abi,
    functionName: fn.name,
    args,
  });
  const hash = await walletClient.sendTransaction({
    chain: undefined,
    account,
    to: input.address as `0x${string}`,
    data,
    value: value > 0n ? value : undefined,
    gas,
    nonce,
    ...feeParameters,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const blockTimestamp = await getReceiptBlockTimestamp(publicClient, receipt.blockNumber);

  return {
    hash,
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice:
        receipt.effectiveGasPrice !== null
          ? `${Number(formatGwei(receipt.effectiveGasPrice))
              .toFixed(3)
              .replace(/\.?0+$/, '')} Gwei`
          : 'Unavailable',
    },
  };
}

export async function forceSendEvmTransactionDirect(input: {
  to: string;
  privateKey: string;
  transactionType: 'LEGACY' | 'EIP1559';
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
  data?: string;
}) {
  const { profile, publicClient } = getActiveEvmClients();
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    transport: createEvmTransport(profile.rpcUrl),
  });
  const value = parseNativeValue(input.value);
  const gas = parseGasLimit(input.gasLimit);
  const nonce = isAutoTransactionFieldValue(input.nonce) ? undefined : parseNonce(input.nonce ?? '');
  const data = normalizeTransactionData(input.data);
  const feeParameters =
    input.transactionType === 'LEGACY'
      ? {
          type: 'legacy' as const,
          ...(isAutoTransactionFieldValue(input.gasPrice) ? {} : { gasPrice: parseGasPrice(input.gasPrice ?? '') }),
        }
      : (() => {
          if (isAutoTransactionFieldValue(input.maxFeePerGas) || isAutoTransactionFieldValue(input.maxPriorityFeePerGas)) {
            return {
              type: 'eip1559' as const,
            };
          }

          const maxFeePerGas = parseFeePerGas(input.maxFeePerGas ?? '', 'Max fee per gas');
          const maxPriorityFeePerGas = parseFeePerGas(input.maxPriorityFeePerGas ?? '', 'Max priority fee per gas');

          if (maxFeePerGas < maxPriorityFeePerGas) {
            throw new Error('Max fee per gas cannot be less than max priority fee per gas.');
          }

          return {
            type: 'eip1559' as const,
            maxFeePerGas,
            maxPriorityFeePerGas,
          };
        })();

  const hash = await walletClient.sendTransaction({
    chain: undefined,
    account,
    to: input.to as `0x${string}`,
    data,
    value: value > 0n ? value : undefined,
    gas,
    nonce,
    ...feeParameters,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const blockTimestamp = await getReceiptBlockTimestamp(publicClient, receipt.blockNumber);

  return {
    hash,
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice:
        receipt.effectiveGasPrice !== null
          ? `${Number(formatGwei(receipt.effectiveGasPrice))
              .toFixed(3)
              .replace(/\.?0+$/, '')} Gwei`
          : 'Unavailable',
    },
  };
}

export async function prepareEvmContractDeployDirect(input: { abiJson: string; bytecode: string; rawArgs: string[]; privateKey: string; value: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const abi = parseContractAbiJson(input.abiJson);
  const constructorItem = getContractConstructor(input.abiJson);
  const args = parseContractFunctionArgs(constructorItem.inputs, input.rawArgs);
  const bytecode = normalizeDeployBytecode(input.bytecode);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const value = parseNativeValue(input.value);

  const data = encodeDeployData({
    abi,
    args,
    bytecode,
  });
  const estimatedGas = await publicClient.estimateGas({
    account,
    data,
    value: value > 0n ? value : undefined,
  });
  const bufferedEstimatedGas = applyGasLimitMultiplier(estimatedGas);
  const gasPrice = await publicClient.getGasPrice();

  return {
    accountAddress: account.address,
    constructorArgCount: constructorItem.inputs.length,
    estimatedGas: bufferedEstimatedGas.toString(),
    gasPriceLabel: `${Number(formatGwei(gasPrice))
      .toFixed(3)
      .replace(/\.?0+$/, '')} Gwei`,
    valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
  };
}

export async function getEvmContractDeployManualDefaultsDirect(input: { abiJson: string; bytecode: string; rawArgs: string[]; privateKey: string; value: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const abi = parseContractAbiJson(input.abiJson);
  const constructorItem = getContractConstructor(input.abiJson);
  const args = parseContractFunctionArgs(constructorItem.inputs, input.rawArgs);
  const bytecode = normalizeDeployBytecode(input.bytecode);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const value = parseNativeValue(input.value);

  const [feeDefaults, nonce] = await Promise.all([getManualWriteFeeDefaults(publicClient), publicClient.getTransactionCount({ address: account.address })]);

  try {
    const data = encodeDeployData({
      abi,
      args,
      bytecode,
    });
    const estimatedGas = await publicClient.estimateGas({
      account,
      data,
      value: value > 0n ? value : undefined,
    });
    const bufferedEstimatedGas = applyGasLimitMultiplier(estimatedGas);

    return {
      accountAddress: account.address,
      constructorArgCount: constructorItem.inputs.length,
      estimatedGas: bufferedEstimatedGas.toString(),
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: null,
    };
  } catch (error) {
    return {
      accountAddress: account.address,
      constructorArgCount: constructorItem.inputs.length,
      estimatedGas: '',
      transactionType: feeDefaults.transactionType,
      gasPrice: feeDefaults.gasPrice,
      maxFeePerGas: feeDefaults.maxFeePerGas,
      maxPriorityFeePerGas: feeDefaults.maxPriorityFeePerGas,
      gasPriceLabel: feeDefaults.gasPriceLabel,
      nonce: String(nonce),
      value: input.value.trim() || '0',
      valueLabel: value > 0n ? formatNativeAmount(value, getEvmCurrencyName(profile.nativeCurrencySymbol)) : `0 ${getEvmCurrencyName(profile.nativeCurrencySymbol)}`,
      simulationError: error instanceof Error ? error.message : 'Simulation failed.',
    };
  }
}

export async function deployEvmContractDirect(input: { abiJson: string; bytecode: string; rawArgs: string[]; privateKey: string; value: string }) {
  const { profile, publicClient } = getActiveEvmClients();
  const abi = parseContractAbiJson(input.abiJson);
  const args = parseContractFunctionArgs(getContractConstructor(input.abiJson).inputs, input.rawArgs);
  const bytecode = normalizeDeployBytecode(input.bytecode);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    transport: createEvmTransport(profile.rpcUrl),
  });
  const value = parseNativeValue(input.value);

  const estimatedGas = await publicClient.estimateGas({
    account,
    data: encodeDeployData({
      abi,
      args,
      bytecode,
    }),
    value: value > 0n ? value : undefined,
  });
  const gas = applyGasLimitMultiplier(estimatedGas);

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args,
    value: value > 0n ? value : undefined,
    gas,
    account,
  } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('Deployment completed without a contract address.');
  }

  return {
    hash,
    contractAddress: receipt.contractAddress,
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice
        ? `${Number(formatGwei(receipt.effectiveGasPrice))
            .toFixed(3)
            .replace(/\.?0+$/, '')} Gwei`
        : 'Unavailable',
    },
  };
}

export async function forceDeployEvmContractDirect(input: {
  abiJson: string;
  bytecode: string;
  rawArgs: string[];
  privateKey: string;
  transactionType: 'LEGACY' | 'EIP1559';
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}) {
  const { profile, publicClient } = getActiveEvmClients();
  const abi = parseContractAbiJson(input.abiJson);
  const args = parseContractFunctionArgs(getContractConstructor(input.abiJson).inputs, input.rawArgs);
  const bytecode = normalizeDeployBytecode(input.bytecode);
  const normalizedPrivateKey = normalizePrivateKey(input.privateKey);
  const account = privateKeyToAccount(normalizedPrivateKey);
  const walletClient = createWalletClient({
    account,
    transport: createEvmTransport(profile.rpcUrl),
  });
  const value = parseNativeValue(input.value);
  const gas = parseGasLimit(input.gasLimit);
  const nonce = input.nonce?.trim() ? parseNonce(input.nonce) : undefined;
  const feeParameters =
    input.transactionType === 'LEGACY'
      ? {
          type: 'legacy' as const,
          gasPrice: parseGasPrice(input.gasPrice ?? ''),
        }
      : (() => {
          const maxFeePerGas = parseFeePerGas(input.maxFeePerGas ?? '', 'Max fee per gas');
          const maxPriorityFeePerGas = parseFeePerGas(input.maxPriorityFeePerGas ?? '', 'Max priority fee per gas');

          if (maxFeePerGas < maxPriorityFeePerGas) {
            throw new Error('Max fee per gas cannot be less than max priority fee per gas.');
          }

          return {
            type: 'eip1559' as const,
            maxFeePerGas,
            maxPriorityFeePerGas,
          };
        })();

  const data = encodeDeployData({
    abi,
    args,
    bytecode,
  });
  const hash = await walletClient.sendTransaction({
    chain: undefined,
    account,
    data,
    value: value > 0n ? value : undefined,
    gas,
    nonce,
    ...feeParameters,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('Deployment completed without a contract address.');
  }

  return {
    hash,
    contractAddress: receipt.contractAddress,
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice
        ? `${Number(formatGwei(receipt.effectiveGasPrice))
            .toFixed(3)
            .replace(/\.?0+$/, '')} Gwei`
        : 'Unavailable',
    },
  };
}
