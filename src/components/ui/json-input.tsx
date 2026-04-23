'use client';

import { IconBraces, IconCode } from '@tabler/icons-react';
import JsonView from '@uiw/react-json-view';
import { type CSSProperties, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';

const jsonViewStyle = {
  '--w-rjv-background-color': 'transparent',
  '--w-rjv-border-left': '1px dashed rgba(148, 163, 184, 0.28)',
  '--w-rjv-font-family': '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  '--w-rjv-color': '#0f172a',
  '--w-rjv-arrow-color': '#64748b',
  '--w-rjv-line-color': 'rgba(148, 163, 184, 0.24)',
  '--w-rjv-curlybraces-color': '#475569',
  '--w-rjv-brackets-color': '#475569',
  '--w-rjv-colon-color': '#94a3b8',
  '--w-rjv-key-string': '#0369a1',
  '--w-rjv-key-number': '#0369a1',
  '--w-rjv-type-string-color': '#b45309',
  '--w-rjv-type-int-color': '#7c3aed',
  '--w-rjv-type-float-color': '#7c3aed',
  '--w-rjv-type-bigint-color': '#7c3aed',
  '--w-rjv-type-boolean-color': '#15803d',
  '--w-rjv-type-null-color': '#b91c1c',
  '--w-rjv-type-undefined-color': '#b91c1c',
} as CSSProperties;

type JsonInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textareaClassName: string;
};

export function JsonInput({ value, onChange, placeholder, textareaClassName }: JsonInputProps) {
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

  return (
    <div className="relative">
      <div className="absolute right-[6px] top-[6px] z-10 flex items-center gap-0.5">
        <ActionIconButton
          tooltip="JSON view"
          aria-label="JSON view"
          className={
            activeMode === 'json' ? 'rounded-md text-sky-700' : canRenderJson ? 'rounded-md text-slate-400 hover:text-slate-700' : 'cursor-not-allowed rounded-md text-slate-300'
          }
          onClick={() => {
            if (canRenderJson) {
              setMode('json');
            }
          }}
          disabled={!canRenderJson}
        >
          <IconBraces className="size-4" stroke={1.9} />
        </ActionIconButton>
        <ActionIconButton
          tooltip="Raw view"
          aria-label="Raw view"
          className={activeMode === 'raw' ? 'rounded-md text-sky-700' : 'rounded-md text-slate-400 hover:text-slate-700'}
          onClick={() => setMode('raw')}
        >
          <IconCode className="size-4" stroke={1.9} />
        </ActionIconButton>
      </div>
      {activeMode === 'json' && parsedValue ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 pr-16">
          <JsonView
            className="json-view-wrap"
            value={parsedValue}
            collapsed={false}
            shortenTextAfterLength={0}
            enableClipboard={false}
            displayDataTypes={false}
            displayObjectSize={false}
            style={jsonViewStyle}
          />
        </div>
      ) : (
        <AutoGrowTextarea className={`${textareaClassName} pr-16`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
