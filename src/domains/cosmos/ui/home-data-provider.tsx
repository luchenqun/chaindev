'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getActiveCosmosProvider,
  getCosmosHomeSnapshotDirect,
  type CosmosHomeSnapshot,
} from '@/domains/cosmos/client/queries';
import { decodeCosmosHomeTransactionsByHashes } from '@/domains/cosmos/client/home-transactions';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';
import { isCosmosHomeRouteActive } from '@/platform/workbench/home-route-state';

type CosmosHomeDataContextValue = {
  snapshot: CosmosHomeSnapshot | null;
  errorMessage: string | null;
  nowMs: number;
  connectionMode: 'ws' | 'poll';
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
};

const CosmosHomeDataContext =
  createContext<CosmosHomeDataContextValue | null>(null);
const COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY =
  'chaindev-cosmos-home-auto-refresh-enabled';
const COSMOS_HOME_BLOCK_LIMIT = 6;
const COSMOS_HOME_TX_LIMIT = 6;

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
          };
          data?: {
            txs?: unknown[];
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

  const value = window.localStorage.getItem(
    COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY,
  );

  if (value == null) {
    return true;
  }

  return value !== 'false';
}

function formatCompactHash(value: string, start = 8, end = 6) {
  if (!value) {
    return 'Unavailable';
  }

  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatLocalTimestamp(value: string | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatMetricInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function parseMetricInteger(value: string) {
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function updateSnapshotMetric(
  metrics: CosmosHomeSnapshot['metrics'],
  label: string,
  nextValue: string,
) {
  return metrics.map((metric) =>
    metric.label === label
      ? {
          ...metric,
          value: nextValue,
        }
      : metric,
  );
}

function mergeLatestBlocks(
  current: CosmosHomeSnapshot['activity']['blocks'],
  next: CosmosHomeSnapshot['activity']['blocks'][number],
) {
  return [next, ...current.filter((item) => item.height !== next.height)].slice(
    0,
    COSMOS_HOME_BLOCK_LIMIT,
  );
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

export function CosmosHomeDataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeMode = readActivePlatformModeCookie();
  const [snapshot, setSnapshot] = useState<CosmosHomeSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [connectionMode, setConnectionMode] = useState<'ws' | 'poll'>('poll');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() =>
    readStoredAutoRefreshEnabled(),
  );
  const pollTimeoutRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const refreshQueuedRef = useRef(false);
  const pendingTxHashesRef = useRef<Set<string>>(new Set());
  const decodeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      COSMOS_HOME_AUTO_REFRESH_STORAGE_KEY,
      String(autoRefreshEnabled),
    );
  }, [autoRefreshEnabled]);

  useEffect(() => {
    let disposed = false;

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

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load Cosmos homepage activity.',
        );
        if (!websocketRef.current && autoRefreshEnabled) {
          schedulePoll(12_000);
        }
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

    function mergeDecodedTransactions(
      decodedTransactions: CosmosHomeSnapshot['activity']['transactions'],
    ) {
      if (!decodedTransactions.length) {
        return;
      }

      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        const decodedByHash = new Map(
          decodedTransactions.map((transaction) => [transaction.hash, transaction]),
        );

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

    function applyNewBlockFromWs(payload: TendermintWsEnvelope) {
      const value = payload.result?.data?.value;
      const header = value?.block?.header;
      const height = header?.height;
      const hash = value?.block_id?.hash;
      const timestamp = header?.time;
      const proposer = header?.proposer_address ?? 'Unknown';
      const txCount = String(value?.block?.data?.txs?.length ?? 0);
      const timestampMs = timestamp ? new Date(timestamp).getTime() : null;

      if (!height || !hash) {
        return;
      }

      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        const nextHeight = Number.parseInt(height, 10);
        const txCountValue = Number.parseInt(txCount, 10) || 0;
        const isNewerBlock =
          Number.isFinite(nextHeight) && nextHeight > current.latestHeight;

        const nextBlock = {
          height,
          hash,
          hashLabel: formatCompactHash(hash),
          proposer,
          proposerLabel: formatCompactHash(proposer, 10, 6),
          txCount,
          timeLabel: formatLocalTimestamp(timestamp),
          timestampMs: Number.isNaN(timestampMs) ? null : timestampMs,
        };
        let nextMetrics = current.metrics;

        if (isNewerBlock) {
          nextMetrics = updateSnapshotMetric(
            nextMetrics,
            'Block Height',
            formatMetricInteger(nextHeight),
          );
          nextMetrics = updateSnapshotMetric(
            nextMetrics,
            'Confirmed Txs',
            formatMetricInteger(
              parseMetricInteger(
                current.metrics.find((metric) => metric.label === 'Confirmed Txs')
                  ?.value ?? '0',
              ) + txCountValue,
            ),
          );
        }

        return {
          ...current,
          header: {
            ...current.header,
            latestBlockTime: formatLocalTimestamp(timestamp),
          },
          metrics: nextMetrics,
          latestHeight: isNewerBlock ? nextHeight : current.latestHeight,
          refreshedAt: Date.now(),
          activity: {
            ...current.activity,
            blocks: mergeLatestBlocks(current.activity.blocks, nextBlock),
          },
        };
      });
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
        };
        socket.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data) as TendermintWsEnvelope;
            const query = payload.result?.query ?? '';

            if (!payload.result?.data) {
              return;
            }

            if (query.includes("tm.event='NewBlock'")) {
              applyNewBlockFromWs(payload);
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
      setErrorMessage(null);
    }

    if (!isCosmosHomeRouteActive(pathname, activeMode)) {
      resetState();
      return () => {
        disposed = true;
        clearTimers();
        closeSocket();
      };
    }

    void loadSnapshot();
    setupWebSocket();

    const handleProfileChanged = () => {
      resetState();
      void loadSnapshot();
      setupWebSocket();
    };

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      disposed = true;
      clearTimers();
      closeSocket();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, [activeMode, autoRefreshEnabled, pathname]);

  const value = useMemo(
    () => ({
      snapshot,
      errorMessage,
      nowMs,
      connectionMode,
      autoRefreshEnabled,
      setAutoRefreshEnabled,
    }),
    [autoRefreshEnabled, connectionMode, errorMessage, nowMs, snapshot],
  );

  return (
    <CosmosHomeDataContext.Provider value={value}>
      {children}
    </CosmosHomeDataContext.Provider>
  );
}

export function useCosmosHomeData() {
  const context = useContext(CosmosHomeDataContext);

  if (!context) {
    throw new Error(
      'useCosmosHomeData must be used within CosmosHomeDataProvider.',
    );
  }

  return context;
}
