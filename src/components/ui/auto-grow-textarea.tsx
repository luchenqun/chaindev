"use client";

import { useEffect, useRef } from "react";

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

export function AutoGrowTextarea(props: React.ComponentProps<"textarea">) {
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
