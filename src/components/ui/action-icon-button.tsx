'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ActionIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  wrapperClassName?: string;
};

export function ActionIconButton({
  tooltip,
  children,
  className,
  wrapperClassName,
  ...props
}: ActionIconButtonProps) {
  return (
    <span className={cn('group relative inline-flex', wrapperClassName)}>
      <button
        type="button"
        aria-label={props['aria-label'] ?? tooltip}
        className={cn(
          'inline-flex items-center justify-center p-[3px] transition',
          className,
        )}
        {...props}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition-opacity duration-0 group-hover:opacity-100 group-focus-within:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}
