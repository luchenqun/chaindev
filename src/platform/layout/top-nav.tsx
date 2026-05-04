'use client';

import { IconArrowsExchange, IconCalculator, IconChevronDown, IconChartHistogram, IconClockSearch, IconCloudCode, IconFunction, IconHash, IconKey, IconLanguage, IconLogout, IconSearch, IconSend, IconUserCircle, IconWallet, IconBinaryTree2, IconWaveSine } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type PlatformMode } from '@/config/chains';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { resolveAbsoluteCallbackUrl, resolveClientRedirectUrl } from '@/platform/auth/callback-url';
import { getAccountMenuSections } from '@/platform/layout/account-menu-config';
import { ActiveEvmKeySelector } from '@/platform/layout/active-evm-key-selector';
import { ChainStatusStrip } from '@/platform/layout/chain-status-strip';
import { GlobalSearch } from '@/platform/search/global-search';
import { useActivePlatformMode } from '@/platform/workbench/active-platform-mode-provider';
import { RpcProviderManager } from '@/platform/workbench/rpc-provider-manager';

type NavItem = {
  href: string;
  label: string;
  icon?: typeof IconSend;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_CLOSE_DELAY_MS = 300;

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

  if (href.startsWith('/cosmos/params')) {
    return pathname.startsWith('/cosmos/params');
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
  const messages = useMessages();
  const labelMessages = messages.labels;
  const { locale, toggleLocale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { activeMode } = useActivePlatformMode();
  const mode = modeOverride ?? (pathname.startsWith('/tools/') ? activeMode : inferMode(pathname));
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [keyReady, setKeyReady] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const { data: session, status } = useSession();
  const username = (session?.user as { username?: string } | undefined)?.username ?? session?.user?.name ?? session?.user?.email ?? messages.topNav.account;
  const showStatusSkeleton = pathname === '/' && (modeOverride == null || !providerReady || !keyReady);

  const primaryNavItems: NavItem[] =
    mode === 'cosmos'
      ? [
          { href: '/cosmos/blocks', label: labelMessages.blocks },
          { href: '/cosmos/txs', label: labelMessages.transactions },
          { href: '/cosmos/accounts', label: labelMessages.accounts },
          { href: '/cosmos/validators', label: labelMessages.validators },
          { href: '/cosmos/proposals', label: labelMessages.proposals },
          { href: '/cosmos/params', label: labelMessages.params },
        ]
      : [
          { href: '/evm/blocks', label: labelMessages.blocks },
          { href: '/evm/txs', label: labelMessages.transactions },
          { href: '/evm/accounts', label: labelMessages.accounts },
          { href: '/evm/contracts', label: messages.navigation.contracts },
        ];

  const userMenuSections = getAccountMenuSections(mode, messages);
  const userMenuActive = userMenuSections.some((section) => section.items.some((item) => matchesNavItem(pathname, item.href)));

  const moreGroups: NavGroup[] =
    mode === 'cosmos'
      ? [
          {
            id: 'chain',
            label: messages.topNav.chain,
            items: [
              { href: '/cosmos/tools/send-tx', label: labelMessages.sendTransaction, icon: IconSend },
              { href: '/cosmos/tools/rest', label: labelMessages.restApi, icon: IconCloudCode },
            ],
          },
          {
            id: 'tools',
            label: messages.topNav.tools,
            items: [
              { href: '/tools/hash', label: labelMessages.hashEncoding, icon: IconHash },
              { href: '/tools/big-number', label: labelMessages.bigNumber, icon: IconFunction },
              { href: '/tools/unit-converter', label: labelMessages.unitConverter, icon: IconCalculator },
              { href: '/tools/bech32', label: labelMessages.bech32, icon: IconArrowsExchange },
              { href: '/tools/decode-evm-tx', label: labelMessages.decodeEvmTx, icon: IconBinaryTree2 },
              { href: '/tools/decode-evm-event', label: labelMessages.decodeEvmEvent, icon: IconWaveSine },
              { href: '/tools/4byte', label: labelMessages.signatureLookup, icon: IconSearch },
            ],
          },
          {
            id: 'security',
            label: messages.topNav.security,
            items: [
              { href: '/tools/keystore', label: labelMessages.keystore, icon: IconKey },
              { href: '/tools/wallet-generator', label: labelMessages.walletGenerator, icon: IconWallet },
            ],
          },
        ]
      : [
          {
            id: 'chain',
            label: messages.topNav.chain,
            items: [
              { href: '/evm/tools/send-tx', label: labelMessages.sendTransaction, icon: IconSend },
              { href: '/evm/tools/historical-balance', label: labelMessages.historicalBalance, icon: IconClockSearch },
              { href: '/evm/tools/token-supply', label: labelMessages.tokenSupply, icon: IconChartHistogram },
              { href: '/evm/tools/rpc', label: labelMessages.rpcApi, icon: IconCloudCode },
            ],
          },
          {
            id: 'tools',
            label: messages.topNav.tools,
            items: [
              { href: '/tools/hash', label: labelMessages.hashEncoding, icon: IconHash },
              { href: '/tools/big-number', label: labelMessages.bigNumber, icon: IconFunction },
              { href: '/tools/unit-converter', label: labelMessages.unitConverter, icon: IconCalculator },
              { href: '/tools/bech32', label: labelMessages.bech32, icon: IconArrowsExchange },
              { href: '/tools/decode-evm-tx', label: labelMessages.decodeEvmTx, icon: IconBinaryTree2 },
              { href: '/tools/decode-evm-event', label: labelMessages.decodeEvmEvent, icon: IconWaveSine },
              { href: '/tools/4byte', label: labelMessages.signatureLookup, icon: IconSearch },
            ],
          },
          {
            id: 'security',
            label: messages.topNav.security,
            items: [
              { href: '/tools/keystore', label: labelMessages.keystore, icon: IconKey },
              { href: '/tools/wallet-generator', label: labelMessages.walletGenerator, icon: IconWallet },
            ],
          },
        ];

  const moreItems = moreGroups.flatMap((group) => group.items);
  const moreActive = moreItems.some((item) => matchesNavItem(pathname, item.href));

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function cancelScheduledClose() {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openMenu(groupId: string) {
    cancelScheduledClose();
    setOpenGroup(groupId);
  }

  function scheduleClose(groupId: string) {
    cancelScheduledClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpenGroup((current) => (current === groupId ? null : current));
      closeTimeoutRef.current = null;
    }, NAV_CLOSE_DELAY_MS);
  }

  return (
    <header className="sticky top-0 z-40 mb-4 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 px-3 py-1.5 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          {showStatusSkeleton ? (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                <Skeleton className="h-3.5 w-[118px] rounded-sm" />
                <Skeleton className="h-3.5 w-[118px] rounded-sm" />
              </div>
              <div className="flex min-w-0 flex-col gap-1 lg:border-l lg:border-slate-200 lg:pl-3">
                <Skeleton className="h-3.5 w-[96px] rounded-sm" />
                <Skeleton className="h-3.5 w-[96px] rounded-sm" />
              </div>
            </>
          ) : (
            <>
              <ChainStatusStrip mode={mode} />
              <div className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-none text-slate-500 lg:border-l lg:border-slate-200 lg:pl-3">
                <div className="flex min-w-0 items-center gap-1">
                  <RpcProviderManager mode={mode} variant="topbar-context" onReadyChange={setProviderReady} />
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  <ActiveEvmKeySelector variant="topbar-context" onReadyChange={setKeyReady} />
                </div>
              </div>
            </>
          )}
          {showStatusSkeleton ? (
            <div className="pointer-events-none absolute inset-0 invisible">
              <div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
                <ChainStatusStrip mode={mode} />
                <div className="flex min-w-0 flex-col gap-0.5 text-[11px] leading-none text-slate-500 lg:border-l lg:border-slate-200 lg:pl-3">
                  <div className="flex min-w-0 items-center gap-1">
                    <RpcProviderManager mode={mode} variant="topbar-context" onReadyChange={setProviderReady} />
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <ActiveEvmKeySelector variant="topbar-context" onReadyChange={setKeyReady} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex w-full items-center justify-end gap-2 lg:max-w-[460px] lg:shrink-0">
          <GlobalSearch mode={mode} variant="topbar" showLabel={false} placeholder={messages.search.topbarPlaceholder} />
          <button
            type="button"
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            aria-label={locale === 'en' ? messages.language.switchToChinese : messages.language.switchToEnglish}
            onClick={toggleLocale}
          >
            <IconLanguage className="size-4" stroke={2} />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto grid max-w-[1400px] gap-5 px-3 py-0.5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex items-center gap-3">
            <Link prefetch={false} href="/" className="flex items-center gap-3 py-1">
              <Image alt={messages.topNav.brandAlt} className="h-9 w-9" height={36} src="/brand-mark.svg" width={36} />
              <span className="flex flex-col leading-none">
                <span className="text-[24px] font-semibold tracking-[-0.04em] text-slate-950">{messages.topNav.brandTitle}</span>
                <span className="mt-1 text-[11px] font-medium tracking-[0.08em] text-slate-500">{messages.topNav.brandSubtitle}</span>
              </span>
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
            <div className="relative" onMouseEnter={() => openMenu('tools-more')} onMouseLeave={() => scheduleClose('tools-more')}>
              <button
                type="button"
                className={
                  moreActive || openGroup === 'tools-more'
                    ? 'inline-flex items-center gap-1.5 py-2.5 font-[450] text-[#1697ea]'
                    : 'inline-flex items-center gap-1.5 py-2.5 font-[450] text-slate-950 hover:text-[#1697ea]'
                }
                aria-expanded={openGroup === 'tools-more'}
              >
                <span>{messages.navigation.more}</span>
                <IconChevronDown className="size-3.5" stroke={2.2} />
              </button>
              {openGroup === 'tools-more' ? (
                <div className="absolute right-0 top-full z-20 pt-2 translate-x-32" onMouseEnter={cancelScheduledClose} onMouseLeave={() => scheduleClose('tools-more')}>
                  <div className="absolute inset-x-0 top-0 h-2" aria-hidden="true" />
                  <div className="w-max max-w-[min(1280px,calc(100vw-32px))] overflow-hidden rounded-b-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                    <div className="border-t-[3px] border-[#19a7f2]" />
                    <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-0">
                      <div className="bg-slate-50 px-6 py-6">
                        <div className="text-[15px] font-semibold text-slate-950">{messages.navigation.more}</div>
                        <p className="mt-3 text-[14px] leading-6 text-slate-600">{messages.topNav.moreDescription}</p>
                      </div>
                      <div className="flex flex-col gap-3.5 px-6 py-5">
                        {moreGroups.map((group) => (
                          <div key={group.id} className="grid min-w-0 grid-cols-[84px_minmax(0,1fr)] items-start gap-4">
                            <div className="pt-1 text-[15px] font-semibold text-slate-950">{group.label}</div>
                            <div className="grid min-w-0 grid-cols-4 gap-x-4 gap-y-0.5">
                              {group.items.map((item) => {
                                const itemActive = matchesNavItem(pathname, item.href);
                                const Icon = item.icon ?? IconSend;

                                return (
                                  <Link
                                    prefetch={false}
                                    key={item.href}
                                    href={item.href}
                                    className={
                                      itemActive
                                        ? 'flex w-full min-w-[max-content] items-center gap-2 rounded-lg px-2 py-1 text-[14px] font-[450] text-[#1697ea]'
                                        : 'flex w-full min-w-[max-content] items-center gap-2 rounded-lg px-2 py-1 text-[14px] font-[450] text-slate-700 hover:bg-slate-100 hover:text-[#1697ea]'
                                    }
                                  >
                                    <Icon className="size-4 shrink-0" stroke={1.9} />
                                    <span>{item.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="relative flex flex-wrap items-center justify-end gap-3 pl-[8px] before:absolute before:left-[-8px] before:top-1/2 before:h-[14px] before:w-[1.5px] before:-translate-y-1/2 before:bg-slate-300">
            {status === 'authenticated' ? (
              <div className="relative" onMouseEnter={() => openMenu('user-menu')} onMouseLeave={() => scheduleClose('user-menu')}>
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
                  <div className="absolute right-0 top-full z-20 pt-2" onMouseEnter={cancelScheduledClose} onMouseLeave={() => scheduleClose('user-menu')}>
                    <div className="absolute inset-x-0 top-0 h-2" aria-hidden="true" />
                    <div className="min-w-[160px] w-max max-w-[320px] overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.12)]">
                      <div className="border-t-[3px] border-[#19a7f2]" />
                      <div className="px-3 pb-0 pt-2">
                        {userMenuSections.map((section, sectionIndex) => (
                          <div key={section.id} className={sectionIndex === 0 ? '' : 'border-t border-slate-200'}>
                            {section.items.map((item) => {
                              const itemActive = matchesNavItem(pathname, item.href);

                              return (
                                <Link
                                  prefetch={false}
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
                            {messages.navigation.signOut}
                          </Button>
                        </div>
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
