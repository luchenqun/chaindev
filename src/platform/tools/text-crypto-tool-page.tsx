'use client';

import { IconCopy, IconEye, IconEyeOff } from '@tabler/icons-react';
import { type ChangeEvent, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type ToolMode = 'encrypt' | 'decrypt';

type EncryptedTextPayload = {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

type EncryptResult = EncryptedTextPayload;

type DecryptResult = {
  plaintext: string;
};

const PBKDF2_ITERATIONS = 250000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function decodeBase64(value: string) {
  let binary: string;

  try {
    binary = window.atob(value);
  } catch {
    throw new Error('__TEXT_CRYPTO_INVALID_BASE64__');
  }

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseEncryptedPayload(value: string): EncryptedTextPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('__TEXT_CRYPTO_INVALID_JSON__');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('__TEXT_CRYPTO_JSON_OBJECT__');
  }

  const candidate = parsed as Partial<EncryptedTextPayload>;

  if (
    candidate.version !== 1 ||
    typeof candidate.algorithm !== 'string' ||
    typeof candidate.kdf !== 'string' ||
    typeof candidate.hash !== 'string' ||
    typeof candidate.iterations !== 'number' ||
    typeof candidate.salt !== 'string' ||
    typeof candidate.iv !== 'string' ||
    typeof candidate.ciphertext !== 'string'
  ) {
    throw new Error('__TEXT_CRYPTO_REQUIRED_FIELDS__');
  }

  if (candidate.algorithm !== 'AES-GCM') {
    throw new Error('__TEXT_CRYPTO_UNSUPPORTED_ALGORITHM__');
  }

  if (candidate.kdf !== 'PBKDF2') {
    throw new Error('__TEXT_CRYPTO_UNSUPPORTED_KDF__');
  }

  if (candidate.hash !== 'SHA-256') {
    throw new Error('__TEXT_CRYPTO_UNSUPPORTED_HASH__');
  }

  if (!Number.isInteger(candidate.iterations) || candidate.iterations < 100000) {
    throw new Error('__TEXT_CRYPTO_INVALID_ITERATIONS__');
  }

  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: candidate.iterations,
    salt: candidate.salt,
    iv: candidate.iv,
    ciphertext: candidate.ciphertext,
  };
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number) {
  const passwordBytes = new TextEncoder().encode(password);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function createEncryptResult(plaintextInput: string, password: string): Promise<EncryptResult> {
  const plaintext = plaintextInput;

  if (!plaintext) {
    throw new Error('__TEXT_CRYPTO_EMPTY_PLAINTEXT__');
  }

  if (!password) {
    throw new Error('__TEXT_CRYPTO_EMPTY_PASSWORD__');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintextBytes),
  );

  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(encryptedBuffer)),
  };
}

async function createDecryptResult(payloadInput: string, password: string): Promise<DecryptResult> {
  if (!password) {
    throw new Error('__TEXT_CRYPTO_EMPTY_PASSWORD__');
  }

  const payload = parseEncryptedPayload(payloadInput);
  const salt = decodeBase64(payload.salt);
  const iv = decodeBase64(payload.iv);
  const ciphertext = decodeBase64(payload.ciphertext);
  const key = await deriveAesKey(password, salt, payload.iterations);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
      },
      key,
      toArrayBuffer(ciphertext),
    );

    return {
      plaintext: new TextDecoder().decode(decryptedBuffer),
    };
  } catch {
    throw new Error('__TEXT_CRYPTO_DECRYPT_FAILED__');
  }
}

