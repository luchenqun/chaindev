'use client';

import { decodeEventLog, decodeFunctionData, toEventSelector, toFunctionSelector, type Abi, type AbiEvent, type Hex } from 'viem';
import { getContractFunctions, parseContractAbiJson } from '@/domains/evm/client/abi-utils';
import { getEvmContractArtifact, listEvmContractArtifacts, listEvmContractBindings } from '@/domains/evm/client/contract-registry';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

export type EvmDecodedTransactionInput = {
  methodLabel: string;
  functionName: string;
  functionSignature: string;
  selector: string;
  artifactName: string;
  abiJson: string;
  bindingLabel: string;
  args: Array<{
    name: string;
    type: string;
    value: string;
  }>;
};

export type EvmDecodedReceiptLog = {
  eventName: string;
  eventSignature: string;
  topic0: string | null;
  artifactName: string;
  abiJson: string;
  bindingLabel: string;
  args: Array<{
    name: string;
    type: string;
    indexed: boolean;
    value: string;
    rawHex: string | null;
  }>;
};

type MatchedReceiptLogEvent = {
  artifactName: string;
  bindingLabel: string;
  abiJson: string;
  event: AbiEvent;
};

// TODO: Replace these hard-coded fallback event ABIs with the system artifacts
// catalog once it is available in the app.
const COMMON_EVM_EVENT_ARTIFACTS: Array<{
  artifactName: string;
  bindingLabel: string;
  abiJson: string;
}> = [
  {
    artifactName: 'Common ERC20',
    bindingLabel: 'Standard ERC20 Event',
    abiJson: JSON.stringify([
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' },
        ],
        name: 'Transfer',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'owner', type: 'address' },
          { indexed: true, name: 'spender', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' },
        ],
        name: 'Approval',
        type: 'event',
      },
    ]),
  },
  {
    artifactName: 'Common WETH',
    bindingLabel: 'Standard WETH Event',
    abiJson: JSON.stringify([
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'dst', type: 'address' },
          { indexed: false, name: 'wad', type: 'uint256' },
        ],
        name: 'Deposit',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'src', type: 'address' },
          { indexed: false, name: 'wad', type: 'uint256' },
        ],
        name: 'Withdrawal',
        type: 'event',
      },
    ]),
  },
  {
    artifactName: 'Common UniswapV2Pair',
    bindingLabel: 'Standard AMM Pair Event',
    abiJson: JSON.stringify([
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'sender', type: 'address' },
          { indexed: false, name: 'amount0In', type: 'uint256' },
          { indexed: false, name: 'amount1In', type: 'uint256' },
          { indexed: false, name: 'amount0Out', type: 'uint256' },
          { indexed: false, name: 'amount1Out', type: 'uint256' },
          { indexed: true, name: 'to', type: 'address' },
        ],
        name: 'Swap',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: false, name: 'reserve0', type: 'uint112' },
          { indexed: false, name: 'reserve1', type: 'uint112' },
        ],
        name: 'Sync',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'sender', type: 'address' },
          { indexed: false, name: 'amount0', type: 'uint256' },
          { indexed: false, name: 'amount1', type: 'uint256' },
          { indexed: true, name: 'to', type: 'address' },
        ],
        name: 'Burn',
        type: 'event',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'sender', type: 'address' },
          { indexed: false, name: 'amount0', type: 'uint256' },
          { indexed: false, name: 'amount1', type: 'uint256' },
        ],
        name: 'Mint',
        type: 'event',
      },
    ]),
  },
];

function stringifyDecodedValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return JSON.stringify(value, (_, currentValue) => (typeof currentValue === 'bigint' ? currentValue.toString() : currentValue), 2);
}

function formatFallbackMethodLabel(inputData: string | undefined, to: string | null | undefined) {
  if (!to) {
    return 'Create';
  }

  if (!inputData || inputData === '0x') {
    return 'Transfer';
  }

  return inputData.slice(0, 10);
}

