import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { AppProviders } from '@/app/providers';
import { defaultLocale, LOCALE_COOKIE_NAME, locales, type Locale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = locales.includes(localeCookie as Locale) ? (localeCookie as Locale) : defaultLocale;
  const brandTitle = locale === 'zh' ? 'EVM & Cosmos 链开发工作台' : 'Chain Dev for EVM & Cosmos';
  const description =
    locale === 'zh'
      ? '搜索入口已放到顶部导航，首页聚焦在摘要卡片和数据列表，不再使用大体积首屏横幅。'
      : 'The search entry now lives in the top navigation. The home page itself stays focused on summary cards and data lists without a large hero block.';

  return {
    title: {
      default: brandTitle,
      template: `%s | ${brandTitle}`,
    },
    description,
    icons: {
      icon: '/icon.svg',
      shortcut: '/icon.svg',
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocale: Locale = locales.includes(localeCookie as Locale) ? (localeCookie as Locale) : defaultLocale;

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body>
        <AppProviders initialLocale={initialLocale}>{children}</AppProviders>
      </body>
    </html>
  );
}
