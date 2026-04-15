'use client';

import { useEffect, useState } from 'react';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { getCosmosValidatorsDirect } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosValidatorsPage() {
  const [validators, setValidators] = useState<Awaited<
    ReturnType<typeof getCosmosValidatorsDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosValidatorsDirect();

        if (!cancelled) {
          setValidators(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setValidators(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load validators.',
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

  if (!validators) {
    if (!errorMessage) {
      return (
        <AppShell>
          <ListPageSkeleton
            titleWidth="w-28"
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
          <h1>Failed to load validators</h1>
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
            <h1>Validators</h1>
          </div>
          <p className="eyebrow">
            Show the validator list returned by the selected REST endpoint.
          </p>
        </div>
        <div className="table-card">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Moniker</th>
                <th>Operator</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {validators.map((validator) => (
                <tr key={validator.operator_address}>
                  <td>{validator.description?.moniker ?? 'Unnamed'}</td>
                  <td className="mono">{validator.operator_address}</td>
                  <td>{validator.status ?? 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
