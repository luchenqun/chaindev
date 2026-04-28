'use client';

import { IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { cn } from '@/lib/utils';

type CosmosAddressLinkProps = {
  href: string;
  label: string;
  copyValue: string;
  className?: string;
  prefetch?: boolean;
};

export function CosmosAddressLink({ href, label, copyValue, className, prefetch }: CosmosAddressLinkProps) {
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
    await copyText(copyValue);
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
      <Link prefetch={prefetch} className={cn('font-medium text-sky-600 hover:text-sky-700', className)} href={href}>
        {label}
      </Link>
      <span className="relative inline-flex shrink-0">
        <button
          ref={copyButtonRef}
          type="button"
          className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label="Copy address"
          onClick={() => void handleCopy()}
        >
          <IconCopy className="size-4" stroke={1.8} />
        </button>
        <FloatingTooltip open={copied} anchorRef={copyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
          <span className="block whitespace-nowrap">Copied!</span>
        </FloatingTooltip>
      </span>
    </span>
  );
}
