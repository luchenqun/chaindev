'use client';

import { IconCoins, IconFilePlus, IconMessageUp, IconRefresh, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import {
  getActiveCosmosAccountPrefixDirect,
  depositCosmosProposal,
  submitCosmosGovProposal,
  voteCosmosProposal,
  type CosmosProposalVoteOption,
  type CosmosSigningAlgorithm,
} from '@/domains/cosmos/client/signing-transactions';
import { getCosmosProposalsDirect } from '@/domains/cosmos/client/queries';
import { formatCompactHash } from '@/domains/cosmos/client/tx-helpers';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { formatTimestampWithSeconds } from '@/domains/cosmos/ui/detail-primitives';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const textareaClassName =
  'min-h-[96px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50';
const VOTE_OPTIONS: Array<{ value: CosmosProposalVoteOption; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'no_with_veto', label: 'No with veto' },
  { value: 'abstain', label: 'Abstain' },
];
const INTEGER_SCALE_OPTIONS = [6, 9, 12, 15, 18] as const;

type ProposalsPageData = Awaited<ReturnType<typeof getCosmosProposalsDirect>>;
type ProposalItem = ProposalsPageData['proposals'][number];

function scaleDecimalByPowerOfTen(rawValue: string, exponent: number) {
  const value = rawValue.trim() || '1';

  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  const digits = `${wholePart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalShift = exponent - fractionPart.length;

  if (decimalShift >= 0) {
    return `${digits}${'0'.repeat(decimalShift)}`;
  }

  const splitIndex = digits.length + decimalShift;

  if (splitIndex > 0) {
    return `${digits.slice(0, splitIndex)}.${digits.slice(splitIndex)}`.replace(/\.?0+$/, '');
  }

  return `0.${'0'.repeat(Math.abs(splitIndex))}${digits}`.replace(/\.?0+$/, '');
}

function ScaledInput({
  id,
  value,
  placeholder,
  disabled,
  inputMode = 'numeric',
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  inputMode?: 'numeric' | 'decimal';
  onChange: (value: string) => void;
}) {
  const [scaleSelectResetVersion, setScaleSelectResetVersion] = useState(0);
  const hasValue = Boolean(value.trim());

  function applyScale(exponent: number) {
    const scaledValue = scaleDecimalByPowerOfTen(value, exponent);

    if (scaledValue) {
      onChange(scaledValue);
    }

    setScaleSelectResetVersion((current) => current + 1);
  }

  return (
    <div className="relative">
      <Input id={id} value={value} inputMode={inputMode} placeholder={placeholder} disabled={disabled} className="pr-[132px]" onChange={(event) => onChange(event.target.value)} />
      {hasValue ? (
        <button
          type="button"
          className="absolute right-[82px] top-1/2 inline-flex -translate-y-1/2 items-center justify-center p-0 text-slate-400 transition hover:text-slate-700"
          onClick={() => onChange('')}
          aria-label="Clear input"
          disabled={disabled}
        >
          <IconX className="size-4" stroke={1.8} />
        </button>
      ) : null}
      <Select key={`scale-${id}-${scaleSelectResetVersion}`} disabled={disabled} onValueChange={(nextValue) => applyScale(Number(nextValue))}>
        <SelectTrigger className="absolute right-1.5 top-1/2 h-[30px] w-[74px] -translate-y-1/2 rounded-xl border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-700 shadow-none">
          <SelectValue placeholder="Scale" />
        </SelectTrigger>
        <SelectContent align="end">
          {INTEGER_SCALE_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {`x10^${option}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === 'PROPOSAL_STATUS_PASSED'
      ? 'inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
      : status === 'PROPOSAL_STATUS_REJECTED' || status === 'PROPOSAL_STATUS_FAILED'
        ? 'inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700'
        : status === 'PROPOSAL_STATUS_VOTING_PERIOD'
          ? 'inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'
          : 'inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600';

  return <span className={className}>{label}</span>;
}

function isVotingProposal(proposal: ProposalItem) {
  return proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' && /^[1-9]\d*$/.test(proposal.id);
}

