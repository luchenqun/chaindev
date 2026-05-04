import { defaultLocale, type Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { zh } from '@/i18n/messages/zh';

const messages = {
  en,
  zh,
} as const;

export function getMessages(locale: Locale = defaultLocale) {
  return messages[locale];
}

export type Messages = (typeof messages)[typeof defaultLocale];
