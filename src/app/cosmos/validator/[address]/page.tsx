'use client';

import JsonView from '@uiw/react-json-view';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { getCosmosValidatorDetailDirect } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

const JSON_VIEW_STYLE = {
  '--w-rjv-background-color': 'transparent',
  '--w-rjv-border-left': '1px dashed rgba(148, 163, 184, 0.28)',
  '--w-rjv-font-family':
    '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  '--w-rjv-color': '#0f172a',
  '--w-rjv-arrow-color': '#64748b',
  '--w-rjv-line-color': 'rgba(148, 163, 184, 0.24)',
  '--w-rjv-curlybraces-color': '#475569',
  '--w-rjv-brackets-color': '#475569',
  '--w-rjv-colon-color': '#94a3b8',
  '--w-rjv-key-string': '#0369a1',
  '--w-rjv-key-number': '#0369a1',
  '--w-rjv-type-string-color': '#b45309',
  '--w-rjv-type-int-color': '#7c3aed',
  '--w-rjv-type-float-color': '#7c3aed',
  '--w-rjv-type-bigint-color': '#7c3aed',
  '--w-rjv-type-boolean-color': '#15803d',
  '--w-rjv-type-null-color': '#b91c1c',
  '--w-rjv-type-undefined-color': '#b91c1c',
} as CSSProperties;

function formatTimestampWithSeconds(value: string | null) {
  if (!value) {
    return '-';
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd
        className={
          mono
            ? 'self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono'
            : 'self-start text-sm text-slate-900'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function DetailGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 py-2.5 first:border-t-0">
      {children}
    </div>
  );
}

function DetailTag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
}) {
  const className =
    tone === 'success'
      ? 'inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
      : tone === 'danger'
        ? 'inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700'
        : tone === 'warning'
          ? 'inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'
          : 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600';

  return <span className={className}>{children}</span>;
}

