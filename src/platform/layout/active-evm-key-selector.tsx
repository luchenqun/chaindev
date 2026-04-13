"use client";

import { IconKey, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getEvmKeyringSource,
  getActiveEvmStoredPrivateKey,
  listEvmStoredPrivateKeys,
  setActiveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  syncEvmKeyringFromServer,
  type EvmStoredPrivateKey,
} from "@/domains/evm/client/keyring";

type ActiveEvmKeySelectorProps = {
  variant?: "default" | "topbar-context";
};

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function ActiveEvmKeySelector({ variant = "default" }: ActiveEvmKeySelectorProps) {
  const { status } = useSession();
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);
  const [source, setSource] = useState<"guest" | "server">("guest");

  useEffect(() => {
    function load() {
      setItems(listEvmStoredPrivateKeys());
      setActiveItem(getActiveEvmStoredPrivateKey());
      setSource(getEvmKeyringSource());
    }

    load();
    void syncEvmKeyringFromServer().catch(() => undefined);

    return subscribeEvmKeyring(load);
  }, []);

  const manageHref = status === "authenticated" ? "/evm/settings/private-keys" : "/login?callbackUrl=%2Fevm%2Fsettings%2Fprivate-keys";

  if (!items.length) {
    if (variant === "topbar-context") {
      return (
        <div className="min-w-0 shrink-0">
          <Select disabled>
            <SelectTrigger className="h-full w-auto justify-start gap-1 rounded-none border-0 bg-transparent px-2.5 pr-1 text-[12.5px] font-normal leading-none text-slate-500 shadow-none focus:ring-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <IconKey className="size-3.5 shrink-0 text-slate-500" stroke={2} />
                <SelectValue placeholder="No Key" />
              </div>
            </SelectTrigger>
          </Select>
        </div>
      );
    }

    return (
      <Link href="/evm/settings/private-keys">
        <Button variant="ghost" className="h-8 gap-1.5 px-2 text-[13px] font-normal text-slate-700">
          <IconKey className="size-4" stroke={2} />
          No Key
        </Button>
      </Link>
    );
  }

  if (variant === "topbar-context") {
    return (
      <div className="min-w-0 shrink-0">
        <Select
          value={activeItem?.id}
          disabled={items.length <= 1}
          onValueChange={(value) => {
            setActiveEvmStoredPrivateKey(value);
          }}
        >
          <SelectTrigger className="h-full w-auto justify-start gap-1 rounded-none border-0 bg-transparent px-2.5 pr-1 text-[12.5px] font-normal leading-none shadow-none focus:ring-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <IconKey className="size-3.5 shrink-0 text-slate-500" stroke={2} />
              <SelectValue placeholder="Select Key">{activeItem?.name ?? "Select Key"}</SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {`${item.name} · ${formatAddressLabel(item.address)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Select
        value={activeItem?.id}
        disabled={items.length <= 1}
        onValueChange={(value) => {
          setActiveEvmStoredPrivateKey(value);
        }}
      >
        <SelectTrigger className="h-8 w-auto justify-start gap-1 rounded-lg border-transparent bg-transparent px-2 pr-1.5 text-[13px] font-normal shadow-none hover:bg-slate-100 focus:ring-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <IconKey className="size-4 shrink-0 text-slate-500" stroke={2} />
            <SelectValue placeholder="Select Key">{activeItem?.name ?? "Select Key"}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {`${item.name} · ${formatAddressLabel(item.address)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link
        href={manageHref}
        className="inline-flex h-6 items-center justify-center px-0.5 text-slate-500 transition hover:text-slate-900"
        aria-label={source === "server" ? "Manage private keys" : "Sign in to manage private keys"}
      >
        <IconPlus className="size-3.5" stroke={2} />
      </Link>
    </div>
  );
}
