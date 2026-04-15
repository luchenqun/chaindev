"use client";

import { IconAlertCircle, IconArrowUpRight, IconCopy, IconEye } from "@tabler/icons-react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

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
  if (status === "success") {
    return "text-emerald-600";
  }

  if (status === "reverted") {
    return "text-rose-600";
  }

  return "text-slate-500";
}

export function TransactionHashCell(props: TransactionPreviewData) {
  const { hash, hashLabel, receiptStatus } = props;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = hash;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

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
    <div className="flex items-center gap-0.5">
      {receiptStatus === "reverted" ? (
        <IconAlertCircle className="size-5 shrink-0 text-rose-500" stroke={1.9} />
      ) : null}
      <div className="relative inline-flex items-center gap-1.5">
        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${hash}`}>
          {hashLabel}
        </Link>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label="Copy transaction hash"
          onClick={() => void handleCopy()}
        >
          <IconCopy className="size-4" stroke={1.8} />
        </button>
        <span
          className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="block whitespace-nowrap">Copied!</span>
        </span>
      </div>
    </div>
  );
}

export function TransactionPreviewButton(props: {
  transaction: TransactionPreviewData;
  methodLabel: string;
}) {
  const { transaction, methodLabel } = props;
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);
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
      const left =
        preferredLeft + panelWidth <= viewportWidth - 16
          ? preferredLeft
          : Math.max(16, fallbackLeft);
      const centeredTop = rect.top + rect.height / 2 - panelHeight / 2;
      const top = Math.min(
        Math.max(16, centeredTop),
        Math.max(16, viewportHeight - panelHeight - 16),
      );

      setPanelPosition({ top, left });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updatePosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? "Hide transaction preview" : "Show transaction preview"}
        className={`inline-flex size-5 items-center justify-center transition ${
          open ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <IconEye className="size-4.5" stroke={1.8} />
      </button>
      {open && panelPosition && typeof document !== "undefined"
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
                <p className="text-lg font-semibold text-slate-900">Additional Info</p>
              </div>

              <div className="space-y-2 py-2">
                <section className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Status</p>
                  <p className={`text-sm font-semibold ${getCachedStatusClasses(transaction.receiptStatus)}`}>
                    {transaction.receiptStatusLabel ?? "Unavailable"}
                  </p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Method</p>
                  <p className="text-sm font-medium text-slate-900">{methodLabel}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Transaction Fee</p>
                  <p className="text-sm font-medium text-slate-900">{transaction.feeLabel ?? "Unavailable"}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Gas Info</p>
                  <p className="text-sm font-medium text-slate-900">
                    {transaction.gasUsedLabel ?? "Unavailable"} gas used from {transaction.gasLimitLabel ?? "Unavailable"} limit
                  </p>
                  <p className="text-xs text-slate-500">@ {transaction.effectiveGasPriceLabel ?? "Unavailable"}</p>
                </section>

                <section className="space-y-1 border-t border-slate-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nonce</p>
                  <p className="text-sm font-medium text-slate-900">{transaction.nonceLabel ?? "Unavailable"}</p>
                </section>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                  href={`/evm/tx/${transaction.hash}`}
                >
                  See more details
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
