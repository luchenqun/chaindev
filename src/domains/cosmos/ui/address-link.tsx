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
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      <span className="min-w-0 max-w-full">
        <Link
          prefetch={prefetch}
          className={cn('block min-w-0 max-w-full truncate font-medium text-sky-600 hover:text-sky-700', className)}
          href={href}
          title={label}
        >
          {label}
        </Link>
      </span>
      <span className="relative inline-flex shrink-0">
        <button
          ref={copyButtonRef}
          type="button"
          className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label={messages.common.copyAddress}
          onClick={() => void handleCopy()}
        >
          <IconCopy className="size-4" stroke={1.8} />
        </button>
        <FloatingTooltip open={copied} anchorRef={copyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
          <span className="block whitespace-nowrap">{messages.common.addressCopied}</span>
        </FloatingTooltip>
      </span>
    </span>
  );
}
