'use client';

import { IconX } from '@tabler/icons-react';
import { fromHex, toBech32 } from '@cosmjs/encoding';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
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

type CosmosTxType = string;

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

function getActionLabel(type: CosmosTxType) {
  return COSMOS_GENERIC_MESSAGE_TYPES.find((item) => item.typeUrl === type)?.label ?? 'Transaction';
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

function CosmosSendTxContent() {
  const { showToast } = useToast();
  const [transactionType, setTransactionType] = useState<CosmosTxType>(DEFAULT_TRANSACTION_TYPE);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [accountPrefix, setAccountPrefix] = useState('cosmos');
  const [activeCosmosAddress, setActiveCosmosAddress] = useState('');
  const [messageJson, setMessageJson] = useState(() => formatMessageTemplate(DEFAULT_TRANSACTION_TYPE));
  const [gasPriceAmount, setGasPriceAmount] = useState('');
  const [gasPriceDenom, setGasPriceDenom] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [signingAlgorithm, setSigningAlgorithm] = useState<CosmosSigningAlgorithm>('ethsecp256k1');
  const [memo, setMemo] = useState('');
  const [broadcastResult, setBroadcastResult] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const actionLabel = getActionLabel(transactionType);

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
      setFormError('Select a global private key first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setBroadcastResult(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const baseInput = {
        privateKey,
        accountPrefix,
        signingAlgorithm,
        gasPrice: `${gasPriceAmount.trim()}${gasPriceDenom.trim()}`,
        gasLimit,
        memo,
      };
      const result = await broadcastCosmosGenericMessage({
        ...baseInput,
        messageTypeUrl: transactionType,
        messageJson,
      });

      showToast({
        title: `${actionLabel} transaction broadcasted`,
        description: resultToastDescription(result),
        durationMs: 8000,
      });
      setBroadcastResult(encodeJsonValue(result.response) as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to broadcast ${actionLabel.toLowerCase()} transaction.`;

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
      await broadcast(password);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock private key.');
    }
  }

  function clearForm() {
    setMessageJson(formatMessageTemplate(transactionType, activeCosmosAddress, accountPrefix));
    setGasPriceAmount('');
    setGasPriceDenom('');
    setGasLimit('');
    setMemo('');
    setBroadcastResult(null);
    setFormError(null);
  }

  return (
    <>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="shrink-0 text-2xl font-semibold text-slate-950">Send Transaction</h1>
                <p className="min-w-0 truncate text-sm text-slate-500">Broadcast Cosmos transactions.</p>
              </div>
              <span className="min-w-0 shrink-0 truncate text-sm font-medium text-slate-700" title={activeCosmosAddress || activeKey?.address || undefined}>
                {activeKey ? (
                  <>
                    {activeCosmosAddress ? (
                      <Link className="font-mono text-xs text-sky-600 hover:text-sky-700" href={`/cosmos/account/${activeCosmosAddress}`}>
                        {formatCompactHash(activeCosmosAddress, 12, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-slate-500">{formatCompactHash(activeKey.address, 12, 8)}</span>
                    )}
                  </>
                ) : (
                  'No active address'
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
                      Transaction type
                    </label>
                    <Select value={transactionType} disabled={submitting} onValueChange={handleTransactionTypeChange}>
                      <SelectTrigger id="cosmos-tx-type" className="mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[420px]">
                        {COSMOS_GENERIC_MESSAGE_TYPES.map((item) => (
                          <SelectItem key={item.typeUrl} value={item.typeUrl}>
                            {`${item.label} (${item.module})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="cosmos-signing">
                      Signing
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
                    Gas price
                  </label>
                  <div className="mt-1 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_100px]">
                    <ScaledInput id="tx-gas-price" value={gasPriceAmount} inputMode="decimal" placeholder="1000000000000000" disabled={submitting} onChange={setGasPriceAmount} />
                    <Input id="tx-gas-denom" value={gasPriceDenom} placeholder="uatom" disabled={submitting} onChange={(event) => setGasPriceDenom(event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-gas-limit">
                    Gas limit
                  </label>
                  <Input id="tx-gas-limit" value={gasLimit} inputMode="numeric" placeholder="Auto" disabled={submitting} className="mt-1" onChange={(event) => setGasLimit(event.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="tx-memo">
                    Memo
                  </label>
                  <Input id="tx-memo" value={memo} placeholder="Optional" disabled={submitting} className="mt-1" onChange={(event) => setMemo(event.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="message-json">
                    Message value
                  </label>
                  <AutoGrowTextarea
                    id="message-json"
                    value={messageJson}
                    disabled={submitting}
                    spellCheck={false}
                    rows={1}
                    className="mt-1 min-h-10 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    onChange={(event) => setMessageJson(event.target.value)}
                  />
                </div>

                {formError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{formError}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div className="min-w-0">
                  {typeof broadcastResult?.transactionHash === 'string' ? (
                    <span className="inline-flex min-w-0 max-w-full items-center text-sm leading-5 text-slate-700">
                      <span className="shrink-0 font-medium leading-5">View tx&nbsp;</span>
                      <Link className="translate-y-[1px] truncate text-sm font-semibold leading-5 text-sky-600 hover:text-sky-700" href={`/cosmos/tx/${broadcastResult.transactionHash}`}>
                        {formatCompactHash(broadcastResult.transactionHash, 10, 8)}
                      </Link>
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <Button type="button" variant="outline" disabled={submitting} onClick={clearForm}>
                    Clear
                  </Button>
                  <Button type="button" disabled={submitting} onClick={() => void broadcast()}>
                    {submitting ? 'Broadcasting...' : 'Broadcast'}
                  </Button>
                </div>
              </div>

              {broadcastResult ? (
                <div className="border-t border-slate-200 pt-4">
                  <JsonViewPanel className="max-h-[1080px] overflow-y-auto overflow-x-hidden bg-slate-50 shadow-none" jsonClassName="whitespace-pre-wrap break-all" value={broadcastResult} />
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
        title="Unlock Private Key"
        description={activeKey ? `Enter the password for "${activeKey.name}" to continue the ${actionLabel.toLowerCase()} transaction.` : 'Enter the password to continue.'}
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

export default function CosmosSendTxPage() {
  return (
    <AppShell mode="cosmos">
      <CosmosSendTxContent />
    </AppShell>
  );
}
