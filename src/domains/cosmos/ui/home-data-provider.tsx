'use client';

import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getActiveCosmosProvider,
  getCosmosHomeSnapshotDirect,
  getCosmosLatestBlockFeedDirect,
  getCosmosOverviewDirect,
  getCosmosValidatorMapsForHeightDirect,
  type CosmosLatestBlockFeed,
  type CosmosHomeSnapshot,
  type CosmosValidatorMaps,
} from '@/domains/cosmos/client/queries';
import { decodeCosmosHomeTransactionsByHashes } from '@/domains/cosmos/client/home-transactions';
import { notifyCosmosTransactionsAvailable } from '@/domains/cosmos/ui/live-events';
import { HOME_ACTIVITY_LIST_LIMIT } from '@/config/pagination';
import { readActivePlatformModeCookie } from '@/platform/workbench/rpc-profile-client';
import { isCosmosHomeRouteActive, isCosmosLiveBlockRouteActive, isCosmosRouteActive } from '@/platform/workbench/home-route-state';

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

type TendermintWsCommitSignature = {
  block_id_flag?: number | string;
  validator_address?: string;
  signature?: string | null;
};

type TendermintWsEnvelope = {
  result?: {
    query?: string;
    events?: Record<string, string[] | undefined>;
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
            height?: string;
            signatures?: TendermintWsCommitSignature[];
          };
        };
        block_id?: {
          hash?: string;
        };
        result_finalize_block?: {
          events?: Array<{
            type?: string;
            attributes?: Array<{
              key?: string;
              value?: string;
            }>;
          }>;
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

function formatWsGasLabel(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || !/^\d+$/.test(normalized)) {
    return '-- Gas';
  }

  const gasUsed = Number(normalized);

  if (gasUsed >= 1_000_000) {
    return `${(gasUsed / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} M Gas`;
  }

  if (gasUsed >= 1_000) {
    return `${(gasUsed / 1_000).toFixed(1).replace(/\.?0+$/, '')} K Gas`;
  }

  return `${gasUsed} Gas`;
}

