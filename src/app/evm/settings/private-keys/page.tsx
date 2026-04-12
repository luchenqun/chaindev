"use client";

import {
  IconCheck,
  IconInfoCircle,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { SecretInputDialog } from "@/components/ui/secret-input-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countUnlockedEvmStoredPrivateKeys,
  createEvmStoredPrivateKey,
  deleteEvmStoredPrivateKey,
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  listEvmStoredPrivateKeys,
  lockEvmStoredPrivateKey,
  renameEvmStoredPrivateKey,
  setActiveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  unlockEvmStoredPrivateKey,
  type EvmStoredPrivateKey,
  type EvmStoredPrivateKeySecurityMode,
} from "@/domains/evm/client/keyring";
import { AppShell } from "@/platform/layout/app-shell";

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export default function EvmPrivateKeysPage() {
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    privateKey: "",
    securityMode: "encrypted" as EvmStoredPrivateKeySecurityMode,
    password: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EvmStoredPrivateKey | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<EvmStoredPrivateKey | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [plainSaveDialogOpen, setPlainSaveDialogOpen] = useState(false);

  useEffect(() => {
    function load() {
      setItems(listEvmStoredPrivateKeys());
      setActiveItem(getActiveEvmStoredPrivateKey());
      setLoading(false);
    }

    load();

    return subscribeEvmKeyring(load);
  }, []);

  const unlockedCount = countUnlockedEvmStoredPrivateKeys();

  function resetImportForm() {
    setForm({
      name: "",
      privateKey: "",
      securityMode: "encrypted",
      password: "",
    });
    setCreateError(null);
  }

  async function handleCreate() {
    try {
      await createEvmStoredPrivateKey({
        name: form.name,
        privateKey: form.privateKey,
        securityMode: form.securityMode,
        password: form.password,
      });
      resetImportForm();
      setImportDialogOpen(false);
      return true;
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to save private key.");
      return false;
    }
  }

  function handleStartEdit(item: EvmStoredPrivateKey) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  function handleSaveEdit(itemId: string) {
    try {
      renameEvmStoredPrivateKey(itemId, editingName);
      setEditingId(null);
      setEditingName("");
    } catch {
      // Keep the inline editor open so the user can correct the name.
    }
  }

  async function handleConfirmUnlock() {
    if (!unlockTarget) {
      return;
    }

    try {
      await unlockEvmStoredPrivateKey(unlockTarget.id, unlockPassword);
      setUnlockPassword("");
      setUnlockError(null);
      setUnlockTarget(null);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock private key.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="section-block">
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500">
            Loading private keys...
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Private Keys</h1>
          <p className="mt-2 text-sm text-slate-500">
            Save local EVM private keys, choose one as the active key, and prepare for future deploy or write actions.
          </p>
        </div>

        <section className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total Keys
              </p>
              <ActionIconButton
                tooltip="Stored locally in the current browser."
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Selected Key
              </p>
              <ActionIconButton
                tooltip="Choose one key for global EVM actions."
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {activeItem ? activeItem.name : "Not Selected"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {activeItem ? formatAddressLabel(activeItem.address) : "No active key"}
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Unlocked Keys
              </p>
              <ActionIconButton
                tooltip="Plain keys are always available. Encrypted keys need manual unlock."
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{unlockedCount}</p>
          </article>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Saved Keys</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the active key for global EVM actions, rename entries, unlock encrypted keys, or delete them.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  resetImportForm();
                  setImportDialogOpen(true);
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Name
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Address
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Security
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Last Used
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item) => {
                    const unlocked = isEvmStoredPrivateKeyUnlocked(item.id);
                    const isActive = activeItem?.id === item.id;

                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          {editingId === item.id ? (
                            <Input
                              value={editingName}
                              onChange={(event) => setEditingName(event.target.value)}
                              placeholder="Key name"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{item.name}</span>
                              {isActive ? <Badge variant="secondary">Selected</Badge> : null}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-sky-600">{formatAddressLabel(item.address)}</span>
                            <span className="text-xs text-slate-400">{item.address}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {item.securityMode === "encrypted" ? "Encrypted" : "Plain"}
                            </Badge>
                            {item.securityMode === "encrypted" ? (
                              <span className={unlocked ? "text-emerald-600" : "text-amber-600"}>
                                {unlocked ? "Unlocked" : "Locked"}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">
                          {formatTimestamp(item.lastUsedAt)}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center justify-end gap-0">
                            {editingId === item.id ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-emerald-600"
                                  tooltip="Save private key name"
                                  aria-label="Save private key name"
                                  onClick={() => handleSaveEdit(item.id)}
                                >
                                  <IconCheck className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip="Cancel editing private key name"
                                  aria-label="Cancel editing private key name"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingName("");
                                  }}
                                >
                                  <IconX className="size-4" stroke={1.8} />
                                </ActionIconButton>
                              </>
                            ) : (
                              <>
                                <ActionIconButton
                                  className={isActive
                                    ? "inline-flex items-center justify-center p-[3px] text-emerald-600 transition hover:text-emerald-700"
                                    : "text-slate-400 hover:text-slate-700"}
                                  tooltip="Select active private key"
                                  aria-label="Select active private key"
                                  onClick={() => setActiveEvmStoredPrivateKey(item.id)}
                                >
                                  <IconCheck className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                {item.securityMode === "encrypted" ? (
                                  <ActionIconButton
                                    className={unlocked
                                      ? "inline-flex items-center justify-center p-[3px] text-emerald-600 transition hover:text-slate-700"
                                      : "text-slate-400 hover:text-slate-700"}
                                    tooltip={unlocked ? "Lock private key" : "Unlock private key"}
                                    aria-label={unlocked ? "Lock private key" : "Unlock private key"}
                                    onClick={() => {
                                      if (unlocked) {
                                        lockEvmStoredPrivateKey(item.id);
                                        return;
                                      }

                                      setUnlockTarget(item);
                                      setUnlockPassword("");
                                      setUnlockError(null);
                                    }}
                                  >
                                    {unlocked ? (
                                      <IconLockOpen className="size-4" stroke={1.8} />
                                    ) : (
                                      <IconLock className="size-4" stroke={1.8} />
                                    )}
                                  </ActionIconButton>
                                ) : null}
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip="Rename private key"
                                  aria-label="Rename private key"
                                  onClick={() => handleStartEdit(item)}
                                >
                                  <IconPencil className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-rose-600"
                                  tooltip="Delete private key"
                                  aria-label="Delete private key"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <IconTrash className="size-4" stroke={1.8} />
                                </ActionIconButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      No private keys saved yet.
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
          title="Import Private Key"
          description="Save a private key with a display name. Encrypted storage is recommended by default."
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
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  !form.name.trim() ||
                  !form.privateKey.trim() ||
                  (form.securityMode === "encrypted" && !form.password.trim())
                }
                onClick={() => {
                  if (form.securityMode === "plain") {
                    setPlainSaveDialogOpen(true);
                    return;
                  }

                  void handleCreate();
                }}
              >
                Save Key
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Key name"
            />
            <Select
              value={form.securityMode}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  securityMode: value as EvmStoredPrivateKeySecurityMode,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Security mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encrypted">Encrypted</SelectItem>
                <SelectItem value="plain">Unencrypted</SelectItem>
              </SelectContent>
            </Select>
            <div className="lg:col-span-2">
              <Input
                type="password"
                value={form.privateKey}
                onChange={(event) => setForm((current) => ({ ...current, privateKey: event.target.value }))}
                placeholder="0x..."
              />
            </div>
            {form.securityMode === "encrypted" ? (
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password"
              />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Unencrypted keys are stored in local browser storage as plain text. Only use this for local development or disposable test accounts.
              </div>
            )}
            {createError ? <p className="lg:col-span-2 text-sm text-rose-600">{createError}</p> : null}
          </div>
        </ModalDialog>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title="Delete Private Key"
          description={
            deleteTarget
              ? `Delete the private key "${deleteTarget.name}"? This only removes the local stored entry.`
              : undefined
          }
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteTarget) {
              deleteEvmStoredPrivateKey(deleteTarget.id);
            }
          }}
        />

        <SecretInputDialog
          open={unlockTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setUnlockTarget(null);
              setUnlockPassword("");
              setUnlockError(null);
            }
          }}
          title="Unlock Private Key"
          description={
            unlockTarget
              ? `Enter the password for "${unlockTarget.name}" to make it available in the current session.`
              : undefined
          }
          value={unlockPassword}
          onValueChange={setUnlockPassword}
          placeholder="Password"
          confirmLabel="Unlock"
          confirmDisabled={!unlockPassword.trim()}
          errorMessage={unlockError}
          onConfirm={() => {
            void handleConfirmUnlock();
          }}
        />

        <ConfirmDialog
          open={plainSaveDialogOpen}
          onOpenChange={setPlainSaveDialogOpen}
          title="Save Unencrypted Private Key"
          description="This will store the private key in local browser storage without encryption. Only continue for local development or disposable test accounts."
          confirmLabel="Save Unencrypted Key"
          onConfirm={() => {
            void handleCreate();
          }}
        />
      </main>
    </AppShell>
  );
}
