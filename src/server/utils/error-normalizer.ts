export function normalizeApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
    return { category: 'connection', message };
  }

  if (
    message.includes('invalid') ||
    message.includes('parse') ||
    message.includes('JSON')
  ) {
    return { category: 'validation', message };
  }

  if (message.includes('Unauthorized')) {
    return { category: 'auth', message };
  }

  return { category: 'upstream', message };
}
