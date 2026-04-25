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
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
};

export function FloatingTooltip({ open, anchorRef, children, preferredPlacement = 'top', className }: FloatingTooltipProps) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const placement = preferredPlacement === 'top' && rect.top > 44 ? 'top' : 'bottom';
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8;
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
        'pointer-events-none fixed z-[80] max-w-[min(320px,calc(100vw-32px))] rounded-xl px-3 py-2 text-xs font-medium shadow-[0_10px_30px_rgba(15,23,42,0.18)]',
        className,
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: position.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      {children}
    </span>,
    document.body,
  );
}
