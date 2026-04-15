'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SecretInputDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
};

export function SecretInputDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onValueChange,
  placeholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  errorMessage,
  onConfirm,
}: SecretInputDialogProps) {
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
      <button
        type="button"
        aria-label="Close secret input dialog"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.24)]">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-5">
          <Input
            autoFocus
            type="password"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
          />
          {errorMessage ? (
            <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
