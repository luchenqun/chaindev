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
import { getFormattingLocale } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
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

function translateParamsLabel(label: string, messages: ReturnType<typeof useMessages>) {
  const map: Record<string, string> = {
    'Max Memo Characters': 'Max Memo Characters',
    'Transaction Signature Limit': 'Transaction Signature Limit',
    'Transaction Cost Per Byte': 'Transaction Cost Per Byte',
    'Ed25519 Verification Cost': 'Ed25519 Verification Cost',
    'Secp256k1 Verification Cost': 'Secp256k1 Verification Cost',
    'Default Send Enabled': 'Default Send Enabled',
    'Custom Send Rules': 'Custom Send Rules',
    'Block Parameters': 'Block Parameters',
    'Max Bytes': 'Max Bytes',
    'Max Gas': 'Max Gas',
    'Evidence Parameters': 'Evidence Parameters',
    'Max Age (Blocks)': 'Max Age (Blocks)',
    'Max Age (Duration)': 'Max Age (Duration)',
    'Validator Parameters': 'Validator Parameters',
    'Public Key Types': 'Public Key Types',
    'App Version': 'App Version',
    'Vote Extensions Height': 'Vote Extensions Height',
    'Community Tax': 'Community Tax',
    'Base Proposer Reward': 'Base Proposer Reward',
    'Bonus Proposer Reward': 'Bonus Proposer Reward',
    'Withdraw Address': 'Withdraw Address',
    'Mint Denom': 'Mint Denom',
    'Inflation Rate Change': 'Inflation Rate Change',
    'Inflation Max': 'Inflation Max',
    'Inflation Min': 'Inflation Min',
    'Goal Bonded': 'Goal Bonded',
    'Blocks Per Year': 'Blocks Per Year',
    'Max Supply': 'Max Supply',
    'Minimum Deposit': 'Minimum Deposit',
    'Max Deposit Period': 'Max Deposit Period',
    'Minimum Deposit Ratio': 'Minimum Deposit Ratio',
    'Voting Period': 'Voting Period',
    'Expedited Voting Period': 'Expedited Voting Period',
    'Expedited Minimum Deposit': 'Expedited Minimum Deposit',
    'Proposal Cancel Ratio': 'Proposal Cancel Ratio',
    'Proposal Cancel Destination': 'Proposal Cancel Destination',
    Quorum: 'Quorum',
    Threshold: 'Threshold',
    'Veto Threshold': 'Veto Threshold',
    'Expedited Threshold': 'Expedited Threshold',
    'Minimum Initial Deposit Ratio': 'Minimum Initial Deposit Ratio',
    'Burn Vote Quorum': 'Burn Vote Quorum',
    'Burn Proposal Deposit Prevote': 'Burn Proposal Deposit Prevote',
    'Burn Vote Veto': 'Burn Vote Veto',
    'Base Fee Enabled': 'Base Fee Enabled',
    'Base Fee Change Denominator': 'Base Fee Change Denominator',
    'Elasticity Multiplier': 'Elasticity Multiplier',
    'Enable Height': 'Enable Height',
    'Base Fee': 'Base Fee',
    'Minimum Gas Price': 'Minimum Gas Price',
    'Minimum Gas Multiplier': 'Minimum Gas Multiplier',
    'ERC20 Enabled': 'ERC20 Enabled',
    'Permissionless Registration': 'Permissionless Registration',
    'EVM Denom': 'EVM Denom',
    'History Serve Window': 'History Serve Window',
    'Extra EIPs': 'Extra EIPs',
    'EVM Channels': 'EVM Channels',
    'Create Access Type': 'Create Access Type',
    'Call Access Type': 'Call Access Type',
    'Static Precompiles': 'Static Precompiles',
    'Extended Denom': 'Extended Denom',
    'Signed Blocks Window': 'Signed Blocks Window',
    'Minimum Signed Per Window': 'Minimum Signed Per Window',
    'Downtime Jail Duration': 'Downtime Jail Duration',
    'Double Sign Slash Fraction': 'Double Sign Slash Fraction',
    'Downtime Slash Fraction': 'Downtime Slash Fraction',
    'Unbonding Time': 'Unbonding Time',
    'Max Validators': 'Max Validators',
    'Max Entries': 'Max Entries',
    'Historical Entries': 'Historical Entries',
    'Bond Denom': 'Bond Denom',
    'Min Commission Rate': 'Min Commission Rate',
    'Veto Period': 'Veto Period',
  };

  const zhMap: Record<string, string> = {
    'Max Memo Characters': '最大备注字符数',
    'Transaction Signature Limit': '交易签名上限',
    'Transaction Cost Per Byte': '每字节交易成本',
    'Ed25519 Verification Cost': 'Ed25519 验证成本',
    'Secp256k1 Verification Cost': 'Secp256k1 验证成本',
    'Default Send Enabled': '默认可转账',
    'Custom Send Rules': '自定义转账规则',
    'Block Parameters': '区块参数',
    'Max Bytes': '最大字节数',
    'Max Gas': '最大 Gas 数量',
    'Evidence Parameters': '证据参数',
    'Max Age (Blocks)': '最大保留期（区块）',
    'Max Age (Duration)': '最大保留期（时长）',
    'Validator Parameters': '验证人参数',
    'Public Key Types': '公钥类型',
    'App Version': '应用版本',
    'Vote Extensions Height': '投票扩展启用高度',
    'Community Tax': '社区税',
    'Base Proposer Reward': '基础提议者奖励',
    'Bonus Proposer Reward': '额外提议者奖励',
    'Withdraw Address': '可提现地址',
    'Mint Denom': '铸币面额',
    'Inflation Rate Change': '通胀变化率',
    'Inflation Max': '最大通胀率',
    'Inflation Min': '最小通胀率',
    'Goal Bonded': '目标绑定率',
    'Blocks Per Year': '每年区块数',
    'Max Supply': '最大供应量',
    'Minimum Deposit': '最小押金',
    'Max Deposit Period': '最大押金期',
    'Minimum Deposit Ratio': '最小押金比例',
    'Voting Period': '投票期',
    'Expedited Voting Period': '加急投票期',
    'Expedited Minimum Deposit': '加急最小押金',
    'Proposal Cancel Ratio': '提案取消比例',
    'Proposal Cancel Destination': '提案取消目标地址',
    Quorum: '法定人数比例',
    Threshold: '通过阈值',
    'Veto Threshold': '否决阈值',
    'Expedited Threshold': '加急阈值',
    'Minimum Initial Deposit Ratio': '最小初始押金比例',
    'Burn Vote Quorum': '燃烧投票法定人数',
    'Burn Proposal Deposit Prevote': '预投票前燃烧提案押金',
    'Burn Vote Veto': '燃烧否决投票',
    'Base Fee Enabled': '基础费用开关',
    'Base Fee Change Denominator': '基础费用变更分母',
    'Elasticity Multiplier': '弹性倍数',
    'Enable Height': '启用高度',
    'Base Fee': '基础费用',
    'Minimum Gas Price': '最小 Gas 单价',
    'Minimum Gas Multiplier': '最小 Gas 倍数',
    'ERC20 Enabled': 'ERC20 开关',
    'Permissionless Registration': '无许可注册',
    'EVM Denom': 'EVM 面额',
    'History Serve Window': '历史服务窗口',
    'Extra EIPs': '额外 EIP',
    'EVM Channels': 'EVM 通道',
    'Create Access Type': '创建访问类型',
    'Call Access Type': '调用访问类型',
    'Static Precompiles': '静态预编译',
    'Extended Denom': '扩展面额',
    'Signed Blocks Window': '已签区块窗口',
    'Minimum Signed Per Window': '窗口最小签名比例',
    'Downtime Jail Duration': '宕机监禁时长',
    'Double Sign Slash Fraction': '双签罚没比例',
    'Downtime Slash Fraction': '宕机罚没比例',
    'Unbonding Time': '解绑定时间',
    'Max Validators': '最大验证人数',
    'Max Entries': '最大条目数',
    'Historical Entries': '历史条目数',
    'Bond Denom': '绑定面额',
    'Min Commission Rate': '最小佣金率',
    'Veto Period': '否决期',
  };

  return zhMap[map[label] ?? label] ?? label;
}

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

