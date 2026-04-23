'use client';

import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getEvmHomeBootstrapDirect,
  getEvmLatestFeedDirect,
  getEvmHomeMetricsSupplementDirect,
  getEvmHomeSnapshotDirect,
  validateActiveEvmCacheDirect,
} from '@/domains/evm/client/queries';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';
import { isEvmRouteActive } from '@/platform/workbench/home-route-state';

type EvmHomeSnapshot = Awaited<ReturnType<typeof getEvmHomeSnapshotDirect>>;
type EvmLatestFeed = Awaited<ReturnType<typeof getEvmLatestFeedDirect>>;
type EvmHomeBootstrap = Awaited<ReturnType<typeof getEvmHomeBootstrapDirect>>;
type EvmHomeMetricsSupplement = Awaited<ReturnType<typeof getEvmHomeMetricsSupplementDirect>>;
type EvmLiveStatus = Pick<EvmLatestFeed, 'latestBlock' | 'latestBlockNumber' | 'latestBlockTime' | 'latestBlockTimestamp' | 'pollIntervalMs'>;
type RecentHomeBlock = EvmHomeBootstrap['recentBlocks'][number];
type RecentHomeTransaction = EvmHomeBootstrap['transactions'][number];

type EvmHomeDataContextValue = {
  status: EvmLiveStatus | null;
  snapshot: EvmHomeSnapshot | null;
  latestFeed: EvmLatestFeed | null;
  errorMessage: string | null;
  pollIntervalMs: number;
  nowMs: number;
};

const EvmHomeDataContext = createContext<EvmHomeDataContextValue | null>(null);
const RECENT_HOME_BLOCK_WINDOW = 10;
const HOME_BLOCK_LIST_LIMIT = 6;
const HOME_TRANSACTION_LIST_LIMIT = 6;

function formatMetricInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMetricInterval(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return '--';
  }

  if (seconds < 1) {
    return `${seconds.toFixed(2).replace(/\.?0+$/, '')}s`;
  }

  if (seconds < 10) {
    return `${seconds.toFixed(1).replace(/\.0$/, '')}s`;
  }

  return `${Math.round(seconds)}s`;
}

function mergeRecentHomeBlocks(current: RecentHomeBlock[], feed: EvmLatestFeed) {
  const nextBlock: RecentHomeBlock = {
    blockNumber: feed.latestBlockNumber,
    timestampMs: feed.latestBlockTimestamp ? feed.latestBlockTimestamp * 1000 : null,
    txCount: feed.blockPageItem.txCount,
    block: feed.block,
    transactions: feed.transactions,
  };
  const merged = [nextBlock, ...current.filter((item) => item.blockNumber !== nextBlock.blockNumber)];

  return merged.slice(0, RECENT_HOME_BLOCK_WINDOW);
}

function mergeRecentHomeTransactions(current: RecentHomeTransaction[], feed: EvmLatestFeed) {
  if (!feed.transactions.length) {
    return current;
  }

  return [...feed.transactions, ...current]
    .filter((transaction, index, transactions) => transactions.findIndex((candidate) => candidate.hash === transaction.hash) === index)
    .slice(0, HOME_TRANSACTION_LIST_LIMIT);
}

