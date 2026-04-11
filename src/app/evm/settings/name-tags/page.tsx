"use client";

import { IconPencil, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ListPageSkeleton } from "@/components/ui/loading-placeholders";
import {
  clearEvmAddressTags,
  deleteEvmAddressTag,
  listEvmAddressTags,
  subscribeEvmAddressTags,
  upsertEvmAddressTag,
  type EvmAddressTagItem,
} from "@/domains/evm/client/address-tags";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";
import { AppShell } from "@/platform/layout/app-shell";

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export default function EvmNameTagsPage() {
  const [items, setItems] = useState<EvmAddressTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNameTag, setNewNameTag] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EvmAddressTagItem | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [providerName, setProviderName] = useState("Current Provider");

  useEffect(() => {
    function load() {
      setItems(listEvmAddressTags());
      setProviderName(readActiveRpcProfileCookie("evm")?.name ?? "Current Provider");
      setLoading(false);
    }

    load();

    const unsubscribe = subscribeEvmAddressTags(() => {
      load();
    });

    const handleProfileChanged = () => {
      setEditingAddress(null);
      setEditingValue("");
      setDeleteTarget(null);
      setClearDialogOpen(false);
      setNewAddress("");
      setNewNameTag("");
      setCreateError(null);
      load();
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter(
      (item) =>
        item.addressLower.includes(normalizedQuery) ||
        item.nameTag.toLowerCase().includes(normalizedQuery),
    );
  }, [items, searchText]);

  function handleCreate() {
    try {
      upsertEvmAddressTag(newAddress, newNameTag);
      setNewAddress("");
      setNewNameTag("");
      setCreateError(null);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to save name tag.");
    }
  }

  function handleStartEdit(item: EvmAddressTagItem) {
    setEditingAddress(item.address);
    setEditingValue(item.nameTag);
    setDeleteTarget(null);
  }

  function handleSaveEdit(address: string) {
    try {
      upsertEvmAddressTag(address, editingValue);
      setEditingAddress(null);
      setEditingValue("");
    } catch {
      // Ignore invalid save attempts and let the current input remain editable.
    }
  }

  function handleDelete(address: string) {
    deleteEvmAddressTag(address);

    if (editingAddress === address) {
      setEditingAddress(null);
      setEditingValue("");
    }
  }

  function handleClearAll() {
    clearEvmAddressTags();
    setEditingAddress(null);
    setEditingValue("");
    setDeleteTarget(null);
    setClearDialogOpen(false);
  }

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-36" rows={8} columns={4} showToolbar={false} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Name Tags</h1>
            <Badge variant="secondary">{providerName}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Manage manual address labels scoped to the active EVM provider.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">Create Name Tag</p>
            <p className="mt-1 text-sm text-slate-500">
              Add a manual label for an address under the current provider scope.
            </p>
          </div>
          <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
            <Input
              value={newAddress}
              onChange={(event) => setNewAddress(event.target.value)}
              placeholder="0x..."
            />
            <Input
              value={newNameTag}
              onChange={(event) => setNewNameTag(event.target.value)}
              placeholder="Name tag"
            />
            <Button
              type="button"
              disabled={!newAddress.trim() || !newNameTag.trim()}
              onClick={handleCreate}
            >
              Save Tag
            </Button>
          </div>
          {createError ? <p className="px-5 pb-4 text-sm text-rose-600">{createError}</p> : null}
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {filteredItems.length.toLocaleString("en-US")} visible tags
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Search by address or label. Edit and delete directly from this table.
              </p>
            </div>
            <div className="flex w-full max-w-lg items-center justify-end gap-3">
              <div className="w-full max-w-sm">
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search address or name tag"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!items.length}
                onClick={() => setClearDialogOpen(true)}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Address
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Name Tag
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Updated
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <tr key={item.addressLower} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/evm/address/${item.address}`}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          >
                            {formatAddressLabel(item.address)}
                          </Link>
                          <span className="text-xs text-slate-400">{item.address}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {editingAddress === item.address ? (
                          <Input
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            placeholder="Name tag"
                          />
                        ) : (
                          <span className="font-medium text-slate-900">{item.nameTag}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">{formatUpdatedAt(item.updatedAt)}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex justify-end">
                          {editingAddress === item.address ? (
                            <>
                              <Button size="sm" type="button" onClick={() => handleSaveEdit(item.address)}>
                                Save
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setEditingAddress(null);
                                  setEditingValue("");
                                  setDeleteTarget(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="inline-flex size-7 items-center justify-center text-slate-400 transition hover:text-slate-700"
                                title="Edit name tag"
                                aria-label="Edit name tag"
                                onClick={() => handleStartEdit(item)}
                              >
                                <IconPencil className="size-4" stroke={1.8} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-7 items-center justify-center text-slate-400 transition hover:text-rose-600"
                                title="Delete name tag"
                                aria-label="Delete name tag"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <IconTrash className="size-4" stroke={1.8} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-6 text-sm text-slate-500" colSpan={4}>
                      No name tags found under the current provider scope.
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
          description={
            deleteTarget
              ? `Delete the label "${deleteTarget.nameTag}" for ${formatAddressLabel(deleteTarget.address)}?`
              : undefined
          }
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteTarget) {
              handleDelete(deleteTarget.address);
            }
          }}
        />
        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          title="Clear All Name Tags"
          description={`Clear all ${items.length.toLocaleString("en-US")} name tags under the current provider scope?`}
          confirmLabel="Clear All"
          onConfirm={handleClearAll}
        />
      </main>
    </AppShell>
  );
}
