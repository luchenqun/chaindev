'use client';

import { IconFileDollar } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type Abi, isAddress } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useToast } from '@/components/ui/toast';
import { formatReadableDecCoinCollection, formatReadableDenom, formatReadableTokenAmount } from '@/domains/cosmos/client/tx-helpers';
import { decodeCosmosAddressToEvmHexAddress } from '@/domains/cosmos/ui/address-display';
import { CosmosAddressLink } from '@/domains/cosmos/ui/address-link';
import { CosmosDetailGroup as DetailGroup, CosmosDetailRow as DetailRow, CosmosDetailTag as DetailTag } from '@/domains/cosmos/ui/detail-primitives';
import { writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { getActiveEvmStoredPrivateKey, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { EVM_DISTRIBUTION_ADDRESS, EVM_STAKING_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { formatLocalizedDateTime, formatLocalizedNumber } from '@/i18n/format';
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

type EvmStakingDelegationResponse = {
  delegatorAddress?: string;
  validatorAddress?: string;
  shares?: bigint | number | string;
  balance?: {
    denom?: string;
    amount?: bigint | number | string;
  };
};
type EvmUnbondingDelegationEntry = {
  creationHeight?: bigint | number | string;
  completionTime?: bigint | number | string;
  initialBalance?: bigint | number | string;
  balance?: bigint | number | string;
  unbondingId?: bigint | number | string;
  unbondingOnHoldRefCount?: bigint | number | string;
};
type EvmUnbondingDelegationResponse = {
  delegatorAddress?: string;
  validatorAddress?: string;
  entries?: EvmUnbondingDelegationEntry[];
};

type EvmDistributionDecCoin = {
  denom?: string;
  amount?: bigint | number | string;
  precision?: number | string | bigint;
};

type EvmDistributionInfo = {
  operatorAddress?: string;
  selfBondRewards?: EvmDistributionDecCoin[];
  commission?: EvmDistributionDecCoin[];
};

type EvmStakingPageResponse = {
  total?: bigint | number | string;
};

type ValidatorOverviewData = {
  validator: EvmStakingValidator;
  delegations: EvmStakingDelegationResponse[];
  unbondingDelegations: EvmUnbondingDelegationResponse[];
  currentRewards: EvmDistributionDecCoin[];
  outstandingRewards: EvmDistributionDecCoin[];
  commissionRewards: EvmDistributionDecCoin[];
  distributionInfo: EvmDistributionInfo | null;
  totalDelegations: number;
  totalUnbondingDelegations: number;
};

const PAGE_SIZE = 15;
const EVM_STAKING_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmStaking')?.abi ?? []) as Abi;
const EVM_DISTRIBUTION_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmDistribution')?.abi ?? []) as Abi;
const EVM_STAKING_PRECOMPILE_ADDRESS = EVM_STAKING_ADDRESS as `0x${string}`;
const EVM_DISTRIBUTION_PRECOMPILE_ADDRESS = EVM_DISTRIBUTION_ADDRESS as `0x${string}`;

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
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

function formatValidatorStatusKey(value: unknown) {
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

function trimDecimalLabel(value: string) {
  if (!value.includes('.')) {
    return value;
  }

  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed || '0';
}

function formatDelegationSharesLabel(value: unknown) {
  const normalized = normalizeBigintLike(value);
  const divisor = 10n ** 36n;
  const whole = normalized / divisor;
  const fraction = normalized % divisor;
  const fractionLabel = fraction.toString().padStart(36, '0').replace(/0+$/, '');

  return trimDecimalLabel(fractionLabel ? `${whole.toString()}.${fractionLabel}` : whole.toString());
}

function formatUnixSecondsTimestamp(value: unknown, locale: string, fallback = '--') {
  const normalized = normalizeBigintLike(value);

  if (normalized <= 0n) {
    return fallback;
  }

  return formatLocalizedDateTime(Number(normalized * 1_000n), {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }, locale);
}

function normalizeStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeValidatorStringAddress(value: string) {
  return value.startsWith('0x') && isAddress(value) ? value.toLowerCase() : value;
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

function toReadableDecCoinCollection(items: EvmDistributionDecCoin[] | undefined) {
  return formatReadableDecCoinCollection(
    (items ?? []).map((item) => ({
      denom: item.denom ?? '',
      amount: formatDecCoinAmount(item),
    })),
  );
}

function RewardTooltipValue({
  label,
  rawValues,
}: {
  label: string;
  rawValues: string[];
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current != null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function openTooltip() {
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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-w-0 max-w-full items-center text-left outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400"
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="truncate">{label || '0'}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block space-y-1">
          {(rawValues.length ? rawValues : ['0']).map((item) => (
            <span key={item} className="block select-text break-all">
              {item}
            </span>
          ))}
        </span>
      </FloatingTooltip>
    </>
  );
}

function RewardSummaryRow({ label, value, actionLabel, onAction }: { label: string; value: ReactNode; actionLabel?: string; onAction?: () => void }) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-3 border-t border-slate-200 px-5 py-4 first:border-t-0 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-medium text-slate-500">{translateRuntimeText(label, locale)}</p>
      <p className="min-w-0 break-words text-sm font-semibold text-slate-900">{value || '0'}</p>
      {actionLabel && onAction ? (
        <span className="justify-self-start sm:justify-self-end">
          <ActionIconButton tooltip={translateRuntimeText(actionLabel, locale)} className="text-slate-400 hover:text-sky-600" onClick={onAction}>
            <IconFileDollar className="size-4" stroke={1.8} />
          </ActionIconButton>
        </span>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}

async function requestValidatorDetail(address: string, page: number): Promise<ValidatorOverviewData> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const validatorAddress = address as `0x${string}`;
  const pageRequest: PageRequest = {
    key: '0x',
    offset: BigInt((page - 1) * PAGE_SIZE),
    limit: BigInt(PAGE_SIZE),
    countTotal: true,
    reverse: false,
  };

  const [validator, [delegations, pageResponse], [unbondingDelegations, unbondingPageResponse], currentRewards, outstandingRewards, commissionRewards, distributionInfo] = await Promise.all([
    client.readContract({
      address: EVM_STAKING_PRECOMPILE_ADDRESS,
      abi: EVM_STAKING_ABI,
      functionName: 'validator',
      args: [validatorAddress],
    }) as Promise<EvmStakingValidator>,
    client.readContract({
      address: EVM_STAKING_PRECOMPILE_ADDRESS,
      abi: EVM_STAKING_ABI,
      functionName: 'validatorDelegations',
      args: [validatorAddress, pageRequest],
    }) as Promise<readonly [EvmStakingDelegationResponse[], EvmStakingPageResponse]>,
    client.readContract({
      address: EVM_STAKING_PRECOMPILE_ADDRESS,
      abi: EVM_STAKING_ABI,
      functionName: 'validatorUnbondingDelegations',
      args: [validatorAddress, pageRequest],
    }) as Promise<readonly [EvmUnbondingDelegationResponse[], EvmStakingPageResponse]>,
    client.readContract({
      address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
      abi: EVM_DISTRIBUTION_ABI,
      functionName: 'validatorCurrentRewards',
      args: [validatorAddress],
    }) as Promise<{ rewards?: EvmDistributionDecCoin[]; period?: bigint | number | string }>,
    client.readContract({
      address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
      abi: EVM_DISTRIBUTION_ABI,
      functionName: 'validatorOutstandingRewards',
      args: [validatorAddress],
    }) as Promise<EvmDistributionDecCoin[]>,
    client.readContract({
      address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
      abi: EVM_DISTRIBUTION_ABI,
      functionName: 'validatorCommission',
      args: [validatorAddress],
    }) as Promise<EvmDistributionDecCoin[]>,
    client.readContract({
      address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
      abi: EVM_DISTRIBUTION_ABI,
      functionName: 'validatorDistributionInfo',
      args: [validatorAddress],
    }) as Promise<EvmDistributionInfo>,
  ]);

  return {
    validator,
    delegations,
    unbondingDelegations,
    currentRewards: currentRewards.rewards ?? [],
    outstandingRewards,
    commissionRewards,
    distributionInfo,
    totalDelegations: Number(normalizeBigintLike(pageResponse.total)),
    totalUnbondingDelegations: Number(normalizeBigintLike(unbondingPageResponse.total)),
  };
}

export default function EvmQuarixValidatorPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixEvmValidators;
  const params = useParams<{ address: string }>();
  const address = typeof params.address === 'string' ? params.address : '';
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'json'>('overview');
  const [data, setData] = useState<ValidatorOverviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [pendingAction, setPendingAction] = useState<'stake' | 'commission' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const unlockDialog = useEvmPrivateKeyUnlockDialog();
  const { showToast } = useToast();

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();
    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    if (!isAddress(address)) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await requestValidatorDetail(address, page);

        if (!cancelled) {
          setData(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setData(null);
          setErrorMessage(error instanceof Error ? error.message : pageMessages.failedToLoadFallback);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [address, page, pageMessages.failedToLoadFallback, refreshVersion]);

  const isValidAddress = isAddress(address);

  async function submitRewardWithdrawal(kind: 'stake' | 'commission', password?: string) {
    if (!activeKey) {
      setFormError(pageMessages.noActiveKey);
      return;
    }

    if (!data?.validator.operatorAddress) {
      setFormError(pageMessages.invalidValidatorAddress);
      return;
    }

    setPendingAction(kind);
    setSubmitting(true);
    setFormError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);

      unlockDialog.handleUnlockResolved();

      await writeEvmContractMethodDirect({
        address: EVM_DISTRIBUTION_PRECOMPILE_ADDRESS,
        abiJson: JSON.stringify(EVM_DISTRIBUTION_ABI),
        functionSignature: kind === 'commission' ? 'withdrawValidatorCommission(address)' : 'withdrawDelegatorRewards(address,address)',
        rawArgs: kind === 'commission' ? [address] : [activeKey.address, address],
        privateKey,
        value: '0',
      });

      showToast({
        title: kind === 'commission' ? pageMessages.commissionWithdrawBroadcasted : pageMessages.withdrawBroadcasted,
        description: data.validator.operatorAddress,
      });

      setRefreshVersion((current) => current + 1);
      setPendingAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : pageMessages.failedToBroadcastWithdrawal;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        unlockDialog.openDialog();
      } else if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setFormError(message);
      }
    } finally {
      if (password) {
        setPendingAction(null);
      }
      setSubmitting(false);
    }
  }

  const validator = data?.validator ?? null;
  const statusKey = formatValidatorStatusKey(validator?.status);
  const statusTone = statusKey === 'bonded' ? 'success' : statusKey === 'unbonding' ? 'warning' : 'neutral';
  const statusLabel =
    statusKey === 'bonded'
      ? pageMessages.bonded
      : statusKey === 'unbonding'
        ? pageMessages.unbonding
        : statusKey === 'unbonded'
          ? pageMessages.unbonded
          : pageMessages.unknown;

  if (!isValidAddress) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{pageMessages.invalidValidatorAddressTitle}</h1>
          <p>{pageMessages.invalidValidatorAddressDescription}</p>
        </main>
      </AppShell>
    );
  }

  if (!data) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-32" groups={3} rowsPerGroup={4} secondaryCard={true} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>{pageMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === 'overview' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('overview')}
          >
            {messages.navigation.overview}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            JSON
          </button>
        </div>

        {activeTab === 'overview' ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="mb-3">
                <p className="text-base font-semibold text-slate-900">{pageMessages.validatorOverview}</p>
                <p className="mt-1 text-sm text-slate-500">{pageMessages.validatorOverviewDescription}</p>
              </div>

              <dl>
                <DetailGroup>
                  <DetailRow label={pageMessages.moniker} value={validator?.description?.moniker ?? validator?.operatorAddress ?? '-'} />
                  <DetailRow label={pageMessages.status} value={<DetailTag tone={statusTone}>{statusLabel}</DetailTag>} />
                  <DetailRow label={pageMessages.jailed} value={<DetailTag tone={validator?.jailed ? 'danger' : 'neutral'}>{validator?.jailed ? pageMessages.jailedYes : pageMessages.jailedNo}</DetailTag>} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow
                    label={pageMessages.address}
                    value={
                      <Link className="text-sky-600 hover:text-sky-700" href={`/evm/address/${address}`}>
                        {address}
                      </Link>
                    }
                    mono
                  />
                  <DetailRow label={pageMessages.pubkey} value={validator?.consensusPubkey ?? '-'} mono />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label={pageMessages.totalStaking} value={formatScaled18Label(validator?.tokens, locale)} />
                  <DetailRow label={pageMessages.commission} value={formatScaled18PercentLabel(validator?.commission, locale)} />
                  <DetailRow label={pageMessages.minSelfDelegation} value={formatScaled18Label(validator?.minSelfDelegation, locale)} />
                  <DetailRow label={pageMessages.validatorDelegations} value={String(data.totalDelegations)} />
                </DetailGroup>
                <DetailGroup>
                  <DetailRow label={pageMessages.identity} value={validator?.description?.identity ?? '-'} />
                  <DetailRow
                    label={pageMessages.website}
                    value={
                      validator?.description?.website ? (
                        <a className="text-sky-600 hover:text-sky-700" href={validator.description.website} rel="noreferrer" target="_blank">
                          {validator.description.website}
                        </a>
                      ) : (
                        '-'
                      )
                    }
                  />
                  <DetailRow label={pageMessages.securityContact} value={validator?.description?.securityContact ?? '-'} />
                  <DetailRow label={pageMessages.details} value={validator?.description?.details ?? '-'} />
                </DetailGroup>
              </dl>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">{pageMessages.validatorDelegations}</p>
                  <p className="mt-1 text-sm text-slate-500">{pageMessages.delegationsDescription}</p>
                </div>
                <PaginationControls
                  page={page}
                  totalPages={Math.max(1, Math.ceil(data.totalDelegations / PAGE_SIZE))}
                  hasPreviousPage={page > 1}
                  hasNextPage={page * PAGE_SIZE < data.totalDelegations}
                  plain
                  onPageChange={setPage}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.delegator ?? 'Delegator'}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.amount}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.delegatorShares}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.delegations.length ? (
                      data.delegations.map((delegation, index) => {
                        const delegatorAddress = normalizeStringValue(delegation.delegatorAddress) ?? '--';
                        const delegatorHexAddress = decodeCosmosAddressToEvmHexAddress(delegatorAddress) ?? delegatorAddress;
                        const balanceAmount = delegation.balance?.amount != null ? String(delegation.balance.amount) : '0';
                        const balanceDenom = delegation.balance?.denom ?? '';
                        return (
                          <tr key={`${delegatorHexAddress}-${index}`} className="border-t border-slate-200">
                            <td className="px-5 py-3 text-sm">
                              <CosmosAddressLink
                                href={`/evm/address/${delegatorHexAddress}`}
                                label={delegatorHexAddress}
                                copyValue={delegatorHexAddress}
                              />
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-700">
                              {balanceDenom ? `${formatReadableTokenAmount(balanceAmount)} ${formatReadableDenom(balanceDenom)}` : formatReadableTokenAmount(balanceAmount)}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-900 mono">{formatDelegationSharesLabel(delegation.shares)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">
                          {pageMessages.emptyValidatorsLabel}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">{pageMessages.unbondingDelegationsDescription}</p>
                </div>
                <PaginationControls
                  page={page}
                  totalPages={Math.max(1, Math.ceil(data.totalUnbondingDelegations / PAGE_SIZE))}
                  hasPreviousPage={page > 1}
                  hasNextPage={page * PAGE_SIZE < data.totalUnbondingDelegations}
                  plain
                  onPageChange={setPage}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.delegator ?? 'Delegator'}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.amount}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.creationHeight}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.unbondingId}</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.completionTime}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unbondingDelegations.length ? (
                      data.unbondingDelegations.flatMap((unbonding) =>
                        (unbonding.entries ?? []).map((entry, index) => {
                          const delegatorAddress = normalizeStringValue(unbonding.delegatorAddress) ?? '--';
                          const delegatorHexAddress = decodeCosmosAddressToEvmHexAddress(delegatorAddress) ?? delegatorAddress;
                          return (
                            <tr key={`${delegatorHexAddress}-${String(entry.unbondingId ?? index)}-${index}`} className="border-t border-slate-200">
                              <td className="px-5 py-3 text-sm">
                                <CosmosAddressLink
                                  href={`/evm/address/${delegatorHexAddress}`}
                                  label={delegatorHexAddress}
                                  copyValue={delegatorHexAddress}
                                />
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-700">{formatReadableTokenAmount(String(entry.balance ?? '0'))}</td>
                              <td className="px-5 py-3 text-sm text-slate-900 mono">{String(entry.creationHeight ?? '0')}</td>
                              <td className="px-5 py-3 text-sm text-slate-900 mono">{String(entry.unbondingId ?? '0')}</td>
                              <td className="px-5 py-3 text-sm text-slate-700">{formatUnixSecondsTimestamp(entry.completionTime, locale)}</td>
                            </tr>
                          );
                        }),
                      )
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                          {pageMessages.noUnbondingDelegationsReturned}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">{pageMessages.rewards}</p>
                <p className="mt-1 text-sm text-slate-500">{pageMessages.rewardsDescription}</p>
              </div>
              <div>
                <RewardSummaryRow
                  label={pageMessages.stakeRewards}
                  value={
                    <RewardTooltipValue
                      label={translateRuntimeText(toReadableDecCoinCollection(data.currentRewards), locale)}
                      rawValues={data.currentRewards.map((item) => `${formatDecCoinAmount(item)} ${item.denom ?? ''}`)}
                    />
                  }
                  actionLabel={pageMessages.withdraw}
                  onAction={() => void submitRewardWithdrawal('stake')}
                />
                <RewardSummaryRow
                  label={pageMessages.commissionRewards}
                  value={
                    <RewardTooltipValue
                      label={translateRuntimeText(toReadableDecCoinCollection(data.commissionRewards), locale)}
                      rawValues={data.commissionRewards.map((item) => `${formatDecCoinAmount(item)} ${item.denom ?? ''}`)}
                    />
                  }
                  actionLabel={pageMessages.withdraw}
                  onAction={() => void submitRewardWithdrawal('commission')}
                />
                <RewardSummaryRow
                  label={pageMessages.outstandingRewards}
                  value={
                    <RewardTooltipValue
                      label={translateRuntimeText(toReadableDecCoinCollection(data.outstandingRewards), locale)}
                      rawValues={data.outstandingRewards.map((item) => `${formatDecCoinAmount(item)} ${item.denom ?? ''}`)}
                    />
                  }
                />
              </div>
            </div>

            {formError ? <p className="overflow-hidden break-all whitespace-pre-wrap rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{translateRuntimeText(formError, locale)}</p> : null}
          </section>
        ) : null}

        {activeTab === 'json' ? (
          <JsonViewPanel
            value={
              {
                validator: data.validator,
                delegations: data.delegations,
                unbondingDelegations: data.unbondingDelegations,
                currentRewards: data.currentRewards,
                outstandingRewards: data.outstandingRewards,
                commissionRewards: data.commissionRewards,
                distributionInfo: data.distributionInfo,
              } as object
            }
          />
        ) : null}

        <EvmPrivateKeyUnlockDialog
          open={unlockDialog.open}
          password={unlockDialog.password}
          errorMessage={unlockDialog.errorMessage}
          submitting={submitting}
          title={pageMessages.unlockPrivateKey}
          description={activeKey ? pageMessages.unlockWithdrawalDescription.replace('{name}', activeKey.name) : pageMessages.unlockFallbackDescription}
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
            if (pendingAction === 'stake') {
              void submitRewardWithdrawal('stake', unlockDialog.password);
              return;
            }

            if (pendingAction === 'commission') {
              void submitRewardWithdrawal('commission', unlockDialog.password);
            }
          }}
        />
      </main>
    </AppShell>
  );
}
