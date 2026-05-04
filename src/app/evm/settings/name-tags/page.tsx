'use client';

import { IconPencil, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import {
  clearEvmAddressTags,
  deleteEvmAddressTag,
  listEvmAddressTags,
  subscribeEvmAddressTags,
  upsertEvmAddressTag,
  type EvmAddressTagItem,
} from '@/domains/evm/client/address-tags';
import { formatLocalizedDateTime } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { AppShell } from '@/platform/layout/app-shell';
import { AccountWorkbenchShell } from '@/platform/layout/account-workbench-shell';

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatUpdatedAt(timestamp: number, locale: string) {
  return formatLocalizedDateTime(timestamp, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, locale);
}

export default function EvmNameTagsPage() {
  const router = useRouter();
  const { status } = useSession();
  const messages = useMessages();
  const { locale } = useLocale();
  const nameTagMessages = messages.nameTags;
  const labelMessages = messages.labels;
  const [items, setItems] = useState<EvmAddressTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNameTag, setNewNameTag] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EvmAddressTagItem | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [providerName, setProviderName] = useState<string>(nameTagMessages.currentProvider);

  function goToLogin() {
    router.push('/login?callbackUrl=%2Fevm%2Fsettings%2Fname-tags');
  }

  useEffect(() => {
    function load() {
      setItems(listEvmAddressTags());
      setProviderName(readActiveRpcProfileCookie('evm')?.name ?? nameTagMessages.currentProvider);
      setLoading(false);
    }

    load();

    const unsubscribe = subscribeEvmAddressTags(() => {
      load();
    });

    const handleProfileChanged = () => {
      setEditingAddress(null);
      setEditingValue('');
      setDeleteTarget(null);
      setClearDialogOpen(false);
      setNewAddress('');
      setNewNameTag('');
      setCreateError(null);
      load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [nameTagMessages.currentProvider]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => item.addressLower.includes(normalizedQuery) || item.nameTag.toLowerCase().includes(normalizedQuery));
  }, [items, searchText]);

  async function handleCreate() {
    try {
      await upsertEvmAddressTag(newAddress, newNameTag);
      setNewAddress('');
      setNewNameTag('');
      setCreateError(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setCreateError(error instanceof Error ? translateRuntimeText(error.message, locale) : nameTagMessages.failedToSave);
    }
  }

  function handleStartEdit(item: EvmAddressTagItem) {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setEditingAddress(item.address);
    setEditingValue(item.nameTag);
    setDeleteTarget(null);
  }

  async function handleSaveEdit(address: string) {
    try {
      await upsertEvmAddressTag(address, editingValue);
      setEditingAddress(null);
      setEditingValue('');
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }

      // Ignore invalid save attempts and let the current input remain editable.
    }
  }

  async function handleDelete(address: string) {
    try {
      await deleteEvmAddressTag(address);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }

      return;
    }

    if (editingAddress === address) {
      setEditingAddress(null);
      setEditingValue('');
    }
  }

  async function handleClearAll() {
    try {
      await clearEvmAddressTags();
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }

      return;
    }

    setEditingAddress(null);
    setEditingValue('');
    setDeleteTarget(null);
    setClearDialogOpen(false);
  }

  if (loading) {
    return (
      <AppShell>
        <AccountWorkbenchShell mode="evm">
          <ListPageSkeleton titleWidth="w-36" columns={4} showToolbar={false} />
        </AccountWorkbenchShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AccountWorkbenchShell mode="evm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{nameTagMessages.pageTitle}</h1>
            <Badge variant="secondary">{translateRuntimeText(providerName, locale)}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">{nameTagMessages.pageDescription}</p>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">{nameTagMessages.createTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{nameTagMessages.createDescription}</p>
          </div>
          <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
            <Input value={newAddress} onChange={(event) => setNewAddress(event.target.value)} placeholder={nameTagMessages.addressPlaceholder} />
            <Input value={newNameTag} onChange={(event) => setNewNameTag(event.target.value)} placeholder={nameTagMessages.nameTagPlaceholder} />
            <Button
              type="button"
              disabled={!newAddress.trim() || !newNameTag.trim()}
              onClick={() => {
                if (status !== 'authenticated') {
                  goToLogin();
                  return;
                }

                void handleCreate();
              }}
            >
              {status === 'authenticated' ? nameTagMessages.saveTag : nameTagMessages.signInToSave}
            </Button>
          </div>
          {createError ? <p className="px-5 pb-4 text-sm text-rose-600">{translateRuntimeText(createError, locale)}</p> : null}
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{nameTagMessages.visibleTags.replace('{count}', filteredItems.length.toLocaleString(locale))}</p>
              <p className="mt-1 text-sm text-slate-500">{nameTagMessages.searchDescription}</p>
            </div>
            <div className="flex w-full max-w-lg items-center justify-end gap-3">
              <div className="w-full max-w-sm">
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={nameTagMessages.searchPlaceholder} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!items.length}
                onClick={() => {
                  if (status !== 'authenticated') {
                    goToLogin();
                    return;
                  }

                  setClearDialogOpen(true);
                }}
              >
                {nameTagMessages.clearAll}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{nameTagMessages.pageTitle}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{nameTagMessages.updated}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{labelMessages.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <tr key={item.addressLower} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`/evm/address/${item.address}`} className="font-medium text-sky-600 hover:text-sky-700">
                            {formatAddressLabel(item.address)}
                          </Link>
                          <span className="text-xs text-slate-400">{item.address}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {editingAddress === item.address ? (
                          <Input value={editingValue} onChange={(event) => setEditingValue(event.target.value)} placeholder={nameTagMessages.nameTagPlaceholder} />
                        ) : (
                          <span className="font-medium text-slate-900">{item.nameTag}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">{formatUpdatedAt(item.updatedAt, locale)}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex justify-end gap-0">
                          {editingAddress === item.address ? (
                            <>
                              <Button size="sm" type="button" onClick={() => void handleSaveEdit(item.address)}>
                                {nameTagMessages.save}
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setEditingAddress(null);
                                  setEditingValue('');
                                  setDeleteTarget(null);
                                }}
                              >
                                {nameTagMessages.cancel}
                              </Button>
                            </>
                          ) : (
                            <>
                              <ActionIconButton
                                className="text-slate-400 hover:text-slate-700"
                                tooltip={nameTagMessages.editTooltip}
                                aria-label={nameTagMessages.editTooltip}
                                onClick={() => handleStartEdit(item)}
                              >
                                <IconPencil className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton
                                className="text-slate-400 hover:text-rose-600"
                                tooltip={nameTagMessages.deleteTooltip}
                                aria-label={nameTagMessages.deleteTooltip}
                                onClick={() => {
                                  if (status !== 'authenticated') {
                                    goToLogin();
                                    return;
                                  }

                                  setDeleteTarget(item);
                                }}
                              >
                                <IconTrash className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-500" colSpan={4}>
                      {nameTagMessages.noResults}
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
          title={nameTagMessages.deleteTitle}
          description={deleteTarget ? nameTagMessages.deleteDescription.replace('{label}', deleteTarget.nameTag).replace('{address}', formatAddressLabel(deleteTarget.address)) : undefined}
          confirmLabel={nameTagMessages.deleteTooltip}
          onConfirm={() => {
            if (deleteTarget) {
              void handleDelete(deleteTarget.address);
            }
          }}
        />
        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          title={nameTagMessages.clearAllTitle}
          description={nameTagMessages.clearAllDescription.replace('{count}', items.length.toLocaleString(locale))}
          confirmLabel={nameTagMessages.clearAll}
          onConfirm={() => {
            void handleClearAll();
          }}
        />
      </AccountWorkbenchShell>
    </AppShell>
  );
}
