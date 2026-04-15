import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/app/providers';
import { defaultLocale } from '@/i18n/config';

export const metadata: Metadata = {
  title: 'Chaindev',
  description: 'Unified EVM and Cosmos developer platform',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
