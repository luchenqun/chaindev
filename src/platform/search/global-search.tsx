'use client';

import { IconChevronDown, IconCornerDownLeft, IconSearch, IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useId, useState } from 'react';
import type { PlatformMode } from '@/config/chains';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { getEvmBlockNumberByHashDirect, hasEvmTransactionByHashDirect } from '@/domains/evm/client/queries';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { cn } from '@/lib/utils';
import { parseQuery } from '@/platform/search/parse-query';
import { resolveQueryTarget, resolveQueryTargetFromParsedMatch } from '@/platform/search/resolve-query';

type GlobalSearchProps = {
  mode: PlatformMode;
  placeholder?: string;
  variant?: 'hero' | 'compact' | 'topbar';
  showLabel?: boolean;
};

export function GlobalSearch({ mode, placeholder, variant = 'hero', showLabel = true }: GlobalSearchProps) {
  const messages = useMessages();
  const { locale } = useLocale();
  const router = useRouter();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);
  const inputId = useId();
  const resolvedPlaceholder = placeholder ?? (variant === 'topbar' ? messages.search.topbarPlaceholder : messages.search.compactPlaceholder);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      showToast({
        title: messages.search.empty,
        tone: 'info',
      });
      return;
    }

    setPending(true);

    try {
      const parsed = parseQuery(query);
      let payload = resolveQueryTarget(query, mode);

      if (mode === 'evm' && parsed.type === 'evm-hash') {
        const transactionFound = await hasEvmTransactionByHashDirect(parsed.value);

        if (transactionFound) {
          payload = resolveQueryTargetFromParsedMatch(parsed, mode);
        } else {
          const blockNumber = await getEvmBlockNumberByHashDirect(parsed.value);
          payload = blockNumber != null ? resolveQueryTargetFromParsedMatch(parsed, mode, { evmBlockNumberByHash: blockNumber }) : { ok: false, message: messages.search.notFound };
        }
      }

      if (!payload.ok) {
        showToast({
          title: payload.message ?? messages.search.unsupported,
          tone: 'error',
        });
        return;
      }

      router.push(payload.target);
    } catch (error) {
      showToast({
        title: error instanceof Error ? translateRuntimeText(error.message, locale) : messages.search.failed,
        tone: 'error',
      });
    } finally {
      setPending(false);
    }
  }

  if (variant === 'topbar') {
    const hasValue = query.trim().length > 0;

    return (
      <form className="flex w-full min-w-0 max-w-[440px] flex-col gap-1" onSubmit={handleSubmit}>
        {showLabel ? (
          <label className="text-xs font-semibold text-slate-500" htmlFor={inputId}>
            {messages.search.label}
          </label>
        ) : null}
        <div className="flex h-[38px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 shadow-sm transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400">
          <IconSearch className="mr-2 size-4 shrink-0 text-slate-400" stroke={2} />
            <Input
              id={inputId}
              className="h-full border-0 bg-transparent px-0 text-[14px] shadow-none focus-visible:ring-0"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={resolvedPlaceholder}
            />
          {hasValue ? (
            <div className="ml-2 flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center text-slate-400 transition hover:text-slate-600"
                aria-label={messages.search.clear}
                onClick={() => {
                  setQuery('');
                }}
              >
                <IconX className="size-4" stroke={2} />
              </button>
              <button
                className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-[5px] border border-slate-200 bg-slate-200 px-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-300"
                type="submit"
                aria-label={messages.search.submit}
              >
                <IconCornerDownLeft className="size-3.5" stroke={2.2} />
              </button>
            </div>
          ) : null}
        </div>
      </form>
    );
  }

  if (variant === 'compact') {
    return (
      <form className="flex w-full max-w-[470px] flex-col gap-1" onSubmit={handleSubmit}>
        {showLabel ? (
          <label className="text-xs font-semibold text-slate-500" htmlFor={inputId}>
            {messages.search.label}
          </label>
        ) : null}
        <div className="flex items-center">
          <Input id={inputId} className="h-11 rounded-r-none border-r-0 bg-slate-50" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={resolvedPlaceholder} />
          <Button className="h-11 rounded-l-none px-3" size="icon" type="submit" aria-label={messages.search.submit}>
            {pending ? '...' : <IconSearch className="size-4" stroke={2} />}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="flex w-full max-w-3xl flex-col gap-2" onSubmit={handleSubmit}>
      {showLabel ? (
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70" htmlFor={inputId}>
          {messages.search.heroLabel}
        </label>
      ) : null}
      <div className="grid gap-2 md:grid-cols-[180px_1fr_64px]">
        <button className="inline-flex h-14 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" type="button">
          <span>{messages.search.allFilters}</span>
          <IconChevronDown className="size-4 text-slate-400" stroke={2} />
        </button>
        <Input
          id={inputId}
          className={cn('h-14 rounded-xl border-slate-200 bg-white text-base', 'placeholder:text-slate-400')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={resolvedPlaceholder}
        />
        <Button className="h-14 rounded-xl" type="submit" aria-label={messages.search.submit}>
          {pending ? '...' : <IconSearch className="size-5" stroke={2} />}
        </Button>
      </div>
    </form>
  );
}
