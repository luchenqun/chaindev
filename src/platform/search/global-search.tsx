"use client";

import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";
import { getMessages } from "@/i18n";
import type { PlatformMode } from "@/config/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GlobalSearchProps = {
  mode: PlatformMode;
  placeholder?: string;
  variant?: "hero" | "compact" | "topbar";
  showLabel?: boolean;
};

export function GlobalSearch({
  mode,
  placeholder = "Search by block, tx, or address",
  variant = "hero",
  showLabel = true,
}: GlobalSearchProps) {
  const messages = getMessages();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const inputId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      setMessage(messages.search.empty);
      return;
    }

    setPending(true);
    setMessage("");

    try {
      const params = new URLSearchParams({ q: query, mode });
      const response = await fetch(`/api/search/resolve?${params.toString()}`);
      const payload = (await response.json()) as { ok: boolean; target?: string; message?: string };

      if (!payload.ok || !payload.target) {
        setMessage(payload.message ?? messages.search.unsupported);
        return;
      }

      router.push(payload.target);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : messages.search.failed);
    } finally {
      setPending(false);
    }
  }

  if (variant === "topbar") {
    return (
      <form className="flex w-full min-w-0 max-w-[400px] flex-col gap-1" onSubmit={handleSubmit}>
        {showLabel ? (
          <label className="text-xs font-semibold text-slate-500" htmlFor={inputId}>
            Global Search
          </label>
        ) : null}
        <div className="flex h-[34px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 shadow-sm transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400">
          <IconSearch className="mr-2 size-3.5 shrink-0 text-slate-400" stroke={2} />
          <Input
            id={inputId}
            className="h-full border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <button
            className="ml-2 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] border border-slate-200 bg-slate-200 px-1.5 text-[10px] font-semibold text-white transition hover:bg-slate-300"
            type="submit"
            aria-label="Search"
          >
            /
          </button>
        </div>
        {message ? <p className="text-xs text-red-500">{message}</p> : null}
      </form>
    );
  }

  if (variant === "compact") {
    return (
      <form className="flex w-full max-w-[470px] flex-col gap-1" onSubmit={handleSubmit}>
        {showLabel ? (
          <label className="text-xs font-semibold text-slate-500" htmlFor={inputId}>
            Global Search
          </label>
        ) : null}
        <div className="flex items-center">
          <Input
            id={inputId}
            className="h-11 rounded-r-none border-r-0 bg-slate-50"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
          />
          <Button className="h-11 rounded-l-none px-3" size="icon" type="submit" aria-label="Search">
            {pending ? "..." : <IconSearch className="size-4" stroke={2} />}
          </Button>
        </div>
        {message ? <p className="text-xs text-red-500">{message}</p> : null}
      </form>
    );
  }

  return (
    <form className="flex w-full max-w-3xl flex-col gap-2" onSubmit={handleSubmit}>
      {showLabel ? (
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70" htmlFor={inputId}>
          Search / Address / Txn Hash / Block
        </label>
      ) : null}
      <div className="grid gap-2 md:grid-cols-[180px_1fr_64px]">
        <button
          className="inline-flex h-14 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          type="button"
        >
          <span>All Filters</span>
          <IconChevronDown className="size-4 text-slate-400" stroke={2} />
        </button>
        <Input
          id={inputId}
          className={cn("h-14 rounded-xl border-slate-200 bg-white text-base", "placeholder:text-slate-400")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
        <Button className="h-14 rounded-xl" type="submit" aria-label="Search">
          {pending ? "..." : <IconSearch className="size-5" stroke={2} />}
        </Button>
      </div>
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
    </form>
  );
}
