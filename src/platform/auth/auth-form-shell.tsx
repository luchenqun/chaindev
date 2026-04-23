'use client';

import type { ReactNode } from 'react';

export function AuthFormShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[720px] rounded-[28px] border border-slate-200 bg-white px-10 py-12 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <div className="mb-9 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="mt-3 text-lg text-slate-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
