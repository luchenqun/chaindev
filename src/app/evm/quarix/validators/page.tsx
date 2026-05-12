'use client';

import { fromBech32, toBech32, toHex } from '@cosmjs/encoding';
import { IconCode, IconCoins, IconPencil, IconPlus, IconRefresh, IconX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { hexToBytes, type Abi, isAddress } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { buildPageHref, parsePageParam } from '@/domains/cosmos/ui/page-query';
import { writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { CosmosAddressLink } from '@/domains/cosmos/ui/address-link';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { EVM_STAKING_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import { formatLocalizedNumber } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';
import { EVM_SYSTEM_ARTIFACTS } from '@/server/system/artifacts/evm-system-artifacts';

type PageRequest = {
  key: `0x${string}`;
  offset: bigint;
  limit: bigint;
  countTotal: boolean;
  reverse: boolean;
};

type EvmStakingPageResponse = {
  nextKey?: `0x${string}` | string;
  total?: bigint | number | string;
};

type EvmStakingValidatorDescription = {
  moniker?: string;
  identity?: string;
  website?: string;
  securityContact?: string;
  details?: string;
};

type EvmStakingValidator = {
  operatorAddress?: string;
  consensusPubkey?: string;
  jailed?: boolean;
  status?: number | string | bigint;
  tokens?: bigint | number | string;
  delegatorShares?: bigint | number | string;
  description?: EvmStakingValidatorDescription;
  unbondingHeight?: bigint | number | string;
  unbondingTime?: bigint | number | string;
  commission?: bigint | number | string;
  minSelfDelegation?: bigint | number | string;
};

type EvmStakingInvestmentProgramPool = {
  id?: bigint | number | string;
  name?: string;
  details?: string;
  royaltyFee?: {
    value?: bigint | number | string;
    precision?: bigint | number | string;
  };
  votingWeight?: {
    value?: bigint | number | string;
    precision?: bigint | number | string;
  };
  maxStaking?: bigint | number | string;
  currentStaking?: bigint | number | string;
};

type EvmStakingAllocatedInvestmentProgramPool = {
  validatorAddress?: string;
  ippId?: bigint | number | string;
};

type QuarixEvmValidatorItem = {
  operatorAddress: string;
  moniker: string;
  jailed: boolean;
  statusLabel: string;
  totalStakingLabel: string;
  weightLabel: string;
  commissionLabel: string;
  raw: EvmStakingValidator;
};

type QuarixEvmValidatorFormInput = {
  moniker: string;
  identity: string;
  website: string;
  securityContact: string;
  details: string;
  validatorAddress: string;
  commissionRate: string;
  maxCommissionRate: string;
  maxCommissionChangeRate: string;
  minSelfDelegation: string;
  pubkey: string;
  amount: string;
};

type QuarixEvmInvestmentProgramPoolItem = {
  id: string;
  idLabel: string;
  nameLabel: string;
  detailsLabel: string;
  royaltyFeeLabel: string;
  votingWeightLabel: string;
  maxStakingLabel: string;
  currentStakingLabel: string;
  rawRoyaltyFeeInput: string;
  rawVotingWeightInput: string;
  rawMaxStakingInput: string;
  raw: EvmStakingInvestmentProgramPool;
};

type QuarixEvmAllocatedInvestmentProgramPoolItem = {
  validatorAddress: string | null;
  validatorMoniker: string | null;
  ippIdLabel: string;
  investmentProgramPoolName: string | null;
  raw: EvmStakingAllocatedInvestmentProgramPool;
};

type QuarixEvmValidatorsState = {
  validators: QuarixEvmValidatorItem[];
  response: {
    validators: EvmStakingValidator[];
    pagination?: {
      total?: string;
    };
  };
  page: number;
  pageSize: number;
  totalValidators: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  bondedTokenTotal: bigint;
};

type QuarixEvmInvestmentProgramPoolsState = {
  items: QuarixEvmInvestmentProgramPoolItem[];
  response: {
    investmentProgramPools: EvmStakingInvestmentProgramPool[];
    pagination?: {
      total?: string;
    };
  };
};

type QuarixEvmAllocatedInvestmentProgramPoolsState = {
  items: QuarixEvmAllocatedInvestmentProgramPoolItem[];
  response: {
    allocateInvestmentProgramPools: EvmStakingAllocatedInvestmentProgramPool[];
    pagination?: {
      total?: string;
    };
  };
};

const PAGE_SIZE = 15;
const EVM_STAKING_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmStaking')?.abi ?? []) as Abi;
const EVM_STAKING_PRECOMPILE_ADDRESS = EVM_STAKING_ADDRESS as `0x${string}`;

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function normalizeStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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

function normalizeBigintLike(value: unknown) {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  return 0n;
}

function formatValidatorStatus(value: unknown) {
  const normalized = typeof value === 'bigint' ? Number(value) : typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : NaN;

  if (normalized === 1) {
    return 'unbonded';
  }

  if (normalized === 2) {
    return 'unbonding';
  }

  if (normalized === 3) {
    return 'bonded';
  }

  return 'unknown';
}

function formatScaled18Label(value: unknown, locale: string) {
  const normalized = normalizeBigintLike(value);
  const divisor = 10n ** 18n;
  const whole = normalized / divisor;
  const fraction = normalized % divisor;
  const fractionTwoDigits = Number((fraction * 100n) / divisor);
  return `${formatLocalizedNumber(whole, locale)}.${String(fractionTwoDigits).padStart(2, '0')}`;
}

function formatScaled18PercentLabel(value: unknown, locale: string) {
  const normalized = normalizeBigintLike(value);
  const scaledPercent = normalized * 100n;
  const divisor = 10n ** 18n;
  const whole = scaledPercent / divisor;
  const fraction = scaledPercent % divisor;
  const fractionTwoDigits = Number((fraction * 100n) / divisor);
  return `${formatLocalizedNumber(whole, locale)}.${String(fractionTwoDigits).padStart(2, '0')}%`;
}

function scalePercentToInteger(rawValue: string) {
  return scaleToIntegerByPowerOfTen(rawValue, 18);
}

function formatValidatorWeightLabel(value: unknown, bondedTokenTotal: bigint, locale: string) {
  const normalized = normalizeBigintLike(value);

  if (bondedTokenTotal <= 0n || normalized <= 0n) {
    return '0.00%';
  }

  return formatScaled18PercentLabel((normalized * (10n ** 18n)) / bondedTokenTotal, locale);
}

function formatDecimalByPrecision(value: unknown, precision: unknown, locale: string, fractionDigits = 2) {
  const normalized = normalizeBigintLike(value);
  const normalizedPrecision = Number(normalizeBigintLike(precision));

  if (!Number.isFinite(normalizedPrecision) || normalizedPrecision < 0) {
    return formatLocalizedNumber(normalized, locale);
  }

  const divisor = 10n ** BigInt(normalizedPrecision);
  const whole = normalized / divisor;
  const fraction = normalized % divisor;
  const fractionScale = fractionDigits > 0 ? 10n ** BigInt(fractionDigits) : 0n;
  const scaled = fractionDigits > 0 ? Number((fraction * fractionScale) / divisor) : 0;

  if (fractionDigits === 0) {
    return formatLocalizedNumber(whole, locale);
  }

  return `${formatLocalizedNumber(whole, locale)}.${String(scaled).padStart(fractionDigits, '0')}`;
}

function formatPlainDecimalByPrecision(value: unknown, precision: unknown, fractionDigits = 18) {
  const normalized = normalizeBigintLike(value);
  const normalizedPrecision = Number(normalizeBigintLike(precision));

  if (!Number.isFinite(normalizedPrecision) || normalizedPrecision < 0) {
    return String(normalized);
  }

  const divisor = 10n ** BigInt(normalizedPrecision);
  const whole = normalized / divisor;
  const fraction = normalized % divisor;

  if (fractionDigits === 0) {
    return whole.toString();
  }

  const fractionScale = 10n ** BigInt(fractionDigits);
  const scaled = (fraction * fractionScale) / divisor;
  return `${whole.toString()}.${String(scaled).padStart(fractionDigits, '0')}`;
}

function stringifyCellValue(value: unknown) {
  if (value == null || value === '') {
    return '--';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return JSON.stringify(value);
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

function normalizeEvmAddress(input: string) {
  const value = input.trim();
  return isAddress(value) ? value : null;
}

function normalizeValidatorEvmAddress(input: string) {
  const value = input.trim();

  if (isAddress(value)) {
    return value as `0x${string}`;
  }

  try {
    return toHex(fromBech32(value).data) as `0x${string}`;
  } catch {
    return null;
  }
}

function formatScaled18InputValue(value: unknown, locale: string) {
  return formatDecimalByPrecision(value, 18, locale, 18).replace(/\.?0+$/, '');
}

function parsePageTotal(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapValidatorItem(
  item: EvmStakingValidator,
  locale: string,
  bondedTokenTotal: bigint,
  statusLabels: {
    bonded: string;
    unbonding: string;
    unbonded: string;
    unknown: string;
  },
): QuarixEvmValidatorItem | null {
  const operatorAddress = normalizeStringValue(item.operatorAddress);

  if (!operatorAddress) {
    return null;
  }

  const description = item.description ?? {};
  const moniker = normalizeStringValue(description.moniker) ?? operatorAddress;
  const statusKey = formatValidatorStatus(item.status);

  return {
    operatorAddress,
    moniker,
    jailed: Boolean(item.jailed),
    statusLabel:
      statusKey === 'bonded'
        ? statusLabels.bonded
        : statusKey === 'unbonding'
          ? statusLabels.unbonding
          : statusKey === 'unbonded'
            ? statusLabels.unbonded
            : statusLabels.unknown,
    totalStakingLabel: formatScaled18Label(item.tokens, locale),
    weightLabel: formatValidatorWeightLabel(item.tokens, bondedTokenTotal, locale),
    commissionLabel: formatScaled18PercentLabel(item.commission, locale),
    raw: item,
  };
}

function mapInvestmentProgramPoolItem(item: EvmStakingInvestmentProgramPool, locale: string): QuarixEvmInvestmentProgramPoolItem {
  const royaltyFeeValue = normalizeBigintLike(item.royaltyFee?.value);
  const royaltyFeePrecision = normalizeBigintLike(item.royaltyFee?.precision);
  const votingWeightValue = normalizeBigintLike(item.votingWeight?.value);
  const votingWeightPrecision = normalizeBigintLike(item.votingWeight?.precision);
  const maxStakingValue = normalizeBigintLike(item.maxStaking);

  return {
    id: stringifyCellValue(item.id),
    idLabel: stringifyCellValue(item.id),
    nameLabel: normalizeStringValue(item.name) ?? '--',
    detailsLabel: normalizeStringValue(item.details) ?? '--',
    royaltyFeeLabel: `${formatDecimalByPrecision(item.royaltyFee?.value, item.royaltyFee?.precision, locale, 2)}%`,
    votingWeightLabel: formatDecimalByPrecision(item.votingWeight?.value, item.votingWeight?.precision, locale, 2),
    maxStakingLabel: formatScaled18Label(item.maxStaking, locale),
    currentStakingLabel: formatScaled18Label(item.currentStaking, locale),
    rawRoyaltyFeeInput: formatPlainDecimalByPrecision(royaltyFeeValue, royaltyFeePrecision, 18).replace(/\.?0+$/, ''),
    rawVotingWeightInput: formatPlainDecimalByPrecision(votingWeightValue, votingWeightPrecision, 18).replace(/\.?0+$/, ''),
    rawMaxStakingInput: formatPlainDecimalByPrecision(maxStakingValue, 18, 18).replace(/\.?0+$/, ''),
    raw: item,
  };
}

function mapAllocatedInvestmentProgramPoolItem(
  item: EvmStakingAllocatedInvestmentProgramPool,
  validatorMonikerByAddress: Map<string, string>,
  investmentProgramPoolNameById: Map<string, string>,
): QuarixEvmAllocatedInvestmentProgramPoolItem {
  const validatorAddress = normalizeEvmAddress(typeof item.validatorAddress === 'string' ? item.validatorAddress : String(item.validatorAddress ?? ''));
  const ippIdLabel = stringifyCellValue(item.ippId);

  return {
    validatorAddress,
    validatorMoniker: validatorAddress ? (validatorMonikerByAddress.get(validatorAddress) ?? null) : null,
    ippIdLabel,
    investmentProgramPoolName: investmentProgramPoolNameById.get(ippIdLabel) ?? null,
    raw: item,
  };
}

async function requestQuarixEvmValidators(page: number, pageSize: number, locale: string): Promise<QuarixEvmValidatorsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const pageRequest: PageRequest = {
    key: '0x',
    offset: BigInt((page - 1) * pageSize),
    limit: BigInt(pageSize),
    countTotal: true,
    reverse: false,
  };
  const [validators, pageResponse] = (await client.readContract({
    address: EVM_STAKING_PRECOMPILE_ADDRESS,
    abi: EVM_STAKING_ABI,
    functionName: 'validators',
    args: ['', pageRequest],
  })) as readonly [EvmStakingValidator[], EvmStakingPageResponse];
  const bondedTokenTotal = validators.reduce((total, validator) => {
    if (formatValidatorStatus(validator.status) !== 'bonded' || validator.jailed) {
      return total;
    }

    return total + normalizeBigintLike(validator.tokens);
  }, 0n);
  const mappedValidators = validators
    .map((item) =>
      mapValidatorItem(item, locale, bondedTokenTotal, {
        bonded: locale.startsWith('zh') ? '已绑定' : 'Bonded',
        unbonding: locale.startsWith('zh') ? '解绑中' : 'Unbonding',
        unbonded: locale.startsWith('zh') ? '未绑定' : 'Unbonded',
        unknown: locale.startsWith('zh') ? '未知' : 'Unknown',
      }),
    )
    .filter((item): item is QuarixEvmValidatorItem => item != null);
  const totalValidators = parsePageTotal(pageResponse?.total, mappedValidators.length);
  const totalPages = Math.max(1, Math.ceil(Math.max(totalValidators, 1) / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  return {
    validators: mappedValidators,
    response: {
      validators,
      ...(Number.isFinite(totalValidators) ? { pagination: { total: String(totalValidators) } } : {}),
    },
    page: safePage,
    pageSize,
    totalValidators,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    bondedTokenTotal,
  };
}

async function requestQuarixEvmInvestmentProgramPools(locale: string): Promise<QuarixEvmInvestmentProgramPoolsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const pageRequest: PageRequest = {
    key: '0x',
    offset: 0n,
    limit: 500n,
    countTotal: true,
    reverse: false,
  };
  const [items, pageResponse] = (await client.readContract({
    address: EVM_STAKING_PRECOMPILE_ADDRESS,
    abi: EVM_STAKING_ABI,
    functionName: 'investmentProgramPools',
    args: [pageRequest],
  })) as readonly [EvmStakingInvestmentProgramPool[], EvmStakingPageResponse];

  return {
    items: items.map((item) => mapInvestmentProgramPoolItem(item, locale)),
    response: {
      investmentProgramPools: items,
      pagination: {
        total: String(parsePageTotal(pageResponse?.total, items.length)),
      },
    },
  };
}

async function requestQuarixEvmAllocatedInvestmentProgramPools(
  validatorMonikerByAddress: Map<string, string>,
  investmentProgramPoolNameById: Map<string, string>,
): Promise<QuarixEvmAllocatedInvestmentProgramPoolsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const pageRequest: PageRequest = {
    key: '0x',
    offset: 0n,
    limit: 500n,
    countTotal: true,
    reverse: false,
  };
  const [items, pageResponse] = (await client.readContract({
    address: EVM_STAKING_PRECOMPILE_ADDRESS,
    abi: EVM_STAKING_ABI,
    functionName: 'allocateInvestmentProgramPools',
    args: [pageRequest],
  })) as readonly [EvmStakingAllocatedInvestmentProgramPool[], EvmStakingPageResponse];

  return {
    items: items.map((item) => mapAllocatedInvestmentProgramPoolItem(item, validatorMonikerByAddress, investmentProgramPoolNameById)),
    response: {
      allocateInvestmentProgramPools: items,
      pagination: {
        total: String(parsePageTotal(pageResponse?.total, items.length)),
      },
    },
  };
}

function StakingAmountCell({ value }: { value: string }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const hasTooltip = value !== '--';

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
    if (!hasTooltip) {
      return;
    }

    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setTooltipOpen(true);
  }

  function closeTooltipSoon() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setTooltipOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  }

  if (!hasTooltip) {
    return <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{value}</td>;
  }

  return (
    <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex max-w-full items-center align-top text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="block truncate">{value}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{value}</span>
      </FloatingTooltip>
    </td>
  );
}

function PoolValueCell({ value }: { value: string }) {
  return <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{value}</td>;
}

function DelegateDialog({
  validator,
  activeKey,
  open,
  submitting,
  errorMessage,
  unlockDialog,
  onOpenChange,
  onSubmit,
}: {
  validator: QuarixEvmValidatorItem | null;
  activeKey: EvmStoredPrivateKey | null;
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  unlockDialog: ReturnType<typeof useEvmPrivateKeyUnlockDialog>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { amount: string; password?: string }) => Promise<void>;
}) {
  const messages = useMessages();
  const pageMessages = messages.quarixEvmValidators;
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) {
      setAmount('');
    }
  }, [open, validator?.operatorAddress]);

  return (
    <>
      <ModalDialog
        open={open}
        title={pageMessages.delegateTransaction}
        description={pageMessages.delegateDescription}
        maxWidthClassName="max-w-xl"
        onOpenChange={onOpenChange}
        footer={
          <>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={submitting || !validator}
              onClick={() => void onSubmit({ amount })}
            >
              {submitting ? pageMessages.delegating : pageMessages.delegate}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{pageMessages.validator}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={validator?.operatorAddress ?? undefined}>
                {validator?.moniker ?? '-'}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={validator?.operatorAddress ?? undefined}>
                {validator?.operatorAddress ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{pageMessages.key}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900" title={activeKey?.address ?? undefined}>
                {activeKey ? activeKey.name : pageMessages.noActiveKey}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500" title={activeKey?.address ?? undefined}>
                {activeKey?.address ?? '-'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">{pageMessages.delegateDetails}</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="delegate-amount">
              {pageMessages.amount}
            </label>
            <div className="relative">
              <Input
                id="delegate-amount"
                value={amount}
                inputMode="decimal"
                placeholder={pageMessages.amountPlaceholder}
                disabled={submitting}
                className="pr-10"
                onChange={(event) => setAmount(event.target.value)}
              />
              {amount.trim() ? (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center p-0 text-slate-400 transition hover:text-slate-700"
                  onClick={() => setAmount('')}
                  aria-label={messages.evmTxDetail.clearInput}
                  disabled={submitting}
                >
                  <IconX className="size-4" stroke={1.8} />
                </button>
              ) : null}
            </div>
          </div>

          {errorMessage ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p> : null}
        </div>
      </ModalDialog>

      <EvmPrivateKeyUnlockDialog
        open={unlockDialog.open}
        password={unlockDialog.password}
        errorMessage={unlockDialog.errorMessage}
        submitting={submitting}
        title={pageMessages.unlockPrivateKey}
        description={activeKey ? pageMessages.unlockDelegateDescription.replace('{name}', activeKey.name) : pageMessages.unlockFallbackDescription}
        placeholder={pageMessages.password}
        confirmLabel={pageMessages.unlock}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            unlockDialog.closeDialog();
          }
        }}
        onPasswordChange={unlockDialog.setPassword}
        onConfirm={() => void onSubmit({ amount, password: unlockDialog.password })}
      />
    </>
  );
}

