"use client";

import { IconEdit, IconListDetails, IconPlugConnected, IconPlus, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PlatformMode } from "@/config/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearActiveRpcProfileCookie,
  createRpcProfile,
  editRpcProfile,
  fetchRpcProfiles,
  readActiveRpcProfileCookie,
  removeRpcProfile,
  setLocalSelectedRpcProfile,
  writeActiveRpcProfileCookie,
} from "@/platform/workbench/rpc-profile-client";
import type { RpcProfile, RpcProfileDraft, SelectedRpcProfileMap } from "@/platform/workbench/rpc-profile";

type RpcProviderManagerProps = {
  mode: PlatformMode;
};

type DraftState = {
  mode: PlatformMode;
  name: string;
  nativeCurrencySymbol: string;
  rpcUrl: string;
  restUrl: string;
};

function getInitialDraft(mode: PlatformMode): DraftState {
  return {
    mode,
    name: "",
    nativeCurrencySymbol: mode === "evm" ? "ETH" : "",
    rpcUrl: "",
    restUrl: "",
  };
}

function getPreferredProfile(mode: PlatformMode, profiles: RpcProfile[], selected: SelectedRpcProfileMap) {
  const modeProfiles = profiles.filter((profile) => profile.mode === mode);
  const preferredId = selected[mode] ?? modeProfiles[0]?.id;

  return modeProfiles.find((profile) => profile.id === preferredId) ?? modeProfiles[0] ?? null;
}

function getModeLabel(mode: PlatformMode) {
  return mode.toUpperCase();
}

function getDraftFromProfile(profile: RpcProfile): DraftState {
  return {
    mode: profile.mode,
    name: profile.name,
    nativeCurrencySymbol: profile.nativeCurrencySymbol ?? "ETH",
    rpcUrl: profile.rpcUrl,
    restUrl: profile.restUrl ?? "",
  };
}

