'use client';

import JsonView from '@uiw/react-json-view';
import { IconReceiptRefund, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  getCosmosAccountPrefixFromValidatorAddress,
  withdrawCosmosDelegatorRewards,
  withdrawCosmosValidatorCommission,
  type CosmosSigningAlgorithm,
} from '@/domains/cosmos/client/delegate-transaction';
import { getCosmosValidatorDetailDirect } from '@/domains/cosmos/client/queries';
import {
  CosmosDetailGroup as DetailGroup,
  CosmosDetailRow as DetailRow,
  CosmosDetailTag as DetailTag,
  COSMOS_JSON_VIEW_STYLE as JSON_VIEW_STYLE,
  formatTimestampWithSeconds,
} from '@/domains/cosmos/ui/detail-primitives';
import { CosmosTransactionHashCell, CosmosTransactionPreviewButton } from '@/domains/cosmos/ui/transaction-list-cells';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { AppShell } from '@/platform/layout/app-shell';

const INTEGER_SCALE_OPTIONS = [6, 9, 12, 15, 18] as const;

type ValidatorDetailData = Awaited<ReturnType<typeof getCosmosValidatorDetailDirect>>;
type RewardWithdrawalKind = 'stake' | 'commission';

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

function RewardSummaryRow({ label, value, actionLabel, onAction }: { label: string; value: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="grid gap-3 border-t border-slate-200 px-5 py-4 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '0'}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start sm:justify-self-end" onClick={onAction}>
          <IconReceiptRefund className="mr-1.5 size-4" stroke={1.8} />
          {actionLabel}
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}

function RewardWithdrawalDialog({
  validator,
  kind,
  open,
  onOpenChange,
  onSuccess,
}: {
  validator: ValidatorDetailData | null;
  kind: RewardWithdrawalKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
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

  const operatorAddress = validator?.operatorAddress ?? '';
  const accountPrefix = useMemo(() => getCosmosAccountPrefixFromValidatorAddress(operatorAddress), [operatorAddress]);
  const rewardLabel = kind === 'commission' ? 'Commission Rewards' : 'Stake Rewards';
  const rewardValue = kind === 'commission' ? validator?.commissionRewardsLabel : validator?.stakeRewardsLabel;

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

    setGasPriceAmount('');
    setGasPriceDenom('');
    setSigningAlgorithm('ethsecp256k1');
    setMemo('');
    setFormError(null);
    setUnlockPassword('');
    setUnlockError(null);
  }, [open, kind, validator?.operatorAddress]);

  async function submitWithdrawal(password?: string) {
    if (!validator || !kind) {
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
      const input = {
        privateKey,
        accountPrefix,
        signingAlgorithm,
        validatorAddress: validator.operatorAddress,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
      };
      const result = kind === 'commission' ? await withdrawCosmosValidatorCommission(input) : await withdrawCosmosDelegatorRewards(input);

      showToast({
        title: kind === 'commission' ? 'Commission withdrawal broadcasted' : 'Reward withdrawal broadcasted',
        description: (
          <span className="block min-w-0 max-w-full">
            <span className="block truncate font-mono text-xs text-slate-500" title={result.delegatorAddress}>
              {result.delegatorAddress}
            </span>
            <Link
              className="mt-1 block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700"
              href={`/cosmos/tx/${result.transactionHash}`}
              title={result.transactionHash}
            >
              {result.transactionHash}
            </Link>
          </span>
        ),
        durationMs: 8000,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to broadcast withdrawal transaction.';

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
      await submitWithdrawal(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock private key.');
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={`Withdraw ${rewardLabel}`}
        description="Withdraw the selected validator reward with the active private key."
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting || !validator || !kind} onClick={() => void submitWithdrawal()}>
              {submitting ? 'Withdrawing...' : 'Withdraw'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Node</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={operatorAddress}>
                {validator ? validator.moniker : '-'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={operatorAddress}>
                {operatorAddress || '-'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Key</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : 'No active key'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey?.address ?? '-'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{rewardLabel}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{rewardValue || '0'}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-gas-price">
                Gas price
              </label>
              <ScaledInput
                id="withdraw-reward-gas-price"
                value={gasPriceAmount}
                inputMode="decimal"
                placeholder="1000000000000000"
                disabled={submitting}
                onChange={setGasPriceAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-gas-denom">
                Gas denom
              </label>
              <Input id="withdraw-reward-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-signing">
                Signing
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="withdraw-reward-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-memo">
                Memo
              </label>
              <Input id="withdraw-reward-memo" value={memo} placeholder="Optional" disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
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
        description={activeKey ? `Enter the password for "${activeKey.name}" to continue the withdrawal transaction.` : 'Enter the password to continue.'}
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

export default function CosmosValidatorPage() {
  const params = useParams<{ address: string }>();
  const address = params.address;
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'delegations' | 'json'>('overview');
  const [validator, setValidator] = useState<Awaited<ReturnType<typeof getCosmosValidatorDetailDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [rewardWithdrawalKind, setRewardWithdrawalKind] = useState<RewardWithdrawalKind | null>(null);
  const isLikelyAddress = useMemo(() => Boolean(address?.trim()), [address]);

  useEffect(() => {
    if (!isLikelyAddress) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosValidatorDetailDirect({
          address,
          txPage: currentTxPage,
          txPageSize: 10,
        });

        if (!cancelled) {
          setValidator(next);
          setErrorMessage(null);

          if (next.transactionsPage.page !== currentTxPage) {
            setCurrentTxPage(next.transactionsPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setValidator(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos validator.');
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [address, currentTxPage, isLikelyAddress, refreshVersion]);

  if (!isLikelyAddress) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid validator address</h1>
          <p>The validator address is required.</p>
        </main>
      </AppShell>
    );
  }

  if (!validator) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-32" groups={3} rowsPerGroup={4} secondaryCard={true} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load validator</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const hasTransactions = validator.transactionsPage.totalCount > 0;
  const hasDelegations = validator.delegationsCount > 0;
  const resolvedActiveTab = activeTab === 'transactions' && !hasTransactions ? 'overview' : activeTab === 'delegations' && !hasDelegations ? 'overview' : activeTab;
  const statusTone = validator.status === 'BOND_STATUS_BONDED' ? 'success' : validator.status === 'BOND_STATUS_UNBONDING' ? 'warning' : 'neutral';

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'overview' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'transactions' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            } ${!hasTransactions ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasTransactions}
            onClick={() => {
              if (hasTransactions) {
                setActiveTab('transactions');
              }
            }}
          >
            {hasTransactions ? `Transactions (${validator.transactionsPage.totalCount})` : 'Transactions'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === 'delegations' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            } ${!hasDelegations ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={!hasDelegations}
            onClick={() => {
              if (hasDelegations) {
                setActiveTab('delegations');
              }
            }}
          >
            {hasDelegations ? `Delegations (${validator.delegationsCount})` : 'Delegations'}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === 'overview' ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="mb-3">
                <p className="text-base font-semibold text-slate-900">Validator Overview</p>
                <p className="mt-1 text-sm text-slate-500">Validator profile, rewards, and staking state returned by the active Cosmos REST endpoint.</p>
              </div>

              <dl>
                <DetailGroup>
                  <DetailRow label="Moniker" value={validator.moniker} />
                  <DetailRow label="Status" value={<DetailTag tone={statusTone}>{validator.statusLabel}</DetailTag>} />
                  <DetailRow label="Jailed" value={<DetailTag tone={validator.jailed ? 'danger' : 'neutral'}>{validator.jailedLabel}</DetailTag>} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label="Operator Address" value={validator.operatorAddress} mono />
                  <DetailRow
                    label="Account Address"
                    value={
                      validator.accountAddress ? (
                        <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/account/${validator.accountAddress}`}>
                          {validator.accountAddress}
                        </Link>
                      ) : (
                        '-'
                      )
                    }
                    mono
                  />
                  <DetailRow label="Consensus Pubkey" value={validator.consensusPubkey ?? '-'} mono />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label="Voting Power" value={validator.votingPowerPercentLabel} />
                  <DetailRow label="Tokens" value={validator.tokensLabel} />
                  <DetailRow label="Delegator Shares" value={validator.delegatorSharesLabel} mono />
                  <DetailRow label="Commission Rate" value={validator.commissionRateLabel} />
                  <DetailRow label="Min Self Delegation" value={validator.minSelfDelegationLabel} mono />
                  <DetailRow label="Self Bond" value={validator.selfBondLabel} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label="Identity" value={validator.identity ?? '-'} />
                  <DetailRow
                    label="Website"
                    value={
                      validator.website ? (
                        <a className="text-sky-600 hover:text-sky-700" href={validator.website} rel="noreferrer" target="_blank">
                          {validator.website}
                        </a>
                      ) : (
                        '-'
                      )
                    }
                  />
                  <DetailRow label="Security Contact" value={validator.securityContact ?? '-'} />
                  <DetailRow label="Details" value={validator.details ?? '-'} />
                </DetailGroup>
                {validator.unbondingHeightLabel || validator.unbondingTime ? (
                  <DetailGroup>
                    <DetailRow label="Unbonding Height" value={validator.unbondingHeightLabel ?? '-'} />
                    <DetailRow label="Unbonding Time" value={formatTimestampWithSeconds(validator.unbondingTime)} />
                  </DetailGroup>
                ) : null}
              </dl>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">Account Balances</p>
                <p className="mt-1 text-sm text-slate-500">Balances held by this validator account address.</p>
              </div>
              <div>
                <RewardSummaryRow
                  label="Account Address"
                  value={validator.accountAddress ?? '-'}
                  actionLabel={validator.accountAddress ? 'Open Account' : undefined}
                  onAction={
                    validator.accountAddress
                      ? () => {
                          window.location.href = `/cosmos/account/${validator.accountAddress}`;
                        }
                      : undefined
                  }
                />
                <RewardSummaryRow label="Balances" value={validator.accountReadableBalancesLabel} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">Rewards</p>
                <p className="mt-1 text-sm text-slate-500">Validator reward balances returned by the active Cosmos REST endpoint.</p>
              </div>
              <div>
                <RewardSummaryRow label="Stake Rewards" value={validator.stakeRewardsLabel} actionLabel="Withdraw" onAction={() => setRewardWithdrawalKind('stake')} />
                <RewardSummaryRow
                  label="Commission Rewards"
                  value={validator.commissionRewardsLabel}
                  actionLabel="Withdraw"
                  onAction={() => setRewardWithdrawalKind('commission')}
                />
                <RewardSummaryRow label="Outstanding Rewards" value={validator.outstandingRewardsLabel} />
              </div>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'transactions' ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Transactions</p>
                <p className="mt-1 text-sm text-slate-500">Transactions where this validator account appears as `message.sender`.</p>
              </div>
              <PaginationControls
                page={validator.transactionsPage.page}
                totalPages={validator.transactionsPage.totalPages}
                hasPreviousPage={validator.transactionsPage.hasPreviousPage}
                hasNextPage={validator.transactionsPage.hasNextPage}
                plain
                onPageChange={setCurrentTxPage}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Hash</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Block</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Age</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">From</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Gas Used / Wanted</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {validator.transactionsPage.items.map((transaction) => (
                    <tr key={transaction.hash} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="-ml-1 flex items-center gap-1.5">
                          <CosmosTransactionPreviewButton transaction={transaction} />
                          <CosmosTransactionHashCell hash={transaction.hash} hashLabel={transaction.hashLabel} status={transaction.status} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/block/${transaction.height}`}>
                          {transaction.height}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <RelativeTime timestampMs={transaction.timestampMs} />
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {transaction.sender === 'Unknown' ? (
                          <span className="text-slate-500">Unknown</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {transaction.senderLabel}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.gasUsedLabel}/{transaction.gasWantedLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{transaction.feeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'delegations' ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">Delegations</p>
              <p className="mt-1 text-sm text-slate-500">Delegators currently bonded to this validator.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Delegator</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Amount</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Shares</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Kind</th>
                  </tr>
                </thead>
                <tbody>
                  {validator.delegations.map((delegation) => (
                    <tr key={`${delegation.delegatorAddress}-${delegation.sharesLabel}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${delegation.delegatorAddress}`}>
                          {delegation.delegatorAddressLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{delegation.amountLabel}</td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">{delegation.sharesLabel}</td>
                      <td className="px-5 py-3 text-sm">
                        <DetailTag>{delegation.kindLabel}</DetailTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'json' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView value={validator.rawJson} style={JSON_VIEW_STYLE} displayDataTypes={false} displayObjectSize={false} enableClipboard={false} collapsed={false} />
          </section>
        ) : null}
        <RewardWithdrawalDialog
          validator={validator}
          kind={rewardWithdrawalKind}
          open={Boolean(rewardWithdrawalKind)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setRewardWithdrawalKind(null);
            }
          }}
          onSuccess={() => setRefreshVersion((current) => current + 1)}
        />
      </main>
    </AppShell>
  );
}
