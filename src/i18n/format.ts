import { defaultLocale } from '@/i18n/config';

function normalizeFormattingLocale(value: string | null | undefined) {
  if (!value) {
    return defaultLocale === 'zh' ? 'zh-CN' : 'en-US';
  }

  if (value === 'zh' || value.startsWith('zh-')) {
    return 'zh-CN';
  }

  if (value === 'en' || value.startsWith('en-')) {
    return 'en-US';
  }

  return value;
}

export function getFormattingLocale(locale?: string | null) {
  if (locale) {
    return normalizeFormattingLocale(locale);
  }

  if (typeof document !== 'undefined') {
    return normalizeFormattingLocale(document.documentElement.lang);
  }

  return normalizeFormattingLocale(defaultLocale);
}

export function formatLocalizedDateTime(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions,
  locale?: string | null,
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getFormattingLocale(locale), options).format(date);
}

export function formatLocalizedNumber(value: number | bigint, locale?: string | null) {
  return new Intl.NumberFormat(getFormattingLocale(locale)).format(value);
}
