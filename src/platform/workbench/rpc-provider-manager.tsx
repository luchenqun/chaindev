'use client';

import { IconCurrencyEthereum, IconPencil, IconPlus, IconTrash, IconWorld } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { PlatformMode } from '@/config/chains';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatLocalizedDateTime } from '@/i18n/format';
import { useToast } from '@/components/ui/toast';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import {
  clearActiveRpcProfileCookie,
  createRpcProfile,
  editRpcProfile,
  fetchRpcProfiles,
  readActiveRpcProfileCookie,
  writeActivePlatformModeCookie,
  removeRpcProfile,
  setLocalSelectedRpcProfile,
  writeActiveRpcProfileCookie,
} from '@/platform/workbench/rpc-profile-client';
import type { RpcProfile, RpcProfileDraft, SelectedRpcProfileMap } from '@/platform/workbench/rpc-profile';
import { getDefaultGuestRpcProfiles, getDefaultGuestSelectedRpcProfiles } from '@/platform/workbench/defaults';

const ADD_PROVIDER_ACTION_VALUE = '__chaindev_add_provider__';

type RpcProviderManagerProps = {
  mode: PlatformMode;
  variant?: 'compact' | 'topbar-context' | 'page';
  onReadyChange?: (ready: boolean) => void;
};

type RpcProviderManagerSnapshot = {
  profiles: RpcProfile[];
  selected: SelectedRpcProfileMap;
  source: 'guest' | 'server';
};

let cachedRpcProviderManagerSnapshot: RpcProviderManagerSnapshot | null = null;

type DraftState = {
  mode: PlatformMode;
  name: string;
  nativeCurrencySymbol: string;
  rpcUrl: string;
  restUrl: string;
  wsUrl: string;
};

