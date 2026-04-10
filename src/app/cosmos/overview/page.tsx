"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OverviewCardsSkeleton } from "@/components/ui/loading-placeholders";
import { getCosmosOverviewDirect } from "@/domains/cosmos/client/queries";
import { CosmosOverviewCard } from "@/domains/cosmos/ui/overview-card";
import { AppShell } from "@/platform/layout/app-shell";

export default function CosmosOverviewPage() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getCosmosOverviewDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosOverviewDirect();

        if (!cancelled) {
          setOverview(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setOverview(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load Cosmos overview.");
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

  if (!overview) {
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
          <h1>Cosmos node is temporarily unavailable</h1>
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
            <span className="kicker">Cosmos Overview</span>
            <h1>Cosmos Chain Overview</h1>
          </div>
          <span className="status-badge">RPC + REST</span>
        </div>
        <section className="card-grid">
          <CosmosOverviewCard
            eyebrow="Chain"
            title="Current Chain"
            value={overview.chainLabel}
            note="The current view follows the active Cosmos provider selected in the top navigation."
          />
          <CosmosOverviewCard
            eyebrow="Latest Height"
            title="Latest Height"
            value={overview.latestHeight}
            note="Loaded directly from the selected Cosmos RPC endpoint."
          />
          <CosmosOverviewCard
            eyebrow="Workbench"
            title="Debug Path"
            value="RPC / REST"
            note="Continue into the tool pages to build requests and save drafts."
          />
        </section>
        <section className="entry-grid">
          <Link className="content-panel" href="/cosmos/validators">
            <span className="kicker">Explorer</span>
            <h2>Validators</h2>
            <p>Inspect the validator list and its basic status fields.</p>
          </Link>
          <Link className="content-panel" href="/cosmos/tools/rpc">
            <span className="kicker">Workbench</span>
            <h2>RPC / REST Debug</h2>
            <p>Add a Cosmos provider first, then debug node requests and responses from one shared entry point.</p>
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
