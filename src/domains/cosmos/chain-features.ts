function normalizeChainId(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function isQuarixChainId(chainId: string | null | undefined) {
  const normalizedChainId = normalizeChainId(chainId);

  if (!normalizedChainId) {
    return false;
  }

  return normalizedChainId === '8888888' || normalizedChainId.includes('quarix');
}
