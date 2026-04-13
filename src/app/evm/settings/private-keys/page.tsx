"use client";

import {
  IconCheck,
  IconInfoCircle,
  IconPencil,
  IconTrash,
  IconX,
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
import {
  createEvmStoredPrivateKey,
  deleteEvmStoredPrivateKey,
  getEvmKeyringSource,
  getActiveEvmStoredPrivateKey,
  listEvmStoredPrivateKeys,
  renameEvmStoredPrivateKey,
  setActiveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  syncEvmKeyringFromServer,
  type EvmStoredPrivateKey,
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
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);
  const [source, setSource] = useState<"guest" | "server">("guest");
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    privateKey: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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

  const isGuest = source !== "server";

  function goToLogin() {
    router.push("/login?callbackUrl=%2Fevm%2Fsettings%2Fprivate-keys");
  }

  function resetImportForm() {
    setForm({
      name: "",
      privateKey: "",
    });
    setCreateError(null);
  }

  async function handleCreate() {
    try {
      await createEvmStoredPrivateKey({
        name: form.name,
        privateKey: form.privateKey,
        securityMode: "plain",
      });
      resetImportForm();
      setImportDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
        goToLogin();
        return;
      }

      setCreateError(error instanceof Error ? error.message : "Failed to save private key.");
    }
  }

  async function handleSaveEdit(itemId: string) {
    try {
      await renameEvmStoredPrivateKey(itemId, editingName);
      setEditingId(null);
      setEditingName("");
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
        goToLogin();
      }
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteEvmStoredPrivateKey(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AuthRequiredError") {
        goToLogin();
      }
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
                tooltip={isGuest ? "Guest mode uses the built-in Alice key." : "Stored in your signed-in account."}
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
                tooltip={isGuest ? "Sign in to manage account private keys." : "All private keys are synced to your account."}
                className="text-slate-400 hover:text-slate-600"
                wrapperClassName="shrink-0"
              >
                <IconInfoCircle className="size-3.5" stroke={1.8} />
              </ActionIconButton>
            </div>
            <p className="mt-2 text-3xl font-semibold leading-none text-slate-900">{isGuest ? "Guest" : "Account"}</p>
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
                  if (status !== "authenticated" || isGuest) {
                    goToLogin();
                    return;
                  }

                  resetImportForm();
                  setImportDialogOpen(true);
                }}
              >
                {isGuest ? "Sign In to Add" : "Add"}
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
                    Storage
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
                          <Link
                            href={`/evm/address/${item.address}`}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          >
                            {formatAddressLabel(item.address)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700">
                          <Badge variant="secondary">{isGuest ? "Built-in" : "Remote"}</Badge>
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
                                  onClick={() => void handleSaveEdit(item.id)}
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
                                {isGuest ? null : (
                                  <>
                                    <ActionIconButton
                                      className="text-slate-400 hover:text-slate-700"
                                      tooltip="Rename private key"
                                      aria-label="Rename private key"
                                      onClick={() => {
                                        setEditingId(item.id);
                                        setEditingName(item.name);
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
                                )}
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
          description="Save a private key with a display name to your signed-in account."
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
            {createError ? <p className="text-sm text-rose-600">{createError}</p> : null}
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
