'use client';

import { IconCopy, IconEye, IconEyeOff } from '@tabler/icons-react';
import { type ChangeEvent, useState } from 'react';
import { Keystore } from 'ox';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { copyText } from '@/components/ui/copy-text';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { type Hex } from 'viem';

type ToolMode = 'encrypt' | 'decrypt';

type ScryptKdfParams = {
  dklen: number;
  n: number;
  p: number;
  r: number;
  salt: string;
};

type Pbkdf2KdfParams = {
  c: number;
  dklen: number;
  prf: 'hmac-sha256';
  salt: string;
};

type KeystoreJson = {
  crypto: {
    cipher: 'aes-128-ctr';
    cipherparams: {
      iv: string;
    };
    ciphertext: string;
    kdf: 'scrypt';
    kdfparams: ScryptKdfParams;
    mac: string;
  } | {
    cipher: 'aes-128-ctr';
    cipherparams: {
      iv: string;
    };
    ciphertext: string;
    kdf: 'pbkdf2';
    kdfparams: Pbkdf2KdfParams;
    mac: string;
  };
  id: string;
  version: 3;
};

type ResultCrypto = {
  cipher: 'aes-128-ctr';
  cipherparams: {
    iv: string;
  };
  ciphertext: string;
  kdf: 'scrypt' | 'pbkdf2';
  kdfparams: Record<string, unknown>;
  mac: string;
};

type EncryptResult = {
  Crypto: ResultCrypto;
  address: string;
  id: string;
  version: 3;
};

type DecryptResult = {
  address: string;
  privateKey: string;
};

function normalizePrivateKey(value: string) {
  const normalized = value.trim().replace(/^0x/i, '').toLowerCase();

  if (!normalized) {
    return generatePrivateKey();
  }

  if (!/^[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error('__KEYSTORE_PRIVATE_KEY_HEX__');
  }

  return `0x${normalized}` as Hex;
}

function parseKeystoreInput(value: string): KeystoreJson {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('__KEYSTORE_INVALID_JSON__');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('__KEYSTORE_JSON_OBJECT__');
  }

  const candidate = parsed as {
    crypto?: unknown;
    Crypto?: unknown;
    id?: unknown;
    version?: unknown;
  };

  const rawCrypto = candidate.crypto ?? candidate.Crypto;

  if (!rawCrypto || typeof rawCrypto !== 'object') {
    throw new Error('__KEYSTORE_CRYPTO_FIELD__');
  }

  const cryptoValue = rawCrypto as {
    cipher?: unknown;
    cipherparams?: unknown;
    ciphertext?: unknown;
    kdf?: unknown;
    kdfparams?: unknown;
    mac?: unknown;
  };

  const cipherparams = cryptoValue.cipherparams as { iv?: unknown } | undefined;

  if (typeof cryptoValue.cipher !== 'string' || !cipherparams || typeof cipherparams.iv !== 'string' || typeof cryptoValue.ciphertext !== 'string' || typeof cryptoValue.kdf !== 'string' || !cryptoValue.kdfparams || typeof cryptoValue.kdfparams !== 'object' || typeof cryptoValue.mac !== 'string' || typeof candidate.id !== 'string' || candidate.version !== 3) {
    throw new Error('__KEYSTORE_REQUIRED_FIELDS__');
  }

  if (cryptoValue.cipher !== 'aes-128-ctr') {
    throw new Error('__KEYSTORE_UNSUPPORTED_CIPHER__');
  }

  if (cryptoValue.kdf === 'scrypt') {
    const kdfparams = cryptoValue.kdfparams as Partial<ScryptKdfParams>;

    if (
      typeof kdfparams.dklen !== 'number' ||
      typeof kdfparams.n !== 'number' ||
      typeof kdfparams.p !== 'number' ||
      typeof kdfparams.r !== 'number' ||
      typeof kdfparams.salt !== 'string'
    ) {
      throw new Error('__KEYSTORE_SCRYPT_PARAMS__');
    }

    return {
      crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: {
          iv: cipherparams.iv,
        },
        ciphertext: cryptoValue.ciphertext,
        kdf: 'scrypt',
        kdfparams: {
          dklen: kdfparams.dklen,
          n: kdfparams.n,
          p: kdfparams.p,
          r: kdfparams.r,
          salt: kdfparams.salt,
        },
        mac: cryptoValue.mac,
      },
      id: candidate.id,
      version: 3,
    };
  }

  if (cryptoValue.kdf === 'pbkdf2') {
    const kdfparams = cryptoValue.kdfparams as Partial<Pbkdf2KdfParams>;

    if (typeof kdfparams.c !== 'number' || typeof kdfparams.dklen !== 'number' || kdfparams.prf !== 'hmac-sha256' || typeof kdfparams.salt !== 'string') {
      throw new Error('__KEYSTORE_PBKDF2_PARAMS__');
    }

    return {
      crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: {
          iv: cipherparams.iv,
        },
        ciphertext: cryptoValue.ciphertext,
        kdf: 'pbkdf2',
        kdfparams: {
          c: kdfparams.c,
          dklen: kdfparams.dklen,
          prf: 'hmac-sha256',
          salt: kdfparams.salt,
        },
        mac: cryptoValue.mac,
      },
      id: candidate.id,
      version: 3,
    };
  }

  throw new Error('__KEYSTORE_UNSUPPORTED_KDF__');
}

