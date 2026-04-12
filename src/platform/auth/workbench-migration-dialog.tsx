"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  listAllEvmAddressTagsForMigration,
  replaceAllEvmAddressTagsForMigration,
  type EvmAddressTagMigrationItem,
} from "@/domains/evm/client/address-tags";
import {
  listEvmContractArtifacts,
  listEvmContractBindings,
  replaceEvmContractRegistryStore,
  type EvmContractArtifact,
  type EvmContractBinding,
} from "@/domains/evm/client/contract-registry";
import {
  clearActiveRpcProfileCookie,
  fetchRpcProfiles,
  getLocalSelectedRpcProfiles,
  listLocalRpcProfiles,
  replaceLocalRpcProfiles,
  replaceLocalSelectedRpcProfiles,
  writeActiveRpcProfileCookie,
} from "@/platform/workbench/rpc-profile-client";
import type { RpcProfile } from "@/platform/workbench/rpc-profile";

type MigrationSnapshot = {
  profiles: RpcProfile[];
  tags: EvmAddressTagMigrationItem[];
  artifacts: EvmContractArtifact[];
  bindings: EvmContractBinding[];
};

type MigrationState = {
  fingerprint: string;
};

const STORAGE_KEY_PREFIX = "chaindev-workbench-migration-state-v1";

function buildFingerprint(snapshot: MigrationSnapshot) {
  return JSON.stringify({
    profiles: snapshot.profiles.map((item) => `${item.id}:${item.updatedAt}`),
    tags: snapshot.tags.map((item) => `${item.providerProfileId}:${item.addressLower}:${item.updatedAt}`),
    artifacts: snapshot.artifacts.map((item) => `${item.id}:${item.updatedAt}`),
    bindings: snapshot.bindings.map((item) => `${item.id}:${item.updatedAt}`),
  });
}

function getMigrationStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function readMigrationState(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getMigrationStorageKey(userId));
    return raw ? (JSON.parse(raw) as MigrationState) : null;
  } catch {
    return null;
  }
}

function writeMigrationState(userId: string, value: MigrationState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getMigrationStorageKey(userId), JSON.stringify(value));
}

function loadMigrationSnapshot(): MigrationSnapshot {
  return {
    profiles: listLocalRpcProfiles(),
    tags: listAllEvmAddressTagsForMigration(),
    artifacts: listEvmContractArtifacts(),
    bindings: listEvmContractBindings(),
  };
}

type ServerAddressTagsResponse = {
  ok: boolean;
  data: Array<{
    providerProfileId: string;
    providerName: string | null;
    address: string;
    addressLower: string;
    nameTag: string;
    updatedAt: number;
  }>;
};

type ServerContractRegistryResponse = {
  ok: boolean;
  data: {
    artifacts: EvmContractArtifact[];
    bindings: EvmContractBinding[];
  };
};

