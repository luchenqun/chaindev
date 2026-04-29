'use client';

import { IconChevronDown, IconLogout, IconUserCircle } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { type PlatformMode } from '@/config/chains';
import { getMessages } from '@/i18n';
import { resolveAbsoluteCallbackUrl, resolveClientRedirectUrl } from '@/platform/auth/callback-url';
import { getAccountMenuSections } from '@/platform/layout/account-menu-config';
import { ChainStatusStrip } from '@/platform/layout/chain-status-strip';
import { ActiveEvmKeySelector } from '@/platform/layout/active-evm-key-selector';
import { GlobalSearch } from '@/platform/search/global-search';
import { RpcProviderManager } from '@/platform/workbench/rpc-provider-manager';

type NavItem = {
  href: string;
  label: string;
};

function inferMode(pathname: string): PlatformMode {
  return pathname.startsWith('/cosmos') ? 'cosmos' : 'evm';
}

function matchesNavItem(pathname: string, href: string) {
  if (pathname === href || pathname.startsWith(href + '/')) {
    return true;
  }

  if (href.startsWith('/evm/tx/')) {
    return pathname.startsWith('/evm/tx/');
  }

  if (href.startsWith('/evm/address/')) {
    return pathname.startsWith('/evm/address/');
  }

  if (href.startsWith('/evm/blocks')) {
    return pathname.startsWith('/evm/blocks') || pathname.startsWith('/evm/block/');
  }

  if (href.startsWith('/evm/accounts')) {
    return pathname.startsWith('/evm/accounts') || pathname.startsWith('/evm/address/');
  }

  if (href.startsWith('/evm/txs')) {
    return pathname.startsWith('/evm/txs') || pathname.startsWith('/evm/tx/');
  }

  if (href.startsWith('/cosmos/tx/')) {
    return pathname.startsWith('/cosmos/tx/');
  }

  if (href.startsWith('/cosmos/blocks')) {
    return pathname.startsWith('/cosmos/blocks') || pathname.startsWith('/cosmos/block/');
  }

  if (href.startsWith('/cosmos/txs')) {
    return pathname.startsWith('/cosmos/txs') || pathname.startsWith('/cosmos/tx/');
  }

  if (href.startsWith('/cosmos/accounts')) {
    return pathname.startsWith('/cosmos/accounts') || pathname.startsWith('/cosmos/account/');
  }

  if (href.startsWith('/cosmos/proposals')) {
    return pathname.startsWith('/cosmos/proposals') || pathname.startsWith('/cosmos/proposal/');
  }

  if (href.startsWith('/cosmos/validators')) {
    return pathname.startsWith('/cosmos/validators') || pathname.startsWith('/cosmos/validator/');
  }

  if (href.startsWith('/cosmos/account/')) {
    return pathname.startsWith('/cosmos/account/');
  }

  return false;
}