function buildDerivedHomeSnapshot(input: {
  feed: EvmLiveStatus;
  supplement: EvmHomeMetricsSupplement;
  recentBlocks: RecentHomeBlock[];
  chainId: string | null;
  pollIntervalMs: number;
  activityTransactions?: EvmHomeBootstrap['transactions'];
}): EvmHomeSnapshot {
  const activityBlocks = input.recentBlocks.slice(0, HOME_BLOCK_LIST_LIMIT).map((item) => item.block);
  const activityTransactions =
    input.activityTransactions ??
    input.recentBlocks
      .flatMap((item) => item.transactions)
      .filter((transaction, index, transactions) => transactions.findIndex((candidate) => candidate.hash === transaction.hash) === index)
      .slice(0, HOME_TRANSACTION_LIST_LIMIT);
  const recentBlocksForMetrics = input.recentBlocks.slice(0, RECENT_HOME_BLOCK_WINDOW);
  const timestampSamples = recentBlocksForMetrics.map((item) => item.timestampMs).filter((value): value is number => value != null);
  const intervalSamples =
    timestampSamples.length >= 2
      ? timestampSamples
          .slice(0, -1)
          .map((timestamp, index) => (timestamp - timestampSamples[index + 1]) / 1000)
          .filter((value) => Number.isFinite(value) && value >= 0)
      : [];
  const averageBlockTimeSeconds = intervalSamples.length ? intervalSamples.reduce((sum, value) => sum + value, 0) / intervalSamples.length : null;
  const recentTxCount = recentBlocksForMetrics.length >= 2 ? recentBlocksForMetrics.reduce((sum, block) => sum + block.txCount, 0) : null;

  return {
    header: {
      connection: input.supplement.header.connection,
      providerName: input.supplement.header.providerName,
      nativeCurrency: input.supplement.header.nativeCurrency,
      chainId: input.chainId ?? 'Unavailable',
    },
    metrics: [
      {
        label: 'Latest Block',
        value: input.feed.latestBlock,
        subtext: 'Current head',
      },
      {
        label: 'Latest Block Time',
        value: input.feed.latestBlockTime,
        subtext: 'Local formatted time',
      },
      {
        label: 'Average Block Time',
        value: formatMetricInterval(averageBlockTimeSeconds),
        subtext:
          recentBlocksForMetrics.length >= 2
            ? `Sampled from recent ${Math.min(recentBlocksForMetrics.length, RECENT_HOME_BLOCK_WINDOW)} blocks`
            : 'Waiting for at least 2 recent blocks',
      },
      {
        label: 'Gas Price',
        value: input.supplement.gasPriceLabel,
        subtext: 'Quoted in gwei',
      },
      {
        label: 'Pending Tx Count',
        value: input.supplement.pendingTransactionCountLabel,
        subtext: input.supplement.pendingTransactionCountLabel === 'Unavailable' ? 'Provider does not expose pending pool' : 'Pending pool snapshot',
      },
      {
        label: 'Recent Tx Count',
        value: recentTxCount != null ? formatMetricInteger(recentTxCount) : '--',
        subtext: recentBlocksForMetrics.length >= 2 ? `Last ${recentBlocksForMetrics.length} blocks` : 'Waiting for at least 2 recent blocks',
      },
      {
        label: 'Cached Transactions',
        value: formatMetricInteger(input.supplement.cacheSummary.totalTransactions),
        subtext: 'Local IndexedDB',
      },
      {
        label: 'Observed Accounts',
        value: formatMetricInteger(input.supplement.cacheSummary.totalObservedAccounts),
        subtext: 'Derived from cached transactions',
      },
    ],
    activity: {
      blocks: activityBlocks,
      transactions: activityTransactions,
    },
    latestBlockNumber: input.feed.latestBlockNumber,
    latestBlockTimestamp: input.feed.latestBlockTimestamp,
    pollIntervalMs: input.pollIntervalMs,
  };
}

