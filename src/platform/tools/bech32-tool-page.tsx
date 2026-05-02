'use client';

import { ripemd160, Secp256k1, sha256 } from '@cosmjs/crypto';
import { fromBech32, fromHex, toBech32, toHex } from '@cosmjs/encoding';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { IconCopy, IconEye, IconEyeOff } from '@tabler/icons-react';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount, publicKeyToAddress } from 'viem/accounts';
import { getAddress, hexToBytes, type Hex } from 'viem';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppShell } from '@/platform/layout/app-shell';

type Bech32Action = 'encode' | 'decode';
type Bech32Crypto = 'ethsecp256k1' | 'secp256k1';
type Bech32Result = {
  action: Bech32Action;
  crypto?: Bech32Crypto;
  prefix?: string;
  origin: string;
  bechAddress: string;
  address?: string;
  publicKey?: string;
  compressedPublicKey?: string;
  sourcePrefix?: string;
};

function normalizeHex(value: string) {
  return value.trim().replace(/^0x/i, '').toLowerCase();
}

function ensureHex(value: string): Hex {
  return `0x${normalizeHex(value)}` as Hex;
}

function bytesToArray(bytes: Uint8Array) {
  return Array.from(bytes);
}

function toDisplayHexAddress(addressHex: string) {
  const value = ensureHex(addressHex);

  try {
    return getAddress(value);
  } catch {
    return value;
  }
}

function isMnemonic(value: string) {
  return value.trim().split(/\s+/).length > 1;
}

function isPrivateKeyLike(value: string) {
  const normalizedInput = normalizeHex(value);

  return /^[0-9a-f]+$/i.test(normalizedInput) && normalizedInput.length === 64;
}

function isCompressedPublicKey(value: string) {
  const normalizedInput = normalizeHex(value);

  return /^[0-9a-f]+$/i.test(normalizedInput) && normalizedInput.length === 66;
}

function isUncompressedPublicKey(value: string) {
  const normalizedInput = normalizeHex(value);

  return /^[0-9a-f]+$/i.test(normalizedInput) && normalizedInput.length === 130 && normalizedInput.startsWith('04');
}

function compressPublicKeyHex(publicKey: string) {
  return `0x${toHex(Secp256k1.compressPubkey(fromHex(normalizeHex(publicKey))))}`;
}

function uncompressPublicKeyHex(publicKey: string) {
  return `0x${toHex(Secp256k1.uncompressPubkey(fromHex(normalizeHex(publicKey))))}`;
}

function createEthResult(input: string, prefix: string) {
  const normalizedInput = normalizeHex(input);

  if (isMnemonic(input) || normalizedInput.length === 64) {
    const account = isMnemonic(input) ? mnemonicToAccount(input.trim()) : privateKeyToAccount(ensureHex(input));

    return {
      bechAddress: toBech32(prefix, fromHex(account.address.slice(2))),
      privateKey: normalizedInput.length === 64 ? ensureHex(input) : '',
      privateKeyBytes: normalizedInput.length === 64 ? bytesToArray(fromHex(normalizedInput)) : [],
      publicKey: account.publicKey,
      compressedPublicKey: compressPublicKeyHex(account.publicKey),
      publicKeyBytes: bytesToArray(fromHex(account.publicKey.slice(2))),
      address: account.address,
      addressBytes: bytesToArray(fromHex(account.address.slice(2))),
    };
  }

  if (isCompressedPublicKey(input) || isUncompressedPublicKey(input)) {
    const publicKey = isCompressedPublicKey(input) ? uncompressPublicKeyHex(input) : ensureHex(input);
    const compressedPublicKey = isCompressedPublicKey(input) ? ensureHex(input) : compressPublicKeyHex(input);
    const publicKeyBytes = fromHex(normalizeHex(publicKey));
    const address = publicKeyToAddress(publicKey as Hex);

    return {
      bechAddress: toBech32(prefix, fromHex(address.slice(2))),
      publicKey,
      compressedPublicKey,
      publicKeyBytes: bytesToArray(publicKeyBytes),
      address,
      addressBytes: bytesToArray(fromHex(address.slice(2))),
    };
  }

  if (normalizedInput.length === 40) {
    const address = getAddress(ensureHex(input));

    return {
      bechAddress: toBech32(prefix, fromHex(normalizedInput)),
      address,
      addressBytes: bytesToArray(fromHex(normalizedInput)),
    };
  }

  try {
    const decoded = fromBech32(input.trim());
    const addressHex = toHex(decoded.data);

    return {
      sourcePrefix: decoded.prefix,
      bechAddress: toBech32(prefix, decoded.data),
      address: toDisplayHexAddress(addressHex),
      addressBytes: bytesToArray(decoded.data),
    };
  } catch {
    // Let the uniform validation error below explain the accepted inputs.
  }

  throw new Error('Input must be a hex address, private key, compressed public key, or mnemonic.');
}

