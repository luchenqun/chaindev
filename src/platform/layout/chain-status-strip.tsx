'use client';

import { usePathname } from 'next/navigation';
import { IconClockHour4, IconStack2 } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { type PlatformMode } from '@/config/chains';
import {
  isCosmosRouteActive,
  type ActivePlatformMode,
} from '@/platform/workbench/home-route-state';

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
  const pathname = usePathname();
  const activeMode = mode as ActivePlatformMode;
  const { status, pollIntervalMs } = useEvmHomeData();
  const { snapshot: cosmosSnapshot, latestFeed: cosmosLatestFeed } =
    useCosmosHomeData();
  const displayItem = useMemo<StatusItem>(() => {
    if (mode === 'evm') {
      return status
        ? {
            label: 'Latest Block',
            value: status.latestBlock,
            toneClassName: 'text-sky-600',
          }
        : buildFallbackItem('Unavailable');
    }

    if (isCosmosRouteActive(pathname, activeMode)) {
      if (cosmosLatestFeed) {
        return {
          label: 'Latest Block',
          value: cosmosLatestFeed.latestBlock,
          toneClassName: 'text-sky-600',
        };
      }

      return cosmosSnapshot
        ? {
            label: 'Latest Block',
            value: String(cosmosSnapshot.latestHeight),
            toneClassName: 'text-sky-600',
          }
        : buildFallbackItem('Unavailable');
    }

    return buildFallbackItem('Unavailable');
  }, [activeMode, cosmosLatestFeed, cosmosSnapshot, mode, pathname, status]);

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
            <span>{displayItem.label}:</span>
            <strong className={displayItem.toneClassName ?? 'text-slate-800'}>
              {displayItem.value}
            </strong>
          </span>
          {mode === 'evm' ? (
            <span className="mt-0.5 inline-flex items-center gap-1.5">
              <span>Poll:</span>
              <strong
                className={displayItem.toneClassName ?? 'text-slate-800'}
              >
                {Math.round(pollIntervalMs)} ms
              </strong>
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}
