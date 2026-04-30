'use client';

import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { getCosmosBlocksPageDirect } from '@/domains/cosmos/client/queries';
import { CosmosBlockTable } from '@/domains/cosmos/ui/block-table';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { useLiveInsertAnimationKey } from '@/platform/home/use-live-insert-animation-key';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

function CosmosBlocksPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { latestFeed } = useCosmosHomeData();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<Awaited<ReturnType<typeof getCosmosBlocksPageDirect>> | null>(null);
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
        const next = await getCosmosBlocksPageDirect(currentPage, PAGE_SIZE);

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
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos blocks.');
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
  }, [currentPage, pathname, router, searchParamsText]);

  useEffect(() => {
    if (!latestFeed) {
      return;
    }

    setData((current) => {
      if (!current) {
        return current;
      }

      const summary = current.summary.map((item) =>
        item.label === 'Latest Block'
          ? {
              ...item,
              value: latestFeed.latestBlock,
              note: 'Live head from the active Cosmos WebSocket subscription.',
            }
          : item,
      );
      const lastCommitHeight = latestFeed.lastCommitHeight;
      const lastCommitSignaturesLabel = latestFeed.lastCommitSignaturesLabel;
      const blocksWithLastCommit =
        lastCommitHeight && lastCommitSignaturesLabel
          ? current.blocks.map((block) =>
              block.height === lastCommitHeight && block.signaturesLabel !== lastCommitSignaturesLabel ? { ...block, signaturesLabel: lastCommitSignaturesLabel } : block,
            )
          : current.blocks;
      const totalBlocks = latestFeed.latestBlockNumber || current.totalBlocks;
      const totalPages = Math.max(1, Math.ceil(totalBlocks / current.pageSize));

      if (!autoRefreshEnabled || currentPage !== 1 || current.blocks[0]?.height === latestFeed.blockPageItem.height) {
        return {
          ...current,
          totalBlocks,
          totalPages,
          hasNextPage: totalPages > current.page,
          summary: summary.map((item) =>
            item.label === 'Current Range'
              ? {
                  ...item,
                  note: `Showing page ${current.page} of ${totalPages}.`,
                }
              : item,
          ),
          blocks: blocksWithLastCommit,
        };
      }

      const mergedBlocks = [latestFeed.blockPageItem, ...blocksWithLastCommit.filter((block) => block.height !== latestFeed.blockPageItem.height)].slice(0, PAGE_SIZE);
      const topBlock = mergedBlocks[0]?.height ?? latestFeed.latestBlock;
      const bottomBlock = mergedBlocks[mergedBlocks.length - 1]?.height ?? latestFeed.latestBlock;

      return {
        ...current,
        totalBlocks,
        totalPages,
        hasNextPage: totalPages > current.page,
        summary: summary.map((item) =>
          item.label === 'Current Range'
            ? {
                ...item,
                value: `#${topBlock} - #${bottomBlock}`,
                note: `Showing page ${current.page} of ${totalPages}.`,
              }
            : item,
        ),
        blocks: mergedBlocks,
      };
    });
  }, [autoRefreshEnabled, currentPage, latestFeed]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-20" metricCards={4} columns={6} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Recent blocks are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Blocks</h1>
        </div>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.summary.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-[34px] font-semibold leading-none text-slate-900">{item.value}</p>
              <p className="mt-2 text-sm text-slate-500">{item.note}</p>
            </article>
          ))}
        </section>
        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">Showing {data.blocks.length} blocks from the selected Cosmos provider.</p>
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
                tooltip={autoRefreshEnabled ? 'Disable auto refresh' : 'Enable auto refresh'}
                aria-pressed={autoRefreshEnabled}
                className={autoRefreshEnabled ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                {autoRefreshEnabled ? <IconPlayerPause className="size-4" stroke={1.8} /> : <IconPlayerPlay className="size-4" stroke={1.8} />}
              </ActionIconButton>
            </div>
          </div>
          <div className="p-0">
            <CosmosBlockTable
              blocks={data.blocks}
              hrefPrefix="/cosmos/block"
              liveInsertAnimationKey={liveInsertAnimationKey}
              pushAnimationEnabled={autoRefreshEnabled && currentPage === 1}
            />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export default function CosmosBlocksPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-20" metricCards={4} columns={6} />
        </AppShell>
      }
    >
      <CosmosBlocksPageContent />
    </Suspense>
  );
}
