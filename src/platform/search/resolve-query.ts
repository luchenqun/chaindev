import type { PlatformMode } from '@/config/chains';
import { parseQuery } from '@/platform/search/parse-query';

export type QueryResolution = { ok: true; target: string } | { ok: false; message: string };

export function resolveQueryTarget(raw: string, mode: PlatformMode): QueryResolution {
  const match = parseQuery(raw);

  if (match.type === 'evm-hash') {
    return { ok: true, target: `/evm/tx/${match.value}` };
  }

  if (match.type === 'evm-address') {
    return { ok: true, target: `/evm/address/${match.value}` };
  }

  if (match.type === 'cosmos-tx') {
    return { ok: true, target: `/cosmos/tx/${match.value}` };
  }

  if (match.type === 'cosmos-address') {
    return { ok: true, target: `/cosmos/account/${match.value}` };
  }

  if (match.type === 'numeric' && mode === 'evm') {
    return { ok: true, target: `/evm/block/${match.value}` };
  }

  if (match.type === 'numeric' && mode === 'cosmos') {
    return { ok: true, target: `/cosmos/block/${match.value}` };
  }

  return { ok: false, message: 'Unsupported query type' };
}

export function resolveQueryTargetFromParsedMatch(
  match: ReturnType<typeof parseQuery>,
  mode: PlatformMode,
  options?: {
    evmBlockNumberByHash?: bigint | number | null;
  },
): QueryResolution {
  if (match.type === 'evm-hash') {
    if (options?.evmBlockNumberByHash != null) {
      return { ok: true, target: `/evm/block/${options.evmBlockNumberByHash.toString()}` };
    }

    return { ok: true, target: `/evm/tx/${match.value}` };
  }

  if (match.type === 'evm-address') {
    return { ok: true, target: `/evm/address/${match.value}` };
  }

  if (match.type === 'cosmos-tx') {
    return { ok: true, target: `/cosmos/tx/${match.value}` };
  }

  if (match.type === 'cosmos-address') {
    return { ok: true, target: `/cosmos/account/${match.value}` };
  }

  if (match.type === 'numeric' && mode === 'evm') {
    return { ok: true, target: `/evm/block/${match.value}` };
  }

  if (match.type === 'numeric' && mode === 'cosmos') {
    return { ok: true, target: `/cosmos/block/${match.value}` };
  }

  return { ok: false, message: 'Unsupported query type' };
}
