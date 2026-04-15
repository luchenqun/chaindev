'use client';

import { isAddress } from 'viem';
import { z } from 'zod';
import {
  analyzeContractArtifactAbi,
  parseContractAbiJson,
} from '@/domains/evm/client/abi-utils';

const artifactSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(['system', 'user']),
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

const listeners = new Set<() => void>();
let cache: z.infer<typeof registryStoreSchema> = {
  artifacts: [],
  bindings: [],
};
let loaded = false;
let loadingPromise: Promise<void> | null = null;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function createAuthRequiredError() {
  const error = new Error('AUTH_REQUIRED');
  error.name = 'AuthRequiredError';
  return error;
}

function readRegistryStore() {
  return cache;
}

function writeRegistryStore(value: z.infer<typeof registryStoreSchema>) {
  cache = registryStoreSchema.parse(value);
  loaded = true;
}

async function parseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

function ensureLoaded() {
  if (loaded || loadingPromise) {
    return;
  }

  loadingPromise = syncEvmContractRegistryFromServer().finally(() => {
    loadingPromise = null;
  });
}

export function replaceEvmContractRegistryStore(value: {
  artifacts: EvmContractArtifact[];
  bindings: EvmContractBinding[];
}) {
  writeRegistryStore(value);
  emitChange();
}

export async function syncEvmContractRegistryFromServer() {
  const response = await fetch('/api/workbench/evm/contract-registry', {
    cache: 'no-store',
  });

  if (response.status === 401) {
    writeRegistryStore({
      artifacts: [],
      bindings: [],
    });
    emitChange();
    return;
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to load contract registry.'),
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: {
      artifacts: EvmContractArtifact[];
      bindings: EvmContractBinding[];
    };
  };
  writeRegistryStore(body.data);
  emitChange();
}

function normalizeBytecode(bytecode: string) {
  const value = bytecode.trim();

  if (!value) {
    return null;
  }

  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Bytecode must be a valid hex string.');
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
  return typeof value === 'object' && value !== null;
}

function getArtifactName(value: Record<string, unknown>) {
  if (typeof value.contractName === 'string' && value.contractName.trim()) {
    return value.contractName.trim();
  }

  if (typeof value.name === 'string' && value.name.trim()) {
    return value.name.trim();
  }

  if (typeof value.sourceName === 'string' && value.sourceName.trim()) {
    const sourceName = value.sourceName.trim().split(/[\\/]/).pop() ?? '';
    return sourceName.replace(/\.[^.]+$/, '');
  }

  return '';
}

function normalizeImportedBytecode(bytecode: string) {
  const value = bytecode.trim();

  if (!value) {
    return '';
  }

  if (value.startsWith('0x')) {
    return value;
  }

  if (/^[0-9a-fA-F]+$/.test(value)) {
    return `0x${value}`;
  }

  return value;
}

function getImportedBytecode(value: Record<string, unknown>) {
  if (typeof value.bytecode === 'string') {
    return normalizeImportedBytecode(value.bytecode);
  }

  if (isRecord(value.bytecode) && typeof value.bytecode.object === 'string') {
    return normalizeImportedBytecode(value.bytecode.object);
  }

  if (
    isRecord(value.evm) &&
    isRecord(value.evm.bytecode) &&
    typeof value.evm.bytecode.object === 'string'
  ) {
    return normalizeImportedBytecode(value.evm.bytecode.object);
  }

  return '';
}

function getImportedAbi(value: Record<string, unknown>) {
  if (Array.isArray(value.abi)) {
    return value.abi;
  }

  if (typeof value.abi === 'string') {
    return parseContractAbiJson(value.abi);
  }

  throw new Error('Artifact JSON must include an ABI array.');
}

export function parseEvmContractArtifactImportPayload(raw: string) {
  const input = raw.trim();

  if (!input) {
    throw new Error('Paste artifact JSON first.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Artifact import must be valid JSON.');
  }

  if (Array.isArray(parsed)) {
    return {
      name: '',
      abiJson: JSON.stringify(
        parseContractAbiJson(JSON.stringify(parsed)),
        null,
        2,
      ),
      bytecode: '',
    };
  }

  if (!isRecord(parsed)) {
    throw new Error('Artifact import must be a JSON object or ABI array.');
  }

  const abi = getImportedAbi(parsed);

  return {
    name: getArtifactName(parsed),
    abiJson: JSON.stringify(abi, null, 2),
    bytecode: getImportedBytecode(parsed),
  };
}

export function listEvmContractArtifacts() {
  ensureLoaded();
  return readRegistryStore().artifacts.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
  );
}

export function getEvmContractArtifact(artifactId: string) {
  ensureLoaded();
  return (
    readRegistryStore().artifacts.find(
      (artifact) => artifact.id === artifactId,
    ) ?? null
  );
}

export async function createEvmContractArtifact(input: {
  scope?: 'system' | 'user';
  name: string;
  abiJson: string;
  bytecode: string;
}) {
  const store = readRegistryStore();
  const name = input.name.trim();

  if (!name) {
    throw new Error('Contract name is required.');
  }

  const { abi } = analyzeContractArtifactAbi(input.abiJson);
  const abiJson = JSON.stringify(abi, null, 2);
  const bytecode = normalizeBytecode(input.bytecode);

  if (
    isDuplicateArtifact(store.artifacts, {
      abiJson: JSON.stringify(abi),
      bytecode,
    })
  ) {
    throw new Error('An identical contract artifact already exists.');
  }

  const response = await fetch('/api/workbench/evm/contract-registry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: 'artifact',
      scope: input.scope ?? 'user',
      name,
      abiJson,
      bytecode,
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to save contract artifact.'),
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: EvmContractArtifact;
  };
  const artifact = body.data;

  writeRegistryStore({
    ...store,
    artifacts: [
      artifact,
      ...store.artifacts.filter((item) => item.id !== artifact.id),
    ],
  });
  emitChange();
  return artifact;
}

