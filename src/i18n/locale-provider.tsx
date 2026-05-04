'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLocale, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, locales, type Locale } from '@/i18n/config';
import { getMessages, type Messages } from '@/i18n';

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

function readInitialLocale(): Locale {
  if (typeof document !== 'undefined') {
    const cookiePair = document.cookie.split('; ').find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`));
    const cookieValue = cookiePair?.slice(cookiePair.indexOf('=') + 1);

    if (isLocale(cookieValue)) {
      return cookieValue;
    }
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);

    if (isLocale(stored)) {
      return stored;
    }
  }

  return defaultLocale;
}

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readInitialLocale());

  useEffect(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages: getMessages(locale),
      setLocale: setLocaleState,
      toggleLocale: () => {
        setLocaleState((current) => (current === 'en' ? 'zh' : 'en'));
      },
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider.');
  }

  return context;
}

export function useMessages() {
  return useLocale().messages;
}
