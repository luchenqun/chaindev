'use client';

export function resolveAbsoluteCallbackUrl(callbackUrl?: string | null) {
  if (typeof window === 'undefined') {
    return callbackUrl ?? '/';
  }

  if (callbackUrl && /^(https?:)?\/\//.test(callbackUrl)) {
    return callbackUrl;
  }

  return new URL(callbackUrl ?? '/', window.location.origin).toString();
}
