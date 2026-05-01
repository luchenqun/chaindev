'use client';

import { IconCode, IconRefresh } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { READABLE_DENOM_ALIASES } from '@/domains/cosmos/client/readable-denom-aliases';
import { formatReadableDenom } from '@/domains/cosmos/client/tx-helpers';
import { getCosmosParamsDirect, type CosmosParamsModuleResult } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

type CosmosParamsPageData = Awaited<ReturnType<typeof getCosmosParamsDirect>>;

type ParamsFieldCardProps = {
  label: string;
  value: string;
};

type FormattedModuleSection = {
  title?: string;
  fields: ParamsFieldCardProps[];
};

function CosmosParamsPageSkeleton() {
  return (
    <main className="section-block">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 4 }).map((_, moduleIndex) => (
          <section key={moduleIndex} className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
            <div className="p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((__, fieldIndex) => (
                  <div key={fieldIndex} className="rounded-lg bg-slate-100 px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-5 w-28" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function formatIntegerText(value: string | undefined) {
  if (!value) {
    return '--';
  }

  if (!/^\d+$/.test(value.trim())) {
    return value;
  }

  return new Intl.NumberFormat('en-US').format(Number.parseInt(value, 10));
}

function formatBooleanText(value: boolean | undefined) {
  if (value == null) {
    return '--';
  }

  return value ? 'Enabled' : 'Disabled';
}

function formatDurationText(value: string | undefined) {
  if (!value) {
    return '--';
  }

  const match = /^(-?\d+)s$/.exec(value.trim());

  if (!match) {
    return value;
  }

  const seconds = Number.parseInt(match[1], 10);

  if (!Number.isFinite(seconds)) {
    return value;
  }

  if (seconds < 0) {
    return value;
  }

  if (seconds % 86400 === 0) {
    return `${seconds / 86400} days`;
  }

  if (seconds % 3600 === 0) {
    return `${seconds / 3600} hours`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }

  return `${seconds} sec`;
}

function formatPercentText(value: string | undefined) {
  if (!value) {
    return '--';
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return `${(parsed * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function formatTokenAmountWithDecimals(amount: string, decimals: number) {
  const normalized = amount.trim();

  if (!normalized) {
    return '0';
  }

  if (normalized.includes('.')) {
    return normalized.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  }

  const negative = normalized.startsWith('-');
  const digits = (negative ? normalized.slice(1) : normalized).replace(/^0+(?=\d)/, '') || '0';
  const padded = digits.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals) || '0';
  const fractionPart = padded.slice(-decimals).replace(/0+$/, '');

  return `${negative ? '-' : ''}${fractionPart ? `${integerPart}.${fractionPart}` : integerPart}`;
}

function resolveParamsTokenDecimals(denom: string | undefined) {
  if (!denom) {
    return 18;
  }

  return denom in READABLE_DENOM_ALIASES ? 18 : 18;
}

function formatTokenAmountLabel(
  items: Array<{
    denom?: string;
    amount?: string;
  }> | undefined,
) {
  if (!items?.length) {
    return '--';
  }

  return items
    .map((item) => {
      const amount = item.amount ? formatTokenAmountWithDecimals(item.amount, resolveParamsTokenDecimals(item.denom)) : '--';
      const denom = item.denom ? formatReadableDenom(item.denom) : '--';
      return `${amount} ${denom}`;
    })
    .join(', ');
}

function formatAuthModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Max Memo Characters',
          value: formatIntegerText(typeof params.max_memo_characters === 'string' ? params.max_memo_characters : undefined),
        },
        {
          label: 'Transaction Signature Limit',
          value: formatIntegerText(typeof params.tx_sig_limit === 'string' ? params.tx_sig_limit : undefined),
        },
        {
          label: 'Transaction Cost Per Byte',
          value: formatIntegerText(typeof params.tx_size_cost_per_byte === 'string' ? params.tx_size_cost_per_byte : undefined),
        },
        {
          label: 'Ed25519 Verification Cost',
          value: formatIntegerText(typeof params.sig_verify_cost_ed25519 === 'string' ? params.sig_verify_cost_ed25519 : undefined),
        },
        {
          label: 'Secp256k1 Verification Cost',
          value: formatIntegerText(typeof params.sig_verify_cost_secp256k1 === 'string' ? params.sig_verify_cost_secp256k1 : undefined),
        },
      ],
    },
  ];
}

function formatBankModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  const sendEnabled = Array.isArray(params.send_enabled) ? (params.send_enabled as Array<{ denom?: string; enabled?: boolean }>) : [];

  return [
    {
      fields: [
        {
          label: 'Default Send Enabled',
          value: formatBooleanText(typeof params.default_send_enabled === 'boolean' ? params.default_send_enabled : undefined),
        },
        {
          label: 'Custom Send Rules',
          value: sendEnabled.length ? `${sendEnabled.length} entries` : 'None',
        },
      ],
    },
  ];
}

function formatConsensusModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  const block = (params.block as Record<string, unknown> | undefined) ?? {};
  const evidence = (params.evidence as Record<string, unknown> | undefined) ?? {};
  const validator = (params.validator as Record<string, unknown> | undefined) ?? {};
  const version = (params.version as Record<string, unknown> | undefined) ?? {};
  const abci = (params.abci as Record<string, unknown> | undefined) ?? {};

  return [
    {
      title: 'Block Parameters',
      fields: [
        {
          label: 'Max Bytes',
          value: formatIntegerText(typeof block.max_bytes === 'string' ? block.max_bytes : undefined),
        },
        {
          label: 'Max Gas',
          value: typeof block.max_gas === 'string' ? block.max_gas : '--',
        },
      ],
    },
    {
      title: 'Evidence Parameters',
      fields: [
        {
          label: 'Max Age (Blocks)',
          value: formatIntegerText(typeof evidence.max_age_num_blocks === 'string' ? evidence.max_age_num_blocks : undefined),
        },
        {
          label: 'Max Age (Duration)',
          value: formatDurationText(typeof evidence.max_age_duration === 'string' ? evidence.max_age_duration : undefined),
        },
        {
          label: 'Max Bytes',
          value: formatIntegerText(typeof evidence.max_bytes === 'string' ? evidence.max_bytes : undefined),
        },
      ],
    },
    {
      title: 'Validator Parameters',
      fields: [
        {
          label: 'Public Key Types',
          value: Array.isArray(validator.pub_key_types) && validator.pub_key_types.length ? (validator.pub_key_types as string[]).join(', ') : '--',
        },
        {
          label: 'App Version',
          value: typeof version.app === 'string' ? version.app : '--',
        },
        {
          label: 'Vote Extensions Height',
          value: formatIntegerText(typeof abci.vote_extensions_enable_height === 'string' ? abci.vote_extensions_enable_height : undefined),
        },
      ],
    },
  ];
}

function formatDistributionModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Community Tax',
          value: formatPercentText(typeof params.community_tax === 'string' ? params.community_tax : undefined),
        },
        {
          label: 'Base Proposer Reward',
          value: formatPercentText(typeof params.base_proposer_reward === 'string' ? params.base_proposer_reward : undefined),
        },
        {
          label: 'Bonus Proposer Reward',
          value: formatPercentText(typeof params.bonus_proposer_reward === 'string' ? params.bonus_proposer_reward : undefined),
        },
        {
          label: 'Withdraw Address',
          value: formatBooleanText(typeof params.withdraw_addr_enabled === 'boolean' ? params.withdraw_addr_enabled : undefined),
        },
      ],
    },
  ];
}

function formatMintModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Mint Denom',
          value: typeof params.mint_denom === 'string' ? formatReadableDenom(params.mint_denom) : '--',
        },
        {
          label: 'Inflation Rate Change',
          value: formatPercentText(typeof params.inflation_rate_change === 'string' ? params.inflation_rate_change : undefined),
        },
        {
          label: 'Inflation Max',
          value: formatPercentText(typeof params.inflation_max === 'string' ? params.inflation_max : undefined),
        },
        {
          label: 'Inflation Min',
          value: formatPercentText(typeof params.inflation_min === 'string' ? params.inflation_min : undefined),
        },
        {
          label: 'Goal Bonded',
          value: formatPercentText(typeof params.goal_bonded === 'string' ? params.goal_bonded : undefined),
        },
        {
          label: 'Blocks Per Year',
          value: formatIntegerText(typeof params.blocks_per_year === 'string' ? params.blocks_per_year : undefined),
        },
        {
          label: 'Max Supply',
          value: typeof params.max_supply === 'string' ? formatIntegerText(params.max_supply) : '--',
        },
      ],
    },
  ];
}

function getGovParamsObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return record.params && typeof record.params === 'object' && !Array.isArray(record.params) ? (record.params as Record<string, unknown>) : null;
}

function getGovNestedSectionObject(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const nested = (value as Record<string, unknown>)[key];

  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return null;
  }

  return nested as Record<string, unknown>;
}

function formatGovernanceModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params =
    getGovParamsObject(module.data.deposit) ??
    getGovParamsObject(module.data.voting) ??
    getGovParamsObject(module.data.tally) ??
    (module.data.params && typeof module.data.params === 'object' && !Array.isArray(module.data.params) ? (module.data.params as Record<string, unknown>) : null);

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Minimum Deposit',
          value: formatTokenAmountLabel(
            Array.isArray(params.min_deposit) ? (params.min_deposit as Array<{ denom?: string; amount?: string }>) : undefined,
          ),
        },
        {
          label: 'Max Deposit Period',
          value: formatDurationText(typeof params.max_deposit_period === 'string' ? params.max_deposit_period : undefined),
        },
        {
          label: 'Minimum Deposit Ratio',
          value: formatPercentText(typeof params.min_deposit_ratio === 'string' ? params.min_deposit_ratio : undefined),
        },
        {
          label: 'Voting Period',
          value: formatDurationText(typeof params.voting_period === 'string' ? params.voting_period : undefined),
        },
        {
          label: 'Expedited Voting Period',
          value: formatDurationText(typeof params.expedited_voting_period === 'string' ? params.expedited_voting_period : undefined),
        },
        {
          label: 'Expedited Minimum Deposit',
          value: formatTokenAmountLabel(
            Array.isArray(params.expedited_min_deposit) ? (params.expedited_min_deposit as Array<{ denom?: string; amount?: string }>) : undefined,
          ),
        },
        {
          label: 'Proposal Cancel Ratio',
          value: formatPercentText(typeof params.proposal_cancel_ratio === 'string' ? params.proposal_cancel_ratio : undefined),
        },
        {
          label: 'Proposal Cancel Destination',
          value: typeof params.proposal_cancel_dest === 'string' && params.proposal_cancel_dest ? params.proposal_cancel_dest : '--',
        },
        {
          label: 'Quorum',
          value: formatPercentText(typeof params.quorum === 'string' ? params.quorum : undefined),
        },
        {
          label: 'Threshold',
          value: formatPercentText(typeof params.threshold === 'string' ? params.threshold : undefined),
        },
        {
          label: 'Veto Threshold',
          value: formatPercentText(typeof params.veto_threshold === 'string' ? params.veto_threshold : undefined),
        },
        {
          label: 'Expedited Threshold',
          value: formatPercentText(typeof params.expedited_threshold === 'string' ? params.expedited_threshold : undefined),
        },
        {
          label: 'Minimum Initial Deposit Ratio',
          value: formatPercentText(typeof params.min_initial_deposit_ratio === 'string' ? params.min_initial_deposit_ratio : undefined),
        },
        {
          label: 'Burn Vote Quorum',
          value: formatBooleanText(typeof params.burn_vote_quorum === 'boolean' ? params.burn_vote_quorum : undefined),
        },
        {
          label: 'Burn Proposal Deposit Prevote',
          value: formatBooleanText(typeof params.burn_proposal_deposit_prevote === 'boolean' ? params.burn_proposal_deposit_prevote : undefined),
        },
        {
          label: 'Burn Vote Veto',
          value: formatBooleanText(typeof params.burn_vote_veto === 'boolean' ? params.burn_vote_veto : undefined),
        },
      ],
    },
  ];
}

function formatEvmFeeMarketModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Base Fee Enabled',
          value:
            typeof params.no_base_fee === 'boolean'
              ? params.no_base_fee
                ? 'Disabled'
                : 'Enabled'
              : '--',
        },
        {
          label: 'Base Fee Change Denominator',
          value: typeof params.base_fee_change_denominator === 'number' ? new Intl.NumberFormat('en-US').format(params.base_fee_change_denominator) : '--',
        },
        {
          label: 'Elasticity Multiplier',
          value: typeof params.elasticity_multiplier === 'number' ? new Intl.NumberFormat('en-US').format(params.elasticity_multiplier) : '--',
        },
        {
          label: 'Enable Height',
          value: formatIntegerText(typeof params.enable_height === 'string' ? params.enable_height : undefined),
        },
        {
          label: 'Base Fee',
          value: typeof params.base_fee === 'string' ? params.base_fee.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') : '--',
        },
        {
          label: 'Minimum Gas Price',
          value: typeof params.min_gas_price === 'string' ? params.min_gas_price.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') : '--',
        },
        {
          label: 'Minimum Gas Multiplier',
          value: typeof params.min_gas_multiplier === 'string' ? params.min_gas_multiplier.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1') : '--',
        },
      ],
    },
  ];
}

function formatEvmErc20Module(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'ERC20 Enabled',
          value: formatBooleanText(typeof params.enable_erc20 === 'boolean' ? params.enable_erc20 : undefined),
        },
        {
          label: 'Permissionless Registration',
          value: formatBooleanText(typeof params.permissionless_registration === 'boolean' ? params.permissionless_registration : undefined),
        },
      ],
    },
  ];
}

function formatEvmVmModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  const accessControl = (params.access_control as Record<string, unknown> | undefined) ?? {};
  const createAccess = (accessControl.create as Record<string, unknown> | undefined) ?? {};
  const callAccess = (accessControl.call as Record<string, unknown> | undefined) ?? {};
  const extendedDenomOptions = (params.extended_denom_options as Record<string, unknown> | undefined) ?? {};

  return [
    {
      fields: [
        {
          label: 'EVM Denom',
          value: typeof params.evm_denom === 'string' ? formatReadableDenom(params.evm_denom) : '--',
        },
        {
          label: 'History Serve Window',
          value: formatIntegerText(typeof params.history_serve_window === 'string' ? params.history_serve_window : undefined),
        },
        {
          label: 'Extra EIPs',
          value: Array.isArray(params.extra_eips) && params.extra_eips.length ? String(params.extra_eips.length) : 'None',
        },
        {
          label: 'EVM Channels',
          value: Array.isArray(params.evm_channels) && params.evm_channels.length ? String(params.evm_channels.length) : 'None',
        },
        {
          label: 'Create Access Type',
          value: typeof createAccess.access_type === 'string' ? createAccess.access_type.replace('ACCESS_TYPE_', '') : '--',
        },
        {
          label: 'Call Access Type',
          value: typeof callAccess.access_type === 'string' ? callAccess.access_type.replace('ACCESS_TYPE_', '') : '--',
        },
        {
          label: 'Static Precompiles',
          value: Array.isArray(params.active_static_precompiles) ? new Intl.NumberFormat('en-US').format(params.active_static_precompiles.length) : '--',
        },
        {
          label: 'Extended Denom',
          value: typeof extendedDenomOptions.extended_denom === 'string' ? formatReadableDenom(extendedDenomOptions.extended_denom) : '--',
        },
      ],
    },
  ];
}

function formatSlashingModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Signed Blocks Window',
          value: formatIntegerText(typeof params.signed_blocks_window === 'string' ? params.signed_blocks_window : undefined),
        },
        {
          label: 'Minimum Signed Per Window',
          value: formatPercentText(typeof params.min_signed_per_window === 'string' ? params.min_signed_per_window : undefined),
        },
        {
          label: 'Downtime Jail Duration',
          value: formatDurationText(typeof params.downtime_jail_duration === 'string' ? params.downtime_jail_duration : undefined),
        },
        {
          label: 'Double Sign Slash Fraction',
          value: formatPercentText(typeof params.slash_fraction_double_sign === 'string' ? params.slash_fraction_double_sign : undefined),
        },
        {
          label: 'Downtime Slash Fraction',
          value: formatPercentText(typeof params.slash_fraction_downtime === 'string' ? params.slash_fraction_downtime : undefined),
        },
      ],
    },
  ];
}

function formatStakingModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Unbonding Time',
          value: formatDurationText(typeof params.unbonding_time === 'string' ? params.unbonding_time : undefined),
        },
        {
          label: 'Max Validators',
          value: typeof params.max_validators === 'number' ? new Intl.NumberFormat('en-US').format(params.max_validators) : '--',
        },
        {
          label: 'Max Entries',
          value: typeof params.max_entries === 'number' ? new Intl.NumberFormat('en-US').format(params.max_entries) : '--',
        },
        {
          label: 'Historical Entries',
          value: typeof params.historical_entries === 'number' ? new Intl.NumberFormat('en-US').format(params.historical_entries) : '--',
        },
        {
          label: 'Bond Denom',
          value: typeof params.bond_denom === 'string' ? formatReadableDenom(params.bond_denom) : '--',
        },
        {
          label: 'Min Commission Rate',
          value: formatPercentText(typeof params.min_commission_rate === 'string' ? params.min_commission_rate : undefined),
        },
      ],
    },
  ];
}

function formatQuarixVetoModule(module: CosmosParamsModuleResult): FormattedModuleSection[] | null {
  const params = (module.data.veto_params as Record<string, unknown> | undefined) ?? null;

  if (!params) {
    return null;
  }

  return [
    {
      fields: [
        {
          label: 'Veto Period',
          value: formatDurationText(typeof params.veto_period === 'string' ? params.veto_period : undefined),
        },
      ],
    },
  ];
}

function formatModule(module: CosmosParamsModuleResult) {
  switch (module.id) {
    case 'auth':
      return formatAuthModule(module);
    case 'bank':
      return formatBankModule(module);
    case 'consensus':
      return formatConsensusModule(module);
    case 'distribution':
      return formatDistributionModule(module);
    case 'mint':
      return formatMintModule(module);
    case 'gov':
      return formatGovernanceModule(module);
    case 'evm-feemarket':
      return formatEvmFeeMarketModule(module);
    case 'evm-erc20':
      return formatEvmErc20Module(module);
    case 'evm-vm':
      return formatEvmVmModule(module);
    case 'slashing':
      return formatSlashingModule(module);
    case 'staking':
      return formatStakingModule(module);
    case 'quarix-veto':
      return formatQuarixVetoModule(module);
    default:
      return null;
  }
}

function ParamsFieldCard({ label, value }: ParamsFieldCardProps) {
  return (
    <div className="rounded-lg bg-slate-100 px-4 py-3">
      <p className="text-[13px] font-medium leading-5 text-slate-500">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function FormattedModuleView({ sections }: { sections: FormattedModuleSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {index ? <div className="mb-3 border-t border-slate-200" /> : null}
          {section.title ? <h3 className="text-sm font-semibold text-slate-600">{section.title}</h3> : null}
          <div className={`${section.title ? 'mt-2' : ''} grid gap-3 md:grid-cols-2 xl:grid-cols-4`}>
            {section.fields.map((field) => (
              <ParamsFieldCard key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ParamsModuleCard({ module }: { module: CosmosParamsModuleResult }) {
  const [showRawJson, setShowRawJson] = useState(false);
  const formattedSections = useMemo(() => formatModule(module), [module]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{module.label}</h2>
          </div>
          <ActionIconButton
            tooltip={showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
            className={
              showRawJson
                ? 'shrink-0 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700'
                : 'shrink-0 rounded-md text-slate-400 hover:text-slate-700'
            }
            onClick={() => setShowRawJson((current) => !current)}
          >
            <IconCode className="size-4" stroke={1.8} />
          </ActionIconButton>
        </div>
      </div>
      <div className="p-4">
        {formattedSections ? <FormattedModuleView sections={formattedSections} /> : null}
        {showRawJson || !formattedSections ? (
          <div className={formattedSections ? 'mt-4' : ''}>
            <JsonViewPanel value={module.data} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function CosmosParamsPage() {
  const [data, setData] = useState<CosmosParamsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const next = await getCosmosParamsDirect();

        if (cancelled) {
          return;
        }

        setData(next);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setData(null);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load Cosmos params.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [refreshVersion]);

  if (loading && !data) {
    return (
      <AppShell mode="cosmos">
        <CosmosParamsPageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell mode="cosmos">
      <main className="section-block">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Params</h1>
          </div>
          <ActionIconButton
            tooltip="Refresh params"
            className="self-start rounded-md text-slate-400 hover:text-slate-700 lg:self-auto"
            onClick={() => setRefreshVersion((current) => current + 1)}
          >
            <IconRefresh className="size-4" stroke={1.8} />
          </ActionIconButton>
        </div>

        {errorMessage ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{errorMessage}</section>
        ) : null}

        {data && data.modules.length ? (
          <div className="grid gap-4">
            {data.modules.map((module) => (
              <ParamsModuleCard key={module.id} module={module} />
            ))}
          </div>
        ) : null}

        {data && !data.modules.length && !errorMessage ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <h2 className="text-base font-semibold text-slate-900">No params endpoints available</h2>
            <p className="mt-2 text-sm text-slate-500">The active Cosmos REST provider did not return any supported params endpoints.</p>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
