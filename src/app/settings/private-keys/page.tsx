'use client';

import { IconCopy, IconEye, IconInfoCircle, IconPencil, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  createEvmStoredPrivateKey,
  deleteEvmStoredPrivateKey,
  getEvmKeyringSource,
  getActiveEvmStoredPrivateKey,
  listEvmStoredPrivateKeys,
  peekEvmStoredPrivateKey,
  subscribeEvmKeyring,
  syncEvmKeyringFromServer,
  updateEvmStoredPrivateKey,
  type EvmStoredPrivateKey,
  type EvmStoredPrivateKeySecurityMode,
} from '@/domains/evm/client/keyring';
import { formatLocalizedDateTime } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { AccountWorkbenchShell } from '@/platform/layout/account-workbench-shell';

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatTimestamp(timestamp: number | null, neverLabel: string, locale: string) {
  if (!timestamp) {
    return neverLabel;
  }

  return formatLocalizedDateTime(timestamp, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, locale);
}

type ProtectedActionState = {
  type: 'view' | 'edit';
  item: EvmStoredPrivateKey;
} | null;

export default function PrivateKeysPage() {
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const keyMessages = messages.privateKeys;
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);
  const [source, setSource] = useState<'guest' | 'server'>('guest');
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    privateKey: '',
    password: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    privateKey: string;
    securityMode: EvmStoredPrivateKeySecurityMode;
    password: string;
  }>({
    id: '',
    name: '',
    privateKey: '',
    securityMode: 'plain',
    password: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editUnlockPasswordFallback, setEditUnlockPasswordFallback] = useState<string | null>(null);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealedItem, setRevealedItem] = useState<EvmStoredPrivateKey | null>(null);
  const [revealedPrivateKey, setRevealedPrivateKey] = useState('');
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pendingProtectedAction, setPendingProtectedAction] = useState<ProtectedActionState>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvmStoredPrivateKey | null>(null);

  useEffect(() => {
    function load() {
      setItems(listEvmStoredPrivateKeys());
      setActiveItem(getActiveEvmStoredPrivateKey());
      setSource(getEvmKeyringSource());
      setLoading(false);
    }

    load();
    void syncEvmKeyringFromServer().catch(() => undefined);

    return subscribeEvmKeyring(load);
  }, []);

  const isAuthenticated = status === 'authenticated';
  const isUsingFallback = source !== 'server';

  function goToLogin() {
    router.push('/login?callbackUrl=%2Fsettings%2Fprivate-keys');
  }

  function resetImportForm() {
    setForm({
      name: '',
      privateKey: '',
      password: '',
    });
    setCreateError(null);
  }

  function resetEditForm() {
    setEditForm({
      id: '',
      name: '',
      privateKey: '',
      securityMode: 'plain',
      password: '',
    });
    setEditError(null);
    setEditUnlockPasswordFallback(null);
  }

  function openRevealDialog(item: EvmStoredPrivateKey, privateKey: string) {
    setRevealedItem(item);
    setRevealedPrivateKey(privateKey);
    setRevealDialogOpen(true);
  }

  function openEditDialog(item: EvmStoredPrivateKey, privateKey: string, passwordFallback?: string) {
    setEditForm({
      id: item.id,
      name: item.name,
      privateKey,
      securityMode: item.securityMode,
      password: '',
    });
    setEditUnlockPasswordFallback(passwordFallback ?? null);
    setEditError(null);
    setEditDialogOpen(true);
  }

  async function handleOpenProtectedAction(action: NonNullable<ProtectedActionState>) {
    try {
      const privateKey = await peekEvmStoredPrivateKey(action.item.id);

      if (action.type === 'view') {
        openRevealDialog(action.item, privateKey);
      } else {
        openEditDialog(action.item, privateKey);
      }
    } catch (error) {
      showToast({
        title: keyMessages.failedToLoad,
        description: error instanceof Error ? translateRuntimeText(error.message, locale) : keyMessages.failedToLoad,
        tone: 'error',
      });
    }
  }

  async function handleCreate() {
    try {
      await createEvmStoredPrivateKey({
        name: form.name,
        privateKey: form.privateKey,
        securityMode: form.password ? 'encrypted' : 'plain',
        password: form.password || undefined,
      });
      await syncEvmKeyringFromServer();
      resetImportForm();
      setImportDialogOpen(false);
      showToast({
        title: keyMessages.added,
        description: keyMessages.reloaded,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setCreateError(error instanceof Error ? translateRuntimeText(error.message, locale) : keyMessages.failedToSave);
    }
  }

  async function handleSaveEdit() {
    const passwordForSave = editForm.securityMode === 'encrypted' ? editForm.password || editUnlockPasswordFallback || undefined : undefined;

    if (editForm.securityMode === 'encrypted' && !passwordForSave) {
      setEditError(keyMessages.passwordRequiredForEncrypted);
      return;
    }

    try {
      await updateEvmStoredPrivateKey({
        id: editForm.id,
        name: editForm.name,
        privateKey: editForm.privateKey,
        securityMode: editForm.securityMode,
        password: passwordForSave,
      });
      await syncEvmKeyringFromServer();
      setEditDialogOpen(false);
      resetEditForm();
      showToast({
        title: keyMessages.updated,
        description: keyMessages.reloaded,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setEditError(error instanceof Error ? translateRuntimeText(error.message, locale) : keyMessages.failedToUpdate);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteEvmStoredPrivateKey(deleteTarget.id);
      setDeleteTarget(null);
      showToast({
        title: keyMessages.deleted,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  async function handleConfirmUnlock() {
    if (!pendingProtectedAction) {
      return;
    }

    try {
      const privateKey = await peekEvmStoredPrivateKey(pendingProtectedAction.item.id, unlockPassword);

      if (pendingProtectedAction.type === 'view') {
        openRevealDialog(pendingProtectedAction.item, privateKey);
      } else {
        openEditDialog(pendingProtectedAction.item, privateKey, unlockPassword);
      }

      setUnlockDialogOpen(false);
      setUnlockPassword('');
      setUnlockError(null);
      setPendingProtectedAction(null);
    } catch (error) {
      setUnlockError(error instanceof Error ? translateRuntimeText(error.message, locale) : keyMessages.failedToUnlock);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <AccountWorkbenchShell mode="evm">
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">{keyMessages.loadingPage}</div>
        </AccountWorkbenchShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AccountWorkbenchShell mode="evm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{keyMessages.pageTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{keyMessages.pageDescription}</p>
        </div>

        <section className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{keyMessages.totalKeys}</p>
              <ActionIconButton
                tooltip={
                  isAuthenticated
                    ? isUsingFallback
                      ? keyMessages.totalKeysNoSavedHint
                      : keyMessages.totalKeysAccountHint
                    : keyMessages.totalKeysGuestHint
                }
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{items.length}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{keyMessages.selectedKey}</p>
              <ActionIconButton tooltip={keyMessages.selectedKeyHint} className="text-slate-400 hover:text-slate-600" wrapperClassName="shrink-0">
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900">{activeItem ? activeItem.name : keyMessages.notSelected}</p>
            <p className="mt-1 text-sm text-slate-500">{activeItem ? formatAddressLabel(activeItem.address) : keyMessages.noActiveKey}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{keyMessages.storage}</p>
              <ActionIconButton
                tooltip={
                  isAuthenticated
                    ? isUsingFallback
                      ? keyMessages.storageNoSavedHint
                      : keyMessages.storageAccountHint
                    : keyMessages.storageGuestHint
                }
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{isAuthenticated ? keyMessages.accountStorage : keyMessages.guestStorage}</p>
          </article>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{keyMessages.savedKeys}</p>
                <p className="mt-1 text-sm text-slate-500">{keyMessages.savedKeysDescription}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!isAuthenticated) {
                    goToLogin();
                    return;
                  }

                  resetImportForm();
                  setImportDialogOpen(true);
                }}
              >
                {isAuthenticated ? keyMessages.add : keyMessages.signInToAdd}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.name}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{keyMessages.security}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{keyMessages.lastUsed}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item) => {
                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <Link href={`/evm/address/${item.address}`} className="font-medium text-sky-600 hover:text-sky-700">
                            {formatAddressLabel(item.address)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <Badge
                            className={
                              item.securityMode === 'encrypted'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50'
                            }
                            variant="secondary"
                          >
                            {item.securityMode === 'encrypted' ? keyMessages.encrypted : keyMessages.plain}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(item.lastUsedAt, messages.common.never, locale)}</td>
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center justify-end gap-0">
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip={keyMessages.viewPrivateKey}
                              aria-label={keyMessages.viewPrivateKey}
                              onClick={() => {
                                if (item.securityMode === 'encrypted') {
                                  setPendingProtectedAction({
                                    type: 'view',
                                    item,
                                  });
                                  setUnlockPassword('');
                                  setUnlockError(null);
                                  setUnlockDialogOpen(true);
                                  return;
                                }

                                void handleOpenProtectedAction({
                                  type: 'view',
                                  item,
                                });
                              }}
                            >
                              <IconEye className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            {source === 'server' ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip={keyMessages.editPrivateKey}
                                  aria-label={keyMessages.editPrivateKey}
                                  onClick={() => {
                                    if (item.securityMode === 'encrypted') {
                                      setPendingProtectedAction({
                                        type: 'edit',
                                        item,
                                      });
                                      setUnlockPassword('');
                                      setUnlockError(null);
                                      setUnlockDialogOpen(true);
                                      return;
                                    }

                                    void handleOpenProtectedAction({
                                      type: 'edit',
                                      item,
                                    });
                                  }}
                                >
                                  <IconPencil className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-rose-600"
                                  tooltip={keyMessages.deletePrivateKey}
                                  aria-label={keyMessages.deletePrivateKey}
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <IconTrash className="size-4" stroke={1.8} />
                                </ActionIconButton>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      {keyMessages.noPrivateKeysSaved}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ModalDialog
          open={importDialogOpen}
          onOpenChange={(open) => {
            setImportDialogOpen(open);

            if (!open) {
              resetImportForm();
            }
          }}
          title={keyMessages.importPrivateKey}
          description={keyMessages.importPrivateKeyDescription}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setImportDialogOpen(false);
                  resetImportForm();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button type="button" disabled={!form.name.trim() || !form.privateKey.trim()} onClick={() => void handleCreate()}>
                {keyMessages.saveKey}
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={keyMessages.keyName} />
            <Input
              type="password"
              value={form.privateKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  privateKey: event.target.value,
                }))
              }
              placeholder="0x..."
            />
            <Input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={keyMessages.optionalPasswordForRemoteEncryption}
            />
            <p className="text-xs text-slate-500">{keyMessages.leavePasswordEmptyForPlain}</p>
            {createError ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(createError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);

            if (!open) {
              resetEditForm();
            }
          }}
          title={keyMessages.editPrivateKeyTitle}
          description={keyMessages.editPrivateKeyDescription}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditDialogOpen(false);
                  resetEditForm();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button type="button" disabled={!editForm.name.trim() || !editForm.privateKey.trim()} onClick={() => void handleSaveEdit()}>
                {keyMessages.saveChanges}
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input
              value={editForm.name}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={keyMessages.keyName}
            />
            <Input
              type="text"
              value={editForm.privateKey}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  privateKey: event.target.value,
                }))
              }
              placeholder="0x..."
            />
            <Select
              value={editForm.securityMode}
              onValueChange={(value) =>
                setEditForm((current) => ({
                  ...current,
                  securityMode: value as EvmStoredPrivateKeySecurityMode,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={keyMessages.selectSecurityMode} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">{keyMessages.plain}</SelectItem>
                <SelectItem value="encrypted">{keyMessages.encrypted}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="password"
              value={editForm.password}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={
                editForm.securityMode === 'encrypted'
                  ? editUnlockPasswordFallback
                    ? keyMessages.keepCurrentPassword
                    : keyMessages.passwordForEncryptedStorage
                  : keyMessages.passwordNotRequiredForPlainStorage
              }
            />
            {editForm.securityMode === 'encrypted' ? (
              <p className="text-xs text-slate-500">
                {editUnlockPasswordFallback ? keyMessages.keepCurrentPasswordHint : keyMessages.encryptedStorageRequiresPassword}
              </p>
            ) : (
              <p className="text-xs text-slate-500">{keyMessages.plainStorageHint}</p>
            )}
            {editError ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(editError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={revealDialogOpen}
          onOpenChange={(open) => {
            setRevealDialogOpen(open);

            if (!open) {
              setRevealedItem(null);
              setRevealedPrivateKey('');
            }
          }}
          title={keyMessages.viewPrivateKeyTitle}
          description={revealedItem ? keyMessages.showingPrivateKeyFor.replace('{name}', revealedItem.name) : undefined}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRevealDialogOpen(false);
                  setRevealedItem(null);
                  setRevealedPrivateKey('');
                }}
              >
                {messages.common.close}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedPrivateKey);
                  showToast({
                    title: keyMessages.copied,
                    tone: 'success',
                  });
                }}
                disabled={!revealedPrivateKey}
              >
                <IconCopy className="mr-1 size-4" stroke={1.8} />
                {keyMessages.copy}
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input type="text" value={revealedPrivateKey} readOnly />
            <p className="text-xs text-rose-600">{keyMessages.dangerousPrivateKeyWarning}</p>
          </div>
        </ModalDialog>

        <SecretInputDialog
          open={unlockDialogOpen}
          onOpenChange={(open) => {
            setUnlockDialogOpen(open);

            if (!open) {
              setUnlockPassword('');
              setUnlockError(null);
              setPendingProtectedAction(null);
            }
          }}
          title={keyMessages.unlockPrivateKey}
          description={
            pendingProtectedAction
              ? keyMessages.unlockPrivateKeyDescription
                  .replace('{name}', pendingProtectedAction.item.name)
                  .replace('{action}', pendingProtectedAction.type === 'view' ? keyMessages.viewAction : keyMessages.editAction)
              : keyMessages.unlockContinueDescription
          }
          value={unlockPassword}
          onValueChange={setUnlockPassword}
          placeholder={keyMessages.enterPassword}
          confirmLabel={keyMessages.unlock}
          confirmDisabled={!unlockPassword.trim()}
          errorMessage={unlockError}
          onConfirm={() => void handleConfirmUnlock()}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={keyMessages.deletePrivateKeyTitle}
          description={deleteTarget ? keyMessages.deletePrivateKeyDescription.replace('{name}', deleteTarget.name) : undefined}
          confirmLabel={keyMessages.delete}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      </AccountWorkbenchShell>
    </AppShell>
  );
}
