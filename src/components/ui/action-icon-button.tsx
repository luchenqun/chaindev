'use client';

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ActionIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  wrapperClassName?: string;
  tooltipPlacement?: 'top' | 'bottom';
};

export function ActionIconButton({ tooltip, children, className, wrapperClassName, tooltipPlacement = 'top', ...props }: ActionIconButtonProps) {
  return (
    <span className={cn('group relative inline-flex', wrapperClassName)}>
      <button type="button" aria-label={props['aria-label'] ?? tooltip} className={cn('inline-flex items-center justify-center p-[3px] transition', className)} {...props}>
        {children}
      </button>
      <span
        className={cn(
          'pointer-events-none absolute left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] group-hover:block group-focus-within:block',
          tooltipPlacement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        )}
      >
        {tooltip}
      </span>
    </span>
  );
}
