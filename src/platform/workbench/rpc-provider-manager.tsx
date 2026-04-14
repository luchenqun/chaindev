"use client";

import {
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PlatformMode } from "@/config/chains";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
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
import { getDefaultGuestRpcProfiles, getDefaultGuestSelectedRpcProfiles } from "@/platform/workbench/defaults";

type RpcProviderManagerProps = {
  mode: PlatformMode;
  variant?: "compact" | "topbar-context" | "page";
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

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function RpcProviderManager({ mode, variant = "compact" }: RpcProviderManagerProps) {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RpcProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<RpcProfile[]>([]);
  const [selected, setSelected] = useState<SelectedRpcProfileMap>({});
  const [source, setSource] = useState<"guest" | "server">("guest");
  const [draft, setDraft] = useState<DraftState>(getInitialDraft(mode));
  const hasPersistedProfiles = profiles.length > 0;
  const topbarProfiles = useMemo(
    () => (profiles.length ? profiles : getDefaultGuestRpcProfiles()),
    [profiles],
  );
  const topbarSelected = useMemo(
    () => (profiles.length ? selected : getDefaultGuestSelectedRpcProfiles()),
    [profiles.length, selected],
  );

  const activeProfile = useMemo(
    () => getPreferredProfile(mode, profiles, selected),
    [mode, profiles, selected],
  );
  const topbarActiveProfile = useMemo(
    () => getPreferredProfile(mode, topbarProfiles, topbarSelected),
    [mode, topbarProfiles, topbarSelected],
  );
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
  const topbarSortedProfiles = useMemo(
    () =>
      [...topbarProfiles].sort((left, right) => {
        if (left.mode !== right.mode) {
          return left.mode.localeCompare(right.mode);
        }

        return right.updatedAt - left.updatedAt;
      }),
    [topbarProfiles],
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
        setSource(data.source === "server" ? "server" : "guest");
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

    void load();

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

    if (
      cookieProfile?.id !== preferred.id ||
      cookieProfile.rpcUrl !== preferred.rpcUrl ||
      cookieProfile.restUrl !== preferred.restUrl
    ) {
      writeActiveRpcProfileCookie(preferred);
      router.refresh();
    }
  }, [loading, mode, profiles, router, selected]);

  const saveDisabled =
    saving ||
    !draft.name.trim() ||
    !draft.rpcUrl.trim() ||
    (draft.mode === "evm" ? !draft.nativeCurrencySymbol.trim() : !draft.restUrl.trim());
  const isAuthenticated = status === "authenticated";

  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    router.push(`/login?callbackUrl=${callbackUrl}`);
  }

  function handleOpenCreate() {
    if (status !== "authenticated") {
      goToLogin();
      return;
    }

    setDraft(getInitialDraft(mode));
    setEditingId(null);
    setError(null);
    setOpen(true);
  }

  function handleOpenEdit(profile: RpcProfile) {
    if (status !== "authenticated") {
      goToLogin();
      return;
    }

    setDraft(getDraftFromProfile(profile));
    setEditingId(profile.id);
    setError(null);
    setOpen(true);
  }

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
      if (saveError instanceof Error && saveError.name === "AuthRequiredError") {
        goToLogin();
        return;
      }

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
      setDeleteTarget(null);

      if (selected[profile.mode] === profile.id) {
        if (fallback) {
          writeActiveRpcProfileCookie(fallback);
          setLocalSelectedRpcProfile(profile.mode, fallback.id);
        } else {
          clearActiveRpcProfileCookie(profile.mode);
          setLocalSelectedRpcProfile(profile.mode, null);
        }

        if (profile.mode === mode) {
          router.refresh();
        }
      }
    } catch (deleteError) {
      if (deleteError instanceof Error && deleteError.name === "AuthRequiredError") {
        goToLogin();
        return;
      }

      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete RPC provider.");
    } finally {
      setDeletingId(null);
    }
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
      router.push(`/${profile.mode}/blocks`);
      return;
    }

    router.refresh();
  }

  function renderProfilesTable() {
    return (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                Mode
              </th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                Name
              </th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                RPC URL
              </th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                Details
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
            {sortedProfiles.length ? (
              sortedProfiles.map((profile) => {
                const isActive = selected[profile.mode] === profile.id;

                return (
                  <tr key={profile.id} className="border-t border-slate-200">
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <Badge variant="secondary">{getModeLabel(profile.mode)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{profile.name}</span>
                        {isActive ? <Badge variant="secondary">Selected</Badge> : null}
                      </div>
                    </td>
                    <td className="max-w-[28rem] px-5 py-3 text-sm text-slate-700">
                      <span className="block truncate font-mono text-[13px]">{profile.rpcUrl}</span>
                    </td>
                    <td className="max-w-[20rem] px-5 py-3 text-sm text-slate-500">
                      {profile.mode === "evm" ? (
                        <span className="block truncate">Currency: {profile.nativeCurrencySymbol ?? "ETH"}</span>
                      ) : (
                        <span className="block truncate">REST: {profile.restUrl ?? "-"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(profile.updatedAt)}</td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-end gap-0">
                        {source === "server" ? (
                          <>
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip="Edit provider"
                              aria-label="Edit provider"
                              onClick={() => handleOpenEdit(profile)}
                            >
                              <IconPencil className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              className="text-slate-400 hover:text-rose-600"
                              tooltip="Delete provider"
                              aria-label="Delete provider"
                              disabled={deletingId === profile.id}
                              onClick={() => setDeleteTarget(profile)}
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
                <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                  No providers saved yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Saved Providers</p>
                <p className="mt-1 text-sm text-slate-500">
                  Browse, activate, edit, or remove saved EVM and Cosmos providers from one place.
                </p>
              </div>
              <Button type="button" size="sm" onClick={handleOpenCreate}>
                {isAuthenticated ? "Add" : "Sign In to Add"}
              </Button>
            </div>
          </div>
          {error ? <p className="border-b border-slate-200 px-5 py-4 text-sm text-rose-600">{error}</p> : null}
          {loading ? (
            <div className="px-5 py-10 text-sm text-slate-500">Loading providers...</div>
          ) : (
            renderProfilesTable()
          )}
        </section>

        <ModalDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);

            if (!nextOpen) {
              setError(null);
            }
          }}
          title={editingId ? "Edit Provider" : "Add Provider"}
          description="Choose the chain type first, then enter the RPC endpoint used by explorer and workbench pages."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saveDisabled} onClick={() => void handleSave()}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Save Provider"}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-4 pb-1 md:grid-cols-2">
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
                <SelectTrigger className="w-full">
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
        </ModalDialog>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeleteTarget(null);
            }
          }}
          title="Delete Provider"
          description={
            deleteTarget
              ? `Remove provider "${deleteTarget.name}" and its saved endpoint configuration?`
              : undefined
          }
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteTarget) {
              void handleDelete(deleteTarget);
            }
          }}
        />
      </>
    );
  }

  if (variant === "topbar-context") {
    return (
      <div className="min-w-0 shrink-0">
        <Select
          value={topbarActiveProfile?.id}
          disabled={loading || !hasPersistedProfiles}
          onValueChange={(value) => {
            const profile = topbarSortedProfiles.find((item) => item.id === value) ?? null;
            handleUse(profile);
          }}
        >
          <SelectTrigger className="h-full w-auto justify-start gap-1 rounded-none border-0 bg-transparent px-2.5 pr-1 text-[12.5px] leading-none shadow-none focus:ring-0">
            <span className="truncate">
              {topbarActiveProfile
                ? `${getModeLabel(topbarActiveProfile.mode)} · ${topbarActiveProfile.name}`
                : loading
                  ? "Loading providers..."
                  : "No provider"}
            </span>
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {topbarSortedProfiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {getModeLabel(profile.mode)} · {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="min-w-0 shrink-0">
      <Select
        value={activeProfile?.id}
        disabled={loading || sortedProfiles.length <= 1}
        onValueChange={(value) => {
          const profile = sortedProfiles.find((item) => item.id === value) ?? null;
          handleUse(profile);
        }}
      >
        <SelectTrigger className="h-9 w-auto justify-start gap-1.5 rounded-xl border-slate-200 bg-white px-4 pr-2.5 text-[13px] shadow-sm">
          <span className="truncate">
            {activeProfile ? `${getModeLabel(activeProfile.mode)} · ${activeProfile.name}` : loading ? "Loading providers..." : "No provider"}
          </span>
        </SelectTrigger>
        <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
          {sortedProfiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {getModeLabel(profile.mode)} · {profile.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