export function EvmHomeDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeMode = readActivePlatformModeCookie();
  const [snapshot, setSnapshot] = useState<EvmHomeSnapshot | null>(null);
  const [status, setStatus] = useState<EvmLiveStatus | null>(null);
  const [latestFeed, setLatestFeed] = useState<EvmLatestFeed | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(12_000);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef(12_000);
  const hasResolvedPollIntervalRef = useRef(false);
  const hasValidatedCacheRef = useRef(false);
  const recentHomeBlocksRef = useRef<RecentHomeBlock[]>([]);
  const recentHomeTransactionsRef = useRef<RecentHomeTransaction[]>([]);
  const homeChainIdRef = useRef<string | null>(null);

  function resolvePollInterval(nextPollIntervalMs: number) {
    if (!hasResolvedPollIntervalRef.current) {
      pollIntervalRef.current = nextPollIntervalMs;
      hasResolvedPollIntervalRef.current = true;
    }

    return pollIntervalRef.current;
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const isEvmRoute = isEvmRouteActive(pathname, activeMode);
    const isHomePage = pathname === '/';

    function clearPoll() {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function scheduleNextPoll(delayMs: number) {
      clearPoll();
      timeoutRef.current = window.setTimeout(() => {
        void load();
      }, delayMs);
    }

    async function refreshLatestFeed() {
      const next = await getEvmLatestFeedDirect(20, !hasResolvedPollIntervalRef.current);
      const resolvedPollIntervalMs = resolvePollInterval(next.pollIntervalMs);

      if (disposed) {
        return null;
      }

      const nextFeed = {
        ...next,
        pollIntervalMs: resolvedPollIntervalMs,
      };
      recentHomeBlocksRef.current = mergeRecentHomeBlocks(recentHomeBlocksRef.current, nextFeed);
      recentHomeTransactionsRef.current = mergeRecentHomeTransactions(recentHomeTransactionsRef.current, nextFeed);

      setLatestFeed(nextFeed);
      setStatus({
        ...nextFeed,
        pollIntervalMs: resolvedPollIntervalMs,
      });
      setPollIntervalMs(resolvedPollIntervalMs);
      if (!isHomePage) {
        setSnapshot(null);
      }
      setErrorMessage(null);

      return nextFeed;
    }

    async function refreshHome(feed: EvmLatestFeed) {
      const supplement = await getEvmHomeMetricsSupplementDirect(homeChainIdRef.current == null);

      if (disposed) {
        return;
      }

      if (supplement.header.chainId) {
        homeChainIdRef.current = supplement.header.chainId;
      }

      setSnapshot(
        buildDerivedHomeSnapshot({
          feed,
          supplement,
          recentBlocks: recentHomeBlocksRef.current,
          chainId: homeChainIdRef.current,
          pollIntervalMs: feed.pollIntervalMs,
          activityTransactions: recentHomeTransactionsRef.current,
        }),
      );
    }

    async function bootstrapHome() {
      const [bootstrap, supplement] = await Promise.all([
        getEvmHomeBootstrapDirect(HOME_BLOCK_LIST_LIMIT, HOME_TRANSACTION_LIST_LIMIT),
        getEvmHomeMetricsSupplementDirect(homeChainIdRef.current == null),
      ]);

      if (disposed) {
        return;
      }

      recentHomeBlocksRef.current = bootstrap.recentBlocks;
      recentHomeTransactionsRef.current = bootstrap.transactions;

      if (supplement.header.chainId) {
        homeChainIdRef.current = supplement.header.chainId;
      }

      setSnapshot(
        buildDerivedHomeSnapshot({
          feed: bootstrap.status,
          supplement,
          recentBlocks: bootstrap.recentBlocks,
          chainId: homeChainIdRef.current,
          pollIntervalMs: bootstrap.status.pollIntervalMs,
          activityTransactions: bootstrap.transactions,
        }),
      );
      setErrorMessage(null);
    }

    async function load() {
      try {
        if (!isEvmRoute) {
          setStatus(null);
          setSnapshot(null);
          setLatestFeed(null);
          setErrorMessage(null);
          setPollIntervalMs(12_000);
          recentHomeBlocksRef.current = [];
          recentHomeTransactionsRef.current = [];
          homeChainIdRef.current = null;
          clearPoll();
          return;
        }

        if (!hasValidatedCacheRef.current) {
          await validateActiveEvmCacheDirect();
          hasValidatedCacheRef.current = true;
        }

        const needsHomeBootstrap = isHomePage && recentHomeBlocksRef.current.length < HOME_BLOCK_LIST_LIMIT;

        if (needsHomeBootstrap) {
          await bootstrapHome();
        }

        const nextFeed = await refreshLatestFeed();

        if (!nextFeed) {
          return;
        }

        if (isHomePage) {
          if (needsHomeBootstrap) {
            scheduleNextPoll(pollIntervalRef.current);
            return;
          }

          await refreshHome(nextFeed);
          scheduleNextPoll(pollIntervalRef.current);
          return;
        }

        scheduleNextPoll(pollIntervalRef.current);
      } catch (error) {
        if (disposed) {
          return;
        }

        setStatus(null);
        if (!isHomePage || recentHomeBlocksRef.current.length === 0) {
          setSnapshot(null);
        }
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load homepage activity.');
        setPollIntervalMs(12_000);
        scheduleNextPoll(12_000);
      }
    }

    const handleProfileChanged = () => {
      clearPoll();
      hasValidatedCacheRef.current = false;
      pollIntervalRef.current = 12_000;
      hasResolvedPollIntervalRef.current = false;
      setPollIntervalMs(12_000);
      recentHomeBlocksRef.current = [];
      recentHomeTransactionsRef.current = [];
      homeChainIdRef.current = null;
      setSnapshot(null);
      setStatus(null);
      setLatestFeed(null);
      void load();
    };

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      disposed = true;
      clearPoll();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [activeMode, pathname]);

  const value = useMemo(
    () => ({
      status,
      snapshot,
      latestFeed,
      errorMessage,
      pollIntervalMs,
      nowMs,
    }),
    [errorMessage, latestFeed, nowMs, pollIntervalMs, snapshot, status],
  );

  return <EvmHomeDataContext.Provider value={value}>{children}</EvmHomeDataContext.Provider>;
}

export function useEvmHomeData() {
  const context = useContext(EvmHomeDataContext);

  if (!context) {
    throw new Error('useEvmHomeData must be used within EvmHomeDataProvider.');
  }

  return context;
}
