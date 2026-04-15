'use client';

import type { PlatformMode } from '@/config/chains';

type ChainSwitcherProps = {
  mode: PlatformMode;
  onModeChange: (mode: PlatformMode) => void;
};

export function ChainSwitcher({ mode, onModeChange }: ChainSwitcherProps) {
  return (
    <div
      className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1"
      aria-label="Mode Switch"
    >
      <button
        type="button"
        className={
          mode === 'evm'
            ? 'min-w-[64px] rounded-full bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white'
            : 'min-w-[64px] rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500'
        }
        onClick={() => onModeChange('evm')}
      >
        EVM
      </button>
      <button
        type="button"
        className={
          mode === 'cosmos'
            ? 'min-w-[64px] rounded-full bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white'
            : 'min-w-[64px] rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500'
        }
        onClick={() => onModeChange('cosmos')}
      >
        Cosmos
      </button>
    </div>
  );
}
