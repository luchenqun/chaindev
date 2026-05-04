'use client';

import { IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseEther } from 'viem';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { forceSendEvmTransactionDirect } from '@/domains/evm/client/contract-executor';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { getEvmCurrencyName } from '@/platform/workbench/rpc-profile';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

const EVM_SEND_TX_FORM_CACHE_KEY = 'evm-send-tx-form:v1';

type BroadcastProgress = {
  total: number;
  completed: number;
  current: number;
  status: 'running' | 'cancel-requested' | 'stopped' | 'completed';
};

type EvmSendTxFormCache = {
  toMode?: 'fixed' | 'random';
  toAddress?: string;
  valueMode?: 'fixed' | 'random';
  value?: string;
  maxValue?: string;
  gasLimit?: string;
  repeatCount?: string;
  receiptPollIntervalMs?: string;
  transactionType?: 'LEGACY' | 'EIP1559';
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
  data?: string;
};

function parseRepeatCount(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 1;
  }

  if (!/^\d+$/.test(trimmedValue)) {
    throw new Error('__REPEAT_COUNT_ERROR__');
  }

  const parsedValue = Number.parseInt(trimmedValue, 10);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('__REPEAT_COUNT_ERROR__');
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

function normalizeTransactionData(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  if (!/^0x[0-9a-fA-F]*$/.test(trimmedValue) || trimmedValue.length % 2 !== 0) {
    throw new Error('__INVALID_TX_DATA__');
  }

  return trimmedValue;
}

function createRandomEvmAddress() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function randomBigIntBetween(min: bigint, max: bigint) {
  if (max < min) {
    throw new Error('__MAX_VALUE_RANGE_ERROR__');
  }

  if (max === min) {
    return min;
  }

  const range = max - min + 1n;
  const bitLength = range.toString(2).length;
  const byteLength = Math.ceil(bitLength / 8);

  while (true) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);

    let candidate = 0n;

    for (const byte of bytes) {
      candidate = (candidate << 8n) + BigInt(byte);
    }

    if (candidate < range) {
      return min + candidate;
    }
  }
}

function normalizeRandomValueRange(maxValue: string) {
  const normalizedMaxValue = maxValue.trim();

  if (!normalizedMaxValue) {
    throw new Error('__MAX_VALUE_REQUIRED__');
  }

  const maxWei = parseEther(normalizedMaxValue);
  const minWei = maxWei / 100n;

  if (maxWei < minWei) {
    throw new Error('__MAX_VALUE_RANGE_ERROR__');
  }

  return {
    minWei,
    maxWei,
  };
}

function formatRandomValueForSend(maxValue: string) {
  const { minWei, maxWei } = normalizeRandomValueRange(maxValue);
  const nextWei = randomBigIntBetween(minWei, maxWei);
  const integerPart = nextWei / 10n ** 18n;
  const fractionalPart = nextWei % 10n ** 18n;
  const fractionalText = fractionalPart.toString().padStart(18, '0').replace(/0+$/, '');

  return fractionalText ? `${integerPart}.${fractionalText}` : integerPart.toString();
}