function createEncryptResult(privateKeyInput: string, password: string): EncryptResult {
  const privateKey = normalizePrivateKey(privateKeyInput);
  const account = privateKeyToAccount(privateKey);
  const [key, options] = Keystore.scrypt({
    password,
    n: 131072,
    p: 1,
    r: 8,
  });
  const encrypted = Keystore.encrypt(privateKey, key, options);

  return {
    Crypto: {
      cipher: encrypted.crypto.cipher,
      cipherparams: {
        iv: encrypted.crypto.cipherparams.iv,
      },
      ciphertext: encrypted.crypto.ciphertext,
      kdf: encrypted.crypto.kdf,
      kdfparams: encrypted.crypto.kdfparams as Record<string, unknown>,
      mac: encrypted.crypto.mac,
    },
    address: account.address,
    id: encrypted.id,
    version: 3,
  };
}

function createDecryptResult(keystoreInput: string, password: string): DecryptResult {
  const keystore = parseKeystoreInput(keystoreInput);
  const key = Keystore.toKey(keystore, { password });
  const privateKey = Keystore.decrypt(keystore, key);
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    privateKey: privateKey.slice(2),
  };
}

export function KeystoreToolPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const keystoreMessages = messages.keystore;
  const commonMessages = messages.common;
  const [mode, setMode] = useState<ToolMode>('encrypt');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keystoreJson, setKeystoreJson] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showDecryptedPrivateKey, setShowDecryptedPrivateKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EncryptResult | DecryptResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function handleModeChange(nextMode: ToolMode) {
    setMode(nextMode);
    setError(null);
    setResult(null);
    setShowDecryptedPrivateKey(false);
  }

  function handlePrivateKeyChange(event: ChangeEvent<HTMLInputElement>) {
    setPrivateKey(event.target.value);
  }

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
      const nextResult = mode === 'encrypt' ? createEncryptResult(privateKey, password) : createDecryptResult(keystoreJson, password);
      setResult(nextResult);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : keystoreMessages.failedToProcess;

      setError(
        message === '__KEYSTORE_PRIVATE_KEY_HEX__'
          ? keystoreMessages.privateKeyMustBeHex
          : message === '__KEYSTORE_INVALID_JSON__'
            ? keystoreMessages.invalidJson
            : message === '__KEYSTORE_JSON_OBJECT__'
              ? keystoreMessages.jsonObjectRequired
              : message === '__KEYSTORE_CRYPTO_FIELD__'
                ? keystoreMessages.cryptoFieldRequired
                : message === '__KEYSTORE_REQUIRED_FIELDS__'
                  ? keystoreMessages.requiredFieldsMissing
                  : message === '__KEYSTORE_UNSUPPORTED_CIPHER__'
                    ? keystoreMessages.unsupportedCipher
                    : message === '__KEYSTORE_SCRYPT_PARAMS__'
                      ? keystoreMessages.scryptParamsMissing
                      : message === '__KEYSTORE_PBKDF2_PARAMS__'
                        ? keystoreMessages.pbkdf2ParamsMissing
                        : message === '__KEYSTORE_UNSUPPORTED_KDF__'
                          ? keystoreMessages.unsupportedKdf
                          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h1 className="shrink-0 text-2xl font-semibold text-slate-950">{keystoreMessages.title}</h1>
                  <p className="min-w-0 truncate text-sm text-slate-500">{keystoreMessages.description}</p>
                </div>
              </div>

              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  className={
                    mode === 'encrypt'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleModeChange('encrypt')}
                >
                  {keystoreMessages.encrypt}
                </button>
                <button
                  type="button"
                  className={
                    mode === 'decrypt'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleModeChange('decrypt')}
                >
                  {keystoreMessages.decrypt}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <div>
                {mode === 'encrypt' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-[25%_minmax(0,1fr)]">
                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="keystore-password">
                          {keystoreMessages.password}
                        </label>
                        <div className="relative mt-1">
                            <Input
                              id="keystore-password"
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              className="pr-11 font-mono text-sm"
                              placeholder={keystoreMessages.enterPassword}
                              onChange={(event) => setPassword(event.target.value)}
                            />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            aria-label={showPassword ? keystoreMessages.hidePassword : keystoreMessages.showPassword}
                            onClick={() => setShowPassword((current) => !current)}
                          >
                            {showPassword ? <IconEyeOff className="size-4.5" stroke={1.8} /> : <IconEye className="size-4.5" stroke={1.8} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700" htmlFor="keystore-private-key">
                          {keystoreMessages.privateKey}
                        </label>
                        <div className="relative mt-1">
                          <Input
                            id="keystore-private-key"
                            type={showPrivateKey ? 'text' : 'password'}
                            value={privateKey}
                            className="pr-11 font-mono text-sm"
                            placeholder={keystoreMessages.privateKeyPlaceholder}
                            onChange={handlePrivateKeyChange}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            aria-label={showPrivateKey ? keystoreMessages.hidePrivateKey : keystoreMessages.showPrivateKey}
                            onClick={() => setShowPrivateKey((current) => !current)}
                          >
                            {showPrivateKey ? <IconEyeOff className="size-4.5" stroke={1.8} /> : <IconEye className="size-4.5" stroke={1.8} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <p className="text-sm leading-6 text-slate-600">
                        {keystoreMessages.encryptDescription}
                      </p>
                      <Button type="button" className="w-[120px] self-end lg:self-auto" disabled={submitting} onClick={() => void handleSubmit()}>
                        {submitting ? commonMessages.running : commonMessages.submit}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              {mode === 'decrypt' ? (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="keystore-json">
                    {keystoreMessages.encryptedJson}
                  </label>
                  <textarea
                    id="keystore-json"
                    value={keystoreJson}
                    className="mt-1 min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                    placeholder={keystoreMessages.keystoreJsonPlaceholder}
                    onChange={(event) => setKeystoreJson(event.target.value)}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700" htmlFor="keystore-password">
                        {keystoreMessages.password}
                      </label>
                      <div className="relative mt-1">
                        <Input
                          id="keystore-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          className="pr-11 font-mono text-sm"
                          placeholder={keystoreMessages.enterPassword}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                          aria-label={showPassword ? keystoreMessages.hidePassword : keystoreMessages.showPassword}
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? <IconEyeOff className="size-4.5" stroke={1.8} /> : <IconEye className="size-4.5" stroke={1.8} />}
                        </button>
                      </div>
                    </div>

                    <Button type="button" className="w-[120px]" disabled={submitting} onClick={() => void handleSubmit()}>
                      {submitting ? commonMessages.running : commonMessages.submit}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{translateRuntimeText(error, locale)}</div> : null}

            {result ? (
              <div className="border-t border-slate-200 pt-5">
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-slate-950">{keystoreMessages.result}</h2>
                  <p className="mt-1 text-sm text-slate-500">{mode === 'encrypt' ? keystoreMessages.generatedPayload : keystoreMessages.recoveredPayload}</p>
                </div>
                {mode === 'encrypt' ? (
                  <JsonViewPanel value={result} />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="grid gap-3 border-b border-slate-200 px-4 py-3 lg:grid-cols-[140px_minmax(0,1fr)_32px] lg:items-center">
                      <div className="text-sm font-semibold text-slate-600">{keystoreMessages.address}</div>
                      <div className="min-w-0 break-all font-mono text-sm text-slate-950">{(result as DecryptResult).address}</div>
                      <ActionIconButton
                        tooltip={copiedField === 'address' ? commonMessages.copied : keystoreMessages.copyAddress}
                        aria-label={copiedField === 'address' ? keystoreMessages.addressCopied : keystoreMessages.copyAddress}
                        className="justify-self-end text-slate-400 hover:text-sky-600"
                        onClick={() => void handleCopy('address', (result as DecryptResult).address)}
                      >
                        <IconCopy className="size-4" stroke={1.8} />
                      </ActionIconButton>
                    </div>

                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[140px_minmax(0,1fr)_64px] lg:items-center">
                      <div className="text-sm font-semibold text-slate-600">{keystoreMessages.privateKey}</div>
                      <div className="min-w-0 break-all font-mono text-sm text-slate-950">
                        {showDecryptedPrivateKey ? (result as DecryptResult).privateKey : '•'.repeat((result as DecryptResult).privateKey.length)}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <ActionIconButton
                          tooltip={showDecryptedPrivateKey ? keystoreMessages.hidePrivateKey : keystoreMessages.showPrivateKey}
                          aria-label={showDecryptedPrivateKey ? keystoreMessages.hidePrivateKey : keystoreMessages.showPrivateKey}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => setShowDecryptedPrivateKey((current) => !current)}
                        >
                          {showDecryptedPrivateKey ? <IconEyeOff className="size-4" stroke={1.8} /> : <IconEye className="size-4" stroke={1.8} />}
                        </ActionIconButton>
                        <ActionIconButton
                          tooltip={copiedField === 'privateKey' ? commonMessages.copied : keystoreMessages.copyPrivateKey}
                          aria-label={copiedField === 'privateKey' ? keystoreMessages.privateKeyCopied : keystoreMessages.copyPrivateKey}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => void handleCopy('privateKey', (result as DecryptResult).privateKey)}
                        >
                          <IconCopy className="size-4" stroke={1.8} />
                        </ActionIconButton>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
