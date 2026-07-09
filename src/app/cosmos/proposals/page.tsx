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
import {
  enrichCosmosProposalsWithQuarixVeto,
  getQuarixProposalVetoPayload,
  getCosmosProposalsDirect,
} from '@/domains/cosmos/client/queries';
import { getCosmosChainState, subscribeCosmosChainState } from '@/domains/cosmos/client/chain-state';
import { formatCompactHash } from '@/domains/cosmos/client/tx-helpers';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { formatTimestampWithSeconds } from '@/domains/cosmos/ui/detail-primitives';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const textareaClassName =
  'min-h-[96px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50';
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
  const messages = useMessages();
  const proposalMessages = messages.cosmosProposals;
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
          aria-label={proposalMessages.clearInput}
          disabled={disabled}
        >
          <IconX className="size-4" stroke={1.8} />
        </button>
      ) : null}
      <Select key={`scale-${id}-${scaleSelectResetVersion}`} disabled={disabled} onValueChange={(nextValue) => applyScale(Number(nextValue))}>
        <SelectTrigger className="absolute right-1.5 top-1/2 h-[30px] w-[74px] -translate-y-1/2 rounded-xl border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-700 shadow-none">
          <SelectValue placeholder={proposalMessages.scale} />
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
      ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
      : status === 'PROPOSAL_STATUS_REJECTED' || status === 'PROPOSAL_STATUS_FAILED' || status === 'PROPOSAL_STATUS_VETOED'
        ? 'inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700'
        : status === 'PROPOSAL_STATUS_VOTING_PERIOD' || status === 'PROPOSAL_STATUS_VETO_PERIOD'
          ? 'inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700'
          : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600';

  return <span className={className}>{label}</span>;
}

function VetoStatusBadge({ vetoed, inVetoPeriod, label }: { vetoed: boolean; inVetoPeriod: boolean; label: string }) {
  const className = vetoed
    ? 'inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700'
    : inVetoPeriod
      ? 'inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700'
      : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600';

  return <span className={className}>{label}</span>;
}

function isVotingProposal(proposal: ProposalItem) {
  return proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD' && /^[1-9]\d*$/.test(proposal.id);
}

function isDepositProposal(proposal: ProposalItem) {
  return proposal.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD' && /^[1-9]\d*$/.test(proposal.id);
}

function hasLoadedQuarixVeto(data: ProposalsPageData) {
  return data.proposals.every((proposal) => Object.prototype.hasOwnProperty.call(proposal.rawJson, 'veto'));
}

function getQuarixProposalVetoTimes(proposal: ProposalItem) {
  const veto = getQuarixProposalVetoPayload(proposal.rawJson.veto);

  return {
    veto,
    startTime: veto?.veto_start_time ?? veto?.vetoStartTime ?? null,
    endTime: veto?.veto_end_time ?? veto?.vetoEndTime ?? null,
  };
}

