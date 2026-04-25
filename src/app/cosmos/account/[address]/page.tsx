'use client';

import JsonView from '@uiw/react-json-view';
import { IconAdjustmentsHorizontal, IconCode, IconInfoCircle, IconTag } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { deleteCosmosAddressTag, getCosmosAddressTag, getCosmosAddressTags, subscribeCosmosAddressTags, upsertCosmosAddressTag } from '@/domains/cosmos/client/address-tags';
import { getCosmosAccountDetailDirect } from '@/domains/cosmos/client/queries';
import { COSMOS_JSON_VIEW_STYLE as JSON_VIEW_STYLE } from '@/domains/cosmos/ui/detail-primitives';
import { formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { CosmosTransactionHashCell, CosmosTransactionPreviewButton } from '@/domains/cosmos/ui/transaction-list-cells';
import { AppShell } from '@/platform/layout/app-shell';

type AccountPageTab = 'transactions' | 'delegations' | 'json';

function AccountMetric({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: React.ReactNode;
}) {
  const tooltipTriggerRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        {tooltip ? (
          <span
            ref={tooltipTriggerRef}
            className="inline-flex"
            onBlur={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            tabIndex={0}
          >
            <span className="inline-flex items-center justify-center text-slate-300 outline-none">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <FloatingTooltip
              open={tooltipOpen}
              anchorRef={tooltipTriggerRef}
              className="w-[260px] whitespace-normal bg-slate-800 leading-5 text-white"
            >
              {tooltip}
            </FloatingTooltip>
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function CosmosAccountPage() {
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const { status } = useSession();
  const address = params.address;
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState<AccountPageTab>('transactions');
  const [balanceDisplayMode, setBalanceDisplayMode] = useState<'readable' | 'accurate'>('readable');
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getCosmosAccountDetailDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [tagInput, setTagInput] = useState('');
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const isLikelyAddress = useMemo(() => Boolean(address?.trim()), [address]);
  const visibleAddresses = useMemo(
    () => [...new Set((account?.transactionsPage.items ?? []).map((transaction) => transaction.sender).filter((sender) => sender !== 'Unknown'))],
    [account],
  );

  function goToLogin() {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/cosmos/account/${address}`)}`);
  }

  useEffect(() => {
    if (!isLikelyAddress) {
      return;
    }

    function loadTag() {
      const nextTag = getCosmosAddressTag(address);
      setNameTag(nextTag);
      setTagInput(nextTag ?? '');
    }

    loadTag();

    const unsubscribe = subscribeCosmosAddressTags(() => {
      loadTag();
    });

    const handleProfileChanged = () => {
      loadTag();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isLikelyAddress]);

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
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos account.');
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

  useEffect(() => {
    if (!account) {
      return;
    }

    const currentAccount = account;

    function loadVisibleTags() {
      setNameTagsByAddress(getCosmosAddressTags([currentAccount.address, ...visibleAddresses]));
    }

    loadVisibleTags();

    const unsubscribe = subscribeCosmosAddressTags(() => {
      loadVisibleTags();
    });

    const handleProfileChanged = () => {
      loadVisibleTags();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [account, visibleAddresses]);

  async function handleSaveTag() {
    try {
      if (tagInput.trim()) {
        await upsertCosmosAddressTag(address, tagInput);
      } else {
        await deleteCosmosAddressTag(address);
      }

      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  async function handleRemoveTag() {
    try {
      await deleteCosmosAddressTag(address);
      setTagInput('');
      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  function openTagDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setTagInput(nameTag ?? '');
    setTagDialogOpen(true);
  }

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
          <DetailPageSkeleton titleWidth="w-28" groups={3} rowsPerGroup={4} secondaryCard={true} />
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
    activeTab === 'delegations' && !hasDelegations ? (hasTransactions ? 'transactions' : 'json') : activeTab === 'transactions' && !hasTransactions ? (hasDelegations ? 'delegations' : 'json') : activeTab;

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Account</h1>
            <span className={`${nameTag ? 'text-sm font-semibold text-slate-900' : 'text-sm font-medium text-slate-500 mono'}`}>
              {nameTag ?? account.address}
            </span>
            <ActionIconButton tooltip={nameTag ? 'Edit tag' : 'Add tag'} className="text-slate-400 hover:text-sky-600" onClick={openTagDialog}>
              <IconTag className="size-4" stroke={1.8} />
            </ActionIconButton>
          </div>
          {nameTag ? <p className="mt-2 text-sm font-medium text-slate-500 mono">{account.address}</p> : null}
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r xl:border-b-0">
              <AccountMetric label="Type" value={account.type} />
            </div>
            <div className="border-b border-slate-200 p-5 xl:border-r xl:border-b-0">
              <AccountMetric label="Account Number" value={account.accountNumberLabel} />
            </div>
            <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r xl:border-b-0">
              <AccountMetric label="Sequence" value={account.sequenceLabel} />
            </div>
            <div className="p-5">
              <AccountMetric label="Transactions" value={account.transactionsPage.totalCount.toLocaleString('en-US')} />
            </div>
          </div>

          <div className="border-t border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Balances</p>
                <p className="mt-1 text-sm text-slate-500">All balances returned by the active Cosmos REST endpoint.</p>
              </div>
              <ActionIconButton
                tooltip={balanceDisplayMode === 'readable' ? 'Switch to accurate balances' : 'Switch to readable balances'}
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setBalanceDisplayMode((current) => (current === 'readable' ? 'accurate' : 'readable'))}
              >
                {balanceDisplayMode === 'readable' ? <IconAdjustmentsHorizontal className="size-4" stroke={1.8} /> : <IconCode className="size-4" stroke={1.8} />}
              </ActionIconButton>
            </div>

            {account.balances.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Denom</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.balances.map((balance, index) => (
                      <tr key={`${balance.denom}-${index}`} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm text-slate-700 mono">{balance.denom}</td>
                        <td className="px-5 py-3 text-sm text-slate-900 mono">
                          {balanceDisplayMode === 'readable' ? formatReadableTokenAmount(balance.amount) : balance.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state m-5">No balances returned.</div>
            )}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'transactions' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            } ${!hasTransactions ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasTransactions}
            onClick={() => {
              if (hasTransactions) {
                setActiveTab('transactions');
              }
            }}
          >
            {hasTransactions ? `Transactions (${account.transactionsPage.totalCount})` : 'Transactions'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'delegations' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            } ${!hasDelegations ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasDelegations}
            onClick={() => {
              if (hasDelegations) {
                setActiveTab('delegations');
              }
            }}
          >
            {hasDelegations ? `Delegations (${account.delegationsCount})` : 'Delegations'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === 'transactions' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Transactions</p>
                <p className="mt-1 text-sm text-slate-500">Transactions where this address appears as `message.sender`.</p>
              </div>
              <PaginationControls
                page={account.transactionsPage.page}
                totalPages={account.transactionsPage.totalPages}
                hasPreviousPage={account.transactionsPage.hasPreviousPage}
                hasNextPage={account.transactionsPage.hasNextPage}
                plain
                onPageChange={setCurrentTxPage}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Hash</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Block</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Age</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">From</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Gas Used / Wanted</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {account.transactionsPage.items.map((transaction) => (
                    <tr key={transaction.hash} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="-ml-1 flex items-center gap-1.5">
                          <CosmosTransactionPreviewButton transaction={transaction} />
                          <CosmosTransactionHashCell hash={transaction.hash} hashLabel={transaction.hashLabel} status={transaction.status} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/block/${transaction.height}`}>
                          {transaction.height}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={transaction.timestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.sender === 'Unknown' ? (
                          <span className="text-slate-500">Unknown</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {nameTagsByAddress[transaction.sender] ?? transaction.senderLabel}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.gasUsedLabel}/{transaction.gasWantedLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{transaction.feeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'delegations' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">Delegations</p>
              <p className="mt-1 text-sm text-slate-500">Active staking delegations returned by the selected Cosmos REST endpoint.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Validator</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Validator Address</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Amount</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {account.delegations.map((delegation) => (
                    <tr key={delegation.validatorAddress} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${delegation.validatorAddress}`}>
                          {delegation.validatorMoniker ?? 'Unknown'}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 mono">
                        <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${delegation.validatorAddress}`}>
                          {delegation.validatorAddressLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{delegation.amountLabel}</td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">{delegation.sharesLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'json' ? (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView value={account.rawJson} style={JSON_VIEW_STYLE} displayDataTypes={false} displayObjectSize={false} enableClipboard={false} collapsed={false} />
          </section>
        ) : null}

        <ModalDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          title={nameTag ? 'Edit Tag' : 'Add Tag'}
          description={`Set a label for address ${account.address}.`}
          footer={
            <>
              {nameTag ? (
                <Button type="button" variant="outline" onClick={() => void handleRemoveTag()}>
                  Remove
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveTag()}>
                Save
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <label className="grid gap-2 pb-1">
            <span className="text-sm font-medium text-slate-700">Tag</span>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Tag" />
          </label>
        </ModalDialog>
      </main>
    </AppShell>
  );
}
