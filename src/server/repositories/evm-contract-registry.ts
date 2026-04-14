import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { isAddress } from "viem";
import { db } from "@/db/client";
import { evmContractArtifacts, evmContractBindings } from "@/db/schema/workbench";
import type {
  ImportedEvmContractArtifact,
  ImportedEvmContractBinding,
} from "@/server/schemas/workbench-migration";

function getScopedImportId(userId: string, localId: string) {
  return `${userId}:${localId}`;
}

function normalizeBindingAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error("Contract address must be a valid EVM address.");
  }

  return address.toLowerCase();
}

export async function listServerEvmContractArtifacts(userId: string) {
  return db
    .select()
    .from(evmContractArtifacts)
    .where(eq(evmContractArtifacts.userId, userId))
    .orderBy(desc(evmContractArtifacts.updatedAt));
}

export async function listServerEvmContractBindings(userId: string) {
  return db
    .select()
    .from(evmContractBindings)
    .where(eq(evmContractBindings.userId, userId))
    .orderBy(desc(evmContractBindings.updatedAt));
}

export async function createServerEvmContractArtifact(input: {
  userId: string;
  name: string;
  abiJson: string;
  bytecode: string | null;
  functionCount: number;
  eventCount: number;
}) {
  const now = Date.now();
  const row = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name.trim(),
    abiJson: input.abiJson,
    bytecode: input.bytecode,
    functionCount: input.functionCount,
    eventCount: input.eventCount,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(evmContractArtifacts).values(row).run();
  return row;
}

export async function updateServerEvmContractArtifact(input: {
  userId: string;
  id: string;
  name: string;
  abiJson: string;
  bytecode: string | null;
  functionCount: number;
  eventCount: number;
}) {
  db
    .update(evmContractArtifacts)
    .set({
      name: input.name.trim(),
      abiJson: input.abiJson,
      bytecode: input.bytecode,
      functionCount: input.functionCount,
      eventCount: input.eventCount,
      updatedAt: Date.now(),
    })
    .where(and(eq(evmContractArtifacts.userId, input.userId), eq(evmContractArtifacts.id, input.id)))
    .run();

  return (
    (await db.query.evmContractArtifacts.findFirst({
      where: and(eq(evmContractArtifacts.userId, input.userId), eq(evmContractArtifacts.id, input.id)),
    })) ?? null
  );
}

export async function deleteServerEvmContractArtifact(userId: string, id: string) {
  const binding = await db.query.evmContractBindings.findFirst({
    where: and(eq(evmContractBindings.userId, userId), eq(evmContractBindings.artifactId, id)),
  });

  if (binding) {
    throw new Error("Remove deployed bindings for this artifact before deleting it.");
  }

  db.delete(evmContractArtifacts).where(and(eq(evmContractArtifacts.userId, userId), eq(evmContractArtifacts.id, id))).run();
  return { id };
}

