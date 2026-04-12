"use client";

import { isAddress } from "viem";
import { z } from "zod";
import { analyzeContractArtifactAbi, parseContractAbiJson } from "@/domains/evm/client/abi-utils";

const artifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  abiJson: z.string().trim().min(1),
  bytecode: z.string().trim().nullable(),
  functionCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const bindingSchema = z.object({
  id: z.string().min(1),
  artifactId: z.string().min(1),
  address: z.string().min(1),
  addressLower: z.string().min(1),
  label: z.string().trim().min(1),
  chainId: z.string().trim().min(1),
  providerProfileId: z.string().trim().min(1),
  providerName: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const registryStoreSchema = z.object({
  artifacts: z.array(artifactSchema),
  bindings: z.array(bindingSchema),
});

export type EvmContractArtifact = z.infer<typeof artifactSchema>;
export type EvmContractBinding = z.infer<typeof bindingSchema>;

const STORAGE_KEY = "chaindev-evm-contract-registry-v1";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function readRegistryStore() {
  if (typeof window === "undefined") {
    return {
      artifacts: [],
      bindings: [],
    } satisfies z.infer<typeof registryStoreSchema>;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {
        artifacts: [],
        bindings: [],
      } satisfies z.infer<typeof registryStoreSchema>;
    }

    return registryStoreSchema.parse(JSON.parse(raw));
  } catch {
    return {
      artifacts: [],
      bindings: [],
    } satisfies z.infer<typeof registryStoreSchema>;
  }
}

function writeRegistryStore(value: z.infer<typeof registryStoreSchema>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function replaceEvmContractRegistryStore(value: {
  artifacts: EvmContractArtifact[];
  bindings: EvmContractBinding[];
}) {
  writeRegistryStore(registryStoreSchema.parse(value));
  emitChange();
}

function normalizeBytecode(bytecode: string) {
  const value = bytecode.trim();

  if (!value) {
    return null;
  }

  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error("Bytecode must be a valid hex string.");
  }

  return value;
}

function getCanonicalAbiJson(abiJson: string) {
  return JSON.stringify(parseContractAbiJson(abiJson));
}

function isDuplicateArtifact(
  artifacts: EvmContractArtifact[],
  input: {
    abiJson: string;
    bytecode: string | null;
  },
  excludeArtifactId?: string,
) {
  return artifacts.some((artifact) => {
    if (excludeArtifactId && artifact.id === excludeArtifactId) {
      return false;
    }

    return (
      getCanonicalAbiJson(artifact.abiJson) === input.abiJson &&
      (artifact.bytecode ?? null) === input.bytecode
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getArtifactName(value: Record<string, unknown>) {
  if (typeof value.contractName === "string" && value.contractName.trim()) {
    return value.contractName.trim();
  }

  if (typeof value.name === "string" && value.name.trim()) {
    return value.name.trim();
  }

  if (typeof value.sourceName === "string" && value.sourceName.trim()) {
    const sourceName = value.sourceName.trim().split(/[\\/]/).pop() ?? "";
    return sourceName.replace(/\.[^.]+$/, "");
  }

  return "";
}

function normalizeImportedBytecode(bytecode: string) {
  const value = bytecode.trim();

  if (!value) {
    return "";
  }

  if (value.startsWith("0x")) {
    return value;
  }

  if (/^[0-9a-fA-F]+$/.test(value)) {
    return `0x${value}`;
  }

  return value;
}

function getImportedBytecode(value: Record<string, unknown>) {
  if (typeof value.bytecode === "string") {
    return normalizeImportedBytecode(value.bytecode);
  }

  if (isRecord(value.bytecode) && typeof value.bytecode.object === "string") {
    return normalizeImportedBytecode(value.bytecode.object);
  }

  if (
    isRecord(value.evm) &&
    isRecord(value.evm.bytecode) &&
    typeof value.evm.bytecode.object === "string"
  ) {
    return normalizeImportedBytecode(value.evm.bytecode.object);
  }

  return "";
}

function getImportedAbi(value: Record<string, unknown>) {
  if (Array.isArray(value.abi)) {
    return value.abi;
  }

  if (typeof value.abi === "string") {
    return parseContractAbiJson(value.abi);
  }

  throw new Error("Artifact JSON must include an ABI array.");
}

export function parseEvmContractArtifactImportPayload(raw: string) {
  const input = raw.trim();

  if (!input) {
    throw new Error("Paste artifact JSON first.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Artifact import must be valid JSON.");
  }

  if (Array.isArray(parsed)) {
    return {
      name: "",
      abiJson: JSON.stringify(parseContractAbiJson(JSON.stringify(parsed)), null, 2),
      bytecode: "",
    };
  }

  if (!isRecord(parsed)) {
    throw new Error("Artifact import must be a JSON object or ABI array.");
  }

  const abi = getImportedAbi(parsed);

  return {
    name: getArtifactName(parsed),
    abiJson: JSON.stringify(abi, null, 2),
    bytecode: getImportedBytecode(parsed),
  };
}

export function listEvmContractArtifacts() {
  return readRegistryStore().artifacts.sort(
    (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
  );
}

export function getEvmContractArtifact(artifactId: string) {
  return readRegistryStore().artifacts.find((artifact) => artifact.id === artifactId) ?? null;
}

export function createEvmContractArtifact(input: {
  name: string;
  abiJson: string;
  bytecode: string;
}) {
  const now = Date.now();
  const store = readRegistryStore();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Contract name is required.");
  }

  const { abi, functionCount, eventCount } = analyzeContractArtifactAbi(input.abiJson);
  const abiJson = JSON.stringify(abi, null, 2);
  const bytecode = normalizeBytecode(input.bytecode);

  if (
    isDuplicateArtifact(store.artifacts, {
      abiJson: JSON.stringify(abi),
      bytecode,
    })
  ) {
    throw new Error("An identical contract artifact already exists.");
  }

  const artifact: EvmContractArtifact = {
    id: crypto.randomUUID(),
    name,
    abiJson,
    bytecode,
    functionCount,
    eventCount,
    createdAt: now,
    updatedAt: now,
  };

  writeRegistryStore({
    ...store,
    artifacts: [artifact, ...store.artifacts],
  });
  emitChange();
  return artifact;
}

export function updateEvmContractArtifact(
  artifactId: string,
  input: {
    name: string;
    abiJson: string;
    bytecode: string;
  },
) {
  const store = readRegistryStore();
  const previous = store.artifacts.find((artifact) => artifact.id === artifactId);

  if (!previous) {
    throw new Error("Contract artifact not found.");
  }

  const name = input.name.trim();

  if (!name) {
    throw new Error("Contract name is required.");
  }

  const { abi, functionCount, eventCount } = analyzeContractArtifactAbi(input.abiJson);
  const abiJson = JSON.stringify(abi, null, 2);
  const bytecode = normalizeBytecode(input.bytecode);

  if (
    isDuplicateArtifact(
      store.artifacts,
      {
        abiJson: JSON.stringify(abi),
        bytecode,
      },
      artifactId,
    )
  ) {
    throw new Error("An identical contract artifact already exists.");
  }

  const updated: EvmContractArtifact = {
    ...previous,
    name,
    abiJson,
    bytecode,
    functionCount,
    eventCount,
    updatedAt: Date.now(),
  };

  writeRegistryStore({
    ...store,
    artifacts: [updated, ...store.artifacts.filter((artifact) => artifact.id !== artifactId)],
  });
  emitChange();
  return updated;
}

export function deleteEvmContractArtifact(artifactId: string) {
  const store = readRegistryStore();

  if (store.bindings.some((binding) => binding.artifactId === artifactId)) {
    throw new Error("Remove deployed bindings for this artifact before deleting it.");
  }

  writeRegistryStore({
    ...store,
    artifacts: store.artifacts.filter((artifact) => artifact.id !== artifactId),
  });
  emitChange();
}

export function listEvmContractBindings() {
  return readRegistryStore().bindings.sort(
    (left, right) => right.updatedAt - left.updatedAt || left.label.localeCompare(right.label),
  );
}

export function listEvmContractBindingsByScope(chainId: string, providerProfileId: string) {
  return listEvmContractBindings().filter(
    (binding) => binding.chainId === chainId && binding.providerProfileId === providerProfileId,
  );
}

export function getEvmContractBinding(bindingId: string) {
  return readRegistryStore().bindings.find((binding) => binding.id === bindingId) ?? null;
}

export function createEvmContractBinding(input: {
  artifactId: string;
  address: string;
  label: string;
  chainId: string;
  providerProfileId: string;
  providerName: string;
}) {
  const store = readRegistryStore();

  if (!store.artifacts.some((artifact) => artifact.id === input.artifactId)) {
    throw new Error("Select a saved artifact first.");
  }

  if (!input.artifactId.trim()) {
    throw new Error("Select a saved artifact first.");
  }

  if (!isAddress(input.address)) {
    throw new Error("Contract address must be a valid EVM address.");
  }

  const addressLower = input.address.toLowerCase();

  if (
    store.bindings.some(
      (binding) =>
        binding.addressLower === addressLower &&
        binding.chainId === input.chainId &&
        binding.providerProfileId === input.providerProfileId,
    )
  ) {
    throw new Error("This contract address is already bound under the current provider scope.");
  }

  const now = Date.now();
  const binding: EvmContractBinding = {
    id: crypto.randomUUID(),
    artifactId: input.artifactId,
    address: input.address,
    addressLower,
    label: input.label.trim() || input.address,
    chainId: input.chainId,
    providerProfileId: input.providerProfileId,
    providerName: input.providerName,
    createdAt: now,
    updatedAt: now,
  };

  writeRegistryStore({
    ...store,
    bindings: [binding, ...store.bindings],
  });
  emitChange();
  return binding;
}

export function updateEvmContractBinding(
  bindingId: string,
  input: {
    artifactId: string;
    address: string;
    label: string;
    chainId: string;
    providerProfileId: string;
    providerName: string;
  },
) {
  const store = readRegistryStore();
  const previous = store.bindings.find((binding) => binding.id === bindingId);

  if (!previous) {
    throw new Error("Bound contract not found.");
  }

  if (!input.artifactId.trim()) {
    throw new Error("Select a saved artifact first.");
  }

  if (!store.artifacts.some((artifact) => artifact.id === input.artifactId)) {
    throw new Error("Select a saved artifact first.");
  }

  if (!isAddress(input.address)) {
    throw new Error("Contract address must be a valid EVM address.");
  }

  const addressLower = input.address.toLowerCase();

  if (
    store.bindings.some(
      (binding) =>
        binding.id !== bindingId &&
        binding.addressLower === addressLower &&
        binding.chainId === input.chainId &&
        binding.providerProfileId === input.providerProfileId,
    )
  ) {
    throw new Error("This contract address is already bound under the current provider scope.");
  }

  const updated: EvmContractBinding = {
    ...previous,
    artifactId: input.artifactId,
    address: input.address,
    addressLower,
    label: input.label.trim() || input.address,
    chainId: input.chainId,
    providerProfileId: input.providerProfileId,
    providerName: input.providerName,
    updatedAt: Date.now(),
  };

  writeRegistryStore({
    ...store,
    bindings: [updated, ...store.bindings.filter((binding) => binding.id !== bindingId)],
  });
  emitChange();
  return updated;
}

export function deleteEvmContractBinding(bindingId: string) {
  const store = readRegistryStore();

  writeRegistryStore({
    ...store,
    bindings: store.bindings.filter((binding) => binding.id !== bindingId),
  });
  emitChange();
}

export function subscribeEvmContractRegistry(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
