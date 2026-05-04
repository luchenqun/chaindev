'use client';

import { IconCoins, IconRefresh, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { delegateCosmosTokens, getCosmosAccountPrefixFromValidatorAddress, type CosmosSigningAlgorithm } from '@/domains/cosmos/client/signing-transactions';
import { getCosmosValidatorsDirect } from '@/domains/cosmos/client/queries';
import { formatCompactHash } from '@/domains/cosmos/client/tx-helpers';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { AppShell } from '@/platform/layout/app-shell';

const PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const INTEGER_SCALE_OPTIONS = [6, 9, 12, 15, 18] as const;

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

type ValidatorsPageData = Awaited<ReturnType<typeof getCosmosValidatorsDirect>>;
type ValidatorItem = ValidatorsPageData['validators'][number];

function DelegateDialog({
  validator,
  open,
  onOpenChange,
  onSuccess,
}: {
  validator: ValidatorItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.cosmosValidatorsPage;
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

  const operatorAddress = validator?.operatorAddress ?? '';
  const title = pageMessages.delegateTransaction;
  const accountPrefix = useMemo(() => getCosmosAccountPrefixFromValidatorAddress(operatorAddress), [operatorAddress]);

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

    setAmount('');
    setDenom('');
    setGasPriceAmount('');
    setGasPriceDenom('');
    setSigningAlgorithm('ethsecp256k1');
    setMemo('');
    setFormError(null);
    setUnlockPassword('');
    setUnlockError(null);
  }, [open, validator?.operatorAddress]);

  async function submitDelegate(password?: string) {
    if (!validator) {
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
      const result = await delegateCosmosTokens({
        privateKey,
        accountPrefix,
        signingAlgorithm,
        validatorAddress: validator.operatorAddress,
        amount,
        denom,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
      });

      showToast({
        title: pageMessages.delegateBroadcasted,
        description: (
          <span className="block min-w-0 max-w-full">
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
      const message = error instanceof Error ? error.message : pageMessages.failedToBroadcastDelegate;

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
      await submitDelegate(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={title}
        description={pageMessages.delegateDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting || !validator} onClick={() => void submitDelegate()}>
              {submitting ? pageMessages.delegating : pageMessages.delegate}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{pageMessages.node}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={operatorAddress}>
                {validator ? translateRuntimeText(validator.moniker, locale) : '-'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={operatorAddress}>
                {operatorAddress ? formatCompactHash(operatorAddress, 18, 12) : '-'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{pageMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : pageMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">{pageMessages.delegateDetails}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-amount">
                {pageMessages.amount}
              </label>
              <ScaledInput id="delegate-amount" value={amount} placeholder={pageMessages.amountPlaceholder} disabled={submitting} onChange={setAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-denom">
                {pageMessages.stakingDenom}
              </label>
              <Input id="delegate-denom" value={denom} placeholder={pageMessages.stakingDenomPlaceholder} disabled={submitting} onChange={(event) => setDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-gas-price">
                {pageMessages.gasPrice}
              </label>
              <ScaledInput
                id="delegate-gas-price"
                value={gasPriceAmount}
                inputMode="decimal"
                placeholder={pageMessages.gasPricePlaceholder}
                disabled={submitting}
                onChange={setGasPriceAmount}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-gas-denom">
                {pageMessages.gasDenom}
              </label>
              <Input
                id="delegate-gas-denom"
                value={gasPriceDenom}
                placeholder={pageMessages.stakingDenomPlaceholder}
                disabled={submitting}
                onChange={(event) => setGasPriceDenom(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-signing">
                {pageMessages.signing}
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="delegate-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-memo">
                {pageMessages.memo}
              </label>
              <Input id="delegate-memo" value={memo} placeholder={pageMessages.optional} disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
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
        title={pageMessages.unlockPrivateKey}
        description={activeKey ? pageMessages.unlockDelegateDescription.replace('{name}', activeKey.name) : pageMessages.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={pageMessages.password}
        confirmLabel={pageMessages.unlock}
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

function CosmosValidatorsPageContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.cosmosValidatorsPage;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<ValidatorsPageData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedValidator, setSelectedValidator] = useState<ValidatorItem | null>(null);
  const delegateDialogOpen = useMemo(() => Boolean(selectedValidator), [selectedValidator]);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  function handleDelegateSuccess() {
    setRefreshVersion((current) => current + 1);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosValidatorsDirect(currentPage, PAGE_SIZE);

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
          setErrorMessage(error instanceof Error ? error.message : pageMessages.failedToLoadValidators);
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
  }, [currentPage, pageMessages.failedToLoadValidators, pathname, refreshVersion, router, searchParamsText]);

  if (loading) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-28" metricCards={4} columns={8} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{pageMessages.validatorsUnavailableTitle}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{pageMessages.validators}</h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {data.totalValidators ? pageMessages.totalValidatorsLabel.replace('{count}', data.totalValidators.toLocaleString(locale)) : pageMessages.noValidatorsReturned}
                </p>
                <p className="mt-1 text-sm text-slate-500">{pageMessages.validatorsDescription}</p>
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
                  aria-label={pageMessages.refreshValidators}
                  className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:text-slate-600"
                  onClick={() => setRefreshVersion((current) => current + 1)}
                >
                  <IconRefresh className="size-4" stroke={1.8} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.name}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.power}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.tokens}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.delegatorShares}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.commission}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.operator}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.jailed}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.status}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {data.validators.length ? (
                  data.validators.map((validator) => (
                    <tr key={validator.operatorAddress} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <Link prefetch={false} className="block truncate font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${validator.operatorAddress}`}>
                            {translateRuntimeText(validator.moniker, locale)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900 tabular-nums">{translateRuntimeText(validator.votingPowerPercentLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">{translateRuntimeText(validator.tokensLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">{translateRuntimeText(validator.delegatorSharesLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700 tabular-nums">{translateRuntimeText(validator.commissionRateLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700 mono" title={validator.operatorAddress}>
                        {translateRuntimeText(validator.operatorAddressLabel, locale)}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${validator.jailed ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
                        >
                          {translateRuntimeText(validator.jailedLabel, locale)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            validator.status === 'BOND_STATUS_BONDED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : validator.status === 'BOND_STATUS_UNBONDING'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {translateRuntimeText(validator.statusLabel, locale)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-sm">
                        <ActionIconButton tooltip={pageMessages.delegate} className="text-slate-400 hover:text-sky-600" onClick={() => setSelectedValidator(validator)}>
                          <IconCoins className="size-4" stroke={1.8} />
                        </ActionIconButton>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.noValidatorsReturned}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <DelegateDialog
          validator={selectedValidator}
          open={delegateDialogOpen}
          onSuccess={handleDelegateSuccess}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedValidator(null);
            }
          }}
        />
      </main>
    </AppShell>
  );
}

export default function CosmosValidatorsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-28" metricCards={4} columns={8} />
        </AppShell>
      }
    >
      <CosmosValidatorsPageContent />
    </Suspense>
  );
}
