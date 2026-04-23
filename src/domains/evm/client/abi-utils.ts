'use client';

import { isAddress, type Abi, type AbiFunction, type AbiParameter } from 'viem';

export type EvmContractFunctionDescriptor = {
  name: string;
  signature: string;
  stateMutability: AbiFunction['stateMutability'];
  inputs: readonly AbiParameter[];
  outputs: readonly AbiParameter[];
};

export type EvmContractConstructorDescriptor = {
  stateMutability: 'payable' | 'nonpayable';
  inputs: readonly AbiParameter[];
};

type AbiTupleValue = Record<string, unknown> | unknown[];
type AbiConstructorItem = Extract<Abi[number], { type: 'constructor' }>;

function isAbiFunctionItem(item: unknown): item is AbiFunction {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'function' && 'name' in item;
}

function isAbiConstructorItem(item: unknown): item is AbiConstructorItem {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'constructor';
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

function getFunctionSignature(fn: AbiFunction) {
  return `${fn.name}(${fn.inputs.map(getCanonicalAbiParameterType).join(',')})`;
}

function parseJsonValue(rawValue: string, label: string) {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function isIntegerType(type: string) {
  return type.startsWith('uint') || type.startsWith('int');
}

function isBytesType(type: string) {
  return type === 'bytes' || /^bytes\d+$/.test(type);
}

function ensureHexValue(value: string, label: string) {
  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`${label} must be a valid hex string.`);
  }

  return value;
}

function parseTupleValue(parameter: AbiParameter, value: AbiTupleValue, label: string): unknown {
  const components = hasTupleComponents(parameter) ? parameter.components : [];

  if (Array.isArray(value)) {
    if (value.length !== components.length) {
      throw new Error(`${label} expects ${components.length} tuple items.`);
    }

    return components.map((component: AbiParameter, index: number) => parseParameterValue(component, value[index], `${label}[${index}]`));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      components.map((component: AbiParameter, index: number) => {
        const key = component.name || String(index);

        if (!(key in value)) {
          throw new Error(`${label}.${key} is required.`);
        }

        return [key, parseParameterValue(component, (value as Record<string, unknown>)[key], `${label}.${key}`)];
      }),
    );
  }

  throw new Error(`${label} must be a tuple JSON object or array.`);
}

function parseParameterValue(parameter: AbiParameter, value: unknown, label: string): unknown {
  if (parameter.type.endsWith(']')) {
    const arrayValue = typeof value === 'string' ? parseJsonValue(value, label) : value;

    if (!Array.isArray(arrayValue)) {
      throw new Error(`${label} must be a JSON array.`);
    }

    const baseType = parameter.type.slice(0, parameter.type.lastIndexOf('['));
    const baseParameter = {
      ...parameter,
      type: baseType,
    } satisfies AbiParameter;

    return arrayValue.map((item, index) => parseParameterValue(baseParameter, item, `${label}[${index}]`));
  }

  if (parameter.type === 'tuple') {
    const tupleValue = typeof value === 'string' ? parseJsonValue(value, label) : value;
    return parseTupleValue(parameter, tupleValue as AbiTupleValue, label);
  }

  const rawValue = typeof value === 'string' ? value.trim() : value;

  if (typeof rawValue !== 'string') {
    if (typeof rawValue === 'boolean' && parameter.type === 'bool') {
      return rawValue;
    }

    if (typeof rawValue === 'number' && isIntegerType(parameter.type)) {
      return BigInt(rawValue);
    }
  }

  if (typeof rawValue !== 'string') {
    throw new Error(`${label} has an unsupported input format.`);
  }

  if (!rawValue && parameter.type !== 'string') {
    throw new Error(`${label} is required.`);
  }

  if (parameter.type === 'address') {
    if (!isAddress(rawValue)) {
      throw new Error(`${label} must be a valid address.`);
    }

    return rawValue;
  }

  if (parameter.type === 'bool') {
    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    throw new Error(`${label} must be true or false.`);
  }

  if (isIntegerType(parameter.type)) {
    try {
      return BigInt(rawValue);
    } catch {
      throw new Error(`${label} must be an integer.`);
    }
  }

  if (isBytesType(parameter.type)) {
    return ensureHexValue(rawValue, label);
  }

  if (parameter.type === 'string') {
    return rawValue;
  }

  return rawValue;
}

export function parseContractAbiJson(abiJson: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(abiJson);
  } catch {
    throw new Error('ABI must be valid JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('ABI must be a JSON array.');
  }

  return parsed as Abi;
}

export function analyzeContractArtifactAbi(abiJson: string) {
  const abi = parseContractAbiJson(abiJson);
  const functions = abi.filter(isAbiFunctionItem);
  const eventCount = abi.filter((item) => typeof item === 'object' && item !== null && 'type' in item && item.type === 'event').length;

  return {
    abi,
    functionCount: functions.length,
    eventCount,
  };
}

export function getContractFunctions(abiJson: string) {
  const abi = parseContractAbiJson(abiJson);

  return abi.filter(isAbiFunctionItem).map(
    (fn): EvmContractFunctionDescriptor => ({
      name: fn.name,
      signature: getFunctionSignature(fn),
      stateMutability: fn.stateMutability,
      inputs: fn.inputs,
      outputs: fn.outputs ?? [],
    }),
  );
}

export function getReadContractFunctions(abiJson: string) {
  return getContractFunctions(abiJson).filter((fn) => fn.stateMutability === 'view' || fn.stateMutability === 'pure');
}

export function getWriteContractFunctions(abiJson: string) {
  return getContractFunctions(abiJson).filter((fn) => fn.stateMutability === 'nonpayable' || fn.stateMutability === 'payable');
}

export function getContractFunctionBySignature(abiJson: string, signature: string) {
  const fn = getContractFunctions(abiJson).find((item) => item.signature === signature);

  if (!fn) {
    throw new Error('Selected contract function was not found in the ABI.');
  }

  return fn;
}

export function getContractConstructor(abiJson: string): EvmContractConstructorDescriptor {
  const abi = parseContractAbiJson(abiJson);
  const constructorItem = abi.find(isAbiConstructorItem);

  if (!constructorItem) {
    return {
      stateMutability: 'nonpayable',
      inputs: [],
    };
  }

  return {
    stateMutability: constructorItem.stateMutability === 'payable' ? 'payable' : 'nonpayable',
    inputs: constructorItem.inputs,
  };
}

export function parseContractFunctionArgs(inputs: readonly AbiParameter[], rawValues: string[]) {
  if (inputs.length !== rawValues.length) {
    throw new Error('Function argument count does not match the ABI definition.');
  }

  return inputs.map((input, index) => parseParameterValue(input, rawValues[index] ?? '', input.name || `Argument ${index + 1}`));
}
