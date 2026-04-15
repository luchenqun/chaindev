'use client';

import { IconClockHour4, IconStack2 } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { getCosmosOverviewDirect } from '@/domains/cosmos/client/queries';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { type PlatformMode } from '@/config/chains';

type StatusItem = {
  label: string;
  value: string;
  toneClassName?: string;
};

function buildFallbackItem(reason: string): StatusItem {
  return {
    label: 'Latest Block',
    value: reason,
    toneClassName: 'text-slate-500',
  };
}

export function ChainStatusStrip({ mode }: { mode: PlatformMode }) {
  const { status, pollIntervalMs } = useEvmHomeData();
  const [item, setItem] = useState<StatusItem>(() =>
    buildFallbackItem('Unavailable'),
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (mode === 'evm') {
      setItem(
        status
          ? {
              label: 'Latest Block',
              value: status.latestBlock,
              toneClassName: 'text-sky-600',
            }
          : buildFallbackItem('Unavailable'),
      );
      return;
    }

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

    async function load() {
      try {
        if (mode === 'cosmos') {
          const overview = await getCosmosOverviewDirect();

          if (cancelled) {
            return;
          }

          setItem({
            label: 'Latest Block',
            value: overview.latestHeight,
            toneClassName: 'text-sky-600',
          });
          scheduleNextPoll(6_000);
          return;
        }
      } catch {
        if (!cancelled) {
          setItem(buildFallbackItem('Unavailable'));
        }

        scheduleNextPoll(12_000);
      }
    }

    void load();

    const reload = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', reload);

    return () => {
      cancelled = true;
      clearPoll();
      window.removeEventListener('chaindev:active-rpc-profile-changed', reload);
    };
  }, [mode, status]);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <span className="inline-flex items-start gap-2">
        <span className="flex flex-col gap-0.5 pt-[1px]">
          <IconStack2 className="size-3.5 text-slate-400" stroke={2} />
          {mode === 'evm' ? (
            <IconClockHour4 className="size-3 text-slate-400" stroke={1.8} />
          ) : null}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="inline-flex items-center gap-1.5">
            <span>{item.label}:</span>
            <strong className={item.toneClassName ?? 'text-slate-800'}>
              {item.value}
            </strong>
          </span>
          {mode === 'evm' ? (
            <span className="mt-0.5 inline-flex items-center gap-1.5">
              <span>Poll:</span>
              <strong className={item.toneClassName ?? 'text-slate-800'}>
                {Math.round(pollIntervalMs)} ms
              </strong>
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}
