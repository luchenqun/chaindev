'use client';

import { IconArrowsExchange, IconCopy } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { AppShell } from '@/platform/layout/app-shell';

type OperationId = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'mod' | 'and' | 'or' | 'xor';

type OperationDefinition = {
  id: OperationId;
  label: string;
};

const OPERATION_DEFINITIONS: OperationDefinition[] = [
  { id: 'add', label: 'A + B' },
  { id: 'subtract', label: 'A - B' },
  { id: 'multiply', label: 'A * B' },
  { id: 'divide', label: 'A / B' },
  { id: 'power', label: 'A^B' },
  { id: 'mod', label: 'A MOD B' },
  { id: 'and', label: 'A AND B' },
  { id: 'or', label: 'A OR B' },
  { id: 'xor', label: 'A XOR B' },
];

type ResultBase = 'decimal' | 'hex';

function parseBigInteger(value: string, fieldLabel: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return BigInt(trimmedValue);
}

function normalizeModulo(value: bigint, modulo: bigint) {
  return ((value % modulo) + modulo) % modulo;
}

function computeResult(operationId: OperationId, rawA: string, rawB: string) {
  const a = parseBigInteger(rawA, 'Number (A)');
  const b = parseBigInteger(rawB, 'Number (B)');

  switch (operationId) {
    case 'add':
      return (a + b).toString();
    case 'subtract':
      return (a - b).toString();
    case 'multiply':
      return (a * b).toString();
    case 'divide':
      if (b === 0n) {
        throw new Error('Division by zero is not allowed.');
      }
      return (a / b).toString();
    case 'power':
      if (b < 0n) {
        throw new Error('Exponent must be zero or a positive integer.');
      }
      return (a ** b).toString();
    case 'mod':
      if (b === 0n) {
        throw new Error('Modulo by zero is not allowed.');
      }
      return normalizeModulo(a, b).toString();
    case 'and':
      return (a & b).toString();
    case 'or':
      return (a | b).toString();
    case 'xor':
      return (a ^ b).toString();
    default:
      return '';
  }
}

function formatBigIntForBase(value: bigint, base: ResultBase) {
  if (base === 'decimal') {
    return value.toString();
  }

  const prefix = value < 0n ? '-0x' : '0x';
  const absoluteValue = value < 0n ? -value : value;
  return `${prefix}${absoluteValue.toString(16)}`;
}

export default function BigNumberPage() {
  const [numberA, setNumberA] = useState('');
  const [numberB, setNumberB] = useState('');
  const [activeOperation, setActiveOperation] = useState<OperationId | null>(null);
  const [resultBase, setResultBase] = useState<ResultBase>('decimal');
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (!activeOperation) {
      return {
        value: '',
        error: null,
      };
    }

    try {
      return {
        value: computeResult(activeOperation, numberA, numberB),
        error: null,
      };
    } catch (error) {
      return {
        value: '',
        error: error instanceof Error ? error.message : 'Computation failed.',
      };
    }
  }, [activeOperation, numberA, numberB]);

  const displayedResult = useMemo(() => {
    if (output.error || !output.value.trim()) {
      return output.error || output.value;
    }

    try {
      return formatBigIntForBase(BigInt(output.value), resultBase);
    } catch {
      return output.value;
    }
  }, [output.error, output.value, resultBase]);

  async function handleCopy() {
    const valueToCopy = displayedResult;

    if (!valueToCopy.trim()) {
      return;
    }

    await copyText(valueToCopy);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1200);
  }

  function handleToggleResultBase() {
    setResultBase((current) => (current === 'decimal' ? 'hex' : 'decimal'));
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Big Number Calculator</h1>
              <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">
                Perform large integer arithmetic directly in the browser, including modular and bitwise operations.
              </p>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <label className="block text-[18px] font-semibold text-slate-950" htmlFor="big-number-a">
                  Number (A)
                </label>
                <textarea
                  id="big-number-a"
                  value={numberA}
                  className="mt-3 min-h-[170px] w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-[20px] leading-8 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                  placeholder="Enter an integer"
                  onChange={(event) => setNumberA(event.target.value)}
                />
              </div>
              <div>
                <label className="block text-[18px] font-semibold text-slate-950" htmlFor="big-number-b">
                  Number (B)
                </label>
                <textarea
                  id="big-number-b"
                  value={numberB}
                  className="mt-3 min-h-[170px] w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-[20px] leading-8 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                  placeholder="Enter an integer"
                  onChange={(event) => setNumberB(event.target.value)}
                />
              </div>
            </div>

            <div>
              <h2 className="text-[18px] font-semibold text-slate-950">Calculate</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {OPERATION_DEFINITIONS.map((operation) => (
                  <Button
                    key={operation.id}
                    type="button"
                    variant={operation.id === activeOperation ? 'default' : 'outline'}
                    className={
                      operation.id === activeOperation
                        ? 'h-11 rounded-xl bg-sky-600 px-6 text-white hover:bg-sky-700'
                        : 'h-11 rounded-xl border-slate-200 px-6 text-slate-700 hover:bg-slate-50'
                    }
                    onClick={() => setActiveOperation(operation.id)}
                  >
                    <span className="text-[18px] font-semibold leading-none">{operation.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold text-slate-950">Result</h2>
              <div className="flex items-center gap-2">
                <ActionIconButton
                  tooltip={resultBase === 'decimal' ? 'Switch result to hex' : 'Switch result to decimal'}
                  aria-label={resultBase === 'decimal' ? 'Switch result to hex' : 'Switch result to decimal'}
                  className={output.error || !output.value ? 'text-slate-300 hover:text-slate-300' : 'text-slate-400 hover:text-sky-600'}
                  disabled={!!output.error || !output.value}
                  onClick={handleToggleResultBase}
                >
                  <IconArrowsExchange className="size-4" stroke={1.8} />
                </ActionIconButton>
                <ActionIconButton
                  tooltip={copied ? 'Copied' : 'Copy result'}
                  aria-label={copied ? 'Result copied' : 'Copy result'}
                  className={displayedResult.trim() ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300 hover:text-slate-300'}
                  disabled={!displayedResult.trim()}
                  onClick={() => void handleCopy()}
                >
                  <IconCopy className="size-4" stroke={1.8} />
                </ActionIconButton>
              </div>
            </div>

            <div className={`mt-4 max-h-[260px] overflow-auto rounded-xl border px-5 py-4 ${output.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[18px] leading-8">{displayedResult || ''}</pre>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
