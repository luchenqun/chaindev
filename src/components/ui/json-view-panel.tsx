'use client';

import JsonView from '@uiw/react-json-view';
import { IconArrowsMaximize, IconArrowsMinimize, IconCopy } from '@tabler/icons-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { copyText } from '@/components/ui/copy-text';
import { cn } from '@/lib/utils';

export const JSON_VIEW_PANEL_STYLE = {
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

function stringifyJson(value: object) {
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

type JsonViewPanelProps = {
  value: object;
  className?: string;
  jsonClassName?: string;
  controlsClassName?: string;
  trailingControls?: ReactNode;
  style?: CSSProperties;
  initialFullyExpanded?: boolean;
};

export function JsonViewPanel({
  value,
  className,
  jsonClassName,
  controlsClassName,
  trailingControls,
  style = JSON_VIEW_PANEL_STYLE,
  initialFullyExpanded = true,
}: JsonViewPanelProps) {
  const [fullyExpanded, setFullyExpanded] = useState(initialFullyExpanded);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await copyText(stringifyJson(value));
    setCopied(true);

    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 1600);
  }

  return (
    <div className={cn('relative rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]', className)}>
      <span className={cn('absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-2', controlsClassName)}>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center text-slate-400 transition hover:text-sky-600"
          aria-label={fullyExpanded ? 'Collapse JSON to first level' : 'Expand all JSON'}
          onClick={() => setFullyExpanded((current) => !current)}
        >
          {fullyExpanded ? <IconArrowsMinimize className="size-4" stroke={1.8} /> : <IconArrowsMaximize className="size-4" stroke={1.8} />}
        </button>
        <span className="relative inline-flex">
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center text-slate-400 transition hover:text-sky-600"
            aria-label="Copy JSON"
            onClick={() => void handleCopy()}
          >
            <IconCopy className="size-4" stroke={1.8} />
          </button>
          <span
            className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-opacity ${
              copied ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="block whitespace-nowrap">Copied!</span>
          </span>
        </span>
        {trailingControls}
      </span>
      <JsonView
        key={fullyExpanded ? 'expanded-json' : 'first-level-json'}
        className={cn('json-view-wrap', jsonClassName)}
        value={value}
        collapsed={fullyExpanded ? false : 1}
        shortenTextAfterLength={0}
        enableClipboard={false}
        displayDataTypes={false}
        displayObjectSize={false}
        style={style}
      />
      <style jsx global>{`
        .json-view-wrap .w-rjv-value {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
