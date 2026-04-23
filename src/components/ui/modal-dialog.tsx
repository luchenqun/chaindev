'use client';

import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

type ModalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
};

export function ModalDialog({ open, onOpenChange, title, description, children, footer, maxWidthClassName = 'max-w-2xl' }: ModalDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-slate-900/45" onClick={() => onOpenChange(false)} />
      <div
        className={`relative z-10 flex max-h-[calc(100vh-5rem)] w-full flex-col overflow-hidden ${maxWidthClassName} rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)]`}
      >
        <div className="shrink-0 px-6 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-6">{children}</div>
        {footer ? (
          <div className="mt-5 shrink-0 border-t border-slate-200 px-6 py-4">
            <div className="flex justify-end gap-2">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
