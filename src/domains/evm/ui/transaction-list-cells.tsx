'use client';

import { IconAlertCircle, IconArrowUpRight, IconCopy, IconEye } from '@tabler/icons-react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';

export type TransactionPreviewData = {
  hash: string;
  hashLabel: string;
  receiptStatus?: string;
  receiptStatusLabel?: string;
  feeLabel?: string;
  gasUsedLabel?: string;
  gasLimitLabel?: string;
  effectiveGasPriceLabel?: string;
  nonceLabel?: string;
};

function getCachedStatusClasses(status?: string) {
  if (status === 'success') {
    return 'text-emerald-600';
  }

  if (status === 'reverted') {
    return 'text-rose-600';
  }

  return 'text-slate-500';
}

export function TransactionHashCell(props: TransactionPreviewData) {
  const messages = useMessages();
  const txMessages = messages.cosmosTxDetail;
  const { hash, hashLabel, receiptStatus } = props;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await copyText(hash);
    setCopied(true);

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 1600);
  }

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      {receiptStatus === 'reverted' ? <IconAlertCircle className="size-5 shrink-0 text-rose-500" stroke={1.9} /> : null}
      <div className="relative inline-flex min-w-0 items-center gap-1.5">
        <Link prefetch={false} className="truncate font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${hash}`}>
          {hashLabel}
        </Link>
        <button
          ref={copyButtonRef}
          type="button"
          className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label={txMessages.copyTransactionHash}
          onClick={() => void handleCopy()}
        >
          <IconCopy className="size-4" stroke={1.8} />
        </button>
        <FloatingTooltip open={copied} anchorRef={copyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
          <span className="block whitespace-nowrap">{messages.common.copied}</span>
        </FloatingTooltip>
      </div>
    </div>
  );
}

export function TransactionMethodBadge({ methodLabel }: { methodLabel: string }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex w-full max-w-[150px] min-w-0 items-center justify-start rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
        aria-label={methodLabel}
        tabIndex={0}
        onBlur={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(true)}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        <span className="block min-w-0 truncate">{methodLabel}</span>
      </span>
      <FloatingTooltip open={tooltipOpen} anchorRef={triggerRef} className="max-w-[420px] break-words border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium leading-4 text-slate-700">
        {methodLabel}
      </FloatingTooltip>
    </>
  );
}

export function TransactionPreviewButton(props: { transaction: TransactionPreviewData; methodLabel: string }) {
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const { transaction, methodLabel } = props;
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
      const panelWidth = 340;
      const panelHeight = 420;
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
        aria-label={open ? txMessages.hideTransactionPreview : txMessages.showTransactionPreview}
        className={`inline-flex size-5 items-center justify-center transition ${open ? 'text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}
        onClick={() => setOpen((current) => !current)}
      >
        <IconEye className="size-4.5" stroke={1.8} />
      </button>
      {open && panelPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[70] w-[340px] rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
              style={{
                top: panelPosition.top,
                left: panelPosition.left,
              }}
            >
              <div className="border-b border-slate-200 pb-4">
                <p className="text-lg font-semibold text-slate-900">{txMessages.additionalInfo}</p>
              </div>

              <div className="space-y-2 py-2">
                <section className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.status}</p>
                  <p className={`text-sm font-semibold ${getCachedStatusClasses(transaction.receiptStatus)}`}>
                    {translateRuntimeText(transaction.receiptStatusLabel ?? messages.common.unavailable, locale)}
                  </p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.method}</p>
                  <p className="text-sm font-medium text-slate-900">{methodLabel}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.transactionFee}</p>
                  <p className="text-sm font-medium text-slate-900">{translateRuntimeText(transaction.feeLabel ?? messages.common.unavailable, locale)}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.gasInfo}</p>
                  <p className="text-sm font-medium text-slate-900">
                    {txMessages.gasInfoSummary
                      .replace('{used}', translateRuntimeText(transaction.gasUsedLabel ?? messages.common.unavailable, locale))
                      .replace('{wanted}', translateRuntimeText(transaction.gasLimitLabel ?? messages.common.unavailable, locale))}
                  </p>
                  <p className="text-xs text-slate-500">@ {translateRuntimeText(transaction.effectiveGasPriceLabel ?? messages.common.unavailable, locale)}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.nonce}</p>
                  <p className="text-sm font-medium text-slate-900">{translateRuntimeText(transaction.nonceLabel ?? messages.common.unavailable, locale)}</p>
                </section>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <Link prefetch={false} className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 transition hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                  {messages.navigation.more}
                  <IconArrowUpRight className="size-3.5 text-slate-400" stroke={1.8} />
                </Link>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