export function TextCryptoToolPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const textCryptoMessages = messages.textCrypto;
  const commonMessages = messages.common;
  const [mode, setMode] = useState<ToolMode>('encrypt');
  const [password, setPassword] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [encryptedPayload, setEncryptedPayload] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPlaintext, setShowPlaintext] = useState(true);
  const [showDecryptedPlaintext, setShowDecryptedPlaintext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EncryptResult | DecryptResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function handleModeChange(nextMode: ToolMode) {
    setMode(nextMode);
    setPassword('');
    setPlaintext('');
    setEncryptedPayload('');
    setError(null);
    setResult(null);
    setCopiedField(null);
    setShowPassword(false);
    setShowPlaintext(true);
    setShowDecryptedPlaintext(false);
  }

  function handlePlaintextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setPlaintext(event.target.value);
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
      const nextResult = mode === 'encrypt'
        ? await createEncryptResult(plaintext, password)
        : await createDecryptResult(encryptedPayload, password);
      setResult(nextResult);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : textCryptoMessages.failedToProcess;

      setError(
        message === '__TEXT_CRYPTO_EMPTY_PLAINTEXT__'
          ? textCryptoMessages.emptyPlaintext
          : message === '__TEXT_CRYPTO_EMPTY_PASSWORD__'
            ? textCryptoMessages.emptyPassword
            : message === '__TEXT_CRYPTO_INVALID_JSON__'
              ? textCryptoMessages.invalidJson
              : message === '__TEXT_CRYPTO_JSON_OBJECT__'
                ? textCryptoMessages.jsonObjectRequired
                : message === '__TEXT_CRYPTO_REQUIRED_FIELDS__'
                  ? textCryptoMessages.requiredFieldsMissing
                  : message === '__TEXT_CRYPTO_UNSUPPORTED_ALGORITHM__'
                    ? textCryptoMessages.unsupportedAlgorithm
                    : message === '__TEXT_CRYPTO_UNSUPPORTED_KDF__'
                      ? textCryptoMessages.unsupportedKdf
                      : message === '__TEXT_CRYPTO_UNSUPPORTED_HASH__'
                        ? textCryptoMessages.unsupportedHash
                        : message === '__TEXT_CRYPTO_INVALID_ITERATIONS__'
                          ? textCryptoMessages.invalidIterations
                          : message === '__TEXT_CRYPTO_INVALID_BASE64__'
                            ? textCryptoMessages.invalidBase64
                            : message === '__TEXT_CRYPTO_DECRYPT_FAILED__'
                              ? textCryptoMessages.decryptFailed
                              : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="section-block">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h1 className="shrink-0 text-2xl font-semibold text-slate-950">{textCryptoMessages.title}</h1>
                  <p className="min-w-0 truncate text-sm text-slate-500">{textCryptoMessages.description}</p>
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
                  {textCryptoMessages.encrypt}
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
                  {textCryptoMessages.decrypt}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <div>
                {mode === 'encrypt' ? (
                  <div className="mt-1">
                    <div className="relative mt-1">
                      <textarea
                        id="text-crypto-plaintext"
                        value={plaintext}
                        className="min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                        placeholder={textCryptoMessages.plaintextPlaceholder}
                        onChange={handlePlaintextChange}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-3 z-10 inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                        aria-label={showPlaintext ? textCryptoMessages.hidePlaintext : textCryptoMessages.showPlaintext}
                        onClick={() => setShowPlaintext((current) => !current)}
                      >
                        {showPlaintext ? <IconEyeOff className="size-4.5" stroke={1.8} /> : <IconEye className="size-4.5" stroke={1.8} />}
                      </button>
                      {!showPlaintext ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 rounded-xl bg-white/92 px-4 py-3 text-sm text-slate-400">
                          {'•'.repeat(Math.max(plaintext.length, 24))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-end">
                      <div>
                        <div className="relative mt-1">
                          <Input
                            id="text-crypto-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            className="pr-11 font-mono text-sm"
                            placeholder={textCryptoMessages.enterPassword}
                            onChange={(event) => setPassword(event.target.value)}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                            aria-label={showPassword ? textCryptoMessages.hidePassword : textCryptoMessages.showPassword}
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

                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {textCryptoMessages.encryptDescription}
                    </p>
                  </div>
                ) : null}
              </div>

              {mode === 'decrypt' ? (
                <div className="mt-1">
                  <textarea
                    id="text-crypto-payload"
                    value={encryptedPayload}
                    className="mt-1 min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                    placeholder={textCryptoMessages.payloadPlaceholder}
                    onChange={(event) => setEncryptedPayload(event.target.value)}
                  />
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-end">
                    <div>
                      <div className="relative mt-1">
                        <Input
                          id="text-crypto-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          className="pr-11 font-mono text-sm"
                          placeholder={textCryptoMessages.enterPassword}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-sky-600"
                          aria-label={showPassword ? textCryptoMessages.hidePassword : textCryptoMessages.showPassword}
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
                  <h2 className="text-base font-semibold text-slate-950">{textCryptoMessages.result}</h2>
                  <p className="mt-1 text-sm text-slate-500">{mode === 'encrypt' ? textCryptoMessages.generatedPayload : textCryptoMessages.recoveredPayload}</p>
                </div>
                {mode === 'encrypt' ? (
                  <JsonViewPanel value={result} />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[140px_minmax(0,1fr)_64px] lg:items-start">
                      <div className="text-sm font-semibold text-slate-600">{textCryptoMessages.plaintext}</div>
                      <div className="min-w-0 whitespace-pre-wrap break-all font-mono text-sm text-slate-950">
                        {showDecryptedPlaintext ? (result as DecryptResult).plaintext : '•'.repeat((result as DecryptResult).plaintext.length)}
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <ActionIconButton
                          tooltip={showDecryptedPlaintext ? textCryptoMessages.hidePlaintext : textCryptoMessages.showPlaintext}
                          aria-label={showDecryptedPlaintext ? textCryptoMessages.hidePlaintext : textCryptoMessages.showPlaintext}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => setShowDecryptedPlaintext((current) => !current)}
                        >
                          {showDecryptedPlaintext ? <IconEyeOff className="size-4" stroke={1.8} /> : <IconEye className="size-4" stroke={1.8} />}
                        </ActionIconButton>
                        <ActionIconButton
                          tooltip={copiedField === 'plaintext' ? commonMessages.copied : textCryptoMessages.copyPlaintext}
                          aria-label={copiedField === 'plaintext' ? textCryptoMessages.plaintextCopied : textCryptoMessages.copyPlaintext}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => void handleCopy('plaintext', (result as DecryptResult).plaintext)}
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
