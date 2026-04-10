"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SimpleDetailSkeleton } from "@/components/ui/loading-placeholders";
import { getActiveEvmCurrencyNameClient, getEvmAddressSummaryDirect } from "@/domains/evm/client/queries";
import { AppShell } from "@/platform/layout/app-shell";

export default function EvmAddressPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(address), [address]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getEvmAddressSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currencyName = getActiveEvmCurrencyNameClient();

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmAddressSummaryDirect(address);

        if (!cancelled) {
          setSummary(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load address summary.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [address, isValid]);

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid address</h1>
          <p>The address must be a 20-byte hex string.</p>
        </main>
      </AppShell>
    );
  }

  if (!summary) {
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
          <h1>Failed to load address</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="content-grid">
        <section className="content-panel">
          <span className="kicker">EVM Address</span>
          <h1>Address Detail</h1>
          <p>The first version shows balance, nonce, and a placeholder for recent activity.</p>
        </section>
        <section className="detail-card">
          <dl className="detail-list">
            <div>
              <dt>Address</dt>
              <dd className="mono">{summary.address}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{summary.balance} {currencyName}</dd>
            </div>
            <div>
              <dt>Nonce</dt>
              <dd>{summary.nonce}</dd>
            </div>
          </dl>
        </section>
      </main>
    </AppShell>
  );
}