export function WorkbenchMigrationDialog() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MigrationSnapshot | null>(null);
  const [skipped, setSkipped] = useState<{ tags: number; bindings: number }>({ tags: 0, bindings: 0 });

  const fingerprint = useMemo(() => (snapshot ? buildFingerprint(snapshot) : ""), [snapshot]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      return;
    }

    let cancelled = false;

    async function syncServerDataToLocal() {
      try {
        const rpcData = await fetchRpcProfiles();

        if (cancelled || rpcData.source !== "server") {
          return;
        }

        replaceLocalRpcProfiles(rpcData.profiles);
        const currentSelected = getLocalSelectedRpcProfiles();
        const normalizedSelected = {
          evm:
            currentSelected.evm && rpcData.profiles.some((profile) => profile.id === currentSelected.evm)
              ? currentSelected.evm
              : rpcData.profiles.find((profile) => profile.mode === "evm")?.id,
          cosmos:
            currentSelected.cosmos && rpcData.profiles.some((profile) => profile.id === currentSelected.cosmos)
              ? currentSelected.cosmos
              : rpcData.profiles.find((profile) => profile.mode === "cosmos")?.id,
        };

        replaceLocalSelectedRpcProfiles(normalizedSelected);

        const nextEvmProfile =
          rpcData.profiles.find((profile) => profile.id === normalizedSelected.evm) ??
          rpcData.profiles.find((profile) => profile.mode === "evm") ??
          null;
        const nextCosmosProfile =
          rpcData.profiles.find((profile) => profile.id === normalizedSelected.cosmos) ??
          rpcData.profiles.find((profile) => profile.mode === "cosmos") ??
          null;

        if (nextEvmProfile) {
          writeActiveRpcProfileCookie(nextEvmProfile);
        } else {
          clearActiveRpcProfileCookie("evm");
        }

        if (nextCosmosProfile) {
          writeActiveRpcProfileCookie(nextCosmosProfile);
        } else {
          clearActiveRpcProfileCookie("cosmos");
        }

        const [tagsResponse, registryResponse] = await Promise.all([
          fetch("/api/workbench/evm/address-tags", { cache: "no-store" }),
          fetch("/api/workbench/evm/contract-registry", { cache: "no-store" }),
        ]);

        if (cancelled) {
          return;
        }

        if (tagsResponse.ok) {
          const tagsBody = (await tagsResponse.json()) as ServerAddressTagsResponse;
          replaceAllEvmAddressTagsForMigration(
            tagsBody.data.map((item) => ({
              providerProfileId: item.providerProfileId,
              address: item.address,
              addressLower: item.addressLower,
              nameTag: item.nameTag,
              updatedAt: item.updatedAt,
            })),
          );
        }

        if (registryResponse.ok) {
          const registryBody = (await registryResponse.json()) as ServerContractRegistryResponse;
          replaceEvmContractRegistryStore(registryBody.data);
        }
      } catch {
        return;
      }
    }

    void syncServerDataToLocal();

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      setOpen(false);
      return;
    }

    const nextSnapshot = loadMigrationSnapshot();
    const nextFingerprint = buildFingerprint(nextSnapshot);
    const hasData =
      nextSnapshot.profiles.length ||
      nextSnapshot.tags.length ||
      nextSnapshot.artifacts.length ||
      nextSnapshot.bindings.length;

    if (!hasData) {
      setOpen(false);
      return;
    }

    const storedState = readMigrationState(userId);

    if (storedState?.fingerprint === nextFingerprint) {
      setOpen(false);
      return;
    }

    setSnapshot(nextSnapshot);
    setError(null);
    setSkipped({ tags: 0, bindings: 0 });
    setOpen(true);
  }, [status, userId]);

  async function handleMigrate() {
    if (!snapshot || !userId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await fetch("/api/workbench/rpc-profiles/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profiles: snapshot.profiles,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? "Failed to import providers.");
        }
      });

      const providerMap = new Map(snapshot.profiles.map((profile) => [profile.id, `${userId}:${profile.id}`]));
      const providerNameMap = new Map(snapshot.profiles.map((profile) => [profile.id, profile.name]));
      const artifactIdSet = new Set(snapshot.artifacts.map((artifact) => artifact.id));
      const localSelected = getLocalSelectedRpcProfiles();

      const migratableTags = snapshot.tags
        .filter((tag) => providerMap.has(tag.providerProfileId))
        .map((tag) => ({
          providerProfileId: providerMap.get(tag.providerProfileId) ?? tag.providerProfileId,
          providerName: providerNameMap.get(tag.providerProfileId) ?? null,
          address: tag.address,
          addressLower: tag.addressLower,
          nameTag: tag.nameTag,
          updatedAt: tag.updatedAt,
        }));

      const migratableBindings = snapshot.bindings
        .filter((binding) => providerMap.has(binding.providerProfileId) && artifactIdSet.has(binding.artifactId))
        .map((binding) => ({
          ...binding,
          providerProfileId: providerMap.get(binding.providerProfileId) ?? binding.providerProfileId,
        }));

      if (migratableTags.length) {
        await fetch("/api/workbench/evm/address-tags/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tags: migratableTags,
          }),
        }).then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
            throw new Error(body?.error?.message ?? "Failed to import address tags.");
          }
        });
      }

      if (snapshot.artifacts.length || migratableBindings.length) {
        await fetch("/api/workbench/evm/contract-registry/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            artifacts: snapshot.artifacts,
            bindings: migratableBindings,
          }),
        }).then(async (response) => {
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
            throw new Error(body?.error?.message ?? "Failed to import artifacts and bindings.");
          }
        });
      }

      setSkipped({
        tags: snapshot.tags.length - migratableTags.length,
        bindings: snapshot.bindings.length - migratableBindings.length,
      });
      replaceLocalSelectedRpcProfiles({
        evm: localSelected.evm ? providerMap.get(localSelected.evm) : undefined,
        cosmos: localSelected.cosmos ? providerMap.get(localSelected.cosmos) : undefined,
      });
      writeMigrationState(userId, { fingerprint });
      setOpen(false);
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : "Migration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!snapshot) {
    return null;
  }

  return (
    <ModalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
      }}
      title="Migrate Local Workspace Data"
      description="Import your local providers, address tags, artifacts, and bindings into the signed-in account."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Later
          </Button>
          <Button type="button" onClick={() => void handleMigrate()} disabled={loading}>
            {loading ? "Migrating..." : "Migrate Now"}
          </Button>
        </>
      }
      maxWidthClassName="max-w-xl"
    >
      <div className="grid gap-4 pb-1">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span>Providers</span>
            <span className="font-semibold text-slate-900">{snapshot.profiles.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Address Tags</span>
            <span className="font-semibold text-slate-900">{snapshot.tags.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Artifacts</span>
            <span className="font-semibold text-slate-900">{snapshot.artifacts.length}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Bindings</span>
            <span className="font-semibold text-slate-900">{snapshot.bindings.length}</span>
          </div>
        </div>

        {skipped.tags || skipped.bindings ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Skipped {skipped.tags} tags and {skipped.bindings} bindings because their provider or artifact references
            no longer exist locally.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}
      </div>
    </ModalDialog>
  );
}
