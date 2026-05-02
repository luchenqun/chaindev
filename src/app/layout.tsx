import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/app/providers';
import { defaultLocale } from '@/i18n/config';

export const metadata: Metadata = {
  title: {
    default: 'Chain Dev for EVM & Cosmos',
    template: '%s | Chain Dev for EVM & Cosmos',
  },
  description: 'Unified EVM and Cosmos developer workbench',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
