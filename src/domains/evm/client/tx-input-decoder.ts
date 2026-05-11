'use client';

import { decodeFunctionData, parseAbiItem, toFunctionSelector, type Abi, type AbiFunction, type AbiParameter, type Hex } from 'viem';
import { parseContractAbiJson } from '@/domains/evm/client/abi-utils';
import { listEvmContractArtifacts, type EvmContractArtifact } from '@/domains/evm/client/contract-registry';

type FourByteSignatureRecord = {
  id: number;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
};

type FourByteApiResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FourByteSignatureRecord[];
};

export type EvmTxDecodedArgument = {
  name: string;
  type: string;
  value: string;
};

export type EvmTxDecodedCandidate = {
  id: string;
  label: string;
  sourceLabel: string;
  functionSignature: string;
  selector: string;
  methodName: string;
  args: EvmTxDecodedArgument[];
  decodeError: string | null;
  hasInputs: boolean;
  abiJson: string;
};

export type EvmTxAbiCandidateSource = {
  id: string;
  label: string;
  sourceLabel: string;
  abi: Abi;
  abiJson: string;
};

export function stringifyDecodedValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return JSON.stringify(value, (_key, currentValue) => (typeof currentValue === 'bigint' ? currentValue.toString() : currentValue), 2);
}

function isAbiFunctionItem(item: Abi[number] | unknown): item is AbiFunction {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'function' && 'name' in item;
}

function hasTupleComponents(parameter: AbiParameter): parameter is AbiParameter & { components: readonly AbiParameter[] } {
  return 'components' in parameter && Array.isArray(parameter.components);
}

function getCanonicalAbiParameterType(parameter: AbiParameter): string {
  if (!parameter.type.endsWith(']')) {
    if (parameter.type !== 'tuple') {
      return parameter.type;
    }

    const components = hasTupleComponents(parameter) ? parameter.components : [];
    return `(${components.map(getCanonicalAbiParameterType).join(',')})`;
  }

  const arraySuffix = parameter.type.slice(parameter.type.indexOf('['));
  const baseParameter = {
    ...parameter,
    type: parameter.type.slice(0, parameter.type.indexOf('[')),
  } satisfies AbiParameter;

  return `${getCanonicalAbiParameterType(baseParameter)}${arraySuffix}`;
}

export function getFunctionSignature(fn: AbiFunction) {
  return `${fn.name}(${fn.inputs.map(getCanonicalAbiParameterType).join(',')})`;
}

export function normalizeHexData(value: string, errorMessage: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    throw new Error(errorMessage);
  }

  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-f]*$/.test(normalized) || normalized.length < 10 || normalized.length % 2 !== 0) {
    throw new Error(errorMessage);
  }

  return normalized as Hex;
}

export function buildDecodedCandidate(input: {
  id: string;
  label: string;
  sourceLabel: string;
  abi: Abi;
  abiJson: string;
  data: Hex;
  decodeFailedMessage: string;
}) {
  const selector = input.data.slice(0, 10).toLowerCase();
  const functions = input.abi.filter(isAbiFunctionItem);
  const matchedFunction = functions.find((fn) => toFunctionSelector(`function ${getFunctionSignature(fn)}`).toLowerCase() === selector);

  if (!matchedFunction) {
    return null;
  }

  const functionSignature = getFunctionSignature(matchedFunction);
  const hasInputs = matchedFunction.inputs.length > 0;

  try {
    const decoded = decodeFunctionData({
      abi: input.abi,
      data: input.data,
    });
    const decodedArgs = Array.isArray(decoded.args) ? decoded.args : [];

    return {
      id: input.id,
      label: input.label,
      sourceLabel: input.sourceLabel,
      functionSignature,
      selector,
      methodName: matchedFunction.name,
      decodeError: null,
      hasInputs,
      abiJson: input.abiJson,
      args: matchedFunction.inputs.map((parameter, index) => ({
        name: parameter.name || `arg${index + 1}`,
        type: parameter.type,
        value: stringifyDecodedValue(decodedArgs[index]),
      })),
    } satisfies EvmTxDecodedCandidate;
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      sourceLabel: input.sourceLabel,
      functionSignature,
      selector,
      methodName: matchedFunction.name,
      decodeError: error instanceof Error ? error.message : input.decodeFailedMessage,
      hasInputs,
      abiJson: input.abiJson,
      args: [],
    } satisfies EvmTxDecodedCandidate;
  }
}

export async function fetchFourByteFunctionCandidates(selector: string, labels: { lookupFailed: string; fourByte: string }) {
  const response = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(selector)}`);

  if (!response.ok) {
    throw new Error(`${labels.lookupFailed} (${response.status})`);
  }

  const payload = (await response.json()) as FourByteApiResponse;
  const uniqueSignatures = Array.from(new Map(payload.results.sort((left, right) => left.id - right.id).map((item) => [item.text_signature, item])).values());

  return uniqueSignatures.flatMap((item, index) => {
    try {
      const abiItem = parseAbiItem(`function ${item.text_signature}`);
      const abi = [abiItem] satisfies Abi;

      return [
        {
          id: `4byte:${item.id}:${index}`,
          label: item.text_signature,
          sourceLabel: labels.fourByte,
          abi,
          abiJson: JSON.stringify(abi, null, 2),
        } satisfies EvmTxAbiCandidateSource,
      ];
    } catch {
      return [];
    }
  });
}

export function buildLocalArtifactCandidates(artifacts: EvmContractArtifact[], labels: { localArtifact: string; systemArtifact: string; importedArtifact: string }) {
  return artifacts.map((artifact, index) => ({
    id: `artifact:${artifact.id}:${index}`,
    label: artifact.name,
    sourceLabel: `${labels.localArtifact} · ${artifact.scope === 'system' ? labels.systemArtifact : labels.importedArtifact}`,
    abi: parseContractAbiJson(artifact.abiJson),
    abiJson: artifact.abiJson,
  })) satisfies EvmTxAbiCandidateSource[];
}

export function buildAllLocalArtifactCandidates(labels: { localArtifact: string; systemArtifact: string; importedArtifact: string }) {
  return buildLocalArtifactCandidates(listEvmContractArtifacts(), labels);
}

export function dedupeCandidatesBySignature(candidates: EvmTxDecodedCandidate[]) {
  const uniqueCandidates: EvmTxDecodedCandidate[] = [];
  const seenSignatures = new Set<string>();

  for (const candidate of candidates) {
    if (seenSignatures.has(candidate.functionSignature)) {
      continue;
    }

    seenSignatures.add(candidate.functionSignature);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}
