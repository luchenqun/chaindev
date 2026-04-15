'use client';

import { useEffect, useState } from 'react';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { getCosmosProposalsDirect } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosProposalsPage() {
  const [proposals, setProposals] = useState<Awaited<
    ReturnType<typeof getCosmosProposalsDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosProposalsDirect();

        if (!cancelled) {
          setProposals(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setProposals(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load proposals.',
          );
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, []);

  if (!proposals) {
    if (!errorMessage) {
      return (
        <AppShell>
          <ListPageSkeleton
            titleWidth="w-24"
            rows={8}
            columns={3}
            showToolbar={false}
          />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load proposals</h1>
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
            <span className="kicker">Cosmos Governance</span>
            <h1>Proposals</h1>
          </div>
          <p className="eyebrow">
            The current phase focuses on the proposal list and basic status
            fields.
          </p>
        </div>
        <div className="table-card">
          <table className="table-shell">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal) => (
                <tr key={proposal.id}>
                  <td>{proposal.id}</td>
                  <td>{proposal.title ?? 'Untitled Proposal'}</td>
                  <td>{proposal.status ?? 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
