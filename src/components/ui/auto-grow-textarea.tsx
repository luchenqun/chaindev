'use client';

import { useEffect, useRef } from 'react';

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = '0px';

  const computedStyle = window.getComputedStyle(element);
  const maxHeight = Number.parseFloat(computedStyle.maxHeight);
  const hasMaxHeight = Number.isFinite(maxHeight) && maxHeight > 0;
  const nextHeight = hasMaxHeight ? Math.min(element.scrollHeight, maxHeight) : element.scrollHeight;

  element.style.height = `${nextHeight}px`;
  element.style.overflowY = hasMaxHeight && element.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

export function AutoGrowTextarea(props: React.ComponentProps<'textarea'>) {
  const { onInput, value, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    resizeTextarea(ref.current);
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      onInput={(event) => {
        resizeTextarea(event.currentTarget);
        onInput?.(event);
      }}
    />
  );
}
