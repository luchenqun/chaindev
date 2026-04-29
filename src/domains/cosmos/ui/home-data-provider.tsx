'use client';

import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getActiveCosmosProvider,
  getCosmosHomeSnapshotDirect,
  getCosmosLatestBlockFeedDirect,
  getCosmosOverviewDirect,
  type CosmosLatestBlockFeed,
  type CosmosHomeSnapshot,
} from '@/domains/cosmos/client/queries';
import { decodeCosmosHomeTransactionsByHashes } from '@/domains/cosmos/client/home-transactions';
import { notifyCosmosTransactionsAvailable } from '@/domains/cosmos/ui/live-events';
import { HOME_ACTIVITY_LIST_LIMIT } from '@/config/pagination';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';
import { isCosmosBlocksRouteActive, isCosmosHomeRouteActive, isCosmosLiveBlockRouteActive, isCosmosRouteActive } from '@/platform/workbench/home-route-state';

type CosmosHomeDataContextValue = {
  snapshot: CosmosHomeSnapshot | null;
  latestFeed: CosmosLatestBlockFeed | null;
  errorMessage: string | null;
  nowMs: number;
  connectionMode: 'ws' | 'poll';
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
};

const CosmosHomeDataContext = createContext<CosmosHomeDataContextValue | null>(null);
const COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY = 'chaindev-cosmos-home-auto-refresh-enabled';
const COSMOS_HOME_BLOCK_LIMIT = HOME_ACTIVITY_LIST_LIMIT;
const COSMOS_HOME_TX_LIMIT = HOME_ACTIVITY_LIST_LIMIT;

type TendermintWsEnvelope = {
  result?: {
    query?: string;
    data?: {
      value?: {
        block?: {
          header?: {
            height?: string;
            time?: string;
            proposer_address?: string;
            app_hash?: string;
          };
          data?: {
            txs?: unknown[];
          };
          last_commit?: {
            signatures?: Array<{
              block_id_flag?: number | string;
              signature?: string | null;
            }>;
          };
        };
        block_id?: {
          hash?: string;
        };
        TxResult?: {
          height?: string | number;
          tx?: string;
          result?: {
            code?: number;
            events?: Array<{
              type?: string;
              attributes?: Array<{ key?: string; value?: string }>;
            }>;
          };
        };
      };
    };
  };
};

function readStoredAutoRefreshEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  const value = window.localStorage.getItem(COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY);

  if (value == null) {
    return true;
  }

  return value !== 'false';
}

function formatMetricInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function parseMetricInteger(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateSnapshotMetric(metrics: CosmosHomeSnapshot['metrics'], label: string, nextValue: string) {
  return metrics.map((metric) =>
    metric.label === label
      ? {
          ...metric,
          value: nextValue,
        }
      : metric,
  );
}

function mergeLatestBlocks(current: CosmosHomeSnapshot['activity']['blocks'], next: CosmosHomeSnapshot['activity']['blocks'][number]) {
  return [next, ...current.filter((item) => item.height !== next.height)].slice(0, COSMOS_HOME_BLOCK_LIMIT);
}

function formatWsBlockTime(value: string | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const timestampMs = new Date(value).getTime();

  if (!Number.isFinite(timestampMs)) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestampMs));
}

