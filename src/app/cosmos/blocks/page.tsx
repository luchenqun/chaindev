"use client";

import { useEffect, useState } from "react";
import { ListPageSkeleton } from "@/components/ui/loading-placeholders";
import { getRecentCosmosBlocksDirect } from "@/domains/cosmos/client/queries";
import { CosmosBlockTable } from "@/domains/cosmos/ui/block-table";
import { AppShell } from "@/platform/layout/app-shell";

export default function CosmosBlocksPage() {
  const [blocks, setBlocks] = useState<Awaited<ReturnType<typeof getRecentCosmosBlocksDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getRecentCosmosBlocksDirect();

        if (!cancelled) {
          setBlocks(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBlocks(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load Cosmos blocks.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, []);

  if (!blocks) {
    if (!errorMessage) {
      return (
        <AppShell>
          <ListPageSkeleton titleWidth="w-32" rows={8} columns={4} showToolbar={false} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load block list</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main>
        <div className="page-header">
          <div>
            <span className="kicker">Cosmos Explorer</span>
            <h1>Recent Blocks</h1>
          </div>
          <p className="eyebrow">Loaded from the latest height sequence on the selected Cosmos provider.</p>
        </div>
        <CosmosBlockTable blocks={blocks} hrefPrefix="/cosmos/block" />
      </main>
    </AppShell>
  );
}
