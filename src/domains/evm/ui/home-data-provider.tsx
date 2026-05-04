'use client';

import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getEvmHomeBootstrapDirect,
  getEvmHomeCachedTransactionsDirect,
  getActiveEvmCurrencyNameClient,
  getEvmLatestFeedDirect,
  getEvmHomeMetricsSupplementDirect,
  getEvmHomeSnapshotDirect,
  validateActiveEvmCacheDirect,
} from '@/domains/evm/client/queries';
import { HOME_ACTIVITY_LIST_LIMIT } from '@/config/pagination';
import { subscribeEvmTransactionCache } from '@/domains/evm/client/transaction-cache';
import { formatLocalizedNumber } from '@/i18n/format';
import { useMessages } from '@/i18n/locale-provider';
import { useActivePlatformMode } from '@/platform/workbench/active-platform-mode-provider';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
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
  homeLoadStarted: boolean;
};

const EvmHomeDataContext = createContext<EvmHomeDataContextValue | null>(null);
const RECENT_HOME_BLOCK_WINDOW = 10;
const HOME_BLOCK_LIST_LIMIT = HOME_ACTIVITY_LIST_LIMIT;
const HOME_TRANSACTION_LIST_LIMIT = HOME_ACTIVITY_LIST_LIMIT;

function formatMetricInteger(value: number) {
  return formatLocalizedNumber(value);
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
  messages: ReturnType<typeof useMessages>['homeMetrics'];
  unavailable: string;
}): EvmHomeSnapshot {
  const metricsMessages = input.messages;
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
      chainId: input.chainId ?? input.unavailable,
    },
    metrics: [
      {
        label: metricsMessages.latestBlock,
        value: input.feed.latestBlock,
        subtext: metricsMessages.currentHead,
      },
      {
        label: metricsMessages.latestBlockTime,
        value: input.feed.latestBlockTime,
        subtext: metricsMessages.localFormattedTime,
      },
      {
        label: metricsMessages.averageBlockTime,
        value: formatMetricInterval(averageBlockTimeSeconds),
        subtext:
          recentBlocksForMetrics.length >= 2
            ? metricsMessages.sampledRecentBlocks.replace('{count}', String(Math.min(recentBlocksForMetrics.length, RECENT_HOME_BLOCK_WINDOW)))
            : metricsMessages.waitingForRecentBlocks,
      },
      {
        label: metricsMessages.gasPrice,
        value: input.supplement.gasPriceLabel,
        subtext: metricsMessages.quotedInGwei,
      },
      {
        label: metricsMessages.pendingTxCount,
        value: input.supplement.pendingTransactionCountLabel,
        subtext:
          input.supplement.pendingTransactionCountLabel === input.unavailable ? metricsMessages.pendingPoolUnavailable : metricsMessages.pendingPoolSnapshot,
      },
      {
        label: metricsMessages.recentTxCount,
        value: recentTxCount != null ? formatMetricInteger(recentTxCount) : '--',
        subtext:
          recentBlocksForMetrics.length >= 2
            ? metricsMessages.lastBlocks.replace('{count}', String(recentBlocksForMetrics.length))
            : metricsMessages.waitingForRecentBlocks,
      },
      {
        label: metricsMessages.cachedTransactions,
        value: formatMetricInteger(input.supplement.cacheSummary.totalTransactions),
        subtext: metricsMessages.localIndexedDb,
      },
      {
        label: metricsMessages.observedAccounts,
        value: formatMetricInteger(input.supplement.cacheSummary.totalObservedAccounts),
        subtext: metricsMessages.derivedFromCachedTransactions,
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

function getEvmProviderSignature() {
  const profile = readActiveRpcProfileCookie('evm');

  return JSON.stringify({
    id: profile?.id ?? null,
    rpcUrl: profile?.rpcUrl ?? null,
    wsUrl: profile?.wsUrl ?? null,
    nativeCurrencySymbol: getActiveEvmCurrencyNameClient(),
  });
}

export function EvmHomeDataProvider({ children }: { children: ReactNode }) {
  const messages = useMessages();
  const metricsMessages = messages.homeMetrics;
  const unavailable = messages.common.unavailable;
  const pathname = usePathname();
  const { activeMode } = useActivePlatformMode();
  const [snapshot, setSnapshot] = useState<EvmHomeSnapshot | null>(null);
  const [status, setStatus] = useState<EvmLiveStatus | null>(null);
  const [latestFeed, setLatestFeed] = useState<EvmLatestFeed | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(12_000);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [homeLoadStarted, setHomeLoadStarted] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef(12_000);
  const hasResolvedPollIntervalRef = useRef(false);
  const hasValidatedCacheRef = useRef(false);
  const recentHomeBlocksRef = useRef<RecentHomeBlock[]>([]);
  const recentHomeTransactionsRef = useRef<RecentHomeTransaction[]>([]);
  const homeChainIdRef = useRef<string | null>(null);
  const statusRef = useRef<EvmLiveStatus | null>(null);
  const activeProviderSignatureRef = useRef<string | null>(null);

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
    statusRef.current = status;
  }, [status]);

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

    async function refreshCachedHomeTransactions() {
      const cachedTransactions = await getEvmHomeCachedTransactionsDirect(HOME_TRANSACTION_LIST_LIMIT);

      if (disposed) {
        return;
      }

      recentHomeTransactionsRef.current = cachedTransactions;
      setSnapshot((current) =>
        current
          ? {
              ...current,
              activity: current.activity.transactions.length === 0
                ? {
                    ...current.activity,
                    transactions: cachedTransactions,
                  }
                : current.activity,
            }
          : current,
      );
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
      if (isHomePage) {
        setSnapshot((current) =>
          current
            ? {
                ...current,
                activity: {
                  ...current.activity,
                  blocks: recentHomeBlocksRef.current.slice(0, HOME_BLOCK_LIST_LIMIT).map((item) => item.block),
                  transactions: recentHomeTransactionsRef.current,
                },
                latestBlockNumber: nextFeed.latestBlockNumber,
                latestBlockTimestamp: nextFeed.latestBlockTimestamp,
                pollIntervalMs: resolvedPollIntervalMs,
              }
            : current,
        );
      }
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

      const nextSnapshot = buildDerivedHomeSnapshot({
        feed,
        supplement,
        recentBlocks: recentHomeBlocksRef.current,
        chainId: homeChainIdRef.current,
        pollIntervalMs: feed.pollIntervalMs,
        activityTransactions: recentHomeTransactionsRef.current,
        messages: metricsMessages,
        unavailable,
      });

      setSnapshot((current) =>
        current
          ? {
              ...nextSnapshot,
              activity: current.activity,
            }
          : nextSnapshot,
      );
    }

    async function refreshHomeMetricsOnly() {
      if (!isHomePage) {
        return;
      }

      const currentStatus = statusRef.current;

      if (!currentStatus) {
        return;
      }

      const supplement = await getEvmHomeMetricsSupplementDirect(homeChainIdRef.current == null);

      if (disposed) {
        return;
      }

      if (supplement.header.chainId) {
        homeChainIdRef.current = supplement.header.chainId;
      }

      const nextSnapshot = buildDerivedHomeSnapshot({
        feed: currentStatus,
        supplement,
        recentBlocks: recentHomeBlocksRef.current,
        chainId: homeChainIdRef.current,
        pollIntervalMs: currentStatus.pollIntervalMs,
        activityTransactions: recentHomeTransactionsRef.current,
        messages: metricsMessages,
        unavailable,
      });

      setSnapshot((current) =>
        current
          ? {
              ...nextSnapshot,
              activity: current.activity,
            }
          : current,
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
          messages: metricsMessages,
          unavailable,
        }),
      );
      setErrorMessage(null);
    }

    async function load() {
      if (isHomePage) {
        setHomeLoadStarted(true);
      }

      try {
      if (!isEvmRoute) {
        setStatus(null);
        setSnapshot(null);
        setLatestFeed(null);
        setErrorMessage(null);
        setHomeLoadStarted(false);
        setPollIntervalMs(12_000);
        recentHomeBlocksRef.current = [];
        recentHomeTransactionsRef.current = [];
          homeChainIdRef.current = null;
          clearPoll();
          return;
        }

        if (!hasValidatedCacheRef.current) {
          hasValidatedCacheRef.current = true;
          void validateActiveEvmCacheDirect().catch(() => undefined);
        }

        const needsHomeBootstrap = isHomePage && recentHomeBlocksRef.current.length < HOME_BLOCK_LIST_LIMIT;

        if (needsHomeBootstrap) {
          await bootstrapHome();
        } else if (isHomePage && recentHomeTransactionsRef.current.length === 0) {
          await refreshCachedHomeTransactions();
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
        setErrorMessage(error instanceof Error ? error.message : messages.common.failedToLoadBlockTitle);
        setPollIntervalMs(12_000);
        scheduleNextPoll(12_000);
      }
    }

    const handleProfileChanged = () => {
      const nextSignature = getEvmProviderSignature();

      if (activeProviderSignatureRef.current === nextSignature) {
        return;
      }

      activeProviderSignatureRef.current = nextSignature;
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
      setHomeLoadStarted(isHomePage);
      void load();
    };

    void load();
    activeProviderSignatureRef.current = getEvmProviderSignature();
    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    const unsubscribeTransactionCache = subscribeEvmTransactionCache(() => {
      if (isHomePage) {
        void refreshCachedHomeTransactions();
        void refreshHomeMetricsOnly();
      }
    });

    return () => {
      disposed = true;
      clearPoll();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
      unsubscribeTransactionCache();
    };
  }, [activeMode, messages.common.failedToLoadBlockTitle, metricsMessages, pathname, unavailable]);

  const value = useMemo(
    () => ({
      status,
      snapshot,
      latestFeed,
      errorMessage,
      pollIntervalMs,
      nowMs,
      homeLoadStarted,
    }),
    [errorMessage, homeLoadStarted, latestFeed, nowMs, pollIntervalMs, snapshot, status],
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
