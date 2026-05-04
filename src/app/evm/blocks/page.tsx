'use client';

import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { getEvmBlocksPageDirect } from '@/domains/evm/client/queries';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { EvmBlockTable } from '@/domains/evm/ui/block-table';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { useLiveInsertAnimationKey } from '@/platform/home/use-live-insert-animation-key';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildPageHref(pathname: string, searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams.toString());

  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function EvmBlocksPageContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { latestFeed } = useEvmHomeData();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvmBlocksPageDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const liveTopBlockKey = autoRefreshEnabled && currentPage === 1 && data?.blocks[0] ? `${data.blocks[0].height}-${data.blocks[0].hash}` : null;
  const liveInsertAnimationKey = useLiveInsertAnimationKey(liveTopBlockKey);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getEvmBlocksPageDirect(currentPage, PAGE_SIZE);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : messages.common.failedToLoadBlockTitle);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const handleProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [currentPage, messages.common.failedToLoadBlockTitle, pathname, router, searchParamsText]);

  useEffect(() => {
    if (!autoRefreshEnabled || currentPage !== 1 || !latestFeed) {
      return;
    }

    setData((current) => {
      if (!current) {
        return current;
      }

      if (current.blocks[0]?.height === latestFeed.blockPageItem.height) {
        return {
          ...current,
          summary: current.summary.map((item) => (item.label === 'Latest Block' ? { ...item, value: latestFeed.latestBlock } : item)),
        };
      }

      const mergedBlocks = [latestFeed.blockPageItem, ...current.blocks.filter((block) => block.height !== latestFeed.blockPageItem.height)].slice(0, PAGE_SIZE);
      const totalBlocks = latestFeed.latestBlockNumber + 1;
      const totalPages = Math.max(1, Math.ceil(totalBlocks / current.pageSize));

      return {
        ...current,
        totalBlocks,
        totalPages,
        hasNextPage: totalPages > current.page,
        summary: current.summary.map((item) => (item.label === 'Latest Block' ? { ...item, value: latestFeed.latestBlock } : item)),
        blocks: mergedBlocks,
      };
    });
  }, [autoRefreshEnabled, currentPage, latestFeed]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-20" metricCards={4} columns={7} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{messages.common.failedToLoadBlockTitle}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.blocks}</h1>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.summary.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{translateRuntimeText(item.label, locale)}</p>
              <p className="mt-2 text-[34px] font-semibold leading-none text-slate-900">{translateRuntimeText(item.value, locale)}</p>
              <p className="mt-2 text-sm text-slate-500">{translateRuntimeText(item.note, locale)}</p>
            </article>
          ))}
        </section>
        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{translateRuntimeText(data.totalLabel, locale)}</p>
              <p className="mt-1 text-sm text-slate-500">
                {messages.evmBlocksPage.pageSummary
                  .replace('{page}', String(data.page))
                  .replace('{totalPages}', String(data.totalPages))
                  .replace('{count}', String(data.blocks.length))}
              </p>
            </div>
            <div className="flex items-center gap-0.5 lg:justify-end">
              <PaginationControls
                page={data.page}
                totalPages={data.totalPages}
                hasPreviousPage={data.hasPreviousPage}
                hasNextPage={data.hasNextPage}
                disabled={loading}
                plain
                onPageChange={handlePageChange}
              />
              <ActionIconButton
                tooltip={autoRefreshEnabled ? messages.homeMetrics.disableAutoRefresh : messages.homeMetrics.enableAutoRefresh}
                aria-pressed={autoRefreshEnabled}
                className={autoRefreshEnabled ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                {autoRefreshEnabled ? <IconPlayerPause className="size-4" stroke={1.8} /> : <IconPlayerPlay className="size-4" stroke={1.8} />}
              </ActionIconButton>
            </div>
          </div>
          <div className="p-0">
            <EvmBlockTable
              blocks={data.blocks}
              hrefPrefix="/evm/block"
              liveInsertAnimationKey={liveInsertAnimationKey}
              pushAnimationEnabled={autoRefreshEnabled && currentPage === 1}
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export default function EvmBlocksPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-20" metricCards={4} columns={7} />
        </AppShell>
      }
    >
      <EvmBlocksPageContent />
    </Suspense>
  );
}
