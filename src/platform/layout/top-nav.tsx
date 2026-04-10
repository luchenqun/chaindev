"use client";

import {
  IconChevronDown,
  IconMoonStars,
  IconSettings,
  IconUserCircle,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type PlatformMode } from "@/config/chains";
import { getMessages } from "@/i18n";
import { ChainStatusStrip } from "@/platform/layout/chain-status-strip";
import { GlobalSearch } from "@/platform/search/global-search";
import { RpcProviderManager } from "@/platform/workbench/rpc-provider-manager";

type NavItem = {
  href: string;
  label: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

function inferMode(pathname: string): PlatformMode {
  return pathname.startsWith("/cosmos") ? "cosmos" : "evm";
}

export function TopNav() {
  const messages = getMessages();
  const pathname = usePathname();
  const mode = inferMode(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const activeNavGroups: NavGroup[] = [
    {
      id: "browser",
      label: messages.navigation.blockchain,
      items: [
        { href: "/evm/overview", label: "EVM Overview" },
        { href: "/evm/blocks", label: "EVM Blocks" },
        { href: "/evm/txs", label: "EVM Transactions" },
        {
          href: "/evm/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          label: "EVM Transaction",
        },
        { href: "/evm/address/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", label: "EVM Address" },
        { href: "/cosmos/overview", label: "Cosmos Overview" },
        { href: "/cosmos/blocks", label: "Cosmos Blocks" },
        {
          href: "/cosmos/tx/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          label: "Cosmos Transaction",
        },
        {
          href: "/cosmos/account/cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgph8n7u4",
          label: "Cosmos Account",
        },
        { href: "/cosmos/validators", label: "Cosmos Validators" },
        { href: "/cosmos/proposals", label: "Cosmos Proposals" },
      ],
    },
    {
      id: "tools",
      label: messages.navigation.developerTools,
      items: [
        { href: "/evm/tools/rpc", label: "EVM RPC Debug" },
        { href: "/evm/tools/send-tx", label: "EVM Send Tx" },
        { href: "/evm/tools/decode", label: "EVM Decode" },
        { href: "/cosmos/tools/rpc", label: "Cosmos RPC / REST" },
        { href: "/cosmos/tools/send-tx", label: "Cosmos Send Tx" },
        { href: "/cosmos/tools/encode-decode", label: "Cosmos Encode / Decode" },
      ],
    },
  ];

  return (
    <header className="mb-4 border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-3 px-5 py-2 text-xs text-slate-500 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <ChainStatusStrip mode={mode} />
        <div className="flex justify-end">
          <GlobalSearch
            mode={mode}
            variant="topbar"
            showLabel={false}
            placeholder="Search by Address / Txn Hash / Block / Token / Domain Name"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-10 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <IconSettings className="size-4" stroke={2} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-10 rounded-xl border border-slate-200 bg-white text-sky-600 hover:bg-slate-100"
          >
            <IconMoonStars className="size-4" stroke={2} />
          </Button>
          <RpcProviderManager mode={mode} />
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-1.5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <Image alt="Chaindev" className="h-[52px] w-auto" height={52} src="/brand-lockup.svg" width={223} />
            </Link>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-8 text-[15px] font-normal text-slate-800">
            <Link
              className={pathname === "/" ? "py-4 text-sky-600" : "py-4 text-slate-800 hover:text-sky-600"}
              href="/"
            >
              {messages.navigation.home}
            </Link>
            {activeNavGroups.map((group) => {
              const active = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => setOpenGroup(group.id)}
                  onMouseLeave={() => setOpenGroup((current) => (current === group.id ? null : current))}
                >
                  <button
                    type="button"
                    className={
                      active || openGroup === group.id
                        ? "inline-flex items-center gap-1 py-4 text-sky-600"
                        : "inline-flex items-center gap-1 py-4 text-slate-800 hover:text-sky-600"
                    }
                  >
                    {group.label}
                    <IconChevronDown className="size-3.5" stroke={2.2} />
                  </button>
                  {openGroup === group.id ? (
                    <div className="absolute left-0 top-full z-20 min-w-[220px] overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                      <div className="border-t-[3px] border-sky-500" />
                      <div className="py-2">
                        {group.items.map((item) => {
                          const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={
                                itemActive
                                  ? "block px-7 py-3 text-[15px] font-normal text-sky-600"
                                  : "block px-7 py-3 text-[15px] font-normal text-slate-800 hover:bg-slate-50 hover:text-sky-600"
                              }
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
            <Link href="/login">
              <Button variant="ghost" className="h-8 gap-2 px-2 text-[15px] font-normal text-slate-700">
                <IconUserCircle className="size-4" stroke={2} />
                {messages.navigation.signIn}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
