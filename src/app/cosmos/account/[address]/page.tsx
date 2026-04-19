'use client';

import JsonView from '@uiw/react-json-view';
import {
  IconAdjustmentsHorizontal,
  IconCode,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { getCosmosAccountDetailDirect } from '@/domains/cosmos/client/queries';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  CosmosDetailTag as DetailTag,
  COSMOS_JSON_VIEW_STYLE as JSON_VIEW_STYLE,
} from '@/domains/cosmos/ui/detail-primitives';
import { AppShell } from '@/platform/layout/app-shell';

export default function CosmosAccountPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'transactions' | 'delegations' | 'json'
  >('overview');
  const [balanceDisplayMode, setBalanceDisplayMode] = useState<
    'readable' | 'accurate'
  >('readable');
  const [account, setAccount] = useState<Awaited<
    ReturnType<typeof getCosmosAccountDetailDirect>
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
        const next = await getCosmosAccountDetailDirect({
          address,
          txPage: currentTxPage,
          txPageSize: 10,
        });

        if (!cancelled) {
          setAccount(next);
          setErrorMessage(null);

          if (next.transactionsPage.page !== currentTxPage) {
            setCurrentTxPage(next.transactionsPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAccount(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load Cosmos account.',
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
          <h1>Invalid account address</h1>
          <p>The account address is required.</p>
        </main>
      </AppShell>
    );
  }

  if (!account) {
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
          <h1>Failed to load account</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasTransactions = account.transactionsPage.totalCount > 0;
  const hasDelegations = account.delegationsCount > 0;
  const resolvedActiveTab =
    activeTab === 'transactions' && !hasTransactions
      ? 'overview'
      : activeTab === 'delegations' && !hasDelegations
        ? 'overview'
        : activeTab;

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
              ? `Transactions (${account.transactionsPage.totalCount})`
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
              ? `Delegations (${account.delegationsCount})`
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-900">
                Account Overview
              </p>
              <button
                type="button"
                aria-label={
                  balanceDisplayMode === 'readable'
                    ? 'Switch to accurate balances'
                    : 'Switch to readable balances'
                }
                title={
                  balanceDisplayMode === 'readable'
                    ? 'Readable balances'
                    : 'Accurate balances'
                }
                className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                onClick={() =>
                  setBalanceDisplayMode((current) =>
                    current === 'readable' ? 'accurate' : 'readable',
                  )
                }
              >
                {balanceDisplayMode === 'readable' ? (
                  <IconAdjustmentsHorizontal className="size-4" stroke={1.8} />
                ) : (
                  <IconCode className="size-4" stroke={1.8} />
                )}
              </button>
            </div>

            <dl>
              <DetailGroup>
                <DetailRow label="Address" value={account.address} mono />
                <DetailRow
                  label="Type"
                  value={<DetailTag>{account.type}</DetailTag>}
                />
                <DetailRow
                  label="Balance Summary"
                  value={
                    balanceDisplayMode === 'readable'
                      ? account.readableBalancesLabel
                      : account.balancesLabel
                  }
                  mono
                />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Account Number"
                  value={account.accountNumberLabel}
                />
                <DetailRow label="Sequence" value={account.sequenceLabel} />
              </DetailGroup>
              <DetailGroup>
                <DetailRow
                  label="Transactions"
                  value={account.transactionsPage.totalCount.toLocaleString(
                    'en-US',
                  )}
                />
                <DetailRow
                  label="Delegations"
                  value={account.delegationsCount.toLocaleString('en-US')}
                />
              </DetailGroup>
            </dl>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-4">
                <p className="text-base font-semibold text-slate-900">
                  Balances
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  All balances returned by the active Cosmos REST endpoint.
                </p>
              </div>

              {account.balances.length ? (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">
                          Denom
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.balances.map((balance, index) => (
                        <tr
                          key={`${balance.denom}-${index}`}
                          className="border-t border-slate-200"
                        >
                          <td className="px-4 py-3 text-sm text-slate-700 mono">
                            {balance.denom}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900 mono">
                            {balance.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No balances returned.</div>
              )}
            </div>
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
                  Transactions where this address appears as `message.sender`.
                </p>
              </div>
              <PaginationControls
                page={account.transactionsPage.page}
                totalPages={account.transactionsPage.totalPages}
                hasPreviousPage={account.transactionsPage.hasPreviousPage}
                hasNextPage={account.transactionsPage.hasNextPage}
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
                  {account.transactionsPage.items.map((transaction) => (
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
                Active staking delegations returned by the selected Cosmos REST
                endpoint.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Validator
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Validator Address
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Amount
                    </th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                      Shares
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {account.delegations.map((delegation) => (
                    <tr
                      key={delegation.validatorAddress}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <Link
                          className="text-sky-600 hover:text-sky-700"
                          href={`/cosmos/validator/${delegation.validatorAddress}`}
                        >
                          {delegation.validatorMoniker ?? 'Unknown'}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 mono">
                        <Link
                          className="text-sky-600 hover:text-sky-700"
                          href={`/cosmos/validator/${delegation.validatorAddress}`}
                        >
                          {delegation.validatorAddressLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {delegation.amountLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">
                        {delegation.sharesLabel}
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
              value={account.rawJson}
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
