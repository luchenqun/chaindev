'use client';

import { IconBrandTelegram, IconChevronDown, IconCopy, IconLoader2, IconPlayerPlay, IconRefresh, IconSparkles, IconX } from '@tabler/icons-react';
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toFunctionSelector, type AbiParameter } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { formatLocalizedDateTime } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { getReadContractFunctions, getWriteContractFunctions, type EvmContractFunctionDescriptor } from '@/domains/evm/client/abi-utils';
import {
  forceWriteEvmContractMethodDirect,
  getEvmContractWriteManualDefaultsDirect,
  prepareEvmContractWriteDirect,
  readEvmContractMethodDirect,
  writeEvmContractMethodDirect,
} from '@/domains/evm/client/contract-executor';
import {
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from '@/domains/evm/client/keyring';
import { type EvmContractArtifact, type EvmContractBinding } from '@/domains/evm/client/contract-registry';

const textareaClassName =
  'min-h-32 w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';

type EnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
};

type ContractSubview = 'code' | 'read' | 'write';

type WritePreviewState = {
  accountAddress: string;
  functionSignature: string;
  estimatedGas: string;
  gasPriceLabel: string;
  valueLabel: string;
};

type ManualWriteTransactionType = 'LEGACY' | 'EIP1559';

type ManualWriteDialogState = {
  transactionType: ManualWriteTransactionType;
  value: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  nonce: string;
};

const INTEGER_SCALE_OPTIONS = [6, 9, 12, 15, 18] as const;
const CONTRACT_ARGUMENT_CACHE_KEY = 'evm-contract-arguments:v1';

function hasTupleComponents(parameter: AbiParameter): parameter is AbiParameter & { components: readonly AbiParameter[] } {
  return 'components' in parameter && Array.isArray(parameter.components);
}

function createComplexParameterTemplateValue(parameter: AbiParameter): unknown {
  if (parameter.type.endsWith(']')) {
    const baseType = parameter.type.slice(0, parameter.type.lastIndexOf('['));
    const baseParameter = {
      ...parameter,
      type: baseType,
    } satisfies AbiParameter;

    return [createComplexParameterTemplateValue(baseParameter)];
  }

  if (parameter.type === 'tuple') {
    const components = hasTupleComponents(parameter) ? parameter.components : [];

    return Object.fromEntries(components.map((component, index) => [component.name || `field${index + 1}`, createComplexParameterTemplateValue(component)]));
  }

  if (parameter.type === 'bool') {
    return 'false';
  }

  if (/^u?int\d*$/.test(parameter.type)) {
    return '0';
  }

  if (parameter.type === 'address') {
    return '0x0000000000000000000000000000000000000000';
  }

  if (parameter.type === 'bytes' || /^bytes\d+$/.test(parameter.type)) {
    return '0x';
  }

  return '';
}

function getComplexParameterTemplate(parameter: AbiParameter) {
  return JSON.stringify(createComplexParameterTemplateValue(parameter), null, 2);
}

function getInitialArgumentValue(parameter: AbiParameter) {
  return parameter.type.includes('[') || parameter.type === 'tuple' ? getComplexParameterTemplate(parameter) : '';
}

function stringifyResult(value: unknown) {
  return JSON.stringify(value, (_, currentValue) => (typeof currentValue === 'bigint' ? currentValue.toString() : currentValue), 2);
}

