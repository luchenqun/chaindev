import { NextRequest } from 'next/server';
import type { PlatformMode } from '@/config/chains';
import { resolveQueryTarget } from '@/platform/search/resolve-query';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const mode = (request.nextUrl.searchParams.get('mode') ?? 'evm') as PlatformMode;
  const resolution = resolveQueryTarget(query, mode);

  if (!resolution.ok) {
    return Response.json(resolution, { status: 400 });
  }

  return Response.json(resolution);
}