export async function createServerEvmContractBinding(input: {
  userId: string;
  artifactId: string;
  address: string;
  label: string;
  chainId: string;
  providerProfileId: string;
  providerName: string;
}) {
  const artifact = await db.query.evmContractArtifacts.findFirst({
    where: and(eq(evmContractArtifacts.userId, input.userId), eq(evmContractArtifacts.id, input.artifactId)),
  });

  if (!artifact) {
    throw new Error("Select a saved artifact first.");
  }

  const addressLower = normalizeBindingAddress(input.address);
  const duplicate = await db.query.evmContractBindings.findFirst({
    where: and(
      eq(evmContractBindings.userId, input.userId),
      eq(evmContractBindings.providerProfileId, input.providerProfileId),
      eq(evmContractBindings.chainId, input.chainId),
      eq(evmContractBindings.addressLower, addressLower),
    ),
  });

  if (duplicate) {
    throw new Error("This contract address is already bound under the current provider scope.");
  }

  const now = Date.now();
  const row = {
    id: randomUUID(),
    userId: input.userId,
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

  db.insert(evmContractBindings).values(row).run();
  return row;
}

export async function updateServerEvmContractBinding(input: {
  userId: string;
  id: string;
  artifactId: string;
  address: string;
  label: string;
  chainId: string;
  providerProfileId: string;
  providerName: string;
}) {
  const artifact = await db.query.evmContractArtifacts.findFirst({
    where: and(eq(evmContractArtifacts.userId, input.userId), eq(evmContractArtifacts.id, input.artifactId)),
  });

  if (!artifact) {
    throw new Error("Select a saved artifact first.");
  }

  const addressLower = normalizeBindingAddress(input.address);
  const duplicate = await db.query.evmContractBindings.findFirst({
    where: and(
      eq(evmContractBindings.userId, input.userId),
      eq(evmContractBindings.providerProfileId, input.providerProfileId),
      eq(evmContractBindings.chainId, input.chainId),
      eq(evmContractBindings.addressLower, addressLower),
    ),
  });

  if (duplicate && duplicate.id !== input.id) {
    throw new Error("This contract address is already bound under the current provider scope.");
  }

  db
    .update(evmContractBindings)
    .set({
      artifactId: input.artifactId,
      address: input.address,
      addressLower,
      label: input.label.trim() || input.address,
      chainId: input.chainId,
      providerProfileId: input.providerProfileId,
      providerName: input.providerName,
      updatedAt: Date.now(),
    })
    .where(and(eq(evmContractBindings.userId, input.userId), eq(evmContractBindings.id, input.id)))
    .run();

  return (
    (await db.query.evmContractBindings.findFirst({
      where: and(eq(evmContractBindings.userId, input.userId), eq(evmContractBindings.id, input.id)),
    })) ?? null
  );
}

export async function deleteServerEvmContractBinding(userId: string, id: string) {
  db.delete(evmContractBindings).where(and(eq(evmContractBindings.userId, userId), eq(evmContractBindings.id, id))).run();
  return { id };
}

export async function importServerEvmContractRegistry(
  userId: string,
  input: {
    artifacts: ImportedEvmContractArtifact[];
    bindings: ImportedEvmContractBinding[];
  },
) {
  const artifactIdMap = new Map<string, string>();

  for (const artifact of input.artifacts) {
    const scopedArtifactId = getScopedImportId(userId, artifact.id);
    artifactIdMap.set(artifact.id, scopedArtifactId);

    db.delete(evmContractArtifacts).where(eq(evmContractArtifacts.id, scopedArtifactId)).run();
    db.insert(evmContractArtifacts)
      .values({
        id: scopedArtifactId,
        userId,
        name: artifact.name.trim(),
        abiJson: artifact.abiJson,
        bytecode: artifact.bytecode ?? null,
        functionCount: artifact.functionCount,
        eventCount: artifact.eventCount,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      })
      .run();
  }

  for (const binding of input.bindings) {
    const scopedBindingId = getScopedImportId(userId, binding.id);
    const scopedArtifactId =
      artifactIdMap.get(binding.artifactId) ?? getScopedImportId(userId, binding.artifactId);
    const addressLower = binding.addressLower?.toLowerCase() ?? normalizeBindingAddress(binding.address);

    db.delete(evmContractBindings).where(eq(evmContractBindings.id, scopedBindingId)).run();
    db.insert(evmContractBindings)
      .values({
        id: scopedBindingId,
        userId,
        artifactId: scopedArtifactId,
        address: binding.address,
        addressLower,
        label: binding.label.trim() || binding.address,
        chainId: binding.chainId,
        providerProfileId: binding.providerProfileId,
        providerName: binding.providerName,
        createdAt: binding.createdAt,
        updatedAt: binding.updatedAt,
      })
      .run();
  }

  return {
    artifacts: await listServerEvmContractArtifacts(userId),
    bindings: await listServerEvmContractBindings(userId),
  };
}
