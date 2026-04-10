import { defaultLocale, type Locale } from "@/i18n/config";
import { en } from "@/i18n/messages/en";

const messages = {
  en,
} as const;

export function getMessages(locale: Locale = defaultLocale) {
  return messages[locale];
}
