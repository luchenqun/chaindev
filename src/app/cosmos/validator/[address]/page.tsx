'use client';

import { IconReceiptRefund, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import {
  getCosmosAccountPrefixFromValidatorAddress,
  withdrawCosmosDelegatorRewards,
  withdrawCosmosValidatorCommission,
  type CosmosSigningAlgorithm,
} from '@/domains/cosmos/client/signing-transactions';
import { getCosmosValidatorDetailDirect } from '@/domains/cosmos/client/queries';
import { CosmosDetailGroup as DetailGroup, CosmosDetailRow as DetailRow, CosmosDetailTag as DetailTag, formatTimestampWithSeconds } from '@/domains/cosmos/ui/detail-primitives';
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
  const messages = useMessages();
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
          aria-label={messages.evmTxDetail.clearInput}
          disabled={disabled}
        >
          <IconX className="size-4" stroke={1.8} />
        </button>
      ) : null}
      <Select key={`scale-${id}-${scaleSelectResetVersion}`} disabled={disabled} onValueChange={(nextValue) => applyScale(Number(nextValue))}>
        <SelectTrigger className="absolute right-1.5 top-1/2 h-[30px] w-[74px] -translate-y-1/2 rounded-xl border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-700 shadow-none">
          <SelectValue placeholder={messages.contractPanel.scale} />
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

