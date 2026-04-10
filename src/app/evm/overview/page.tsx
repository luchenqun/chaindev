"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OverviewCardsSkeleton } from "@/components/ui/loading-placeholders";
import { EvmOverviewCard } from "@/domains/evm/ui/overview-card";
import { getLatestEvmBlockSummaryDirect } from "@/domains/evm/client/queries";
import { AppShell } from "@/platform/layout/app-shell";

export default function EvmOverviewPage() {
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getLatestEvmBlockSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getLatestEvmBlockSummaryDirect();

        if (!cancelled) {
          setBlock(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBlock(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load EVM overview.");
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

  if (!block) {
    if (!errorMessage) {
      return (
        <AppShell>
          <OverviewCardsSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <span className="kicker">EVM Overview</span>
          <h1>Node is temporarily unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="page-header">
          <div>
            <span className="kicker">EVM Overview</span>
            <h1>EVM Chain Overview</h1>
          </div>
          <span className="status-badge">Direct JSON-RPC</span>
        </div>
        <section className="card-grid">
          <EvmOverviewCard
            eyebrow="Latest Block"
            title="Block Height"
            value={block.height}
            note="Loaded from the currently selected EVM provider."
          />
          <EvmOverviewCard
            eyebrow="Transactions"
            title="Transaction Count"
            value={block.txCount}
            note="Shows the transaction count in the latest block."
          />
          <EvmOverviewCard
            eyebrow="Hash"
            title="Block Hash"
            value={block.hash.slice(0, 18) || "Unavailable"}
            note="Open the detail page to inspect full fields and raw responses."
          />
        </section>
        <section className="entry-grid">
          <Link className="content-panel" href="/evm/blocks">
            <span className="kicker">Explorer</span>
            <h2>Block List</h2>
            <p>Browse recent blocks and jump into block detail pages by height.</p>
          </Link>
          <Link className="content-panel" href="/evm/tools/rpc">
            <span className="kicker">Workbench</span>
            <h2>RPC Debug</h2>
            <p>Add an EVM provider, then build JSON-RPC requests and inspect raw upstream responses.</p>
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
