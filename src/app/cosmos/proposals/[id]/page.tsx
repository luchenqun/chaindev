'use client';

import JsonView from '@uiw/react-json-view';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getCosmosProposalByIdDirect } from '@/domains/cosmos/client/queries';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  CosmosDetailTag as DetailTag,
  COSMOS_JSON_VIEW_STYLE as JSON_VIEW_STYLE,
  formatTimestampWithSeconds,
} from '@/domains/cosmos/ui/detail-primitives';
import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosProposalPage() {
  const params = useParams<{ id: string }>();
  const proposalId = params.id;
  const [currentVotePage, setCurrentVotePage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'votes' | 'json'>(
    'overview',
  );
  const [proposal, setProposal] = useState<Awaited<
    ReturnType<typeof getCosmosProposalByIdDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLikelyId = useMemo(() => Boolean(proposalId?.trim()), [proposalId]);

  useEffect(() => {
    if (!isLikelyId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosProposalByIdDirect(
          proposalId,
          currentVotePage,
          20,
        );

        if (!cancelled) {
          setProposal(next);
          setErrorMessage(null);

          if (next.votesPage.page !== currentVotePage) {
            setCurrentVotePage(next.votesPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setProposal(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load Cosmos proposal.',
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
  }, [currentVotePage, isLikelyId, proposalId]);

  if (!isLikelyId) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid proposal id</h1>
          <p>The proposal id is required.</p>
        </main>
      </AppShell>
    );
  }

  if (!proposal) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton
            titleWidth="w-28"
            groups={3}
            rowsPerGroup={4}
            secondaryCard={true}
          />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load proposal</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasVotes = proposal.votesPage.totalCount > 0;
  const resolvedActiveTab =
    activeTab === 'votes' && !hasVotes ? 'overview' : activeTab;
  const statusTone =
    proposal.status === 'PROPOSAL_STATUS_PASSED'
      ? 'success'
      : proposal.status === 'PROPOSAL_STATUS_REJECTED' ||
          proposal.status === 'PROPOSAL_STATUS_FAILED'
        ? 'danger'
        : proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD'
          ? 'warning'
          : 'neutral';

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'overview'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'votes'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-500'
            } ${!hasVotes ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasVotes}
            onClick={() => {
              if (hasVotes) {
                setActiveTab('votes');
              }
            }}
          >
            {hasVotes ? `Votes (${proposal.votesPage.totalCount})` : 'Votes'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'json'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === 'overview' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-3">
              <p className="text-base font-semibold text-slate-900">
                Proposal Overview
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Governance proposal metadata and timeline returned by the active
                Cosmos REST endpoint.
              </p>
            </div>

            <dl>
              <DetailGroup>
                <DetailRow label="Proposal ID" value={proposal.id} />
                <DetailRow label="Title" value={proposal.title} />
                <DetailRow label="Type" value={<DetailTag>{proposal.typeLabel}</DetailTag>} />
                <DetailRow
                  label="Status"
                  value={<DetailTag tone={statusTone}>{proposal.statusLabel}</DetailTag>}
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Submit Time"
                  value={formatTimestampWithSeconds(proposal.submitTime)}
                />
                <DetailRow
                  label="Deposit End"
                  value={formatTimestampWithSeconds(proposal.depositEndTime)}
                />
                <DetailRow
                  label="Vote Start"
                  value={formatTimestampWithSeconds(proposal.votingStartTime)}
                />
                <DetailRow
                  label="Vote End"
                  value={formatTimestampWithSeconds(proposal.votingEndTime)}
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow label="Tally" value={proposal.tallyLabel} />
                <DetailRow label="Summary" value={proposal.summary} />
                <DetailRow label="Metadata" value={proposal.metadataLabel} mono />
              </DetailGroup>
            </dl>
          </section>
        ) : null}

        {resolvedActiveTab === 'votes' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Votes</p>
                <p className="mt-1 text-sm text-slate-500">
                  Votes returned by the active Cosmos REST endpoint for proposal
                  #{proposal.id}.
                </p>
              </div>
              <PaginationControls
                page={proposal.votesPage.page}
                totalPages={proposal.votesPage.totalPages}
                hasPreviousPage={proposal.votesPage.hasPreviousPage}
                hasNextPage={proposal.votesPage.hasNextPage}
                onPageChange={setCurrentVotePage}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Voter
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Option
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.votesPage.items.map((vote) => (
                    <tr key={`${vote.voter}-${vote.optionLabel}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/account/${vote.voter}`}
                        >
                          {vote.voterLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {vote.optionLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'json' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView
              value={proposal.rawJson}
              style={JSON_VIEW_STYLE}
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={false}
              collapsed={false}
            />
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
