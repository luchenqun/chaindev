'use client';

import { IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { cn } from '@/lib/utils';

type AddressLinkProps = {
  address: string;
  href: string;
  label: string;
  className?: string;
  tooltipClassName?: string;
  showCopyButton?: boolean;
};

export function AddressLink({ address, href, label, className, tooltipClassName, showCopyButton = true }: AddressLinkProps) {
  void tooltipClassName;
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
    await copyText(address);
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
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span className="group relative inline-flex min-w-0 max-w-full">
        <Link className={cn('min-w-0 truncate', className)} href={href}>
          {label}
        </Link>
      </span>
      {showCopyButton ? (
        <span className="relative inline-flex">
          <button
            ref={copyButtonRef}
            type="button"
            className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
            aria-label="Copy address"
            onClick={() => void handleCopy()}
          >
            <IconCopy className="size-4" stroke={1.8} />
          </button>
          <FloatingTooltip open={copied} anchorRef={copyButtonRef} className={cn('whitespace-nowrap border border-slate-200 bg-white text-slate-700')}>
            <span className="block whitespace-nowrap">Copied!</span>
          </FloatingTooltip>
        </span>
      ) : null}
    </span>
  );
}