function RewardSummaryRow({ label, value, actionLabel, onAction }: { label: string; value: ReactNode; actionLabel?: string; onAction?: () => void }) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-3 border-t border-slate-200 px-5 py-4 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium text-slate-500">{translateRuntimeText(label, locale)}</p>
      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '0'}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start sm:justify-self-end" onClick={onAction}>
          <IconReceiptRefund className="mr-1.5 size-4" stroke={1.8} />
          {translateRuntimeText(actionLabel, locale)}
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
  const messages = useMessages();
  const { locale } = useLocale();
  const validatorMessages = messages.cosmosValidatorDetail;
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
  const rewardLabel = kind === 'commission' ? validatorMessages.commissionRewards : validatorMessages.stakeRewards;
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
      setFormError(messages.evmTxDetail.selectGlobalKeyFirst);
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
        title: kind === 'commission' ? validatorMessages.commissionWithdrawBroadcasted : validatorMessages.withdrawBroadcasted,
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
      const message = error instanceof Error ? error.message : validatorMessages.failedToBroadcastWithdrawal;

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
      await submitWithdrawal(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={validatorMessages.withdrawRewardTitle.replace('{rewardLabel}', rewardLabel)}
        description={validatorMessages.withdrawRewardDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting || !validator || !kind} onClick={() => void submitWithdrawal()}>
              {submitting ? validatorMessages.withdrawing : validatorMessages.withdraw}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{validatorMessages.node}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={operatorAddress}>
                {validator ? translateRuntimeText(validator.moniker, locale) : '-'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={operatorAddress}>
                {operatorAddress || '-'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{validatorMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : validatorMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey?.address ?? '-'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{rewardLabel}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{translateRuntimeText(rewardValue || '0', locale)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-gas-price">
                {validatorMessages.gasPrice}
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
                {validatorMessages.gasDenom}
              </label>
              <Input id="withdraw-reward-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="withdraw-reward-signing">
                {validatorMessages.signing}
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
                {validatorMessages.memo}
              </label>
              <Input id="withdraw-reward-memo" value={memo} placeholder={validatorMessages.optional} disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
            </div>
          </div>

          {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{translateRuntimeText(formError, locale)}</p> : null}
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
        title={validatorMessages.unlockPrivateKey}
        description={
          activeKey ? validatorMessages.unlockWithdrawalDescription.replace('{name}', activeKey.name) : validatorMessages.unlockFallbackDescription
        }
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={validatorMessages.password}
        confirmLabel={validatorMessages.unlock}
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

export default function CosmosValidatorPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const validatorMessages = messages.cosmosValidatorDetail;
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
          setErrorMessage(error instanceof Error ? error.message : validatorMessages.failedToLoadFallback);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [address, currentTxPage, isLikelyAddress, refreshVersion, validatorMessages.failedToLoadFallback]);

  if (!isLikelyAddress) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{validatorMessages.invalidValidatorAddressTitle}</h1>
          <p>{validatorMessages.invalidValidatorAddressDescription}</p>
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
          <h1>{validatorMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
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
            {validatorMessages.overview}
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
            {hasTransactions ? `${validatorMessages.transactions} (${validator.transactionsPage.totalCount})` : validatorMessages.transactions}
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
            {hasDelegations ? `${validatorMessages.delegations} (${validator.delegationsCount})` : validatorMessages.delegations}
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
                <p className="text-base font-semibold text-slate-900">{validatorMessages.validatorOverview}</p>
                <p className="mt-1 text-sm text-slate-500">{validatorMessages.validatorOverviewDescription}</p>
              </div>

              <dl>
                <DetailGroup>
                  <DetailRow label={validatorMessages.moniker} value={translateRuntimeText(validator.moniker, locale)} />
                  <DetailRow label={validatorMessages.status} value={<DetailTag tone={statusTone}>{translateRuntimeText(validator.statusLabel, locale)}</DetailTag>} />
                  <DetailRow label={validatorMessages.jailed} value={<DetailTag tone={validator.jailed ? 'danger' : 'neutral'}>{translateRuntimeText(validator.jailedLabel, locale)}</DetailTag>} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label={validatorMessages.operatorAddress} value={validator.operatorAddress} mono />
                  <DetailRow
                    label={validatorMessages.accountAddress}
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
                  <DetailRow label={validatorMessages.consensusPubkey} value={validator.consensusPubkey ?? '-'} mono />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label={validatorMessages.votingPower} value={translateRuntimeText(validator.votingPowerPercentLabel, locale)} />
                  <DetailRow label={validatorMessages.tokens} value={translateRuntimeText(validator.tokensLabel, locale)} />
                  <DetailRow label={validatorMessages.delegatorShares} value={translateRuntimeText(validator.delegatorSharesLabel, locale)} mono />
                  <DetailRow label={validatorMessages.commissionRate} value={translateRuntimeText(validator.commissionRateLabel, locale)} />
                  <DetailRow label={validatorMessages.minSelfDelegation} value={translateRuntimeText(validator.minSelfDelegationLabel, locale)} mono />
                  <DetailRow label={validatorMessages.selfBond} value={translateRuntimeText(validator.selfBondLabel, locale)} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label={validatorMessages.identity} value={validator.identity ?? '-'} />
                  <DetailRow
                    label={validatorMessages.website}
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
                  <DetailRow label={validatorMessages.securityContact} value={validator.securityContact ?? '-'} />
                  <DetailRow label={validatorMessages.details} value={validator.details ?? '-'} />
                </DetailGroup>
                {validator.unbondingHeightLabel || validator.unbondingTime ? (
                  <DetailGroup>
                    <DetailRow label={validatorMessages.unbondingHeight} value={validator.unbondingHeightLabel ?? '-'} />
                    <DetailRow label={validatorMessages.unbondingTime} value={formatTimestampWithSeconds(validator.unbondingTime)} />
                  </DetailGroup>
                ) : null}
              </dl>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">{validatorMessages.accountBalances}</p>
                <p className="mt-1 text-sm text-slate-500">{validatorMessages.accountBalancesDescription}</p>
              </div>
              <div>
                <RewardSummaryRow
                  label={validatorMessages.accountAddress}
                  value={
                    validator.accountAddress ? (
                      <Link className="font-mono text-sky-600 hover:text-sky-700" href={`/cosmos/account/${validator.accountAddress}`}>
                        {validator.accountAddress}
                      </Link>
                    ) : (
                      '-'
                    )
                  }
                />
                <RewardSummaryRow label={messages.cosmosAccountDetail.balances} value={translateRuntimeText(validator.accountReadableBalancesLabel, locale)} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">{validatorMessages.rewards}</p>
                <p className="mt-1 text-sm text-slate-500">{validatorMessages.rewardsDescription}</p>
              </div>
              <div>
                <RewardSummaryRow
                  label={validatorMessages.stakeRewards}
                  value={translateRuntimeText(validator.stakeRewardsLabel, locale)}
                  actionLabel={validatorMessages.withdraw}
                  onAction={() => setRewardWithdrawalKind('stake')}
                />
                <RewardSummaryRow
                  label={validatorMessages.commissionRewards}
                  value={translateRuntimeText(validator.commissionRewardsLabel, locale)}
                  actionLabel={validatorMessages.withdraw}
                  onAction={() => setRewardWithdrawalKind('commission')}
                />
                <RewardSummaryRow label={validatorMessages.outstandingRewards} value={translateRuntimeText(validator.outstandingRewardsLabel, locale)} />
              </div>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'transactions' ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{validatorMessages.transactions}</p>
                <p className="mt-1 text-sm text-slate-500">{validatorMessages.transactionsDescription}</p>
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
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.hash}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.type}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.block}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.age}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.from}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.gasUsedWanted}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.fee}</th>
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
                        {transaction.sender === validatorMessages.unknown ? (
                          <span className="text-slate-500">{translateRuntimeText(validatorMessages.unknown, locale)}</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {translateRuntimeText(transaction.senderLabel, locale)}
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {translateRuntimeText(transaction.gasUsedLabel, locale)}/{translateRuntimeText(transaction.gasWantedLabel, locale)}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{translateRuntimeText(transaction.feeLabel, locale)}</td>
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
              <p className="text-base font-semibold text-slate-900">{validatorMessages.delegations}</p>
              <p className="mt-1 text-sm text-slate-500">{validatorMessages.delegationsDescription}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.delegator}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.amount}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.delegatorShares}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{validatorMessages.kind}</th>
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
                      <td className="px-5 py-3 text-sm text-slate-700">{translateRuntimeText(delegation.amountLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">{translateRuntimeText(delegation.sharesLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm">
                        <DetailTag>{translateRuntimeText(delegation.kindLabel, locale)}</DetailTag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {resolvedActiveTab === 'json' ? <JsonViewPanel value={validator.rawJson as object} /> : null}
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
