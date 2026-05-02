'use client';

import { mnemonicToSeedSync } from '@scure/bip39';
import { IconCopy, IconDownload, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { HDKey, english, generateMnemonic, hdKeyToAccount, privateKeyToAccount } from 'viem/accounts';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
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

const MODE_OPTIONS: Array<{ id: GeneratorMode; label: string; description: string }> = [
  { id: 'same_mnemonic', label: 'Batch Derive from One Mnemonic', description: 'Generate a sequence of addresses from one mnemonic.' },
  { id: 'different_mnemonics', label: 'Batch Generate with New Mnemonics', description: 'Generate independent wallets with a new mnemonic for each row.' },
  { id: 'custom_input', label: 'Import Private Key or Mnemonic', description: 'Parse an existing private key or mnemonic and derive wallet data.' },
];

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

function maskSecret(value: string, fallback = 'Hidden') {
  if (!value) {
    return fallback;
  }

  if (value.length <= 12) {
    return '•'.repeat(value.length);
  }

  return `${value.slice(0, 6)}••••••${value.slice(-4)}`;
}

function parsePositiveInteger(value: string, label: string, { min = 0, max }: { min?: number; max?: number } = {}) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  const parsed = Number(trimmed);

  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be greater than or equal to ${min}.`);
  }

  if (typeof max === 'number' && parsed > max) {
    throw new Error(`${label} must be less than or equal to ${max}.`);
  }

  return parsed;
}

function normalizePrivateKey(value: string): Hex {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!/^[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error('Private key must be 32-byte hex.');
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
}: {
  mode: GeneratorMode;
  mnemonic: string;
  path: string;
  index: number;
}): DerivedWallet {
  const account = deriveAccountFromMnemonic(mnemonic, path);
  const privateKey = account.getHdKey().privateKey;

  if (!privateKey) {
    throw new Error('Failed to derive private key.');
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

function createWalletFromPrivateKey(privateKeyInput: string): DerivedWallet {
  const privateKey = normalizePrivateKey(privateKeyInput);
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
    const count = parsePositiveInteger(walletCount, 'Wallet count', { min: 1, max: 500 });
    const purpose = parsePositiveInteger(advancedOptions.purpose, 'Purpose');
    const coinType = parsePositiveInteger(advancedOptions.coinType, 'Coin type');
    const account = parsePositiveInteger(advancedOptions.account, 'Account');
    const change = parsePositiveInteger(advancedOptions.change, 'Change');
    const addressIndex = parsePositiveInteger(advancedOptions.addressIndex, 'Address index');

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
        }),
      );
    }

    const trimmedInput = customInput.trim();

    if (!trimmedInput) {
      throw new Error('Private key or mnemonic is required.');
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
        }),
      );
    }

    return [createWalletFromPrivateKey(trimmedInput)];
  }

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);

    try {
      const nextResults = generateWallets();
      setResults(nextResults);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate wallets.');
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
              <h1 className="text-2xl font-semibold text-slate-950">Wallet Generator</h1>
              <p className="min-w-0 truncate text-sm text-slate-500">
                Generate or inspect EVM wallets from mnemonics or private keys.
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <section className="space-y-4">
              <div className="text-lg font-semibold text-slate-950">Mode</div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {MODE_OPTIONS.map((option) => {
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
                      Private Key or Mnemonic
                    </label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">A mnemonic can derive multiple addresses. A private key resolves to one wallet only.</p>
                    <div className="relative mt-4">
                      <Input
                        id="wallet-generator-custom-input"
                        type={showCustomInput ? 'text' : 'password'}
                        value={customInput}
                        className="h-11 pr-11 text-base"
                        placeholder="Enter a 0x private key or an English mnemonic"
                        onChange={(event) => setCustomInput(event.target.value)}
                      />
                      <ActionIconButton
                        tooltip={showCustomInput ? 'Hide input' : 'Show input'}
                        aria-label={showCustomInput ? 'Hide input' : 'Show input'}
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
                    <div className="text-[18px] font-semibold text-slate-950">Mnemonic Length</div>
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
                            <span>{option} words</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-slate-950">Advanced Derivation</h2>
                      <button
                        type="button"
                        className={`relative inline-flex h-[20px] w-[40px] items-center rounded-full p-0.5 transition ${advancedOpen ? 'bg-sky-500' : 'bg-slate-300'}`}
                        aria-pressed={advancedOpen}
                        aria-label={advancedOpen ? 'Hide advanced derivation' : 'Show advanced derivation'}
                        onClick={() => setAdvancedOpen((current) => !current)}
                      >
                        <span className={`size-4 rounded-full bg-white transition ${advancedOpen ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                        Adjust purpose, coin type, account, change, and address index as needed.
                        {' '}
                        Current path:
                        {' '}
                        <span className="font-mono text-slate-700">{derivedPathPreview}</span>
                        {' '}
                        <a
                          className="font-semibold text-sky-600 hover:text-sky-700"
                          href="https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki"
                          rel="noreferrer"
                          target="_blank"
                        >
                          View BIP44 spec
                        </a>
                    </p>
                  </div>

                  {advancedOpen ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <div className="min-w-[132px] flex-1">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="wallet-generator-purpose">
                          Purpose
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
                          Coin Type
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
                          Account
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
                          Change
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
                          Address Index
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
                      Wallet Count
                    </label>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Supports up to 500 wallets per run. Private key input always returns a single result.</p>
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
                        {submitting ? 'Generating...' : mode === 'custom_input' ? 'Generate' : results.length ? 'Regenerate' : 'Generate'}
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
                        Download CSV
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            {results.length ? (
              <section className="border-t border-slate-200 pt-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <h2 className="text-lg font-semibold text-slate-950">Results</h2>

                  <div className="flex items-center gap-2 self-end lg:self-start">
                    <ActionIconButton
                      tooltip={showSecrets ? 'Hide sensitive data' : 'Show sensitive data'}
                      aria-label={showSecrets ? 'Hide sensitive data' : 'Show sensitive data'}
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
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Shared Mnemonic</div>
                        <div className="mt-1 break-all font-mono text-sm leading-5 text-slate-900">
                          {showSecrets ? sharedMnemonic : maskSecret(sharedMnemonic, 'Hidden. Use the eye button above to reveal it.')}
                        </div>
                      </div>
                      <ActionIconButton
                        tooltip={copiedField === 'shared-mnemonic' ? 'Copied' : 'Copy mnemonic'}
                        aria-label={copiedField === 'shared-mnemonic' ? 'Mnemonic copied' : 'Copy mnemonic'}
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
                              tooltip={copiedField === `${row.rowId}-address` ? 'Copied' : 'Copy address'}
                              aria-label={copiedField === `${row.rowId}-address` ? 'Address copied' : 'Copy address'}
                              className="shrink-0 text-slate-400 hover:text-sky-600"
                              onClick={() => void handleCopy(`${row.rowId}-address`, row.address)}
                            >
                              <IconCopy className="size-4" stroke={1.8} />
                            </ActionIconButton>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="break-all font-mono text-sm text-slate-900">{showSecrets ? row.privateKey : maskSecret(row.privateKey)}</span>
                            <ActionIconButton
                              tooltip={copiedField === `${row.rowId}-privateKey` ? 'Copied' : 'Copy private key'}
                              aria-label={copiedField === `${row.rowId}-privateKey` ? 'Private key copied' : 'Copy private key'}
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
                              <span className="break-all font-mono text-sm text-slate-900">{showSecrets ? row.mnemonic : maskSecret(row.mnemonic)}</span>
                              <ActionIconButton
                                tooltip={copiedField === `${row.rowId}-mnemonic` ? 'Copied' : 'Copy mnemonic'}
                                aria-label={copiedField === `${row.rowId}-mnemonic` ? 'Mnemonic copied' : 'Copy mnemonic'}
                                className="shrink-0 text-slate-400 hover:text-sky-600"
                                onClick={() => void handleCopy(`${row.rowId}-mnemonic`, row.mnemonic)}
                              >
                                <IconCopy className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>

                        <div className="min-w-0 w-[150px] font-mono text-sm text-slate-700">{row.path || '-'}</div>

                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="border-t border-dashed border-slate-300 px-5 py-8 text-center">
                <div className="mx-auto max-w-2xl">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ready</div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">Results will appear here</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    After you generate wallets, addresses, private keys, mnemonics, and derivation paths will appear here. Batch flows can be exported as CSV.
                  </p>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
