'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { type ReactNode } from 'react';
import type { PlatformMode } from '@/config/chains';
import { useMessages } from '@/i18n/locale-provider';
import { getAccountMenuSections } from '@/platform/layout/account-menu-config';

function matchesAccountMenuItem(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountWorkbenchShell({ mode, children }: { mode: PlatformMode; children: ReactNode }) {
  const messages = useMessages();
  const pathname = usePathname();
  const { data: session } = useSession();
  const sections = getAccountMenuSections(mode, messages);
  const username = (session?.user as { username?: string } | undefined)?.username ?? session?.user?.name ?? messages.topNav.account;
  const email = session?.user?.email ?? messages.topNav.signedInWorkspace;

  return (
    <main className="section-block">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-5">
              <p className="text-[1.125rem] font-semibold text-slate-900">{username}</p>
              <p className="mt-1 text-sm text-slate-500">{email}</p>
            </div>
            <div className="px-4 py-4">
              {sections.map((section, sectionIndex) => (
                <div key={section.id} className={sectionIndex === 0 ? '' : 'mt-4 border-t border-slate-200 pt-4'}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section.label}</p>
                  <div className="mt-2 grid gap-1">
                    {section.items.map((item) => {
                      const active = matchesAccountMenuItem(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={
                            active
                              ? 'rounded-xl bg-slate-100 px-3 py-2.5 text-[15px] font-medium text-slate-950'
                              : 'rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                          }
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
