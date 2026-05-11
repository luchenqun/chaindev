'use client';

import { IconArrowBackUp, IconCopy, IconInfoCircle, IconTag, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RelativeTime } from '@/components/relative-time';
import { deleteCosmosAddressTag, getCosmosAddressTag, getCosmosAddressTags, subscribeCosmosAddressTags, upsertCosmosAddressTag } from '@/domains/cosmos/client/address-tags';
import { getCosmosAccountPrefixFromValidatorAddress, undelegateCosmosTokens, type CosmosSigningAlgorithm } from '@/domains/cosmos/client/signing-transactions';
import { getCosmosAccountDetailDirect } from '@/domains/cosmos/client/queries';
import { formatCompactHash, formatReadableDenom, formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { decodeCosmosAddressToEvmHexAddress } from '@/domains/cosmos/ui/address-display';
import { CosmosTransactionHashCell, CosmosTransactionPreviewButton } from '@/domains/cosmos/ui/transaction-list-cells';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type AccountPageTab = 'transactions' | 'delegations' | 'json';
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

function AccountMetric({ label, value, tooltip }: { label: string; value: React.ReactNode; tooltip?: React.ReactNode }) {
  const { locale } = useLocale();
  const tooltipTriggerRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{translateRuntimeText(label, locale)}</p>
        {tooltip ? (
          <span
            ref={tooltipTriggerRef}
            className="inline-flex"
            onBlur={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            tabIndex={0}
          >
            <span className="inline-flex items-center justify-center text-slate-300 outline-none">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <FloatingTooltip open={tooltipOpen} anchorRef={tooltipTriggerRef} className="w-[260px] whitespace-normal border border-slate-200 bg-white leading-5 text-slate-700">
              {tooltip}
            </FloatingTooltip>
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function AccountBalanceTooltipValue({
  label,
  rawValue,
}: {
  label: string;
  rawValue: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-w-0 max-w-full items-center text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="truncate">{label}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{rawValue}</span>
      </FloatingTooltip>
    </>
  );
}

type AccountDetailData = Awaited<ReturnType<typeof getCosmosAccountDetailDirect>>;
type AccountDelegationItem = AccountDetailData['delegations'][number];

function UndelegateDialog({
  delegation,
  open,
  onOpenChange,
  onSuccess,
}: {
  delegation: AccountDelegationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const accountMessages = messages.cosmosAccountDetail;
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

  const validatorAddress = delegation?.validatorAddress ?? '';
  const validatorLabel = delegation?.validatorMoniker ?? accountMessages.unknown;
  const accountPrefix = useMemo(() => getCosmosAccountPrefixFromValidatorAddress(validatorAddress), [validatorAddress]);
  const amountPlaceholder = delegation?.rawJson.balance?.amount ?? '1000000000000000000';
  const denomPlaceholder = delegation?.rawJson.balance?.denom ?? 'uatom';

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
  }, [open, delegation?.validatorAddress]);

  async function submitUndelegate(password?: string) {
    if (!delegation) {
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
      const result = await undelegateCosmosTokens({
        privateKey,
        accountPrefix,
        signingAlgorithm,
        validatorAddress: delegation.validatorAddress,
        amount,
        denom,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        memo,
      });

      showToast({
        title: accountMessages.undelegateBroadcasted,
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
      const message = error instanceof Error ? error.message : accountMessages.failedToBroadcastUndelegate;

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
      await submitUndelegate(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  return (
    <>
      <ModalDialog
        open={open}
        title={accountMessages.undelegateTransaction}
        description={accountMessages.undelegateDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="button" disabled={submitting || !delegation} onClick={() => void submitUndelegate()}>
              {submitting ? accountMessages.undelegating : accountMessages.undelegate}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{accountMessages.node}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={validatorAddress}>
                {translateRuntimeText(validatorLabel, locale)}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={validatorAddress}>
                {validatorAddress ? formatCompactHash(validatorAddress, 18, 12) : '-'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{accountMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : accountMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey ? formatCompactHash(activeKey.address, 12, 8) : '-'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">{accountMessages.undelegateDetails}</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-amount">
                {accountMessages.amount}
              </label>
              <ScaledInput id="undelegate-amount" value={amount} placeholder={amountPlaceholder} disabled={submitting} onChange={setAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-denom">
                {accountMessages.stakingDenom}
              </label>
              <Input id="undelegate-denom" value={denom} placeholder={denomPlaceholder} disabled={submitting} onChange={(event) => setDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-gas-price">
                {accountMessages.gasPrice}
              </label>
              <ScaledInput id="undelegate-gas-price" value={gasPriceAmount} inputMode="decimal" placeholder="1000000000000000" disabled={submitting} onChange={setGasPriceAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-gas-denom">
                {accountMessages.gasDenom}
              </label>
              <Input id="undelegate-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-signing">
                {accountMessages.signing}
              </label>
              <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                <SelectTrigger id="undelegate-signing" className="mt-0 h-10">
                  {signingAlgorithm}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                  <SelectItem value="secp256k1">secp256k1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="undelegate-memo">
                {accountMessages.memo}
              </label>
              <Input id="undelegate-memo" value={memo} placeholder={accountMessages.optional} disabled={submitting} onChange={(event) => setMemo(event.target.value)} />
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
        title={accountMessages.unlockPrivateKey}
        description={
          activeKey ? accountMessages.unlockUndelegateDescription.replace('{name}', activeKey.name) : accountMessages.unlockFallbackDescription
        }
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={accountMessages.password}
        confirmLabel={accountMessages.unlock}
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

export default function CosmosAccountPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const accountMessages = messages.cosmosAccountDetail;
  const bankSupplyMessages = messages.cosmosBankSupply;
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const { status } = useSession();
  const address = params.address;
  const [currentTxPage, setCurrentTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState<AccountPageTab>('transactions');
  const [account, setAccount] = useState<Awaited<ReturnType<typeof getCosmosAccountDetailDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [tagInput, setTagInput] = useState('');
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedUndelegation, setSelectedUndelegation] = useState<AccountDelegationItem | null>(null);
  const [evmHexCopied, setEvmHexCopied] = useState(false);
  const evmHexCopyTimeoutRef = useRef<number | null>(null);
  const evmHexCopyButtonRef = useRef<HTMLButtonElement | null>(null);
  const isLikelyAddress = useMemo(() => Boolean(address?.trim()), [address]);
  const visibleAddresses = useMemo(
    () => [...new Set((account?.transactionsPage.items ?? []).map((transaction) => transaction.sender).filter((sender) => sender !== accountMessages.unknown))],
    [account],
  );

  function goToLogin() {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/cosmos/account/${address}`)}`);
  }

  useEffect(() => {
    if (!isLikelyAddress) {
      return;
    }

    function loadTag() {
      const nextTag = getCosmosAddressTag(address);
      setNameTag(nextTag);
      setTagInput(nextTag ?? '');
    }

    loadTag();

    const unsubscribe = subscribeCosmosAddressTags(() => {
      loadTag();
    });

    const handleProfileChanged = () => {
      loadTag();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isLikelyAddress]);

  useEffect(() => {
    if (!isLikelyAddress) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getCosmosAccountDetailDirect({
          address,
          txPage: currentTxPage,
          txPageSize: 10,
        });

        if (!cancelled) {
          setAccount(next);
          setErrorMessage(null);

          if (next.transactionsPage.page !== currentTxPage) {
            setCurrentTxPage(next.transactionsPage.page);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setAccount(null);
          setErrorMessage(error instanceof Error ? error.message : accountMessages.failedToLoadFallback);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [accountMessages.failedToLoadFallback, address, currentTxPage, isLikelyAddress, refreshVersion]);

  useEffect(() => {
    if (!account) {
      return;
    }

    const currentAccount = account;

    function loadVisibleTags() {
      setNameTagsByAddress(getCosmosAddressTags([currentAccount.address, ...visibleAddresses]));
    }

    loadVisibleTags();

    const unsubscribe = subscribeCosmosAddressTags(() => {
      loadVisibleTags();
    });

    const handleProfileChanged = () => {
      loadVisibleTags();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [account, visibleAddresses]);

  useEffect(() => {
    return () => {
      if (evmHexCopyTimeoutRef.current != null) {
        window.clearTimeout(evmHexCopyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyEvmHex(value: string) {
    await copyText(value);
    setEvmHexCopied(true);

    if (evmHexCopyTimeoutRef.current != null) {
      window.clearTimeout(evmHexCopyTimeoutRef.current);
    }

    evmHexCopyTimeoutRef.current = window.setTimeout(() => {
      setEvmHexCopied(false);
      evmHexCopyTimeoutRef.current = null;
    }, 1600);
  }

  async function handleSaveTag() {
    try {
      if (tagInput.trim()) {
        await upsertCosmosAddressTag(address, tagInput);
      } else {
        await deleteCosmosAddressTag(address);
      }

      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  async function handleRemoveTag() {
    try {
      await deleteCosmosAddressTag(address);
      setTagInput('');
      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  function openTagDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setTagInput(nameTag ?? '');
    setTagDialogOpen(true);
  }

  function handleUndelegateSuccess() {
    setRefreshVersion((current) => current + 1);
  }

  if (!isLikelyAddress) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{accountMessages.invalidAccountAddressTitle}</h1>
          <p>{accountMessages.invalidAccountAddressDescription}</p>
        </main>
      </AppShell>
    );
  }

  if (!account) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-28" groups={3} rowsPerGroup={4} secondaryCard={true} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>{accountMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  const hasTransactions = account.transactionsPage.totalCount > 0;
  const hasDelegations = account.delegationsCount > 0;
  const resolvedActiveTab =
    activeTab === 'delegations' && !hasDelegations
      ? hasTransactions
        ? 'transactions'
        : 'json'
      : activeTab === 'transactions' && !hasTransactions
        ? hasDelegations
          ? 'delegations'
          : 'json'
        : activeTab;
  const evmHexAddress = decodeCosmosAddressToEvmHexAddress(account.address);

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{accountMessages.account}</h1>
            <span className={`${nameTag ? 'text-sm font-semibold text-slate-900' : 'text-sm font-medium text-slate-500 mono'}`}>{nameTag ?? account.address}</span>
            <ActionIconButton tooltip={nameTag ? accountMessages.editTag : accountMessages.addTag} className="text-slate-400 hover:text-sky-600" onClick={openTagDialog}>
              <IconTag className="size-4" stroke={1.8} />
            </ActionIconButton>
          </div>
          {nameTag ? <p className="mt-2 text-sm font-medium text-slate-500 mono">{account.address}</p> : null}
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r xl:border-b-0">
              <AccountMetric label={accountMessages.type} value={translateRuntimeText(account.type, locale)} />
            </div>
            <div className="border-b border-slate-200 p-5 xl:border-r xl:border-b-0">
              <AccountMetric label={accountMessages.accountNumber} value={account.accountNumberLabel} />
            </div>
            <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r xl:border-b-0">
              <AccountMetric label={accountMessages.sequence} value={account.sequenceLabel} />
            </div>
            <div className="p-5">
              <AccountMetric label={accountMessages.transactions} value={account.transactionsPage.totalCount.toLocaleString(locale)} />
            </div>
          </div>

          <div className="border-t border-slate-200">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{accountMessages.evmHex}</p>
              <div className="mt-2 inline-flex max-w-full items-start gap-1">
                <p className="min-w-0 break-all font-mono text-sm font-medium text-slate-900">{evmHexAddress ?? messages.common.unavailable}</p>
                {evmHexAddress ? (
                  <span className="relative inline-flex shrink-0">
                    <button
                      ref={evmHexCopyButtonRef}
                      type="button"
                      className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
                      aria-label={messages.common.copyAddress}
                      onClick={() => void handleCopyEvmHex(evmHexAddress)}
                    >
                      <IconCopy className="size-4" stroke={1.8} />
                    </button>
                    <FloatingTooltip
                      open={evmHexCopied}
                      anchorRef={evmHexCopyButtonRef}
                      className="whitespace-nowrap border border-slate-200 bg-white text-slate-700"
                    >
                      <span className="block whitespace-nowrap">{messages.common.addressCopied}</span>
                    </FloatingTooltip>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{accountMessages.balances}</p>
                <p className="mt-1 text-sm text-slate-500">{accountMessages.balancesDescription}</p>
              </div>
            </div>

            {account.balances.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1120px] table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[360px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.denom}</th>
                      <th className="w-[360px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{bankSupplyMessages.readable}</th>
                      <th className="w-[400px] border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{bankSupplyMessages.rawAmount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.balances.map((balance, index) => (
                      <tr key={`${balance.denom}-${index}`} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm text-slate-700 mono">
                          <AccountBalanceTooltipValue label={balance.denom} rawValue={balance.denom} />
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-900 mono">
                          <AccountBalanceTooltipValue
                            label={`${formatReadableTokenAmount(balance.amount)} ${formatReadableDenom(balance.denom)}`}
                            rawValue={`${balance.amount} ${balance.denom}`}
                          />
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700 mono">
                          <AccountBalanceTooltipValue label={balance.amount} rawValue={balance.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state m-5">{accountMessages.noBalancesReturned}</div>
            )}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
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
            {hasTransactions ? `${accountMessages.transactions} (${account.transactionsPage.totalCount})` : accountMessages.transactions}
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
            {hasDelegations ? `${accountMessages.delegations} (${account.delegationsCount})` : accountMessages.delegations}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === 'transactions' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{accountMessages.transactions}</p>
                <p className="mt-1 text-sm text-slate-500">{accountMessages.transactionsDescription}</p>
              </div>
              <PaginationControls
                page={account.transactionsPage.page}
                totalPages={account.transactionsPage.totalPages}
                hasPreviousPage={account.transactionsPage.hasPreviousPage}
                hasNextPage={account.transactionsPage.hasNextPage}
                plain
                onPageChange={setCurrentTxPage}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.hash}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.type}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosTxDetail.block}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.age}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.from}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.gasUsedWanted}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.fee}</th>
                  </tr>
                </thead>
                <tbody>
                  {account.transactionsPage.items.map((transaction) => (
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
                        {transaction.sender === accountMessages.unknown ? (
                          <span className="text-slate-500">{translateRuntimeText(accountMessages.unknown, locale)}</span>
                        ) : (
                          <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/account/${transaction.sender}`}>
                            {translateRuntimeText(nameTagsByAddress[transaction.sender] ?? transaction.senderLabel, locale)}
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
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">{accountMessages.delegations}</p>
              <p className="mt-1 text-sm text-slate-500">{accountMessages.delegationsDescription}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.validators}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.operatorAddress}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.amount}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosValidatorDetail.delegatorShares}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {account.delegations.map((delegation) => (
                    <tr key={delegation.validatorAddress} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm text-slate-700">
                        <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${delegation.validatorAddress}`}>
                          {translateRuntimeText(delegation.validatorMoniker ?? accountMessages.unknown, locale)}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 mono">
                        <Link className="text-sky-600 hover:text-sky-700" href={`/cosmos/validator/${delegation.validatorAddress}`}>
                          {delegation.validatorAddressLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{translateRuntimeText(delegation.amountLabel, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-900 mono">{translateRuntimeText(delegation.sharesLabel, locale)}</td>
                      <td className="px-5 py-3 text-right text-sm">
                        <ActionIconButton tooltip={accountMessages.undelegate} className="text-slate-400 hover:text-sky-600" onClick={() => setSelectedUndelegation(delegation)}>
                          <IconArrowBackUp className="size-4" stroke={1.8} />
                        </ActionIconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <UndelegateDialog
          delegation={selectedUndelegation}
          open={Boolean(selectedUndelegation)}
          onSuccess={handleUndelegateSuccess}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSelectedUndelegation(null);
            }
          }}
        />

        {resolvedActiveTab === 'json' ? (
          <JsonViewPanel className="mt-4" value={account.rawJson as object} />
        ) : null}

        <ModalDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          title={nameTag ? accountMessages.editTag : accountMessages.addTag}
          description={`${messages.nameTags.setLabelForAddress} ${account.address}.`}
          footer={
            <>
              {nameTag ? (
                <Button type="button" variant="outline" onClick={() => void handleRemoveTag()}>
                  {messages.nameTags.remove}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>
                {messages.nameTags.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSaveTag()}>
                {messages.nameTags.save}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <label className="grid gap-2 pb-1">
            <span className="text-sm font-medium text-slate-700">{messages.labels.tag}</span>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder={messages.labels.tag} />
          </label>
        </ModalDialog>
      </main>
    </AppShell>
  );
}
