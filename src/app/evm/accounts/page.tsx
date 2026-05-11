'use client';

import { IconPencil, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { RelativeTime } from '@/components/relative-time';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { deleteEvmAddressTag, getEvmAddressTags, subscribeEvmAddressTags, upsertEvmAddressTag } from '@/domains/evm/client/address-tags';
import { getEvmObservedAccountsPage } from '@/domains/evm/client/transaction-cache';
import { getEvmAddressBalancesDirect } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
type EvmAddressBalanceMap = Awaited<ReturnType<typeof getEvmAddressBalancesDirect>>;
type EvmAddressBalanceEntry = EvmAddressBalanceMap[string];

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

function EvmBalanceTooltipValue({ balance }: { balance: EvmAddressBalanceEntry }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  if (!balance.wei) {
    return <span>{balance.formatted}</span>;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center rounded-sm text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        {balance.formatted}
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="whitespace-nowrap border border-slate-200 bg-white text-slate-700"
      >
        <span className="block whitespace-nowrap">{balance.wei}</span>
      </FloatingTooltip>
    </>
  );
}

function EvmAccountsPageContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const accountMessages = messages.cosmosAccountDetail;
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
  const [balancesByAddress, setBalancesByAddress] = useState<Awaited<ReturnType<typeof getEvmAddressBalancesDirect>>>({});
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [editingTagAddress, setEditingTagAddress] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');
  const [tagErrorMessage, setTagErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    address: string;
    nameTag: string;
  } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

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
          setErrorMessage(error instanceof Error ? error.message : messages.common.failedToLoadObservedAccounts);
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
  }, [currentPage, pathname, refreshVersion, router, searchParamsText]);

  const visibleAddresses = useMemo(() => data?.accounts.map((account) => account.address) ?? [], [data]);

  useEffect(() => {
    let cancelled = false;

    if (!visibleAddresses.length) {
      setBalancesByAddress({});
      setBalanceLoading(false);
      return;
    }

    setBalanceLoading(true);
    setBalancesByAddress({});

    void getEvmAddressBalancesDirect(visibleAddresses)
      .then((nextBalances) => {
        if (!cancelled) {
          setBalancesByAddress(nextBalances);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visibleAddresses]);

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

      setTagErrorMessage(error instanceof Error ? error.message : messages.common.failedToSaveTag);
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
        <ListPageSkeleton titleWidth="w-24" columns={6} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{messages.labels.accounts}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.accounts}</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{messages.common.observedAccountsSummary.replace('{count}', data.totalAccounts.toLocaleString(locale))}</p>
              <p className="mt-1 text-sm text-slate-500">{messages.common.observedAccountsDescription}</p>
            </div>
            <div className="flex items-center gap-0.5 lg:justify-end">
              <PaginationControls
                page={data.page}
                totalPages={data.totalPages}
                hasPreviousPage={data.hasPreviousPage}
                hasNextPage={data.hasNextPage}
                disabled={loading}
                plain
                onPageChange={handlePageChange}
              />
              <ActionIconButton
                tooltip={messages.common.refreshAccountsFromCache}
                className="text-slate-400 hover:text-sky-600"
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.balances}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.block}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.homeMetrics.recentTxCount}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.privateKeys.lastUsed}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.tag}</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.length ? (
                  data.accounts.map((account) => (
                    <tr key={account.address} className="border-t border-slate-200">
                      {(() => {
                        const balance = balancesByAddress[account.address];

                        return (
                          <>
                            <td className="px-5 py-3 text-sm">
                              <AddressLink
                                address={account.address}
                                href={`/evm/address/${account.address}`}
                                label={account.address}
                                className="font-medium text-sky-600 hover:text-sky-700"
                              />
                            </td>
                            <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">
                              {balance ? (
                                <EvmBalanceTooltipValue balance={balance} />
                              ) : balanceLoading ? (
                                <Skeleton className="h-5 w-24 rounded-md" />
                              ) : (
                                messages.common.unavailable
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{account.lastSeenBlockNumber}</td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">{account.totalTxCount.toLocaleString(locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={account.lastSeenTimestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {nameTagsByAddress[account.address] ? (
                          <div className="inline-flex max-w-[220px] items-center gap-1.5">
                            <span className="max-w-[160px] truncate font-medium text-slate-900">{nameTagsByAddress[account.address]}</span>
                            <div className="flex shrink-0 items-center">
                              <ActionIconButton
                                className="text-slate-400 hover:text-slate-700"
                                tooltip={messages.nameTags.editTooltip}
                                aria-label={messages.nameTags.editTooltip}
                                onClick={() => handleStartTagEdit(account.address)}
                              >
                                <IconPencil className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton
                                className="text-slate-400 hover:text-rose-600"
                                tooltip={messages.nameTags.deleteTooltip}
                                aria-label={messages.nameTags.deleteTooltip}
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
                            </div>
                          </div>
                        ) : (
                          <ActionIconButton
                            className="text-slate-400 hover:text-slate-700"
                            tooltip={messages.nameTags.createTitle}
                            aria-label={messages.nameTags.createTitle}
                            onClick={() => handleStartTagEdit(account.address)}
                          >
                            <IconPlus className="size-4" stroke={1.8} />
                          </ActionIconButton>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                      {messages.common.noObservedAccounts}
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
          title={messages.nameTags.deleteTitle}
          description={
            deleteTarget
              ? messages.nameTags.deleteDescription
                  .replace('{label}', deleteTarget.nameTag)
                  .replace('{address}', `${deleteTarget.address.slice(0, 8)}...${deleteTarget.address.slice(-6)}`)
              : undefined
          }
          confirmLabel={messages.common.delete}
          onConfirm={() => {
            if (deleteTarget) {
              void handleDeleteTag(deleteTarget.address);
            }
          }}
        />
        <ModalDialog
          open={editingTagAddress !== null}
          onOpenChange={(open) => {
            if (!open) {
              handleCancelTagEdit();
            }
          }}
          title={editingTagAddress && nameTagsByAddress[editingTagAddress] ? messages.nameTags.editTooltip : messages.nameTags.createTitle}
          description={
            editingTagAddress
              ? `${messages.nameTags.setLabelForAddress} ${editingTagAddress}.`
              : undefined
          }
          maxWidthClassName="max-w-md"
          footer={
            <>
              <Button type="button" variant="ghost" onClick={handleCancelTagEdit}>
                {messages.common.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!editingTagAddress) {
                    return;
                  }

                  if (status !== 'authenticated') {
                    goToLogin();
                    return;
                  }

                  void handleSaveTag(editingTagAddress);
                }}
              >
                {messages.nameTags.save}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="evm-account-name-tag-input" className="text-sm font-medium text-slate-700">
                {messages.labels.tag}
              </label>
              <Input
                id="evm-account-name-tag-input"
                value={tagInputValue}
                onChange={(event) => setTagInputValue(event.target.value)}
                placeholder={messages.nameTags.nameTagPlaceholder}
                autoFocus
              />
            </div>
            {tagErrorMessage ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(tagErrorMessage, locale)}</p> : null}
          </div>
        </ModalDialog>
      </main>
    </AppShell>
  );
}

export default function EvmAccountsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-24" columns={6} />
        </AppShell>
      }
    >
      <EvmAccountsPageContent />
    </Suspense>
  );
}
