"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SimpleDetailSkeleton } from "@/components/ui/loading-placeholders";
import { getCosmosAccountSummaryDirect } from "@/domains/cosmos/client/queries";
import { AppShell } from "@/platform/layout/app-shell";

export default function CosmosAccountPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getCosmosAccountSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosAccountSummaryDirect(address);

        if (!cancelled) {
          setAccount(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAccount(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load Cosmos account.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [address]);

  if (!account) {
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
          <h1>Failed to load account</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="content-grid">
        <section className="content-panel">
          <span className="kicker">Cosmos Account</span>
          <h1>Account Detail</h1>
          <p>Show balances, sequence, and account number, with room for future staking and delegation data.</p>
        </section>
        <section className="detail-card">
          <dl className="detail-list">
            <div>
              <dt>Address</dt>
              <dd className="mono">{account.address}</dd>
            </div>
            <div>
              <dt>Sequence</dt>
              <dd>{account.sequence}</dd>
            </div>
            <div>
              <dt>Account Number</dt>
              <dd>{account.accountNumber}</dd>
            </div>
            <div>
              <dt>Balances</dt>
              <dd className="mono">
                {account.balances.length
                  ? account.balances.map((item) => `${item.amount} ${item.denom}`).join(", ")
                  : "No balances"}
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </AppShell>
  );
}
