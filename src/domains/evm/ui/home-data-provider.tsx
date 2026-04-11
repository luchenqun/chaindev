"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getEvmLatestFeedDirect,
  getEvmHomeSnapshotDirect,
  validateActiveEvmCacheDirect,
} from "@/domains/evm/client/queries";

type EvmHomeSnapshot = Awaited<ReturnType<typeof getEvmHomeSnapshotDirect>>;
type EvmLatestFeed = Awaited<ReturnType<typeof getEvmLatestFeedDirect>>;
type EvmLiveStatus = Pick<
  EvmLatestFeed,
  "latestBlock" | "latestBlockNumber" | "latestBlockTime" | "latestBlockTimestamp" | "pollIntervalMs"
>;

type EvmHomeDataContextValue = {
  status: EvmLiveStatus | null;
  snapshot: EvmHomeSnapshot | null;
  latestFeed: EvmLatestFeed | null;
  errorMessage: string | null;
  pollIntervalMs: number;
  nowMs: number;
};

const EvmHomeDataContext = createContext<EvmHomeDataContextValue | null>(null);

export function EvmHomeDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<EvmHomeSnapshot | null>(null);
  const [status, setStatus] = useState<EvmLiveStatus | null>(null);
  const [latestFeed, setLatestFeed] = useState<EvmLatestFeed | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(12_000);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef(12_000);
  const hasResolvedPollIntervalRef = useRef(false);
  const snapshotRef = useRef<EvmHomeSnapshot | null>(null);
  const hasValidatedCacheRef = useRef(false);

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
    const isEvmRoute = !pathname.startsWith("/cosmos");
    const isHomePage = pathname === "/";

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

    async function bootstrapHome() {
      const next = await getEvmHomeSnapshotDirect();
      const resolvedPollIntervalMs = resolvePollInterval(next.pollIntervalMs);

      if (disposed) {
        return;
      }

      setLatestFeed(null);
      snapshotRef.current = next;
      setSnapshot(next);
      setStatus({
        latestBlock: next.metrics.find((metric) => metric.label === "Latest Block")?.value ?? "Unavailable",
        latestBlockNumber: next.latestBlockNumber,
        latestBlockTime: next.metrics.find((metric) => metric.label === "Latest Block Time")?.value ?? "Unavailable",
        latestBlockTimestamp: next.latestBlockTimestamp,
        pollIntervalMs: resolvedPollIntervalMs,
      });
      setPollIntervalMs(resolvedPollIntervalMs);
      setErrorMessage(null);
      scheduleNextPoll(pollIntervalRef.current);
    }

    async function refreshHome() {
      const next = await getEvmHomeSnapshotDirect();

      if (disposed) {
        return;
      }

      const resolvedPollIntervalMs = resolvePollInterval(next.pollIntervalMs);

      setStatus({
        latestBlock: next.metrics.find((metric) => metric.label === "Latest Block")?.value ?? "Unavailable",
        latestBlockNumber: next.latestBlockNumber,
        latestBlockTime: next.metrics.find((metric) => metric.label === "Latest Block Time")?.value ?? "Unavailable",
        latestBlockTimestamp: next.latestBlockTimestamp,
        pollIntervalMs: resolvedPollIntervalMs,
      });
      snapshotRef.current = next;
      setSnapshot(next);
      setPollIntervalMs(resolvedPollIntervalMs);
      setErrorMessage(null);
      scheduleNextPoll(pollIntervalRef.current);
    }

    async function refreshStatus() {
      const next = await getEvmLatestFeedDirect(20, !hasResolvedPollIntervalRef.current);
      const resolvedPollIntervalMs = resolvePollInterval(next.pollIntervalMs);

      if (disposed) {
        return;
      }

      setLatestFeed({
        ...next,
        pollIntervalMs: resolvedPollIntervalMs,
      });
      setStatus({
        ...next,
        pollIntervalMs: resolvedPollIntervalMs,
      });
      setPollIntervalMs(resolvedPollIntervalMs);
      snapshotRef.current = null;
      setSnapshot(null);
      setErrorMessage(null);
      scheduleNextPoll(pollIntervalRef.current);
    }

    async function load() {
      try {
        if (!isEvmRoute) {
          setStatus(null);
          snapshotRef.current = null;
          setSnapshot(null);
          setLatestFeed(null);
          setErrorMessage(null);
          setPollIntervalMs(12_000);
          clearPoll();
          return;
        }

        if (!hasValidatedCacheRef.current) {
          await validateActiveEvmCacheDirect();
          hasValidatedCacheRef.current = true;
        }

        if (isHomePage) {
          if (!snapshotRef.current) {
            await bootstrapHome();
            return;
          }

          await refreshHome();
          return;
        }

        await refreshStatus();
      } catch (error) {
        if (disposed) {
          return;
        }

        setStatus(null);
        if (!isHomePage) {
          snapshotRef.current = null;
          setSnapshot(null);
        }
        setErrorMessage(error instanceof Error ? error.message : "Failed to load homepage activity.");
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
      snapshotRef.current = null;
      setSnapshot(null);
      setStatus(null);
      setLatestFeed(null);
      void load();
    };

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      disposed = true;
      clearPoll();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, [pathname]);

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
    throw new Error("useEvmHomeData must be used within EvmHomeDataProvider.");
  }

  return context;
}
