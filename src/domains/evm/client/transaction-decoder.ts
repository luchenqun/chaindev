"use client";

import { decodeFunctionData, toFunctionSelector, type Hex } from "viem";
import { getContractFunctions, parseContractAbiJson } from "@/domains/evm/client/abi-utils";
import {
  getEvmContractArtifact,
  listEvmContractBindings,
} from "@/domains/evm/client/contract-registry";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";

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

function stringifyDecodedValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }

  return JSON.stringify(
    value,
    (_, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
    2,
  );
}

function formatFallbackMethodLabel(inputData: string | undefined, to: string | null | undefined) {
  if (!to) {
    return "Create";
  }

  if (!inputData || inputData === "0x") {
    return "Transfer";
  }

  return inputData.slice(0, 10);
}

function findBoundArtifact(address: string | null | undefined) {
  const profile = readActiveRpcProfileCookie("evm");

  if (!address || !profile) {
    return null;
  }

  const binding = listEvmContractBindings().find(
    (item) =>
      item.providerProfileId === profile.id &&
      item.addressLower === address.toLowerCase(),
  );

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

export function decodeHexToUtf8(value: string) {
  const normalizedValue = value.startsWith("0x") ? value.slice(2) : value;

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.length % 2 !== 0 || /[^0-9a-f]/i.test(normalizedValue)) {
    return null;
  }

  try {
    const bytes = Uint8Array.from(
      normalizedValue.match(/.{1,2}/g)?.map((item) => Number.parseInt(item, 16)) ?? [],
    );

    return new TextDecoder().decode(bytes).replace(/\u0000/g, "");
  } catch {
    return null;
  }
}

export function decodeBoundEvmTransactionInput(input: {
  to: string | null | undefined;
  inputData: string | undefined;
}): EvmDecodedTransactionInput | null {
  const normalizedInputData = input.inputData ?? "0x";
  const boundArtifact = findBoundArtifact(input.to);

  if (!boundArtifact || normalizedInputData === "0x") {
    return null;
  }

  const selector = normalizedInputData.slice(0, 10).toLowerCase();
  const functions = getContractFunctions(boundArtifact.artifact.abiJson);
  const matchedFunction = functions.find(
    (fn) => toFunctionSelector(`function ${fn.signature}`).toLowerCase() === selector,
  );

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

export function resolveEvmTransactionMethodLabel(input: {
  to: string | null | undefined;
  inputData: string | undefined;
  fallbackMethodLabel?: string;
}) {
  const decoded = decodeBoundEvmTransactionInput(input);

  return decoded?.methodLabel ?? input.fallbackMethodLabel ?? formatFallbackMethodLabel(input.inputData, input.to);
}
