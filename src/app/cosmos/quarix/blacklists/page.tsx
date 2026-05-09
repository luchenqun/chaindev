'use client';

import { IconCode, IconRefresh } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';
import { CosmosAddressLink } from '@/domains/cosmos/ui/address-link';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type QuarixBlacklistsResponse = {
  blacklists?: string[];
  addresses?: string[];
  blacklist?: string[];
  pagination?: {
    next_key?: string | null;
    total?: string;
  };
};

type QuarixBlacklistsState = {
  blacklists: string[];
  pages: QuarixBlacklistsResponse[];
  pagination: QuarixBlacklistsResponse['pagination'] | null;
  response: QuarixBlacklistsResponse;
};

const BLACKLISTS_PATH = '/quarix/blacklist/v1/blacklists';
const BLACKLISTS_PAGE_LIMIT = '200';

function buildBlacklistsUrl(restUrl: string, nextKey: string | null) {
  const url = new URL(`${restUrl}${BLACKLISTS_PATH}`);

  url.searchParams.set('pagination.limit', BLACKLISTS_PAGE_LIMIT);
  url.searchParams.set('pagination.count_total', 'true');

  if (nextKey) {
    url.searchParams.set('pagination.key', nextKey);
  }

  return url.toString();
}

function extractBlacklists(payload: QuarixBlacklistsResponse) {
  if (Array.isArray(payload.blacklists)) {
    return payload.blacklists;
  }

  if (Array.isArray(payload.addresses)) {
    return payload.addresses;
  }

  if (Array.isArray(payload.blacklist)) {
    return payload.blacklist;
  }

  return [];
}

async function requestAllQuarixBlacklists(): Promise<QuarixBlacklistsState> {
  const profile = getActiveCosmosProvider();
  const pages: QuarixBlacklistsResponse[] = [];
  const blacklists: string[] = [];
  let nextKey: string | null = null;

  do {
    const response = await fetch(buildBlacklistsUrl(profile.restUrl, nextKey), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const page = (await response.json()) as QuarixBlacklistsResponse;

    pages.push(page);
    blacklists.push(...extractBlacklists(page));
    nextKey = page.pagination?.next_key || null;
  } while (nextKey);

  const pagination = pages[pages.length - 1]?.pagination ?? null;

  return {
    blacklists,
    pages,
    pagination,
    response: {
      blacklists,
      ...(pagination ? { pagination } : {}),
    },
  };
}

export default function QuarixBlacklistsPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixBlacklists;
  const [data, setData] = useState<QuarixBlacklistsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const hasLoadedDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isInitialLoad = !hasLoadedDataRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await requestAllQuarixBlacklists();

        if (!cancelled) {
          setData(next);
          hasLoadedDataRef.current = true;
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : pageMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    const handleActiveRpcProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [pageMessages.failedToLoadFallback, refreshVersion]);

  const blacklists = useMemo(() => data?.blacklists ?? [], [data]);

  if (loading && data == null) {
    return (
      <AppShell mode="cosmos">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={2} toolbarIcons={1} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell mode="cosmos">
        <main className="content-panel">
          <h1>{pageMessages.title}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="cosmos">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{pageMessages.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{pageMessages.description}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {blacklists.length
                  ? pageMessages.totalBlacklistsLabel.replace('{count}', blacklists.length.toLocaleString(locale))
                  : pageMessages.emptyBlacklistsLabel}
              </p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <ActionIconButton
                tooltip={showRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showRawJson
                    ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                    : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                }
                onClick={() => setShowRawJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={messages.common.refresh}
                className={refreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px] table-fixed">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[700px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.index}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.address}</th>
                </tr>
              </thead>
              <tbody>
                {blacklists.length ? (
                  blacklists.map((address, index) => (
                    <tr key={`${address}-${index}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-500">{(index + 1).toLocaleString(locale)}</td>
                      <td className="px-5 py-3 text-sm">
                        <CosmosAddressLink href={`/cosmos/account/${address}`} label={address} copyValue={address} prefetch={false} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.emptyBlacklistsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showRawJson ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={data.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
