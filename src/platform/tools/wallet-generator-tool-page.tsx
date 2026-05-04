'use client';

import { mnemonicToSeedSync } from '@scure/bip39';
import { IconCopy, IconDownload, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { HDKey, english, generateMnemonic, hdKeyToAccount, privateKeyToAccount } from 'viem/accounts';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { toHex, type Hex } from 'viem';

type GeneratorMode = 'same_mnemonic' | 'different_mnemonics' | 'custom_input';

type MnemonicLength = 12 | 15 | 18 | 21 | 24;

type AdvancedOptions = {
  purpose: string;
  coinType: string;
  account: string;
  change: string;
  addressIndex: string;
};

type DerivedWallet = {
  rowId: string;
  mode: GeneratorMode;
  mnemonic: string;
  privateKey: string;
  address: string;
  publicKey: string;
  path: string;
  index: number;
  sourceType: 'mnemonic' | 'privateKey';
};

const MNEMONIC_LENGTH_OPTIONS: MnemonicLength[] = [12, 15, 18, 21, 24];

const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  purpose: '44',
  coinType: '60',
  account: '0',
  change: '0',
  addressIndex: '0',
};

function wordCountToStrength(wordCount: MnemonicLength) {
  return (wordCount / 3) * 32;
}

function maskSecret(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  if (value.length <= 12) {
    return '•'.repeat(value.length);
  }

  return `${value.slice(0, 6)}••••••${value.slice(-4)}`;
}

function parsePositiveInteger(
  value: string,
  label: string,
  messages: ReturnType<typeof useMessages>['walletGenerator'],
  { min = 0, max }: { min?: number; max?: number } = {},
) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(messages.required.replace('{label}', label));
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(messages.nonNegativeInteger.replace('{label}', label));
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(messages.greaterOrEqual.replace('{label}', label).replace('{value}', String(min)));
  }

  if (typeof max === 'number' && parsed > max) {
    throw new Error(messages.lessOrEqual.replace('{label}', label).replace('{value}', String(max)));
  }

  return parsed;
}

function normalizePrivateKey(value: string, messages: ReturnType<typeof useMessages>['walletGenerator']): Hex {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!/^[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error(messages.privateKeyHexError);
  }

  return `0x${normalized}` as Hex;
}

function isMnemonicLike(value: string) {
  return value.trim().split(/\s+/).length > 1;
}

function buildDerivationPath(options: { purpose: number; coinType: number; account: number; change: number; addressIndex: number }) {
  return `m/${options.purpose}'/${options.coinType}'/${options.account}'/${options.change}/${options.addressIndex}`;
}

function deriveAccountFromMnemonic(mnemonic: string, path: string) {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  return hdKeyToAccount(HDKey.fromMasterSeed(seed), { path: path as `m/44'/60'/${string}` });
}

function createDerivedWallet({
  mode,
  mnemonic,
  path,
  index,
  errorMessages,
}: {
  mode: GeneratorMode;
  mnemonic: string;
  path: string;
  index: number;
  errorMessages: ReturnType<typeof useMessages>['walletGenerator'];
}): DerivedWallet {
  const account = deriveAccountFromMnemonic(mnemonic, path);
  const privateKey = account.getHdKey().privateKey;

  if (!privateKey) {
    throw new Error(errorMessages.failedToDerivePrivateKey);
  }

  return {
    rowId: `${mode}-${index}-${account.address}`,
    mode,
    mnemonic,
    privateKey: toHex(privateKey).slice(2),
    address: account.address,
    publicKey: account.publicKey,
    path,
    index,
    sourceType: 'mnemonic',
  };
}

function createWalletFromPrivateKey(privateKeyInput: string, messages: ReturnType<typeof useMessages>['walletGenerator']): DerivedWallet {
  const privateKey = normalizePrivateKey(privateKeyInput, messages);
  const account = privateKeyToAccount(privateKey);

  return {
    rowId: `private-key-${account.address}`,
    mode: 'custom_input',
    mnemonic: '',
    privateKey: privateKey.slice(2),
    address: account.address,
    publicKey: account.publicKey,
    path: '',
    index: 0,
    sourceType: 'privateKey',
  };
}

