'use client';

import { IconCopy } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { copyText } from '@/components/ui/copy-text';
import { AppShell } from '@/platform/layout/app-shell';

type UnitDefinition = {
  id: 'wei' | 'kwei' | 'mwei' | 'gwei' | 'szabo' | 'finney' | 'eth';
  label: string;
  exponentLabel: string;
  decimals: number;
};

const UNIT_DEFINITIONS: UnitDefinition[] = [
  { id: 'wei', label: 'Wei', exponentLabel: '10^-18', decimals: 0 },
  { id: 'kwei', label: 'Kwei', exponentLabel: '10^-15', decimals: 3 },
  { id: 'mwei', label: 'Mwei', exponentLabel: '10^-12', decimals: 6 },
  { id: 'gwei', label: 'Gwei', exponentLabel: '10^-9', decimals: 9 },
  { id: 'szabo', label: 'Szabo', exponentLabel: '10^-6', decimals: 12 },
  { id: 'finney', label: 'Finney', exponentLabel: '10^-3', decimals: 15 },
  { id: 'eth', label: 'ETH', exponentLabel: '1', decimals: 18 },
];

const DECIMAL_INPUT_PATTERN = /^(?:\d+\.?\d*|\.\d+)$/;

function toUnitPower(decimals: number) {
  return 10n ** BigInt(decimals);
}

function parseUnitValueToWei(rawValue: string, unit: UnitDefinition) {
  const normalizedValue = rawValue.trim();

  if (!DECIMAL_INPUT_PATTERN.test(normalizedValue)) {
    throw new Error('Enter a valid numeric value.');
  }

  const [integerPartRaw = '0', fractionalPartRaw = ''] = normalizedValue.split('.');

  if (fractionalPartRaw.length > unit.decimals) {
    throw new Error(`${unit.label} supports up to ${unit.decimals} decimal places.`);
  }

  const integerPart = integerPartRaw || '0';
  const fractionalPart = unit.decimals === 0 ? '0' : (fractionalPartRaw || '').padEnd(unit.decimals, '0') || '0';
  const weiValue = BigInt(integerPart) * toUnitPower(unit.decimals) + BigInt(fractionalPart);

  return weiValue.toString();
}

function formatWeiToUnit(weiValue: string, unit: UnitDefinition) {
  const value = BigInt(weiValue);

  if (unit.decimals === 0) {
    return value.toString();
  }

  const divisor = toUnitPower(unit.decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalText = fractionalPart.toString().padStart(unit.decimals, '0').replace(/0+$/, '');
  return `${integerPart}.${fractionalText}`;
}

function buildInitialWeiValue() {
  return parseUnitValueToWei('1', UNIT_DEFINITIONS[UNIT_DEFINITIONS.length - 1]);
}

export default function EvmUnitConverterPage() {
  const [activeUnitId, setActiveUnitId] = useState<UnitDefinition['id']>('eth');
  const [draftValue, setDraftValue] = useState('1');
  const [weiValue, setWeiValue] = useState<string | null>(buildInitialWeiValue);
  const [error, setError] = useState<string | null>(null);
  const [copiedUnitId, setCopiedUnitId] = useState<UnitDefinition['id'] | null>(null);

  const unitValues = useMemo(() => {
    return Object.fromEntries(
      UNIT_DEFINITIONS.map((unit) => {
        if (activeUnitId === unit.id) {
          return [unit.id, draftValue];
        }

        if (!weiValue) {
          return [unit.id, ''];
        }

        return [unit.id, formatWeiToUnit(weiValue, unit)];
      }),
    ) as Record<UnitDefinition['id'], string>;
  }, [activeUnitId, draftValue, weiValue]);

  function handleValueChange(unit: UnitDefinition, nextValue: string) {
    setActiveUnitId(unit.id);
    setDraftValue(nextValue);

    const normalizedValue = nextValue.trim();

    if (!normalizedValue) {
      setWeiValue(null);
      setError(null);
      return;
    }

    try {
      setWeiValue(parseUnitValueToWei(nextValue, unit));
      setError(null);
    } catch (nextError) {
      setWeiValue(null);
      setError(nextError instanceof Error ? nextError.message : 'Failed to convert value.');
    }
  }

  async function handleCopy(unitId: UnitDefinition['id'], value: string) {
    if (!value.trim()) {
      return;
    }

    await copyText(value);
    setCopiedUnitId(unitId);
    window.setTimeout(() => {
      setCopiedUnitId((current) => (current === unitId ? null : current));
    }, 1200);
  }

  return (
    <AppShell mode="evm">
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-2xl font-semibold text-slate-950">Unit Converter</h1>
            <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">
              Convert between ETH denominations such as Wei, Gwei, Szabo, and Finney directly in the browser.
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-3">
              {UNIT_DEFINITIONS.map((unit) => {
                const currentValue = unitValues[unit.id] ?? '';
                const copied = copiedUnitId === unit.id;

                return (
                  <div key={unit.id} className="flex h-[45px] items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50">
                        <ActionIconButton
                          tooltip={copied ? 'Copied' : 'Copy value'}
                          aria-label={copied ? `${unit.label} copied` : `Copy ${unit.label} value`}
                          className={currentValue ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300 hover:text-slate-300'}
                          disabled={!currentValue}
                          onClick={() => void handleCopy(unit.id, currentValue)}
                        >
                          <IconCopy className="size-5" stroke={1.8} />
                        </ActionIconButton>
                      </div>
                    <input
                      value={currentValue}
                      inputMode="decimal"
                      className="min-w-0 flex-1 border-0 bg-white px-5 text-[18px] text-slate-900 outline-none"
                      onChange={(event) => handleValueChange(unit, event.target.value)}
                    />
                    <div className="flex min-w-[220px] shrink-0 items-center border-l border-slate-200 bg-slate-50 px-5 text-[18px] font-medium text-slate-800">
                      {unit.label} ({unit.exponentLabel})
                    </div>
                  </div>
                );
              })}
            </div>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
