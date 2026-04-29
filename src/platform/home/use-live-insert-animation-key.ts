'use client';

import { useEffect, useRef, useState } from 'react';

export function useLiveInsertAnimationKey(topItemKey: string | null) {
  const previousTopItemKeyRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (!topItemKey) {
      previousTopItemKeyRef.current = null;
      initializedRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      previousTopItemKeyRef.current = topItemKey;
      initializedRef.current = true;
      return;
    }

    if (previousTopItemKeyRef.current === topItemKey) {
      return;
    }

    previousTopItemKeyRef.current = topItemKey;

    const timeoutId = window.setTimeout(() => {
      setAnimationKey((current) => current + 1);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [topItemKey]);

  return animationKey;
}
