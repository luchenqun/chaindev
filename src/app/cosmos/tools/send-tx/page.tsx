'use client';

import { IconCopy, IconX } from '@tabler/icons-react';
import { fromHex, toBech32 } from '@cosmjs/encoding';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import type { Locale } from '@/i18n/config';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import {
  broadcastCosmosGenericMessage,
  COSMOS_GENERIC_MESSAGE_TYPES,
  COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER,
  COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER,
  getActiveCosmosAccountPrefixDirect,
  type CosmosBroadcastResult,
  type CosmosSigningAlgorithm,
} from '@/domains/cosmos/client/signing-transactions';
import { formatCompactHash } from '@/domains/cosmos/client/tx-helpers';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { AppShell } from '@/platform/layout/app-shell';

const INTEGER_SCALE_OPTIONS = [6, 9, 12, 15, 18] as const;
const DEFAULT_TRANSACTION_TYPE = COSMOS_GENERIC_MESSAGE_TYPES[0]?.typeUrl ?? '';
const COSMOS_SEND_TX_FORM_CACHE_KEY = 'cosmos-send-tx-form:v1';
const messageJsonTextareaClassName =
  'min-h-10 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

type CosmosTxType = string;
type CosmosSendTxFormCache = {
  messageTypeUrl?: string;
  signingAlgorithm?: CosmosSigningAlgorithm;
  gasPriceAmount?: string;
  gasPriceDenom?: string;
  messageJson?: string;
};

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

function getActionLabel(type: CosmosTxType, fallbackLabel: string, locale: Locale) {
  const label = COSMOS_GENERIC_MESSAGE_TYPES.find((item) => item.typeUrl === type)?.label ?? fallbackLabel;
  return translateRuntimeText(label, locale);
}

function resultToastDescription(result: CosmosBroadcastResult) {
  return (
    <span className="block min-w-0 max-w-full">
      <span className="block truncate font-mono text-xs text-slate-500" title={result.delegatorAddress}>
        {formatCompactHash(result.delegatorAddress, 12, 8)}
      </span>
      <Link className="mt-1 block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${result.transactionHash}`} title={result.transactionHash}>
        {formatCompactHash(result.transactionHash, 14, 10)}
      </Link>
    </span>
  );
}

function encodeJsonValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Uint8Array) {
    return bytesToBase64(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, encodeJsonValue(nestedValue)]));
  }

  return value;
}

function formatMessageTemplate(typeUrl: string, address = '', accountPrefix = 'cosmos') {
  const template = COSMOS_GENERIC_MESSAGE_TYPES.find((item) => item.typeUrl === typeUrl)?.template ?? {};
  const fallbackAddress = `${accountPrefix}1...`;
  const fallbackValidatorAddress = `${accountPrefix}valoper1...`;

  return JSON.stringify(template, null, 2)
    .replaceAll(COSMOS_ADDRESS_TEMPLATE_PLACEHOLDER, address || fallbackAddress)
    .replaceAll(COSMOS_VALIDATOR_TEMPLATE_PLACEHOLDER, fallbackValidatorAddress);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function isCosmosSigningAlgorithm(value: unknown): value is CosmosSigningAlgorithm {
  return value === 'ethsecp256k1' || value === 'secp256k1';
}

function isSupportedCosmosMessageType(typeUrl: unknown): typeUrl is string {
  return typeof typeUrl === 'string' && COSMOS_GENERIC_MESSAGE_TYPES.some((item) => item.typeUrl === typeUrl);
}

function parseRepeatCount(value: string, invalidMessage: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 1;
  }

  if (!/^\d+$/.test(trimmedValue)) {
    throw new Error(invalidMessage);
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(invalidMessage);
  }

  return parsedValue;
}

function waitForUiRefresh() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0);
    });
  });
}

function readCosmosSendTxFormCache(): CosmosSendTxFormCache | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(COSMOS_SEND_TX_FORM_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return null;
    }

    const candidate = parsedValue as Record<string, unknown>;

    return {
      messageTypeUrl: isSupportedCosmosMessageType(candidate.messageTypeUrl) ? candidate.messageTypeUrl : undefined,
      signingAlgorithm: isCosmosSigningAlgorithm(candidate.signingAlgorithm) ? candidate.signingAlgorithm : undefined,
      gasPriceAmount: typeof candidate.gasPriceAmount === 'string' ? candidate.gasPriceAmount : undefined,
      gasPriceDenom: typeof candidate.gasPriceDenom === 'string' ? candidate.gasPriceDenom : undefined,
      messageJson: typeof candidate.messageJson === 'string' ? candidate.messageJson : undefined,
    };
  } catch {
    return null;
  }
}

