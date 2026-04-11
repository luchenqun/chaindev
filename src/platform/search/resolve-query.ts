import type { PlatformMode } from "@/config/chains";
import { createEvmClient } from "@/domains/evm/server/client";
import { parseQuery } from "@/platform/search/parse-query";

export type QueryResolution =
  | { ok: true; target: string }
  | { ok: false; message: string };

type ResolveQueryOptions = {
  evmRpcUrl?: string | null;
};

async function resolveEvmHashTarget(hash: string, rpcUrl?: string | null): Promise<QueryResolution> {
  if (!rpcUrl) {
    return { ok: true, target: `/evm/tx/${hash}` };
  }

  const client = createEvmClient(rpcUrl);

  try {
    await client.getTransaction({ hash: hash as `0x${string}` });
    return { ok: true, target: `/evm/tx/${hash}` };
  } catch {}

  try {
    const block = await client.getBlock({ blockHash: hash as `0x${string}` });
    return { ok: true, target: `/evm/block/${block.number.toString()}` };
  } catch {}

  return { ok: false, message: `No transaction or block found for hash "${hash}".` };
}

export async function resolveQueryTarget(
  raw: string,
  mode: PlatformMode,
  options: ResolveQueryOptions = {},
): Promise<QueryResolution> {
  const match = parseQuery(raw);

  if (match.type === "evm-hash") {
    return resolveEvmHashTarget(match.value, options.evmRpcUrl);
  }

  if (match.type === "evm-address") {
    return { ok: true, target: `/evm/address/${match.value}` };
  }

  if (match.type === "cosmos-tx") {
    return { ok: true, target: `/cosmos/tx/${match.value}` };
  }

  if (match.type === "cosmos-address") {
    return { ok: true, target: `/cosmos/account/${match.value}` };
  }

  if (match.type === "numeric" && mode === "evm") {
    return { ok: true, target: `/evm/block/${match.value}` };
  }

  if (match.type === "numeric" && mode === "cosmos") {
    return { ok: true, target: `/cosmos/block/${match.value}` };
  }

  return { ok: false, message: "Unsupported query type" };
}