function formatCompactHash(value: string | undefined, start = 10, end = 8) {
  if (!value) {
    return 'Unavailable';
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function parseWsBlockTimestampMs(value: string | undefined) {
  if (!value) {
    return null;
  }

  const timestampMs = new Date(value).getTime();
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

async function sha256HexFromBase64(input: string) {
  const raw = window.atob(input);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function CosmosHomeDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMode, setActiveMode] = useState(() => readActivePlatformModeCookie());
  const [snapshot, setSnapshot] = useState<CosmosHomeSnapshot | null>(null);
  const [latestFeed, setLatestFeed] = useState<CosmosHomeDataContextValue['latestFeed']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [connectionMode, setConnectionMode] = useState<'ws' | 'poll'>('poll');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => readStoredAutoRefreshEnabled());
  const pollTimeoutRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const refreshQueuedRef = useRef(false);
  const pendingTxHashesRef = useRef<Set<string>>(new Set());
  const decodeTimeoutRef = useRef<number | null>(null);
  const liveBlockHydrationRef = useRef<{
    requestedHeight: string | null;
    latestAppliedHeight: string | null;
  }>({
    requestedHeight: null,
    latestAppliedHeight: null,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleModeChanged = () => {
      setActiveMode(readActivePlatformModeCookie());
    };

    handleModeChanged();

    window.addEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
    window.addEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
    window.addEventListener('chaindev:active-platform-mode-changed', handleModeChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleModeChanged);
      window.removeEventListener('chaindev:rpc-profiles-changed', handleModeChanged);
      window.removeEventListener('chaindev:active-platform-mode-changed', handleModeChanged);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY, String(autoRefreshEnabled));
  }, [autoRefreshEnabled]);

  useEffect(() => {
    let disposed = false;
    const isHomeRoute = isCosmosHomeRouteActive(pathname, activeMode);
    const isCosmosRoute = isCosmosRouteActive(pathname, activeMode);
    const shouldSubscribeToLiveBlocks = isCosmosLiveBlockRouteActive(pathname, activeMode);
    const shouldHydrateBlockDetails = isHomeRoute || isCosmosBlocksRouteActive(pathname);

    function clearTimers() {
      if (pollTimeoutRef.current != null) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }

      if (decodeTimeoutRef.current != null) {
        window.clearTimeout(decodeTimeoutRef.current);
        decodeTimeoutRef.current = null;
      }
    }

    function closeSocket() {
      const socket = websocketRef.current;
      websocketRef.current = null;

      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }
    }

    function schedulePoll(delayMs: number) {
      clearTimers();
      pollTimeoutRef.current = window.setTimeout(() => {
        void loadSnapshot();
      }, delayMs);
    }

    async function loadSnapshot() {
      if (!isHomeRoute) {
        return;
      }

      try {
        const nextSnapshot = await getCosmosHomeSnapshotDirect();

        if (disposed) {
          return;
        }

        setSnapshot(nextSnapshot);
        setErrorMessage(null);

        if (!websocketRef.current && autoRefreshEnabled) {
          schedulePoll(12_000);
        }
      } catch (error) {
        if (disposed) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos homepage activity.');
        if (!websocketRef.current && autoRefreshEnabled) {
          schedulePoll(12_000);
        }
      }
    }

    async function loadLatestFeed() {
      try {
        const overview = await getCosmosOverviewDirect();
        const latestHeight = Number.parseInt(String(overview.latestHeight ?? '0'), 10);

        if (!Number.isFinite(latestHeight) || latestHeight < 1) {
          if (!disposed) {
            setLatestFeed(null);
          }
          return;
        }

        const nextFeed = await getCosmosLatestBlockFeedDirect(latestHeight);

        if (disposed) {
          return;
        }

        setLatestFeed(nextFeed);
        setErrorMessage(null);
      } catch (error) {
        if (disposed) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load the latest Cosmos block.');
      }
    }

    function queueRefresh() {
      if (!autoRefreshEnabled) {
        return;
      }

      if (refreshQueuedRef.current) {
        return;
      }

      refreshQueuedRef.current = true;
      window.setTimeout(() => {
        refreshQueuedRef.current = false;
        void loadSnapshot();
      }, 250);
    }

    function mergeDecodedTransactions(decodedTransactions: CosmosHomeSnapshot['activity']['transactions']) {
      if (!decodedTransactions.length) {
        return;
      }

      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        const decodedByHash = new Map(decodedTransactions.map((transaction) => [transaction.hash, transaction]));

        const merged = current.activity.transactions.map((transaction) => {
          return decodedByHash.get(transaction.hash) ?? transaction;
        });

        decodedTransactions.forEach((transaction) => {
          if (!merged.some((currentTransaction) => currentTransaction.hash === transaction.hash)) {
            merged.unshift(transaction);
          }
        });

        return {
          ...current,
          refreshedAt: Date.now(),
          activity: {
            ...current.activity,
            transactions: merged.slice(0, COSMOS_HOME_TX_LIMIT),
          },
        };
      });
    }

    async function flushPendingTransactionDecodes() {
      decodeTimeoutRef.current = null;

      const hashes = [...pendingTxHashesRef.current];
      pendingTxHashesRef.current.clear();

      if (!hashes.length) {
        return;
      }

      try {
        const transactions = await decodeCosmosHomeTransactionsByHashes(hashes);
        mergeDecodedTransactions(transactions);
      } catch {
        queueRefresh();
      }
    }

    function queueTransactionDecode(hash: string) {
      pendingTxHashesRef.current.add(hash);

      if (decodeTimeoutRef.current != null) {
        return;
      }

      decodeTimeoutRef.current = window.setTimeout(() => {
        void flushPendingTransactionDecodes();
      }, 250);
    }

    async function applyNewBlockFromWs(payload: TendermintWsEnvelope) {
      const value = payload.result?.data?.value;
      const header = value?.block?.header;
      const height = header?.height;

      if (!height) {
        return;
      }

      const txCount = Array.isArray(value?.block?.data?.txs) ? value.block.data.txs.length : 0;

      if (txCount > 0) {
        notifyCosmosTransactionsAvailable({
          height,
          txCount,
        });
      }

      if (liveBlockHydrationRef.current.requestedHeight === height || liveBlockHydrationRef.current.latestAppliedHeight === height) {
        return;
      }

      if (!shouldHydrateBlockDetails) {
        const timestampMs = parseWsBlockTimestampMs(header.time);

        liveBlockHydrationRef.current.latestAppliedHeight = height;
        setLatestFeed({
          latestBlock: height,
          latestBlockNumber: Number.parseInt(height, 10) || 0,
          latestBlockTime: formatWsBlockTime(header.time),
          latestBlockTimestampMs: timestampMs,
          blockPageItem: {
            height,
            hash: value?.block_id?.hash ?? '',
            hashLabel: formatCompactHash(value?.block_id?.hash),
            proposer: header.proposer_address ?? 'Unknown',
            proposerOperatorAddress: null,
            proposerLabel: formatCompactHash(header.proposer_address),
            proposerAddressLabel: formatCompactHash(header.proposer_address, 12, 8),
            txCount,
            txCountLabel: `${txCount} txs`,
            blockSizeLabel: 'Unavailable',
            appHash: header.app_hash ?? '',
            appHashLabel: formatCompactHash(header.app_hash, 10, 8),
            signaturesLabel: 'Unavailable',
            timeLabel: formatWsBlockTime(header.time),
            timestampMs,
          },
        });
        setErrorMessage(null);
        return;
      }

      liveBlockHydrationRef.current.requestedHeight = height;

      try {
        const nextFeed = await getCosmosLatestBlockFeedDirect(height);

        if (disposed) {
          return;
        }

        liveBlockHydrationRef.current.latestAppliedHeight = nextFeed.latestBlock;
        setLatestFeed((current) => (current?.latestBlock === nextFeed.latestBlock ? current : nextFeed));

        setSnapshot((current) => {
          if (!current) {
            return current;
          }

          const txCountValue = nextFeed.blockPageItem.txCount;
          const isNewerBlock = Number.isFinite(nextFeed.latestBlockNumber) && nextFeed.latestBlockNumber > current.latestHeight;
          let nextMetrics = current.metrics;

          if (isNewerBlock) {
            nextMetrics = updateSnapshotMetric(nextMetrics, 'Block Height', formatMetricInteger(nextFeed.latestBlockNumber));
            nextMetrics = updateSnapshotMetric(
              nextMetrics,
              'Confirmed Txs',
              formatMetricInteger(parseMetricInteger(current.metrics.find((metric) => metric.label === 'Confirmed Txs')?.value ?? '0') + txCountValue),
            );
          }

          return {
            ...current,
            header: {
              ...current.header,
              latestBlockTime: nextFeed.latestBlockTime,
            },
            metrics: nextMetrics,
            latestHeight: isNewerBlock ? nextFeed.latestBlockNumber : current.latestHeight,
            refreshedAt: Date.now(),
            activity: {
              ...current.activity,
              blocks: mergeLatestBlocks(current.activity.blocks, {
                height: nextFeed.blockPageItem.height,
                hash: nextFeed.blockPageItem.hash,
                hashLabel: nextFeed.blockPageItem.hashLabel,
                proposer: nextFeed.blockPageItem.proposer,
                proposerOperatorAddress: nextFeed.blockPageItem.proposerOperatorAddress,
                proposerLabel: nextFeed.blockPageItem.proposerLabel,
                txCount: nextFeed.blockPageItem.txCountLabel,
                blockSizeLabel: nextFeed.blockPageItem.blockSizeLabel,
                timeLabel: nextFeed.blockPageItem.timeLabel,
                timestampMs: nextFeed.blockPageItem.timestampMs,
              }),
            },
          };
        });
      } catch {
        queueRefresh();
      } finally {
        if (liveBlockHydrationRef.current.requestedHeight === height) {
          liveBlockHydrationRef.current.requestedHeight = null;
        }
      }
    }

    async function applyTransactionFromWs(payload: TendermintWsEnvelope) {
      const txResult = payload.result?.data?.value?.TxResult;
      const rawTx = txResult?.tx;

      if (!txResult?.height || !rawTx) {
        return;
      }

      const hash = await sha256HexFromBase64(rawTx);

      if (disposed) {
        return;
      }

      queueTransactionDecode(hash);
    }

    function setupWebSocket() {
      if (!shouldSubscribeToLiveBlocks) {
        closeSocket();
        setConnectionMode('poll');
        return;
      }

      try {
        const profile = getActiveCosmosProvider();

        if (!profile.wsUrl) {
          setConnectionMode('poll');
          if (autoRefreshEnabled) {
            schedulePoll(12_000);
          }
          return;
        }

        clearTimers();
        setConnectionMode('ws');
        const socket = new WebSocket(profile.wsUrl);
        websocketRef.current = socket;

        socket.onopen = () => {
          clearTimers();
          socket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'subscribe',
              id: 'cosmos-home',
              params: {
                query: "tm.event='NewBlock'",
              },
            }),
          );

          if (isHomeRoute) {
            socket.send(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'subscribe',
                id: 'cosmos-home-tx',
                params: {
                  query: "tm.event='Tx'",
                },
              }),
            );
          }
        };
        socket.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data) as TendermintWsEnvelope;
            const query = payload.result?.query ?? '';

            if (!payload.result?.data) {
              return;
            }

            if (query.includes("tm.event='NewBlock'")) {
              void applyNewBlockFromWs(payload);
              return;
            }

            if (query.includes("tm.event='Tx'")) {
              await applyTransactionFromWs(payload);
            }
          } catch {
            if (autoRefreshEnabled) {
              queueRefresh();
            }
          }
        };
        socket.onerror = () => {
          closeSocket();
          setConnectionMode('poll');
          if (autoRefreshEnabled) {
            schedulePoll(12_000);
          }
        };
        socket.onclose = () => {
          if (disposed) {
            return;
          }

          closeSocket();
          setConnectionMode('poll');
          if (autoRefreshEnabled) {
            schedulePoll(12_000);
          }
        };
      } catch {
        setConnectionMode('poll');
        if (autoRefreshEnabled) {
          schedulePoll(12_000);
        }
      }
    }

    function resetState() {
      clearTimers();
      closeSocket();
      setSnapshot(null);
      setLatestFeed(null);
      setErrorMessage(null);
    }

    if (!isCosmosRoute) {
      resetState();
      return () => {
        disposed = true;
        clearTimers();
        closeSocket();
      };
    }

    if (isHomeRoute) {
      void loadSnapshot();
    } else {
      setSnapshot(null);
    }

    if (shouldSubscribeToLiveBlocks) {
      setupWebSocket();
    } else {
      closeSocket();
      setConnectionMode('poll');
      void loadLatestFeed();
    }

    const handleProfileChanged = () => {
      resetState();
      if (isCosmosHomeRouteActive(pathname, readActivePlatformModeCookie())) {
        void loadSnapshot();
      }

      if (isCosmosLiveBlockRouteActive(pathname, readActivePlatformModeCookie())) {
        setupWebSocket();
      } else if (isCosmosRouteActive(pathname, readActivePlatformModeCookie())) {
        void loadLatestFeed();
      }
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      disposed = true;
      clearTimers();
      closeSocket();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [activeMode, autoRefreshEnabled, pathname]);

  const value = useMemo(
    () => ({
      snapshot,
      latestFeed,
      errorMessage,
      nowMs,
      connectionMode,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
    }),
    [autoRefreshEnabled, connectionMode, errorMessage, latestFeed, nowMs, snapshot],
  );

  return <CosmosHomeDataContext.Provider value={value}>{children}</CosmosHomeDataContext.Provider>;
}

export function useCosmosHomeData() {
  const context = useContext(CosmosHomeDataContext);

  if (!context) {
    throw new Error('useCosmosHomeData must be used within CosmosHomeDataProvider.');
  }

  return context;
}