export function RpcProviderManager({ mode }: RpcProviderManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<RpcProfile[]>([]);
  const [selected, setSelected] = useState<SelectedRpcProfileMap>({});
  const [draft, setDraft] = useState<DraftState>(getInitialDraft(mode));

  const modeProfiles = useMemo(() => profiles.filter((profile) => profile.mode === mode), [mode, profiles]);
  const activeProfile = useMemo(() => getPreferredProfile(mode, profiles, selected), [mode, profiles, selected]);
  const sortedProfiles = useMemo(
    () =>
      [...profiles].sort((left, right) => {
        if (left.mode !== right.mode) {
          return left.mode.localeCompare(right.mode);
        }

        return right.updatedAt - left.updatedAt;
      }),
    [profiles],
  );

  useEffect(() => {
    setDraft((current) => (current.mode === mode ? current : getInitialDraft(mode)));
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const data = await fetchRpcProfiles();

        if (cancelled) {
          return;
        }

        setProfiles(data.profiles);
        setSelected(data.selected);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load RPC providers.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const preferred = getPreferredProfile(mode, profiles, selected);
    const cookieProfile = readActiveRpcProfileCookie(mode);

    if (!preferred) {
      if (cookieProfile) {
        clearActiveRpcProfileCookie(mode);
        router.refresh();
      }

      return;
    }

    setLocalSelectedRpcProfile(mode, preferred.id);

    if (
      cookieProfile?.id !== preferred.id ||
      cookieProfile.rpcUrl !== preferred.rpcUrl ||
      cookieProfile.restUrl !== preferred.restUrl
    ) {
      writeActiveRpcProfileCookie(preferred);
      router.refresh();
    }
  }, [loading, mode, profiles, router, selected]);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const payload: RpcProfileDraft =
        draft.mode === "evm"
          ? {
              mode: "evm",
              name: draft.name.trim(),
              nativeCurrencySymbol: draft.nativeCurrencySymbol.trim(),
              rpcUrl: draft.rpcUrl.trim(),
            }
          : {
              mode: "cosmos",
              name: draft.name.trim(),
              rpcUrl: draft.rpcUrl.trim(),
              restUrl: draft.restUrl.trim(),
            };

      const { profile } = editingId ? await editRpcProfile(editingId, payload) : await createRpcProfile(payload);
      const nextProfiles = [profile, ...profiles.filter((item) => item.id !== profile.id)];
      const nextSelected = {
        ...selected,
        [profile.mode]: profile.id,
      };

      setProfiles(nextProfiles);
      setSelected(nextSelected);
      writeActiveRpcProfileCookie(profile);
      setLocalSelectedRpcProfile(profile.mode, profile.id);
      setDraft(getInitialDraft(mode));
      setEditingId(null);
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save RPC provider.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile: RpcProfile) {
    setDeletingId(profile.id);
    setError(null);

    try {
      await removeRpcProfile(profile.mode, profile.id);
      const remaining = profiles.filter((item) => item.id !== profile.id);
      const fallback = getPreferredProfile(profile.mode, remaining, {
        ...selected,
        [profile.mode]: selected[profile.mode] === profile.id ? undefined : selected[profile.mode],
      });
      const nextSelected = {
        ...selected,
        [profile.mode]: fallback?.id,
      };

      setProfiles(remaining);
      setSelected(nextSelected);

      if (profile.mode === mode && activeProfile?.id === profile.id) {
        if (fallback) {
          writeActiveRpcProfileCookie(fallback);
          setLocalSelectedRpcProfile(profile.mode, fallback.id);
        } else {
          clearActiveRpcProfileCookie(profile.mode);
          setLocalSelectedRpcProfile(profile.mode, null);
        }

        router.refresh();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete RPC provider.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSelect(profileId: string) {
    const profile = modeProfiles.find((item) => item.id === profileId) ?? null;
    handleUse(profile ?? null);
  }

  function handleUse(profile: RpcProfile | null) {
    if (!profile) {
      return;
    }

    const nextSelected = {
      ...selected,
      [profile.mode]: profile.id,
    };

    setSelected(nextSelected);
    setLocalSelectedRpcProfile(profile.mode, profile.id);
    writeActiveRpcProfileCookie(profile);

    if (profile.mode !== mode) {
      router.push(`/${profile.mode}/overview`);
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <label className="flex h-10 items-center pr-1 text-[13px] text-slate-600">
          <Select
            value={activeProfile?.id}
            disabled={loading || modeProfiles.length === 0}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="h-9 min-w-[220px] border-0 bg-transparent px-4 text-[13px] shadow-none focus:ring-0">
              {activeProfile ? (
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {getModeLabel(activeProfile.mode)}
                  </span>
                  <span className="truncate text-[13px] text-slate-900">{activeProfile.name}</span>
                </div>
              ) : (
                <SelectValue placeholder="No provider" />
              )}
            </SelectTrigger>
            <SelectContent className="min-w-[220px]">
              {modeProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {getModeLabel(profile.mode)}
                    </span>
                    <span>{profile.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center border-l border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          onClick={() => {
            setDraft(getInitialDraft(mode));
            setEditingId(null);
            setError(null);
            setOpen(true);
          }}
        >
          <IconPlus className="size-4" stroke={2} />
        </button>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center border-l border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          onClick={() => {
            setError(null);
            setListOpen(true);
          }}
        >
          <IconListDetails className="size-4" stroke={2} />
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-600">
                  Provider Setup
                </p>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {editingId ? "Edit Provider" : "Add Provider"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose the chain type first, then enter the RPC endpoint used by explorer and workbench pages.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                onClick={() => setOpen(false)}
              >
                <IconX className="size-4" stroke={2} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Chain Type</span>
                <Select
                  value={draft.mode}
                  disabled={Boolean(editingId)}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...getInitialDraft(value as PlatformMode),
                      name: current.name,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select chain type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evm">EVM</SelectItem>
                    <SelectItem value="cosmos">Cosmos</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Provider Name</span>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder={draft.mode === "evm" ? "Local EVM" : "Local Cosmos"}
                />
              </label>
              {draft.mode === "evm" ? (
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Currency Name</span>
                  <Input
                    value={draft.nativeCurrencySymbol}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, nativeCurrencySymbol: event.target.value }))
                    }
                    placeholder="ETH"
                  />
                </label>
              ) : null}
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">RPC URL</span>
                <Input
                  value={draft.rpcUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, rpcUrl: event.target.value }))}
                  placeholder={draft.mode === "evm" ? "http://127.0.0.1:8545" : "http://127.0.0.1:26657"}
                />
              </label>
              {draft.mode === "cosmos" ? (
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">REST URL</span>
                  <Input
                    value={draft.restUrl}
                    onChange={(event) => setDraft((current) => ({ ...current, restUrl: event.target.value }))}
                    placeholder="http://127.0.0.1:1317"
                  />
                </label>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={handleSave}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Save Provider"}
              </Button>
            </div>

          </div>
        </div>
      ) : null}

      {listOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-10"
          onClick={() => setListOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-600">
                  Provider List
                </p>
                <h2 className="text-3xl font-semibold text-slate-900">All Providers</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Browse, activate, edit, or remove saved EVM and Cosmos providers from one place.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                onClick={() => setListOpen(false)}
              >
                <IconX className="size-4" stroke={2} />
              </button>
            </div>

            {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

            {sortedProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No saved providers yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedProfiles.map((profile) => {
                  const isActive = selected[profile.mode] === profile.id;

                  return (
                    <div
                      key={profile.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <div className="inline-flex size-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                            <IconPlugConnected className="size-4" stroke={2} />
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {getModeLabel(profile.mode)}
                          </span>
                          <p className="truncate text-sm font-semibold text-slate-900">{profile.name}</p>
                          {isActive ? (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-slate-500">RPC: {profile.rpcUrl}</p>
                        {profile.mode === "evm" && profile.nativeCurrencySymbol ? (
                          <p className="truncate text-xs text-slate-500">Currency: {profile.nativeCurrencySymbol}</p>
                        ) : null}
                        {profile.restUrl ? <p className="truncate text-xs text-slate-500">REST: {profile.restUrl}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActive}
                          onClick={() => {
                            handleUse(profile);
                            setListOpen(false);
                          }}
                        >
                          {isActive ? "Using" : "Use"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDraft(getDraftFromProfile(profile));
                            setEditingId(profile.id);
                            setError(null);
                            setListOpen(false);
                            setOpen(true);
                          }}
                        >
                          <IconEdit className="mr-1 size-4" stroke={2} />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingId === profile.id}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => handleDelete(profile)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