function isDepositProposal(proposal: ProposalItem) {
  return proposal.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD' && /^[1-9]\d*$/.test(proposal.id);
}

function SubmitProposalDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [metadata, setMetadata] = useState('');
  const [messagesJson, setMessagesJson] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDenom, setDepositDenom] = useState('');
  const [accountPrefix, setAccountPrefix] = useState('cosmos');
  const [gasPriceAmount, setGasPriceAmount] = useState('');
  const [gasPriceDenom, setGasPriceDenom] = useState('');
  const [signingAlgorithm, setSigningAlgorithm] = useState<CosmosSigningAlgorithm>('ethsecp256k1');
  const [memo, setMemo] = useState('');
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }

    setTitle('');
    setSummary('');
    setMetadata('');
    setMessagesJson('');
    setDepositAmount('');
    setDepositDenom('');
    setAccountPrefix('cosmos');
    setGasPriceAmount('');
    setGasPriceDenom('');
    setSigningAlgorithm('ethsecp256k1');
    setMemo('');
    setFormError(null);
    setUnlockPassword('');
    setUnlockError(null);
    let cancelled = false;

    async function loadAccountPrefix() {
      const nextPrefix = await getActiveCosmosAccountPrefixDirect();

      if (!cancelled) {
        setAccountPrefix(nextPrefix);
      }
    }

    void loadAccountPrefix();

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submitProposal(password?: string) {
    if (!activeKey) {
      setFormError('Select a global private key first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const result = await submitCosmosGovProposal({
        privateKey,
        accountPrefix,
        signingAlgorithm,
        title,
        summary,
        metadata,
        messagesJson,
        depositAmount,
        depositDenom,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
      });

      showToast({
        title: 'Proposal transaction broadcasted',
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500" title={title}>
              {title}
            </span>
            <span className="block truncate font-mono text-xs text-slate-500" title={result.delegatorAddress}>
              {formatCompactHash(result.delegatorAddress, 12, 8)}
            </span>
            <Link
              className="mt-1 block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700"
              href={`/cosmos/tx/${result.transactionHash}`}
              title={result.transactionHash}
            >
              {formatCompactHash(result.transactionHash, 14, 10)}
            </Link>
          </span>
        ),
        durationMs: 8000,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to broadcast proposal transaction.';

      if (message === 'Password is required.') {
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmUnlock() {
    if (!activeKey) {
      return;
    }

    try {
      setUnlockError(null);
      await resolveEvmStoredPrivateKey(activeKey.id, unlockPassword);
      setUnlockDialogOpen(false);
      const password = unlockPassword;
      setUnlockPassword('');
      await submitProposal(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock private key.');
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title="Submit Proposal"
        description="Broadcast a Cosmos SDK gov v1 proposal with the active private key."
        maxWidthClassName="max-w-2xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitProposal()}>
              {submitting ? 'Submitting...' : 'Submit Proposal'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Proposal Type</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Gov v1 Proposal</p>
              <p className="mt-1 text-xs text-slate-500">Messages are encoded into proposal Any messages.</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Key</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : 'No active key'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-title">
              Title
            </label>
            <Input id="submit-proposal-title" value={title} placeholder="Proposal title" disabled={submitting} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-summary">
              Summary
            </label>
            <AutoGrowTextarea
              id="submit-proposal-summary"
              value={summary}
              placeholder="Summarize the proposal."
              disabled={submitting}
              className={textareaClassName}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-messages">
              Messages JSON
            </label>
            <AutoGrowTextarea
              id="submit-proposal-messages"
              value={messagesJson}
              placeholder={'[{"typeUrl":"/cosmos.bank.v1beta1.MsgSend","value":{"fromAddress":"cosmos1...","toAddress":"cosmos1...","amount":[{"denom":"uatom","amount":"1"}]}}]'}
              disabled={submitting}
              className={`${textareaClassName} font-mono text-xs`}
              onChange={(event) => setMessagesJson(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-deposit-amount">
                Initial deposit amount
              </label>
              <ScaledInput
                id="submit-proposal-deposit-amount"
                value={depositAmount}
                placeholder="10000000"
                disabled={submitting}
                onChange={setDepositAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-deposit-denom">
                Deposit denom
              </label>
              <Input id="submit-proposal-deposit-denom" value={depositDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setDepositDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-gas-price-amount">
                Gas price amount
              </label>
              <ScaledInput
                id="submit-proposal-gas-price-amount"
                value={gasPriceAmount}
                inputMode="decimal"
                placeholder="0.025"
                disabled={submitting}
                onChange={setGasPriceAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-gas-denom">
                Gas denom
              </label>
              <Input id="submit-proposal-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-signing">
                Signing
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="submit-proposal-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-metadata">
                Metadata
              </label>
              <Input id="submit-proposal-metadata" value={metadata} placeholder="Optional" disabled={submitting} onChange={(event) => setMetadata(event.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-memo">
              Memo
            </label>
            <Input id="submit-proposal-memo" value={memo} placeholder="Optional" disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
          </div>

          {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        </div>
      </ModalDialog>
      <SecretInputDialog
        open={unlockDialogOpen}
        onOpenChange={(nextOpen) => {
          setUnlockDialogOpen(nextOpen);

          if (!nextOpen) {
            setUnlockPassword('');
            setUnlockError(null);
          }
        }}
        title="Unlock Private Key"
        description={activeKey ? `Enter the password for "${activeKey.name}" to continue the submit proposal transaction.` : 'Enter the password to continue.'}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder="Password"
        confirmLabel="Unlock"
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

function DepositProposalDialog({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: {
  proposal: ProposalItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [accountPrefix, setAccountPrefix] = useState('cosmos');
  const [amount, setAmount] = useState('');
  const [denom, setDenom] = useState('');
  const [gasPriceAmount, setGasPriceAmount] = useState('');
  const [gasPriceDenom, setGasPriceDenom] = useState('');
  const [signingAlgorithm, setSigningAlgorithm] = useState<CosmosSigningAlgorithm>('ethsecp256k1');
  const [memo, setMemo] = useState('');
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }

    setAccountPrefix('cosmos');
    setAmount('');
    setDenom('');
    setGasPriceAmount('');
    setGasPriceDenom('');
    setSigningAlgorithm('ethsecp256k1');
    setMemo('');
    setFormError(null);
    setUnlockPassword('');
    setUnlockError(null);
    let cancelled = false;

    async function loadAccountPrefix() {
      const nextPrefix = await getActiveCosmosAccountPrefixDirect();

      if (!cancelled) {
        setAccountPrefix(nextPrefix);
      }
    }

    void loadAccountPrefix();

    return () => {
      cancelled = true;
    };
  }, [open, proposal?.id]);

  async function submitDeposit(password?: string) {
    if (!proposal) {
      return;
    }

    if (!activeKey) {
      setFormError('Select a global private key first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const result = await depositCosmosProposal({
        privateKey,
        accountPrefix,
        signingAlgorithm,
        proposalId: proposal.id,
        amount,
        denom,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
      });

      showToast({
        title: 'Deposit transaction broadcasted',
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500">
              {`Proposal #${proposal.id} · ${amount.trim()}${denom.trim()}`}
            </span>
            <span className="block truncate font-mono text-xs text-slate-500" title={result.delegatorAddress}>
              {formatCompactHash(result.delegatorAddress, 12, 8)}
            </span>
            <Link
              className="mt-1 block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700"
              href={`/cosmos/tx/${result.transactionHash}`}
              title={result.transactionHash}
            >
              {formatCompactHash(result.transactionHash, 14, 10)}
            </Link>
          </span>
        ),
        durationMs: 8000,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to broadcast deposit transaction.';

      if (message === 'Password is required.') {
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmUnlock() {
    if (!activeKey) {
      return;
    }

    try {
      setUnlockError(null);
      await resolveEvmStoredPrivateKey(activeKey.id, unlockPassword);
      setUnlockDialogOpen(false);
      const password = unlockPassword;
      setUnlockPassword('');
      await submitDeposit(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock private key.');
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title="Deposit to Proposal"
        description="Broadcast a governance deposit with the active private key."
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting || !proposal} onClick={() => void submitDeposit()}>
              {submitting ? 'Depositing...' : 'Deposit'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Proposal</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={proposal?.title ?? undefined}>
                {proposal ? `#${proposal.id}. ${proposal.title}` : '-'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{proposal?.statusLabel ?? '-'}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Key</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : 'No active key'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-amount">
                Deposit amount
              </label>
              <ScaledInput id="proposal-deposit-amount" value={amount} placeholder="10000000" disabled={submitting} onChange={setAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-denom">
                Deposit denom
              </label>
              <Input id="proposal-deposit-denom" value={denom} placeholder="uatom" disabled={submitting} onChange={(event) => setDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-gas-price-amount">
                Gas price amount
              </label>
              <ScaledInput
                id="proposal-deposit-gas-price-amount"
                value={gasPriceAmount}
                inputMode="decimal"
                placeholder="0.025"
                disabled={submitting}
                onChange={setGasPriceAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-gas-denom">
                Gas denom
              </label>
              <Input id="proposal-deposit-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-signing">
                Signing
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="proposal-deposit-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-memo">
                Memo
              </label>
              <Input id="proposal-deposit-memo" value={memo} placeholder="Optional" disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
            </div>
          </div>

          {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        </div>
      </ModalDialog>
      <SecretInputDialog
        open={unlockDialogOpen}
        onOpenChange={(nextOpen) => {
          setUnlockDialogOpen(nextOpen);

          if (!nextOpen) {
            setUnlockPassword('');
            setUnlockError(null);
          }
        }}
        title="Unlock Private Key"
        description={activeKey ? `Enter the password for "${activeKey.name}" to continue the deposit transaction.` : 'Enter the password to continue.'}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder="Password"
        confirmLabel="Unlock"
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

function VoteProposalDialog({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: {
  proposal: ProposalItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [accountPrefix, setAccountPrefix] = useState('cosmos');
  const [voteOption, setVoteOption] = useState<CosmosProposalVoteOption>('yes');
  const [gasPriceAmount, setGasPriceAmount] = useState('');
  const [gasPriceDenom, setGasPriceDenom] = useState('');
  const [signingAlgorithm, setSigningAlgorithm] = useState<CosmosSigningAlgorithm>('ethsecp256k1');
  const [memo, setMemo] = useState('');
  const [metadata, setMetadata] = useState('');
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const selectedVoteLabel = VOTE_OPTIONS.find((option) => option.value === voteOption)?.label ?? 'Vote';

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setFormError(null);
      return;
    }

    setAccountPrefix('cosmos');
    setVoteOption('yes');
    setGasPriceAmount('');
    setGasPriceDenom('');
    setSigningAlgorithm('ethsecp256k1');
    setMemo('');
    setMetadata('');
    setFormError(null);
    setUnlockPassword('');
    setUnlockError(null);
    let cancelled = false;

    async function loadAccountPrefix() {
      const nextPrefix = await getActiveCosmosAccountPrefixDirect();

      if (!cancelled) {
        setAccountPrefix(nextPrefix);
      }
    }

    void loadAccountPrefix();

    return () => {
      cancelled = true;
    };
  }, [open, proposal?.id]);

  async function submitVote(password?: string) {
    if (!proposal) {
      return;
    }

    if (!activeKey) {
      setFormError('Select a global private key first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const result = await voteCosmosProposal({
        privateKey,
        accountPrefix,
        signingAlgorithm,
        proposalId: proposal.id,
        option: voteOption,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
        metadata,
      });

      showToast({
        title: 'Vote transaction broadcasted',
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500">
              {`Proposal #${proposal.id} · ${selectedVoteLabel}`}
            </span>
            <span className="block truncate font-mono text-xs text-slate-500" title={result.delegatorAddress}>
              {formatCompactHash(result.delegatorAddress, 12, 8)}
            </span>
            <Link
              className="mt-1 block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700"
              href={`/cosmos/tx/${result.transactionHash}`}
              title={result.transactionHash}
            >
              {formatCompactHash(result.transactionHash, 14, 10)}
            </Link>
          </span>
        ),
        durationMs: 8000,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to broadcast vote transaction.';

      if (message === 'Password is required.') {
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmUnlock() {
    if (!activeKey) {
      return;
    }

    try {
      setUnlockError(null);
      await resolveEvmStoredPrivateKey(activeKey.id, unlockPassword);
      setUnlockDialogOpen(false);
      const password = unlockPassword;
      setUnlockPassword('');
      await submitVote(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock private key.');
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title="Vote on Proposal"
        description="Broadcast a governance vote with the active private key."
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting || !proposal} onClick={() => void submitVote()}>
              {submitting ? 'Voting...' : 'Vote'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Proposal</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={proposal?.title ?? undefined}>
                {proposal ? `#${proposal.id}. ${proposal.title}` : '-'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{proposal?.statusLabel ?? '-'}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Key</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : 'No active key'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-vote-option">
              Vote
            </label>
            <Select value={voteOption} disabled={submitting} onValueChange={(value) => setVoteOption(value as CosmosProposalVoteOption)}>
              <SelectTrigger id="proposal-vote-option" className="mt-0 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOTE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-gas-price-amount">
                Gas price amount
              </label>
              <ScaledInput
                id="proposal-gas-price-amount"
                value={gasPriceAmount}
                inputMode="decimal"
                placeholder="0.025"
                disabled={submitting}
                onChange={setGasPriceAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-gas-denom">
                Gas denom
              </label>
              <Input id="proposal-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-signing">
                Signing
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="proposal-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-memo">
                Memo
              </label>
              <Input id="proposal-memo" value={memo} placeholder="Optional" disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-metadata">
                Metadata
              </label>
              <Input id="proposal-metadata" value={metadata} placeholder="Optional" disabled={submitting} onChange={(event) => setMetadata(event.target.value)} />
            </div>
          </div>

          {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}
        </div>
      </ModalDialog>
      <SecretInputDialog
        open={unlockDialogOpen}
        onOpenChange={(nextOpen) => {
          setUnlockDialogOpen(nextOpen);

          if (!nextOpen) {
            setUnlockPassword('');
            setUnlockError(null);
          }
        }}
        title="Unlock Private Key"
        description={activeKey ? `Enter the password for "${activeKey.name}" to continue the vote transaction.` : 'Enter the password to continue.'}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder="Password"
        confirmLabel="Unlock"
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

function CosmosProposalsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<ProposalsPageData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProposalItem | null>(null);
  const [selectedDepositProposal, setSelectedDepositProposal] = useState<ProposalItem | null>(null);
  const voteDialogOpen = useMemo(() => Boolean(selectedProposal), [selectedProposal]);
  const depositDialogOpen = useMemo(() => Boolean(selectedDepositProposal), [selectedDepositProposal]);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  function handleVoteSuccess() {
    setRefreshVersion((current) => current + 1);
  }

  function handleDepositSuccess() {
    setRefreshVersion((current) => current + 1);
  }

  function handleSubmitProposalSuccess() {
    setRefreshVersion((current) => current + 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosProposalsDirect(currentPage, PAGE_SIZE);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load proposals.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const handleProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [currentPage, pathname, refreshVersion, router, searchParamsText]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-24" columns={7} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load proposals</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Proposals</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">{data.totalLabel}</p>
                <p className="mt-1 text-sm text-slate-500">Showing governance proposals returned by the active Cosmos REST provider.</p>
              </div>
              <div className="flex items-center gap-0 lg:justify-end">
                <PaginationControls
                  page={data.page}
                  totalPages={data.totalPages}
                  hasPreviousPage={data.hasPreviousPage}
                  hasNextPage={data.hasNextPage}
                  disabled={loading}
                  plain
                  onPageChange={handlePageChange}
                />
                <button
                  type="button"
                  aria-label="Refresh proposals"
                  className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                  onClick={() => setRefreshVersion((current) => current + 1)}
                >
                  <IconRefresh className="size-4" stroke={1.8} />
                </button>
                <ActionIconButton tooltip="Submit Proposal" className="text-slate-400 hover:text-sky-600" onClick={() => setSubmitDialogOpen(true)}>
                  <IconFilePlus className="size-4" stroke={1.8} />
                </ActionIconButton>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-full max-w-[360px] border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Proposal</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Submission</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Voting</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Tally</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-[13px] font-semibold text-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.proposals.length ? (
                  data.proposals.map((proposal) => {
                    const canVote = isVotingProposal(proposal);
                    const canDeposit = isDepositProposal(proposal);

                    return (
                      <tr key={proposal.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50/70" onClick={() => router.push(`/cosmos/proposal/${proposal.id}`)}>
                        <td className="w-full max-w-[360px] px-4 py-3 text-sm" title={`#${proposal.id}. ${proposal.title}`}>
                          <Link prefetch={false} className="inline-block max-w-[360px] truncate align-middle font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/proposal/${proposal.id}`}>
                            {`#${proposal.id}. ${proposal.title}`}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{proposal.typeLabel}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 tabular-nums">
                          <div className="space-y-1">
                            <div className="whitespace-nowrap">
                              <span className="mr-2 font-medium text-slate-500">Submit</span>
                              {formatTimestampWithSeconds(proposal.submitTime)}
                            </div>
                            <div className="whitespace-nowrap">
                              <span className="mr-2 font-medium text-slate-500">Deposit End</span>
                              {formatTimestampWithSeconds(proposal.depositEndTime)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 tabular-nums">
                          <div className="space-y-1">
                            <div className="whitespace-nowrap">
                              <span className="mr-2 font-medium text-slate-500">Start</span>
                              {formatTimestampWithSeconds(proposal.votingStartTime)}
                            </div>
                            <div className="whitespace-nowrap">
                              <span className="mr-2 font-medium text-slate-500">End</span>
                              {formatTimestampWithSeconds(proposal.votingEndTime)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700" title={proposal.tallyLabel}>
                          <div className="min-w-[280px] truncate">{proposal.tallyLabel}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={proposal.status} label={proposal.statusLabel} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm" onClick={(event) => event.stopPropagation()}>
                          <span className="inline-flex items-center justify-end gap-0">
                            <ActionIconButton
                              tooltip={canDeposit ? 'Deposit' : 'Deposit period only'}
                              disabled={!canDeposit}
                              className={canDeposit ? 'text-slate-400 hover:text-sky-600' : 'cursor-not-allowed text-slate-300'}
                              onClick={() => setSelectedDepositProposal(proposal)}
                            >
                              <IconCoins className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              tooltip={canVote ? 'Vote' : 'Voting period only'}
                              disabled={!canVote}
                              className={canVote ? 'text-slate-400 hover:text-sky-600' : 'cursor-not-allowed text-slate-300'}
                              onClick={() => setSelectedProposal(proposal)}
                            >
                              <IconMessageUp className="size-4" stroke={1.8} />
                            </ActionIconButton>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                      No proposals were returned by the current provider.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <VoteProposalDialog
          proposal={selectedProposal}
          open={voteDialogOpen}
          onSuccess={handleVoteSuccess}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedProposal(null);
            }
          }}
        />
        <DepositProposalDialog
          proposal={selectedDepositProposal}
          open={depositDialogOpen}
          onSuccess={handleDepositSuccess}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDepositProposal(null);
            }
          }}
        />
        <SubmitProposalDialog open={submitDialogOpen} onSuccess={handleSubmitProposalSuccess} onOpenChange={setSubmitDialogOpen} />
      </main>
    </AppShell>
  );
}

export default function CosmosProposalsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-24" columns={7} />
        </AppShell>
      }
    >
      <CosmosProposalsPageContent />
    </Suspense>
  );
}
