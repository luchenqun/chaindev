'use client';

import { useState } from 'react';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { useMessages } from '@/i18n/locale-provider';

type EvmPrivateKeyUnlockDialogProps = {
  open: boolean;
  password: string;
  errorMessage: string | null;
  submitting?: boolean;
  title?: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
};

export function useEvmPrivateKeyUnlockDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function openDialog() {
    setErrorMessage(null);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setPassword('');
    setErrorMessage(null);
  }

  function handleUnlockResolved() {
    setOpen(false);
    setPassword('');
    setErrorMessage(null);
  }

  return {
    open,
    password,
    errorMessage,
    setPassword,
    setErrorMessage,
    setOpen,
    openDialog,
    closeDialog,
    handleUnlockResolved,
  };
}

export function EvmPrivateKeyUnlockDialog({
  open,
  password,
  errorMessage,
  submitting = false,
  title,
  description,
  placeholder,
  confirmLabel,
  onOpenChange,
  onPasswordChange,
  onConfirm,
}: EvmPrivateKeyUnlockDialogProps) {
  const messages = useMessages();

  return (
    <SecretInputDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? messages.privateKeys.unlockPrivateKey}
      description={description ?? messages.privateKeys.unlockContinueDescription}
      value={password}
      onValueChange={onPasswordChange}
      placeholder={placeholder ?? messages.privateKeys.enterPassword}
      confirmLabel={confirmLabel ?? messages.privateKeys.unlock}
      confirmDisabled={!password.trim() || submitting}
      errorMessage={errorMessage}
      onConfirm={onConfirm}
    />
  );
}
