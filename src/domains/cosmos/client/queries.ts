"use client";

import { formatCosmosBlock, formatCosmosTx } from "@/domains/cosmos/server/formatters";
import { readActiveRpcProfileCookie } from "@/platform/workbench/rpc-profile-client";

function getActiveCosmosProvider() {
  const profile = readActiveRpcProfileCookie("cosmos");

  if (!profile) {
    throw new Error("No active Cosmos provider selected.");
  }

  if (!profile.restUrl) {
    throw new Error("The selected Cosmos provider is missing a REST URL.");
  }

  return profile;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatLocalTimestamp(value: string | undefined) {
  if (!value) {
    return "Unavailable";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function normalizeBaseAccount(account: unknown): { sequence: number; accountNumber: number } {
  if (!account || typeof account !== "object") {
    return { sequence: 0, accountNumber: 0 };
  }

  if ("base_account" in account && account.base_account && typeof account.base_account === "object") {
    return normalizeBaseAccount(account.base_account);
  }

  const value = account as { sequence?: string; account_number?: string };

  return {
    sequence: Number(value.sequence ?? 0),
    accountNumber: Number(value.account_number ?? 0),
  };
}

export async function getCosmosOverviewDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    result?: {
      node_info?: { network?: string };
      sync_info?: { latest_block_height?: string; latest_block_time?: string };
    };
  }>(`${profile.rpcUrl}/status`);

  return {
    chainLabel: profile.name,
    latestHeight: payload.result?.sync_info?.latest_block_height ?? "Unavailable",
    latestBlockTime: formatLocalTimestamp(payload.result?.sync_info?.latest_block_time),
    chainId: payload.result?.node_info?.network ?? "Unavailable",
  };
}

export async function getRecentCosmosBlocksDirect(limit = 8) {
  const profile = getActiveCosmosProvider();
  const status = await fetchJson<{
    result?: { sync_info?: { latest_block_height?: string } };
  }>(`${profile.rpcUrl}/status`);
  const latestHeight = Number(status.result?.sync_info?.latest_block_height ?? 0);
  const blocks = [];

  for (let cursor = latestHeight; blocks.length < limit; cursor -= 1) {
    const payload = await fetchJson<{
      result?: {
        block_id?: { hash?: string };
        block?: { header?: { height?: string; time?: string } };
      };
    }>(`${profile.rpcUrl}/block?height=${cursor}`);

    if (payload.result?.block_id?.hash && payload.result.block?.header?.height) {
      blocks.push(
        formatCosmosBlock({
          blockId: { hash: payload.result.block_id.hash },
          block: {
            header: {
              height: payload.result.block.header.height,
              time: payload.result.block.header.time,
            },
          },
        }),
      );
    }

    if (cursor === 1) {
      break;
    }
  }

  return blocks;
}

export async function getCosmosBlockByHeightDirect(height: number) {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    result?: {
      block_id?: { hash?: string };
      block?: { header?: { height?: string; time?: string } };
    };
  }>(`${profile.rpcUrl}/block?height=${height}`);

  if (!payload.result?.block_id?.hash || !payload.result.block?.header?.height) {
    throw new Error("Failed to load Cosmos block.");
  }

  return formatCosmosBlock({
    blockId: { hash: payload.result.block_id.hash },
    block: {
      header: {
        height: payload.result.block.header.height,
        time: payload.result.block.header.time,
      },
    },
  });
}

export async function getCosmosTxByHashDirect(hash: string) {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    tx_response?: {
      txhash?: string;
      height?: string;
      code?: number;
      gas_used?: string;
      raw_log?: string;
    };
  }>(`${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`);

  const tx = payload.tx_response;

  if (!tx?.txhash || !tx.height) {
    throw new Error("Failed to load Cosmos transaction.");
  }

  return formatCosmosTx({
    hash: tx.txhash,
    height: Number(tx.height),
    code: tx.code ?? 0,
    gasUsed: Number(tx.gas_used ?? 0),
    rawLog: tx.raw_log ?? "",
  });
}

export async function getCosmosAccountSummaryDirect(address: string) {
  const profile = getActiveCosmosProvider();
  const [balancesPayload, accountPayload] = await Promise.all([
    fetchJson<{ balances?: Array<{ denom: string; amount: string }> }>(
      `${profile.restUrl}/cosmos/bank/v1beta1/balances/${address}`,
    ),
    fetchJson<{ account?: unknown }>(`${profile.restUrl}/cosmos/auth/v1beta1/accounts/${address}`).catch(() => ({
      account: null,
    })),
  ]);
  const baseAccount = normalizeBaseAccount(accountPayload.account);

  return {
    address,
    balances: balancesPayload.balances ?? [],
    sequence: baseAccount.sequence,
    accountNumber: baseAccount.accountNumber,
  };
}

export async function getCosmosValidatorsDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    validators?: Array<{ operator_address: string; description?: { moniker?: string }; status?: string }>;
  }>(`${profile.restUrl}/cosmos/staking/v1beta1/validators?pagination.limit=20`);

  return payload.validators ?? [];
}

export async function getCosmosProposalsDirect() {
  const profile = getActiveCosmosProvider();
  const payload = await fetchJson<{
    proposals?: Array<{ id: string; title?: string; status?: string; metadata?: string }>;
  }>(`${profile.restUrl}/cosmos/gov/v1/proposals?pagination.limit=20`);

  return (payload.proposals ?? []).map((proposal) => ({
    ...proposal,
    title: proposal.title ?? proposal.metadata ?? "Untitled Proposal",
  }));
}

export async function requestCosmosRpcDirect(input: {
  endpoint: string;
  method: string;
  payload?: unknown;
  useRpc?: boolean;
}) {
  const profile = getActiveCosmosProvider();
  const baseUrl = input.useRpc ? profile.rpcUrl : profile.restUrl;
  const target = input.endpoint.startsWith("http") ? input.endpoint : `${baseUrl}${input.endpoint}`;
  const response = await fetch(target, {
    method: input.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: input.method === "GET" ? undefined : input.payload ? JSON.stringify(input.payload) : undefined,
  });
  const text = await response.text();

  try {
    return {
      endpoint: target,
      status: response.status,
      result: JSON.parse(text),
    };
  } catch {
    return {
      endpoint: target,
      status: response.status,
      result: text,
    };
  }
}