export async function updateEvmContractArtifact(
  artifactId: string,
  input: {
    scope?: 'system' | 'user';
    name: string;
    abiJson: string;
    bytecode: string;
  },
) {
  const store = readRegistryStore();
  const previous = store.artifacts.find(
    (artifact) => artifact.id === artifactId,
  );

  if (!previous) {
    throw new Error('Contract artifact not found.');
  }

  const name = input.name.trim();

  if (!name) {
    throw new Error('Contract name is required.');
  }

  const { abi } = analyzeContractArtifactAbi(input.abiJson);
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
    throw new Error('An identical contract artifact already exists.');
  }

  const response = await fetch('/api/workbench/evm/contract-registry', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: artifactId,
      payload: {
        kind: 'artifact',
        scope: input.scope ?? previous.scope,
        name,
        abiJson,
        bytecode,
      },
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to update contract artifact.'),
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: EvmContractArtifact;
  };
  const updated = body.data;

  writeRegistryStore({
    ...store,
    artifacts: [
      updated,
      ...store.artifacts.filter((artifact) => artifact.id !== artifactId),
    ],
  });
  emitChange();
  return updated;
}

export async function deleteEvmContractArtifact(artifactId: string) {
  const store = readRegistryStore();

  if (store.bindings.some((binding) => binding.artifactId === artifactId)) {
    throw new Error(
      'Remove deployed bindings for this artifact before deleting it.',
    );
  }

  const response = await fetch(
    `/api/workbench/evm/contract-registry?id=${encodeURIComponent(artifactId)}&kind=artifact`,
    {
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to delete contract artifact.'),
    );
  }

  writeRegistryStore({
    ...store,
    artifacts: store.artifacts.filter((artifact) => artifact.id !== artifactId),
  });
  emitChange();
}

export function listEvmContractBindings() {
  ensureLoaded();
  return readRegistryStore().bindings.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || left.label.localeCompare(right.label),
  );
}

export function listEvmContractBindingsByScope(
  chainId: string,
  providerProfileId: string,
) {
  return listEvmContractBindings().filter(
    (binding) =>
      binding.chainId === chainId &&
      binding.providerProfileId === providerProfileId,
  );
}

export function getEvmContractBinding(bindingId: string) {
  ensureLoaded();
  return (
    readRegistryStore().bindings.find((binding) => binding.id === bindingId) ??
    null
  );
}

export async function createEvmContractBinding(input: {
  artifactId: string;
  address: string;
  label: string;
  chainId: string;
  providerProfileId: string;
  providerName: string;
}) {
  const store = readRegistryStore();

  if (!store.artifacts.some((artifact) => artifact.id === input.artifactId)) {
    throw new Error('Select a saved artifact first.');
  }

  if (!input.artifactId.trim()) {
    throw new Error('Select a saved artifact first.');
  }

  if (!isAddress(input.address)) {
    throw new Error('Contract address must be a valid EVM address.');
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
    throw new Error(
      'This contract address is already bound under the current provider scope.',
    );
  }

  const response = await fetch('/api/workbench/evm/contract-registry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: 'binding',
      ...input,
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to save bound contract.'),
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: EvmContractBinding;
  };
  const binding = body.data;

  writeRegistryStore({
    ...store,
    bindings: [
      binding,
      ...store.bindings.filter((item) => item.id !== binding.id),
    ],
  });
  emitChange();
  return binding;
}

export async function updateEvmContractBinding(
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
    throw new Error('Bound contract not found.');
  }

  if (!input.artifactId.trim()) {
    throw new Error('Select a saved artifact first.');
  }

  if (!store.artifacts.some((artifact) => artifact.id === input.artifactId)) {
    throw new Error('Select a saved artifact first.');
  }

  if (!isAddress(input.address)) {
    throw new Error('Contract address must be a valid EVM address.');
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
    throw new Error(
      'This contract address is already bound under the current provider scope.',
    );
  }

  const response = await fetch('/api/workbench/evm/contract-registry', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: bindingId,
      payload: {
        kind: 'binding',
        ...input,
      },
    }),
  });

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to update bound contract.'),
    );
  }

  const body = (await response.json()) as {
    ok: boolean;
    data: EvmContractBinding;
  };
  const updated = body.data;

  writeRegistryStore({
    ...store,
    bindings: [
      updated,
      ...store.bindings.filter((binding) => binding.id !== bindingId),
    ],
  });
  emitChange();
  return updated;
}

export async function deleteEvmContractBinding(bindingId: string) {
  const store = readRegistryStore();

  const response = await fetch(
    `/api/workbench/evm/contract-registry?id=${encodeURIComponent(bindingId)}&kind=binding`,
    {
      method: 'DELETE',
    },
  );

  if (response.status === 401) {
    throw createAuthRequiredError();
  }

  if (!response.ok) {
    throw new Error(
      await parseError(response, 'Failed to delete bound contract.'),
    );
  }

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
