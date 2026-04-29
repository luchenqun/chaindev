'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export const PUSHED_LIST_ANIMATION_DURATION_MS = 500;

export type PushedListItem<T> = {
  item: T;
  key: string;
  phase: 'stable' | 'entering' | 'exiting';
};

export function usePushedListItems<T>(items: T[], getKey: (item: T) => string, enabled = true, maxVisibleItems?: number, settleAfterAnimation = true) {
  const [renderedItems, setRenderedItems] = useState<Array<PushedListItem<T>>>([]);
  const previousItemsRef = useRef<T[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    const nextItems = items;
    const nextKeys = new Set(nextItems.map(getKey));
    const previousItems = previousItemsRef.current;
    const previousKeys = new Set(previousItems.map(getKey));
    const topKey = nextItems[0] ? getKey(nextItems[0]) : null;
    const previousTopKey = previousItems[0] ? getKey(previousItems[0]) : null;
    const stableItems = nextItems.map((item) => ({
      item,
      key: getKey(item),
      phase: 'stable' as const,
    }));

    let settleTimeoutId: number | null = null;

    const updateTimeoutId = window.setTimeout(() => {
      if (!enabled) {
        initializedRef.current = false;
        previousItemsRef.current = nextItems;
        setRenderedItems(stableItems);
        return;
      }

      if (!nextItems.length) {
        initializedRef.current = false;
        previousItemsRef.current = [];
        setRenderedItems([]);
        return;
      }

      if (!initializedRef.current) {
        initializedRef.current = true;
        previousItemsRef.current = nextItems;
        setRenderedItems(stableItems);
        return;
      }

      previousItemsRef.current = nextItems;

      if (topKey === previousTopKey) {
        setRenderedItems(stableItems);
        return;
      }

      const shouldRenderExitingItems = maxVisibleItems == null || (previousItems.length >= maxVisibleItems && nextItems.length >= maxVisibleItems);
      const exitingItems = shouldRenderExitingItems ? previousItems.filter((item) => !nextKeys.has(getKey(item))) : [];
      const animatedItems: Array<PushedListItem<T>> = [
        ...nextItems.map((item) => {
          const key = getKey(item);

          return {
            item,
            key,
            phase: previousKeys.has(key) ? ('stable' as const) : ('entering' as const),
          };
        }),
        ...exitingItems.map((item) => ({
          item,
          key: getKey(item),
          phase: 'exiting' as const,
        })),
      ];

      setRenderedItems(animatedItems);

      if (settleAfterAnimation) {
        settleTimeoutId = window.setTimeout(() => {
          setRenderedItems(stableItems);
        }, PUSHED_LIST_ANIMATION_DURATION_MS);
      }
    }, 0);

    return () => {
      window.clearTimeout(updateTimeoutId);

      if (settleTimeoutId != null) {
        window.clearTimeout(settleTimeoutId);
      }
    };
  }, [enabled, getKey, items, maxVisibleItems, settleAfterAnimation]);

  return useMemo(
    () =>
      renderedItems.length
        ? renderedItems
        : items.map((item) => ({
            item,
            key: getKey(item),
            phase: 'stable' as const,
          })),
    [getKey, items, renderedItems],
  );
}
