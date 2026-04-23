import { NextRequest } from 'next/server';
import type { PlatformMode } from '@/config/chains';
import { getGuestFallbackRpcProfile, getActiveRpcProfileCookieName, parseActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile';
import { resolveQueryTarget } from '@/platform/search/resolve-query';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const mode = (request.nextUrl.searchParams.get('mode') ?? 'evm') as PlatformMode;
  const activeEvmProfile = parseActiveRpcProfileCookie(request.cookies.get(getActiveRpcProfileCookieName('evm'))?.value) ?? getGuestFallbackRpcProfile('evm');
  const resolution = await resolveQueryTarget(query, mode, {
    evmRpcUrl: activeEvmProfile?.mode === 'evm' ? activeEvmProfile.rpcUrl : null,
  });

  if (!resolution.ok) {
    return Response.json(resolution, { status: 400 });
  }

  return Response.json(resolution);
}
