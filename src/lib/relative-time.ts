import type { Locale } from '@/i18n/config';

export function formatRelativeAge(timestampMs: number | null, nowMs: number, locale: Locale = 'en') {
  if (!timestampMs) {
    return locale === 'zh' ? '不可用' : 'Unavailable';
  }

  const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));

  if (seconds < 60) {
    return locale === 'zh' ? `${seconds} 秒前` : `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return locale === 'zh' ? `${minutes} 分钟前` : `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return locale === 'zh' ? `${hours} 小时前` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return locale === 'zh' ? `${days} 天前` : `${days}d ago`;
}