function formatCompactHash(value: string, start = 10, end = 8) {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function resultToastDescription(hash: string) {
  return (
    <Link className="block truncate font-mono text-xs font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${hash}`} title={hash}>
      {formatCompactHash(hash, 14, 10)}
    </Link>
  );
}

function InlineModeSelect({
  value,
  disabled,
  onValueChange,
}: {
  value: 'fixed' | 'random';
  disabled?: boolean;
  onValueChange: (value: 'fixed' | 'random') => void;
}) {
  const messages = useMessages();
  const sendTxMessages = messages.sendTx;

  return (
    <Select value={value} disabled={disabled} onValueChange={(nextValue) => onValueChange(nextValue as 'fixed' | 'random')}>
      <SelectTrigger className="absolute left-1.5 top-1/2 h-[30px] w-[92px] -translate-y-1/2 border-0 bg-transparent px-2 text-xs font-medium text-slate-700 shadow-none ring-0 focus:ring-0 focus-visible:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fixed">{sendTxMessages.fixed}</SelectItem>
        <SelectItem value="random">{sendTxMessages.random}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function handleToModeChange(nextValue: 'fixed' | 'random', setToMode: (value: 'fixed' | 'random') => void, setToAddress: (value: string) => void) {
  setToMode(nextValue);

  if (nextValue === 'random') {
    setToAddress('');
  }
}

function readEvmSendTxFormCache(): EvmSendTxFormCache | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(EVM_SEND_TX_FORM_CACHE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return null;
    }

    const candidate = parsedValue as Record<string, unknown>;
    const transactionType = candidate.transactionType === 'LEGACY' || candidate.transactionType === 'EIP1559' ? candidate.transactionType : undefined;
    const toMode = candidate.toMode === 'fixed' || candidate.toMode === 'random' ? candidate.toMode : undefined;
    const valueMode = candidate.valueMode === 'fixed' || candidate.valueMode === 'random' ? candidate.valueMode : undefined;

    return {
      toMode,
      toAddress: typeof candidate.toAddress === 'string' ? candidate.toAddress : undefined,
      valueMode,
      value: typeof candidate.value === 'string' ? candidate.value : undefined,
      maxValue: typeof candidate.maxValue === 'string' ? candidate.maxValue : undefined,
      gasLimit: typeof candidate.gasLimit === 'string' ? candidate.gasLimit : undefined,
      repeatCount: typeof candidate.repeatCount === 'string' ? candidate.repeatCount : undefined,
      receiptPollIntervalMs: typeof candidate.receiptPollIntervalMs === 'string' ? candidate.receiptPollIntervalMs : undefined,
      transactionType,
      gasPrice: typeof candidate.gasPrice === 'string' ? candidate.gasPrice : undefined,
      maxFeePerGas: typeof candidate.maxFeePerGas === 'string' ? candidate.maxFeePerGas : undefined,
      maxPriorityFeePerGas: typeof candidate.maxPriorityFeePerGas === 'string' ? candidate.maxPriorityFeePerGas : undefined,
      nonce: typeof candidate.nonce === 'string' ? candidate.nonce : undefined,
      data: typeof candidate.data === 'string' ? candidate.data : undefined,
    };
  } catch {
    return null;
  }
}

function writeEvmSendTxFormCache(cache: EvmSendTxFormCache) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EVM_SEND_TX_FORM_CACHE_KEY, JSON.stringify(cache));
}

function EvmSendTxContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const sendTxMessages = messages.sendTx;
  const commonMessages = messages.common;
  const { showToast } = useToast();
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [fromAddressCopied, setFromAddressCopied] = useState(false);
  const [toMode, setToMode] = useState<'fixed' | 'random'>('fixed');
  const [toAddress, setToAddress] = useState('');
  const [valueMode, setValueMode] = useState<'fixed' | 'random'>('fixed');
  const [value, setValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [repeatCount, setRepeatCount] = useState('');
  const [receiptPollIntervalMs, setReceiptPollIntervalMs] = useState('');
  const [transactionType, setTransactionType] = useState<'LEGACY' | 'EIP1559'>('EIP1559');
  const [gasPrice, setGasPrice] = useState('');
  const [maxFeePerGas, setMaxFeePerGas] = useState('');
  const [maxPriorityFeePerGas, setMaxPriorityFeePerGas] = useState('');
  const [nonce, setNonce] = useState('');
  const [data, setData] = useState('0x');
  const [txResult, setTxResult] = useState<unknown>(null);
  const [txResultVersion, setTxResultVersion] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);
  const [formCacheLoaded, setFormCacheLoaded] = useState(false);

  const currencyName = getEvmCurrencyName(readActiveRpcProfileCookie('evm')?.nativeCurrencySymbol);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const cache = readEvmSendTxFormCache();

    if (cache?.toMode) {
      setToMode(cache.toMode);
    }

    if (typeof cache?.toAddress === 'string') {
      setToAddress(cache.toAddress);
    }

    if (cache?.valueMode) {
      setValueMode(cache.valueMode);
    }

    if (typeof cache?.value === 'string') {
      setValue(cache.value);
    }

    if (typeof cache?.maxValue === 'string') {
      setMaxValue(cache.maxValue);
    }

    if (typeof cache?.gasLimit === 'string') {
      setGasLimit(cache.gasLimit);
    }

    if (typeof cache?.repeatCount === 'string') {
      setRepeatCount(cache.repeatCount);
    }

    if (typeof cache?.receiptPollIntervalMs === 'string') {
      setReceiptPollIntervalMs(cache.receiptPollIntervalMs);
    }

    if (cache?.transactionType) {
      setTransactionType(cache.transactionType);
    }

    if (typeof cache?.gasPrice === 'string') {
      setGasPrice(cache.gasPrice);
    }

    if (typeof cache?.maxFeePerGas === 'string') {
      setMaxFeePerGas(cache.maxFeePerGas);
    }

    if (typeof cache?.maxPriorityFeePerGas === 'string') {
      setMaxPriorityFeePerGas(cache.maxPriorityFeePerGas);
    }

    if (typeof cache?.nonce === 'string') {
      setNonce(cache.nonce);
    }

    if (typeof cache?.data === 'string') {
      setData(cache.data);
    }

    setFormCacheLoaded(true);
  }, []);

  useEffect(() => {
    if (!formCacheLoaded) {
      return;
    }

    writeEvmSendTxFormCache({
      toMode,
      toAddress,
      valueMode,
      value,
      maxValue,
      gasLimit,
      repeatCount,
      receiptPollIntervalMs,
      transactionType,
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      data,
    });
  }, [data, formCacheLoaded, gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas, maxValue, nonce, receiptPollIntervalMs, repeatCount, toAddress, toMode, transactionType, value, valueMode]);

  async function handleCopyFromAddress() {
    if (!activeKey?.address) {
      return;
    }

    await copyText(activeKey.address);
    setFromAddressCopied(true);

    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = window.setTimeout(() => {
      setFromAddressCopied(false);
      copyTimeoutRef.current = null;
    }, 1600);
  }

  async function submit(password?: string) {
    if (!activeKey) {
      setFormError(sendTxMessages.missingActiveKey);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setTxResult(null);
    setTxResultVersion(0);
    stopRequestedRef.current = false;

    try {
      const totalCount = parseRepeatCount(repeatCount);
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
      const normalizedData = normalizeTransactionData(data);
      const results: Array<{
        hash: string;
        receipt: {
          status: string;
          blockNumber: string;
          blockTimestamp: number;
          gasUsed: string;
          effectiveGasPrice: string;
        };
      }> = [];

      for (let index = 0; index < totalCount; index += 1) {
        if (stopRequestedRef.current) {
          setBroadcastProgress((current) => (current ? { ...current, status: 'stopped' } : current));
          break;
        }

        setBroadcastProgress((current) => (current ? { ...current, current: index + 1 } : current));

        const nextToAddress = toMode === 'random' ? createRandomEvmAddress() : toAddress;
        const nextValue = valueMode === 'random' ? formatRandomValueForSend(maxValue) : value;

        const result = await forceSendEvmTransactionDirect({
          to: nextToAddress,
          privateKey,
          transactionType,
          value: nextValue,
          gasLimit,
          gasPrice,
          maxFeePerGas,
          maxPriorityFeePerGas,
          nonce,
          data: normalizedData,
          receiptPollIntervalMs,
        });

        const encodedResult = {
          hash: result.hash,
          receipt: {
            status: result.receipt.status,
            blockNumber: result.receipt.blockNumber,
            blockTimestamp: result.receipt.blockTimestamp,
            gasUsed: result.receipt.gasUsed,
            effectiveGasPrice: result.receipt.effectiveGasPrice,
          },
        };

        results.push(encodedResult);
        setTxResult(encodedResult);
        setTxResultVersion(index + 1);
        setBroadcastProgress((current) => (current ? { ...current, completed: index + 1 } : current));

        if (stopRequestedRef.current) {
          setBroadcastProgress((current) => (current ? { ...current, status: 'stopped' } : current));
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
        setBroadcastProgress((current) => (current ? { ...current, status: 'completed' } : current));
      }

      const latestResult = results[results.length - 1];

      showToast({
        title:
          totalCount > 1
            ? stopRequestedRef.current
              ? sendTxMessages.stoppedTitle
              : sendTxMessages.sentManyTitle
            : sendTxMessages.sentOneTitle,
        description: resultToastDescription(latestResult.hash),
        tone: latestResult.receipt.status === 'success' ? 'success' : 'info',
        durationMs: 8000,
      });
    } catch (error) {
      const message = error instanceof Error ? translateRuntimeText(error.message, locale) : sendTxMessages.failedToSend;

      if (message === sendTxMessages.passwordRequired) {
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setFormError(
        message === '__REPEAT_COUNT_ERROR__'
          ? sendTxMessages.repeatCountError
          : message === '__INVALID_TX_DATA__'
            ? sendTxMessages.invalidTransactionData
            : message === '__MAX_VALUE_REQUIRED__'
              ? sendTxMessages.maxValueRequired
              : message === '__MAX_VALUE_RANGE_ERROR__'
                ? sendTxMessages.maxValueRangeError
                : message,
      );
    } finally {
      setSubmitting(false);
      stopRequestedRef.current = false;
    }
  }

  async function handleConfirmUnlock() {
    if (!activeKey) {
      return;
    }

    try {
      await resolveEvmStoredPrivateKey(activeKey.id, unlockPassword);
      setUnlockDialogOpen(false);
      const password = unlockPassword;
      setUnlockPassword('');
      setUnlockError(null);
      await submit(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? translateRuntimeText(error.message, locale) : sendTxMessages.failedToUnlock);
    }
  }

  function clearForm() {
    setToMode('fixed');
    setToAddress('');
    setValueMode('fixed');
    setValue('');
    setMaxValue('');
    setGasLimit('');
    setRepeatCount('');
    setReceiptPollIntervalMs('');
    setTransactionType('EIP1559');
    setGasPrice('');
    setMaxFeePerGas('');
    setMaxPriorityFeePerGas('');
    setNonce('');
    setData('0x');
    setTxResult(null);
    setBroadcastProgress(null);
    setFormError(null);
  }

  function handleStopBroadcast() {
    stopRequestedRef.current = true;
    setBroadcastProgress((current) => (current ? { ...current, status: 'cancel-requested' } : current));
  }

  const latestTxHash =
    txResult && typeof txResult === 'object' && 'hash' in txResult && typeof txResult.hash === 'string' ? txResult.hash : null;
  const txResultRenderKey = latestTxHash ? `single:${txResultVersion}:${latestTxHash}` : `single:${txResultVersion}:empty`;
  const progressPercent = broadcastProgress ? Math.min(100, Math.round((broadcastProgress.completed / broadcastProgress.total) * 100)) : 0;

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="shrink-0 text-2xl font-semibold text-slate-950">{sendTxMessages.title}</h1>
                <p className="min-w-0 truncate text-sm text-slate-500">{sendTxMessages.description}</p>
              </div>
              <span className="inline-flex min-w-0 shrink-0 items-center gap-1.5 truncate text-sm font-medium text-slate-700" title={activeKey?.address || undefined}>
                {activeKey ? (
                  <>
                    <span className="font-mono text-xs text-sky-600">{formatCompactHash(activeKey.address, 12, 8)}</span>
                    <span className="relative inline-flex shrink-0">
                      <button
                        ref={copyButtonRef}
                        type="button"
                        className="inline-flex size-4 items-center justify-center text-slate-400 transition hover:text-sky-600"
                        aria-label={sendTxMessages.copyAddress}
                        onClick={() => void handleCopyFromAddress()}
                      >
                        <IconCopy className="size-4" stroke={1.8} />
                      </button>
                      <FloatingTooltip open={fromAddressCopied} anchorRef={copyButtonRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
                        <span className="block whitespace-nowrap">{commonMessages.copied}</span>
                      </FloatingTooltip>
                    </span>
                  </>
                ) : (
                  sendTxMessages.noActiveAddress
                )}
              </span>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-type">
                      {sendTxMessages.transactionType}
                    </label>
                    <Select value={transactionType} disabled={submitting} onValueChange={(value) => setTransactionType(value as 'LEGACY' | 'EIP1559')}>
                      <SelectTrigger id="evm-tx-type" className="mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EIP1559">{translateRuntimeText('EIP-1559', locale)}</SelectItem>
                        <SelectItem value="LEGACY">{sendTxMessages.legacy}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-repeat-count">
                    {sendTxMessages.repeatBroadcasts}
                  </label>
                  <Input
                    id="evm-tx-repeat-count"
                    value={repeatCount}
                    inputMode="numeric"
                    placeholder={sendTxMessages.repeatCountPlaceholder}
                    disabled={submitting}
                    className="mt-1"
                    onChange={(event) => setRepeatCount(event.target.value)}
                  />
                </div>

                {transactionType === 'LEGACY' ? (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-gas-price">
                        {sendTxMessages.gasPrice}
                      </label>
                      <Input id="evm-tx-gas-price" value={gasPrice} inputMode="decimal" placeholder={sendTxMessages.autoPlaceholder} disabled={submitting} className="mt-1" onChange={(event) => setGasPrice(event.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-max-fee">
                        {sendTxMessages.maxFeePerGas}
                      </label>
                      <Input
                        id="evm-tx-max-fee"
                        value={maxFeePerGas}
                        inputMode="decimal"
                        placeholder={sendTxMessages.autoPlaceholder}
                        disabled={submitting}
                        className="mt-1"
                        onChange={(event) => setMaxFeePerGas(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-max-priority-fee">
                        {sendTxMessages.maxPriorityFee}
                      </label>
                      <Input
                        id="evm-tx-max-priority-fee"
                        value={maxPriorityFeePerGas}
                        inputMode="decimal"
                        placeholder={sendTxMessages.autoPlaceholder}
                        disabled={submitting}
                        className="mt-1"
                        onChange={(event) => setMaxPriorityFeePerGas(event.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-to">
                    {sendTxMessages.to}
                  </label>
                  <div className="relative mt-1">
                    <InlineModeSelect value={toMode} disabled={submitting} onValueChange={(nextValue) => handleToModeChange(nextValue, setToMode, setToAddress)} />
                    <Input
                      id="evm-tx-to"
                      value={toAddress}
                      placeholder={toMode === 'random' ? sendTxMessages.randomAddressPlaceholder : sendTxMessages.hexPlaceholder}
                      disabled={submitting}
                      className="min-w-0 pl-[104px]"
                      onChange={(event) => setToAddress(event.target.value)}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-data">
                    {sendTxMessages.data}
                  </label>
                  <Input id="evm-tx-data" value={data} placeholder={sendTxMessages.zeroHexPlaceholder} disabled={submitting} className="mt-1" onChange={(event) => setData(event.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-value">
                    {sendTxMessages.value} ({currencyName})
                  </label>
                  {valueMode === 'fixed' ? (
                    <div className="relative mt-1">
                      <InlineModeSelect value={valueMode} disabled={submitting} onValueChange={setValueMode} />
                      <Input
                        id="evm-tx-value"
                        value={value}
                        inputMode="decimal"
                        placeholder={sendTxMessages.zeroPlaceholder}
                        disabled={submitting}
                        className="min-w-0 pl-[104px]"
                        onChange={(event) => setValue(event.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="relative mt-1">
                      <InlineModeSelect value={valueMode} disabled={submitting} onValueChange={setValueMode} />
                      <Input value={maxValue} inputMode="decimal" placeholder={sendTxMessages.maxPlaceholder} disabled={submitting} className="min-w-0 pl-[104px]" onChange={(event) => setMaxValue(event.target.value)} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-gas-limit">
                    {sendTxMessages.gasLimit}
                  </label>
                  <Input id="evm-tx-gas-limit" value={gasLimit} inputMode="numeric" placeholder={sendTxMessages.autoPlaceholder} disabled={submitting} className="mt-1" onChange={(event) => setGasLimit(event.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-receipt-poll-interval">
                    {sendTxMessages.receiptPollInterval}
                  </label>
                  <Input
                    id="evm-tx-receipt-poll-interval"
                    value={receiptPollIntervalMs}
                    inputMode="numeric"
                    placeholder={sendTxMessages.optionalPlaceholder}
                    disabled={submitting}
                    className="mt-1"
                    onChange={(event) => setReceiptPollIntervalMs(event.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="evm-tx-nonce">
                    {sendTxMessages.nonce}
                  </label>
                  <Input id="evm-tx-nonce" value={nonce} inputMode="numeric" placeholder={sendTxMessages.autoPlaceholder} disabled={submitting} className="mt-1" onChange={(event) => setNonce(event.target.value)} />
                </div>

                {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-4">{translateRuntimeText(formError, locale)}</p> : null}
              </div>

              {broadcastProgress ? (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                    <span>
                      {broadcastProgress.status === 'cancel-requested'
                        ? sendTxMessages.cancelRequestedAt
                            .replace('{completed}', String(broadcastProgress.completed))
                            .replace('{total}', String(broadcastProgress.total))
                        : broadcastProgress.status === 'stopped'
                          ? sendTxMessages.stoppedAt
                              .replace('{completed}', String(broadcastProgress.completed))
                              .replace('{total}', String(broadcastProgress.total))
                          : broadcastProgress.status === 'completed'
                            ? sendTxMessages.completedProgress
                                .replace('{completed}', String(broadcastProgress.completed))
                                .replace('{total}', String(broadcastProgress.total))
                            : sendTxMessages.progress
                                .replace('{completed}', String(broadcastProgress.completed))
                                .replace('{total}', String(broadcastProgress.total))}
                    </span>
                    <span>
                      {broadcastProgress.status === 'cancel-requested'
                        ? sendTxMessages.waitingCurrentTx
                        : broadcastProgress.status === 'stopped'
                          ? sendTxMessages.stopped
                          : broadcastProgress.completed < broadcastProgress.total && submitting
                            ? sendTxMessages.sending
                                .replace('{current}', String(Math.min(broadcastProgress.current, broadcastProgress.total)))
                                .replace('{total}', String(broadcastProgress.total))
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
                  {typeof latestTxHash === 'string' ? (
                    <span className="inline-flex min-w-0 max-w-full items-center text-sm leading-5 text-slate-700">
                      <span className="shrink-0 font-medium leading-5">{sendTxMessages.viewTx}&nbsp;</span>
                      <Link className="translate-y-[1px] truncate text-sm font-semibold leading-5 text-sky-600 hover:text-sky-700" href={`/evm/tx/${latestTxHash}`}>
                        {formatCompactHash(latestTxHash, 10, 8)}
                      </Link>
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <Button type="button" variant="outline" disabled={submitting} onClick={clearForm}>
                    {sendTxMessages.clear}
                  </Button>
                  {submitting && broadcastProgress?.status === 'running' ? (
                    <Button type="button" variant="outline" onClick={handleStopBroadcast}>
                      {sendTxMessages.stop}
                    </Button>
                  ) : null}
                  {submitting && broadcastProgress?.status === 'cancel-requested' ? (
                    <Button type="button" variant="outline" disabled>
                      {sendTxMessages.cancelRequested}
                    </Button>
                  ) : null}
                  <Button type="button" disabled={submitting} onClick={() => void submit()}>
                    {submitting ? (broadcastProgress?.status === 'cancel-requested' ? sendTxMessages.stopping : sendTxMessages.broadcasting) : sendTxMessages.broadcast}
                  </Button>
                </div>
              </div>

              {txResult ? (
                <div className="border-t border-slate-200 pt-4">
                  <JsonViewPanel
                    key={txResultRenderKey}
                    className="max-h-[1080px] overflow-y-auto overflow-x-hidden bg-slate-50 shadow-none"
                    jsonClassName="whitespace-pre-wrap break-all"
                    value={txResult as object}
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
        title={sendTxMessages.unlockPrivateKey}
        description={activeKey ? sendTxMessages.unlockDescription.replace('{name}', activeKey.name) : sendTxMessages.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={sendTxMessages.password}
        confirmLabel={sendTxMessages.unlock}
        confirmDisabled={!unlockPassword.trim()}
        errorMessage={unlockError}
        onConfirm={() => void handleConfirmUnlock()}
      />
    </>
  );
}

export default function EvmSendTxPage() {
  return (
    <AppShell mode="evm">
      <EvmSendTxContent />
    </AppShell>
  );
}
