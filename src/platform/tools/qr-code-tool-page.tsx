'use client';

import { IconCopy, IconDownload, IconQrcode, IconUpload } from '@tabler/icons-react';
import Image from 'next/image';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/locale-provider';
import { AppShell } from '@/platform/layout/app-shell';
import { decodeQrCode, generateQrCode, MAX_QR_IMAGE_BYTES, MAX_QR_TEXT_BYTES } from '@/platform/tools/qr-code';

type ToolMode = 'generate' | 'decode';

const TEXTAREA_CLASS_NAME = 'min-h-[240px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400';

export function QrCodeToolPage() {
  const messages = useMessages();
  const qrMessages = messages.qrCode;
  const { showToast } = useToast();
  const [mode, setMode] = useState<ToolMode>('generate');
  const [text, setText] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [decodedText, setDecodedText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textBytes = new TextEncoder().encode(text).length;
  const textTooLong = textBytes > MAX_QR_TEXT_BYTES;

  useEffect(() => {
    return () => {
      if (uploadedImage) {
        URL.revokeObjectURL(uploadedImage);
      }
    };
  }, [uploadedImage]);

  function showError(cause: unknown) {
    const errors: Record<string, string> = {
      QR_EMPTY_TEXT: qrMessages.emptyText,
      QR_TEXT_TOO_LONG: qrMessages.textTooLong,
      QR_INVALID_IMAGE: qrMessages.invalidImage,
      QR_NOT_FOUND: qrMessages.noQrCode,
      QR_CANVAS_UNAVAILABLE: qrMessages.canvasUnavailable,
    };
    setError(cause instanceof Error ? errors[cause.message] ?? qrMessages.failedToProcess : qrMessages.failedToProcess);
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setGeneratedImage(null);

    try {
      setGeneratedImage(await generateQrCode(text));
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError(null);
    setDecodedText(null);
    setUploadedImage(null);
    setFileName('');

    if (file.type && !file.type.startsWith('image/')) {
      setError(qrMessages.invalidImage);
      return;
    }

    if (file.size > MAX_QR_IMAGE_BYTES) {
      setError(qrMessages.imageTooLarge);
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setFileName(file.name);
    setBusy(true);

    try {
      setDecodedText(await decodeQrCode(imageUrl));
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!generatedImage) {
      return;
    }

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'qrcode.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleCopy() {
    if (decodedText === null) {
      return;
    }

    try {
      await copyText(decodedText);
      showToast({ title: messages.common.copied });
    } catch {
      showToast({ title: qrMessages.copyFailed, tone: 'error' });
    }
  }

  return (
    <AppShell>
      <main className="section-block">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-slate-950">{qrMessages.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{qrMessages.description}</p>
            </div>
            <div className="inline-flex self-end rounded-2xl border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={qrMessages.mode}>
              {(['generate', 'decode'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === item}
                  className={`rounded-[14px] px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 ${mode === item ? 'bg-white text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]' : 'text-slate-500 hover:text-slate-900'}`}
                  onClick={() => {
                    setMode(item);
                    setError(null);
                  }}
                >
                  {qrMessages[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 p-6">
            {mode === 'generate' ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
                <div className="min-w-0 space-y-3">
                  <label htmlFor="qr-code-text" className="block text-sm font-medium text-slate-700">{qrMessages.text}</label>
                  <textarea
                    id="qr-code-text"
                    value={text}
                    disabled={busy}
                    placeholder={qrMessages.textPlaceholder}
                    className={TEXTAREA_CLASS_NAME}
                    aria-invalid={textTooLong}
                    aria-describedby="qr-code-text-size"
                    onChange={(event) => {
                      setText(event.target.value);
                      setGeneratedImage(null);
                      setError(null);
                    }}
                  />
                  <p id="qr-code-text-size" className={`text-xs ${textTooLong ? 'text-rose-600' : 'text-slate-500'}`}>
                    {textBytes.toLocaleString()} / {MAX_QR_TEXT_BYTES.toLocaleString()} {qrMessages.bytes}
                    {textTooLong ? ` · ${qrMessages.textTooLong}` : ''}
                  </p>
                  <div className="flex justify-end">
                    <Button type="button" disabled={busy || !text || textTooLong} onClick={() => void handleGenerate()}>
                      <IconQrcode className="mr-2 size-4" aria-hidden="true" />
                      {busy ? qrMessages.generating : qrMessages.generate}
                    </Button>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-700">{qrMessages.preview}</h2>
                  <div className="flex min-h-[280px] flex-1 items-center justify-center py-4" aria-live="polite">
                    {generatedImage ? (
                      <Image src={generatedImage} alt={qrMessages.generatedImage} width={512} height={512} unoptimized className="h-auto w-full max-w-80 rounded-lg" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center text-slate-400">
                        <IconQrcode className="size-16" stroke={1} aria-hidden="true" />
                        <p className="max-w-60 text-sm">{qrMessages.previewPlaceholder}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" disabled={!generatedImage} onClick={handleDownload}>
                      <IconDownload className="mr-2 size-4" aria-hidden="true" />
                      {qrMessages.download}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="min-w-0 space-y-3">
                  <h2 className="text-sm font-medium text-slate-700">{qrMessages.image}</h2>
                  <input ref={fileInputRef} type="file" accept="image/*" disabled={busy} className="hidden" aria-label={qrMessages.upload} onChange={(event) => void handleUpload(event)} />
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    {uploadedImage ? (
                      <div className="relative h-60 w-full">
                        <Image src={uploadedImage} alt={qrMessages.uploadedImage} fill unoptimized className="object-contain" />
                      </div>
                    ) : (
                      <>
                        <IconUpload className="size-12 text-slate-400" stroke={1.3} aria-hidden="true" />
                        <p className="text-center text-sm text-slate-500">{qrMessages.uploadHint}</p>
                      </>
                    )}
                  </div>
                  {fileName ? <p className="break-all text-xs text-slate-500">{fileName}</p> : null}
                  <div className="flex justify-end">
                    <Button type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                      <IconUpload className="mr-2 size-4" aria-hidden="true" />
                      {busy ? qrMessages.decoding : qrMessages.upload}
                    </Button>
                  </div>
                </div>
                <div className="min-w-0 space-y-3">
                  <label htmlFor="qr-code-result" className="block text-sm font-medium text-slate-700">{qrMessages.decodedText}</label>
                  <textarea id="qr-code-result" readOnly value={decodedText ?? ''} placeholder={qrMessages.resultPlaceholder} className={`${TEXTAREA_CLASS_NAME} min-h-[280px] font-mono`} />
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" disabled={decodedText === null} onClick={() => void handleCopy()}>
                      <IconCopy className="mr-2 size-4" aria-hidden="true" />
                      {qrMessages.copyText}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">{qrMessages.localOnly}</p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
