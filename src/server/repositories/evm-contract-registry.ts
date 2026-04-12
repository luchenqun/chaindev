import { desc, eq } from "drizzle-orm";
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
