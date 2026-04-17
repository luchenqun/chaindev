export type ActivePlatformMode = 'evm' | 'cosmos';

export function isCosmosHomeRouteActive(
  pathname: string,
  activeMode: ActivePlatformMode,
) {
  if (pathname === '/cosmos/overview') {
    return true;
  }

  if (pathname !== '/') {
    return false;
  }

  return activeMode === 'cosmos';
}

export function isCosmosRouteActive(
  pathname: string,
  activeMode: ActivePlatformMode,
) {
  if (pathname.startsWith('/cosmos')) {
    return true;
  }

  return pathname === '/' && activeMode === 'cosmos';
}

export function isEvmRouteActive(
  pathname: string,
  activeMode: ActivePlatformMode,
) {
  if (pathname !== '/') {
    return !pathname.startsWith('/cosmos');
  }

  return activeMode === 'evm';
}
