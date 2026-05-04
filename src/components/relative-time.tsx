'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/locale-provider';
import { formatRelativeAge } from '@/lib/relative-time';

export function RelativeTime({ timestampMs }: { timestampMs: number | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { locale } = useLocale();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return <>{formatRelativeAge(timestampMs, nowMs, locale)}</>;
}