async function createSecp256k1Result(input: string, prefix: string) {
  const normalizedInput = normalizeHex(input);

  if (isMnemonic(input) || normalizedInput.length === 64) {
    const wallet = isMnemonic(input) ? await DirectSecp256k1HdWallet.fromMnemonic(input, { prefix }) : await DirectSecp256k1Wallet.fromKey(fromHex(normalizedInput), prefix);
    const [account] = await wallet.getAccounts();

    if (!account) {
      throw new Error('Failed to derive account.');
    }

    const addressHex = toHex(fromBech32(account.address).data);

    return {
      bechAddress: account.address,
      privateKey: normalizedInput.length === 64 ? ensureHex(input) : '',
      privateKeyBytes: normalizedInput.length === 64 ? bytesToArray(fromHex(normalizedInput)) : [],
      publicKey: uncompressPublicKeyHex(toHex(account.pubkey)),
      compressedPublicKey: `0x${toHex(account.pubkey)}`,
      publicKeyBytes: bytesToArray(account.pubkey),
      address: toDisplayHexAddress(addressHex),
      addressBytes: bytesToArray(fromHex(addressHex)),
    };
  }

  if (isCompressedPublicKey(input) || isUncompressedPublicKey(input)) {
    const publicKey = isCompressedPublicKey(input) ? uncompressPublicKeyHex(input) : ensureHex(input);
    const compressedPublicKey = isCompressedPublicKey(input) ? ensureHex(input) : compressPublicKeyHex(input);
    const addressBytes = ripemd160(sha256(hexToBytes(compressedPublicKey as Hex)));
    const addressHex = toHex(addressBytes);

    return {
      bechAddress: toBech32(prefix, addressBytes),
      publicKey,
      compressedPublicKey,
      publicKeyBytes: bytesToArray(fromHex(normalizeHex(publicKey))),
      address: toDisplayHexAddress(addressHex),
      addressBytes: bytesToArray(addressBytes),
    };
  }

  if (normalizedInput.length === 40) {
    return {
      bechAddress: toBech32(prefix, fromHex(normalizedInput)),
      address: toDisplayHexAddress(normalizedInput),
      addressBytes: bytesToArray(fromHex(normalizedInput)),
    };
  }

  try {
    const decoded = fromBech32(input.trim());
    const addressHex = toHex(decoded.data);

    return {
      sourcePrefix: decoded.prefix,
      bechAddress: toBech32(prefix, decoded.data),
      address: toDisplayHexAddress(addressHex),
      addressBytes: bytesToArray(decoded.data),
    };
  } catch {
    // Let the uniform validation error below explain the accepted inputs.
  }

  throw new Error('Input must be a hex address, private key, compressed public key, or mnemonic.');
}

function decodeBech32Address(input: string) {
  const decoded = fromBech32(input.trim());
  const addressHex = toHex(decoded.data);

  return {
    prefix: decoded.prefix,
    bechAddress: input.trim(),
    address: toDisplayHexAddress(addressHex),
    addressBytes: bytesToArray(decoded.data),
  };
}

