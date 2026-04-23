'use client';

import { IconAlertCircle, IconEye } from '@tabler/icons-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

type CosmosTransactionPreviewData = {
  hash: string;
  hashLabel: string;
  type: string;
  height: string;
  sender: string;
  target?: string | null;
  feeLabel: string;
  gasUsedLabel: string;
  gasWantedLabel: string;
  status: 'success' | 'failed';
  statusLabel: string;
  timeLabel?: string;
};

export function CosmosTransactionHashCell({ hash, hashLabel, status }: Pick<CosmosTransactionPreviewData, 'hash' | 'hashLabel' | 'status'>) {
  return (
    <div className="flex items-center gap-0.5">
      {status === 'failed' ? <IconAlertCircle className="size-5 shrink-0 text-rose-500" stroke={1.9} /> : null}
      <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${hash}`}>
        {hashLabel}
      </Link>
    </div>
  );
}

export function CosmosTransactionPreviewButton({ transaction }: { transaction: CosmosTransactionPreviewData }) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const panelWidth = 360;
      const panelHeight = 470;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredLeft = rect.right + 12;
      const fallbackLeft = rect.left - panelWidth - 12;
      const left = preferredLeft + panelWidth <= viewportWidth - 16 ? preferredLeft : Math.max(16, fallbackLeft);
      const centeredTop = rect.top + rect.height / 2 - panelHeight / 2;
      const top = Math.min(Math.max(16, centeredTop), Math.max(16, viewportHeight - panelHeight - 16));

      setPanelPosition({ top, left });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (containerRef.current && !containerRef.current.contains(target) && panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    updatePosition();
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Hide transaction preview' : 'Show transaction preview'}
        className={`inline-flex size-5 items-center justify-center transition ${open ? 'text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
        onClick={() => setOpen((current) => !current)}
      >
        <IconEye className="size-4.5" stroke={1.8} />
      </button>
      {open && panelPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[70] w-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
              style={{
                top: panelPosition.top,
                left: panelPosition.left,
              }}
            >
              <div className="border-b border-slate-200 pb-4">
                <p className="text-lg font-semibold text-slate-900">Additional Info</p>
              </div>

              <div className="space-y-2 py-2">
                <section className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                  <p className={transaction.status === 'failed' ? 'text-sm font-semibold text-rose-600' : 'text-sm font-semibold text-emerald-600'}>
                    {transaction.statusLabel}
                  </p>
                </section>
                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Type</p>
                  <p className="text-sm font-medium text-slate-900">{transaction.type}</p>
                </section>
                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Block</p>
                  <p className="text-sm font-medium text-slate-900">{transaction.height}</p>
                </section>
                {transaction.timeLabel ? (
                  <section className="space-y-1 border-t border-slate-200 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Timestamp</p>
                    <p className="text-sm font-medium text-slate-900">{transaction.timeLabel}</p>
                  </section>
                ) : null}
                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">From</p>
                  <p className="break-all font-mono text-sm text-slate-900">{transaction.sender}</p>
                </section>
                {transaction.target ? (
                  <section className="space-y-1 border-t border-slate-200 pt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">To</p>
                    <p className="break-all font-mono text-sm text-slate-900">{transaction.target}</p>
                  </section>
                ) : null}
                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Transaction Fee</p>
                  <p className="text-sm font-medium text-slate-900">{transaction.feeLabel}</p>
                </section>
                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Gas Info</p>
                  <p className="text-sm font-medium text-slate-900">
                    {transaction.gasUsedLabel} gas used from {transaction.gasWantedLabel} wanted
                  </p>
                </section>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <Link href={`/cosmos/tx/${transaction.hash}`} className="inline-flex items-center text-sm font-medium text-sky-600 transition hover:text-sky-700">
                  View Full Transaction
                </Link>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
