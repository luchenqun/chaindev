"use client";

import { IconKey, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getActiveEvmStoredPrivateKey,
  listEvmStoredPrivateKeys,
  setActiveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from "@/domains/evm/client/keyring";

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

export function ActiveEvmKeySelector() {
  const [items, setItems] = useState<EvmStoredPrivateKey[]>([]);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(null);

  useEffect(() => {
    function load() {
      setItems(listEvmStoredPrivateKeys());
      setActiveItem(getActiveEvmStoredPrivateKey());
    }

    load();

    return subscribeEvmKeyring(load);
  }, []);

  if (!items.length) {
    return (
      <Link href="/evm/settings/private-keys">
        <Button variant="ghost" className="h-8 gap-1.5 px-2 text-[13px] font-normal text-slate-700">
          <IconKey className="size-4" stroke={2} />
          No Key
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Select
        value={activeItem?.id}
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
        href="/evm/settings/private-keys"
        className="inline-flex h-6 items-center justify-center px-0.5 text-slate-500 transition hover:text-slate-900"
        aria-label="Manage private keys"
      >
        <IconPlus className="size-3.5" stroke={2} />
      </Link>
    </div>
  );
}
