'use client';

import { IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { useMessages } from '@/i18n/locale-provider';
import { cn } from '@/lib/utils';

type CosmosAddressLinkProps = {
  href: string;
  label: string;
  copyValue: string;
  className?: string;
  prefetch?: boolean;
};

export function CosmosAddressLink({ href, label, copyValue, className, prefetch }: CosmosAddressLinkProps) {
  const messages = useMessages();
  const [copied, setCopied] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [copyTooltipOpen, setCopyTooltipOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const tooltipCloseTimeoutRef = useRef<number | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }

      if (tooltipCloseTimeoutRef.current != null) {
        window.clearTimeout(tooltipCloseTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (tooltipCloseTimeoutRef.current != null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current);
      tooltipCloseTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (tooltipCloseTimeoutRef.current != null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current);
    }

    tooltipCloseTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      tooltipCloseTimeoutRef.current = null;
    }, 120);
  }

  async function handleCopy() {
    await copyText(copyValue);
    setCopied(true);
    setCopyTooltipOpen(true);

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      setCopyTooltipOpen(false);
      timeoutRef.current = null;
    }, 1600);
  }

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span className="min-w-0 max-w-full">
        <Link
          ref={linkRef}
          prefetch={prefetch}
          className={cn('block min-w-0 max-w-full truncate font-medium text-sky-600 hover:text-sky-700', className)}
          href={href}
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltipSoon}
          onFocus={openTooltip}
          onBlur={closeTooltipSoon}
        >
          {label}
        </Link>
        <FloatingTooltip
          open={tooltipOpen}
          anchorRef={linkRef}
          interactive
          onMouseEnter={openTooltip}
          onMouseLeave={closeTooltipSoon}
          className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
        >
          <span className="block select-text break-all">{copyValue}</span>
        </FloatingTooltip>
      </span>
      <span className="relative inline-flex shrink-0">
        <button
          ref={copyButtonRef}
          type="button"
          className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label={messages.common.copyAddress}
          onClick={() => void handleCopy()}
          onMouseEnter={() => setCopyTooltipOpen(true)}
          onMouseLeave={() => {
            if (!copied) {
              setCopyTooltipOpen(false);
            }
          }}
          onFocus={() => setCopyTooltipOpen(true)}
          onBlur={() => {
            if (!copied) {
              setCopyTooltipOpen(false);
            }
          }}
        >
          <IconCopy className="size-4" stroke={1.8} />
        </button>
        <FloatingTooltip open={copyTooltipOpen || copied} anchorRef={copyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
          <span className="block whitespace-nowrap">{copied ? messages.common.addressCopied : messages.common.copyAddress}</span>
        </FloatingTooltip>
      </span>
    </span>
  );
}