function formatIntegerText(value: string | undefined, locale?: string) {
  if (!value) {
    return '--';
  }

  if (!/^\d+$/.test(value.trim())) {
    return value;
  }

  return new Intl.NumberFormat(getFormattingLocale(locale)).format(Number.parseInt(value, 10));
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
          value: typeof params.base_fee_change_denominator === 'number' ? String(params.base_fee_change_denominator) : '--',
        },
        {
          label: 'Elasticity Multiplier',
          value: typeof params.elasticity_multiplier === 'number' ? String(params.elasticity_multiplier) : '--',
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
          value: Array.isArray(params.active_static_precompiles) ? String(params.active_static_precompiles.length) : '--',
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
          value: typeof params.max_validators === 'number' ? String(params.max_validators) : '--',
        },
        {
          label: 'Max Entries',
          value: typeof params.max_entries === 'number' ? String(params.max_entries) : '--',
        },
        {
          label: 'Historical Entries',
          value: typeof params.historical_entries === 'number' ? String(params.historical_entries) : '--',
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
  const { locale } = useLocale();
  return (
    <div className="rounded-lg bg-slate-100 px-4 py-3">
      <p className="text-[13px] font-medium leading-5 text-slate-500">{translateRuntimeText(label, locale)}</p>
      <p className="mt-1.5 text-[15px] font-semibold leading-6 text-slate-700">{translateRuntimeText(value, locale)}</p>
    </div>
  );
}