export function Bech32ToolPage() {
  const [action, setAction] = useState<Bech32Action>('encode');
  const [crypto, setCrypto] = useState<Bech32Crypto>('ethsecp256k1');
  const [prefix, setPrefix] = useState('cosmos');
  const [input, setInput] = useState('');
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(null);
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [result, setResult] = useState<Bech32Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const inputIsSecret = action === 'encode' && (Boolean(generatedPrivateKey) || isMnemonic(input) || isPrivateKeyLike(input));
  const resolvedInputValue = generatedPrivateKey ?? input;

  async function handleCopy(field: string, value: string) {
    await copyText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1200);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      let resolvedInput = action === 'encode' ? generatedPrivateKey ?? input : input;

      if (action === 'encode' && !resolvedInput.trim()) {
        resolvedInput = generatePrivateKey();
        setGeneratedPrivateKey(resolvedInput);
        setInput('');
        setShowSecretInput(false);
      }

      const payload =
        action === 'decode'
          ? decodeBech32Address(resolvedInput)
          : crypto === 'ethsecp256k1'
            ? createEthResult(resolvedInput, prefix)
            : await createSecp256k1Result(resolvedInput, prefix);

      setResult({
        action,
        crypto: action === 'encode' ? crypto : undefined,
        prefix: action === 'encode' ? prefix : undefined,
        origin: resolvedInput,
        ...payload,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to process Bech32 input.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleActionChange(value: Bech32Action) {
    setAction(value);
    setInput('');
    setGeneratedPrivateKey(null);
    setShowSecretInput(false);
    setResult(null);
    setError(null);
  }

  function handleInputChange(value: string) {
    if (generatedPrivateKey) {
      setGeneratedPrivateKey(null);
      setInput(value);
      return;
    }

    setInput(value);
  }

  function renderResultRow(label: string, value?: string) {
    if (!value) {
      return null;
    }

    return (
      <div className="grid gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 lg:grid-cols-[180px_minmax(0,1fr)_48px] lg:items-center">
        <div className="text-sm font-semibold text-slate-600">{label}</div>
        <div className="min-w-0 break-all font-mono text-sm text-slate-950">{value}</div>
        <button
          type="button"
          className="relative inline-flex size-7 items-center justify-center justify-self-end text-slate-500 transition hover:text-sky-600"
          aria-label={`Copy ${label}`}
          onClick={() => void handleCopy(label, value)}
        >
          <IconCopy className="size-4" stroke={1.8} />
          <span
            className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition-opacity ${
              copiedField === label ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Copied
          </span>
        </button>
      </div>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h1 className="shrink-0 text-2xl font-semibold text-slate-950">Bech32</h1>
                  <p className="min-w-0 truncate text-sm text-slate-500">Convert Bech32, addresses, keys, and mnemonics.</p>
                </div>
              </div>

              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  className={
                    action === 'encode'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleActionChange('encode')}
                >
                  Encode
                </button>
                <button
                  type="button"
                  className={
                    action === 'decode'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleActionChange('decode')}
                >
                  Decode
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <div className={action === 'decode' ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-end' : 'grid gap-4 lg:grid-cols-2 lg:items-end'}>
                {action === 'encode' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="bech32-crypto">
                        Crypto
                      </label>
                      <Select value={crypto} onValueChange={(value) => setCrypto(value as Bech32Crypto)}>
                        <SelectTrigger id="bech32-crypto" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ethsecp256k1">ethsecp256k1</SelectItem>
                          <SelectItem value="secp256k1">secp256k1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="bech32-prefix">
                        Prefix
                      </label>
                      <Input id="bech32-prefix" value={prefix} className="mt-1" onChange={(event) => setPrefix(event.target.value)} />
                    </div>
                  </>
                ) : null}

                {action === 'decode' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="bech32-input">
                        Input
                      </label>
                      <Input
                        id="bech32-input"
                        type="text"
                        value={input}
                        className="mt-1 font-mono text-sm"
                        placeholder="Enter a Bech32 address, e.g. cosmos1qqqqhe5pnaq5qq39wqkn957aydnrm45s0jk6ae"
                        onChange={(event) => setInput(event.target.value)}
                      />
                    </div>

                    <Button type="button" className="w-[120px]" disabled={submitting} onClick={() => void handleSubmit()}>
                      {submitting ? 'Running...' : 'Submit'}
                    </Button>
                  </>
                ) : null}
              </div>

              {action === 'encode' ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="bech32-input">
                      Input
                    </label>
                    <div className="relative mt-1">
                      <Input
                        id="bech32-input"
                        type={inputIsSecret && !showSecretInput ? 'password' : 'text'}
                        value={resolvedInputValue}
                        className={inputIsSecret ? 'pr-20 font-mono text-sm' : 'font-mono text-sm'}
                        placeholder="hex address / private key / public key / mnemonic"
                        onChange={(event) => handleInputChange(event.target.value)}
                      />
                      {inputIsSecret ? (
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                          <button
                            type="button"
                            className="relative inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            aria-label={copiedField === 'secret-input' ? 'Input copied' : 'Copy input'}
                            onClick={() => void handleCopy('secret-input', generatedPrivateKey ?? input)}
                          >
                            <IconCopy className="size-4.5" stroke={1.8} />
                            <span
                              className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition-opacity ${
                                copiedField === 'secret-input' ? 'opacity-100' : 'opacity-0'
                              }`}
                            >
                              Copied
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            aria-label={showSecretInput ? 'Hide input' : 'Show input'}
                            onClick={() => setShowSecretInput((current) => !current)}
                          >
                            {showSecretInput ? <IconEyeOff className="size-4.5" stroke={1.8} /> : <IconEye className="size-4.5" stroke={1.8} />}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <Button type="button" className="w-[120px]" disabled={submitting} onClick={() => void handleSubmit()}>
                    {submitting ? 'Running...' : 'Submit'}
                  </Button>
                </div>
              ) : null}
            </div>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

            {result ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {result.action === 'encode' ? (
                  <>
                    {renderResultRow('Address', result.bechAddress)}
                    {renderResultRow('Public key', result.publicKey)}
                    {renderResultRow('Compressed public key', result.compressedPublicKey)}
                  </>
                ) : (
                  <>
                    {renderResultRow('Prefix', result.sourcePrefix ?? result.prefix)}
                    {renderResultRow('Bech32 address', result.bechAddress)}
                    {renderResultRow('Hex address', result.address)}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