export function TopNav({ mode: modeOverride }: { mode?: PlatformMode }) {
  const messages = getMessages();
  const pathname = usePathname();
  const router = useRouter();
  const mode = modeOverride ?? inferMode(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const username = (session?.user as { username?: string } | undefined)?.username ?? session?.user?.name ?? session?.user?.email ?? 'Account';
  const primaryNavItems: NavItem[] =
    mode === 'cosmos'
      ? [
          { href: '/cosmos/blocks', label: 'Blocks' },
          { href: '/cosmos/txs', label: 'Transactions' },
          { href: '/cosmos/accounts', label: 'Accounts' },
          { href: '/cosmos/validators', label: 'Validators' },
          { href: '/cosmos/proposals', label: 'Proposals' },
        ]
      : [
          { href: '/evm/blocks', label: 'Blocks' },
          { href: '/evm/txs', label: 'Transactions' },
          { href: '/evm/accounts', label: 'Accounts' },
          { href: '/evm/contracts', label: messages.navigation.contracts },
        ];
  const userMenuSections = getAccountMenuSections(mode);
  const userMenuActive = userMenuSections.some((section) => section.items.some((item) => matchesNavItem(pathname, item.href)));

  return (
    <header className="mb-4 border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-[1400px] gap-3 px-3 py-2 text-xs text-slate-500 lg:grid-cols-[auto_minmax(320px,1fr)_auto] lg:items-center">
        <ChainStatusStrip mode={mode} />
        <div className="flex justify-end">
          <GlobalSearch mode={mode} variant="topbar" showLabel={false} placeholder="Search by Address / Txn Hash / Block" />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="flex h-[34px] min-w-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <RpcProviderManager mode={mode} variant="topbar-context" />
            <div className="h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <ActiveEvmKeySelector variant="topbar-context" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto grid max-w-[1400px] gap-5 px-3 py-0.5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <Link prefetch={false} href="/" className="flex items-center gap-3">
              <Image alt="Chaindev" className="h-[52px] w-auto" height={52} src="/brand-lockup.svg" width={223} />
            </Link>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-8 text-[15px] font-[450] text-slate-950">
            <Link prefetch={false} className={pathname === '/' ? 'py-2.5 font-[450] text-[#1697ea]' : 'py-2.5 font-[450] text-slate-950 hover:text-[#1697ea]'} href="/">
              {messages.navigation.home}
            </Link>
            {primaryNavItems.map((item) => {
              const itemActive = matchesNavItem(pathname, item.href);

              return (
                <Link prefetch={false} key={item.href} href={item.href} className={itemActive ? 'py-2.5 font-[450] text-[#1697ea]' : 'py-2.5 font-[450] text-slate-950 hover:text-[#1697ea]'}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative flex flex-wrap items-center justify-end gap-3 pl-[8px] before:absolute before:left-[-8px] before:top-1/2 before:h-[14px] before:w-[1.5px] before:-translate-y-1/2 before:bg-slate-300">
            {status === 'authenticated' ? (
              <div className="relative" onMouseEnter={() => setOpenGroup('user-menu')} onMouseLeave={() => setOpenGroup((current) => (current === 'user-menu' ? null : current))}>
                <button
                  type="button"
                  className={
                    userMenuActive || openGroup === 'user-menu'
                      ? 'inline-flex items-center gap-2 py-2.5 text-[15px] font-[450] text-[#1697ea]'
                      : 'inline-flex items-center gap-2 py-2.5 text-[15px] font-[450] text-slate-700 hover:text-[#1697ea]'
                  }
                  aria-expanded={openGroup === 'user-menu'}
                >
                  <IconUserCircle className="size-4" stroke={2} />
                  <span>{username}</span>
                  <IconChevronDown className="size-3.5" stroke={2.2} />
                </button>
                {openGroup === 'user-menu' ? (
                  <div className="absolute right-0 top-full z-20 min-w-[248px] overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                    <div className="border-t-[3px] border-[#19a7f2]" />
                    <div className="px-3 pt-2 pb-0">
                      {userMenuSections.map((section, sectionIndex) => (
                        <div key={section.id} className={sectionIndex === 0 ? '' : 'border-t border-slate-200'}>
                          {section.items.map((item) => {
                            const itemActive = matchesNavItem(pathname, item.href);

                            return (
                              <Link prefetch={false}
                                key={item.href}
                                href={item.href}
                                className={
                                  itemActive
                                    ? 'block rounded-lg px-3 py-2.5 text-[15px] font-[450] text-[#1697ea]'
                                    : 'block rounded-lg px-3 py-2.5 text-[15px] font-[450] text-slate-950 hover:bg-slate-100 hover:text-black'
                                }
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3">
                      <div className="border-t border-slate-200 pt-3">
                        <Button
                          variant="outline"
                          className="h-11 w-full gap-2 rounded-xl border-sky-300 text-[15px] font-semibold text-[#1697ea] hover:border-sky-400 hover:bg-sky-50 hover:text-[#1697ea]"
                          onClick={() =>
                            void (async () => {
                              const callbackUrl = resolveAbsoluteCallbackUrl('/');
                              const result = await signOut({
                                redirect: false,
                                callbackUrl,
                              });
                              router.push(resolveClientRedirectUrl(result.url, callbackUrl));
                              router.refresh();
                            })()
                          }
                        >
                          <IconLogout className="size-4" stroke={2} />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link prefetch={false} href="/login">
                <Button variant="ghost" className="h-8 gap-2 px-0 text-[15px] font-normal text-slate-700">
                  <IconUserCircle className="size-4" stroke={2} />
                  {messages.navigation.signIn}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