function findBoundArtifact(address: string | null | undefined) {
  const profile = readActiveRpcProfileCookie('evm');

  if (!address || !profile) {
    return null;
  }

  const binding = listEvmContractBindings().find((item) => item.providerProfileId === profile.id && item.addressLower === address.toLowerCase());

  if (!binding) {
    return null;
  }

  const artifact = getEvmContractArtifact(binding.artifactId);

  if (!artifact) {
    return null;
  }

  return {
    binding,
    artifact,
  };
}

function findMatchingEventInAbi(abiJson: string, topic0: string | null) {
  if (!topic0) {
    return null;
  }

  const abi = parseContractAbiJson(abiJson);
  const events = abi.filter(isAbiEventItem);

  return events.find((event) => !event.anonymous && toEventSelector(getEventSignature(event)).toLowerCase() === topic0) ?? null;
}

function resolveReceiptLogEvent(input: { address: string | null | undefined; topic0: string | null }): MatchedReceiptLogEvent | null {
  const boundArtifact = findBoundArtifact(input.address);

  if (boundArtifact) {
    const matchedEvent = findMatchingEventInAbi(boundArtifact.artifact.abiJson, input.topic0);

    if (matchedEvent) {
      return {
        artifactName: boundArtifact.artifact.name,
        bindingLabel: boundArtifact.binding.label,
        abiJson: boundArtifact.artifact.abiJson,
        event: matchedEvent,
      };
    }
  }

  for (const artifact of listEvmContractArtifacts()) {
    const matchedEvent = findMatchingEventInAbi(artifact.abiJson, input.topic0);

    if (matchedEvent) {
      return {
        artifactName: artifact.name,
        bindingLabel: 'Imported Artifact Match',
        abiJson: artifact.abiJson,
        event: matchedEvent,
      };
    }
  }

  for (const artifact of COMMON_EVM_EVENT_ARTIFACTS) {
    const matchedEvent = findMatchingEventInAbi(artifact.abiJson, input.topic0);

    if (matchedEvent) {
      return {
        artifactName: artifact.artifactName,
        bindingLabel: artifact.bindingLabel,
        abiJson: artifact.abiJson,
        event: matchedEvent,
      };
    }
  }

  return null;
}

function isAbiEventItem(item: Abi[number]): item is AbiEvent {
  return item.type === 'event';
}

function getEventSignature(event: AbiEvent) {
  return `${event.name}(${event.inputs.map((input) => input.type).join(',')})`;
}

function readDecodedEventArgument(decodedArgs: unknown, input: AbiEvent['inputs'][number], index: number) {
  if (Array.isArray(decodedArgs)) {
    return decodedArgs[index];
  }

  if (decodedArgs && typeof decodedArgs === 'object') {
    if (input.name && input.name in decodedArgs) {
      return (decodedArgs as Record<string, unknown>)[input.name];
    }

    if (String(index) in decodedArgs) {
      return (decodedArgs as Record<string, unknown>)[String(index)];
    }
  }

  return undefined;
}

function resolveIndexedTopicHex(event: AbiEvent, topics: string[], inputIndex: number) {
  const indexedPosition = event.inputs.slice(0, inputIndex + 1).filter((input) => input.indexed).length;

  return topics[(event.anonymous ? 0 : 1) + indexedPosition - 1] ?? null;
}

export function decodeHexToUtf8(value: string) {
  const normalizedValue = value.startsWith('0x') ? value.slice(2) : value;

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length % 2 !== 0 || /[^0-9a-f]/i.test(normalizedValue)) {
    return null;
  }

  try {
    const bytes = Uint8Array.from(normalizedValue.match(/.{1,2}/g)?.map((item) => Number.parseInt(item, 16)) ?? []);

    return new TextDecoder().decode(bytes).replace(/\u0000/g, '');
  } catch {
    return null;
  }
}

