'use client';

import { IconCopy } from '@tabler/icons-react';
import { base64 } from '@scure/base';
import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { bytesToHex, fromRlp, hexToBytes, hexToString, keccak256, numberToHex, sha256, stringToBytes, stringToHex, toRlp } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { AppShell } from '@/platform/layout/app-shell';

type HashToolId =
  | 'keccak256'
  | 'sha256'
  | 'rlp_decode'
  | 'rlp_encode'
  | 'hex_to_number'
  | 'number_to_hex'
  | 'hex_to_ascii'
  | 'ascii_to_hex'
  | 'hex_to_bytes'
  | 'bytes_to_hex'
  | 'base64_encode'
  | 'base64_decode'
  | 'string_length';

type DisplayFormat = 'hex' | 'string';

type HashToolDefinition = {
  id: HashToolId;
  label: string;
};

type RlpHexTree = Hex | readonly RlpHexTree[];

const TOOL_DEFINITIONS: HashToolDefinition[] = [
  { id: 'keccak256', label: 'keccak256' },
  { id: 'sha256', label: 'sha256' },
  { id: 'rlp_decode', label: 'RLP Decode' },
  { id: 'rlp_encode', label: 'RLP Encode' },
  { id: 'hex_to_number', label: 'Hex to Number' },
  { id: 'number_to_hex', label: 'Number to Hex' },
  { id: 'hex_to_ascii', label: 'Hex to ASCII' },
  { id: 'ascii_to_hex', label: 'ASCII to Hex' },
  { id: 'hex_to_bytes', label: 'Hex to Bytes Array' },
  { id: 'bytes_to_hex', label: 'Bytes Array to Hex' },
  { id: 'base64_encode', label: 'Base64 Encode' },
  { id: 'base64_decode', label: 'Base64 Decode' },
  { id: 'string_length', label: 'String Length' },
];

function ensureHexPrefix(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return '0x' as Hex;
  }

  return (normalizedValue.startsWith('0x') || normalizedValue.startsWith('0X') ? normalizedValue : `0x${normalizedValue}`) as Hex;
}

function normalizeHexInput(value: string) {
  return ensureHexPrefix(value).toLowerCase() as Hex;
}

function parseHexBytesInput(value: string) {
  return hexToBytes(normalizeHexInput(value));
}

function parseBytesArrayInput(value: string) {
  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error('Bytes array input must be a JSON array.');
  }

  const numericValues = parsed.map((entry) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > 255) {
      throw new Error('Bytes array values must be integers between 0 and 255.');
    }

    return entry;
  });

  return Uint8Array.from(numericValues);
}

function normalizeRlpEncodeInput(value: unknown): RlpHexTree {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeRlpEncodeInput(entry));
  }

  if (typeof value === 'string') {
    return value.trim().startsWith('0x') || value.trim().startsWith('0X') ? normalizeHexInput(value) : stringToHex(value);
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return stringToHex(String(value));
  }

  if (value === null) {
    return stringToHex('');
  }

  throw new Error('RLP encoding only supports strings, numbers, booleans, null, or nested arrays.');
}

function tryParseRlpEncodeInput(value: string): RlpHexTree {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return stringToHex('');
  }

  try {
    return normalizeRlpEncodeInput(JSON.parse(trimmedValue));
  } catch {
    return trimmedValue.startsWith('0x') || trimmedValue.startsWith('0X') ? normalizeHexInput(trimmedValue) : stringToHex(trimmedValue);
  }
}

function decodeRlpValue(value: RlpHexTree, displayFormat: DisplayFormat): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeRlpValue(entry, displayFormat));
  }

  const leafValue = value as Hex;
  return displayFormat === 'hex' ? leafValue : hexToString(leafValue);
}

function stringifyOutput(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(
    value,
    (_key, entry) => {
      if (typeof entry === 'bigint') {
        return entry.toString();
      }

      return entry;
    },
    2,
  );
}

function shouldShowHexBytesToggle(toolId: HashToolId) {
  return toolId === 'keccak256' || toolId === 'sha256';
}

function shouldShowDisplayFormat(toolId: HashToolId) {
  return toolId === 'rlp_decode' || toolId === 'base64_decode';
}

