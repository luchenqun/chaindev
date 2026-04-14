"use client";

import { IconCopy } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AddressLinkProps = {
  address: string;
  href: string;
  label: string;
  className?: string;
  tooltipClassName?: string;
  showCopyButton?: boolean;
};

export function AddressLink({
  address,
  href,
  label,
  className,
  tooltipClassName,
  showCopyButton = true,
}: AddressLinkProps) {
  void tooltipClassName;
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
      await navigator.clipboard.writeText(address);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = address;
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
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="group relative inline-flex max-w-full">
        <Link className={className} href={href}>
          {label}
        </Link>
      </span>
      {showCopyButton ? (
        <span className="relative inline-flex">
          <button
            type="button"
            className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
            aria-label="Copy address"
            onClick={() => void handleCopy()}
          >
            <IconCopy className="size-4" stroke={1.8} />
          </button>
          <span
            className={cn(
              "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 opacity-0 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity",
              copied ? "opacity-100" : "",
            )}
          >
            <span className="block whitespace-nowrap">Copied!</span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