function getInitialDraft(mode: PlatformMode): DraftState {
  return {
    mode,
    name: '',
    nativeCurrencySymbol: mode === 'evm' ? 'ETH' : '',
    rpcUrl: '',
    restUrl: '',
    wsUrl: '',
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

function renderModeIcon(mode: PlatformMode, className = 'size-3.5') {
  if (mode === 'evm') {
    return <IconCurrencyEthereum className={`${className} text-violet-500`} stroke={1.9} />;
  }

  return <IconWorld className={`${className} text-sky-600`} stroke={1.9} />;
}

function getDraftFromProfile(profile: RpcProfile): DraftState {
  return {
    mode: profile.mode,
    name: profile.name,
    nativeCurrencySymbol: profile.nativeCurrencySymbol ?? 'ETH',
    rpcUrl: profile.rpcUrl,
    restUrl: profile.restUrl ?? '',
    wsUrl: profile.wsUrl ?? '',
  };
}

function formatTimestamp(timestamp: number, locale: string) {
  return formatLocalizedDateTime(timestamp, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }, locale);
}

function renderProviderOption(profile: RpcProfile) {
  return (
    <div className="min-w-0 py-0.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0">{renderModeIcon(profile.mode)}</span>
        <div className="truncate font-medium text-slate-900">
          {getModeLabel(profile.mode)} · {profile.name}
        </div>
      </div>
      <div className="mt-1 grid gap-0.5">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">RPC</span>
          <span className="truncate font-mono text-[11px] text-slate-500">{profile.rpcUrl}</span>
        </div>
        {profile.mode === 'cosmos' ? (
          <>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">REST</span>
              <span className="truncate font-mono text-[11px] text-slate-400">{profile.restUrl ?? '-'}</span>
            </div>
            <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">WS</span>
              <span className="truncate font-mono text-[11px] text-slate-400">{profile.wsUrl ?? '-'}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function RpcProviderManager({ mode, variant = 'compact', onReadyChange }: RpcProviderManagerProps) {
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const { locale } = useLocale();
  const messages = useMessages();
  const providerMessages = messages.provider;
  const labelMessages = messages.labels;
  const isAuthenticated = status === 'authenticated';
  const [loading, setLoading] = useState(() => cachedRpcProviderManagerSnapshot == null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RpcProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<RpcProfile[]>(() => cachedRpcProviderManagerSnapshot?.profiles ?? []);
  const [selected, setSelected] = useState<SelectedRpcProfileMap>(() => cachedRpcProviderManagerSnapshot?.selected ?? {});
  const [source, setSource] = useState<'guest' | 'server'>(() => cachedRpcProviderManagerSnapshot?.source ?? 'guest');
  const [draft, setDraft] = useState<DraftState>(getInitialDraft(mode));
  const hasPersistedProfiles = profiles.length > 0;
  const topbarProfiles = useMemo(() => (isAuthenticated ? profiles : profiles.length ? profiles : getDefaultGuestRpcProfiles()), [isAuthenticated, profiles]);
  const topbarSelected = useMemo(
    () => (isAuthenticated ? selected : profiles.length ? selected : getDefaultGuestSelectedRpcProfiles()),
    [isAuthenticated, profiles.length, selected],
  );

  const activeProfile = useMemo(() => getPreferredProfile(mode, profiles, selected), [mode, profiles, selected]);
  const topbarActiveProfile = useMemo(() => getPreferredProfile(mode, topbarProfiles, topbarSelected), [mode, topbarProfiles, topbarSelected]);
  const showLoadingProviders = (status === 'loading' || loading) && cachedRpcProviderManagerSnapshot == null;
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
    if (status === 'loading') {
      return;
    }

    let cancelled = false;

    async function load() {
      if (!cachedRpcProviderManagerSnapshot && profiles.length === 0) {
        setLoading(true);
      }

      try {
        const data = await fetchRpcProfiles({ authenticated: status === 'authenticated' });

        if (cancelled) {
          return;
        }

        cachedRpcProviderManagerSnapshot = {
          profiles: data.profiles,
          selected: data.selected,
          source: data.source === 'server' ? 'server' : 'guest',
        };
        setProfiles(data.profiles);
        setSelected(data.selected);
        setSource(data.source === 'server' ? 'server' : 'guest');
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : providerMessages.loading);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const handleProfilesChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:rpc-profiles-changed', handleProfilesChanged);
    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfilesChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:rpc-profiles-changed', handleProfilesChanged);
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfilesChanged);
    };
  }, [status]);

  useEffect(() => {
    onReadyChange?.(!showLoadingProviders);
  }, [onReadyChange, showLoadingProviders]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const preferred = getPreferredProfile(mode, profiles, selected);
    const cookieProfile = readActiveRpcProfileCookie(mode);

    if (!preferred) {
      if (cookieProfile) {
        clearActiveRpcProfileCookie(mode);
      }

      return;
    }

    if (cookieProfile?.id !== preferred.id || cookieProfile.rpcUrl !== preferred.rpcUrl || cookieProfile.restUrl !== preferred.restUrl || cookieProfile.wsUrl !== preferred.wsUrl) {
      writeActiveRpcProfileCookie(preferred);
    }
  }, [loading, mode, profiles, selected]);

  const saveDisabled = saving || !draft.name.trim() || !draft.rpcUrl.trim() || (draft.mode === 'evm' ? !draft.nativeCurrencySymbol.trim() : !draft.restUrl.trim());
  function goToLogin() {
    const callbackUrl = encodeURIComponent(window.location.pathname);
    router.push(`/login?callbackUrl=${callbackUrl}`);
  }

  function handleOpenProviderSettings() {
    if (status !== 'authenticated') {
      showToast({
        title: providerMessages.loginRequired,
        description: providerMessages.signInBeforeAddingProvider,
        tone: 'info',
      });
      return;
    }

    router.push('/settings/providers');
  }

  function handleOpenCreate() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setDraft(getInitialDraft(mode));
    setEditingId(null);
    setError(null);
    setOpen(true);
  }

  function handleOpenEdit(profile: RpcProfile) {
    if (status !== 'authenticated') {
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
        draft.mode === 'evm'
          ? {
              mode: 'evm',
              name: draft.name.trim(),
              nativeCurrencySymbol: draft.nativeCurrencySymbol.trim(),
              rpcUrl: draft.rpcUrl.trim(),
            }
          : {
              mode: 'cosmos',
              name: draft.name.trim(),
              rpcUrl: draft.rpcUrl.trim(),
              restUrl: draft.restUrl.trim(),
              wsUrl: draft.wsUrl.trim(),
            };

      const { profile } = editingId ? await editRpcProfile(editingId, payload) : await createRpcProfile(payload);
      const nextProfiles = [profile, ...profiles.filter((item) => item.id !== profile.id)];
      const nextSelected = {
        ...selected,
        [profile.mode]: profile.id,
      };

      setProfiles(nextProfiles);
      setSelected(nextSelected);
      writeActivePlatformModeCookie(profile.mode);
      writeActiveRpcProfileCookie(profile);
      setLocalSelectedRpcProfile(profile.mode, profile.id);
      setDraft(getInitialDraft(mode));
      setEditingId(null);
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      if (saveError instanceof Error && saveError.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setError(saveError instanceof Error ? saveError.message : providerMessages.failedToSave);
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
          writeActivePlatformModeCookie(fallback.mode);
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
      if (deleteError instanceof Error && deleteError.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setError(deleteError instanceof Error ? deleteError.message : providerMessages.failedToDelete);
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
    writeActivePlatformModeCookie(profile.mode);
    writeActiveRpcProfileCookie(profile);

    if (window.location.pathname === '/') {
      router.refresh();
      return;
    }

    router.push('/');
  }

  function renderProfilesTable() {
    return (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.mode}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.name}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.rpcUrl}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.details}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.updated}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{labelMessages.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedProfiles.length ? (
              sortedProfiles.map((profile) => {
                return (
                  <tr key={profile.id} className="border-t border-slate-200">
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <Badge variant="secondary">{getModeLabel(profile.mode)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span className="font-medium text-slate-900">{profile.name}</span>
                    </td>
                    <td className="max-w-[28rem] px-5 py-3 text-sm text-slate-700">
                      <span className="block truncate font-mono text-[13px]">{profile.rpcUrl}</span>
                    </td>
                    <td className="max-w-[20rem] px-5 py-3 text-sm text-slate-500">
                      {profile.mode === 'evm' ? (
                        <span className="block truncate">{`${labelMessages.currencyName}: ${profile.nativeCurrencySymbol ?? 'ETH'}`}</span>
                      ) : (
                        <div className="grid gap-1">
                          <span className="block truncate">{`${labelMessages.restUrl}: ${profile.restUrl ?? '-'}`}</span>
                          <span className="block truncate">{`${labelMessages.websocketUrl}: ${profile.wsUrl ?? '-'}`}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(profile.updatedAt, locale)}</td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex items-center justify-end gap-0">
                        {source === 'server' ? (
                          <>
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip={providerMessages.editProviderAction}
                              aria-label={providerMessages.editProviderAction}
                              onClick={() => handleOpenEdit(profile)}
                            >
                              <IconPencil className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              className="text-slate-400 hover:text-rose-600"
                              tooltip={providerMessages.deleteProviderAction}
                              aria-label={providerMessages.deleteProviderAction}
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
                  {providerMessages.noProvidersSaved}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{providerMessages.browseDescription}</p>
              </div>
              <Button type="button" size="sm" onClick={handleOpenCreate}>
                {isAuthenticated ? providerMessages.add : providerMessages.signInToAdd}
              </Button>
            </div>
          </div>
          {error ? <p className="border-b border-slate-200 px-5 py-4 text-sm text-rose-600">{translateRuntimeText(error, locale)}</p> : null}
          {loading ? <div className="px-5 py-10 text-sm text-slate-500">{providerMessages.loading}</div> : renderProfilesTable()}
        </section>

        <ModalDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);

            if (!nextOpen) {
              setError(null);
            }
          }}
          title={editingId ? providerMessages.editProvider : providerMessages.addProvider}
          description={providerMessages.description}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button type="button" disabled={saveDisabled} onClick={() => void handleSave()}>
                {saving ? providerMessages.saving : editingId ? providerMessages.saveChanges : providerMessages.saveProvider}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-4 pb-1 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{labelMessages.chainType}</span>
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
                  <SelectValue placeholder={providerMessages.selectChainType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evm">{messages.navigation.blockchain}</SelectItem>
                  <SelectItem value="cosmos">{messages.labels.chain}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{labelMessages.providerName}</span>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={draft.mode === 'evm' ? providerMessages.localEvm : providerMessages.localCosmos}
              />
            </label>
            {draft.mode === 'evm' ? (
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">{labelMessages.currencyName}</span>
                <Input
                  value={draft.nativeCurrencySymbol}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nativeCurrencySymbol: event.target.value,
                    }))
                  }
                  placeholder={providerMessages.nativeCurrencyPlaceholder}
                />
              </label>
            ) : null}
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{labelMessages.rpcUrl}</span>
              <Input
                value={draft.rpcUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    rpcUrl: event.target.value,
                  }))
                }
                placeholder={draft.mode === 'evm' ? providerMessages.evmRpcPlaceholder : providerMessages.cosmosRpcPlaceholder}
              />
            </label>
            {draft.mode === 'cosmos' ? (
              <>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">{labelMessages.restUrl}</span>
                  <Input
                    value={draft.restUrl}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        restUrl: event.target.value,
                      }))
                    }
                    placeholder={providerMessages.cosmosRestPlaceholder}
                  />
                </label>
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">{labelMessages.websocketUrl}</span>
                  <Input
                    value={draft.wsUrl}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        wsUrl: event.target.value,
                      }))
                    }
                    placeholder={providerMessages.cosmosWsPlaceholder}
                  />
                </label>
              </>
            ) : null}
          </div>
          {error ? <p className="mt-4 text-sm text-rose-600">{translateRuntimeText(error, locale)}</p> : null}
        </ModalDialog>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setDeleteTarget(null);
            }
          }}
          title={providerMessages.deleteProvider}
          description={deleteTarget ? providerMessages.deleteProviderDescription.replace('{name}', deleteTarget.name) : undefined}
          confirmLabel={providerMessages.deleteProvider}
          onConfirm={() => {
            if (deleteTarget) {
              void handleDelete(deleteTarget);
            }
          }}
        />
      </>
    );
  }

  if (variant === 'topbar-context') {
    return (
      <div className="min-w-0 shrink-0">
        <Select
          value={topbarActiveProfile?.id}
          disabled={showLoadingProviders}
          onValueChange={(value) => {
            if (value === ADD_PROVIDER_ACTION_VALUE) {
              handleOpenProviderSettings();
              return;
            }

            const profile = topbarSortedProfiles.find((item) => item.id === value) ?? null;
            handleUse(profile);
          }}
        >
          <SelectTrigger className="h-auto min-h-0 w-auto justify-start gap-0.5 rounded-none border-0 bg-transparent px-0 py-0 pr-0.5 text-[13px] leading-none shadow-none focus:ring-0">
            {topbarActiveProfile ? (
              <span className="flex min-w-0 items-center gap-1">
                <span className="shrink-0">{renderModeIcon(topbarActiveProfile.mode)}</span>
                <span className="truncate">{topbarActiveProfile.name}</span>
              </span>
            ) : (
              <span className="truncate">{showLoadingProviders ? providerMessages.loading : providerMessages.noProvider}</span>
            )}
          </SelectTrigger>
          <SelectContent className="min-w-[26rem] max-w-[min(40rem,calc(100vw-2rem))]">
            {topbarSortedProfiles.map((profile, index) => (
              <SelectItem
                key={profile.id}
                value={profile.id}
                className={`items-start rounded-none py-2.5 ${index < topbarSortedProfiles.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                {renderProviderOption(profile)}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={ADD_PROVIDER_ACTION_VALUE} className="items-center rounded-none py-2.5">
              <span className="flex items-center gap-2">
                <IconPlus className="size-4" stroke={2} />
                <span>{providerMessages.addProviderAction}</span>
              </span>
            </SelectItem>
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
          {activeProfile ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">{renderModeIcon(activeProfile.mode)}</span>
              <span className="truncate">{`${getModeLabel(activeProfile.mode)} · ${activeProfile.name}`}</span>
            </span>
          ) : (
            <span className="truncate">{loading ? providerMessages.loading : providerMessages.noProvider}</span>
          )}
        </SelectTrigger>
        <SelectContent className="min-w-[26rem] max-w-[min(40rem,calc(100vw-2rem))]">
          {sortedProfiles.map((profile, index) => (
            <SelectItem
              key={profile.id}
              value={profile.id}
              className={`items-start rounded-none py-2.5 ${index < sortedProfiles.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              {renderProviderOption(profile)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