function computeResult(toolId: HashToolId, input: string, useHexBytes: boolean, displayFormat: DisplayFormat) {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return '';
  }

  switch (toolId) {
    case 'keccak256':
      return keccak256(useHexBytes ? parseHexBytesInput(input) : stringToBytes(input));
    case 'sha256':
      return sha256(useHexBytes ? parseHexBytesInput(input) : stringToBytes(input));
    case 'rlp_decode': {
      const decoded = fromRlp(normalizeHexInput(input), 'hex') as RlpHexTree;
      return decodeRlpValue(decoded, displayFormat);
    }
    case 'rlp_encode':
      return toRlp(tryParseRlpEncodeInput(input));
    case 'hex_to_number':
      return BigInt(normalizeHexInput(input)).toString();
    case 'number_to_hex':
      return numberToHex(BigInt(trimmedInput));
    case 'hex_to_ascii':
      return hexToString(normalizeHexInput(input));
    case 'ascii_to_hex':
      return stringToHex(input);
    case 'hex_to_bytes':
      return Array.from(parseHexBytesInput(input));
    case 'bytes_to_hex':
      return bytesToHex(parseBytesArrayInput(input));
    case 'base64_encode':
      return base64.encode(stringToBytes(input));
    case 'base64_decode': {
      const decoded = base64.decode(trimmedInput);
      return displayFormat === 'hex' ? bytesToHex(decoded) : new TextDecoder().decode(decoded);
    }
    case 'string_length':
      return String(input.length);
    default:
      return '';
  }
}

export default function HashToolPage() {
  const [activeToolId, setActiveToolId] = useState<HashToolId>('keccak256');
  const [input, setInput] = useState('');
  const [useHexBytes, setUseHexBytes] = useState(false);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('hex');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUseHexBytes(false);
    setDisplayFormat('hex');
  }, [activeToolId]);

  const output = useMemo(() => {
    try {
      return {
        value: computeResult(activeToolId, input, useHexBytes, displayFormat),
        error: null,
      };
    } catch (error) {
      return {
        value: '',
        error: error instanceof Error ? error.message : 'Computation failed.',
      };
    }
  }, [activeToolId, displayFormat, input, useHexBytes]);

  const outputText = useMemo(() => {
    if (output.error) {
      return output.error;
    }

    return stringifyOutput(output.value);
  }, [output.error, output.value]);

  async function handleCopy() {
    if (!outputText.trim()) {
      return;
    }

    await copyText(outputText);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1200);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Hash & Encoding</h1>
              <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">
                Common hash, RLP, Base64, hex, ASCII, and bytes conversions, all executed directly in the browser.
              </p>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2.5">
                  {TOOL_DEFINITIONS.map((tool) => (
                    <Button
                      key={tool.id}
                      type="button"
                      variant={tool.id === activeToolId ? 'default' : 'outline'}
                      size="sm"
                      className={tool.id === activeToolId ? 'bg-sky-600 hover:bg-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
                      onClick={() => setActiveToolId(tool.id)}
                    >
                      {tool.label}
                    </Button>
                  ))}
              </div>

              <div>
                <textarea
                  id="hash-tool-input"
                  value={input}
                  className="min-h-[220px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                  placeholder={
                    activeToolId === 'rlp_encode'
                      ? 'Enter a string or a JSON array, for example ["0x01", "hello", ["0x02"]]'
                      : activeToolId === 'bytes_to_hex'
                        ? 'Enter a JSON array, for example [104, 101, 108, 108, 111]'
                        : activeToolId === 'base64_decode'
                          ? 'Enter a Base64 string'
                          : 'Enter a value to process'
                  }
                  onChange={(event) => setInput(event.target.value)}
                />
              </div>

              {shouldShowHexBytesToggle(activeToolId) ? (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                    checked={useHexBytes}
                    onChange={(event) => setUseHexBytes(event.target.checked)}
                  />
                  <span>Treat input as hex bytes</span>
                </label>
              ) : null}

              {shouldShowDisplayFormat(activeToolId) ? (
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                  <span className="font-medium text-slate-700">Output format</span>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="display-format"
                      className="size-4 border-slate-300 text-sky-600 focus:ring-sky-400"
                      checked={displayFormat === 'hex'}
                      onChange={() => setDisplayFormat('hex')}
                    />
                    <span>Hex</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="display-format"
                      className="size-4 border-slate-300 text-sky-600 focus:ring-sky-400"
                      checked={displayFormat === 'string'}
                      onChange={() => setDisplayFormat('string')}
                    />
                    <span>String</span>
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Result</h2>
                <p className="mt-1 text-sm text-slate-500">Current method: {TOOL_DEFINITIONS.find((tool) => tool.id === activeToolId)?.label}</p>
              </div>
              <ActionIconButton
                tooltip={copied ? 'Copied' : 'Copy result'}
                aria-label={copied ? 'Result copied' : 'Copy result'}
                className={outputText.trim() ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300 hover:text-slate-300'}
                disabled={!outputText.trim()}
                onClick={() => void handleCopy()}
              >
                <IconCopy className="size-5" stroke={1.8} />
              </ActionIconButton>
            </div>

            <div
              className={`mt-4 rounded-xl border px-4 py-3 ${
                output.error ? 'max-h-[240px] overflow-auto border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-6">{outputText || ''}</pre>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
