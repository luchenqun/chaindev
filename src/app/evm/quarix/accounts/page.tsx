'use client';

import { fromBech32 } from '@cosmjs/encoding';
import { IconArrowsExchange, IconCircleMinus, IconCirclePlus, IconCode, IconRefresh, IconShieldOff, IconShieldX, IconUserCheck, IconUserX } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bytesToHex, formatEther, isAddress, type Abi } from 'viem';
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
import { getEvmChainState, subscribeEvmChainState } from '@/domains/evm/client/chain-state';
import { writeEvmContractMethodDirect } from '@/domains/evm/client/contract-executor';
import { getActiveEvmStoredPrivateKey, isEvmStoredPrivateKeyUnlocked, resolveEvmStoredPrivateKey, subscribeEvmKeyring, type EvmStoredPrivateKey } from '@/domains/evm/client/keyring';
import { createEvmClient } from '@/domains/evm/client/rpc-client';
import { getActiveEvmCurrencyNameClient } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { EvmPrivateKeyUnlockDialog, useEvmPrivateKeyUnlockDialog } from '@/domains/evm/ui/private-key-unlock-dialog';
import { EVM_AUTH_ADDRESS, EVM_BLACKLIST_ADDRESS, EVM_SERVICE_PROVIDER_ADDRESS, EVM_SERVICE_ROLE_ADDRESS, EVM_SERVICE_WRAPPER_ADDRESS } from '@/domains/evm/lib/precompile-artifact-default-addresses';
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

type EvmAuthAccountsResponse = {
  accounts?: unknown[];
  pagination?: {
    next_key?: string | null;
    total?: string | number;
  };
};

type EvmAuthAccountsJsonPayload = EvmAuthAccountsResponse | unknown[];

type EvmAuthPageResponse = {
  nextKey?: `0x${string}` | string;
  total?: bigint | number | string;
};

type QuarixEvmAccountItem = {
  evmAddress: string | null;
  cosmosAddress: string | null;
  type: string | null;
  isModuleAccount: boolean;
  permissions: string[];
  sequence: string | null;
  balanceLabel: string;
  balanceExactLabel: string;
  kycStatus: QuarixAccountFlagStatus;
  blacklistStatus: QuarixAccountFlagStatus;
  roles: string[];
  rolesLabel: string;
};

type QuarixEvmAccountsState = {
  accounts: QuarixEvmAccountItem[];
  response: EvmAuthAccountsResponse;
  page: number;
  pageSize: number;
  totalAccounts: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type QuarixAccountFlagStatus = 'yes' | 'no' | 'unknown';
type AccountActionDialogKind = 'grantKyc' | 'revokeKyc' | 'addBlacklist' | 'removeBlacklist' | 'addRole' | 'removeRole';

const QUARIX_ACCOUNT_ROLE_OPTIONS = ['QOE', 'Validator', 'Developer'] as const;
type QuarixAccountRoleName = (typeof QUARIX_ACCOUNT_ROLE_OPTIONS)[number];

const EVM_AUTH_PRECOMPILE_ADDRESS = EVM_AUTH_ADDRESS as `0x${string}`;
const EVM_BLACKLIST_PRECOMPILE_ADDRESS = EVM_BLACKLIST_ADDRESS as `0x${string}`;
const EVM_SERVICE_PROVIDER_PRECOMPILE_ADDRESS = EVM_SERVICE_PROVIDER_ADDRESS as `0x${string}`;
const EVM_SERVICE_ROLE_PRECOMPILE_ADDRESS = EVM_SERVICE_ROLE_ADDRESS as `0x${string}`;
const EVM_SERVICE_WRAPPER_PRECOMPILE_ADDRESS = EVM_SERVICE_WRAPPER_ADDRESS as `0x${string}`;
const EVM_AUTH_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmAuth')?.abi ?? []) as Abi;
const EVM_BLACKLIST_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmBlacklist')?.abi ?? []) as Abi;
const EVM_SERVICE_PROVIDER_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmServiceProvider')?.abi ?? []) as Abi;
const EVM_SERVICE_ROLE_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmServiceRole')?.abi ?? []) as Abi;
const EVM_SERVICE_WRAPPER_ABI = (EVM_SYSTEM_ARTIFACTS.find((artifact) => artifact.contractName === 'EvmServiceWrapper')?.abi ?? []) as Abi;

const PAGE_SIZE = 15;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const QUARIX_KYC_ACCOUNT_KIND = 0;
const QUARIX_KYC_PERMISSION_MASK = 1099511627791n;
type AddressDisplayMode = 'hex' | 'bech32';

function getActiveEvmProfile() {
  const profile = readActiveRpcProfileCookie('evm');

  if (!profile) {
    throw new Error('No active EVM provider selected.');
  }

  return profile;
}

function normalizeAddressCandidate(value: unknown) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
}

function normalizeStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeNumberLikeValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function deriveEvmAddressFromCosmosAddress(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const { data } = fromBech32(value);

    if (data.length < 20) {
      return null;
    }

    return bytesToHex(data.slice(-20));
  } catch {
    return null;
  }
}

function formatEvmAddressForDisplay(input: { evmAddress: string | null; cosmosAddress: string | null }, mode: AddressDisplayMode) {
  if (mode === 'bech32') {
    return input.cosmosAddress ?? input.evmAddress ?? null;
  }

  return input.evmAddress ?? input.cosmosAddress ?? null;
}

function formatBalanceLabel(value: bigint) {
  const amount = Number(formatEther(value));

  if (!Number.isFinite(amount) || amount === 0) {
    return '0';
  }

  if (amount < 0.000001) {
    return '<0.000001';
  }

  return amount.toFixed(amount < 1 ? 6 : 4).replace(/\.?0+$/, '');
}

function formatExactBalanceLabel(value: bigint, currencyName: string) {
  return `${formatEther(value)} ${currencyName}`;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function formatAccountTypeLabel(record: Record<string, unknown>) {
  const rawType = normalizeStringValue(record['@type']) ?? normalizeStringValue(record.type);
  const module = resolveNestedRecord(record, 'module');
  const moduleName =
    normalizeStringValue(record.name) ??
    normalizeStringValue(record.module_name) ??
    normalizeStringValue(record.moduleName) ??
    normalizeStringValue(module?.name) ??
    normalizeStringValue(module?.module_name) ??
    normalizeStringValue(module?.moduleName);
  const permissions = [
    ...normalizeStringArray(record.permissions),
    ...normalizeStringArray(module?.permissions),
  ];

  if (moduleName) {
    return {
      label: moduleName,
      isModuleAccount: true,
      permissions,
    };
  }

  if (!rawType) {
    return {
      label: null,
      isModuleAccount: false,
      permissions: [],
    };
  }

  const normalizedType = rawType.replace(/^\//, '');

  if (normalizedType === 'cosmos.auth.v1beta1.BaseAccount') {
    return {
      label: 'Base Account',
      isModuleAccount: false,
      permissions: [],
    };
  }

  const lastSegment = normalizedType.split('.').at(-1) ?? normalizedType;
  return {
    label: lastSegment.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    isModuleAccount: false,
    permissions: [],
  };
}

function resolveNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function mapAccountItem(item: unknown, index: number): QuarixEvmAccountItem | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const baseAccount = resolveNestedRecord(record, 'base_account') ?? resolveNestedRecord(record, 'baseAccount');
  const evmAccount = resolveNestedRecord(record, 'base_vesting_account') ?? resolveNestedRecord(record, 'baseVestingAccount');
  const source = baseAccount ?? evmAccount ?? record;

  const cosmosAddress =
    normalizeStringValue(source.address) ??
    normalizeStringValue(record.address) ??
    normalizeStringValue(resolveNestedRecord(record, 'account')?.address) ??
    null;
  const evmAddress =
    normalizeAddressCandidate(record.evm_address) ??
    normalizeAddressCandidate(record.evmAddress) ??
    normalizeAddressCandidate(source.evm_address) ??
    normalizeAddressCandidate(source.evmAddress) ??
    normalizeAddressCandidate(record.address) ??
    deriveEvmAddressFromCosmosAddress(cosmosAddress);
  const accountType = formatAccountTypeLabel(record);

  return {
    evmAddress,
    cosmosAddress,
    type: accountType.label,
    isModuleAccount: accountType.isModuleAccount,
    permissions: accountType.permissions,
    sequence: normalizeNumberLikeValue(source.sequence),
    balanceLabel: '0',
    balanceExactLabel: '0',
    kycStatus: 'unknown',
    blacklistStatus: 'unknown',
    roles: [],
    rolesLabel: '-',
  } satisfies QuarixEvmAccountItem;
}

function normalizeFlagStatus(value: unknown): QuarixAccountFlagStatus {
  return typeof value === 'boolean' ? (value ? 'yes' : 'no') : 'unknown';
}

function getKycExpireTimestamp() {
  return Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS;
}

function normalizeRoles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function formatRolesLabel(roles: string[]) {
  return roles.length ? roles.join(', ') : '-';
}

function isQuarixAccountRoleName(value: string): value is QuarixAccountRoleName {
  return (QUARIX_ACCOUNT_ROLE_OPTIONS as readonly string[]).includes(value);
}

function resolveDefaultRoleName(roles: string[]) {
  return roles.find(isQuarixAccountRoleName) ?? QUARIX_ACCOUNT_ROLE_OPTIONS[0];
}

function getFlagStatusClasses(status: QuarixAccountFlagStatus, trueTone: 'positive' | 'danger') {
  if (status === 'yes') {
    return trueTone === 'danger' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700';
  }

  return 'bg-slate-100 text-slate-500';
}

function QuarixAccountFlagBadge({
  status,
  trueLabel,
  falseLabel,
  unknownLabel,
  trueTone,
}: {
  status: QuarixAccountFlagStatus;
  trueLabel: string;
  falseLabel: string;
  unknownLabel: string;
  trueTone: 'positive' | 'danger';
}) {
  const label = status === 'yes' ? trueLabel : status === 'no' ? falseLabel : unknownLabel;

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getFlagStatusClasses(status, trueTone)}`}>{label}</span>;
}

function QuarixAccountRolesCell({
  label,
  emptyLabel,
}: {
  label: string;
  emptyLabel: string;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const hasRoles = label !== '-';

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
        className={hasRoles ? 'inline-flex min-w-0 max-w-full items-center text-left text-slate-700 outline-none transition hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-400' : 'inline-flex text-slate-500'}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        <span className="truncate">{label}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{hasRoles ? label : emptyLabel}</span>
      </FloatingTooltip>
    </>
  );
}

function QuarixAccountActionsCell({
  account,
  disabled,
  pageMessages,
  onAction,
}: {
  account: QuarixEvmAccountItem;
  disabled: boolean;
  pageMessages: ReturnType<typeof useMessages>['quarixEvmAccounts'];
  onAction: (kind: AccountActionDialogKind, address?: string | null, roleName?: QuarixAccountRoleName) => void;
}) {
  const address = account.evmAddress;
  const hasKyc = account.kycStatus === 'yes';
  const isBlacklisted = account.blacklistStatus === 'yes';
  const existingRoleName = account.roles.find(isQuarixAccountRoleName);
  const roleName = resolveDefaultRoleName(account.roles);

  return (
    <div className="flex items-center justify-end gap-0">
      <ActionIconButton
        tooltip={hasKyc ? pageMessages.revokeKyc : pageMessages.grantKyc}
        aria-label={hasKyc ? pageMessages.revokeKyc : pageMessages.grantKyc}
        className={`h-7 w-7 rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-40 ${hasKyc ? 'hover:text-rose-600' : 'hover:text-emerald-600'}`}
        disabled={disabled || !address}
        onClick={() => onAction(hasKyc ? 'revokeKyc' : 'grantKyc', address)}
      >
        {hasKyc ? <IconUserX className="size-4" stroke={1.8} /> : <IconUserCheck className="size-4" stroke={1.8} />}
      </ActionIconButton>
      <ActionIconButton
        tooltip={isBlacklisted ? pageMessages.removeBlacklist : pageMessages.addBlacklist}
        aria-label={isBlacklisted ? pageMessages.removeBlacklist : pageMessages.addBlacklist}
        className={`h-7 w-7 rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-40 ${isBlacklisted ? 'hover:text-emerald-600' : 'hover:text-rose-600'}`}
        disabled={disabled || !address}
        onClick={() => onAction(isBlacklisted ? 'removeBlacklist' : 'addBlacklist', address)}
      >
        {isBlacklisted ? <IconShieldOff className="size-4" stroke={1.8} /> : <IconShieldX className="size-4" stroke={1.8} />}
      </ActionIconButton>
      <ActionIconButton
        tooltip={existingRoleName ? pageMessages.removeRole : pageMessages.addRole}
        aria-label={existingRoleName ? pageMessages.removeRole : pageMessages.addRole}
        className={`h-7 w-7 rounded-md text-slate-400 disabled:cursor-not-allowed disabled:opacity-40 ${existingRoleName ? 'hover:text-rose-600' : 'hover:text-emerald-600'}`}
        disabled={disabled || !address}
        onClick={() => onAction(existingRoleName ? 'removeRole' : 'addRole', address, roleName)}
      >
        {existingRoleName ? <IconCircleMinus className="size-4" stroke={1.8} /> : <IconCirclePlus className="size-4" stroke={1.8} />}
      </ActionIconButton>
    </div>
  );
}

function ModuleAccountTypeBadge({
  label,
  permissions,
}: {
  label: string;
  permissions: string[];
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
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
      <span
        ref={triggerRef}
        className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 outline-none"
        tabIndex={0}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        onFocus={openTooltip}
        onBlur={closeTooltipSoon}
      >
        {label}
      </span>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[320px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Permissions</p>
          {permissions.length ? (
            permissions.map((permission) => (
              <p key={permission} className="break-all text-sm">
                {permission}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-500">No permissions</p>
          )}
        </div>
      </FloatingTooltip>
    </>
  );
}

function EvmAccountBalanceTooltip({
  label,
  exactLabel,
}: {
  label: string;
  exactLabel: string;
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
        <span className="truncate">{label}</span>
      </button>
      <FloatingTooltip
        open={tooltipOpen}
        anchorRef={triggerRef}
        interactive
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltipSoon}
        className="max-w-[520px] whitespace-normal border border-slate-200 bg-white text-slate-700"
      >
        <span className="block select-text break-all">{exactLabel}</span>
      </FloatingTooltip>
    </>
  );
}

async function requestQuarixEvmAccountFlags(client: ReturnType<typeof createEvmClient>, accounts: QuarixEvmAccountItem[]) {
  const targetAccounts = accounts.filter((account): account is QuarixEvmAccountItem & { evmAddress: `0x${string}` } => Boolean(account.evmAddress?.startsWith('0x')));
  const flagsByAddress = new Map<string, { kycStatus: QuarixAccountFlagStatus; blacklistStatus: QuarixAccountFlagStatus; roles: string[]; rolesLabel: string }>();

  if (!targetAccounts.length) {
    return flagsByAddress;
  }

  // createEvmTransport batches concurrent HTTP eth_call requests into one
  // JSON-RPC array payload, without depending on an on-chain Multicall contract.
  const results = await Promise.allSettled(
    targetAccounts.flatMap((account) => [
      client.readContract({
        address: EVM_SERVICE_WRAPPER_PRECOMPILE_ADDRESS,
        abi: EVM_SERVICE_WRAPPER_ABI,
        functionName: 'kybkycStatusV2',
        args: [account.evmAddress, QUARIX_KYC_ACCOUNT_KIND, QUARIX_KYC_PERMISSION_MASK],
      }),
      client.readContract({
        address: EVM_BLACKLIST_PRECOMPILE_ADDRESS,
        abi: EVM_BLACKLIST_ABI,
        functionName: 'inBlacklist',
        args: [account.evmAddress],
      }),
      client.readContract({
        address: EVM_SERVICE_ROLE_PRECOMPILE_ADDRESS,
        abi: EVM_SERVICE_ROLE_ABI,
        functionName: 'getAddressRole',
        args: [account.evmAddress],
      }),
    ]),
  );

  targetAccounts.forEach((account, index) => {
    const resultOffset = index * 3;
    const kycResult = results[resultOffset];
    const blacklistResult = results[resultOffset + 1];
    const rolesResult = results[resultOffset + 2];
    const roles = rolesResult?.status === 'fulfilled' ? normalizeRoles(rolesResult.value) : [];

    flagsByAddress.set(account.evmAddress.toLowerCase(), {
      kycStatus: kycResult?.status === 'fulfilled' ? normalizeFlagStatus(kycResult.value) : 'unknown',
      blacklistStatus: blacklistResult?.status === 'fulfilled' ? normalizeFlagStatus(blacklistResult.value) : 'unknown',
      roles,
      rolesLabel: formatRolesLabel(roles),
    });
  });

  return flagsByAddress;
}

async function requestQuarixEvmAccounts(requestedPage: number, options?: { includeQuarixFlags?: boolean }): Promise<QuarixEvmAccountsState> {
  const profile = getActiveEvmProfile();
  const client = createEvmClient(profile.rpcUrl);
  const currencyName = getActiveEvmCurrencyNameClient();
  const page = Math.max(1, Math.trunc(requestedPage));
  const pageRequest: PageRequest = {
    key: '0x',
    offset: BigInt((page - 1) * PAGE_SIZE),
    limit: BigInt(PAGE_SIZE),
    countTotal: true,
    reverse: false,
  };

  const result = (await client.readContract({
    address: EVM_AUTH_PRECOMPILE_ADDRESS,
    abi: EVM_AUTH_ABI,
    functionName: 'accountsAsJSON',
    args: [pageRequest],
  })) as readonly [string, EvmAuthPageResponse];
  const [accountsJson, pageResponse] = result;

  const parsed = JSON.parse(accountsJson) as EvmAuthAccountsJsonPayload;
  const response = Array.isArray(parsed) ? ({ accounts: parsed } satisfies EvmAuthAccountsResponse) : parsed;
  const sourceAccounts = Array.isArray(parsed) ? parsed : Array.isArray(response.accounts) ? response.accounts : [];
  const mappedAccounts = sourceAccounts.map(mapAccountItem).filter((item): item is QuarixEvmAccountItem => item != null);
  const balanceEntries = await Promise.allSettled(
    mappedAccounts.map(async (account) => {
      if (!account.evmAddress) {
        return [account.evmAddress, null] as const;
      }

      const balance = await client.getBalance({ address: account.evmAddress as `0x${string}` });
      return [account.evmAddress, balance] as const;
    }),
  );
  const balancesByAddress = new Map<string, bigint>();

  for (const entry of balanceEntries) {
    if (entry.status !== 'fulfilled') {
      continue;
    }

    const [address, balance] = entry.value;

    if (address && balance != null) {
      balancesByAddress.set(address.toLowerCase(), balance);
    }
  }

  const accountFlagsByAddress = options?.includeQuarixFlags ? await requestQuarixEvmAccountFlags(client, mappedAccounts) : new Map<string, { kycStatus: QuarixAccountFlagStatus; blacklistStatus: QuarixAccountFlagStatus; roles: string[]; rolesLabel: string }>();
  const accounts = mappedAccounts.map((account) => {
    const accountFlags = account.evmAddress ? accountFlagsByAddress.get(account.evmAddress.toLowerCase()) : null;
    const balance = account.evmAddress ? (balancesByAddress.get(account.evmAddress.toLowerCase()) ?? 0n) : 0n;

    return {
      ...account,
      balanceLabel: formatBalanceLabel(balance),
      balanceExactLabel: formatExactBalanceLabel(balance, currencyName),
      kycStatus: accountFlags?.kycStatus ?? 'unknown',
      blacklistStatus: accountFlags?.blacklistStatus ?? 'unknown',
      roles: accountFlags?.roles ?? [],
      rolesLabel: accountFlags?.rolesLabel ?? '-',
    };
  });
  const pageResponseTotal = Number.parseInt(String(pageResponse?.total ?? ''), 10);
  const jsonPaginationTotal = Number.parseInt(String(response.pagination?.total ?? ''), 10);
  const totalAccounts = Math.max(accounts.length, Number.isFinite(pageResponseTotal) ? pageResponseTotal : 0, Number.isFinite(jsonPaginationTotal) ? jsonPaginationTotal : 0);
  const totalPages = Math.max(1, Math.ceil(totalAccounts / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const hasNextPage = Boolean(pageResponse?.nextKey && pageResponse.nextKey !== '0x') || normalizedPage < totalPages;

  return {
    accounts,
    response,
    page: normalizedPage,
    pageSize: PAGE_SIZE,
    totalAccounts,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage,
  };
}

export default function EvmQuarixAccountsPage() {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixEvmAccounts;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const currentPage = parsePageParam(searchParams.get('page'));
  const [data, setData] = useState<QuarixEvmAccountsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [addressDisplayMode, setAddressDisplayMode] = useState<AddressDisplayMode>('hex');
  const [showQuarixAccountFlags, setShowQuarixAccountFlags] = useState(() => getEvmChainState().isQuarix);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [actionDialogKind, setActionDialogKind] = useState<AccountActionDialogKind | null>(null);
  const [actionAddress, setActionAddress] = useState('');
  const [actionRoleName, setActionRoleName] = useState<QuarixAccountRoleName>('QOE');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const hasLoadedDataRef = useRef(false);
  const unlockDialog = useEvmPrivateKeyUnlockDialog();

  function handlePageChange(page: number) {
    router.push(buildPageHref(pathname, new URLSearchParams(searchParamsText), page));
  }

  useEffect(() => {
    setShowQuarixAccountFlags(getEvmChainState().isQuarix);
    return subscribeEvmChainState((state) => setShowQuarixAccountFlags(state.isQuarix));
  }, []);

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
      const isInitialLoad = !hasLoadedDataRef.current;

      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await requestQuarixEvmAccounts(currentPage, { includeQuarixFlags: showQuarixAccountFlags });

        if (!cancelled) {
          setData(next);
          hasLoadedDataRef.current = true;
          setErrorMessage(null);

          if (next.page !== currentPage) {
            router.replace(buildPageHref(pathname, new URLSearchParams(searchParamsText), next.page));
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
  }, [currentPage, pageMessages.failedToLoadFallback, pathname, refreshVersion, router, searchParamsText, showQuarixAccountFlags]);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const actionDialogTitle =
    actionDialogKind === 'grantKyc'
      ? pageMessages.grantKyc
      : actionDialogKind === 'revokeKyc'
        ? pageMessages.revokeKyc
        : actionDialogKind === 'removeBlacklist'
          ? pageMessages.removeBlacklist
          : actionDialogKind === 'addRole'
            ? pageMessages.addRole
            : actionDialogKind === 'removeRole'
              ? pageMessages.removeRole
              : pageMessages.addBlacklist;
  const actionDialogDescription = activeKey
    ? (
        actionDialogKind === 'grantKyc'
          ? pageMessages.grantKycDescription
          : actionDialogKind === 'revokeKyc'
            ? pageMessages.revokeKycDescription
            : actionDialogKind === 'removeBlacklist'
              ? pageMessages.removeBlacklistDescription
              : actionDialogKind === 'addRole'
                ? pageMessages.addRoleDescription
                : actionDialogKind === 'removeRole'
                  ? pageMessages.removeRoleDescription
                  : pageMessages.addBlacklistDescription
      ).replace('{name}', activeKey.name)
    : messages.evmTxDetail.selectGlobalKeyFirst;
  const showRoleSelect = actionDialogKind === 'addRole' || actionDialogKind === 'removeRole';

  function openActionDialog(kind: AccountActionDialogKind, address?: string | null, roleName?: QuarixAccountRoleName) {
    setActionDialogKind(kind);
    setActionAddress(address ?? '');
    setActionRoleName(roleName ?? 'QOE');
    setActionError(null);
  }

  function closeActionDialog() {
    setActionDialogKind(null);
    setActionAddress('');
    setActionRoleName('QOE');
    setActionError(null);
  }

  async function submitAccountAction(password?: string) {
    if (!actionDialogKind) {
      return;
    }

    if (!activeKey) {
      setActionError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    const normalizedAddress = actionAddress.trim();

    if (!normalizedAddress) {
      setActionError(pageMessages.addressRequired);
      return;
    }

    if (!isAddress(normalizedAddress)) {
      setActionError(pageMessages.invalidAddress);
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    unlockDialog.setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);

      unlockDialog.handleUnlockResolved();

      if (actionDialogKind === 'grantKyc') {
        await writeEvmContractMethodDirect({
          address: EVM_SERVICE_PROVIDER_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_SERVICE_PROVIDER_ABI),
          functionSignature: 'mintTo(address,uint256)',
          rawArgs: [normalizedAddress, String(getKycExpireTimestamp())],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.grantedKycTitle,
          description: normalizedAddress,
        });
      } else if (actionDialogKind === 'revokeKyc') {
        await writeEvmContractMethodDirect({
          address: EVM_SERVICE_PROVIDER_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_SERVICE_PROVIDER_ABI),
          functionSignature: 'burnFor(address)',
          rawArgs: [normalizedAddress],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.revokedKycTitle,
          description: normalizedAddress,
        });
      } else if (actionDialogKind === 'addBlacklist') {
        await writeEvmContractMethodDirect({
          address: EVM_BLACKLIST_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_BLACKLIST_ABI),
          functionSignature: 'addToBlacklist(address)',
          rawArgs: [normalizedAddress],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.addedBlacklistTitle,
          description: normalizedAddress,
        });
      } else if (actionDialogKind === 'removeBlacklist') {
        await writeEvmContractMethodDirect({
          address: EVM_BLACKLIST_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_BLACKLIST_ABI),
          functionSignature: 'removeFromBlacklist(address)',
          rawArgs: [normalizedAddress],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.removedBlacklistTitle,
          description: normalizedAddress,
        });
      } else if (actionDialogKind === 'addRole') {
        await writeEvmContractMethodDirect({
          address: EVM_SERVICE_ROLE_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_SERVICE_ROLE_ABI),
          functionSignature: 'attestRole(address,string)',
          rawArgs: [normalizedAddress, actionRoleName],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.addedRoleTitle,
          description: `${normalizedAddress} / ${actionRoleName}`,
        });
      } else {
        await writeEvmContractMethodDirect({
          address: EVM_SERVICE_ROLE_PRECOMPILE_ADDRESS,
          abiJson: JSON.stringify(EVM_SERVICE_ROLE_ABI),
          functionSignature: 'revokeRole(address,string)',
          rawArgs: [normalizedAddress, actionRoleName],
          privateKey,
          value: '0',
        });

        showToast({
          title: pageMessages.removedRoleTitle,
          description: `${normalizedAddress} / ${actionRoleName}`,
        });
      }

      closeActionDialog();
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : actionDialogKind === 'grantKyc'
            ? pageMessages.failedToGrantKycFallback
            : actionDialogKind === 'revokeKyc'
              ? pageMessages.failedToRevokeKycFallback
            : actionDialogKind === 'removeBlacklist'
              ? pageMessages.failedToRemoveBlacklistFallback
              : actionDialogKind === 'addRole'
                ? pageMessages.failedToAddRoleFallback
                : actionDialogKind === 'removeRole'
                  ? pageMessages.failedToRemoveRoleFallback
                  : pageMessages.failedToAddBlacklistFallback;

      if (unlockDialog.open) {
        unlockDialog.setErrorMessage(message);
      } else {
        setActionError(message);
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleActionSubmit() {
    if (!activeKey) {
      setActionError(messages.evmTxDetail.selectGlobalKeyFirst);
      return;
    }

    const normalizedAddress = actionAddress.trim();

    if (!normalizedAddress) {
      setActionError(pageMessages.addressRequired);
      return;
    }

    if (!isAddress(normalizedAddress)) {
      setActionError(pageMessages.invalidAddress);
      return;
    }

    if (!isEvmStoredPrivateKeyUnlocked(activeKey.id) && activeKey.securityMode === 'encrypted') {
      unlockDialog.openDialog();
      return;
    }

    await submitAccountAction();
  }

  if (loading && data == null) {
    return (
      <AppShell mode="evm">
        <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={showQuarixAccountFlags ? 7 : 4} toolbarIcons={1} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell mode="evm">
        <main className="content-panel">
          <h1>{pageMessages.title}</h1>
          <p>{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode="evm">
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{pageMessages.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{pageMessages.description}</p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {data.totalAccounts ? pageMessages.totalAccountsLabel.replace('{count}', data.totalAccounts.toLocaleString(locale)) : pageMessages.emptyAccountsLabel}
              </p>
            </div>
            <div className="flex items-center gap-0 lg:justify-end">
              <PaginationControls
                page={data.page}
                totalPages={data.totalPages}
                hasPreviousPage={data.hasPreviousPage}
                hasNextPage={data.hasNextPage}
                disabled={loading || refreshing}
                plain
                onPageChange={handlePageChange}
              />
              <ActionIconButton
                tooltip={addressDisplayMode === 'hex' ? messages.cosmosTxDetail.switchToBech32 : messages.cosmosTxDetail.switchToHex}
                className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-700"
                onClick={() => setAddressDisplayMode((current) => (current === 'hex' ? 'bech32' : 'hex'))}
              >
                <IconArrowsExchange className="size-4" stroke={1.8} />
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
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.grantKyc}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-emerald-600"
                  onClick={() => openActionDialog('grantKyc')}
                >
                  <IconUserCheck className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.revokeKyc}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-rose-600"
                  onClick={() => openActionDialog('revokeKyc')}
                >
                  <IconUserX className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.addBlacklist}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-rose-600"
                  onClick={() => openActionDialog('addBlacklist')}
                >
                  <IconShieldX className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.removeBlacklist}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-emerald-600"
                  onClick={() => openActionDialog('removeBlacklist')}
                >
                  <IconShieldOff className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.addRole}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-emerald-600"
                  onClick={() => openActionDialog('addRole')}
                >
                  <IconCirclePlus className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
              {showQuarixAccountFlags ? (
                <ActionIconButton
                  tooltip={pageMessages.removeRole}
                  className="h-8 w-8 rounded-md text-slate-400 hover:text-rose-600"
                  onClick={() => openActionDialog('removeRole')}
                >
                  <IconCircleMinus className="size-4" stroke={1.8} />
                </ActionIconButton>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`data-table table-fixed ${showQuarixAccountFlags ? 'min-w-[1280px]' : 'min-w-[900px]'}`}>
              <colgroup>
                <col className={showQuarixAccountFlags ? 'w-[430px]' : 'w-[360px]'} />
                <col className="w-[180px]" />
                <col className="w-[64px]" />
                {showQuarixAccountFlags ? <col className="w-[82px]" /> : null}
                {showQuarixAccountFlags ? <col className="w-[130px]" /> : null}
                {showQuarixAccountFlags ? <col className="w-[110px]" /> : null}
                <col className={showQuarixAccountFlags ? 'w-[170px]' : 'w-[180px]'} />
                {showQuarixAccountFlags ? <col className="w-[104px]" /> : null}
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosAccountDetail.balances}</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.sequence}</th>
                  {showQuarixAccountFlags ? <th className="border-b border-slate-200 px-3 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.kycStatus}</th> : null}
                  {showQuarixAccountFlags ? <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.roles}</th> : null}
                  {showQuarixAccountFlags ? <th className="border-b border-slate-200 px-3 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.blacklistStatus}</th> : null}
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.evmTxDetail.type}</th>
                  {showQuarixAccountFlags ? <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{pageMessages.actions}</th> : null}
                </tr>
              </thead>
              <tbody>
                {accounts.length ? (
                  accounts.map((account, index) => {
                    const displayAddress = formatEvmAddressForDisplay(account, addressDisplayMode);

                    return (
                      <tr key={`${account.evmAddress ?? account.cosmosAddress ?? index}-${index}`} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm">
                          {account.evmAddress?.startsWith('0x') && displayAddress ? (
                            <AddressLink address={displayAddress} href={`/evm/address/${account.evmAddress}`} label={displayAddress} className="font-medium text-sky-600 hover:text-sky-700" />
                          ) : displayAddress ? (
                            <span className="text-slate-700">{displayAddress}</span>
                          ) : (
                            <span className="text-slate-500">{pageMessages.unavailableValue}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                          <EvmAccountBalanceTooltip label={account.balanceLabel} exactLabel={account.balanceExactLabel} />
                        </td>
                        <td className="px-3 py-3 text-sm tabular-nums text-slate-700">{account.sequence ?? pageMessages.unavailableValue}</td>
                        {showQuarixAccountFlags ? (
                          <td className="px-3 py-3 text-sm">
                            <QuarixAccountFlagBadge
                              status={account.kycStatus}
                              trueLabel={pageMessages.kycPassed}
                              falseLabel={pageMessages.kycMissing}
                              unknownLabel={pageMessages.statusUnknown}
                              trueTone="positive"
                            />
                          </td>
                        ) : null}
                        {showQuarixAccountFlags ? (
                          <td className="px-5 py-3 text-sm">
                            <QuarixAccountRolesCell label={account.rolesLabel} emptyLabel={pageMessages.noRoles} />
                          </td>
                        ) : null}
                        {showQuarixAccountFlags ? (
                          <td className="px-3 py-3 text-sm">
                            <QuarixAccountFlagBadge
                              status={account.blacklistStatus}
                              trueLabel={pageMessages.blacklisted}
                              falseLabel={pageMessages.notBlacklisted}
                              unknownLabel={pageMessages.statusUnknown}
                              trueTone="danger"
                            />
                          </td>
                        ) : null}
                        <td className="px-5 py-3 text-sm text-slate-700">
                          {account.isModuleAccount && account.type ? (
                            <ModuleAccountTypeBadge label={account.type} permissions={account.permissions} />
                          ) : (
                            account.type ?? pageMessages.unavailableValue
                          )}
                        </td>
                        {showQuarixAccountFlags ? (
                          <td className="px-5 py-3 text-sm">
                            <QuarixAccountActionsCell account={account} disabled={submittingAction} pageMessages={pageMessages} onAction={openActionDialog} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={showQuarixAccountFlags ? 8 : 4} className="px-5 py-10 text-center text-sm text-slate-500">
                      {pageMessages.emptyAccountsLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showRawJson ? (
            <div className="border-t border-slate-200 px-5 py-4">
              <JsonViewPanel value={data.response as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
            </div>
          ) : null}
        </section>
      </main>

      <ModalDialog
        open={actionDialogKind != null}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            return;
          }

          closeActionDialog();
        }}
        title={actionDialogTitle}
        description={actionDialogDescription}
        maxWidthClassName="max-w-lg"
        footer={null}
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">{pageMessages.evmAddress}</label>
            <Input
              value={actionAddress}
              onChange={(event) => setActionAddress(event.target.value)}
              placeholder="0x0000000000000000000000000000000000000000"
              disabled={submittingAction}
            />
          </div>
          {showRoleSelect ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">{pageMessages.roleName}</label>
              <Select value={actionRoleName} disabled={submittingAction} onValueChange={(value) => setActionRoleName(value as QuarixAccountRoleName)}>
                <SelectTrigger className="h-10 rounded-lg border-slate-200 text-sm text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARIX_ACCOUNT_ROLE_OPTIONS.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {actionError ? <div className="overflow-hidden break-all whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(actionError, locale)}</div> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={closeActionDialog}
              disabled={submittingAction}
            >
              {messages.common.cancel}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              onClick={() => void handleActionSubmit()}
              disabled={submittingAction}
            >
              {submittingAction ? messages.evmTxDetail.sending : messages.common.confirm}
            </button>
          </div>
        </div>
      </ModalDialog>

      <EvmPrivateKeyUnlockDialog
        open={unlockDialog.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            unlockDialog.closeDialog();
            return;
          }

          unlockDialog.setOpen(true);
        }}
        password={unlockDialog.password}
        onPasswordChange={unlockDialog.setPassword}
        errorMessage={unlockDialog.errorMessage}
        submitting={submittingAction}
        title={messages.privateKeys.unlockPrivateKey}
        description={messages.privateKeys.unlockContinueDescription}
        placeholder={messages.privateKeys.enterPassword}
        confirmLabel={messages.privateKeys.unlock}
        onConfirm={() => void submitAccountAction(unlockDialog.password)}
      />
    </AppShell>
  );
}
