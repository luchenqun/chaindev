"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SimpleDetailSkeleton } from "@/components/ui/loading-placeholders";
import { getCosmosBlockByHeightDirect } from "@/domains/cosmos/client/queries";
import { AppShell } from "@/platform/layout/app-shell";

export default function CosmosBlockDetailPage() {
  const params = useParams<{ height: string }>();
  const height = params.height;
  const isValid = useMemo(() => /^\d+$/.test(height), [height]);
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getCosmosBlockByHeightDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosBlockByHeightDirect(Number(height));

        if (!cancelled) {
          setBlock(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBlock(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load Cosmos block.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [height, isValid]);

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid block height</h1>
          <p>The block height must be a non-negative integer.</p>
        </main>
      </AppShell>
    );
  }

  if (!block) {
    if (!errorMessage) {
      return (
        <AppShell>
          <SimpleDetailSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load block</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="content-grid">
        <section className="content-panel">
          <span className="kicker">Cosmos Block</span>
          <h1>Block #{block.height}</h1>
          <p>Show height, hash, and timestamp as the base for future message and event expansion.</p>
        </section>
        <section className="detail-card">
          <dl className="detail-list">
            <div>
              <dt>Height</dt>
              <dd>{block.height}</dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd className="mono">{block.hash}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{block.timestamp ?? "Unavailable"}</dd>
            </div>
          </dl>
        </section>
      </main>
    </AppShell>
  );
}
