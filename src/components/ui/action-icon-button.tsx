'use client';

import { createPortal } from 'react-dom';
import { type ButtonHTMLAttributes, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ActionIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  children: ReactNode;
  wrapperClassName?: string;
  tooltipPlacement?: 'top' | 'bottom';
};

export function ActionIconButton({ tooltip, children, className, wrapperClassName, tooltipPlacement = 'top', ...props }: ActionIconButtonProps) {
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom';
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const updateTooltipPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const placement = tooltipPlacement === 'top' && rect.top > 44 ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2), window.innerWidth - 16);

    setTooltipPosition({ top, left, placement });
  }, [tooltipPlacement]);

  function handleShowTooltip() {
    updateTooltipPosition();
  }

  function handleHideTooltip() {
    setTooltipPosition(null);
  }

  useEffect(() => {
    if (!tooltipPosition) {
      return;
    }

    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
    };
  }, [tooltipPosition, updateTooltipPosition]);

  return (
    <>
      <span className={cn('relative inline-flex', wrapperClassName)}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={props['aria-label'] ?? tooltip}
          className={cn('inline-flex items-center justify-center p-[3px] transition', className)}
          onBlur={handleHideTooltip}
          onFocus={handleShowTooltip}
          onMouseEnter={handleShowTooltip}
          onMouseLeave={handleHideTooltip}
          {...props}
        >
          {children}
        </button>
      </span>
      {tooltipPosition && typeof document !== 'undefined'
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[80] max-w-[min(320px,calc(100vw-32px))] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
              style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: tooltipPosition.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              }}
            >
              {tooltip}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