function InvestmentProgramPoolDialog({
  open,
  submitting,
  errorMessage,
  cancelLabel,
  mode,
  initialValue,
  messagesKey,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  cancelLabel: string;
  mode: 'create' | 'edit';
  initialValue: QuarixEvmInvestmentProgramPoolItem | null;
  messagesKey: ReturnType<typeof useMessages>['quarixEvmValidators'];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { id?: string; name: string; details: string; royaltyFee: string; votingWeight: string; maxStaking: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [royaltyFee, setRoyaltyFee] = useState('');
  const [votingWeight, setVotingWeight] = useState('');
  const [maxStaking, setMaxStaking] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setDetails('');
      setRoyaltyFee('');
      setVotingWeight('');
      setMaxStaking('');
      return;
    }

    if (mode === 'edit' && initialValue) {
      setName(initialValue.nameLabel === '--' ? '' : initialValue.nameLabel);
      setDetails(initialValue.detailsLabel === '--' ? '' : initialValue.detailsLabel);
      setRoyaltyFee(initialValue.rawRoyaltyFeeInput);
      setVotingWeight(initialValue.rawVotingWeightInput);
      setMaxStaking(initialValue.rawMaxStakingInput);
      return;
    }

    setName('');
    setDetails('');
    setRoyaltyFee('');
    setVotingWeight('');
    setMaxStaking('');
  }, [initialValue, mode, open]);

  return (
    <ModalDialog
      open={open}
      title={mode === 'edit' ? messagesKey.editInvestmentProgramPool : messagesKey.createInvestmentProgramPool}
      description={mode === 'edit' ? messagesKey.editInvestmentProgramPoolDescription : messagesKey.createInvestmentProgramPoolDescription}
      maxWidthClassName="max-w-2xl"
      onOpenChange={onOpenChange}
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting}
            onClick={() => void onSubmit({ id: initialValue?.id, name, details, royaltyFee, votingWeight, maxStaking })}
          >
            {submitting ? (mode === 'edit' ? messagesKey.updatingInvestmentProgramPool : messagesKey.creatingInvestmentProgramPool) : mode === 'edit' ? messagesKey.update : messagesKey.create}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="ipp-name">
            {messagesKey.poolName}
          </label>
          <Input id="ipp-name" value={name} disabled={submitting} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="ipp-details">
            {messagesKey.poolDetails}
          </label>
          <Input id="ipp-details" value={details} disabled={submitting} onChange={(event) => setDetails(event.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="ipp-royalty">
              {messagesKey.royaltyFee}
            </label>
            <Input id="ipp-royalty" value={royaltyFee} inputMode="decimal" placeholder="0.05" disabled={submitting} onChange={(event) => setRoyaltyFee(event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="ipp-weight">
              {messagesKey.votingWeight}
            </label>
            <Input id="ipp-weight" value={votingWeight} inputMode="decimal" placeholder="1" disabled={submitting} onChange={(event) => setVotingWeight(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="ipp-max-staking">
            {messagesKey.maxStaking}
          </label>
          <Input id="ipp-max-staking" value={maxStaking} inputMode="decimal" placeholder="1000" disabled={submitting} onChange={(event) => setMaxStaking(event.target.value)} />
        </div>
        {errorMessage ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p> : null}
      </div>
    </ModalDialog>
  );
}

function AllocateInvestmentProgramPoolDialog({
  open,
  submitting,
  errorMessage,
  cancelLabel,
  messagesKey,
  poolOptions,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  cancelLabel: string;
  messagesKey: ReturnType<typeof useMessages>['quarixEvmValidators'];
  poolOptions: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { validatorAddress: string; ippId: string }) => Promise<void>;
}) {
  const [validatorAddress, setValidatorAddress] = useState('');
  const [ippId, setIppId] = useState('');

  useEffect(() => {
    if (!open) {
      setValidatorAddress('');
      setIppId('');
    }
  }, [open]);

  useEffect(() => {
    if (open && !ippId && poolOptions.length > 0) {
      setIppId(poolOptions[0]?.id ?? '');
    }
  }, [ippId, open, poolOptions]);

  return (
    <ModalDialog
      open={open}
      title={messagesKey.allocateInvestmentProgramPool}
      description={messagesKey.allocateInvestmentProgramPoolDescription}
      maxWidthClassName="max-w-xl"
      onOpenChange={onOpenChange}
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting}
            onClick={() => void onSubmit({ validatorAddress, ippId })}
          >
            {submitting ? messagesKey.allocatingInvestmentProgramPool : messagesKey.allocate}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="allocate-validator">
            {messagesKey.validator}
          </label>
          <Input
            id="allocate-validator"
            value={validatorAddress}
            disabled={submitting}
            placeholder="0x..."
            onChange={(event) => setValidatorAddress(event.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="allocate-ipp-id">
            {messagesKey.ippId}
          </label>
          <Select disabled={submitting} value={ippId} onValueChange={setIppId}>
            <SelectTrigger id="allocate-ipp-id" className="mt-0 h-10">
              <SelectValue placeholder={messagesKey.ippId} />
            </SelectTrigger>
            <SelectContent>
              {poolOptions.map((pool) => (
                <SelectItem key={pool.id} value={pool.id}>
                  {pool.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {errorMessage ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p> : null}
      </div>
    </ModalDialog>
  );
}

function ValidatorDialog({
  open,
  submitting,
  errorMessage,
  cancelLabel,
  mode,
  initialValue,
  messagesKey,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  cancelLabel: string;
  mode: 'create' | 'edit';
  initialValue: QuarixEvmValidatorItem | null;
  messagesKey: ReturnType<typeof useMessages>['quarixEvmValidators'];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: QuarixEvmValidatorFormInput) => Promise<void>;
}) {
  const [moniker, setMoniker] = useState('');
  const [identity, setIdentity] = useState('');
  const [website, setWebsite] = useState('');
  const [securityContact, setSecurityContact] = useState('');
  const [details, setDetails] = useState('');
  const [validatorAddress, setValidatorAddress] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [maxCommissionRate, setMaxCommissionRate] = useState('');
  const [maxCommissionChangeRate, setMaxCommissionChangeRate] = useState('');
  const [minSelfDelegation, setMinSelfDelegation] = useState('');
  const [pubkey, setPubkey] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!open) {
      setMoniker('');
      setIdentity('');
      setWebsite('');
      setSecurityContact('');
      setDetails('');
      setValidatorAddress('');
      setCommissionRate('');
      setMaxCommissionRate('');
      setMaxCommissionChangeRate('');
      setMinSelfDelegation('');
      setPubkey('');
      setAmount('');
      return;
    }

    if (mode === 'edit' && initialValue) {
      setMoniker(initialValue.raw.description?.moniker ?? '');
      setIdentity(initialValue.raw.description?.identity ?? '');
      setWebsite(initialValue.raw.description?.website ?? '');
      setSecurityContact(initialValue.raw.description?.securityContact ?? '');
      setDetails(initialValue.raw.description?.details ?? '');
      setValidatorAddress(initialValue.operatorAddress);
      setCommissionRate(formatScaled18InputValue(initialValue.raw.commission, 'en-US'));
      setMaxCommissionRate('');
      setMaxCommissionChangeRate('');
      setMinSelfDelegation(formatScaled18InputValue(initialValue.raw.minSelfDelegation, 'en-US'));
      setPubkey(initialValue.raw.consensusPubkey ?? '');
      setAmount('');
      return;
    }

    setMoniker('');
    setIdentity('');
    setWebsite('');
    setSecurityContact('');
    setDetails('');
    setValidatorAddress('');
    setCommissionRate('');
    setMaxCommissionRate('');
    setMaxCommissionChangeRate('');
    setMinSelfDelegation('');
    setPubkey('');
    setAmount('');
  }, [initialValue, mode, open]);

  return (
    <ModalDialog
      open={open}
      title={mode === 'edit' ? messagesKey.editValidator : messagesKey.createValidator}
      description={mode === 'edit' ? messagesKey.editValidatorDescription : messagesKey.createValidatorDescription}
      maxWidthClassName="max-w-3xl"
      onOpenChange={onOpenChange}
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting}
            onClick={() =>
              void onSubmit({
                moniker,
                identity,
                website,
                securityContact,
                details,
                validatorAddress,
                commissionRate,
                maxCommissionRate,
                maxCommissionChangeRate,
                minSelfDelegation,
                pubkey,
                amount,
              })
            }
          >
            {submitting ? (mode === 'edit' ? messagesKey.updatingValidator : messagesKey.creatingValidator) : mode === 'edit' ? messagesKey.update : messagesKey.create}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-moniker">
              {messagesKey.moniker}
            </label>
            <Input id="validator-moniker" value={moniker} disabled={submitting} onChange={(event) => setMoniker(event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-address">
              {messagesKey.operatorAddress}
            </label>
            <Input id="validator-address" value={validatorAddress} disabled={submitting || mode === 'edit'} placeholder="0x..." onChange={(event) => setValidatorAddress(event.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-identity">
              {messagesKey.identity}
            </label>
            <Input id="validator-identity" value={identity} disabled={submitting} onChange={(event) => setIdentity(event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-website">
              {messagesKey.website}
            </label>
            <Input id="validator-website" value={website} disabled={submitting} onChange={(event) => setWebsite(event.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-security-contact">
              {messagesKey.securityContact}
            </label>
            <Input id="validator-security-contact" value={securityContact} disabled={submitting} onChange={(event) => setSecurityContact(event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-pubkey">
              {messagesKey.pubkey}
            </label>
            <Input id="validator-pubkey" value={pubkey} disabled={submitting || mode === 'edit'} onChange={(event) => setPubkey(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="validator-details">
            {messagesKey.details}
          </label>
          <Input id="validator-details" value={details} disabled={submitting} onChange={(event) => setDetails(event.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-commission-rate">
              {messagesKey.commissionRate}
            </label>
            <Input id="validator-commission-rate" value={commissionRate} inputMode="decimal" placeholder="0.10" disabled={submitting} onChange={(event) => setCommissionRate(event.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="validator-min-self-delegation">
              {messagesKey.minSelfDelegation}
            </label>
            <Input id="validator-min-self-delegation" value={minSelfDelegation} inputMode="decimal" placeholder="1" disabled={submitting} onChange={(event) => setMinSelfDelegation(event.target.value)} />
          </div>
        </div>
        {mode === 'create' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="validator-max-commission-rate">
                {messagesKey.maxCommissionRate}
              </label>
              <Input id="validator-max-commission-rate" value={maxCommissionRate} inputMode="decimal" placeholder="0.20" disabled={submitting} onChange={(event) => setMaxCommissionRate(event.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="validator-max-commission-change-rate">
                {messagesKey.maxCommissionChangeRate}
              </label>
              <Input
                id="validator-max-commission-change-rate"
                value={maxCommissionChangeRate}
                inputMode="decimal"
                placeholder="0.01"
                disabled={submitting}
                onChange={(event) => setMaxCommissionChangeRate(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="validator-amount">
                {messagesKey.amount}
              </label>
              <Input id="validator-amount" value={amount} inputMode="decimal" placeholder="1" disabled={submitting} onChange={(event) => setAmount(event.target.value)} />
            </div>
          </div>
        ) : null}
        {errorMessage ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{errorMessage}</p> : null}
      </div>
    </ModalDialog>
  );
}

function EvmQuarixValidatorsPageContent() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixEvmValidators;
  const stakingMessages = messages.quarixStaking;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<QuarixEvmValidatorsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<QuarixEvmValidatorItem | null>(null);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [validatorDialogOpen, setValidatorDialogOpen] = useState(false);
  const [validatorDialogSubmitting, setValidatorDialogSubmitting] = useState(false);
  const [validatorDialogError, setValidatorDialogError] = useState<string | null>(null);
  const [editingValidator, setEditingValidator] = useState<QuarixEvmValidatorItem | null>(null);
  const [createInvestmentProgramPoolOpen, setCreateInvestmentProgramPoolOpen] = useState(false);
  const [createInvestmentProgramPoolSubmitting, setCreateInvestmentProgramPoolSubmitting] = useState(false);
  const [createInvestmentProgramPoolError, setCreateInvestmentProgramPoolError] = useState<string | null>(null);
  const [editingInvestmentProgramPool, setEditingInvestmentProgramPool] = useState<QuarixEvmInvestmentProgramPoolItem | null>(null);
  const [allocateInvestmentProgramPoolOpen, setAllocateInvestmentProgramPoolOpen] = useState(false);
  const [allocateInvestmentProgramPoolSubmitting, setAllocateInvestmentProgramPoolSubmitting] = useState(false);
  const [allocateInvestmentProgramPoolError, setAllocateInvestmentProgramPoolError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'delegate' | 'createPool' | 'allocatePool' | 'validator' | null>(null);
  const [pendingDelegateAmount, setPendingDelegateAmount] = useState('');
  const [pendingValidatorInput, setPendingValidatorInput] = useState<QuarixEvmValidatorFormInput | null>(null);
  const [pendingCreatePoolInput, setPendingCreatePoolInput] = useState<{ name: string; details: string; royaltyFee: string; votingWeight: string; maxStaking: string } | null>(null);
  const [pendingAllocatePoolInput, setPendingAllocatePoolInput] = useState<{ validatorAddress: string; ippId: string } | null>(null);
  const [investmentProgramPoolsState, setInvestmentProgramPoolsState] = useState<QuarixEvmInvestmentProgramPoolsState | null>(null);
  const [investmentProgramPoolsLoading, setInvestmentProgramPoolsLoading] = useState(true);
  const [investmentProgramPoolsRefreshing, setInvestmentProgramPoolsRefreshing] = useState(false);
  const [investmentProgramPoolsError, setInvestmentProgramPoolsError] = useState<string | null>(null);
  const [showInvestmentProgramPoolsJson, setShowInvestmentProgramPoolsJson] = useState(false);
  const [allocatedInvestmentProgramPoolsState, setAllocatedInvestmentProgramPoolsState] = useState<QuarixEvmAllocatedInvestmentProgramPoolsState | null>(null);
  const [allocatedInvestmentProgramPoolsLoading, setAllocatedInvestmentProgramPoolsLoading] = useState(true);
  const [allocatedInvestmentProgramPoolsRefreshing, setAllocatedInvestmentProgramPoolsRefreshing] = useState(false);
  const [allocatedInvestmentProgramPoolsError, setAllocatedInvestmentProgramPoolsError] = useState<string | null>(null);
  const [showAllocatedInvestmentProgramPoolsJson, setShowAllocatedInvestmentProgramPoolsJson] = useState(false);
  const validatorsLoadedRef = useRef(false);
  const investmentProgramPoolsLoadedRef = useRef(false);
  const allocatedInvestmentProgramPoolsLoadedRef = useRef(false);
  const unlockDialog = useEvmPrivateKeyUnlockDialog();
  const validators = useMemo(() => data?.validators ?? [], [data]);
  const validatorMonikerByAddress = useMemo(
    () => {
      const entries: Array<readonly [string, string]> = [];

      for (const validator of validators) {
        const evmAddress = normalizeEvmAddress(validator.operatorAddress);

        if (evmAddress) {
          entries.push([evmAddress, validator.moniker] as const);
        }
      }

      return new Map<string, string>(entries);
    },
    [validators],
  );

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isInitialLoad = !validatorsLoadedRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await requestQuarixEvmValidators(currentPage, PAGE_SIZE, locale);

        if (!cancelled) {
          setData(next);
          validatorsLoadedRef.current = true;
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParams.toString()), next.page));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : pageMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    const handleActiveRpcProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [currentPage, locale, pageMessages.failedToLoadFallback, pathname, refreshVersion, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isInitialLoad = !investmentProgramPoolsLoadedRef.current;

      if (isInitialLoad) {
        setInvestmentProgramPoolsLoading(true);
      } else {
        setInvestmentProgramPoolsRefreshing(true);
      }

      try {
        const next = await requestQuarixEvmInvestmentProgramPools(locale);

        if (!cancelled) {
          setInvestmentProgramPoolsState(next);
          investmentProgramPoolsLoadedRef.current = true;
          setInvestmentProgramPoolsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setInvestmentProgramPoolsError(error instanceof Error ? error.message : stakingMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setInvestmentProgramPoolsLoading(false);
          setInvestmentProgramPoolsRefreshing(false);
        }
      }
    }

    void load();

    const handleActiveRpcProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [locale, refreshVersion, stakingMessages.failedToLoadFallback]);

  const investmentProgramPools = useMemo(() => investmentProgramPoolsState?.items ?? [], [investmentProgramPoolsState]);
  const investmentProgramPoolOptions = useMemo(
    () =>
      investmentProgramPools.map((pool) => ({
        id: pool.id,
        name: `${pool.nameLabel}-${pool.detailsLabel} (#${pool.idLabel})`,
      })),
    [investmentProgramPools],
  );
  const investmentProgramPoolNameById = useMemo(() => new Map(investmentProgramPools.map((pool) => [pool.idLabel, pool.nameLabel] as const)), [investmentProgramPools]);
  const allocatedInvestmentProgramPools = useMemo(() => allocatedInvestmentProgramPoolsState?.items ?? [], [allocatedInvestmentProgramPoolsState]);
  const delegateDialogOpen = useMemo(() => Boolean(selectedValidator), [selectedValidator]);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const isInitialLoad = !allocatedInvestmentProgramPoolsLoadedRef.current;

      if (isInitialLoad) {
        setAllocatedInvestmentProgramPoolsLoading(true);
      } else {
        setAllocatedInvestmentProgramPoolsRefreshing(true);
      }

      try {
        const next = await requestQuarixEvmAllocatedInvestmentProgramPools(validatorMonikerByAddress, investmentProgramPoolNameById);

        if (!cancelled) {
          setAllocatedInvestmentProgramPoolsState(next);
          allocatedInvestmentProgramPoolsLoadedRef.current = true;
          setAllocatedInvestmentProgramPoolsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setAllocatedInvestmentProgramPoolsError(error instanceof Error ? error.message : stakingMessages.failedToLoadFallback);
        }
      } finally {
        if (!cancelled) {
          setAllocatedInvestmentProgramPoolsLoading(false);
          setAllocatedInvestmentProgramPoolsRefreshing(false);
        }
      }
    }

    void load();

    const handleActiveRpcProfileChanged = () => {
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, [refreshVersion, stakingMessages.failedToLoadFallback, validatorMonikerByAddress, investmentProgramPoolNameById]);

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParams.toString()), page));
  }

  function handleDelegateSuccess() {
    setSelectedValidator(null);
    setDelegateError(null);
    setRefreshVersion((current) => current + 1);
  }

  async function submitDelegate(input: { amount: string; password?: string }) {
    if (!selectedValidator) {
      return;
    }

    if (!activeKey) {
      setDelegateError(pageMessages.noActiveKey);
      return;
    }

    const trimmedAmount = input.amount.trim();

    if (!trimmedAmount) {
      setDelegateError(pageMessages.amountRequired);
      return;
    }

    if (!/^\d+(?:\.\d+)?$/.test(trimmedAmount)) {
      setDelegateError(pageMessages.invalidAmount);
      return;
    }

    const scaledAmount = scaleToIntegerByPowerOfTen(trimmedAmount, 18);
    const validatorAddress = toQuarixValidatorAddress(selectedValidator.operatorAddress);

    if (!scaledAmount || !/^\d+$/.test(scaledAmount)) {
      setDelegateError(pageMessages.invalidAmount);
      return;
    }

    if (!validatorAddress) {
      setDelegateError(pageMessages.invalidValidatorAddress);
      return;
    }

    if (!isAddress(activeKey.address)) {
      setDelegateError(pageMessages.invalidDelegatorAddress);
      return;
    }

    setPendingAction('delegate');
    setPendingDelegateAmount(trimmedAmount);
    setDelegateSubmitting(true);
    setDelegateError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, input.password);

      unlockDialog.handleUnlockResolved();

      await writeEvmContractMethodDirect({
        address: EVM_STAKING_PRECOMPILE_ADDRESS,
        abiJson: JSON.stringify(EVM_STAKING_ABI),
        functionSignature: 'delegate(address,string,uint256)',
        rawArgs: [activeKey.address, validatorAddress, scaledAmount],
        privateKey,
        value: '0',
      });

      showToast({
        title: pageMessages.delegateBroadcasted,
        description: selectedValidator.operatorAddress,
      });

      handleDelegateSuccess();
      setPendingDelegateAmount('');
    } catch (error) {
      const message = error instanceof Error ? error.message : pageMessages.failedToBroadcastDelegate;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setDelegateError(message);
      }
    } finally {
      if (input.password) {
        setPendingAction(null);
      }
      setDelegateSubmitting(false);
    }
  }

  async function submitValidator(input: QuarixEvmValidatorFormInput & { password?: string }) {
    if (!activeKey) {
      setValidatorDialogError(pageMessages.noActiveKey);
      return;
    }

    const validatorAddress = normalizeValidatorEvmAddress(input.validatorAddress);

    if (!validatorAddress) {
      setValidatorDialogError(pageMessages.invalidValidatorAddress);
      return;
    }

    const moniker = input.moniker.trim();
    const minSelfDelegation = scaleToIntegerByPowerOfTen(input.minSelfDelegation, 18);
    const commissionRate = scalePercentToInteger(input.commissionRate);

    if (!moniker || !minSelfDelegation || !commissionRate) {
      setValidatorDialogError(pageMessages.invalidValidatorValue);
      return;
    }

    const validatorPayload: QuarixEvmValidatorFormInput = {
      ...input,
      moniker,
      identity: input.identity.trim(),
      website: input.website.trim(),
      securityContact: input.securityContact.trim(),
      details: input.details.trim(),
      validatorAddress: input.validatorAddress.trim(),
      commissionRate: input.commissionRate.trim(),
      maxCommissionRate: input.maxCommissionRate.trim(),
      maxCommissionChangeRate: input.maxCommissionChangeRate.trim(),
      minSelfDelegation: input.minSelfDelegation.trim(),
      pubkey: input.pubkey.trim(),
      amount: input.amount.trim(),
    };

    setPendingAction('validator');
    setPendingValidatorInput(validatorPayload);
    setValidatorDialogSubmitting(true);
    setValidatorDialogError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, input.password);

      unlockDialog.handleUnlockResolved();

      if (editingValidator) {
        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_ABI),
          functionSignature: 'editValidator((string,string,string,string,string),address,int256,int256)',
          rawArgs: [
            JSON.stringify({
              moniker,
              identity: validatorPayload.identity,
              website: validatorPayload.website,
              securityContact: validatorPayload.securityContact,
              details: validatorPayload.details,
            }),
            validatorAddress,
            commissionRate,
            minSelfDelegation,
          ],
          privateKey,
          value: '0',
        });
      } else {
        const maxCommissionRate = scalePercentToInteger(validatorPayload.maxCommissionRate);
        const maxCommissionChangeRate = scalePercentToInteger(validatorPayload.maxCommissionChangeRate);
        const amount = scaleToIntegerByPowerOfTen(validatorPayload.amount, 18);

        if (!maxCommissionRate || !maxCommissionChangeRate || !amount || !validatorPayload.pubkey) {
          throw new Error(pageMessages.invalidValidatorValue);
        }

        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_ABI),
          functionSignature: 'createValidator((string,string,string,string,string),(uint256,uint256,uint256),uint256,address,string,uint256)',
          rawArgs: [
            JSON.stringify({
              moniker,
              identity: validatorPayload.identity,
              website: validatorPayload.website,
              securityContact: validatorPayload.securityContact,
              details: validatorPayload.details,
            }),
            JSON.stringify({
              rate: commissionRate,
              maxRate: maxCommissionRate,
              maxChangeRate: maxCommissionChangeRate,
            }),
            minSelfDelegation,
            validatorAddress,
            validatorPayload.pubkey,
            amount,
          ],
          privateKey,
          value: '0',
        });
      }

      showToast({
        title: editingValidator ? pageMessages.updatedValidatorTitle : pageMessages.createdValidatorTitle,
        description: moniker,
      });

      setValidatorDialogOpen(false);
      setEditingValidator(null);
      setPendingValidatorInput(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : editingValidator ? pageMessages.failedToUpdateValidator : pageMessages.failedToCreateValidator;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setValidatorDialogError(message);
      }
    } finally {
      if (input.password) {
        setPendingAction(null);
      }
      setValidatorDialogSubmitting(false);
    }
  }

  async function submitCreateInvestmentProgramPool(input: { id?: string; name: string; details: string; royaltyFee: string; votingWeight: string; maxStaking: string; password?: string }) {
    if (!activeKey) {
      setCreateInvestmentProgramPoolError(pageMessages.noActiveKey);
      return;
    }

    if (!isAddress(activeKey.address)) {
      setCreateInvestmentProgramPoolError(pageMessages.invalidDelegatorAddress);
      return;
    }

    const poolName = input.name.trim();
    const poolDetails = input.details.trim();
    const royaltyFee = scalePercentToInteger(input.royaltyFee);
    const votingWeight = scalePercentToInteger(input.votingWeight);
    const maxStaking = scaleToIntegerByPowerOfTen(input.maxStaking, 18);

    if (!poolName) {
      setCreateInvestmentProgramPoolError(pageMessages.poolNameRequired);
      return;
    }

    if (!royaltyFee || !votingWeight || !maxStaking) {
      setCreateInvestmentProgramPoolError(pageMessages.invalidPoolValue);
      return;
    }

    setPendingAction('createPool');
    setPendingCreatePoolInput({
      name: poolName,
      details: poolDetails,
      royaltyFee: input.royaltyFee,
      votingWeight: input.votingWeight,
      maxStaking: input.maxStaking,
    });
    setCreateInvestmentProgramPoolSubmitting(true);
    setCreateInvestmentProgramPoolError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, input.password);

      unlockDialog.handleUnlockResolved();

      if (editingInvestmentProgramPool && input.id) {
        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_ABI),
          functionSignature: 'editInvestmentProgramPool(address,uint64,string,string,uint256,uint256,uint256)',
          rawArgs: [activeKey.address, input.id, poolName, poolDetails, royaltyFee, votingWeight, maxStaking],
          privateKey,
          value: '0',
        });
      } else {
        await writeEvmContractMethodDirect({
          address: EVM_STAKING_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_STAKING_ABI),
          functionSignature: 'createInvestmentProgramPool(address,string,string,uint256,uint256,uint256)',
          rawArgs: [activeKey.address, poolName, poolDetails, royaltyFee, votingWeight, maxStaking],
          privateKey,
          value: '0',
        });
      }

      showToast({
        title: editingInvestmentProgramPool ? pageMessages.updatedInvestmentProgramPoolTitle : pageMessages.createdInvestmentProgramPoolTitle,
        description: poolName,
      });

      setCreateInvestmentProgramPoolOpen(false);
      setEditingInvestmentProgramPool(null);
      setPendingCreatePoolInput(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : editingInvestmentProgramPool ? pageMessages.failedToUpdateInvestmentProgramPool : pageMessages.failedToCreateInvestmentProgramPool;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setCreateInvestmentProgramPoolError(message);
      }
    } finally {
      if (input.password) {
        setPendingAction(null);
      }
      setCreateInvestmentProgramPoolSubmitting(false);
    }
  }

  async function submitAllocateInvestmentProgramPool(input: { validatorAddress: string; ippId: string; password?: string }) {
    if (!activeKey) {
      setAllocateInvestmentProgramPoolError(pageMessages.noActiveKey);
      return;
    }

    if (!isAddress(activeKey.address)) {
      setAllocateInvestmentProgramPoolError(pageMessages.invalidDelegatorAddress);
      return;
    }

    const validatorAddress = normalizeEvmAddress(input.validatorAddress);
    const ippId = input.ippId.trim();

    if (!validatorAddress) {
      setAllocateInvestmentProgramPoolError(pageMessages.invalidValidatorAddress);
      return;
    }

    if (!/^\d+$/.test(ippId)) {
      setAllocateInvestmentProgramPoolError(pageMessages.invalidIppId);
      return;
    }

    setPendingAction('allocatePool');
    setPendingAllocatePoolInput({
      validatorAddress: input.validatorAddress.trim(),
      ippId,
    });
    setAllocateInvestmentProgramPoolSubmitting(true);
    setAllocateInvestmentProgramPoolError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, input.password);

      unlockDialog.handleUnlockResolved();

      await writeEvmContractMethodDirect({
        address: EVM_STAKING_PRECOMPILE_ADDRESS,
        abiJson: JSON.stringify(EVM_STAKING_ABI),
        functionSignature: 'allocateInvestmentProgramPool(address,address,uint64)',
        rawArgs: [activeKey.address, validatorAddress, ippId],
        privateKey,
        value: '0',
      });

      showToast({
        title: pageMessages.allocatedInvestmentProgramPoolTitle,
        description: validatorAddress,
      });

      setAllocateInvestmentProgramPoolOpen(false);
      setPendingAllocatePoolInput(null);
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : pageMessages.failedToAllocateInvestmentProgramPool;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setAllocateInvestmentProgramPoolError(message);
      }
    } finally {
      if (input.password) {
        setPendingAction(null);
      }
      setAllocateInvestmentProgramPoolSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <AppShell>
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={7} toolbarIcons={3} />
      </AppShell>
    );
  }

  if (errorMessage && !data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{pageMessages.title}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{pageMessages.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{pageMessages.description}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {validators.length ? pageMessages.totalValidatorsLabel.replace('{count}', data?.totalValidators.toLocaleString(locale) ?? '0') : pageMessages.emptyValidatorsLabel}
              </p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <PaginationControls
                page={data?.page ?? 1}
                totalPages={data?.totalPages ?? 1}
                hasPreviousPage={data?.hasPreviousPage ?? false}
                hasNextPage={data?.hasNextPage ?? false}
                disabled={loading || refreshing}
                plain
                onPageChange={handlePageChange}
              />
              <ActionIconButton
                tooltip={pageMessages.createValidator}
                className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700"
                onClick={() => {
                  setEditingValidator(null);
                  setValidatorDialogError(null);
                  setValidatorDialogOpen(true);
                }}
              >
                <IconPlus className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={showRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showRawJson
                    ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                    : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                }
                onClick={() => setShowRawJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={messages.common.refresh}
                className={refreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[1260px] table-fixed">
              <colgroup>
                <col className="w-[260px]" />
                <col className="w-[260px]" />
                <col className="w-[160px]" />
                <col className="w-[160px]" />
                <col className="w-[160px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.validator}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.operatorAddress}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{pageMessages.totalStaking}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{pageMessages.weight}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{pageMessages.commission}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.jailed}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.status}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {validators.length ? (
                  validators.map((validator) => (
                    <tr key={validator.operatorAddress} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm text-slate-900">
                        <p className="truncate font-medium text-slate-900">{validator.moniker}</p>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <CosmosAddressLink href={`/cosmos/validator/${encodeURIComponent(validator.operatorAddress)}`} label={validator.operatorAddress} copyValue={validator.operatorAddress} />
                      </td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-700">{validator.totalStakingLabel}</td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-700">{validator.weightLabel}</td>
                      <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-700">{validator.commissionLabel}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${validator.jailed ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {validator.jailed ? pageMessages.jailedYes : pageMessages.jailedNo}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{validator.statusLabel}</td>
                      <td className="px-5 py-3 text-right text-sm">
                        <ActionIconButton
                          tooltip={pageMessages.editValidator}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => {
                            setEditingValidator(validator);
                            setValidatorDialogError(null);
                            setValidatorDialogOpen(true);
                          }}
                        >
                          <IconPencil className="size-4" stroke={1.8} />
                        </ActionIconButton>
                        <ActionIconButton tooltip={pageMessages.delegate} className="text-slate-400 hover:text-sky-600" onClick={() => setSelectedValidator(validator)}>
                          <IconCoins className="size-4" stroke={1.8} />
                        </ActionIconButton>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.emptyValidatorsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {showRawJson ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={(data?.response ?? { validators: [] }) as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">{stakingMessages.investmentProgramPools}</p>
              {investmentProgramPoolsError ? <p className="mt-2 overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(investmentProgramPoolsError, locale)}</p> : null}
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <ActionIconButton tooltip={pageMessages.createInvestmentProgramPool} className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700" onClick={() => setCreateInvestmentProgramPoolOpen(true)}>
                <IconPlus className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={showInvestmentProgramPoolsJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showInvestmentProgramPoolsJson
                    ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                    : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                }
                onClick={() => setShowInvestmentProgramPoolsJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={messages.common.refresh}
                className={investmentProgramPoolsRefreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full table-fixed">
              <colgroup>
                <col className="w-[70px]" />
                <col className="w-[160px]" />
                <col className="w-[220px]" />
                <col className="w-[160px]" />
                <col className="w-[160px]" />
                <col className="w-[180px]" />
                <col className="w-[180px]" />
                <col className="w-[88px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.id}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.name}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.details}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.royaltyFee}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.votingWeight}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.maxStaking}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.currentStaking}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{messages.labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {!investmentProgramPoolsLoading && investmentProgramPools.length ? (
                  investmentProgramPools.map((pool, index) => (
                    <tr key={`${pool.idLabel}-${index}`} className="border-t border-slate-200">
                      <PoolValueCell value={pool.idLabel} />
                      <PoolValueCell value={pool.nameLabel} />
                      <PoolValueCell value={pool.detailsLabel} />
                      <PoolValueCell value={pool.royaltyFeeLabel} />
                      <PoolValueCell value={pool.votingWeightLabel} />
                      <StakingAmountCell value={pool.maxStakingLabel} />
                      <StakingAmountCell value={pool.currentStakingLabel} />
                      <td className="px-5 py-3 text-right text-sm">
                        <ActionIconButton
                          tooltip={pageMessages.editInvestmentProgramPool}
                          className="text-slate-400 hover:text-sky-600"
                          onClick={() => {
                            setEditingInvestmentProgramPool(pool);
                            setCreateInvestmentProgramPoolError(null);
                            setCreateInvestmentProgramPoolOpen(true);
                          }}
                        >
                          <IconPencil className="size-4" stroke={1.8} />
                        </ActionIconButton>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                      {stakingMessages.emptyItemsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {showInvestmentProgramPoolsJson && investmentProgramPoolsState ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={investmentProgramPoolsState.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">{stakingMessages.allocateInvestmentProgramPools}</p>
              {allocatedInvestmentProgramPoolsError ? <p className="mt-2 overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(allocatedInvestmentProgramPoolsError, locale)}</p> : null}
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <ActionIconButton tooltip={pageMessages.allocateInvestmentProgramPool} className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700" onClick={() => setAllocateInvestmentProgramPoolOpen(true)}>
                <IconPlus className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={showAllocatedInvestmentProgramPoolsJson ? messages.common.hideRawJson : messages.common.showRawJson}
                className={
                  showAllocatedInvestmentProgramPoolsJson
                    ? 'h-8 w-8 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                    : 'h-8 w-8 rounded-md text-slate-400 hover:text-slate-700'
                }
                onClick={() => setShowAllocatedInvestmentProgramPoolsJson((current) => !current)}
              >
                <IconCode className="size-4" stroke={1.8} />
              </ActionIconButton>
              <ActionIconButton
                tooltip={messages.common.refresh}
                className={allocatedInvestmentProgramPoolsRefreshing ? 'h-8 w-8 text-sky-600' : 'h-8 w-8 text-slate-400 hover:text-slate-600'}
                onClick={() => setRefreshVersion((current) => current + 1)}
              >
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1280px] table-fixed">
              <colgroup>
                <col className="w-[160px]" />
                <col className="w-[260px]" />
                <col className="w-[240px]" />
                <col className="w-[420px]" />
                <col className="w-[160px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.item}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.validator}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.name}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.validatorAddress}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{stakingMessages.ippId}</th>
                </tr>
              </thead>
              <tbody>
                {!allocatedInvestmentProgramPoolsLoading && allocatedInvestmentProgramPools.length ? (
                  allocatedInvestmentProgramPools.map((pool, index) => (
                    <tr key={`${pool.validatorAddress ?? 'validator'}-${pool.ippIdLabel}-${index}`} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-500">{(index + 1).toLocaleString(locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-900">
                        <span className="block truncate">{pool.validatorMoniker ?? '--'}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-900">
                        <span className="block truncate">{pool.investmentProgramPoolName ?? '--'}</span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        {pool.validatorAddress ? (
                          <CosmosAddressLink href={`/cosmos/validator/${pool.validatorAddress}`} label={pool.validatorAddress} copyValue={pool.validatorAddress} prefetch={false} />
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                      <PoolValueCell value={pool.ippIdLabel} />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                      {stakingMessages.emptyItemsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {showAllocatedInvestmentProgramPoolsJson && allocatedInvestmentProgramPoolsState ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={allocatedInvestmentProgramPoolsState.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>

        <DelegateDialog
          validator={selectedValidator}
          activeKey={activeKey}
          open={delegateDialogOpen}
          submitting={delegateSubmitting}
          errorMessage={delegateError}
          unlockDialog={unlockDialog}
          onSubmit={submitDelegate}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedValidator(null);
              setDelegateError(null);
            }
          }}
        />
        <InvestmentProgramPoolDialog
          open={createInvestmentProgramPoolOpen}
          submitting={createInvestmentProgramPoolSubmitting}
          errorMessage={createInvestmentProgramPoolError}
          cancelLabel={messages.common.cancel}
          mode={editingInvestmentProgramPool ? 'edit' : 'create'}
          initialValue={editingInvestmentProgramPool}
          messagesKey={pageMessages}
          onOpenChange={(open) => {
            setCreateInvestmentProgramPoolOpen(open);
            if (!open) {
              setCreateInvestmentProgramPoolError(null);
              setEditingInvestmentProgramPool(null);
            }
          }}
          onSubmit={(input) => submitCreateInvestmentProgramPool(input)}
        />
        <ValidatorDialog
          open={validatorDialogOpen}
          submitting={validatorDialogSubmitting}
          errorMessage={validatorDialogError}
          cancelLabel={messages.common.cancel}
          mode={editingValidator ? 'edit' : 'create'}
          initialValue={editingValidator}
          messagesKey={pageMessages}
          onOpenChange={(open) => {
            setValidatorDialogOpen(open);
            if (!open) {
              setEditingValidator(null);
              setValidatorDialogError(null);
            }
          }}
          onSubmit={(input) => submitValidator(input)}
        />
        <AllocateInvestmentProgramPoolDialog
          open={allocateInvestmentProgramPoolOpen}
          submitting={allocateInvestmentProgramPoolSubmitting}
          errorMessage={allocateInvestmentProgramPoolError}
          cancelLabel={messages.common.cancel}
          messagesKey={pageMessages}
          poolOptions={investmentProgramPoolOptions}
          onOpenChange={(open) => {
            setAllocateInvestmentProgramPoolOpen(open);
            if (!open) {
              setAllocateInvestmentProgramPoolError(null);
            }
          }}
          onSubmit={(input) => submitAllocateInvestmentProgramPool(input)}
        />
        <EvmPrivateKeyUnlockDialog
          open={unlockDialog.open}
          password={unlockDialog.password}
          errorMessage={unlockDialog.errorMessage}
          submitting={delegateSubmitting || validatorDialogSubmitting || createInvestmentProgramPoolSubmitting || allocateInvestmentProgramPoolSubmitting}
          title={pageMessages.unlockPrivateKey}
          description={activeKey ? pageMessages.unlockFallbackDescription.replace('{name}', activeKey.name) : pageMessages.unlockFallbackDescription}
          placeholder={pageMessages.password}
          confirmLabel={pageMessages.unlock}
          onOpenChange={(open) => {
            if (!open) {
              unlockDialog.closeDialog();
              setPendingAction(null);
            }
          }}
          onPasswordChange={unlockDialog.setPassword}
          onConfirm={() => {
            if (pendingAction === 'delegate' && pendingDelegateAmount) {
              void submitDelegate({ amount: pendingDelegateAmount, password: unlockDialog.password });
              return;
            }

            if (pendingAction === 'createPool' && pendingCreatePoolInput) {
              void submitCreateInvestmentProgramPool({ ...pendingCreatePoolInput, password: unlockDialog.password });
              return;
            }

            if (pendingAction === 'validator' && pendingValidatorInput) {
              void submitValidator({ ...pendingValidatorInput, password: unlockDialog.password });
              return;
            }

            if (pendingAction === 'allocatePool' && pendingAllocatePoolInput) {
              void submitAllocateInvestmentProgramPool({ ...pendingAllocatePoolInput, password: unlockDialog.password });
            }
          }}
        />
        {errorMessage && data ? <p className="mt-4 overflow-hidden break-all whitespace-pre-wrap text-sm text-rose-600">{translateRuntimeText(errorMessage, locale)}</p> : null}
      </main>
    </AppShell>
  );
}

export default function EvmQuarixValidatorsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={7} toolbarIcons={3} />
        </AppShell>
      }
    >
      <EvmQuarixValidatorsPageContent />
    </Suspense>
  );
}
