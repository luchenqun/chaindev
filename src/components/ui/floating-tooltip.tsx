'use client';

import { createPortal } from 'react-dom';
import { type ReactNode, type RefObject, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type FloatingTooltipProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  preferredPlacement?: 'top' | 'bottom';
  className?: string;
  interactive?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

export function FloatingTooltip({
  open,
  anchorRef,
  children,
  preferredPlacement = 'top',
  className,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
}: FloatingTooltipProps) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const placement = preferredPlacement === 'top' && rect.top > 44 ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 4 : rect.bottom + 4;
    const left = Math.min(Math.max(16, rect.left + rect.width / 2), window.innerWidth - 16);

    setPosition({ top, left, placement });
  }, [anchorRef, preferredPlacement]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!open || !position || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <span
      className={cn(
        interactive ? 'pointer-events-auto select-text' : 'pointer-events-none',
        'fixed z-[80] flex max-w-[min(520px,calc(100vw-32px))] flex-col items-center',
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: position.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {position.placement === 'bottom' ? (
        <span className="-mb-px relative block h-[7px] w-[14px] overflow-hidden">
          <span className="absolute left-0 top-0 h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-slate-200" />
          <span className="absolute left-[1px] top-[1px] h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-white" />
        </span>
      ) : null}
      <span
        className={cn(
          'rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium shadow-[0_10px_30px_rgba(15,23,42,0.18)]',
          className,
        )}
      >
        {children}
      </span>
      {position.placement === 'top' ? (
        <span className="-mt-px relative block h-[7px] w-[14px] overflow-hidden">
          <span className="absolute left-0 top-0 h-0 w-0 border-x-[7px] border-t-[7px] border-x-transparent border-t-slate-200" />
          <span className="absolute left-[1px] top-0 h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-white" />
        </span>
      ) : null}
    </span>,
    document.body,
  );
}
