'use client';

import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';

export type QuarixPagination = {
  next_key?: string | null;
  total?: string;
};

type QuarixStakingResponse = Record<string, unknown> & {
  pagination?: QuarixPagination;
};

export type QuarixStakingCollectionState<T> = {
  items: T[];
  pagination: QuarixPagination | null;
  response: Record<string, unknown>;
};

export type QuarixInvestmentProgramPool = {
  id?: string | number;
  name?: string;
  details?: string;
  royalty_fee?: unknown;
  royaltyFee?: unknown;
  voting_weight?: unknown;
  votingWeight?: unknown;
  max_staking?: string;
  maxStaking?: string;
  current_staking?: string;
  currentStaking?: string;
};

export type QuarixAllocatedInvestmentProgramPool = {
  validator_address?: string;
  validatorAddress?: string;
  ipp_id?: string | number;
  ippId?: string | number;
};

const PAGE_LIMIT = '200';
const INVESTMENT_PROGRAM_POOLS_PATH = '/quarix/staking/v1/investment_program_pools';
const ALLOCATE_INVESTMENT_PROGRAM_POOLS_PATH = '/quarix/staking/v1/allocate_investment_program_pools';

function buildQuarixStakingUrl(restUrl: string, path: string, nextKey: string | null) {
  const url = new URL(`${restUrl}${path}`);

  url.searchParams.set('pagination.limit', PAGE_LIMIT);
  url.searchParams.set('pagination.count_total', 'true');

  if (nextKey) {
    url.searchParams.set('pagination.key', nextKey);
  }

  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getFirstArray<T>(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

async function requestAllQuarixStakingItems<T>(input: { path: string; itemKeys: string[]; responseKey: string }): Promise<QuarixStakingCollectionState<T>> {
  const profile = getActiveCosmosProvider();
  const pages: QuarixStakingResponse[] = [];
  const items: T[] = [];
  let nextKey: string | null = null;

  do {
    const response = await fetch(buildQuarixStakingUrl(profile.restUrl, input.path, nextKey), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const page = (await response.json()) as QuarixStakingResponse;

    pages.push(page);
    items.push(...getFirstArray<T>(page, input.itemKeys));
    nextKey = isRecord(page.pagination) ? page.pagination.next_key || null : null;
  } while (nextKey);

  const pagination = isRecord(pages[pages.length - 1]?.pagination) ? (pages[pages.length - 1].pagination ?? null) : null;

  return {
    items,
    pagination,
    response: {
      [input.responseKey]: items,
      ...(pagination ? { pagination } : {}),
    },
  };
}

export function getQuarixInvestmentProgramPools() {
  return requestAllQuarixStakingItems<QuarixInvestmentProgramPool>({
    path: INVESTMENT_PROGRAM_POOLS_PATH,
    itemKeys: ['investment_program_pools', 'investmentProgramPools'],
    responseKey: 'investment_program_pools',
  });
}

export function getQuarixAllocateInvestmentProgramPools() {
  return requestAllQuarixStakingItems<QuarixAllocatedInvestmentProgramPool>({
    path: ALLOCATE_INVESTMENT_PROGRAM_POOLS_PATH,
    itemKeys: ['allocate_investment_program_pools', 'allocateInvestmentProgramPools'],
    responseKey: 'allocate_investment_program_pools',
  });
}