function getWsBlockGasLabel(payload: TendermintWsEnvelope) {
  const eventGasAmount = payload.result?.events?.['block_gas.amount']?.[0];

  if (eventGasAmount != null) {
    return formatWsGasLabel(eventGasAmount);
  }

  const blockGasEvent = payload.result?.data?.value?.result_finalize_block?.events?.find((event) => event.type === 'block_gas');
  const blockGasAmount = blockGasEvent?.attributes?.find((attribute) => attribute.key === 'amount')?.value;

  return formatWsGasLabel(blockGasAmount);
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

function formatWsCommitSummary(signatures: TendermintWsCommitSignature[] | undefined) {
  if (!signatures?.length) {
    return null;
  }

  const counts = new Map<number, number>();

  signatures.forEach((signature) => {
    const flag = Number.parseInt(String(signature.block_id_flag ?? 0), 10);
    counts.set(flag, (counts.get(flag) ?? 0) + 1);
  });

  const labels = new Map<number, string>([
    [1, 'Absent'],
    [2, 'Commit'],
    [3, 'Nil'],
  ]);
  const parts = [...counts.entries()].sort((left, right) => left[0] - right[0]).map(([flag, count]) => `${labels.get(flag) ?? `Flag ${flag}`}: ${count}`);

  return parts.join(' · ');
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
  const liveBlockTxHashesRef = useRef<Map<string, string[]>>(new Map());
  const validatorMapsRef = useRef<CosmosValidatorMaps | null>(null);
  const liveBlockHydrationRef = useRef<{
    requestedHeight: string | null;
    latestAppliedHeight: string | null;
    latestAppliedHeightNumber: number;
  }>({
    requestedHeight: null,
    latestAppliedHeight: null,
    latestAppliedHeightNumber: 0,
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
    let clearSnapshotTimeout: number | null = null;
    let connectionModeTimeout: number | null = null;
    const isHomeRoute = isCosmosHomeRouteActive(pathname, activeMode);
    const isCosmosRoute = isCosmosRouteActive(pathname, activeMode);
    const shouldSubscribeToLiveBlocks = isCosmosLiveBlockRouteActive(pathname, activeMode);
    const shouldHydrateBlockDetails = isHomeRoute;

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

    function closeSocket(socket = websocketRef.current) {
      if (!socket) {
        return;
      }

      if (websocketRef.current === socket) {
        websocketRef.current = null;
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
        return;
      }

      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => socket.close(), { once: true });
      }
    }

    function schedulePoll(delayMs: number) {
      clearTimers();
      pollTimeoutRef.current = window.setTimeout(() => {
        void loadSnapshot();
      }, delayMs);
    }

    async function loadValidatorMaps(height: number | string) {
      try {
        const validatorMaps = await getCosmosValidatorMapsForHeightDirect(height);

        if (!disposed) {
          validatorMapsRef.current = validatorMaps;
        }

        return validatorMaps;
      } catch {
        return validatorMapsRef.current;
      }
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
        await loadValidatorMaps(latestHeight);

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
      const lastCommit = value?.block?.last_commit;
      const lastCommitSignaturesLabel = formatWsCommitSummary(lastCommit?.signatures);
      const height = header?.height;
      const blockGasLabel = getWsBlockGasLabel(payload);

      if (!height) {
        return;
      }

      const heightNumber = Number.parseInt(height, 10);

      if (Number.isFinite(heightNumber) && heightNumber < liveBlockHydrationRef.current.latestAppliedHeightNumber) {
        return;
      }

      const txCount = Array.isArray(value?.block?.data?.txs) ? value.block.data.txs.length : 0;
      const validatorMaps = validatorMapsRef.current ?? (await loadValidatorMaps(height));
      const proposer = header.proposer_address ?? 'Unknown';
      const proposerMoniker = validatorMaps?.proposerMonikerByAddress.get(proposer) ?? null;
      const proposerOperatorAddress = validatorMaps?.proposerOperatorAddressByAddress.get(proposer) ?? null;
      const proposerLabel = proposerMoniker && proposerMoniker !== 'Unknown' ? proposerMoniker : formatCompactHash(proposer);
      const rawTxs = Array.isArray(value?.block?.data?.txs) ? value.block.data.txs.filter((tx): tx is string => typeof tx === 'string' && tx.trim() !== '') : [];
      const txHashResults = rawTxs.length
        ? await Promise.all(
            rawTxs.map(async (tx) => {
              try {
                return await sha256HexFromBase64(tx);
              } catch {
                return null;
              }
            }),
          )
        : [];
      const txHashes = txHashResults.filter((hash): hash is string => hash != null);

      if (txHashes.length) {
        liveBlockTxHashesRef.current.set(height, txHashes);
      }

      if (lastCommit?.height) {
        const committedTxHashes = liveBlockTxHashesRef.current.get(lastCommit.height);

        if (committedTxHashes?.length) {
          notifyCosmosTransactionsAvailable({
            height: lastCommit.height,
            txCount: committedTxHashes.length,
            txHashes: committedTxHashes,
          });

          if (isHomeRoute) {
            committedTxHashes.forEach((hash) => {
              queueTransactionDecode(hash);
            });
          }

          liveBlockTxHashesRef.current.delete(lastCommit.height);
        }
      }

      if (liveBlockTxHashesRef.current.size > COSMOS_HOME_BLOCK_LIMIT * 3) {
        const currentHeight = Number.parseInt(height, 10);

        liveBlockTxHashesRef.current.forEach((_hashes, blockHeight) => {
          const blockHeightNumber = Number.parseInt(blockHeight, 10);

          if (Number.isFinite(currentHeight) && Number.isFinite(blockHeightNumber) && currentHeight - blockHeightNumber > COSMOS_HOME_BLOCK_LIMIT * 3) {
            liveBlockTxHashesRef.current.delete(blockHeight);
          }
        });
      }

      if (txCount > 0) {
        notifyCosmosTransactionsAvailable({
          height,
          txCount,
        });
      }

      if (liveBlockHydrationRef.current.requestedHeight === height || liveBlockHydrationRef.current.latestAppliedHeight === height) {
        return;
      }

      if (Number.isFinite(heightNumber) && heightNumber < liveBlockHydrationRef.current.latestAppliedHeightNumber) {
        return;
      }

      if (!shouldHydrateBlockDetails) {
        const timestampMs = parseWsBlockTimestampMs(header.time);

        liveBlockHydrationRef.current.latestAppliedHeight = height;
        liveBlockHydrationRef.current.latestAppliedHeightNumber = Number.isFinite(heightNumber) ? heightNumber : liveBlockHydrationRef.current.latestAppliedHeightNumber;
        setLatestFeed({
          latestBlock: height,
          latestBlockNumber: heightNumber || 0,
          latestBlockTime: formatWsBlockTime(header.time),
          latestBlockTimestampMs: timestampMs,
          lastCommitHeight: lastCommit?.height ?? null,
          lastCommitSignaturesLabel,
          blockPageItem: {
            height,
            hash: value?.block_id?.hash ?? '',
            hashLabel: formatCompactHash(value?.block_id?.hash),
            proposer,
            proposerOperatorAddress,
            proposerLabel,
            proposerAddressLabel: formatCompactHash(proposer, 12, 8),
            txCount,
            txCountLabel: formatMetricInteger(txCount),
            gasUsedLabel: blockGasLabel,
            blockSizeLabel: blockGasLabel,
            appHash: header.app_hash ?? '',
            appHashLabel: formatCompactHash(header.app_hash, 10, 8),
            signaturesLabel: 'Pending',
            timeLabel: formatWsBlockTime(header.time),
            timestampMs,
          },
        });
        setErrorMessage(null);
        return;
      }

      const timestampMs = parseWsBlockTimestampMs(header.time);
      const liveFeed = {
        latestBlock: height,
        latestBlockNumber: Number.parseInt(height, 10) || 0,
        latestBlockTime: formatWsBlockTime(header.time),
        latestBlockTimestampMs: timestampMs,
        lastCommitHeight: lastCommit?.height ?? null,
        lastCommitSignaturesLabel,
        blockPageItem: {
          height,
          hash: value?.block_id?.hash ?? '',
          hashLabel: formatCompactHash(value?.block_id?.hash),
          proposer,
          proposerOperatorAddress,
          proposerLabel,
          proposerAddressLabel: formatCompactHash(proposer, 12, 8),
          txCount,
          txCountLabel: formatMetricInteger(txCount),
          gasUsedLabel: blockGasLabel,
          blockSizeLabel: blockGasLabel,
          appHash: header.app_hash ?? '',
          appHashLabel: formatCompactHash(header.app_hash, 10, 8),
          signaturesLabel: 'Pending',
          timeLabel: formatWsBlockTime(header.time),
          timestampMs,
        },
      } satisfies CosmosLatestBlockFeed;

      liveBlockHydrationRef.current.latestAppliedHeight = liveFeed.latestBlock;
      liveBlockHydrationRef.current.latestAppliedHeightNumber = Number.isFinite(liveFeed.latestBlockNumber)
        ? liveFeed.latestBlockNumber
        : liveBlockHydrationRef.current.latestAppliedHeightNumber;
      setLatestFeed((current) => (current?.latestBlock === liveFeed.latestBlock ? current : liveFeed));
      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        const txCountValue = liveFeed.blockPageItem.txCount;
        const isNewerBlock = Number.isFinite(liveFeed.latestBlockNumber) && liveFeed.latestBlockNumber > current.latestHeight;
        let nextMetrics = current.metrics;
        let nextBlocks = current.activity.blocks;

        if (isNewerBlock) {
          nextMetrics = updateSnapshotMetric(nextMetrics, 'Block Height', formatMetricInteger(liveFeed.latestBlockNumber));
          nextMetrics = updateSnapshotMetric(
            nextMetrics,
            'Confirmed Txs',
            formatMetricInteger(parseMetricInteger(current.metrics.find((metric) => metric.label === 'Confirmed Txs')?.value ?? '0') + txCountValue),
          );
        }

        if (liveFeed.lastCommitHeight && liveFeed.lastCommitSignaturesLabel) {
          nextBlocks = nextBlocks.map((block) => (block.height === liveFeed.lastCommitHeight ? { ...block, signaturesLabel: liveFeed.lastCommitSignaturesLabel } : block));
        }

        return {
          ...current,
          header: {
            ...current.header,
            latestBlockTime: liveFeed.latestBlockTime,
          },
          metrics: nextMetrics,
          latestHeight: isNewerBlock ? liveFeed.latestBlockNumber : current.latestHeight,
          refreshedAt: Date.now(),
          activity: {
            ...current.activity,
            blocks: mergeLatestBlocks(nextBlocks, {
              height: liveFeed.blockPageItem.height,
              hash: liveFeed.blockPageItem.hash,
              hashLabel: liveFeed.blockPageItem.hashLabel,
              proposer: liveFeed.blockPageItem.proposer,
              proposerOperatorAddress: liveFeed.blockPageItem.proposerOperatorAddress,
              proposerLabel: liveFeed.blockPageItem.proposerLabel,
              txCount: liveFeed.blockPageItem.txCountLabel,
              blockSizeLabel: liveFeed.blockPageItem.blockSizeLabel,
              timeLabel: liveFeed.blockPageItem.timeLabel,
              timestampMs: liveFeed.blockPageItem.timestampMs,
            }),
          },
        };
      });
      setErrorMessage(null);
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
          if (disposed || websocketRef.current !== socket) {
            closeSocket(socket);
            return;
          }

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
        };
        socket.onmessage = async (event) => {
          if (websocketRef.current !== socket) {
            return;
          }

          try {
            const payload = JSON.parse(event.data) as TendermintWsEnvelope;
            const query = payload.result?.query ?? '';

            if (!payload.result?.data) {
              return;
            }

            if (query.includes("tm.event='NewBlock'")) {
              void applyNewBlockFromWs(payload);
            }
          } catch {
            if (autoRefreshEnabled) {
              queueRefresh();
            }
          }
        };
        socket.onerror = () => {
          if (websocketRef.current !== socket) {
            return;
          }

          closeSocket(socket);
          setConnectionMode('poll');
          if (autoRefreshEnabled) {
            schedulePoll(12_000);
          }
        };
        socket.onclose = () => {
          if (disposed || websocketRef.current !== socket) {
            return;
          }

          websocketRef.current = null;
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
      clearSnapshotTimeout = window.setTimeout(() => {
        if (!disposed) {
          setSnapshot(null);
        }
      }, 0);
    }

    if (shouldSubscribeToLiveBlocks) {
      void getCosmosOverviewDirect()
        .then((overview) => {
          const latestHeight = Number.parseInt(String(overview.latestHeight ?? '0'), 10);

          if (Number.isFinite(latestHeight) && latestHeight > 0) {
            void loadValidatorMaps(latestHeight);
          }
        })
        .catch(() => undefined);
      setupWebSocket();
    } else {
      closeSocket();
      connectionModeTimeout = window.setTimeout(() => {
        if (!disposed) {
          setConnectionMode('poll');
        }
      }, 0);
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
      if (clearSnapshotTimeout != null) {
        window.clearTimeout(clearSnapshotTimeout);
      }
      if (connectionModeTimeout != null) {
        window.clearTimeout(connectionModeTimeout);
      }
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