function FormattedModuleView({ sections }: { sections: FormattedModuleSection[] }) {
  const messages = useMessages();
  const { locale } = useLocale();
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {index ? <div className="mb-3 border-t border-slate-200" /> : null}
          {section.title ? <h3 className="text-sm font-semibold text-slate-600">{locale === 'zh' ? translateParamsLabel(section.title, messages) : section.title}</h3> : null}
          <div className={`${section.title ? 'mt-2' : ''} grid gap-3 md:grid-cols-2 xl:grid-cols-4`}>
            {section.fields.map((field) => (
              <ParamsFieldCard key={field.label} label={locale === 'zh' ? translateParamsLabel(field.label, messages) : field.label} value={field.value} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ParamsModuleCard({ module }: { module: CosmosParamsModuleResult }) {
  const messages = useMessages();
  const { locale } = useLocale();
  const [showRawJson, setShowRawJson] = useState(false);
  const formattedSections = useMemo(() => formatModule(module), [module]);
  const localizedSections = useMemo(
    () =>
      formattedSections?.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({
          ...field,
          value: /^\d{1,3}(,\d{3})*$|^\d+$/.test(field.value)
            ? formatIntegerText(field.value.replaceAll(',', ''), locale)
            : translateRuntimeText(field.value, locale),
        })),
      })) ?? null,
    [formattedSections, locale],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{translateRuntimeText(module.label, locale)}</h2>
          </div>
          <ActionIconButton
            tooltip={showRawJson ? messages.common.hideRawJson : messages.common.showRawJson}
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
        {localizedSections ? <FormattedModuleView sections={localizedSections} /> : null}
        {showRawJson || !localizedSections ? (
          <div className={localizedSections ? 'mt-4' : ''}>
            <JsonViewPanel value={module.data} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function CosmosParamsPage() {
  const messages = useMessages();
  const { locale } = useLocale();
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
        setErrorMessage(error instanceof Error ? error.message : messages.common.failedToLoadBlockTitle);
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
  }, [messages.common.failedToLoadBlockTitle, refreshVersion]);

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
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{messages.labels.params}</h1>
          </div>
          <ActionIconButton
            tooltip={messages.common.refresh}
            className="self-start rounded-md text-slate-400 hover:text-slate-700 lg:self-auto"
            onClick={() => setRefreshVersion((current) => current + 1)}
          >
            <IconRefresh className="size-4" stroke={1.8} />
          </ActionIconButton>
        </div>

        {errorMessage ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {translateRuntimeText(errorMessage, locale)}
          </section>
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
            <h2 className="text-base font-semibold text-slate-900">{messages.common.noParamsEndpointsAvailableTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">{messages.common.noParamsEndpointsAvailableDescription}</p>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