function FunctionArgumentsForm({
  fn,
  values,
  onChange,
  selfAddress,
}: {
  fn: EvmContractFunctionDescriptor;
  values: string[];
  onChange: (index: number, value: string) => void;
  selfAddress?: string | null;
}) {
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const contractPanelMessages = messages.contractPanel;
  const [scaleSelectResetVersion, setScaleSelectResetVersion] = useState<Record<string, number>>({});

  if (!fn.inputs.length) {
    return null;
  }

  function resetScaleSelect(fieldKey: string) {
    setScaleSelectResetVersion((current) => ({
      ...current,
      [fieldKey]: (current[fieldKey] ?? 0) + 1,
    }));
  }

  return (
    <div className="grid gap-3">
      {fn.inputs.map((input, index) => {
        const isComplex = input.type.includes('[') || input.type === 'tuple';
        const isAddressInput = input.type === 'address';
        const isIntegerInput = /^u?int\d*$/.test(input.type);
        const isUnsignedIntegerInput = /^uint\d*$/.test(input.type);
        const hasValue = Boolean(values[index]?.trim());
        const label = input.name || `arg${index + 1}`;
        const fieldKey = `${fn.signature}-${label}-${index}`;

        function applyIntegerScale(exponent: number) {
          const rawValue = values[index]?.trim() ?? '';
          const baseValue = rawValue || '1';

          if (isUnsignedIntegerInput && baseValue.startsWith('-')) {
            return;
          }

          if (!/^-?\d+$/.test(baseValue)) {
            return;
          }

          const scaledValue = (BigInt(baseValue) * 10n ** BigInt(exponent)).toString();
          onChange(index, scaledValue);
        }

        return (
          <div key={fieldKey} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {label} <span className="text-slate-400">({input.type})</span>
            </label>
            {isComplex ? (
              <JsonInput
                value={values[index] ?? ''}
                onChange={(value) => onChange(index, value)}
                placeholder={getComplexParameterTemplate(input)}
                textareaClassName={textareaClassName}
              />
            ) : (
              <div className="relative">
                <Input
                  value={values[index] ?? ''}
                  onChange={(event) => onChange(index, event.target.value)}
                  placeholder={input.type === 'bool' ? contractPanelMessages.boolPlaceholder : input.type}
                  className={isAddressInput ? 'pr-28' : isIntegerInput ? 'pr-40' : hasValue ? 'pr-10' : undefined}
                />
                {hasValue ? (
                  <button
                    type="button"
                    className={
                      isAddressInput
                        ? 'absolute right-[61px] top-1/2 inline-flex -translate-y-1/2 items-center justify-center p-0 text-slate-400 transition hover:text-slate-700'
                        : isIntegerInput
                          ? 'absolute right-[73px] top-1/2 inline-flex -translate-y-1/2 items-center justify-center p-0 text-slate-400 transition hover:text-slate-700'
                          : 'absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center p-0 text-slate-400 transition hover:text-slate-700'
                    }
                    onClick={() => onChange(index, '')}
                    aria-label={txMessages.clearInput}
                  >
                    <IconX className="size-4" stroke={1.8} />
                  </button>
                ) : null}
                {isAddressInput ? (
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 inline-flex h-[30px] -translate-y-1/2 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
                    onClick={() => {
                      if (selfAddress) {
                        onChange(index, selfAddress);
                      }
                    }}
                    disabled={!selfAddress}
                  >
                    {contractPanelMessages.self}
                  </button>
                ) : null}
                {isIntegerInput ? (
                  <>
                    <Select
                      key={`scale-${fieldKey}-${scaleSelectResetVersion[fieldKey] ?? 0}`}
                      onValueChange={(value) => {
                        applyIntegerScale(Number(value));
                        resetScaleSelect(fieldKey);
                      }}
                    >
                      <SelectTrigger className="absolute right-1.5 top-1/2 h-[30px] w-[66px] -translate-y-1/2 rounded-xl border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-700 shadow-none">
                        <SelectValue placeholder={contractPanelMessages.scale} />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {INTEGER_SCALE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {`x10^${option}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function readContractArgumentCache() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string[]>;
  }

  try {
    const rawValue = window.localStorage.getItem(CONTRACT_ARGUMENT_CACHE_KEY);

    if (!rawValue) {
      return {} as Record<string, string[]>;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      return {} as Record<string, string[]>;
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string')),
    );
  } catch {
    return {} as Record<string, string[]>;
  }
}

function writeContractArgumentCache(cache: Record<string, string[]>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONTRACT_ARGUMENT_CACHE_KEY, JSON.stringify(cache));
}

function getCachedArgumentValues(fn: EvmContractFunctionDescriptor) {
  const cachedValues = readContractArgumentCache()[fn.signature];

  if (!cachedValues || cachedValues.length !== fn.inputs.length) {
    return null;
  }

  return cachedValues;
}

function getInitialValuesWithCache(functions: EvmContractFunctionDescriptor[]) {
  return Object.fromEntries(functions.map((fn) => [fn.signature, getCachedArgumentValues(fn) ?? fn.inputs.map((input) => getInitialArgumentValue(input))]));
}

function persistArgumentValues(signature: string, values: string[]) {
  const currentCache = readContractArgumentCache();
  writeContractArgumentCache({
    ...currentCache,
    [signature]: values,
  });
}

function getFunctionSelector(signature: string) {
  return toFunctionSelector(`function ${signature}`);
}

function parseDisplayValue(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function ValuePreview({ value }: { value: string }) {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const parsedValue = parseDisplayValue(value);

  async function handleCopy() {
    await copyText(value);
    showToast({
      title: txMessages.resultCopied,
      description: txMessages.callResultCopied,
    });
  }

  if (typeof parsedValue === 'string' || typeof parsedValue === 'number' || typeof parsedValue === 'boolean' || parsedValue === null) {
    return (
      <div className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-900">
        <div className="absolute right-[6px] top-[6px]">
          <ActionIconButton className="text-slate-400 hover:text-slate-700" tooltip={txMessages.copyResult} aria-label={txMessages.copyResult} onClick={() => void handleCopy()}>
            <IconCopy className="size-4" stroke={1.8} />
          </ActionIconButton>
        </div>
        <span className="break-all">{String(parsedValue)}</span>
      </div>
    );
  }

  return <JsonViewPanel className="shadow-none" value={parsedValue as object} />;
}

function formatMiddleEllipsis(value: string, leading = 10, trailing = 8) {
  if (value.length <= leading + trailing + 3) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

function formatChainTimestamp(timestamp: number) {
  return formatLocalizedDateTime(timestamp * 1000, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function normalizeContractActionErrorMessage(message: string, fallback: string) {
  const roleMissingMatch = message.match(/missing role\s+(0x[a-fA-F0-9]+)/i);

  if (roleMissingMatch) {
    return `Transaction rejected. The current account is missing required role ${roleMissingMatch[1]}.`;
  }

  const revertReasonMatch = message.match(/execution reverted:\s*(.+?)(?:\s+Version:|$)/i);

  if (revertReasonMatch?.[1]) {
    return `Transaction reverted: ${revertReasonMatch[1].trim()}.`;
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `${fallback} ${rpcDescMatch[1].trim()}.`;
  }

  return message;
}

function getReceiptStatusClasses(status: string) {
  if (status === 'success') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'reverted') {
    return 'bg-rose-50 text-rose-700';
  }

  return 'bg-amber-50 text-amber-700';
}

function toWritePreviewState(input: { accountAddress: string; functionSignature: string; estimatedGas: string; gasPriceLabel: string; valueLabel: string }): WritePreviewState {
  return {
    accountAddress: input.accountAddress,
    functionSignature: input.functionSignature,
    estimatedGas: input.estimatedGas,
    gasPriceLabel: input.gasPriceLabel,
    valueLabel: input.valueLabel,
  };
}

function createInitialManualWriteDialogState(): ManualWriteDialogState {
  return {
    transactionType: 'EIP1559',
    value: '0',
    gasPrice: 'auto',
    maxFeePerGas: 'auto',
    maxPriorityFeePerGas: 'auto',
    gasLimit: '',
    nonce: 'auto',
  };
}

function isAutoFieldValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || normalizedValue === 'auto';
}

function isManualWriteDialogReady(state: ManualWriteDialogState) {
  if (!state.value.trim() || !state.gasLimit.trim()) {
    return false;
  }

  if (state.transactionType === 'LEGACY') {
    return !!state.gasPrice.trim();
  }

  return (
    (isAutoFieldValue(state.nonce) || !!state.nonce.trim()) &&
    (isAutoFieldValue(state.maxFeePerGas) || !!state.maxFeePerGas.trim()) &&
    (isAutoFieldValue(state.maxPriorityFeePerGas) || !!state.maxPriorityFeePerGas.trim())
  );
}

function WriteExecutionPreview({
  preview,
  result,
  error,
}: {
  preview: WritePreviewState | null;
  result: Awaited<ReturnType<typeof writeEvmContractMethodDirect>> | null;
  error?: string | null;
}) {
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;

  if (!preview && !result && !error) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">{txMessages.writePreviewEmpty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {preview ? (
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{txMessages.simulatedTransaction}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.from}</dt>
              <dd className="mt-1 break-all text-sm text-slate-900 mono">{preview.accountAddress}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.method}</dt>
              <dd className="mt-1 text-sm text-slate-900">{preview.functionSignature}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.estimatedGas}</dt>
              <dd className="mt-1 text-sm text-slate-900">{translateRuntimeText(preview.estimatedGas || messages.common.unavailable, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{messages.pendingTransactions.gasPrice}</dt>
              <dd className="mt-1 text-sm text-slate-900">{translateRuntimeText(preview.gasPriceLabel, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.value}</dt>
              <dd className="mt-1 text-sm text-slate-900">{translateRuntimeText(preview.valueLabel, locale)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {preview && (result || error) ? <div className="border-t border-slate-200" /> : null}
      {result ? (
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{txMessages.submittedTransaction}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.transactionHash}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                <Link href={`/evm/tx/${result.hash}`} className="mono text-sky-600 hover:text-sky-700">
                  {formatMiddleEllipsis(result.hash)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.status}</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getReceiptStatusClasses(result.receipt.status)}`}>{result.receipt.status}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.blockNumber}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                <Link href={`/evm/block/${result.receipt.blockNumber}`} className="text-sky-600 hover:text-sky-700">
                  {result.receipt.blockNumber}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.includedAt}</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatChainTimestamp(result.receipt.blockTimestamp)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.gasUsed}</dt>
              <dd className="mt-1 text-sm text-slate-900">{result.receipt.gasUsed}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.effectiveGasPrice}</dt>
              <dd className="mt-1 text-sm text-slate-900">{result.receipt.effectiveGasPrice}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {error ? (
        <div className="max-h-32 overflow-auto border-t border-slate-200 px-4 py-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="break-all whitespace-pre-wrap">{translateRuntimeText(error, locale)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FunctionListSectionProps = {
  title: string;
  functions: EvmContractFunctionDescriptor[];
  expandedSignatures: string[];
  onToggle: (signature: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReset: () => void;
  onCopySignature: (fn: EvmContractFunctionDescriptor) => void;
  renderHeaderActions?: (fn: EvmContractFunctionDescriptor) => React.ReactNode;
  headerTrailingContent?: ReactNode;
  inputBadgeLabel?: string;
  renderExpanded: (fn: EvmContractFunctionDescriptor) => React.ReactNode;
  emptyText: string;
};

function FunctionListSection({
  title,
  functions,
  expandedSignatures,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onReset,
  onCopySignature,
  renderHeaderActions,
  headerTrailingContent,
  inputBadgeLabel,
  renderExpanded,
  emptyText,
}: FunctionListSectionProps) {
  const messages = useMessages();
  const txMessages = messages.evmTxDetail;

  if (!functions.length) {
    return <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">{emptyText}</div>;
  }

  const allExpanded = functions.length > 0 && expandedSignatures.length === functions.length;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={allExpanded ? onCollapseAll : onExpandAll}>
            {allExpanded ? <IconChevronDown className="mr-1.5 size-3.5 rotate-180" stroke={1.8} /> : <IconSparkles className="mr-1.5 size-3.5" stroke={1.8} />}
            {allExpanded ? txMessages.collapseAll : txMessages.expandAll}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onReset}>
            <IconRefresh className="mr-1.5 size-3.5" stroke={1.8} />
            {txMessages.reset}
          </Button>
          {headerTrailingContent}
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {functions.map((fn, index) => {
          const isExpanded = expandedSignatures.includes(fn.signature);
          const selector = getFunctionSelector(fn.signature);

          return (
            <div key={fn.signature}>
              <div className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3" onClick={() => onToggle(fn.signature)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {fn.name} <span className="font-medium text-slate-400">({selector})</span>
                    </p>
                    {inputBadgeLabel && fn.inputs.length ? (
                      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{inputBadgeLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="flex items-center gap-0"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <ActionIconButton className="text-slate-400 hover:text-slate-700" tooltip={txMessages.copySignature} aria-label={txMessages.copySignature} onClick={() => onCopySignature(fn)}>
                    <IconCopy className="size-4" stroke={1.8} />
                  </ActionIconButton>
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip={isExpanded ? txMessages.collapse : txMessages.expand}
                    aria-label={isExpanded ? txMessages.collapse : txMessages.expand}
                    onClick={() => onToggle(fn.signature)}
                  >
                    <IconChevronDown className={`size-4 transition ${isExpanded ? 'rotate-180' : ''}`} stroke={1.8} />
                  </ActionIconButton>
                  {renderHeaderActions ? renderHeaderActions(fn) : null}
                </div>
              </div>
              {isExpanded ? <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4">{renderExpanded(fn)}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AddressContractPanel({
  binding,
  artifact,
  environment,
  initialTab = 'read',
}: {
  binding: EvmContractBinding;
  artifact: EvmContractArtifact;
  environment: EnvironmentState;
  initialTab?: ContractSubview;
}) {
  const { showToast } = useToast();
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const contractPanelMessages = messages.contractPanel;
  const [activeTab, setActiveTab] = useState<ContractSubview>(initialTab);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [expandedReadSignatures, setExpandedReadSignatures] = useState<string[]>([]);
  const [expandedWriteSignatures, setExpandedWriteSignatures] = useState<string[]>([]);
  const [readArgumentValues, setReadArgumentValues] = useState<Record<string, string[]>>({});
  const [writeArgumentValues, setWriteArgumentValues] = useState<Record<string, string[]>>({});
  const [manualWriteMode, setManualWriteMode] = useState(false);
  const [writeValueBySignature, setWriteValueBySignature] = useState<Record<string, string>>({});
  const [readResults, setReadResults] = useState<Record<string, string>>({});
  const [readErrors, setReadErrors] = useState<Record<string, string>>({});
  const [writePreviews, setWritePreviews] = useState<Record<string, WritePreviewState>>({});
  const [writeResults, setWriteResults] = useState<Record<string, Awaited<ReturnType<typeof writeEvmContractMethodDirect>>>>({});
  const [writeErrors, setWriteErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pendingWriteAction, setPendingWriteAction] = useState<{
    signature: string;
    type: 'write' | 'manual-open' | 'manual-confirm';
  } | null>(null);
  const [manualWriteTarget, setManualWriteTarget] = useState<string | null>(null);
  const [manualWriteDialogValues, setManualWriteDialogValues] = useState<ManualWriteDialogState>(createInitialManualWriteDialogState());
  const [manualWriteDialogError, setManualWriteDialogError] = useState<string | null>(null);

  const readFunctions = useMemo(() => getReadContractFunctions(artifact.abiJson), [artifact.abiJson]);
  const abiJsonValue = useMemo(() => JSON.parse(artifact.abiJson) as object, [artifact.abiJson]);
  const writeFunctions = useMemo(() => getWriteContractFunctions(artifact.abiJson), [artifact.abiJson]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    setExpandedReadSignatures([]);
    setReadArgumentValues(getInitialValuesWithCache(readFunctions));
    setReadResults({});
    setReadErrors({});
  }, [readFunctions]);

  useEffect(() => {
    setExpandedWriteSignatures([]);
    setWriteArgumentValues(getInitialValuesWithCache(writeFunctions));
    setWritePreviews({});
    setWriteResults({});
    setWriteErrors({});
    setWriteValueBySignature({});
    setManualWriteTarget(null);
    setManualWriteDialogError(null);
    setManualWriteDialogValues(createInitialManualWriteDialogState());
  }, [writeFunctions]);

  function updateReadArgumentValue(signature: string, index: number, value: string) {
    const fallbackValues = readFunctions.find((item) => item.signature === signature)?.inputs.map((input) => getInitialArgumentValue(input)) ?? [];

    setReadArgumentValues((current) => {
      const nextValues = (current[signature] ?? fallbackValues).map((item, itemIndex) => (itemIndex === index ? value : item));
      persistArgumentValues(signature, nextValues);

      return {
        ...current,
        [signature]: nextValues,
      };
    });
    setReadResults((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setReadErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
  }

  function updateWriteArgumentValue(signature: string, index: number, value: string) {
    const fallbackValues = writeFunctions.find((item) => item.signature === signature)?.inputs.map((input) => getInitialArgumentValue(input)) ?? [];

    setWriteArgumentValues((current) => {
      const nextValues = (current[signature] ?? fallbackValues).map((item, itemIndex) => (itemIndex === index ? value : item));
      persistArgumentValues(signature, nextValues);

      return {
        ...current,
        [signature]: nextValues,
      };
    });
    setWritePreviews((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setWriteResults((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setWriteErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setErrorMessage(null);
  }

  function updateWriteValue(signature: string, value: string) {
    setWriteValueBySignature((current) => ({
      ...current,
      [signature]: value,
    }));
    setWritePreviews((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setWriteResults((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setWriteErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setErrorMessage(null);
  }

  async function handleRead(signature: string) {
    const fn = readFunctions.find((item) => item.signature === signature);

    if (!fn) {
      return;
    }

    setActionLoadingKey(`read:${signature}`);
    setReadErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });

    try {
      const result = await readEvmContractMethodDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs: readArgumentValues[signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input)),
      });

      setReadResults((current) => ({
        ...current,
        [signature]: stringifyResult(result.result),
      }));
    } catch (error) {
      setReadResults((current) => {
        const next = { ...current };
        delete next[signature];
        return next;
      });
      setReadErrors((current) => ({
        ...current,
        [signature]: error instanceof Error ? error.message : txMessages.failedToLoadFallback,
      }));
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function executeWriteAction(signature: string, password?: string) {
    const fn = writeFunctions.find((item) => item.signature === signature);

    if (!fn) {
      return;
    }

    if (!activeKey) {
      setErrorMessage(txMessages.selectGlobalKeyFirst);
      return;
    }

    setActionLoadingKey(`write:${signature}`);
    setWriteErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input));
      const value = writeValueBySignature[signature] ?? '';
      const preview = await prepareEvmContractWriteDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs,
        privateKey,
        value,
      });
      setWritePreviews((current) => ({
        ...current,
        [signature]: toWritePreviewState(preview),
      }));

      const result = await writeEvmContractMethodDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs,
        privateKey,
        value,
      });

      setWriteResults((current) => ({
        ...current,
        [signature]: result,
      }));
      setWriteErrors((current) => {
        const next = { ...current };
        delete next[signature];
        return next;
      });
      showToast(
        result.receipt.status === 'success'
          ? {
              title: txMessages.transactionSubmitted,
              description: translateRuntimeText(
                `${fn.name} was sent successfully. Included at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
                locale,
              ),
              tone: 'success',
            }
          : {
              title: txMessages.transactionReverted,
              description: translateRuntimeText(
                `${fn.name} reverted on-chain at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
                locale,
              ),
              tone: 'info',
            },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : txMessages.failedToSubmitContractTransaction;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setPendingWriteAction({ signature, type: 'write' });
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: normalizeContractActionErrorMessage(message, txMessages.failedToSubmitContractTransaction),
      }));
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function openManualWriteDialog(signature: string, password?: string) {
    const fn = writeFunctions.find((item) => item.signature === signature);

    if (!fn) {
      return;
    }

    if (!activeKey) {
      setErrorMessage(txMessages.selectGlobalKeyFirst);
      return;
    }

    setActionLoadingKey(`manual:${signature}`);
    setManualWriteDialogError(null);
    setWriteResults((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setWriteErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });
    setErrorMessage(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input));
      const value = fn.stateMutability === 'payable' ? (writeValueBySignature[signature] ?? '0') : '0';
      const defaults = await getEvmContractWriteManualDefaultsDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs,
        privateKey,
        value,
      });

      setWritePreviews((current) => ({
        ...current,
        [signature]: toWritePreviewState(defaults),
      }));
      setManualWriteDialogValues({
        transactionType: defaults.transactionType,
        value: defaults.value,
        gasPrice: defaults.gasPrice,
        maxFeePerGas: 'auto',
        maxPriorityFeePerGas: 'auto',
        gasLimit: defaults.estimatedGas,
        nonce: 'auto',
      });
      setManualWriteDialogError(defaults.simulationError ? normalizeContractActionErrorMessage(defaults.simulationError, txMessages.failedToSubmitContractTransaction) : null);
      setManualWriteTarget(signature);
    } catch (error) {
      const message = error instanceof Error ? error.message : txMessages.failedToSubmitContractTransaction;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setPendingWriteAction({ signature, type: 'manual-open' });
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: normalizeContractActionErrorMessage(message, txMessages.failedToSubmitContractTransaction),
      }));
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function executeManualWriteAction(signature: string, password?: string) {
    const fn = writeFunctions.find((item) => item.signature === signature);

    if (!fn) {
      return;
    }

    if (!activeKey) {
      setErrorMessage(txMessages.selectGlobalKeyFirst);
      return;
    }

    setActionLoadingKey(`manual-confirm:${signature}`);
    setWriteErrors((current) => {
      const next = { ...current };
      delete next[signature];
      return next;
    });

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input));
      const value = manualWriteDialogValues.value;
      const latestDefaults =
        manualWriteDialogValues.transactionType === 'EIP1559' &&
        (isAutoFieldValue(manualWriteDialogValues.maxFeePerGas) ||
          isAutoFieldValue(manualWriteDialogValues.maxPriorityFeePerGas) ||
          isAutoFieldValue(manualWriteDialogValues.nonce))
          ? await getEvmContractWriteManualDefaultsDirect({
              address: binding.address,
              abiJson: artifact.abiJson,
              functionSignature: signature,
              rawArgs,
              privateKey,
              value,
            })
          : isAutoFieldValue(manualWriteDialogValues.nonce)
            ? await getEvmContractWriteManualDefaultsDirect({
                address: binding.address,
                abiJson: artifact.abiJson,
                functionSignature: signature,
                rawArgs,
                privateKey,
                value,
              })
            : null;
      const resolvedDialogValues = {
        ...manualWriteDialogValues,
        value,
        maxFeePerGas: isAutoFieldValue(manualWriteDialogValues.maxFeePerGas)
          ? (latestDefaults?.maxFeePerGas ?? manualWriteDialogValues.maxFeePerGas)
          : manualWriteDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: isAutoFieldValue(manualWriteDialogValues.maxPriorityFeePerGas)
          ? (latestDefaults?.maxPriorityFeePerGas ?? manualWriteDialogValues.maxPriorityFeePerGas)
          : manualWriteDialogValues.maxPriorityFeePerGas,
        nonce: isAutoFieldValue(manualWriteDialogValues.nonce) ? (latestDefaults?.nonce ?? manualWriteDialogValues.nonce) : manualWriteDialogValues.nonce,
      };
      setManualWriteDialogValues(resolvedDialogValues);
      const result = await forceWriteEvmContractMethodDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs,
        privateKey,
        transactionType: resolvedDialogValues.transactionType,
        value: resolvedDialogValues.value,
        gasLimit: resolvedDialogValues.gasLimit,
        gasPrice: resolvedDialogValues.gasPrice,
        maxFeePerGas: resolvedDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: resolvedDialogValues.maxPriorityFeePerGas,
        nonce: resolvedDialogValues.nonce,
      });

      setWriteResults((current) => ({
        ...current,
        [signature]: result,
      }));
      setWriteValueBySignature((current) => ({
        ...current,
        [signature]: resolvedDialogValues.value,
      }));
      setWriteErrors((current) => {
        const next = { ...current };
        delete next[signature];
        return next;
      });
      setManualWriteTarget(null);
      setManualWriteDialogError(null);
      showToast(
        result.receipt.status === 'success'
          ? {
              title: translateRuntimeText('Force-send submitted', locale),
              description: translateRuntimeText(
                `${fn.name} was force-sent successfully. Included at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
                locale,
              ),
              tone: 'success',
            }
          : {
              title: translateRuntimeText('Force-send reverted', locale),
              description: translateRuntimeText(
                `${fn.name} reverted on-chain at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
                locale,
              ),
              tone: 'info',
            },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : txMessages.failedToSubmitContractTransaction;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setPendingWriteAction({ signature, type: 'manual-confirm' });
        setUnlockPassword('');
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: normalizeContractActionErrorMessage(message, txMessages.failedToSubmitContractTransaction),
      }));
      setManualWriteDialogError(normalizeContractActionErrorMessage(message, txMessages.failedToSubmitContractTransaction));
    } finally {
      setActionLoadingKey(null);
    }
  }

  async function handleConfirmUnlock() {
    if (!pendingWriteAction) {
      return;
    }

    try {
      setUnlockError(null);
      if (pendingWriteAction.type === 'manual-open') {
        await openManualWriteDialog(pendingWriteAction.signature, unlockPassword);
      } else if (pendingWriteAction.type === 'manual-confirm') {
        await executeManualWriteAction(pendingWriteAction.signature, unlockPassword);
      } else {
        await executeWriteAction(pendingWriteAction.signature, unlockPassword);
      }
      setUnlockDialogOpen(false);
      setUnlockPassword('');
      setPendingWriteAction(null);
    } catch (error) {
      setUnlockError(
        normalizeContractActionErrorMessage(
          error instanceof Error ? error.message : txMessages.failedToUnlockPrivateKey,
          txMessages.failedToUnlockPrivateKey,
        ),
      );
    }
  }

  const activeKeyStateLabel = !activeKey
    ? translateRuntimeText('No Key Selected', locale)
    : activeKey.securityMode === 'plain'
      ? activeKey.name
      : isEvmStoredPrivateKeyUnlocked(activeKey.id)
        ? `${activeKey.name} (${translateRuntimeText('Unlocked', locale)})`
        : `${activeKey.name} (${translateRuntimeText('Locked', locale)})`;

  function toggleExpandedSignature(signature: string, setExpanded: Dispatch<SetStateAction<string[]>>) {
    setExpanded((current) => (current.includes(signature) ? current.filter((item) => item !== signature) : [...current, signature]));
  }

  function resetReadView() {
    setExpandedReadSignatures([]);
    setReadArgumentValues(getInitialValuesWithCache(readFunctions));
    setReadResults({});
    setReadErrors({});
  }

  function resetWriteView() {
    setExpandedWriteSignatures([]);
    setWriteArgumentValues(getInitialValuesWithCache(writeFunctions));
    setWritePreviews({});
    setWriteResults({});
    setWriteErrors({});
    setWriteValueBySignature({});
    setManualWriteTarget(null);
    setManualWriteDialogError(null);
    setManualWriteDialogValues(createInitialManualWriteDialogState());
    setErrorMessage(null);
  }

  function copyFunctionSignature(fn: EvmContractFunctionDescriptor) {
    void copyText(fn.signature);
    showToast({
      title: txMessages.signatureCopied,
      description: txMessages.signatureCopiedDescription.replace('{signature}', fn.signature),
    });
  }

  function handleToggleReadSignature(signature: string) {
    const fn = readFunctions.find((item) => item.signature === signature);

    if (fn) {
      const cachedValues = getCachedArgumentValues(fn);

      if (cachedValues) {
        setReadArgumentValues((current) => ({
          ...current,
          [signature]: cachedValues,
        }));
      }
    }

    setExpandedReadSignatures((current) => {
      const isExpanded = current.includes(signature);

      if (isExpanded) {
        return current.filter((item) => item !== signature);
      }

      return [...current, signature];
    });

    if (fn && fn.inputs.length === 0) {
      void handleRead(signature);
    }
  }

  function handleQueryAction(fn: EvmContractFunctionDescriptor) {
    const isExpanded = expandedReadSignatures.includes(fn.signature);

    if (!isExpanded) {
      const cachedValues = getCachedArgumentValues(fn);

      if (cachedValues) {
        setReadArgumentValues((current) => ({
          ...current,
          [fn.signature]: cachedValues,
        }));
      }
      setExpandedReadSignatures((current) => [...current, fn.signature]);
    }

    if (fn.inputs.length === 0 || isExpanded) {
      void handleRead(fn.signature);
    }
  }

  return (
    <>
      <div className="inline-flex flex-wrap rounded-[14px] bg-slate-100 p-1">
        {[
          { value: 'code' as const, label: contractPanelMessages.code },
          { value: 'read' as const, label: contractPanelMessages.readContract },
          { value: 'write' as const, label: contractPanelMessages.writeContract },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`inline-flex h-8 items-center rounded-[10px] px-4 text-xs font-semibold transition ${
              activeTab === tab.value ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]' : 'text-slate-900 hover:text-slate-700'
            }`}
            onClick={() => {
              setActiveTab(tab.value);
              setErrorMessage(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'code' ? (
        <section className="mt-4 grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.labels.binding}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{binding.label}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.evmTxDetail.artifact}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{artifact.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.evmTxDetail.address}</p>
                <p className="mt-1 break-all text-sm text-slate-700 mono">{binding.address}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.labels.environment}</p>
                <p className="mt-1 text-sm text-slate-700">
                  {translateRuntimeText(`${environment.providerName} / Chain ${environment.chainId}`, locale)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{contractPanelMessages.abiJson}</p>
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip={contractPanelMessages.copyAbi}
                    aria-label={contractPanelMessages.copyAbi}
                    onClick={() => {
                      void copyText(artifact.abiJson);
                      showToast({
                        title: messages.common.copied,
                        description: contractPanelMessages.abiCopiedDescription,
                      });
                    }}
                  >
                    <IconCopy className="size-4" stroke={1.8} />
                  </ActionIconButton>
                </div>
                <JsonViewPanel className="mt-3 max-h-[420px] overflow-auto bg-slate-50 shadow-none" value={abiJsonValue} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{contractPanelMessages.artifactBytecode}</p>
                <pre className="mt-3 max-h-[260px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-800">
                  {artifact.bytecode ?? contractPanelMessages.noBytecodeSaved}
                </pre>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'read' ? (
        <div className="mt-4 grid gap-4">
          <FunctionListSection
            title={contractPanelMessages.readContract}
            functions={readFunctions}
            expandedSignatures={expandedReadSignatures}
            onToggle={handleToggleReadSignature}
            onExpandAll={() => setExpandedReadSignatures(readFunctions.map((fn) => fn.signature))}
            onCollapseAll={() => setExpandedReadSignatures([])}
            onReset={resetReadView}
            onCopySignature={copyFunctionSignature}
            renderHeaderActions={(fn) =>
              (() => {
                const isExpanded = expandedReadSignatures.includes(fn.signature);
                const canQuery = fn.inputs.length === 0 || isExpanded;
                const isLoading = actionLoadingKey === `read:${fn.signature}`;

                return (
                  <ActionIconButton
                    className={canQuery ? 'text-slate-400 hover:text-slate-700' : 'text-slate-300 hover:text-slate-300'}
                    tooltip={isLoading ? messages.common.running : messages.common.query}
                    aria-label={isLoading ? messages.common.running : messages.common.query}
                    onClick={() => handleQueryAction(fn)}
                    disabled={!canQuery || actionLoadingKey !== null}
                  >
                    {isLoading ? <IconLoader2 className="size-4 animate-spin" /> : <IconPlayerPlay className="size-4" stroke={1.8} />}
                  </ActionIconButton>
                );
              })()
            }
            inputBadgeLabel={messages.common.copyInput}
            emptyText={contractPanelMessages.readMethodsEmpty}
            renderExpanded={(fn) => (
              <div className="grid gap-4">
                <FunctionArgumentsForm
                  fn={fn}
                  values={readArgumentValues[fn.signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input))}
                  onChange={(index, value) => updateReadArgumentValue(fn.signature, index, value)}
                  selfAddress={activeKey?.address ?? null}
                />
                {readResults[fn.signature] ? (
                  <ValuePreview value={readResults[fn.signature]} />
                ) : readErrors[fn.signature] ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{translateRuntimeText(readErrors[fn.signature], locale)}</div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
                    {contractPanelMessages.queryMethodToViewResult}
                  </div>
                )}
              </div>
            )}
          />
        </div>
      ) : null}

      {activeTab === 'write' ? (
        <div className="mt-4 grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{txMessages.selectedKey}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeKeyStateLabel}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.labels.binding}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{binding.label}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{txMessages.contract}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{artifact.name}</p>
              </div>
            </div>
            {!activeKey ? <p className="mt-4 text-sm text-amber-600">{txMessages.selectGlobalKeyFirst}</p> : null}
          </article>

          {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{translateRuntimeText(errorMessage, locale)}</div> : null}

          <FunctionListSection
            title={contractPanelMessages.writeContract}
            functions={writeFunctions}
            expandedSignatures={expandedWriteSignatures}
            onToggle={(signature) => toggleExpandedSignature(signature, setExpandedWriteSignatures)}
            onExpandAll={() => setExpandedWriteSignatures(writeFunctions.map((fn) => fn.signature))}
            onCollapseAll={() => setExpandedWriteSignatures([])}
            onReset={resetWriteView}
            onCopySignature={copyFunctionSignature}
            headerTrailingContent={
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-slate-300 text-sky-600 focus-visible:ring-2 focus-visible:ring-sky-400"
                  checked={manualWriteMode}
                  onChange={(event) => setManualWriteMode(event.target.checked)}
                />
                {contractPanelMessages.manualSend}
              </label>
            }
            renderHeaderActions={(fn) =>
              (() => {
                const canWrite = fn.inputs.length === 0 || expandedWriteSignatures.includes(fn.signature);
                const isLoading =
                  actionLoadingKey === `write:${fn.signature}` || actionLoadingKey === `manual:${fn.signature}` || actionLoadingKey === `manual-confirm:${fn.signature}`;

                return (
                  <ActionIconButton
                    className={canWrite ? 'text-slate-400 hover:text-slate-700' : 'text-slate-300 hover:text-slate-300'}
                    tooltip={isLoading ? txMessages.sending : manualWriteMode ? txMessages.manualWrite : txMessages.write}
                    aria-label={isLoading ? txMessages.sending : manualWriteMode ? txMessages.manualWrite : txMessages.write}
                    onClick={() => void (manualWriteMode ? openManualWriteDialog(fn.signature) : executeWriteAction(fn.signature))}
                    disabled={!activeKey || !canWrite || actionLoadingKey !== null}
                  >
                    {isLoading ? <IconLoader2 className="size-4 animate-spin" /> : <IconBrandTelegram className="size-4" stroke={1.8} />}
                  </ActionIconButton>
                );
              })()
            }
            inputBadgeLabel={messages.common.copyInput}
            emptyText={contractPanelMessages.writeMethodsEmpty}
            renderExpanded={(fn) => (
              <div className="grid gap-4">
                <FunctionArgumentsForm
                  fn={fn}
                  values={writeArgumentValues[fn.signature] ?? fn.inputs.map((input) => getInitialArgumentValue(input))}
                  onChange={(index, value) => updateWriteArgumentValue(fn.signature, index, value)}
                  selfAddress={activeKey?.address ?? null}
                />
                {fn.stateMutability === 'payable' && !manualWriteMode ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{txMessages.valueNative.replace('{currency}', environment.nativeCurrency)}</label>
                    <Input value={writeValueBySignature[fn.signature] ?? ''} onChange={(event) => updateWriteValue(fn.signature, event.target.value)} placeholder="0" />
                  </div>
                ) : null}
                <WriteExecutionPreview preview={writePreviews[fn.signature] ?? null} result={writeResults[fn.signature] ?? null} error={writeErrors[fn.signature] ?? null} />
              </div>
            )}
          />
        </div>
      ) : null}

      <SecretInputDialog
        open={unlockDialogOpen}
        onOpenChange={(open) => {
          setUnlockDialogOpen(open);

          if (!open) {
            setUnlockPassword('');
            setUnlockError(null);
            setPendingWriteAction(null);
          }
        }}
        title={messages.privateKeys.unlockPrivateKey}
        description={activeKey ? messages.sendTx.unlockDescription.replace('{name}', activeKey.name) : messages.sendTx.unlockFallbackDescription}
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder={messages.sendTx.password}
        confirmLabel={messages.sendTx.unlock}
        errorMessage={unlockError}
        confirmDisabled={!unlockPassword.trim()}
        onConfirm={() => void handleConfirmUnlock()}
      />
      <ModalDialog
        open={manualWriteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setManualWriteTarget(null);
            setManualWriteDialogError(null);
          }
        }}
        title={contractPanelMessages.manualWriteTitle}
        description={contractPanelMessages.manualWriteDescription}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setManualWriteTarget(null);
                setManualWriteDialogError(null);
              }}
            >
              {messages.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (manualWriteTarget) {
                  void executeManualWriteAction(manualWriteTarget);
                }
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={!manualWriteTarget || !isManualWriteDialogReady(manualWriteDialogValues) || actionLoadingKey === `manual-confirm:${manualWriteTarget}`}
            >
              {manualWriteTarget && actionLoadingKey === `manual-confirm:${manualWriteTarget}` ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  {txMessages.sending}
                </>
              ) : (
                txMessages.confirmForceSend
              )}
            </Button>
          </>
        }
        maxWidthClassName="max-w-lg"
      >
        {manualWriteTarget ? (
          <div className="grid gap-4 pb-1">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.contract}</p>
                <p className="mt-1 break-all text-sm text-slate-900 mono">{binding.address}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.method}</p>
                  <p className="mt-1 text-sm text-slate-900">{manualWriteTarget}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.selectedKey}</p>
                  <p className="mt-1 text-sm text-slate-900">{activeKey?.name ?? contractPanelMessages.noKeySelected}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.txnType}</label>
                <Select
                  value={manualWriteDialogValues.transactionType}
                  onValueChange={(value) =>
                    setManualWriteDialogValues((current) => ({
                      ...current,
                      transactionType: value as ManualWriteTransactionType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={txMessages.selectTransactionType} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIP1559">{translateRuntimeText('EIP-1559', locale)}</SelectItem>
                    <SelectItem value="LEGACY">{messages.sendTx.legacy}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.valueNative.replace('{currency}', environment.nativeCurrency)}</label>
                <Input
                  value={manualWriteDialogValues.value}
                  onChange={(event) =>
                    setManualWriteDialogValues((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              {manualWriteDialogValues.transactionType === 'LEGACY' ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{txMessages.gasPriceGwei}</label>
                  <Input
                    value={manualWriteDialogValues.gasPrice}
                    onChange={(event) =>
                      setManualWriteDialogValues((current) => ({
                        ...current,
                        gasPrice: event.target.value,
                      }))
                    }
                    placeholder={messages.sendTx.autoPlaceholder}
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{txMessages.maxFeePerGasGwei}</label>
                    <Input
                      value={manualWriteDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setManualWriteDialogValues((current) => ({
                          ...current,
                          maxFeePerGas: event.target.value,
                        }))
                      }
                      placeholder={messages.sendTx.autoPlaceholder}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{txMessages.maxPriorityFeePerGasGwei}</label>
                    <Input
                      value={manualWriteDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setManualWriteDialogValues((current) => ({
                          ...current,
                          maxPriorityFeePerGas: event.target.value,
                        }))
                      }
                      placeholder={messages.sendTx.autoPlaceholder}
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.gasLimit}</label>
                <Input
                  value={manualWriteDialogValues.gasLimit}
                  onChange={(event) =>
                    setManualWriteDialogValues((current) => ({
                      ...current,
                      gasLimit: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.nonce}</label>
                <Input
                  value={manualWriteDialogValues.nonce}
                  onChange={(event) =>
                    setManualWriteDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder={messages.sendTx.autoPlaceholder}
                />
              </div>
            </div>
            {manualWriteDialogError ? (
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {translateRuntimeText(manualWriteDialogError, locale)}
              </div>
            ) : null}
          </div>
        ) : null}
      </ModalDialog>
    </>
  );
}
