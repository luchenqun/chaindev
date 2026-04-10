"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DetailPageSkeleton } from "@/components/ui/loading-placeholders";
import { getCosmosTxByHashDirect } from "@/domains/cosmos/client/queries";
import { CosmosTxSummary } from "@/domains/cosmos/ui/tx-summary";
import { AppShell } from "@/platform/layout/app-shell";

export default function CosmosTxPage() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash;
  const isValid = useMemo(() => /^[A-Fa-f0-9]{64}$/.test(hash), [hash]);
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getCosmosTxByHashDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosTxByHashDirect(hash);

        if (!cancelled) {
          setTransaction(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTransaction(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load Cosmos transaction.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [hash, isValid]);

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid transaction hash</h1>
          <p>The transaction hash must be a 32-byte hex string.</p>
        </main>
      </AppShell>
    );
  }

  if (!transaction) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-52" groups={2} rowsPerGroup={4} secondaryCard={false} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load transaction</h1>
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
            <span className="kicker">Cosmos Transaction</span>
            <h1>Transaction Detail</h1>
          </div>
          <p className="eyebrow">The first version shows summary fields and the raw log.</p>
        </div>
        <CosmosTxSummary transaction={transaction} />
      </main>
    </AppShell>
  );
}