export function decodeBoundEvmTransactionInput(input: { to: string | null | undefined; inputData: string | undefined }): EvmDecodedTransactionInput | null {
  const normalizedInputData = input.inputData ?? '0x';
  const boundArtifact = findBoundArtifact(input.to);

  if (!boundArtifact || normalizedInputData === '0x') {
    return null;
  }

  const selector = normalizedInputData.slice(0, 10).toLowerCase();
  const functions = getContractFunctions(boundArtifact.artifact.abiJson);
  const matchedFunction = functions.find((fn) => toFunctionSelector(`function ${fn.signature}`).toLowerCase() === selector);

  if (!matchedFunction) {
    return null;
  }

  try {
    const decoded = decodeFunctionData({
      abi: parseContractAbiJson(boundArtifact.artifact.abiJson),
      data: normalizedInputData as Hex,
    });
    const args = Array.isArray(decoded.args) ? decoded.args : [];

    return {
      methodLabel: matchedFunction.name,
      functionName: matchedFunction.name,
      functionSignature: matchedFunction.signature,
      selector,
      artifactName: boundArtifact.artifact.name,
      abiJson: boundArtifact.artifact.abiJson,
      bindingLabel: boundArtifact.binding.label,
      args: matchedFunction.inputs.map((parameter, index) => ({
        name: parameter.name || `arg${index + 1}`,
        type: parameter.type,
        value: stringifyDecodedValue(args[index]),
      })),
    };
  } catch {
    return {
      methodLabel: matchedFunction.name,
      functionName: matchedFunction.name,
      functionSignature: matchedFunction.signature,
      selector,
      artifactName: boundArtifact.artifact.name,
      abiJson: boundArtifact.artifact.abiJson,
      bindingLabel: boundArtifact.binding.label,
      args: [],
    };
  }
}

export function decodeBoundEvmReceiptLog(input: { address: string | null | undefined; topics: string[]; data: string | undefined }): EvmDecodedReceiptLog | null {
  if (!input.address || !input.topics.length) {
    return null;
  }

  const topic0 = input.topics[0]?.toLowerCase() ?? null;
  const matchedArtifact = resolveReceiptLogEvent({
    address: input.address,
    topic0,
  });

  if (!matchedArtifact) {
    return null;
  }

  const normalizedTopics = input.topics.map((topic) => topic.toLowerCase()) as Hex[];
  const decodedTopics: [] | [Hex, ...Hex[]] = normalizedTopics.length > 0 ? [normalizedTopics[0], ...normalizedTopics.slice(1)] : [];
  const normalizedData = (input.data ?? '0x') as Hex;

  try {
    const decoded = decodeEventLog({
      abi: [matchedArtifact.event],
      data: normalizedData,
      topics: decodedTopics,
      strict: false,
    });

    return {
      eventName: matchedArtifact.event.name,
      eventSignature: getEventSignature(matchedArtifact.event),
      topic0,
      artifactName: matchedArtifact.artifactName,
      abiJson: matchedArtifact.abiJson,
      bindingLabel: matchedArtifact.bindingLabel,
      args: matchedArtifact.event.inputs.map((eventInput, index) => ({
        name: eventInput.name || `arg${index + 1}`,
        type: eventInput.type,
        indexed: Boolean(eventInput.indexed),
        value: stringifyDecodedValue(readDecodedEventArgument(decoded.args, eventInput, index)),
        rawHex: eventInput.indexed ? resolveIndexedTopicHex(matchedArtifact.event, normalizedTopics, index) : null,
      })),
    };
  } catch {
    return {
      eventName: matchedArtifact.event.name,
      eventSignature: getEventSignature(matchedArtifact.event),
      topic0,
      artifactName: matchedArtifact.artifactName,
      abiJson: matchedArtifact.abiJson,
      bindingLabel: matchedArtifact.bindingLabel,
      args: matchedArtifact.event.inputs.map((eventInput, index) => ({
        name: eventInput.name || `arg${index + 1}`,
        type: eventInput.type,
        indexed: Boolean(eventInput.indexed),
        value: eventInput.indexed ? (resolveIndexedTopicHex(matchedArtifact.event, input.topics, index) ?? 'Unavailable') : (input.data ?? '0x'),
        rawHex: eventInput.indexed ? resolveIndexedTopicHex(matchedArtifact.event, input.topics, index) : null,
      })),
    };
  }
}

export function resolveEvmTransactionMethodLabel(input: { to: string | null | undefined; inputData: string | undefined; fallbackMethodLabel?: string }) {
  const decoded = decodeBoundEvmTransactionInput(input);

  return decoded?.methodLabel ?? input.fallbackMethodLabel ?? formatFallbackMethodLabel(input.inputData, input.to);
}
