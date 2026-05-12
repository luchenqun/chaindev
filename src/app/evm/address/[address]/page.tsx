'use client';

import { toBech32 } from '@cosmjs/encoding';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hexToBytes, isAddress, type Abi } from 'viem';
import { IconArrowBackUp, IconArrowsExchange, IconBinaryTree2, IconCode, IconCoins, IconInfoCircle, IconRefresh, IconTag } from '@tabler/icons-react';
import { RelativeTime } from '@/components/relative-time';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { formatReadableDenom, formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { deleteEvmAddressTag, getEvmAddressTag, getEvmAddressTags, subscribeEvmAddressTags, upsertEvmAddressTag } from '@/domains/evm/client/address-tags';
import { resolvePreferredAddressLabel, resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { getEvmAddressCacheSnapshot, MAX_CACHED_EVM_TRANSACTIONS, subscribeEvmTransactionCache } from '@/domains/evm/client/transaction-cache';
import {
  createEvmContractBinding,
  getEvmContractArtifact,
  listEvmContractArtifacts,
  listEvmContractBindingsByScope,
  subscribeEvmContractRegistry,
  updateEvmContractBinding,
  type EvmContractArtifact,
  type EvmContractBinding,
} from '@/domains/evm/client/contract-registry';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { getActiveEvmContractEnvironmentDirect, writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { isQuarixEvmChainId } from '@/domains/evm/chain-features';
import { EVM_BANK_MODULE_ADDRESS, EVM_DISTRIBUTION_ADDRESS, EVM_STAKING_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { AddressContractPanel } from '@/domains/evm/ui/address-contract-panel';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { getActiveEvmCurrencyNameClient, getEvmAddressSummaryDirect, hydrateEvmCachedTransactionInputsByHashDirect } from '@/domains/evm/client/queries';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { EVM_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/evm-system-artifacts';
import { TransactionHashCell, TransactionMethodBadge, TransactionPreviewButton } from '@/domains/evm/ui/transaction-list-cells';

const VISIBLE_TRANSACTIONS = DEFAULT_TABLE_PAGE_SIZE;
const EVM_STAKING_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmStaking')?.abi ?? []) as Abi;
const EVM_BANK_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmBank')?.abi ?? []) as Abi;
const EVM_DISTRIBUTION_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmDistribution')?.abi ?? []) as Abi;
const EVM_BANK_ALL_BALANCES_ABI = EVM_BANK_ABI.filter((item) => item.type === 'function' && item.name === 'allBalances') as Abi;
const EVM_STAKING_DELEGATOR_VALIDATORS_ABI = EVM_STAKING_ABI.filter((item) => item.type === 'function' && item.name === 'delegatorValidators') as Abi;
const EVM_STAKING_DELEGATION_ABI = EVM_STAKING_ABI.filter((item) => item.type === 'function' && item.name === 'delegation') as Abi;
const EVM_STAKING_UNDELEGATE_ABI = EVM_STAKING_ABI.filter((item) => item.type === 'function' && item.name === 'undelegate') as Abi;
const EVM_STAKING_REDELEGATE_ABI = EVM_STAKING_ABI.filter((item) => item.type === 'function' && item.name === 'redelegate') as Abi;
const EVM_STAKING_VALIDATORS_ABI = EVM_STAKING_ABI.filter((item) => item.type === 'function' && item.name === 'validators') as Abi;
const EVM_DISTRIBUTION_WITHDRAW_DELEGATOR_REWARDS_ABI = EVM_DISTRIBUTION_ABI.filter((item) => item.type === 'function' && item.name === 'withdrawDelegatorRewards') as Abi;
const EVM_DISTRIBUTION_DELEGATION_REWARDS_ABI = EVM_DISTRIBUTION_ABI.filter((item) => item.type === 'function' && item.name === 'delegationRewards') as Abi;
const EVM_BANK_PRECOMPILE_ADDRESS = EVM_BANK_MODULE_ADDRESS as `0x${string}`;
const EVM_STAKING_PRECOMPILE_ADDRESS = EVM_STAKING_ADDRESS as `0x${string}`;
const EVM_DISTRIBUTION_PRECOMPILE_ADDRESS = EVM_DISTRIBUTION_ADDRESS as `0x${string}`;

type AddressPageTab = 'transactions' | 'quarix' | 'contract';
type ContractSubview = 'code' | 'read' | 'write';
type ContractEnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
} | null;
type EvmStakingPageRequest = {
  key: `0x${string}`;
  offset: bigint;
  limit: bigint;
  countTotal: boolean;
  reverse: boolean;
};
type EvmDelegationBalance = {
  denom?: string;
  amount?: bigint | number | string;
};
type EvmStakingValidatorDescription = {
  moniker?: string;
};
type EvmStakingValidator = {
  operatorAddress?: string;
  description?: EvmStakingValidatorDescription;
};
type EvmDistributionDecCoin = {
  denom?: string;
  amount?: bigint | number | string;
  precision?: bigint | number | string;
};
type EvmSingleDelegationResponse = {
  shares?: bigint | number | string;
  balance?: EvmDelegationBalance;
};
type EvmDelegationsPageResponse = {
  total?: bigint | number | string;
};
type EvmDelegationItem = {
  delegatorAddress?: string;
  validatorAddress?: string;
  shares?: bigint | number | string;
  balance?: EvmDelegationBalance;
  validatorMoniker: string | null;
  rewardLabel: string;
};
type EvmDelegationLoadItem = EvmDelegationItem & {
  rawRewards: EvmDistributionDecCoin[];
  sortIndex: number;
};
type EvmDelegationsSnapshot = {
  totalDelegations: number;
  items: EvmDelegationItem[];
  response: {
    delegatorValidators: EvmStakingValidator[];
    validators: EvmStakingValidator[];
    delegations: Array<{
      validatorAddress: string | undefined;
      delegation: EvmSingleDelegationResponse;
      rewards: EvmDistributionDecCoin[];
    }>;
  };
};
type EvmBankBalanceItem = {
  denom: string;
  amount: bigint | number | string;
};
type QuarixDelegationActionKind = 'withdrawRewards' | 'undelegate' | 'redelegate';
type QuarixDelegationActionTarget = {
  validatorAddress: string;
  validatorMoniker: string | null;
};
const EMPTY_DELEGATIONS_SNAPSHOT: EvmDelegationsSnapshot = {
  totalDelegations: 0,
  items: [],
  response: {
    delegatorValidators: [],
    validators: [],
    delegations: [],
  },
};

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function normalizeBigintLike(value: unknown) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  return 0n;
}

function normalizeStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatDecCoinAmount(item: EvmDistributionDecCoin) {
  const amount = normalizeBigintLike(item.amount);
  const precision = Number(normalizeBigintLike(item.precision));

  if (!Number.isFinite(precision) || precision <= 0) {
    return amount.toString();
  }

  const divisor = 10n ** BigInt(precision);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionLabel = fraction.toString().padStart(precision, '0').replace(/0+$/, '');

  return fractionLabel ? `${whole.toString()}.${fractionLabel}` : whole.toString();
}

function formatDelegationRewardLabel(rewards: EvmDistributionDecCoin[], locale: string) {
  if (!rewards.length) {
    return '0';
  }

  return rewards
    .map((item) => {
      const amountLabel = formatDecCoinAmount(item);
      const [wholePart, fractionPart = ''] = amountLabel.split('.');
      const wholeNumber = Number.parseInt(wholePart || '0', 10);
      const normalizedWhole = Number.isFinite(wholeNumber) ? wholeNumber.toLocaleString(locale) : wholePart;
      const normalizedAmount = fractionPart ? `${normalizedWhole}.${fractionPart}` : normalizedWhole;
      const denom = normalizeStringValue(item.denom);
      const readableDenom = denom ? formatReadableDenom(denom) : null;

      return readableDenom ? `${normalizedAmount} ${readableDenom}` : normalizedAmount;
    })
    .join(', ');
}

function formatScaled18AmountLabel(value: unknown, locale: string) {
  const normalized = normalizeBigintLike(value);
  const divisor = 10n ** 18n;
  const whole = normalized / divisor;
  const fraction = normalized % divisor;
  const fractionLabel = fraction.toString().padStart(18, '0').replace(/0+$/, '');
  const wholeLabel = whole.toLocaleString(locale);

  return fractionLabel ? `${wholeLabel}.${fractionLabel}` : wholeLabel;
}

function formatDelegationAmountLabel(balance: EvmDelegationBalance | undefined, locale: string) {
  const denom = typeof balance?.denom === 'string' && balance.denom.trim() ? balance.denom.trim() : '--';
  return `${formatScaled18AmountLabel(balance?.amount, locale)} ${denom}`;
}

function formatBankBalanceItem(balance: EvmBankBalanceItem) {
  return `${formatReadableTokenAmount(normalizeBigintLike(balance.amount).toString())} ${formatReadableDenom(balance.denom)}`;
}

function formatBankBalanceRawAmount(balance: EvmBankBalanceItem) {
  return normalizeBigintLike(balance.amount).toString();
}

function scaleToIntegerByPowerOfTen(rawValue: string, exponent: number) {
  const value = rawValue.trim();

  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  const digits = `${wholePart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0';
  const decimalShift = exponent - fractionPart.length;

  if (decimalShift < 0) {
    return null;
  }

  return `${digits}${'0'.repeat(decimalShift)}`;
}

function toQuarixValidatorAddress(input: string) {
  if (input.startsWith('quarix')) {
    return input;
  }

  if (!isAddress(input)) {
    return null;
  }

  try {
    return toBech32('quarixvaloper', hexToBytes(input));
  } catch {
    return null;
  }
}

async function getQuarixDelegationsSnapshot(address: string, locale: string): Promise<EvmDelegationsSnapshot> {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  const client = createEvmClient(profile.rpcUrl);
  const pageRequest: EvmStakingPageRequest = {
    key: '0x',
    offset: 0n,
    limit: 500n,
    countTotal: true,
    reverse: false,
  };
  const validatorsPageRequest: EvmStakingPageRequest = {
    key: '0x',
    offset: 0n,
    limit: 500n,
    countTotal: false,
    reverse: false,
  };

  const [[delegatorValidators, delegatorValidatorsPageResponse], [validators]] = (await Promise.all([
    client.readContract({
      address: EVM_STAKING_PRECOMPILE_ADDRESS,
      abi: EVM_STAKING_DELEGATOR_VALIDATORS_ABI,
      functionName: 'delegatorValidators',
      args: [address as `0x${string}`, pageRequest],
    }) as Promise<readonly [EvmStakingValidator[], EvmDelegationsPageResponse]>,
    client.readContract({
      address: EVM_STAKING_PRECOMPILE_ADDRESS,
      abi: EVM_STAKING_VALIDATORS_ABI,
      functionName: 'validators',
      args: ['', validatorsPageRequest],
    }) as Promise<readonly [EvmStakingValidator[], EvmDelegationsPageResponse]>,
  ])) as [readonly [EvmStakingValidator[], EvmDelegationsPageResponse], readonly [EvmStakingValidator[], EvmDelegationsPageResponse]];

  const validatorMonikerByAddress = new Map(
    [...validators, ...delegatorValidators]
      .map((validator) => {
        const operatorAddress = normalizeStringValue(validator.operatorAddress);

        if (!operatorAddress) {
          return null;
        }

        return [operatorAddress.toLowerCase(), normalizeStringValue(validator.description?.moniker)] as const;
      })
      .filter((entry): entry is readonly [string, string | null] => Boolean(entry)),
  );

  const items = (await Promise.all(
    delegatorValidators.map(async (validator, index) => {
      const validatorAddress = normalizeStringValue(validator.operatorAddress);

      if (!validatorAddress) {
        return {
          delegatorAddress: address,
          validatorAddress: undefined,
          shares: 0n,
          balance: {
            denom: '',
            amount: 0n,
          },
          validatorMoniker: null,
          rewardLabel: '0',
          rawRewards: [],
          sortIndex: index,
        } satisfies EvmDelegationLoadItem;
      }

      const [delegation, rewards] = await Promise.all([
        client.readContract({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abi: EVM_STAKING_DELEGATION_ABI,
          functionName: 'delegation',
          args: [address as `0x${string}`, validatorAddress],
        }) as Promise<readonly [bigint, EvmDelegationBalance]>,
        client.readContract({
          address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
          abi: EVM_DISTRIBUTION_DELEGATION_REWARDS_ABI,
          functionName: 'delegationRewards',
          args: [address as `0x${string}`, validatorAddress],
        }) as Promise<EvmDistributionDecCoin[]>,
      ]);

      return {
        delegatorAddress: address,
        validatorAddress,
        shares: delegation[0],
        balance: delegation[1],
        validatorMoniker: validatorMonikerByAddress.get(validatorAddress.toLowerCase()) ?? null,
        rewardLabel: formatDelegationRewardLabel(rewards, locale),
        rawRewards: rewards,
        sortIndex: index,
      } satisfies EvmDelegationLoadItem;
    }),
  )) as EvmDelegationLoadItem[];

  const totalDelegations = Number(normalizeBigintLike(delegatorValidatorsPageResponse?.total ?? items.length));
  const sortedItems = items
    .slice()
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .map(({ sortIndex, ...item }) => item);

  return {
    totalDelegations,
    items: sortedItems,
    response: {
      delegatorValidators,
      validators,
      delegations: items.map((item) => ({
        validatorAddress: item.validatorAddress,
        delegation: {
          shares: item.shares,
          balance: item.balance,
        },
        rewards: item.rawRewards,
      })),
    },
  };
}


function AddressPageSkeleton() {
  return (
    <main className="section-block">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-[520px]" />
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <Skeleton className="h-7 w-28" />
            <div className="mt-5 space-y-5">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex}>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-2 h-5 w-48" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-md" />
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-7 w-80" />
          <Skeleton className="mt-2 h-4 w-[520px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {Array.from({ length: 9 }).map((_, index) => (
                  <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: VISIBLE_TRANSACTIONS }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200">
                  {Array.from({ length: 9 }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-5 py-3">
                      <Skeleton className={`h-4 ${columnIndex === 0 ? 'w-32' : columnIndex === 4 || columnIndex === 5 ? 'w-28' : 'w-20'}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatBalanceLabel(balance: string, currencyName: string) {
  const amount = Number.parseFloat(balance);

  if (!Number.isFinite(amount)) {
    return `${balance} ${currencyName}`;
  }

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(6).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function getDirection(
  transaction: {
    from: string;
    to: string | null;
  },
  normalizedAddress: string,
) {
  const fromMatches = transaction.from.toLowerCase() === normalizedAddress;
  const toMatches = transaction.to?.toLowerCase() === normalizedAddress;

  if (fromMatches && toMatches) {
    return { label: 'self', className: 'bg-slate-100 text-slate-600' };
  }

  if (fromMatches) {
    return { label: 'out', className: 'bg-amber-50 text-amber-700' };
  }

  return { label: 'in', className: 'bg-emerald-50 text-emerald-700' };
}

function AddressMetric({ label, value, subtext, tooltip }: { label: string; value: React.ReactNode; subtext?: React.ReactNode; tooltip?: React.ReactNode }) {
  const { locale } = useLocale();
  const tooltipTriggerRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{translateRuntimeText(label, locale)}</p>
        {tooltip ? (
          <span
            ref={tooltipTriggerRef}
            className="inline-flex"
            onBlur={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            tabIndex={0}
          >
            <span className="inline-flex items-center justify-center text-slate-300 outline-none">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <FloatingTooltip
              open={tooltipOpen}
              anchorRef={tooltipTriggerRef}
              className="w-[260px] whitespace-normal bg-slate-800 leading-5 text-white"
            >
              {tooltip}
            </FloatingTooltip>
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export default function EvmAddressPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const { showToast } = useToast();
  const accountMessages = messages.cosmosAccountDetail;
  const nameTagMessages = messages.nameTags;
  const txMessages = messages.evmTxDetail;
  const contractMessages = messages.contractRegistry;
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const { status } = useSession();
  const unlockDialog = useEvmPrivateKeyUnlockDialog();
  const searchParams = useSearchParams();
  const address = params.address;
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(address), [address]);
  const requestedTab = searchParams.get('tab');
  const requestedContractTab = searchParams.get('contractTab');
  const transactionPage = parsePageParam(searchParams.get('page'));
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getEvmAddressSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [addressCacheSnapshot, setAddressCacheSnapshot] = useState<Awaited<ReturnType<typeof getEvmAddressCacheSnapshot>>>({
    page: 1,
    pageSize: VISIBLE_TRANSACTIONS,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    totalTransactions: 0,
    transactions: [],
    latestSeenTransaction: null,
    firstSeenTransaction: null,
    inboundCount: 0,
    outboundCount: 0,
    selfCount: 0,
  });
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [contractEnvironment, setContractEnvironment] = useState<ContractEnvironmentState>(null);
  const [contractBinding, setContractBinding] = useState<EvmContractBinding | null>(null);
  const [contractArtifact, setContractArtifact] = useState<EvmContractArtifact | null>(null);
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingArtifactId, setBindingArtifactId] = useState('');
  const [bindingLabelInput, setBindingLabelInput] = useState('');
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [delegationsSnapshot, setDelegationsSnapshot] = useState<EvmDelegationsSnapshot>(EMPTY_DELEGATIONS_SNAPSHOT);
  const [delegationsLoading, setDelegationsLoading] = useState(false);
  const [delegationsError, setDelegationsError] = useState<string | null>(null);
  const [quarixBalances, setQuarixBalances] = useState<EvmBankBalanceItem[]>([]);
  const [showDelegationsRawJson, setShowDelegationsRawJson] = useState(false);
  const [delegationsRefreshVersion, setDelegationsRefreshVersion] = useState(0);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [delegationActionSubmitting, setDelegationActionSubmitting] = useState(false);
  const [delegationActionError, setDelegationActionError] = useState<string | null>(null);
  const [delegationActionKind, setDelegationActionKind] = useState<QuarixDelegationActionKind | null>(null);
  const [delegationActionTarget, setDelegationActionTarget] = useState<QuarixDelegationActionTarget | null>(null);
  const [undelegateAmountInput, setUndelegateAmountInput] = useState('');
  const [redelegateTargetValidatorInput, setRedelegateTargetValidatorInput] = useState('');
  const [redelegateAmountInput, setRedelegateAmountInput] = useState('');
  const currencyName = getActiveEvmCurrencyNameClient();

  function goToLogin() {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/evm/address/${address}`)}`);
  }

  useEffect(() => {
    if (!isValid || !isQuarixEvmChainId(contractEnvironment?.chainId)) {
      setDelegationsSnapshot(EMPTY_DELEGATIONS_SNAPSHOT);
      setQuarixBalances([]);
      setDelegationsLoading(false);
      setDelegationsError(null);
      return;
    }

    let cancelled = false;

    async function loadDelegations() {
      setDelegationsLoading(true);

      try {
        const profile = readActiveRpcProfileCookie('evm');

        if (!profile) {
          throw new Error('No active EVM provider selected.');
        }

        const client = createEvmClient(profile.rpcUrl);
        const [nextSnapshot, nextBalances] = await Promise.all([
          getQuarixDelegationsSnapshot(address, locale),
          client.readContract({
            address: EVM_BANK_PRECOMPILE_ADDRESS,
            abi: EVM_BANK_ALL_BALANCES_ABI,
            functionName: 'allBalances',
            args: [address as `0x${string}`],
          }) as Promise<EvmBankBalanceItem[]>,
        ]);

        if (!cancelled) {
          setDelegationsSnapshot(nextSnapshot);
          setQuarixBalances(nextBalances);
          setDelegationsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setDelegationsSnapshot(EMPTY_DELEGATIONS_SNAPSHOT);
          setQuarixBalances([]);
          setDelegationsError(error instanceof Error ? error.message : accountMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setDelegationsLoading(false);
        }
      }
    }

    void loadDelegations();
    window.addEventListener('chaindev:active-rpc-profile-changed', loadDelegations);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', loadDelegations);
    };
  }, [address, isValid, contractEnvironment?.chainId, accountMessages.failedToLoadFallback, locale, delegationsRefreshVersion]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function loadAddressCache() {
      const nextSnapshot = await getEvmAddressCacheSnapshot(address, transactionPage, VISIBLE_TRANSACTIONS);

      if (!cancelled) {
        setAddressCacheSnapshot(nextSnapshot);
      }
    }

    void loadAddressCache();

    const unsubscribe = subscribeEvmTransactionCache(() => {
      void loadAddressCache();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [address, isValid, transactionPage]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    function loadTag() {
      const nextTag = getEvmAddressTag(address);
      setNameTag(nextTag);
      setTagInput(nextTag ?? '');
    }

    loadTag();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadTag();
    });

    const handleProfileChanged = () => {
      loadTag();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isValid]);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    const unsubscribe = subscribeEvmKeyring(() => {
      loadActiveKey();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmAddressSummaryDirect(address);

        if (!cancelled) {
          setSummary(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setErrorMessage(error instanceof Error ? error.message : accountMessages.failedToLoadFallback);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [address, isValid]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function loadContractBinding() {
      const nextEnvironment = await getActiveEvmContractEnvironmentDirect();

      if (cancelled) {
        return;
      }

      const nextBinding =
        listEvmContractBindingsByScope(nextEnvironment.chainId, nextEnvironment.providerProfileId, nextEnvironment.providerName).find(
          (binding) => binding.addressLower === address.toLowerCase(),
        ) ?? null;

      setContractEnvironment(nextEnvironment);
      setArtifacts(listEvmContractArtifacts());
      setContractBinding(nextBinding);
      setContractArtifact(nextBinding ? getEvmContractArtifact(nextBinding.artifactId) : null);
    }

    void loadContractBinding();

    const unsubscribe = subscribeEvmContractRegistry(() => {
      void loadContractBinding();
    });

    const handleProfileChanged = () => {
      void loadContractBinding();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isValid]);

  const normalizedAddress = address.toLowerCase();
  const visibleTransactions = addressCacheSnapshot.transactions;
  const latestSeenTransaction = addressCacheSnapshot.latestSeenTransaction;
  const firstSeenTransaction = addressCacheSnapshot.firstSeenTransaction;
  const inboundCount = addressCacheSnapshot.inboundCount;
  const outboundCount = addressCacheSnapshot.outboundCount;
  const selfCount = addressCacheSnapshot.selfCount;
  const isQuarixChain = isQuarixEvmChainId(contractEnvironment?.chainId);
  const redelegateValidatorOptions = useMemo(() => {
    const currentValidator = delegationActionTarget?.validatorAddress?.toLowerCase() ?? null;

    return delegationsSnapshot.response.validators
      .map((validator) => {
        const value = normalizeStringValue(validator.operatorAddress);

        if (!value || value.toLowerCase() === currentValidator) {
          return null;
        }

        return {
          value,
          label: normalizeStringValue(validator.description?.moniker) ?? value,
        };
      })
      .filter((item): item is { value: string; label: string } => Boolean(item))
      .filter((item, index, array) => array.findIndex((entry) => entry.value.toLowerCase() === item.value.toLowerCase()) === index);
  }, [delegationActionTarget?.validatorAddress, delegationsSnapshot.response.validators]);
  const resolvedActiveTab =
    requestedTab === 'contract' && contractBinding && contractArtifact && contractEnvironment
      ? 'contract'
      : requestedTab === 'quarix' && isQuarixChain
        ? 'quarix'
      : 'transactions';
  const initialContractTab: ContractSubview = requestedContractTab === 'code' || requestedContractTab === 'write' ? requestedContractTab : 'read';
  const visibleAddresses = useMemo(
    () => [...new Set(visibleTransactions.flatMap((transaction) => [transaction.from, ...(transaction.interactedWith ? [transaction.interactedWith] : transaction.to ? [transaction.to] : [])]))],
    [visibleTransactions],
  );
  const decodedMethodLabelByHash = useMemo(() => {
    void contractBinding;
    void contractArtifact;
    void contractEnvironment;

    return Object.fromEntries(
      visibleTransactions.map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [visibleTransactions, contractBinding, contractArtifact, contractEnvironment]);

  useEffect(() => {
    const hashesNeedingInputData = visibleTransactions.filter((transaction) => transaction.to && !transaction.inputData).map((transaction) => transaction.hash);

    if (!hashesNeedingInputData.length) {
      return;
    }

    void hydrateEvmCachedTransactionInputsByHashDirect(hashesNeedingInputData);
  }, [visibleTransactions]);

  useEffect(() => {
    function loadVisibleTags() {
      setNameTagsByAddress(getEvmAddressTags(visibleAddresses));
    }

    loadVisibleTags();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadVisibleTags();
    });

    const handleProfileChanged = () => {
      loadVisibleTags();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [visibleAddresses]);

  async function handleSaveTag() {
    try {
      if (tagInput.trim()) {
        await upsertEvmAddressTag(address, tagInput);
      } else {
        await deleteEvmAddressTag(address);
      }

      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  async function handleRemoveTag() {
    try {
      await deleteEvmAddressTag(address);
      setTagInput('');
      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  function openTagDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setTagInput(nameTag ?? '');
    setTagDialogOpen(true);
  }

  function openBindingDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    const defaultArtifact = (contractBinding ? getEvmContractArtifact(contractBinding.artifactId) : contractArtifact) ?? artifacts[0] ?? null;

    setBindingError(null);
    setBindingArtifactId(defaultArtifact?.id ?? '');
    setBindingLabelInput(contractBinding?.label ?? defaultArtifact?.name ?? '');
    setBindingDialogOpen(true);
  }

  function handleBindingArtifactChange(nextArtifactId: string) {
    setBindingArtifactId(nextArtifactId);
    setBindingLabelInput(artifacts.find((artifact) => artifact.id === nextArtifactId)?.name ?? '');
  }

  async function handleSaveBinding() {
    if (!contractEnvironment) {
      setBindingError(translateRuntimeText('Current provider environment is unavailable.', locale));
      return;
    }

    const selectedArtifactId = bindingArtifactId.trim();

    if (!selectedArtifactId) {
      setBindingError(translateRuntimeText('Select a saved artifact first.', locale));
      return;
    }

    try {
      const payload = {
        artifactId: selectedArtifactId,
        address,
        label: bindingLabelInput,
        chainId: contractEnvironment.chainId,
        providerProfileId: contractEnvironment.providerProfileId,
        providerName: contractEnvironment.providerName,
      };

      if (contractBinding) {
        await updateEvmContractBinding(contractBinding.id, payload);
      } else {
        await createEvmContractBinding(payload);
      }

      setBindingDialogOpen(false);
      setBindingError(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setBindingError(error instanceof Error ? error.message : messages.contractRegistry.failedToSaveContractBinding);
    }
  }

  function navigateToTab(nextTab: AddressPageTab) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextTab === 'transactions') {
      nextParams.delete('tab');
      nextParams.delete('contractTab');
    } else if (nextTab === 'quarix') {
      nextParams.set('tab', nextTab);
      nextParams.delete('contractTab');
      nextParams.delete('page');
    } else {
      nextParams.set('tab', nextTab);

      if (!nextParams.get('contractTab')) {
        nextParams.set('contractTab', 'read');
      }
    }

    const query = nextParams.toString();
    router.replace(query ? `/evm/address/${address}?${query}` : `/evm/address/${address}`, {
      scroll: false,
    });
  }

  function openDelegationAction(kind: QuarixDelegationActionKind, item: EvmDelegationItem) {
    if (!item.validatorAddress) {
      return;
    }

    setDelegationActionKind(kind);
    setDelegationActionTarget({
      validatorAddress: item.validatorAddress,
      validatorMoniker: item.validatorMoniker,
    });
    setDelegationActionError(null);
    setUndelegateAmountInput('');
    setRedelegateTargetValidatorInput('');
    setRedelegateAmountInput('');
    unlockDialog.setErrorMessage(null);
  }

  function closeDelegationAction() {
    setDelegationActionKind(null);
    setDelegationActionTarget(null);
    setDelegationActionError(null);
    setUndelegateAmountInput('');
    setRedelegateTargetValidatorInput('');
    setRedelegateAmountInput('');
  }

  async function submitDelegationAction(password?: string) {
    if (!activeKey) {
      setDelegationActionError(messages.quarixEvmValidators.noActiveKey);
      return;
    }

    if (!delegationActionKind || !delegationActionTarget) {
      return;
    }

    setDelegationActionSubmitting(true);
    setDelegationActionError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);

      unlockDialog.handleUnlockResolved();

      if (delegationActionKind === 'withdrawRewards') {
        const validatorAddress = toQuarixValidatorAddress(delegationActionTarget.validatorAddress);

        if (!validatorAddress) {
          throw new Error(messages.quarixEvmValidators.invalidValidatorAddress);
        }

        await writeEvmContractMethodDirect({
          address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_DISTRIBUTION_WITHDRAW_DELEGATOR_REWARDS_ABI),
          functionSignature: 'withdrawDelegatorRewards(address,string)',
          rawArgs: [activeKey.address, validatorAddress],
          privateKey,
          value: '0',
        });

        showToast({
          title: messages.quarixEvmValidators.withdrawBroadcasted,
          description: delegationActionTarget.validatorAddress,
        });
      } else if (delegationActionKind === 'undelegate') {
        const scaledAmount = scaleToIntegerByPowerOfTen(undelegateAmountInput, 18);
        const validatorAddress = toQuarixValidatorAddress(delegationActionTarget.validatorAddress);

        if (!scaledAmount || !/^\d+$/.test(scaledAmount)) {
          throw new Error(messages.quarixEvmValidators.invalidAmount);
        }

        if (!validatorAddress) {
          throw new Error(messages.quarixEvmValidators.invalidValidatorAddress);
        }

        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_UNDELEGATE_ABI),
          functionSignature: 'undelegate(address,string,uint256)',
          rawArgs: [activeKey.address, validatorAddress, scaledAmount],
          privateKey,
          value: '0',
        });

        showToast({
          title: accountMessages.undelegateBroadcasted,
          description: delegationActionTarget.validatorAddress,
        });
      } else {
        const scaledAmount = scaleToIntegerByPowerOfTen(redelegateAmountInput, 18);
        const sourceValidator = toQuarixValidatorAddress(delegationActionTarget.validatorAddress);
        const destinationValidator = toQuarixValidatorAddress(redelegateTargetValidatorInput.trim());

        if (!destinationValidator) {
          throw new Error(messages.quarixEvmValidators.invalidValidatorAddress);
        }

        if (!sourceValidator) {
          throw new Error(messages.quarixEvmValidators.invalidValidatorAddress);
        }

        if (!scaledAmount || !/^\d+$/.test(scaledAmount)) {
          throw new Error(messages.quarixEvmValidators.invalidAmount);
        }

        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_REDELEGATE_ABI),
          functionSignature: 'redelegate(address,string,string,uint256)',
          rawArgs: [activeKey.address, sourceValidator, destinationValidator, scaledAmount],
          privateKey,
          value: '0',
        });

        showToast({
          title: accountMessages.redelegateBroadcasted,
          description: `${delegationActionTarget.validatorAddress} -> ${destinationValidator}`,
        });
      }

      closeDelegationAction();
      setDelegationsRefreshVersion((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : delegationActionKind === 'withdrawRewards'
            ? messages.quarixEvmValidators.failedToBroadcastWithdrawal
            : delegationActionKind === 'redelegate'
              ? accountMessages.failedToBroadcastRedelegate
              : accountMessages.failedToBroadcastUndelegate;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setDelegationActionError(message);
      }
    } finally {
      if (password) {
        closeDelegationAction();
      }
      setDelegationActionSubmitting(false);
    }
  }

  function handleTransactionPageChange(nextPage: number) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(nextPage));
    }

    const query = nextParams.toString();
    router.replace(query ? `/evm/address/${address}?${query}` : `/evm/address/${address}`, {
      scroll: false,
    });
  }

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{accountMessages.invalidAccountAddressTitle}</h1>
          <p>{accountMessages.invalidAccountAddressDescription}</p>
        </main>
      </AppShell>
    );
  }

  if (!summary) {
    if (!errorMessage) {
      return (
        <AppShell>
          <AddressPageSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>{accountMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.navigation.address}</h1>
            <span className="text-sm font-medium text-slate-500 mono">{summary.address}</span>
            <ActionIconButton tooltip={nameTag ? accountMessages.editTag : accountMessages.addTag} className="text-slate-400 hover:text-sky-600" onClick={openTagDialog}>
              <IconTag className="size-4" stroke={1.8} />
            </ActionIconButton>
            <ActionIconButton tooltip={contractBinding ? contractMessages.editBindingTitle : contractMessages.bindContractAddress} className="text-slate-400 hover:text-sky-600" onClick={openBindingDialog}>
              <IconBinaryTree2 className="size-4" stroke={1.8} />
            </ActionIconButton>
            {nameTag ? <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{nameTag}</span> : null}
          </div>
        </div>

        <section>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r">
                <AddressMetric label={`${currencyName} Balance`} value={formatBalanceLabel(summary.balance, currencyName)} />
              </div>
              <div className="border-b border-slate-200 p-5 xl:border-r">
                <AddressMetric label={messages.common.nonce} value={summary.nonce.toLocaleString(locale)} />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.latestSeen}
                  value={
                    latestSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={latestSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      messages.common.notCachedYet
                    )
                  }
                  tooltip={latestSeenTransaction ? messages.common.latestSeenTooltip : messages.common.populateLocalCache}
                />
              </div>
              <div className="border-b border-slate-200 p-5">
                <AddressMetric
                  label={messages.common.firstSeen}
                  value={
                    firstSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={firstSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      messages.common.notCachedYet
                    )
                  }
                  tooltip={messages.common.firstSeenTooltip}
                />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.observedTransactions}
                  value={addressCacheSnapshot.totalTransactions.toLocaleString(locale)}
                  tooltip={messages.common.latestCachedRecords.replace('{count}', String(visibleTransactions.length))}
                />
              </div>
              <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
                <AddressMetric
                  label={messages.common.directions}
                  value={translateRuntimeText(`${inboundCount} ${messages.common.in} / ${outboundCount} ${messages.common.out} / ${selfCount} ${messages.common.self}`, locale)}
                />
              </div>
              <div className="p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.cachedTransactionsLabel}
                  value={addressCacheSnapshot.totalTransactions.toLocaleString(locale)}
                  tooltip={messages.common.cacheCapDescription.replace('{count}', MAX_CACHED_EVM_TRANSACTIONS.toLocaleString(locale))}
                />
              </div>
              <div className="p-5">
                <AddressMetric
                  label={messages.common.addressCoverage}
                  value={
                    addressCacheSnapshot.totalTransactions
                      ? translateRuntimeText(`${addressCacheSnapshot.totalTransactions} ${messages.common.matched}`, locale)
                      : messages.common.noCachedMatches
                  }
                  tooltip={messages.common.recentBlockQueriesCached}
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'transactions' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => navigateToTab('transactions')}
          >
            {messages.labels.transactions}
          </button>
          {isQuarixChain ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'quarix' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              onClick={() => navigateToTab('quarix')}
            >
              {accountMessages.quarix}
            </button>
          ) : null}
          {contractBinding && contractArtifact && contractEnvironment ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'contract' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              onClick={() => navigateToTab('contract')}
            >
              {txMessages.contract}
            </button>
          ) : null}
        </div>

        {resolvedActiveTab === 'transactions' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {messages.common.cachedTransactionsSummary
                    .replace('{visible}', String(visibleTransactions.length))
                    .replace('{total}', addressCacheSnapshot.totalTransactions.toLocaleString(locale))}
                </p>
                <p className="mt-1 text-sm text-slate-500">{messages.evmTxDetail.derivedFromCachedParticipants}</p>
              </div>
              <PaginationControls
                page={addressCacheSnapshot.page}
                totalPages={addressCacheSnapshot.totalPages}
                hasPreviousPage={addressCacheSnapshot.hasPreviousPage}
                hasNextPage={addressCacheSnapshot.hasNextPage}
                plain
                onPageChange={handleTransactionPageChange}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 pl-5 pr-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.hash}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.method}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.block}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.age}</th>
                    <th className="w-[44px] border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.direction}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.from}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.to}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.amount}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.txnFee}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.length ? (
                    visibleTransactions.map((transaction) => {
                      const direction = getDirection(transaction, normalizedAddress);
                      const decodedMethodLabel = decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel;

                      return (
                        <tr key={transaction.hash} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <TransactionPreviewButton transaction={transaction} methodLabel={decodedMethodLabel} />
                              <TransactionHashCell {...transaction} />
                            </div>
                          </td>
                          <td className="px-1 py-3 text-sm">
                            <TransactionMethodBadge methodLabel={decodedMethodLabel} />
                          </td>
                          <td className="px-1 py-3 text-sm tabular-nums">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                          </td>
                          <td className="px-1 py-3 text-sm text-slate-700">
                            <RelativeTime timestampMs={transaction.timestampMs} />
                          </td>
                          <td className="w-[44px] px-1 py-3 text-sm">
                            <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-1 text-xs font-semibold ${direction.className}`}>
                              {direction.label === 'in' ? messages.common.in : direction.label === 'out' ? messages.common.out : messages.common.self}
                            </span>
                          </td>
                          <td className="px-1 py-3 text-sm">
                            <AddressLink
                              address={transaction.from}
                              href={`/evm/address/${transaction.from}`}
                              label={resolvePreferredAddressLabel(transaction.from, {
                                nameTagsByAddress,
                                fallbackLabel: transaction.from.toLowerCase() === normalizedAddress ? formatAddressLabel(transaction.from) : transaction.fromLabel,
                              })}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          </td>
                          <td className="px-1 py-3 text-sm">
                            {transaction.interactedWith ? (
                              <AddressLink
                                address={transaction.interactedWith}
                                href={`/evm/address/${transaction.interactedWith}`}
                                label={resolvePreferredToAddressLabel(transaction.interactedWith, {
                                  nameTagsByAddress,
                                  fallbackLabel: transaction.interactedWithLabel ?? transaction.toLabel,
                                })}
                                className="font-medium text-sky-600 hover:text-sky-700"
                              />
                            ) : (
                              <span className="text-slate-500">{txMessages.contractCreation}</span>
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm font-medium tabular-nums text-slate-900">{translateRuntimeText(transaction.amountLabel, locale)}</td>
                          <td className="px-1 py-3 text-sm tabular-nums text-slate-500">
                            {transaction.feeLabel ? translateRuntimeText(transaction.feeLabel, locale) : <span className="text-slate-400">--</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-1 py-10 text-center text-sm text-slate-500">
                        {txMessages.noCachedTransactionsAvailableYet}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : resolvedActiveTab === 'quarix' ? (
          <div className="mt-4 space-y-4">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-sm text-slate-500">{accountMessages.balancesDescription}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 pl-5 pr-1 py-3 text-left text-[13px] font-semibold text-slate-800">{accountMessages.denom}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{accountMessages.rawAmount}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{accountMessages.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegationsLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <tr key={`balance-skeleton-${index}`} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-5 py-3"><Skeleton className="ml-auto h-4 w-40" /></td>
                          <td className="px-5 py-3"><Skeleton className="ml-auto h-4 w-40" /></td>
                        </tr>
                      ))
                    ) : quarixBalances.length ? (
                      quarixBalances.map((item, index) => (
                        <tr key={`${item.denom}-${index}`} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3 text-sm text-slate-700">{formatReadableDenom(item.denom)}</td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-500">{formatBankBalanceRawAmount(item)}</td>
                          <td className="px-5 py-3 text-right text-sm font-medium tabular-nums text-slate-900">{formatBankBalanceItem(item)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                          {accountMessages.noBalancesReturned}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{messages.quarixEvmValidators.delegationsDescription}</p>
                </div>
                <div className="flex items-center gap-0 lg:justify-end">
                  <ActionIconButton
                    tooltip={showDelegationsRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
                    className={
                      showDelegationsRawJson
                        ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                        : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                    }
                    onClick={() => setShowDelegationsRawJson((current) => !current)}
                  >
                    <IconCode className="size-4" stroke={1.8} />
                  </ActionIconButton>
                  <ActionIconButton
                    tooltip={messages.common.refresh}
                    className={delegationsLoading ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                    onClick={() => setDelegationsRefreshVersion((current) => current + 1)}
                  >
                    <IconRefresh className="size-4" stroke={1.8} />
                  </ActionIconButton>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 pl-5 pr-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.quarixEvmValidators.validator}</th>
                      <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.quarixEvmValidators.operatorAddress}</th>
                      <th className="border-b border-slate-200 px-1 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.quarixEvmValidators.amount}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.quarixEvmValidators.outstandingRewards}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delegationsLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <tr key={`delegation-skeleton-${index}`} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3"><Skeleton className="h-4 w-40" /></td>
                          <td className="px-1 py-3"><Skeleton className="h-4 w-72" /></td>
                          <td className="px-1 py-3"><Skeleton className="ml-auto h-4 w-32" /></td>
                          <td className="px-5 py-3"><Skeleton className="ml-auto h-4 w-32" /></td>
                          <td className="px-5 py-3"><Skeleton className="ml-auto h-4 w-44" /></td>
                        </tr>
                      ))
                    ) : delegationsError ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-rose-600">
                          {translateRuntimeText(delegationsError, locale)}
                        </td>
                      </tr>
                    ) : delegationsSnapshot.items.length ? (
                      delegationsSnapshot.items.map((item, index) => (
                        <tr key={`${item.delegatorAddress ?? 'delegator'}-${item.validatorAddress ?? 'validator'}-${index}`} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3 text-sm">
                            {item.validatorAddress ? (
                              <Link className="block truncate font-medium text-sky-600 hover:text-sky-700" href={`/evm/quarix/validator/${encodeURIComponent(item.validatorAddress)}`}>
                                {item.validatorMoniker ?? item.validatorAddress}
                              </Link>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm mono">
                            {item.validatorAddress ? (
                              <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/quarix/validator/${encodeURIComponent(item.validatorAddress)}`}>
                                {item.validatorAddress}
                              </Link>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="px-1 py-3 text-right text-sm font-medium tabular-nums text-slate-900">
                            {formatDelegationAmountLabel(item.balance, locale)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-500">{item.rewardLabel}</td>
                          <td className="px-5 py-3 text-right text-sm">
                            <div className="flex justify-end gap-0">
                              <ActionIconButton tooltip={accountMessages.claimRewards} className="text-slate-400 hover:text-sky-600" onClick={() => openDelegationAction('withdrawRewards', item)}>
                                <IconCoins className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton tooltip={accountMessages.undelegate} className="text-slate-400 hover:text-sky-600" onClick={() => openDelegationAction('undelegate', item)}>
                                <IconArrowBackUp className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton tooltip={accountMessages.redelegate} className="text-slate-400 hover:text-sky-600" onClick={() => openDelegationAction('redelegate', item)}>
                                <IconArrowsExchange className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                          {messages.quarixEvmValidators.emptyValidatorsLabel}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {showDelegationsRawJson ? (
                <div className="border-t border-slate-200 px-5 py-4">
                  <JsonViewPanel value={{ balances: quarixBalances, ...delegationsSnapshot.response } as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <section className="mt-4">
            {contractBinding && contractArtifact && contractEnvironment ? (
              <AddressContractPanel binding={contractBinding} artifact={contractArtifact} environment={contractEnvironment} initialTab={initialContractTab} />
            ) : null}
          </section>
        )}

        <ModalDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          title={nameTag ? nameTagMessages.editTooltip : accountMessages.addTag}
          description={`${nameTagMessages.setLabelForAddress} ${address}.`}
          footer={
            <>
              {nameTag ? (
                <Button type="button" variant="outline" onClick={handleRemoveTag}>
                  {nameTagMessages.remove}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={handleSaveTag}>
                {nameTagMessages.save}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <label className="grid gap-2 pb-1">
            <span className="text-sm font-medium text-slate-700">{messages.labels.tag}</span>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder={nameTagMessages.nameTagPlaceholder} />
          </label>
        </ModalDialog>

        <ModalDialog
          open={delegationActionKind === 'withdrawRewards'}
          onOpenChange={(open) => {
            if (!open) {
              closeDelegationAction();
            }
          }}
          title={accountMessages.claimRewards}
          description={
            delegationActionTarget
              ? accountMessages.confirmClaimRewardsDescription.replace('{validator}', delegationActionTarget.validatorAddress)
              : accountMessages.claimRewards
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeDelegationAction}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void submitDelegationAction()} disabled={delegationActionSubmitting}>
                {accountMessages.confirm}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          {delegationActionError ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(delegationActionError, locale)}</p> : null}
        </ModalDialog>

        <ModalDialog
          open={delegationActionKind === 'undelegate'}
          onOpenChange={(open) => {
            if (!open) {
              closeDelegationAction();
            }
          }}
          title={accountMessages.undelegate}
          description={
            delegationActionTarget
              ? accountMessages.confirmUndelegateDescription.replace('{validator}', delegationActionTarget.validatorAddress)
              : accountMessages.undelegateDescription
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeDelegationAction}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void submitDelegationAction()} disabled={!undelegateAmountInput.trim() || delegationActionSubmitting}>
                {accountMessages.confirm}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.quarixEvmValidators.amount}</span>
              <Input value={undelegateAmountInput} onChange={(event) => setUndelegateAmountInput(event.target.value)} placeholder="1" />
            </label>
            {delegationActionError ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(delegationActionError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={delegationActionKind === 'redelegate'}
          onOpenChange={(open) => {
            if (!open) {
              closeDelegationAction();
            }
          }}
          title={accountMessages.redelegate}
          description={
            delegationActionTarget
              ? accountMessages.confirmRedelegateDescription.replace('{validator}', delegationActionTarget.validatorAddress)
              : accountMessages.redelegate
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeDelegationAction}>
                {messages.common.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void submitDelegationAction()}
                disabled={!redelegateTargetValidatorInput.trim() || !redelegateAmountInput.trim() || delegationActionSubmitting}
              >
                {accountMessages.confirm}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{accountMessages.targetValidatorAddress}</span>
              <Select value={redelegateTargetValidatorInput} onValueChange={setRedelegateTargetValidatorInput}>
                <SelectTrigger>
                  <SelectValue placeholder={accountMessages.selectValidator} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {redelegateValidatorOptions.length ? (
                    redelegateValidatorOptions.map((validator) => (
                      <SelectItem key={validator.value} value={validator.value}>
                        {validator.label}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">{accountMessages.noRedelegateValidators}</div>
                  )}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.quarixEvmValidators.amount}</span>
              <Input value={redelegateAmountInput} onChange={(event) => setRedelegateAmountInput(event.target.value)} placeholder="1" />
            </label>
            {delegationActionError ? <p className="overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(delegationActionError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={bindingDialogOpen}
          onOpenChange={(open) => {
            setBindingDialogOpen(open);
            if (!open) {
              setBindingError(null);
            }
          }}
          title={contractBinding ? contractMessages.editBindingTitle : contractMessages.bindContractAddressTitle}
          description={contractMessages.description}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setBindingDialogOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSaveBinding()} disabled={!artifacts.length}>
                {contractMessages.saveBinding}
              </Button>
            </>
          }
          maxWidthClassName="max-w-xl"
        >
          <div className="grid gap-4 pb-1">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.navigation.registry}</span>
              <Select value={bindingArtifactId} onValueChange={handleBindingArtifactChange} disabled={!artifacts.length}>
                <SelectTrigger>
                  <SelectValue placeholder={artifacts.length ? messages.navigation.registry : contractMessages.noPersonalArtifacts} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {artifacts.map((artifact) => (
                    <SelectItem key={artifact.id} value={artifact.id}>
                      {artifact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.labels.tag}</span>
              <Input value={bindingLabelInput} onChange={(event) => setBindingLabelInput(event.target.value)} placeholder={contractMessages.bindingLabelPlaceholder} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.labels.address}</span>
              <Input value={address} readOnly className="bg-slate-50 text-slate-500" />
            </label>

            {bindingError ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(bindingError, locale)}</div> : null}
            {!artifacts.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                {contractMessages.noPersonalArtifacts}
              </div>
            ) : null}
          </div>
        </ModalDialog>

        <EvmPrivateKeyUnlockDialog
          open={unlockDialog.open}
          password={unlockDialog.password}
          errorMessage={unlockDialog.errorMessage}
          submitting={delegationActionSubmitting}
          title={messages.quarixEvmValidators.unlockPrivateKey}
          description={activeKey ? messages.quarixEvmValidators.unlockWithdrawalDescription.replace('{name}', activeKey.name) : messages.quarixEvmValidators.unlockFallbackDescription}
          placeholder={messages.quarixEvmValidators.password}
          confirmLabel={messages.quarixEvmValidators.unlock}
          onOpenChange={(open) => {
            if (!open) {
              unlockDialog.closeDialog();
            }
          }}
          onPasswordChange={unlockDialog.setPassword}
          onConfirm={() => void submitDelegationAction(unlockDialog.password)}
        />
      </main>
    </AppShell>
  );
}