function splitTallyLabel(
  label: string,
  labels: {
    yes: string;
    no: string;
    abstain: string;
    veto: string;
  },
) {
  const parts = label.split(' / ');

  if (parts.length < 4) {
    return [label];
  }

  function formatPart(part: string, fallbackLabel: string) {
    const match = /^(Yes|No|Abstain|Veto)\s+(.+)$/.exec(part.trim());

    if (!match) {
      return part;
    }

    const labelByKey: Record<string, string> = {
      Yes: labels.yes,
      No: labels.no,
      Abstain: labels.abstain,
      Veto: labels.veto,
    };

    return `${labelByKey[match[1]] ?? fallbackLabel} ${match[2]}`;
  }

  return [
    `${formatPart(parts[0], labels.yes)} / ${formatPart(parts[1], labels.no)}`,
    `${formatPart(parts[2], labels.abstain)} / ${formatPart(parts[3], labels.veto)}`,
  ];
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
  const messages = useMessages();
  const { locale } = useLocale();
  const proposalMessages = messages.cosmosProposals;
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
      setFormError(messages.evmTxDetail.selectGlobalKeyFirst);
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
        title: proposalMessages.proposalTransactionBroadcasted,
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500" title={title}>
              {translateRuntimeText(title, locale)}
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
      const message = error instanceof Error ? error.message : proposalMessages.failedToBroadcastProposal;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
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
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={proposalMessages.submit}
        description={proposalMessages.proposalTypeDescription}
        maxWidthClassName="max-w-2xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitProposal()}>
              {submitting ? messages.common.running : proposalMessages.submit}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.proposalType}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{proposalMessages.govV1Proposal}</p>
              <p className="mt-1 text-xs text-slate-500">{proposalMessages.proposalTypeDescription}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : messages.evmTxDetail.noKeySelected}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-title">
              {proposalMessages.title}
            </label>
            <Input
              id="submit-proposal-title"
              value={title}
              placeholder={proposalMessages.proposalTitlePlaceholder}
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-summary">
              {proposalMessages.summary}
            </label>
            <AutoGrowTextarea
              id="submit-proposal-summary"
              value={summary}
              placeholder={proposalMessages.summarizeProposalPlaceholder}
              disabled={submitting}
              className={textareaClassName}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-messages">
              {proposalMessages.messagesJson}
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
                {proposalMessages.initialDepositAmount}
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
                {proposalMessages.depositDenom}
              </label>
              <Input id="submit-proposal-deposit-denom" value={depositDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setDepositDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-gas-price-amount">
                {proposalMessages.gasPriceAmount}
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
                {proposalMessages.gasDenom}
              </label>
              <Input id="submit-proposal-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-signing">
                {proposalMessages.signing}
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
                {proposalMessages.metadata}
              </label>
              <Input
                id="submit-proposal-metadata"
                value={metadata}
                placeholder={proposalMessages.optional}
                disabled={submitting}
                onChange={(event) => setMetadata(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="submit-proposal-memo">
              {messages.sendTx.memo}
            </label>
            <Input
              id="submit-proposal-memo"
              value={memo}
              placeholder={proposalMessages.optional}
              disabled={submitting}
              onChange={(event) => setMemo(event.target.value)}
            />
          </div>

          {formError ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{translateRuntimeText(formError, locale)}</p> : null}
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
        title={messages.privateKeys.unlockPrivateKey}
        description={activeKey ? messages.evmTxDetail.unlockDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={proposalMessages.password}
        confirmLabel={messages.sendTx.unlock}
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
  const messages = useMessages();
  const { locale } = useLocale();
  const proposalMessages = messages.cosmosProposals;
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
      setFormError(messages.evmTxDetail.selectGlobalKeyFirst);
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
        title: proposalMessages.depositTransactionBroadcasted,
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500">
              {proposalMessages.proposalTransactionDescription.replace('{id}', proposal.id).replace('{label}', `${amount.trim()}${denom.trim()}`)}
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
      const message = error instanceof Error ? error.message : proposalMessages.failedToBroadcastDeposit;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
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
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={proposalMessages.depositToProposal}
        description={proposalMessages.governanceDepositDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting || !proposal} onClick={() => void submitDeposit()}>
              {submitting ? proposalMessages.depositing : proposalMessages.deposit}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.proposal}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={proposal ? translateRuntimeText(proposal.title, locale) : undefined}>
                {proposal ? proposalMessages.proposalTitleWithId.replace('{id}', proposal.id).replace('{title}', translateRuntimeText(proposal.title, locale)) : '-'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{proposal?.statusLabel ? translateRuntimeText(proposal.statusLabel, locale) : '-'}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : proposalMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-amount">
                {proposalMessages.depositAmount}
              </label>
              <ScaledInput id="proposal-deposit-amount" value={amount} placeholder="10000000" disabled={submitting} onChange={setAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-denom">
                {proposalMessages.depositDenom}
              </label>
              <Input id="proposal-deposit-denom" value={denom} placeholder="uatom" disabled={submitting} onChange={(event) => setDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-gas-price-amount">
                {proposalMessages.gasPriceAmount}
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
                {proposalMessages.gasDenom}
              </label>
              <Input id="proposal-deposit-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-deposit-signing">
                {proposalMessages.signing}
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
                {messages.sendTx.memo}
              </label>
              <Input id="proposal-deposit-memo" value={memo} placeholder={proposalMessages.optional} disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
            </div>
          </div>

          {formError ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{translateRuntimeText(formError, locale)}</p> : null}
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
        title={messages.privateKeys.unlockPrivateKey}
        description={activeKey ? proposalMessages.unlockDepositDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={proposalMessages.password}
        confirmLabel={messages.sendTx.unlock}
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
  const messages = useMessages();
  const { locale } = useLocale();
  const proposalMessages = messages.cosmosProposals;
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

  const voteOptions: Array<{ value: CosmosProposalVoteOption; label: string }> = [
    { value: 'yes', label: proposalMessages.yes },
    { value: 'no', label: proposalMessages.no },
    { value: 'no_with_veto', label: proposalMessages.noWithVeto },
    { value: 'abstain', label: proposalMessages.abstain },
  ];
  const selectedVoteLabel = voteOptions.find((option) => option.value === voteOption)?.label ?? proposalMessages.voteAction;

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
      setFormError(messages.evmTxDetail.selectGlobalKeyFirst);
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
        title: proposalMessages.voteTransactionBroadcasted,
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate text-xs text-slate-500">
              {proposalMessages.proposalTransactionDescription.replace('{id}', proposal.id).replace('{label}', selectedVoteLabel)}
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
      const message = error instanceof Error ? error.message : proposalMessages.failedToBroadcastVote;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
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
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={proposalMessages.voteOnProposal}
        description={proposalMessages.governanceVoteDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting || !proposal} onClick={() => void submitVote()}>
              {submitting ? proposalMessages.votingAction : proposalMessages.voteAction}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.proposal}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={proposal ? translateRuntimeText(proposal.title, locale) : undefined}>
                {proposal ? proposalMessages.proposalTitleWithId.replace('{id}', proposal.id).replace('{title}', translateRuntimeText(proposal.title, locale)) : '-'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{proposal?.statusLabel ? translateRuntimeText(proposal.statusLabel, locale) : '-'}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{proposalMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : proposalMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-vote-option">
                {proposalMessages.vote}
              </label>
            <Select value={voteOption} disabled={submitting} onValueChange={(value) => setVoteOption(value as CosmosProposalVoteOption)}>
              <SelectTrigger id="proposal-vote-option" className="mt-0 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voteOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {translateRuntimeText(option.label, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-gas-price-amount">
                {proposalMessages.gasPriceAmount}
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
                {proposalMessages.gasDenom}
              </label>
              <Input id="proposal-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-signing">
                {proposalMessages.signing}
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
                {messages.sendTx.memo}
              </label>
              <Input id="proposal-memo" value={memo} placeholder={proposalMessages.optional} disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="proposal-metadata">
                {proposalMessages.metadata}
              </label>
              <Input id="proposal-metadata" value={metadata} placeholder={proposalMessages.optional} disabled={submitting} onChange={(event) => setMetadata(event.target.value)} />
            </div>
          </div>

          {formError ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{translateRuntimeText(formError, locale)}</p> : null}
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
        title={messages.privateKeys.unlockPrivateKey}
        description={activeKey ? proposalMessages.unlockVoteDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={proposalMessages.password}
        confirmLabel={messages.sendTx.unlock}
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

function CosmosProposalsPageContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const proposalMessages = messages.cosmosProposals;
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
  const [showQuarixVetoColumn, setShowQuarixVetoColumn] = useState(() => getCosmosChainState().isQuarix);
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
    setShowQuarixVetoColumn(getCosmosChainState().isQuarix);

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
          setErrorMessage(error instanceof Error ? error.message : proposalMessages.failedToLoadProposalsTitle);
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

  useEffect(() => {
    let cancelled = false;

    async function enrich() {
      const chainState = getCosmosChainState();

      if (!chainState.isQuarix || !data || hasLoadedQuarixVeto(data) || data.providerId !== chainState.profileId || data.restUrl !== chainState.restUrl) {
        return;
      }

      const next = await enrichCosmosProposalsWithQuarixVeto(data);

      if (!cancelled) {
        setData((latest) => (latest === data ? next : latest));
      }
    }

    void enrich();

    const unsubscribe = subscribeCosmosChainState((state) => {
      setShowQuarixVetoColumn(state.isQuarix);

      if (!state.isQuarix) {
        return;
      }

      void enrich();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [data]);

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
          <h1>{proposalMessages.failedToLoadProposalsTitle}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.labels.proposals}</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {data.totalProposals ? proposalMessages.totalProposalsLabel.replace('{count}', data.totalProposals.toLocaleString(locale)) : proposalMessages.noProposalsReturned}
                </p>
                <p className="mt-1 text-sm text-slate-500">{proposalMessages.proposalsDescription}</p>
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
                  aria-label={proposalMessages.refreshProposals}
                  className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                  onClick={() => setRefreshVersion((current) => current + 1)}
                >
                  <IconRefresh className="size-4" stroke={1.8} />
                </button>
                <ActionIconButton tooltip={proposalMessages.submitProposalAction} className="text-slate-400 hover:text-sky-600" onClick={() => setSubmitDialogOpen(true)}>
                  <IconFilePlus className="size-4" stroke={1.8} />
                </ActionIconButton>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto lg:overflow-x-hidden">
            <table className="data-table w-full table-fixed whitespace-normal">
              <colgroup>
                <col className={showQuarixVetoColumn ? 'w-[18%]' : 'w-[22%]'} />
                <col className={showQuarixVetoColumn ? 'w-[8%]' : 'w-[10%]'} />
                <col className={showQuarixVetoColumn ? 'w-[16%]' : 'w-[16%]'} />
                <col className={showQuarixVetoColumn ? 'w-[16%]' : 'w-[12%]'} />
                <col className={showQuarixVetoColumn ? 'w-[14%]' : 'w-[25%]'} />
                {showQuarixVetoColumn ? <col className="w-[15%]" /> : null}
                <col className={showQuarixVetoColumn ? 'w-[8%]' : 'w-[6%]'} />
                <col className={showQuarixVetoColumn ? 'w-[5%]' : 'w-[7%]'} />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.proposal}</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.type}</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.submission}</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.voting}</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.tallyColumn}</th>
                  {showQuarixVetoColumn ? (
                    <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.vetoTime}</th>
                  ) : null}
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{proposalMessages.status}</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right text-[13px] font-semibold text-slate-800">{proposalMessages.actions}</th>
                </tr>
              </thead>
              <tbody>
                {data.proposals.length ? (
                  data.proposals.map((proposal) => {
                    const canVote = isVotingProposal(proposal);
                    const canDeposit = isDepositProposal(proposal);
                    const { veto, startTime: vetoStartTime, endTime: vetoEndTime } = getQuarixProposalVetoTimes(proposal);
                    const inVetoPeriod = veto?.in_veto_period ?? veto?.inVetoPeriod ?? false;
                    const vetoStatusLabel = veto ? (veto.vetoed ? proposalMessages.vetoed : inVetoPeriod ? proposalMessages.inVetoPeriod : proposalMessages.notVetoed) : null;
                    const tallyLines = splitTallyLabel(proposal.tallyLabel, {
                      yes: proposalMessages.yes,
                      no: proposalMessages.no,
                      abstain: proposalMessages.abstain,
                      veto: proposalMessages.veto,
                    });
                    const tallyTitle = tallyLines.join(' / ');

                    return (
                      <tr key={proposal.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50/70" onClick={() => router.push(`/cosmos/proposal/${proposal.id}`)}>
                        <td className="overflow-hidden px-4 py-3 text-sm" title={`#${proposal.id}. ${translateRuntimeText(proposal.title, locale)}`}>
                          <div className="min-w-0 truncate">
                            <Link prefetch={false} className="inline-block max-w-full truncate align-middle font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/proposal/${proposal.id}`}>
                              {proposalMessages.proposalTitleWithId.replace('{id}', proposal.id).replace('{title}', translateRuntimeText(proposal.title, locale))}
                            </Link>
                          </div>
                        </td>
                        <td className="overflow-hidden truncate px-4 py-3 text-sm text-slate-700">{translateRuntimeText(proposal.typeLabel, locale)}</td>
                        <td className="overflow-hidden px-4 py-3 text-xs text-slate-700 tabular-nums">
                          <div className="space-y-1">
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="shrink-0 font-medium text-slate-500">{proposalMessages.submitTime}</span>
                              <span className="truncate">{formatTimestampWithSeconds(proposal.submitTime)}</span>
                            </div>
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="shrink-0 font-medium text-slate-500">{proposalMessages.depositEndShort}</span>
                              <span className="truncate">{formatTimestampWithSeconds(proposal.depositEndTime)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="overflow-hidden px-4 py-3 text-xs text-slate-700 tabular-nums">
                          <div className="space-y-1">
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="shrink-0 font-medium text-slate-500">{proposalMessages.start}</span>
                              <span className="truncate">{formatTimestampWithSeconds(proposal.votingStartTime)}</span>
                            </div>
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="shrink-0 font-medium text-slate-500">{proposalMessages.end}</span>
                              <span className="truncate">{formatTimestampWithSeconds(proposal.votingEndTime)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="overflow-hidden px-4 py-3 text-xs text-slate-700" title={tallyTitle}>
                          <div className="space-y-1">
                            {tallyLines.map((line, index) => (
                              <div key={`${proposal.id}-tally-${index}`} className="truncate">
                                {line}
                              </div>
                            ))}
                          </div>
                        </td>
                        {showQuarixVetoColumn ? (
                          <td className="overflow-hidden px-4 py-3 text-xs text-slate-700 tabular-nums">
                            {veto ? (
                              <div className="space-y-1">
                                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                  <span className="shrink-0 font-medium text-slate-500">{proposalMessages.start}</span>
                                  <span className="truncate">{formatTimestampWithSeconds(vetoStartTime)}</span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                  <span className="shrink-0 font-medium text-slate-500">{proposalMessages.end}</span>
                                  <span className="truncate">{formatTimestampWithSeconds(vetoEndTime)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={proposal.status} label={translateRuntimeText(proposal.statusLabel, locale)} />
                            {veto && vetoStatusLabel ? <VetoStatusBadge vetoed={Boolean(veto.vetoed)} inVetoPeriod={Boolean(inVetoPeriod)} label={vetoStatusLabel} /> : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm" onClick={(event) => event.stopPropagation()}>
                          <span className="inline-flex items-center justify-end gap-0">
                            <ActionIconButton
                              tooltip={canDeposit ? proposalMessages.deposit : proposalMessages.depositPeriodOnly}
                              disabled={!canDeposit}
                              className={canDeposit ? 'text-slate-400 hover:text-sky-600' : 'cursor-not-allowed text-slate-300'}
                              onClick={() => setSelectedDepositProposal(proposal)}
                            >
                              <IconCoins className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              tooltip={canVote ? proposalMessages.voteAction : proposalMessages.votingPeriodOnly}
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
                    <td colSpan={showQuarixVetoColumn ? 8 : 7} className="px-5 py-10 text-center text-sm text-slate-500">
                      {proposalMessages.noProposalsReturned}
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
