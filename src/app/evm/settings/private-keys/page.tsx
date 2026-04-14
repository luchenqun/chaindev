"use client";

import {
  IconCopy,
  IconEye,
  IconInfoCircle,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
import { useToast } from "@/components/ui/toast";
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

type ProtectedActionState = {
  type: "view" | "edit";
  item: EvmStoredPrivateKey;
} | null;

export default function EvmPrivateKeysPage() {
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);
  const [source, setSource] = useState<"guest" | "server">("guest");
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    privateKey: "",
    password: "",
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
    id: "",
    name: "",
    privateKey: "",
    securityMode: "plain",
    password: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editUnlockPasswordFallback, setEditUnlockPasswordFallback] = useState<string | null>(null);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [revealedItem, setRevealedItem] = useState<EvmStoredPrivateKey | null>(null);
  const [revealedPrivateKey, setRevealedPrivateKey] = useState("");
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
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

  const isAuthenticated = status === "authenticated";
  const isUsingFallback = source !== "server";

  function goToLogin() {
    router.push("/login?callbackUrl=%2Fevm%2Fsettings%2Fprivate-keys");
  }

  function resetImportForm() {
    setForm({
      name: "",
      privateKey: "",
      password: "",
    });
    setCreateError(null);
  }

  function resetEditForm() {
    setEditForm({
      id: "",
      name: "",
      privateKey: "",
      securityMode: "plain",
      password: "",
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
      password: "",
    });
    setEditUnlockPasswordFallback(passwordFallback ?? null);
    setEditError(null);
    setEditDialogOpen(true);
  }

  async function handleOpenProtectedAction(action: NonNullable<ProtectedActionState>) {
    try {
      const privateKey = await peekEvmStoredPrivateKey(action.item.id);

      if (action.type === "view") {
        openRevealDialog(action.item, privateKey);
      } else {
        openEditDialog(action.item, privateKey);
      }
    } catch (error) {
      showToast({
        title: "Failed to load private key.",
        description: error instanceof Error ? error.message : "Failed to load private key.",
        tone: "error",
      });
    }
  }

  async function handleCreate() {
    try {
      await createEvmStoredPrivateKey({
        name: form.name,
        privateKey: form.privateKey,
        securityMode: form.password ? "encrypted" : "plain",
        password: form.password || undefined,
      });
      await syncEvmKeyringFromServer();
      resetImportForm();
      setImportDialogOpen(false);
      showToast({
        title: "Private key added successfully.",
        description: "The latest keys have been reloaded from your account.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
        goToLogin();
        return;
      }

      setCreateError(error instanceof Error ? error.message : "Failed to save private key.");
    }
  }

  async function handleSaveEdit() {
    const passwordForSave =
      editForm.securityMode === "encrypted"
        ? editForm.password || editUnlockPasswordFallback || undefined
        : undefined;

    if (editForm.securityMode === "encrypted" && !passwordForSave) {
      setEditError("Password is required for encrypted private keys.");
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
        title: "Private key updated successfully.",
        description: "The latest keys have been reloaded from your account.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
        goToLogin();
        return;
      }

      setEditError(error instanceof Error ? error.message : "Failed to update private key.");
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
        title: "Private key deleted successfully.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
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

      if (pendingProtectedAction.type === "view") {
        openRevealDialog(pendingProtectedAction.item, privateKey);
      } else {
        openEditDialog(pendingProtectedAction.item, privateKey, unlockPassword);
      }

      setUnlockDialogOpen(false);
      setUnlockPassword("");
      setUnlockError(null);
      setPendingProtectedAction(null);
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
            Save EVM private keys to your account, choose one as the active key, and use it across deploy and write actions.
          </p>
        </div>

        <section className="grid gap-3 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total Keys
              </p>
              <ActionIconButton
                tooltip={
                  isAuthenticated
                    ? isUsingFallback
                      ? "No saved account keys yet. Using the built-in Alice key until you add one."
                      : "Stored in your signed-in account."
                    : "Guest mode uses the built-in Alice key."
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
                Storage
              </p>
              <ActionIconButton
                tooltip={
                  isAuthenticated
                    ? isUsingFallback
                      ? "You are signed in, but no account keys are saved yet."
                      : "All private keys are synced to your account."
                    : "Sign in to manage account private keys."
                }
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{isAuthenticated ? "Account" : "Guest"}</p>
          </article>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Saved Keys</p>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the active key for global EVM actions, rename entries, or delete them.
                </p>
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
                {isAuthenticated ? "Add" : "Sign In to Add"}
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
                    return (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <Link
                            href={`/evm/address/${item.address}`}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          >
                            {formatAddressLabel(item.address)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <Badge
                            className={
                              item.securityMode === "encrypted"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50"
                            }
                            variant="secondary"
                          >
                            {item.securityMode === "encrypted" ? "Encrypted" : "Plain"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">
                          {formatTimestamp(item.lastUsedAt)}
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center justify-end gap-0">
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip="View private key"
                              aria-label="View private key"
                              onClick={() => {
                                if (item.securityMode === "encrypted") {
                                  setPendingProtectedAction({ type: "view", item });
                                  setUnlockPassword("");
                                  setUnlockError(null);
                                  setUnlockDialogOpen(true);
                                  return;
                                }

                                void handleOpenProtectedAction({ type: "view", item });
                              }}
                            >
                              <IconEye className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            {source === "server" ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip="Edit private key"
                                  aria-label="Edit private key"
                                  onClick={() => {
                                    if (item.securityMode === "encrypted") {
                                      setPendingProtectedAction({ type: "edit", item });
                                      setUnlockPassword("");
                                      setUnlockError(null);
                                      setUnlockDialogOpen(true);
                                      return;
                                    }

                                    void handleOpenProtectedAction({ type: "edit", item });
                                  }}
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
                            ) : null}
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
          description="Save a private key to your account. Add a password if you want to encrypt it before storing remotely."
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
                disabled={!form.name.trim() || !form.privateKey.trim()}
                onClick={() => void handleCreate()}
              >
                Save Key
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Key name"
            />
            <Input
              type="password"
              value={form.privateKey}
              onChange={(event) => setForm((current) => ({ ...current, privateKey: event.target.value }))}
              placeholder="0x..."
            />
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Optional password for remote encryption"
            />
            <p className="text-xs text-slate-500">
              Leave the password empty to store the key as plain text in your remote account.
            </p>
            {createError ? <p className="text-sm text-rose-600">{createError}</p> : null}
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
          title="Edit Private Key"
          description="Update the key name, private key value, and security mode."
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
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!editForm.name.trim() || !editForm.privateKey.trim()}
                onClick={() => void handleSaveEdit()}
              >
                Save Changes
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Key name"
            />
            <Input
              type="text"
              value={editForm.privateKey}
              onChange={(event) => setEditForm((current) => ({ ...current, privateKey: event.target.value }))}
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
                <SelectValue placeholder="Select security mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Plain</SelectItem>
                <SelectItem value="encrypted">Encrypted</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="password"
              value={editForm.password}
              onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
              placeholder={
                editForm.securityMode === "encrypted"
                  ? editUnlockPasswordFallback
                    ? "Leave empty to keep the current password"
                    : "Password for encrypted storage"
                  : "Password not required for plain storage"
              }
            />
            {editForm.securityMode === "encrypted" ? (
              <p className="text-xs text-slate-500">
                {editUnlockPasswordFallback
                  ? "Leave the password empty to keep the current encryption password."
                  : "Encrypted storage requires a password."}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Plain storage keeps the private key unencrypted in your remote account.
              </p>
            )}
            {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={revealDialogOpen}
          onOpenChange={(open) => {
            setRevealDialogOpen(open);

            if (!open) {
              setRevealedItem(null);
              setRevealedPrivateKey("");
            }
          }}
          title="View Private Key"
          description={revealedItem ? `Showing the private key for "${revealedItem.name}".` : undefined}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRevealDialogOpen(false);
                  setRevealedItem(null);
                  setRevealedPrivateKey("");
                }}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(revealedPrivateKey);
                  showToast({
                    title: "Private key copied.",
                    tone: "success",
                  });
                }}
                disabled={!revealedPrivateKey}
              >
                <IconCopy className="mr-1 size-4" stroke={1.8} />
                Copy
              </Button>
            </>
          }
          maxWidthClassName="max-w-2xl"
        >
          <div className="grid gap-3">
            <Input type="text" value={revealedPrivateKey} readOnly />
            <p className="text-xs text-rose-600">Anyone with this value can control the account.</p>
          </div>
        </ModalDialog>

        <SecretInputDialog
          open={unlockDialogOpen}
          onOpenChange={(open) => {
            setUnlockDialogOpen(open);

            if (!open) {
              setUnlockPassword("");
              setUnlockError(null);
              setPendingProtectedAction(null);
            }
          }}
          title="Unlock Private Key"
          description={
            pendingProtectedAction
              ? `Enter the password for "${pendingProtectedAction.item.name}" to ${pendingProtectedAction.type === "view" ? "view" : "edit"} the private key.`
              : "Enter the password to continue."
          }
          value={unlockPassword}
          onValueChange={setUnlockPassword}
          placeholder="Enter password"
          confirmLabel="Unlock"
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
          title="Delete Private Key"
          description={
            deleteTarget
              ? `Delete the private key "${deleteTarget.name}" from your account?`
              : undefined
          }
          confirmLabel="Delete"
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      </main>
    </AppShell>
  );
}
