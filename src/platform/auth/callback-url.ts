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

export function resolveClientRedirectUrl(
  returnedUrl: string | null | undefined,
  fallbackUrl?: string | null,
) {
  const resolvedFallbackUrl = resolveAbsoluteCallbackUrl(fallbackUrl);

  if (typeof window === 'undefined') {
    return returnedUrl ?? resolvedFallbackUrl;
  }

  if (!returnedUrl) {
    return resolvedFallbackUrl;
  }

  try {
    const resolvedUrl = new URL(returnedUrl, window.location.origin);

    if (resolvedUrl.origin !== window.location.origin) {
      return new URL(
        `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`,
        window.location.origin,
      ).toString();
    }

    return resolvedUrl.toString();
  } catch {
    return resolvedFallbackUrl;
  }
}
