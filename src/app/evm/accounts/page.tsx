'use client';

import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { deleteEvmAddressTag, getEvmAddressTags, subscribeEvmAddressTags, upsertEvmAddressTag } from '@/domains/evm/client/address-tags';
import { getEvmObservedAccountsPage } from '@/domains/evm/client/transaction-cache';
import { getEvmAddressBalancesDirect } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = 25;

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildPageHref(pathname: string, searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams.toString());

  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function EvmAccountsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvmObservedAccountsPage>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balancesByAddress, setBalancesByAddress] = useState<Record<string, string>>({});
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [editingTagAddress, setEditingTagAddress] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [tagErrorMessage, setTagErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    address: string;
    nameTag: string;
  } | null>(null);

  function goToLogin() {
    router.push('/login?callbackUrl=%2Fevm%2Faccounts');
  }

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getEvmObservedAccountsPage(currentPage, PAGE_SIZE);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);
          setBalancesByAddress({});

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load observed accounts.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const handleProfileChanged = () => {
      setEditingTagAddress(null);
      setTagInputValue('');
      setTagErrorMessage(null);
      setDeleteTarget(null);
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [currentPage, pathname, router, searchParamsText]);

  const visibleAddresses = useMemo(() => data?.accounts.map((account) => account.address) ?? [], [data]);

  useEffect(() => {
    function loadVisibleTags() {
      setNameTagsByAddress(getEvmAddressTags(visibleAddresses));
    }

    loadVisibleTags();

    const unsubscribe = subscribeEvmAddressTags(() => {
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
  }, [visibleAddresses]);

  async function handleLoadBalances() {
    if (!visibleAddresses.length || balanceLoading) {
      return;
    }

    setBalanceLoading(true);

    try {
      const nextBalances = await getEvmAddressBalancesDirect(visibleAddresses);
      setBalancesByAddress(nextBalances);
    } finally {
      setBalanceLoading(false);
    }
  }

  function handleStartTagEdit(address: string) {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setEditingTagAddress(address);
    setTagInputValue(nameTagsByAddress[address] ?? '');
    setTagErrorMessage(null);
    setDeleteTarget(null);
  }

  function handleCancelTagEdit() {
    setEditingTagAddress(null);
    setTagInputValue('');
    setTagErrorMessage(null);
  }

  async function handleSaveTag(address: string) {
    try {
      await upsertEvmAddressTag(address, tagInputValue);
      setEditingTagAddress(null);
      setTagInputValue('');
      setTagErrorMessage(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setTagErrorMessage(error instanceof Error ? error.message : 'Failed to save name tag.');
    }
  }

  async function handleDeleteTag(address: string) {
    try {
      await deleteEvmAddressTag(address);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }

      return;
    }

    if (editingTagAddress === address) {
      setEditingTagAddress(null);
      setTagInputValue('');
      setTagErrorMessage(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-24" rows={8} columns={7} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Accounts are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Accounts</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">Observed {data.totalAccounts.toLocaleString('en-US')} accounts from cached transactions</p>
              <p className="mt-1 text-sm text-slate-500">Showing locally indexed addresses discovered from recent block scans only.</p>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              <button
                type="button"
                className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
                  balanceLoading ? 'cursor-wait border-sky-200 bg-sky-50 text-sky-600' : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                }`}
                disabled={!data.accounts.length || balanceLoading}
                onClick={() => void handleLoadBalances()}
              >
                {balanceLoading ? 'Loading Balances...' : 'Load Balances'}
              </button>
              <PaginationControls
                page={data.page}
                totalPages={data.totalPages}
                hasPreviousPage={data.hasPreviousPage}
                hasNextPage={data.hasNextPage}
                disabled={loading}
                onPageChange={handlePageChange}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">#</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Address</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Name Tag</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Balance</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Last Seen</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Txn Count</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Tag Action</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.length ? (
                  data.accounts.map((account, index) => (
                    <tr key={account.address} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-700">{(data.page - 1) * data.pageSize + index + 1}</td>
                      <td className="px-5 py-3 text-sm">
                        <AddressLink
                          address={account.address}
                          href={`/evm/address/${account.address}`}
                          label={account.addressLabel}
                          className="font-medium text-sky-600 hover:text-sky-700"
                        />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {editingTagAddress === account.address ? (
                          <div className="flex min-w-[220px] flex-col gap-2">
                            <Input value={tagInputValue} onChange={(event) => setTagInputValue(event.target.value)} placeholder="Name tag" />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => {
                                  if (status !== 'authenticated') {
                                    goToLogin();
                                    return;
                                  }

                                  void handleSaveTag(account.address);
                                }}
                              >
                                Save
                              </Button>
                              <Button size="sm" type="button" variant="ghost" onClick={handleCancelTagEdit}>
                                Cancel
                              </Button>
                            </div>
                            {tagErrorMessage ? <span className="text-xs text-rose-600">{tagErrorMessage}</span> : null}
                          </div>
                        ) : (
                          <span className={nameTagsByAddress[account.address] ? 'font-medium text-slate-900' : ''}>{nameTagsByAddress[account.address] ?? '-'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">{balancesByAddress[account.address] ?? 'Not loaded'}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            <RelativeTime timestampMs={account.lastSeenTimestampMs} />
                          </span>
                          <span className="text-xs text-slate-400">Block #{account.lastSeenBlockNumber}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{account.totalTxCount.toLocaleString('en-US')}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {editingTagAddress === account.address ? null : (
                          <div className="flex items-center">
                            {nameTagsByAddress[account.address] ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip="Edit name tag"
                                  aria-label="Edit name tag"
                                  onClick={() => handleStartTagEdit(account.address)}
                                >
                                  <IconPencil className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-rose-600"
                                  tooltip="Delete name tag"
                                  aria-label="Delete name tag"
                                  onClick={() => {
                                    if (status !== 'authenticated') {
                                      goToLogin();
                                      return;
                                    }

                                    setDeleteTarget({
                                      address: account.address,
                                      nameTag: nameTagsByAddress[account.address] ?? '',
                                    });
                                  }}
                                >
                                  <IconTrash className="size-4" stroke={1.8} />
                                </ActionIconButton>
                              </>
                            ) : (
                              <ActionIconButton
                                className="text-slate-400 hover:text-slate-700"
                                tooltip="Add name tag"
                                aria-label="Add name tag"
                                onClick={() => handleStartTagEdit(account.address)}
                              >
                                <IconPlus className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                      No observed accounts yet. Browse recent blocks or transactions first so addresses can be indexed into IndexedDB.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title="Delete Name Tag"
          description={deleteTarget ? `Delete the label "${deleteTarget.nameTag}" for ${deleteTarget.address.slice(0, 8)}...${deleteTarget.address.slice(-6)}?` : undefined}
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteTarget) {
              void handleDeleteTag(deleteTarget.address);
            }
          }}
        />
      </main>
    </AppShell>
  );
}

export default function EvmAccountsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-24" rows={8} columns={7} />
        </AppShell>
      }
    >
      <EvmAccountsPageContent />
    </Suspense>
  );
}
