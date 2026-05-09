'use client';

import { type ButtonHTMLAttributes, type ReactNode, useRef, useState } from 'react';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { cn } from '@/lib/utils';

type ActionIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  wrapperClassName?: string;
  tooltipPlacement?: 'top' | 'bottom';
};

export function ActionIconButton({ tooltip, children, className, wrapperClassName, tooltipPlacement = 'top', ...props }: ActionIconButtonProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function handleShowTooltip() {
    setTooltipOpen(true);
  }

  function handleHideTooltip() {
    setTooltipOpen(false);
  }

  return (
    <>
      <span className={cn('relative inline-flex', wrapperClassName)}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={props['aria-label'] ?? tooltip}
          className={cn('inline-flex items-center justify-center p-[3px] transition', className)}
          onClick={(event) => {
            handleHideTooltip();
            props.onClick?.(event);
          }}
          onBlur={handleHideTooltip}
          onFocus={handleShowTooltip}
          onMouseEnter={handleShowTooltip}
          onMouseLeave={handleHideTooltip}
          {...props}
        >
          {children}
        </button>
        <FloatingTooltip
          open={tooltipOpen}
          anchorRef={buttonRef}
          preferredPlacement={tooltipPlacement}
          className="whitespace-nowrap border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
        >
          {tooltip}
        </FloatingTooltip>
      </span>
    </>
  );
}