function toCsv(rows: DerivedWallet[]) {
  const headers = ['index', 'address', 'privateKey', 'mnemonic', 'publicKey', 'path', 'sourceType'];
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [row.index, row.address, row.privateKey, row.mnemonic, row.publicKey, row.path, row.sourceType].map(escapeCell).join(','),
    ),
  ];

  return lines.join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function WalletGeneratorToolPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const walletMessages = messages.walletGenerator;
  const [mode, setMode] = useState<GeneratorMode>('same_mnemonic');
  const [mnemonicLength, setMnemonicLength] = useState<MnemonicLength>(12);
  const [walletCount, setWalletCount] = useState('10');
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedOptions>(DEFAULT_ADVANCED_OPTIONS);
  const [results, setResults] = useState<DerivedWallet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  const modeOptions: Array<{ id: GeneratorMode; label: string; description: string }> = [
    { id: 'same_mnemonic', label: walletMessages.batchFromOneMnemonic, description: walletMessages.batchFromOneMnemonicDescription },
    { id: 'different_mnemonics', label: walletMessages.batchWithNewMnemonics, description: walletMessages.batchWithNewMnemonicsDescription },
    { id: 'custom_input', label: walletMessages.importPrivateKeyOrMnemonic, description: walletMessages.importPrivateKeyOrMnemonicDescription },
  ];

  const derivedPathPreview = useMemo(() => {
    return buildDerivationPath({
      purpose: Number(advancedOptions.purpose || 0),
      coinType: Number(advancedOptions.coinType || 0),
      account: Number(advancedOptions.account || 0),
      change: Number(advancedOptions.change || 0),
      addressIndex: Number(advancedOptions.addressIndex || 0),
    });
  }, [advancedOptions]);

  function handleModeChange(nextMode: GeneratorMode) {
    setMode(nextMode);
    setError(null);
    setResults([]);
    setShowSecrets(false);
    setShowCustomInput(false);
  }

  function handleAdvancedOptionChange(key: keyof AdvancedOptions, value: string) {
    setAdvancedOptions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleCopy(field: string, value: string) {
    await copyText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1200);
  }

  function generateWallets() {
    const count = parsePositiveInteger(walletCount, walletMessages.walletCount, walletMessages, { min: 1, max: 500 });
    const purpose = parsePositiveInteger(advancedOptions.purpose, walletMessages.purpose, walletMessages);
    const coinType = parsePositiveInteger(advancedOptions.coinType, walletMessages.coinType, walletMessages);
    const account = parsePositiveInteger(advancedOptions.account, walletMessages.account, walletMessages);
    const change = parsePositiveInteger(advancedOptions.change, walletMessages.change, walletMessages);
    const addressIndex = parsePositiveInteger(advancedOptions.addressIndex, walletMessages.addressIndex, walletMessages);

    if (mode === 'same_mnemonic') {
      const mnemonic = generateMnemonic(english, wordCountToStrength(mnemonicLength));

      return Array.from({ length: count }, (_entry, index) =>
        createDerivedWallet({
          mode,
          mnemonic,
          path: buildDerivationPath({
            purpose,
            coinType,
            account,
            change,
            addressIndex: addressIndex + index,
          }),
          index,
          errorMessages: walletMessages,
        }),
      );
    }

    if (mode === 'different_mnemonics') {
      return Array.from({ length: count }, (_entry, index) =>
        createDerivedWallet({
          mode,
          mnemonic: generateMnemonic(english, wordCountToStrength(mnemonicLength)),
          path: buildDerivationPath({
            purpose,
            coinType,
            account,
            change,
            addressIndex,
          }),
          index,
          errorMessages: walletMessages,
        }),
      );
    }

    const trimmedInput = customInput.trim();

    if (!trimmedInput) {
      throw new Error(walletMessages.privateKeyOrMnemonicRequired);
    }

    if (isMnemonicLike(trimmedInput)) {
      return Array.from({ length: count }, (_entry, index) =>
        createDerivedWallet({
          mode,
          mnemonic: trimmedInput,
          path: buildDerivationPath({
            purpose,
            coinType,
            account,
            change,
            addressIndex: addressIndex + index,
          }),
          index,
          errorMessages: walletMessages,
        }),
      );
    }

    return [createWalletFromPrivateKey(trimmedInput, walletMessages)];
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);

    try {
      const nextResults = generateWallets();
      setResults(nextResults);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : walletMessages.failedToGenerateWallets);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownload() {
    if (!results.length) {
      return;
    }

    downloadCsv('evm-wallet-generator.csv', toCsv(results));
  }

  const isBatchMode = mode !== 'custom_input';
  const canExportCsv = mode !== 'custom_input' || isMnemonicLike(customInput.trim());
  const hasSharedMnemonic = mode === 'same_mnemonic' && results.length > 0;
  const sharedMnemonic = hasSharedMnemonic ? results[0]?.mnemonic ?? '' : '';
  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="text-2xl font-semibold text-slate-950">{walletMessages.title}</h1>
              <p className="min-w-0 truncate text-sm text-slate-500">{walletMessages.description}</p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <section className="space-y-4">
              <div className="text-lg font-semibold text-slate-950">{walletMessages.mode}</div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {modeOptions.map((option) => {
                  const active = mode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`inline-flex min-w-0 flex-col items-start gap-2 rounded-xl border px-4 py-3 text-left transition ${
                        active ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => handleModeChange(option.id)}
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="min-w-0 text-[17px] font-semibold leading-6">{option.label}</span>
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition ${
                            active ? 'border-sky-500 bg-sky-500' : 'border-slate-300 bg-white'
                          }`}
                        >
                          <span className={`size-2 rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
                        </span>
                      </div>
                      <span className={`text-sm leading-6 ${active ? 'text-sky-700' : 'text-slate-500'}`}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-5 pt-5">
              <div className="space-y-6">
                {mode === 'custom_input' ? (
                  <div>
                    <label className="block text-[18px] font-semibold text-slate-950" htmlFor="wallet-generator-custom-input">
                      {walletMessages.privateKeyOrMnemonic}
                    </label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{walletMessages.privateKeyOrMnemonicHint}</p>
                    <div className="relative mt-4">
                      <Input
                        id="wallet-generator-custom-input"
                        type={showCustomInput ? 'text' : 'password'}
                        value={customInput}
                        className="h-11 pr-11 text-base"
                        placeholder={walletMessages.privateKeyOrMnemonicPlaceholder}
                        onChange={(event) => setCustomInput(event.target.value)}
                      />
                      <ActionIconButton
                        tooltip={showCustomInput ? walletMessages.hideInput : walletMessages.showInput}
                        aria-label={showCustomInput ? walletMessages.hideInput : walletMessages.showInput}
                        wrapperClassName="absolute right-3 top-1/2 -translate-y-1/2"
                        className="text-slate-400 hover:text-sky-600"
                        onClick={() => setShowCustomInput((current) => !current)}
                      >
                        {showCustomInput ? <IconEyeOff className="size-4" stroke={1.8} /> : <IconEye className="size-4" stroke={1.8} />}
                      </ActionIconButton>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[18px] font-semibold text-slate-950">{walletMessages.mnemonicLength}</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {MNEMONIC_LENGTH_OPTIONS.map((option) => {
                        const active = mnemonicLength === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            className={`inline-flex min-w-[96px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-base font-semibold transition ${
                              active ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                            onClick={() => setMnemonicLength(option)}
                          >
                            <span
                              className={`flex size-4 items-center justify-center rounded-full border transition ${
                                active ? 'border-sky-500 bg-sky-500' : 'border-slate-300 bg-white'
                              }`}
                            >
                              <span className={`size-1.5 rounded-full ${active ? 'bg-white' : 'bg-transparent'}`} />
                            </span>
                            <span>{option} {walletMessages.words}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-slate-950">{walletMessages.advancedDerivation}</h2>
                      <button
                        type="button"
                        className={`relative inline-flex h-[20px] w-[40px] items-center rounded-full p-0.5 transition ${advancedOpen ? 'bg-sky-500' : 'bg-slate-300'}`}
                        aria-pressed={advancedOpen}
                        aria-label={advancedOpen ? walletMessages.hideAdvancedDerivation : walletMessages.showAdvancedDerivation}
                        onClick={() => setAdvancedOpen((current) => !current)}
                      >
                        <span className={`size-4 rounded-full bg-white transition ${advancedOpen ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        {walletMessages.advancedHint}
                        {' '}
                        {walletMessages.currentPath}
                        {' '}
                        <span className="font-mono text-slate-700">{derivedPathPreview}</span>
                        {' '}
                        <a
                          className="font-semibold text-sky-600 hover:text-sky-700"
                          href="https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki"
                          rel="noreferrer"
                          target="_blank"
                        >
                          {walletMessages.viewBip44Spec}
                        </a>
                    </p>
                  </div>

                  {advancedOpen ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-purpose">
                          {walletMessages.purpose}
                        </label>
                        <Input
                          id="wallet-generator-purpose"
                          value={advancedOptions.purpose}
                          className="mt-2 h-11 bg-white text-base"
                          onChange={(event) => handleAdvancedOptionChange('purpose', event.target.value)}
                        />
                      </div>

                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-coin-type">
                          {walletMessages.coinType}
                        </label>
                        <Input
                          id="wallet-generator-coin-type"
                          value={advancedOptions.coinType}
                          className="mt-2 h-11 bg-white text-base"
                          onChange={(event) => handleAdvancedOptionChange('coinType', event.target.value)}
                        />
                      </div>

                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-account">
                          {walletMessages.account}
                        </label>
                        <Input
                          id="wallet-generator-account"
                          value={advancedOptions.account}
                          className="mt-2 h-11 bg-white text-base"
                          onChange={(event) => handleAdvancedOptionChange('account', event.target.value)}
                        />
                      </div>

                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-change">
                          {walletMessages.change}
                        </label>
                        <Input
                          id="wallet-generator-change"
                          value={advancedOptions.change}
                          className="mt-2 h-11 bg-white text-base"
                          onChange={(event) => handleAdvancedOptionChange('change', event.target.value)}
                        />
                      </div>

                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-address-index">
                          {walletMessages.addressIndex}
                        </label>
                        <Input
                          id="wallet-generator-address-index"
                          value={advancedOptions.addressIndex}
                          className="mt-2 h-11 bg-white text-base"
                          onChange={(event) => handleAdvancedOptionChange('addressIndex', event.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
                  <div>
                    <label className="block text-[18px] font-semibold text-slate-950" htmlFor="wallet-generator-count">
                      {walletMessages.walletCount}
                    </label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{walletMessages.walletCountHint}</p>
                    <Input
                      id="wallet-generator-count"
                      value={walletCount}
                      className="mt-4 h-11 text-base font-semibold"
                      onChange={(event) => setWalletCount(event.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                    <Button
                      type="button"
                      className="h-11 min-w-[168px] rounded-xl px-6 text-sm font-semibold xl:flex-1"
                      disabled={submitting}
                      onClick={() => void handleGenerate()}
                    >
                        {submitting ? walletMessages.generating : mode === 'custom_input' ? walletMessages.generate : results.length ? walletMessages.regenerate : walletMessages.generate}
                    </Button>

                    {canExportCsv ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-w-[168px] rounded-xl border-sky-200 px-5 text-sm font-semibold text-sky-700 hover:bg-sky-50 hover:text-sky-800 xl:flex-1"
                        disabled={!results.length}
                        onClick={handleDownload}
                      >
                        <IconDownload className="mr-2 size-4" stroke={1.8} />
                        {walletMessages.downloadCsv}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{translateRuntimeText(error, locale)}</div> : null}

            {results.length ? (
              <section className="border-t border-slate-200 pt-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <h2 className="text-lg font-semibold text-slate-950">{walletMessages.results}</h2>

                  <div className="flex items-center gap-2 self-end lg:self-start">
                    <ActionIconButton
                      tooltip={showSecrets ? walletMessages.hideSensitiveData : walletMessages.showSensitiveData}
                      aria-label={showSecrets ? walletMessages.hideSensitiveData : walletMessages.showSensitiveData}
                      className="rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-sky-600"
                      onClick={() => setShowSecrets((current) => !current)}
                    >
                      {showSecrets ? <IconEyeOff className="size-4" stroke={1.8} /> : <IconEye className="size-4" stroke={1.8} />}
                    </ActionIconButton>
                  </div>
                </div>

                {hasSharedMnemonic ? (
                  <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{walletMessages.sharedMnemonic}</div>
                        <div className="mt-1 break-all font-mono text-sm leading-5 text-slate-900">
                          {showSecrets ? sharedMnemonic : maskSecret(sharedMnemonic, walletMessages.hiddenUseEye)}
                        </div>
                      </div>
                      <ActionIconButton
                        tooltip={copiedField === 'shared-mnemonic' ? walletMessages.mnemonicCopied : walletMessages.copyMnemonic}
                        aria-label={copiedField === 'shared-mnemonic' ? walletMessages.mnemonicCopied : walletMessages.copyMnemonic}
                        className="shrink-0 text-slate-400 hover:text-sky-600"
                        onClick={() => void handleCopy('shared-mnemonic', sharedMnemonic)}
                      >
                        <IconCopy className="size-4" stroke={1.8} />
                      </ActionIconButton>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  {results.map((row) => (
                    <article key={row.rowId} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <div className="grid grid-cols-[40px_400px_minmax(0,1.1fr)_minmax(0,1.2fr)_150px] items-center gap-4 text-sm">
                        <div className="w-[40px] shrink-0 font-semibold text-slate-950">#{row.index + 1}</div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="break-all font-mono text-sm text-slate-900">{row.address}</span>
                            <ActionIconButton
                              tooltip={copiedField === `${row.rowId}-address` ? walletMessages.addressCopied : walletMessages.copyAddress}
                              aria-label={copiedField === `${row.rowId}-address` ? walletMessages.addressCopied : walletMessages.copyAddress}
                              className="shrink-0 text-slate-400 hover:text-sky-600"
                              onClick={() => void handleCopy(`${row.rowId}-address`, row.address)}
                            >
                              <IconCopy className="size-4" stroke={1.8} />
                            </ActionIconButton>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="break-all font-mono text-sm text-slate-900">{showSecrets ? row.privateKey : maskSecret(row.privateKey, walletMessages.hidden)}</span>
                            <ActionIconButton
                              tooltip={copiedField === `${row.rowId}-privateKey` ? walletMessages.privateKeyCopied : walletMessages.copyPrivateKey}
                              aria-label={copiedField === `${row.rowId}-privateKey` ? walletMessages.privateKeyCopied : walletMessages.copyPrivateKey}
                              className="shrink-0 text-slate-400 hover:text-sky-600"
                              onClick={() => void handleCopy(`${row.rowId}-privateKey`, row.privateKey)}
                            >
                              <IconCopy className="size-4" stroke={1.8} />
                            </ActionIconButton>
                          </div>
                        </div>

                        <div className="min-w-0">
                          {row.mnemonic ? (
                            <div className="flex items-center gap-2">
                              <span className="break-all font-mono text-sm text-slate-900">{showSecrets ? row.mnemonic : maskSecret(row.mnemonic, walletMessages.hidden)}</span>
                              <ActionIconButton
                                tooltip={copiedField === `${row.rowId}-mnemonic` ? walletMessages.mnemonicCopied : walletMessages.copyMnemonic}
                                aria-label={copiedField === `${row.rowId}-mnemonic` ? walletMessages.mnemonicCopied : walletMessages.copyMnemonic}
                                className="shrink-0 text-slate-400 hover:text-sky-600"
                                onClick={() => void handleCopy(`${row.rowId}-mnemonic`, row.mnemonic)}
                              >
                                <IconCopy className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">{walletMessages.none}</span>
                          )}
                        </div>

                        <div className="min-w-0 w-[150px] font-mono text-sm text-slate-700">{row.path || walletMessages.none}</div>

                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="border-t border-dashed border-slate-300 px-5 py-8 text-center">
                <div className="mx-auto max-w-2xl">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{walletMessages.ready}</div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">{walletMessages.emptyTitle}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{walletMessages.emptyDescription}</p>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