export default function CosmosValidatorPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'delegations' | 'json'
  >('overview');
  const [validator, setValidator] = useState<Awaited<
    ReturnType<typeof getCosmosValidatorDetailDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLikelyAddress = useMemo(() => Boolean(address?.trim()), [address]);

  useEffect(() => {
    if (!isLikelyAddress) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosValidatorDetailDirect({
          address,
          txPage: currentTxPage,
          txPageSize: 10,
        });

        if (!cancelled) {
          setValidator(next);
          setErrorMessage(null);

          if (next.transactionsPage.page !== currentTxPage) {
            setCurrentTxPage(next.transactionsPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setValidator(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load Cosmos validator.',
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
  }, [address, currentTxPage, isLikelyAddress]);

  if (!isLikelyAddress) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid validator address</h1>
          <p>The validator address is required.</p>
        </main>
      </AppShell>
    );
  }

  if (!validator) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton
            titleWidth="w-32"
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
          <h1>Failed to load validator</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasTransactions = validator.transactionsPage.totalCount > 0;
  const hasDelegations = validator.delegationsCount > 0;
  const resolvedActiveTab =
    activeTab === 'transactions' && !hasTransactions
      ? 'overview'
      : activeTab === 'delegations' && !hasDelegations
        ? 'overview'
        : activeTab;
  const statusTone =
    validator.status === 'BOND_STATUS_BONDED'
      ? 'success'
      : validator.status === 'BOND_STATUS_UNBONDING'
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
              resolvedActiveTab === 'transactions'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-500'
            } ${!hasTransactions ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasTransactions}
            onClick={() => {
              if (hasTransactions) {
                setActiveTab('transactions');
              }
            }}
          >
            {hasTransactions
              ? `Transactions (${validator.transactionsPage.totalCount})`
              : 'Transactions'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'delegations'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-500'
            } ${!hasDelegations ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasDelegations}
            onClick={() => {
              if (hasDelegations) {
                setActiveTab('delegations');
              }
            }}
          >
            {hasDelegations
              ? `Delegations (${validator.delegationsCount})`
              : 'Delegations'}
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
                Validator Overview
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Validator profile, rewards, and staking state returned by the
                active Cosmos REST endpoint.
              </p>
            </div>

            <dl>
              <DetailGroup>
                <DetailRow label="Moniker" value={validator.moniker} />
                <DetailRow
                  label="Status"
                  value={
                    <DetailTag tone={statusTone}>{validator.statusLabel}</DetailTag>
                  }
                />
                <DetailRow
                  label="Jailed"
                  value={
                    <DetailTag tone={validator.jailed ? 'danger' : 'neutral'}>
                      {validator.jailedLabel}
                    </DetailTag>
                  }
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Operator Address"
                  value={validator.operatorAddress}
                  mono
                />
                <DetailRow
                  label="Account Address"
                  value={
                    validator.accountAddress ? (
                      <Link
                        className="text-sky-600 hover:text-sky-700"
                        href={`/cosmos/account/${validator.accountAddress}`}
                      >
                        {validator.accountAddress}
                      </Link>
                    ) : (
                      '-'
                    )
                  }
                  mono
                />
                <DetailRow
                  label="Consensus Pubkey"
                  value={validator.consensusPubkey ?? '-'}
                  mono
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Voting Power"
                  value={validator.votingPowerPercentLabel}
                />
                <DetailRow label="Tokens" value={validator.tokensLabel} />
                <DetailRow
                  label="Delegator Shares"
                  value={validator.delegatorSharesLabel}
                  mono
                />
                <DetailRow
                  label="Commission Rate"
                  value={validator.commissionRateLabel}
                />
                <DetailRow
                  label="Min Self Delegation"
                  value={validator.minSelfDelegationLabel}
                  mono
                />
                <DetailRow label="Self Bond" value={validator.selfBondLabel} />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Stake Rewards"
                  value={validator.stakeRewardsLabel}
                />
                <DetailRow
                  label="Commission Rewards"
                  value={validator.commissionRewardsLabel}
                />
                <DetailRow
                  label="Outstanding Rewards"
                  value={validator.outstandingRewardsLabel}
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow label="Identity" value={validator.identity ?? '-'} />
                <DetailRow
                  label="Website"
                  value={
                    validator.website ? (
                      <a
                        className="text-sky-600 hover:text-sky-700"
                        href={validator.website}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {validator.website}
                      </a>
                    ) : (
                      '-'
                    )
                  }
                />
                <DetailRow
                  label="Security Contact"
                  value={validator.securityContact ?? '-'}
                />
                <DetailRow label="Details" value={validator.details ?? '-'} />
              </DetailGroup>
              {validator.unbondingHeightLabel || validator.unbondingTime ? (
                <DetailGroup>
                  <DetailRow
                    label="Unbonding Height"
                    value={validator.unbondingHeightLabel ?? '-'}
                  />
                  <DetailRow
                    label="Unbonding Time"
                    value={formatTimestampWithSeconds(validator.unbondingTime)}
                  />
                </DetailGroup>
              ) : null}
            </dl>
          </section>
        ) : null}

        {resolvedActiveTab === 'transactions' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">
                  Transactions
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Transactions where this validator account appears as
                  `message.sender`.
                </p>
              </div>
              <PaginationControls
                page={validator.transactionsPage.page}
                totalPages={validator.transactionsPage.totalPages}
                hasPreviousPage={validator.transactionsPage.hasPreviousPage}
                hasNextPage={validator.transactionsPage.hasNextPage}
                onPageChange={setCurrentTxPage}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Transaction Hash
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Type
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Height
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Age
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Gas Used / Wanted
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {validator.transactionsPage.items.map((transaction) => (
                    <tr
                      key={transaction.hash}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/tx/${transaction.hash}`}
                        >
                          {transaction.hashLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {transaction.type}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/block/${transaction.height}`}
                        >
                          {transaction.height}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={transaction.timestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.gasUsedLabel}/{transaction.gasWantedLabel}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <DetailTag
                          tone={
                            transaction.status === 'success'
                              ? 'success'
                              : 'danger'
                          }
                        >
                          {transaction.statusLabel}
                        </DetailTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'delegations' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="mb-4">
              <p className="text-base font-semibold text-slate-900">
                Delegations
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Delegators currently bonded to this validator.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Delegator
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Amount
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Shares
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Kind
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {validator.delegations.map((delegation) => (
                    <tr
                      key={`${delegation.delegatorAddress}-${delegation.sharesLabel}`}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/cosmos/account/${delegation.delegatorAddress}`}
                        >
                          {delegation.delegatorAddressLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {delegation.amountLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">
                        {delegation.sharesLabel}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <DetailTag>{delegation.kindLabel}</DetailTag>
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
              value={validator.rawJson}
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
