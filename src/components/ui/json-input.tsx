'use client';

import { IconBraces, IconCode } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { useMessages } from '@/i18n/locale-provider';
import { cn } from '@/lib/utils';

type JsonInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textareaClassName: string;
};

export function JsonInput({ value, onChange, placeholder, textareaClassName }: JsonInputProps) {
  const messages = useMessages();
  const [mode, setMode] = useState<'json' | 'raw'>('raw');
  const parsedValue = useMemo(() => {
    try {
      const nextValue = JSON.parse(value) as unknown;
      return nextValue && typeof nextValue === 'object' ? nextValue : null;
    } catch {
      return null;
    }
  }, [value]);

  const canRenderJson = parsedValue !== null;
  const activeMode = canRenderJson ? mode : 'raw';
  const viewModeControls = (
    <>
      <button
        type="button"
        aria-label={messages.common.jsonView}
        className={cn(
          'inline-flex size-5 items-center justify-center text-slate-400 transition hover:text-sky-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:text-slate-300',
          activeMode === 'json' && 'text-sky-600',
        )}
        onClick={() => {
          if (canRenderJson) {
            setMode('json');
          }
        }}
        disabled={!canRenderJson}
      >
        <IconBraces className="size-4" stroke={1.8} />
      </button>
      <button
        type="button"
        aria-label={messages.common.rawView}
        className={cn('inline-flex size-5 items-center justify-center text-slate-400 transition hover:text-sky-600', activeMode === 'raw' && 'text-sky-600')}
        onClick={() => setMode('raw')}
      >
        <IconCode className="size-4" stroke={1.8} />
      </button>
    </>
  );

  return (
    <div className="relative">
      {activeMode === 'json' && parsedValue ? (
        <JsonViewPanel className="rounded-lg pr-28 shadow-none" value={parsedValue} trailingControls={viewModeControls} />
      ) : (
        <>
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-2">{viewModeControls}</div>
          <AutoGrowTextarea className={`${textareaClassName} pr-16`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        </>
      )}
    </div>
  );
}