function writeCosmosSendTxFormCache(cache: CosmosSendTxFormCache) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(COSMOS_SEND_TX_FORM_CACHE_KEY, JSON.stringify(cache));
}

type BroadcastProgress = {
  total: number;
  completed: number;
  current: number;
  status: 'running' | 'cancel-requested' | 'stopped' | 'completed';
};

function CosmosSendTxContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.cosmosSendTx;
  const { showToast } = useToast();
  const [transactionType, setTransactionType] = useState<CosmosTxType>(DEFAULT_TRANSACTION_TYPE);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [accountPrefix, setAccountPrefix] = useState('cosmos');
  const [activeCosmosAddress, setActiveCosmosAddress] = useState('');
  const [messageJson, setMessageJson] = useState(() => formatMessageTemplate(DEFAULT_TRANSACTION_TYPE));
  const [gasPriceAmount, setGasPriceAmount] = useState('');
  const [gasPriceDenom, setGasPriceDenom] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [repeatCount, setRepeatCount] = useState('');
  const [receiptPollIntervalMs, setReceiptPollIntervalMs] = useState('');
  const [signingAlgorithm, setSigningAlgorithm] = useState<CosmosSigningAlgorithm>('ethsecp256k1');
  const [memo, setMemo] = useState('');
  const [broadcastResult, setBroadcastResult] = useState<unknown>(null);
  const [broadcastResultVersion, setBroadcastResultVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [formCacheLoaded, setFormCacheLoaded] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const addressCopyTimeoutRef = useRef<number | null>(null);
  const addressCopyButtonRef = useRef<HTMLButtonElement | null>(null);
  const stopRequestedRef = useRef(false);

  const actionLabel = getActionLabel(transactionType, pageMessages.genericTransaction, locale);

  function handleTransactionTypeChange(nextType: string) {
    setTransactionType(nextType);
    setMessageJson(formatMessageTemplate(nextType, activeCosmosAddress, accountPrefix));
    setFormError(null);
    setBroadcastResult(null);
  }

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    return () => {
      if (addressCopyTimeoutRef.current != null) {
        window.clearTimeout(addressCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const cache = readCosmosSendTxFormCache();

    if (cache?.messageTypeUrl) {
      setTransactionType(cache.messageTypeUrl);
    }

    if (cache?.signingAlgorithm) {
      setSigningAlgorithm(cache.signingAlgorithm);
    }

    if (typeof cache?.gasPriceAmount === 'string') {
      setGasPriceAmount(cache.gasPriceAmount);
    }

    if (typeof cache?.gasPriceDenom === 'string') {
      setGasPriceDenom(cache.gasPriceDenom);
    }

    if (typeof cache?.messageJson === 'string') {
      setMessageJson(cache.messageJson);
    }

    setFormCacheLoaded(true);
  }, []);

  useEffect(() => {
    let disposed = false;

    void getActiveCosmosAccountPrefixDirect().then((prefix) => {
      if (!disposed) {
        setAccountPrefix(prefix);
      }
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setFormError(null);
  }, [transactionType]);

  useEffect(() => {
    if (!activeKey) {
      setActiveCosmosAddress('');
      return;
    }

    try {
      setActiveCosmosAddress(toBech32(accountPrefix, fromHex(activeKey.address.replace(/^0x/i, ''))));
    } catch {
      setActiveCosmosAddress('');
    }
  }, [accountPrefix, activeKey]);

  useEffect(() => {
    setMessageJson((current) => {
      const defaultCosmosTemplate = formatMessageTemplate(transactionType, '', 'cosmos');
      const defaultCurrentTemplate = formatMessageTemplate(transactionType, '', accountPrefix);

      return current === defaultCosmosTemplate || current === defaultCurrentTemplate ? formatMessageTemplate(transactionType, activeCosmosAddress, accountPrefix) : current;
    });
  }, [accountPrefix, activeCosmosAddress, transactionType]);

  async function broadcast(password?: string) {
    if (!activeKey) {
      setFormError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setBroadcastResult(null);
    setBroadcastResultVersion(0);
    stopRequestedRef.current = false;
    writeCosmosSendTxFormCache({
      messageTypeUrl: transactionType,
      signingAlgorithm,
      gasPriceAmount,
      gasPriceDenom,
      messageJson,
    });

    try {
      const totalCount = parseRepeatCount(repeatCount, pageMessages.repeatCountMustBePositiveInteger);
      setBroadcastProgress(
        totalCount > 1
          ? {
              total: totalCount,
              completed: 0,
              current: 1,
              status: 'running',
            }
          : null,
      );
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const baseInput = {
        privateKey,
        accountPrefix,
        signingAlgorithm,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        gasLimit,
        broadcastPollIntervalMs: receiptPollIntervalMs,
        memo,
      };
      const results: CosmosBroadcastResult[] = [];

      for (let index = 0; index < totalCount; index += 1) {
        if (stopRequestedRef.current) {
          setBroadcastProgress((current) =>
            current
              ? {
                  ...current,
                  status: 'stopped',
                }
              : current,
          );
          break;
        }

        setBroadcastProgress((current) =>
          current
            ? {
                ...current,
                current: index + 1,
              }
            : current,
        );

        const result = await broadcastCosmosGenericMessage({
          ...baseInput,
          messageTypeUrl: transactionType,
          messageJson,
        });

        results.push(result);
        setBroadcastResult(encodeJsonValue(result.response));
        setBroadcastResultVersion(index + 1);
        setBroadcastProgress((current) =>
          current
            ? {
                ...current,
                completed: index + 1,
              }
            : current,
        );

        if (stopRequestedRef.current) {
          setBroadcastProgress((current) =>
            current
              ? {
                  ...current,
                  status: 'stopped',
                }
              : current,
          );
          break;
        }

        if (index < totalCount - 1) {
          await waitForUiRefresh();
        }
      }

      if (results.length === 0) {
        return;
      }

      if (totalCount > 1 && !stopRequestedRef.current) {
        setBroadcastProgress((current) =>
          current
            ? {
                ...current,
                status: 'completed',
              }
            : current,
        );
      }

      const latestResult = results[results.length - 1];

      showToast({
        title:
          totalCount > 1
            ? stopRequestedRef.current
              ? pageMessages.transactionBroadcastStopped.replace('{action}', actionLabel)
              : pageMessages.transactionsBroadcasted.replace('{action}', actionLabel)
            : pageMessages.transactionBroadcasted.replace('{action}', actionLabel),
        description: resultToastDescription(latestResult),
        durationMs: 8000,
      });
    } catch (error) {
      const message = error instanceof Error ? translateRuntimeText(error.message, locale) : pageMessages.failedToBroadcastTransaction.replace('{action}', actionLabel.toLowerCase());

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setFormError(message);
    } finally {
      setSubmitting(false);
      stopRequestedRef.current = false;
    }
  }

  async function handleCopyActiveAddress() {
    const copyValue = activeCosmosAddress || activeKey?.address;

    if (!copyValue) {
      return;
    }

    await copyText(copyValue);
    setAddressCopied(true);

    if (addressCopyTimeoutRef.current != null) {
      window.clearTimeout(addressCopyTimeoutRef.current);
    }

    addressCopyTimeoutRef.current = window.setTimeout(() => {
      setAddressCopied(false);
      addressCopyTimeoutRef.current = null;
    }, 1600);
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
      await broadcast(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? translateRuntimeText(error.message, locale) : messages.evmTxDetail.failedToUnlockPrivateKey);
    }
  }

  function clearForm() {
    setMessageJson(formatMessageTemplate(transactionType, activeCosmosAddress, accountPrefix));
    setGasPriceAmount('');
    setGasPriceDenom('');
    setGasLimit('');
    setRepeatCount('');
    setReceiptPollIntervalMs('');
    setMemo('');
    setBroadcastResult(null);
    setBroadcastProgress(null);
    setFormError(null);
  }

  function handleStopBroadcast() {
    stopRequestedRef.current = true;
    setBroadcastProgress((current) =>
      current
        ? {
            ...current,
            status: 'cancel-requested',
          }
        : current,
    );
  }

  const latestBroadcastResult = broadcastResult;
  const latestTransactionHash =
    latestBroadcastResult && typeof latestBroadcastResult === 'object' && 'transactionHash' in latestBroadcastResult && typeof latestBroadcastResult.transactionHash === 'string'
      ? latestBroadcastResult.transactionHash
      : null;
  const broadcastResultRenderKey = latestTransactionHash
    ? `single:${broadcastResultVersion}:${latestTransactionHash}`
    : `single:${broadcastResultVersion}:empty`;
  const progressPercent = broadcastProgress ? Math.min(100, Math.round((broadcastProgress.completed / broadcastProgress.total) * 100)) : 0;

  return (
    <>
      <main className="section-block">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="shrink-0 text-2xl font-semibold text-slate-950">{pageMessages.pageTitle}</h1>
              <p className="min-w-0 truncate text-sm text-slate-500">{pageMessages.pageDescription}</p>
              </div>
              <span className="inline-flex min-w-0 shrink-0 items-center gap-1.5 truncate text-sm font-medium text-slate-700" title={activeCosmosAddress || activeKey?.address || undefined}>
                {activeKey ? (
                  <>
                    {activeCosmosAddress ? (
                      <Link className="font-mono text-xs text-sky-600 hover:text-sky-700" href={`/cosmos/account/${activeCosmosAddress}`}>
                        {formatCompactHash(activeCosmosAddress, 12, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-slate-500">{formatCompactHash(activeKey.address, 12, 8)}</span>
                    )}
                    <span className="relative inline-flex shrink-0">
                      <button
                        ref={addressCopyButtonRef}
                        type="button"
                        className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
                        aria-label={pageMessages.copyAddress}
                        onClick={() => void handleCopyActiveAddress()}
                      >
                        <IconCopy className="size-4" stroke={1.8} />
                      </button>
                      <FloatingTooltip open={addressCopied} anchorRef={addressCopyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
                        <span className="block whitespace-nowrap">{pageMessages.copied}</span>
                      </FloatingTooltip>
                    </span>
                  </>
                ) : (
                  pageMessages.noActiveAddress
                )}
              </span>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid items-end gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="cosmos-tx-type">
                      {pageMessages.transactionType}
                    </label>
                    <Select value={transactionType} disabled={submitting} onValueChange={handleTransactionTypeChange}>
                      <SelectTrigger id="cosmos-tx-type" className="mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[420px]">
                        {COSMOS_GENERIC_MESSAGE_TYPES.map((item) => (
                          <SelectItem key={item.typeUrl} value={item.typeUrl}>
                            {`${translateRuntimeText(item.label, locale)} (${translateRuntimeText(item.module, locale)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="cosmos-signing">
                      {pageMessages.signing}
                    </label>
                    <Select value={signingAlgorithm} disabled={submitting} onValueChange={(value) => setSigningAlgorithm(value as CosmosSigningAlgorithm)}>
                      <SelectTrigger id="cosmos-signing" className="mt-1 h-10">
                        {signingAlgorithm}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                        <SelectItem value="secp256k1">secp256k1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-gas-price">
                    {pageMessages.gasPrice}
                  </label>
                  <div className="mt-1 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_100px]">
                    <ScaledInput
                      id="tx-gas-price"
                      value={gasPriceAmount}
                      inputMode="decimal"
                      placeholder={pageMessages.gasPricePlaceholder}
                      disabled={submitting}
                      onChange={setGasPriceAmount}
                    />
                    <Input
                      id="tx-gas-denom"
                      value={gasPriceDenom}
                      placeholder={pageMessages.gasDenomPlaceholder}
                      disabled={submitting}
                      onChange={(event) => setGasPriceDenom(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-gas-limit">
                    {pageMessages.gasLimit}
                  </label>
                  <Input
                    id="tx-gas-limit"
                    value={gasLimit}
                    inputMode="numeric"
                    placeholder={pageMessages.auto}
                    disabled={submitting}
                    className="mt-1"
                    onChange={(event) => setGasLimit(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-repeat-count">
                    {pageMessages.repeatBroadcasts}
                  </label>
                  <Input
                    id="tx-repeat-count"
                    value={repeatCount}
                    inputMode="numeric"
                    placeholder={pageMessages.repeatBroadcastsPlaceholder}
                    disabled={submitting}
                    className="mt-1"
                    onChange={(event) => setRepeatCount(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-receipt-poll-interval">
                    {pageMessages.receiptPollInterval}
                  </label>
                  <Input
                    id="tx-receipt-poll-interval"
                    value={receiptPollIntervalMs}
                    inputMode="numeric"
                    placeholder={pageMessages.optional}
                    disabled={submitting}
                    className="mt-1"
                    onChange={(event) => setReceiptPollIntervalMs(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-memo">
                    {pageMessages.memo}
                  </label>
                  <Input id="tx-memo" value={memo} placeholder={pageMessages.optional} disabled={submitting} className="mt-1" onChange={(event) => setMemo(event.target.value)} />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="message-json">
                    {pageMessages.messageValue}
                  </label>
                  <JsonInput
                    value={messageJson}
                    onChange={setMessageJson}
                    placeholder={formatMessageTemplate(transactionType, activeCosmosAddress, accountPrefix)}
                    textareaClassName={`mt-1 ${messageJsonTextareaClassName}`}
                  />
                </div>

                {formError ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-4">{translateRuntimeText(formError, locale)}</p> : null}
              </div>

              {broadcastProgress ? (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span>
                      {broadcastProgress.status === 'cancel-requested'
                        ? pageMessages.progressCancelRequested.replace('{completed}', String(broadcastProgress.completed)).replace('{total}', String(broadcastProgress.total))
                        : broadcastProgress.status === 'stopped'
                          ? pageMessages.progressStopped.replace('{completed}', String(broadcastProgress.completed)).replace('{total}', String(broadcastProgress.total))
                          : broadcastProgress.status === 'completed'
                            ? pageMessages.progressCompleted.replace('{completed}', String(broadcastProgress.completed)).replace('{total}', String(broadcastProgress.total))
                            : pageMessages.progressRunning.replace('{completed}', String(broadcastProgress.completed)).replace('{total}', String(broadcastProgress.total))}
                    </span>
                    <span>
                      {broadcastProgress.status === 'cancel-requested'
                        ? pageMessages.waitingForCurrentTx
                        : broadcastProgress.status === 'stopped'
                          ? pageMessages.stopped
                          : broadcastProgress.completed < broadcastProgress.total && submitting
                            ? pageMessages.progressSending.replace('{current}', String(Math.min(broadcastProgress.current, broadcastProgress.total))).replace('{total}', String(broadcastProgress.total))
                            : `${progressPercent}%`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-[width] duration-200 ${
                        broadcastProgress.status === 'cancel-requested' ? 'bg-amber-500' : broadcastProgress.status === 'stopped' ? 'bg-slate-400' : 'bg-sky-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-4">
                <div className="min-w-0">
                  {typeof latestTransactionHash === 'string' ? (
                    <span className="inline-flex min-w-0 max-w-full items-center text-sm leading-5 text-slate-700">
                      <span className="shrink-0 font-medium leading-5">{pageMessages.viewTx}&nbsp;</span>
                      <Link className="translate-y-[1px] truncate text-sm font-semibold leading-5 text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${latestTransactionHash}`}>
                        {formatCompactHash(latestTransactionHash, 10, 8)}
                      </Link>
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <Button type="button" variant="outline" disabled={submitting} onClick={clearForm}>
                    {pageMessages.clear}
                  </Button>
                  {submitting && broadcastProgress?.status === 'running' ? (
                    <Button type="button" variant="outline" onClick={handleStopBroadcast}>
                      {pageMessages.stop}
                    </Button>
                  ) : null}
                  {submitting && broadcastProgress?.status === 'cancel-requested' ? (
                    <Button type="button" variant="outline" disabled>
                      {pageMessages.cancelRequested}
                    </Button>
                  ) : null}
                  <Button type="button" disabled={submitting} onClick={() => void broadcast()}>
                    {submitting ? (broadcastProgress?.status === 'cancel-requested' ? pageMessages.stopping : pageMessages.broadcasting) : pageMessages.broadcast}
                  </Button>
                </div>
              </div>

              {broadcastResult ? (
                <div className="border-t border-slate-200 pt-4">
                  <JsonViewPanel
                    key={broadcastResultRenderKey}
                    className="max-h-[1080px] overflow-y-auto overflow-x-hidden bg-slate-50 shadow-none"
                    jsonClassName="whitespace-pre-wrap break-all"
                    value={broadcastResult as object}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

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
        description={activeKey ? pageMessages.unlockDescription.replace('{name}', activeKey.name).replace('{action}', actionLabel.toLowerCase()) : pageMessages.unlockFallbackDescription}
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

export default function CosmosSendTxPage() {
  return (
    <AppShell mode="cosmos">
      <CosmosSendTxContent />
    </AppShell>
  );
}
