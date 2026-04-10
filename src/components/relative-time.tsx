"use client";

import { useEffect, useState } from "react";

function formatRelativeAge(timestampMs: number | null, nowMs: number) {
  if (!timestampMs) {
    return "Unavailable";
  }

  const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));

  if (seconds < 60) {
    return `${seconds} secs ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} mins ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hrs ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export function RelativeTime({ timestampMs }: { timestampMs: number | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return <>{formatRelativeAge(timestampMs, nowMs)}</>;
}
