'use client';

import { usePathname } from 'next/navigation';
import { IconAntennaBars5, IconClockHour4, IconStack2, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { RollingCounter } from '@/components/ui/rolling-counter';
import { useCosmosHomeData } from '@/domains/cosmos/ui/home-data-provider';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { type PlatformMode } from '@/config/chains';
import { isCosmosRouteActive, type ActivePlatformMode } from '@/platform/workbench/home-route-state';
import { clearAllChaindevBrowserStorage } from '@/platform/workbench/site-storage-reset';

type StatusItem = {
  label: string;
  value: string;
  toneClassName?: string;
};

function buildFallbackItem(reason: string): StatusItem {
  return {
    label: 'Block',
    value: reason,
    toneClassName: 'text-slate-500',
  };
}

export function ChainStatusStrip({ mode }: { mode: PlatformMode }) {
  const pathname = usePathname();
  const activeMode = mode as ActivePlatformMode;
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearState, setClearState] = useState<'idle' | 'clearing' | 'done' | 'failed'>('idle');
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const { status, pollIntervalMs } = useEvmHomeData();
  const { snapshot: cosmosSnapshot, latestFeed: cosmosLatestFeed, connectionMode } = useCosmosHomeData();
  const displayItem = useMemo<StatusItem>(() => {
    if (mode === 'evm') {
      return status
        ? {
            label: 'Block',
            value: status.latestBlock,
            toneClassName: 'text-sky-600',
          }
        : buildFallbackItem('Unavailable');
    }

    if (isCosmosRouteActive(pathname, activeMode)) {
      if (cosmosLatestFeed) {
        return {
          label: 'Block',
          value: cosmosLatestFeed.latestBlock,
          toneClassName: 'text-sky-600',
        };
      }

      return cosmosSnapshot
        ? {
            label: 'Block',
            value: String(cosmosSnapshot.latestHeight),
            toneClassName: 'text-sky-600',
          }
        : buildFallbackItem('Unavailable');
    }

    return buildFallbackItem('Unavailable');
  }, [activeMode, cosmosLatestFeed, cosmosSnapshot, mode, pathname, status]);

  async function handleClearBrowserStorage() {
    setClearState('clearing');
    setClearMessage(null);

    try {
      await clearAllChaindevBrowserStorage();
      setClearState('done');
      setClearMessage('Local storage has been cleared. The page will reload.');
      window.setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      setClearState('failed');
      setClearMessage(error instanceof Error ? error.message : 'Failed to clear local storage.');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label="Clear local browser storage"
          className="flex h-7 flex-col items-center justify-center gap-0.5 rounded-md text-slate-400 transition hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          onClick={() => {
            setClearState('idle');
            setClearMessage(null);
            setClearDialogOpen(true);
          }}
        >
          <IconStack2 className="size-3.5" stroke={2} />
          {mode === 'evm' ? (
            <IconClockHour4 className="size-3" stroke={1.8} />
          ) : isCosmosRouteActive(pathname, activeMode) ? (
            <IconAntennaBars5 className="size-3" stroke={1.8} />
          ) : null}
        </button>
        <span className="flex flex-col gap-0.5 text-[13px] leading-none">
          <span className="inline-flex items-center gap-1.5">
            <span>{displayItem.label}</span>
            <strong className={displayItem.toneClassName ?? 'text-slate-800'}>
              <RollingCounter value={displayItem.value} />
            </strong>
          </span>
          {mode === 'evm' ? (
            <span className="inline-flex items-center gap-1.5">
              <span>Poll</span>
              <strong className={displayItem.toneClassName ?? 'text-slate-800'}>{Math.round(pollIntervalMs)} ms</strong>
            </span>
          ) : isCosmosRouteActive(pathname, activeMode) ? (
            <span className="inline-flex items-center gap-1.5">
              <span>Feed</span>
              <strong className={displayItem.toneClassName ?? 'text-slate-800'}>{connectionMode === 'ws' ? 'WebSocket' : 'HTTP Polling'}</strong>
            </span>
          ) : null}
        </span>
      </span>
      <ModalDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        title="Clear browser storage"
        description="Clear all local data stored in this browser for the current site."
        maxWidthClassName="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} disabled={clearState === 'clearing'}>
              Cancel
            </Button>
            <Button className="gap-2 bg-rose-600 hover:bg-rose-700" onClick={() => void handleClearBrowserStorage()} disabled={clearState === 'clearing'}>
              <IconTrash className="size-4" stroke={1.8} />
              {clearState === 'clearing' ? 'Clearing...' : 'Clear all'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm leading-6 text-slate-600">
          <p>This clears localStorage, sessionStorage, IndexedDB databases, Cache Storage, and browser-accessible cookies for this site.</p>
          <p>Provider defaults will be recreated after reload, and chain data will be fetched again from the active provider.</p>
          {clearMessage ? (
            <p className={clearState === 'failed' ? 'font-medium text-rose-600' : 'font-medium text-slate-800'}>{clearMessage}</p>
          ) : null}
        </div>
      </ModalDialog>
    </div>
  );
}
