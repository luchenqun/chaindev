'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowsExchange, IconArrowRight, IconCode, IconCopy, IconLoader2 } from '@tabler/icons-react';
import { decodeErrorResult, formatEther } from 'viem';
import { Button, buttonVariants } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { DetailPageSkeleton } from '@/components/ui/loading-placeholders';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { RelativeTime } from '@/components/relative-time';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { subscribeEvmContractRegistry } from '@/domains/evm/client/contract-registry';
import {
  forceSendEvmTransactionDirect,
  forceWriteEvmContractMethodDirect,
  getActiveEvmContractEnvironmentDirect,
} from '@/domains/evm/client/contract-executor';
import {
  getActiveEvmStoredPrivateKey,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from '@/domains/evm/client/keyring';
import { decodeBoundEvmReceiptLog, decodeBoundEvmTransactionInput, decodeHexToUtf8, resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { getEvmTransactionByHashDirect, getEvmTransactionDebugTraceDirect } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { formatLocalizedDateTime } from '@/i18n/format';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

const DECODE_EVM_TX_STORAGE_KEY = 'chaindev:decode-evm-tx:input-data';
const DECODE_EVM_EVENT_STORAGE_KEY = 'chaindev:decode-evm-event:logs';

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const { locale } = useLocale();

  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{translateRuntimeText(label, locale)}</dt>
      <dd className={mono ? 'self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono' : 'self-start text-sm text-slate-900'}>{value}</dd>
    </div>
  );
}

function DetailGroup({ children, separated = false }: { children: React.ReactNode; separated?: boolean }) {
  return <div className={separated ? 'border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0' : 'pb-2.5 last:pb-0'}>{children}</div>;
}

function extractTraceReturnValue(traceData: unknown) {
  if (!traceData || typeof traceData !== 'object') {
    return null;
  }

  const candidate = 'returnValue' in traceData ? traceData.returnValue : 'output' in traceData ? traceData.output : null;

  if (typeof candidate !== 'string' || candidate.length === 0) {
    return null;
  }

  return candidate.startsWith('0x') ? candidate : `0x${candidate}`;
}

function decodeTraceReturnValue(returnValue: string | null) {
  if (!returnValue || returnValue === '0x') {
    return null;
  }

  try {
    const decoded = decodeErrorResult({ data: returnValue as `0x${string}` });

    if (!decoded.args || decoded.args.length === 0) {
      return decoded.errorName;
    }

    return `${decoded.errorName}: ${decoded.args.map((value) => String(value)).join(', ')}`;
  } catch {
    return null;
  }
}

function splitInputDataWords(inputData: string) {
  if (!inputData.startsWith('0x') || inputData.length <= 10) {
    return [];
  }

  const payload = inputData.slice(10);
  const words: string[] = [];

  for (let index = 0; index < payload.length; index += 64) {
    const word = payload.slice(index, index + 64);

    if (word) {
      words.push(word);
    }
  }

  return words;
}

function buildDefaultInputDataView(
  inputData: string,
  labels: {
    functionLabel: string;
    methodId: string;
  },
  functionSignature?: string,
  selector?: string,
) {
  const lines: string[] = [];

  if (functionSignature) {
    lines.push(`${labels.functionLabel}: ${functionSignature}`);
    lines.push('');
  }

  lines.push(`${labels.methodId}: ${selector ?? inputData.slice(0, 10)}`);

  for (const [index, word] of splitInputDataWords(inputData).entries()) {
    lines.push(`[${index}]:  ${word}`);
  }

  return lines.join('\n');
}

type RewriteTransactionType = 'LEGACY' | 'EIP1559';

type RewriteDialogState = {
  transactionType: RewriteTransactionType;
  value: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  nonce: string;
};

type RewriteEnvironmentState = {
  chainId: string;
  nativeCurrency: string;
} | null;

function createInitialRewriteDialogState(input?: { transactionType?: RewriteTransactionType; value?: string; gasLimit?: string }): RewriteDialogState {
  return {
    transactionType: input?.transactionType ?? 'EIP1559',
    value: input?.value ?? '0',
    gasPrice: 'auto',
    maxFeePerGas: 'auto',
    maxPriorityFeePerGas: 'auto',
    gasLimit: input?.gasLimit ?? '',
    nonce: 'auto',
  };
}

function isAutoFieldValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || normalizedValue === 'auto';
}

function isValidNativeValueInput(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedValue);
}

function isRewriteDialogReady(state: RewriteDialogState) {
  if (!isValidNativeValueInput(state.value) || !state.gasLimit.trim()) {
    return false;
  }

  if (state.transactionType === 'LEGACY') {
    return isAutoFieldValue(state.gasPrice) || !!state.gasPrice.trim();
  }

  return (
    (isAutoFieldValue(state.nonce) || !!state.nonce.trim()) &&
    (isAutoFieldValue(state.maxFeePerGas) || !!state.maxFeePerGas.trim()) &&
    (isAutoFieldValue(state.maxPriorityFeePerGas) || !!state.maxPriorityFeePerGas.trim())
  );
}

function normalizeContractActionErrorMessage(
  message: string,
  fallback: string,
  labels: {
    transactionRejectedMissingRole: string;
    transactionRevertedWithReason: string;
  },
) {
  const roleMissingMatch = message.match(/missing role\s+(0x[a-fA-F0-9]+)/i);

  if (roleMissingMatch) {
    return labels.transactionRejectedMissingRole.replace('{role}', roleMissingMatch[1]);
  }

  const revertReasonMatch = message.match(/execution reverted:\s*(.+?)(?:\s+Version:|$)/i);

  if (revertReasonMatch?.[1]) {
    return labels.transactionRevertedWithReason.replace('{reason}', revertReasonMatch[1].trim());
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `${fallback} ${rpcDescMatch[1].trim()}.`;
  }

  return message;
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

function formatMiddleEllipsis(value: string, leading = 10, trailing = 8) {
  if (value.length <= leading + trailing + 3) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

type ReceiptLogRecord = {
  address: string;
  data: string;
  topics: string[];
  logIndex: number | null;
};

type DecodedLogViewMode = 'dec' | 'hex';

function isAddressValue(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isReceiptLogRecord(value: unknown): value is ReceiptLogRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    'data' in value &&
    'topics' in value &&
    typeof value.address === 'string' &&
    typeof value.data === 'string' &&
    Array.isArray(value.topics) &&
    value.topics.every((topic) => typeof topic === 'string')
  );
}

function normalizeReceiptLogs(logs: unknown): ReceiptLogRecord[] {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.flatMap((item, index) => {
    if (!isReceiptLogRecord(item)) {
      return [];
    }

    const logIndex = 'logIndex' in item && (typeof item.logIndex === 'number' || typeof item.logIndex === 'string') ? Number(item.logIndex) : index;

    return [
      {
        address: item.address,
        data: item.data,
        topics: item.topics,
        logIndex: Number.isFinite(logIndex) ? logIndex : index,
      },
    ];
  });
}

function formatEventArgumentDisplayValue(value: string, unavailableLabel: string) {
  if (value === 'undefined') {
    return unavailableLabel;
  }

  return value;
}

function DecodedLogAddress({ address, nameTagsByAddress }: { address: string; nameTagsByAddress: Record<string, string | null> }) {
  return (
    <AddressLink
      address={address}
      href={`/evm/address/${address}`}
      label={nameTagsByAddress[address] ?? address}
      className="break-all font-medium text-sky-600 hover:text-sky-700"
    />
  );
}

function DecodedReceiptLogsSection({
  logs,
  nameTagsByAddress,
  onOpenDecoder,
}: {
  logs: Array<{
    key: string;
    raw: ReceiptLogRecord;
    decoded: ReturnType<typeof decodeBoundEvmReceiptLog>;
  }>;
  nameTagsByAddress: Record<string, string | null>;
  onOpenDecoder: () => void;
}) {
  const messages = useMessages();
  const txMessages = messages.evmTxDetail;
  const [topicViews, setTopicViews] = useState<Record<string, DecodedLogViewMode>>({});
  const [dataViews, setDataViews] = useState<Record<string, DecodedLogViewMode>>({});

  if (!logs.length) {
    return null;
  }

  return (
    <div className="mb-1">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{txMessages.receiptEventLogs}</h3>
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'whitespace-nowrap' })} onClick={onOpenDecoder}>
          <IconArrowRight className="mr-1.5 size-3.5" stroke={1.8} />
          {messages.decodeEvmEvent.openInDecoder}
        </button>
      </div>
      <div>
        {logs.map((log, index) => {
          const decoded = log.decoded;
          const title = decoded ? messages.decodeEvmEvent.logTitle.replace('{index}', String(index + 1)) : messages.decodeEvmEvent.unableToDecodeLog.replace('{index}', String(index + 1));

          if (!decoded) {
            return (
              <section key={log.key} className={index === 0 ? 'border-t border-slate-200 pt-3 pb-3' : 'pb-3'}>
                <div className="rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
                  </div>
                  <div className="p-4">
                    <p className="mb-3 text-sm text-slate-500">{messages.decodeEvmEvent.unableToDecodeLog.replace('{index}', String(index + 1))}</p>
                    <JsonViewPanel value={log.raw as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
                  </div>
                </div>
              </section>
            );
          }

          const indexedArgs = decoded.args.filter((arg) => arg.indexed);
          const nonIndexedArgs = decoded.args.filter((arg) => !arg.indexed);
          const dataView = dataViews[log.key] ?? 'dec';

          return (
            <section key={log.key} className={index === 0 ? 'border-t border-slate-200 pt-3 pb-3' : 'pb-3'}>
              <div className="rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
                </div>

                <div className="p-4">
                  <dl className="space-y-2">
                    <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                      <dt className="text-xs font-semibold text-slate-600">{txMessages.address}</dt>
                      <dd className="min-w-0 text-xs text-slate-900">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <DecodedLogAddress address={log.raw.address} nameTagsByAddress={nameTagsByAddress} />
                        </div>
                      </dd>
                    </div>

                    <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                      <dt className="text-xs font-semibold text-slate-600">{txMessages.name}</dt>
                      <dd className="min-w-0 text-xs text-slate-900">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span className="font-semibold text-slate-800">{decoded.eventName}</span>
                          <span className="text-slate-500">({decoded.eventSignature.slice(decoded.eventName.length + 1, -1)})</span>
                        </div>
                      </dd>
                    </div>

                    <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                      <dt className="text-xs font-semibold text-slate-600">{txMessages.topics}</dt>
                      <dd className="min-w-0 space-y-2 text-xs text-slate-900">
                        {decoded.topic0 ? (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 mono text-xs text-slate-700">
                            <span className="mr-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">0</span>
                            {decoded.topic0}
                          </div>
                        ) : null}

                        {indexedArgs.map((arg, argIndex) => {
                          const viewKey = `${log.key}-topic-${argIndex}`;
                          const view = topicViews[viewKey] ?? 'dec';
                          const displayValue =
                            view === 'hex' ? (arg.rawHex ?? messages.common.unavailable) : formatEventArgumentDisplayValue(arg.value, messages.common.unavailable);

                          return (
                            <div key={viewKey} className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex h-[30px] items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                                {argIndex + 1}: {arg.name}
                              </span>
                              <div className="relative min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-[132px] text-xs text-slate-700">
                                <div className="absolute bottom-0 right-0 top-0 inline-flex overflow-hidden rounded-r-lg border-l border-slate-200 bg-slate-100">
                                  <button
                                    type="button"
                                    className={
                                      view === 'dec'
                                        ? 'h-full px-3 text-xs font-semibold text-slate-900'
                                        : 'h-full bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                                    }
                                    onClick={() =>
                                      setTopicViews((current) => ({
                                        ...current,
                                        [viewKey]: 'dec',
                                      }))
                                    }
                                  >
                                    {txMessages.dec}
                                  </button>
                                  <button
                                    type="button"
                                    className={
                                      view === 'hex'
                                        ? 'h-full border-l border-slate-200 px-3 text-xs font-semibold text-slate-900'
                                        : 'h-full border-l border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                                    }
                                    onClick={() =>
                                      setTopicViews((current) => ({
                                        ...current,
                                        [viewKey]: 'hex',
                                      }))
                                    }
                                  >
                                    {txMessages.hex}
                                  </button>
                                </div>
                                {view === 'dec' && isAddressValue(arg.value) ? (
                                  <DecodedLogAddress address={arg.value} nameTagsByAddress={nameTagsByAddress} />
                                ) : (
                                  <span className="break-all mono">{displayValue}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </dd>
                    </div>

                    <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                      <dt className="text-xs font-semibold text-slate-600">{txMessages.data}</dt>
                      <dd className="min-w-0 text-xs text-slate-900">
                        <div className="relative min-h-[30px] rounded-lg border border-slate-200 bg-white px-3 pr-[132px]">
                          <div className="absolute bottom-0 right-0 top-0 inline-flex overflow-hidden rounded-r-lg border-l border-slate-200 bg-slate-100">
                            <button
                              type="button"
                              className={
                                dataView === 'dec'
                                  ? 'h-full px-3 text-xs font-semibold text-slate-900'
                                  : 'h-full bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                              }
                              onClick={() =>
                                setDataViews((current) => ({
                                  ...current,
                                  [log.key]: 'dec',
                                }))
                              }
                            >
                              {txMessages.dec}
                            </button>
                            <button
                              type="button"
                              className={
                                dataView === 'hex'
                                  ? 'h-full border-l border-slate-200 px-3 text-xs font-semibold text-slate-900'
                                  : 'h-full border-l border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                              }
                              onClick={() =>
                                setDataViews((current) => ({
                                  ...current,
                                  [log.key]: 'hex',
                                }))
                              }
                            >
                              {txMessages.hex}
                            </button>
                          </div>
                          {dataView === 'hex' ? (
                            <p className="flex min-h-[30px] items-center break-all py-1.5 pr-2 mono text-xs text-slate-700">{log.raw.data || '0x'}</p>
                          ) : nonIndexedArgs.length > 1 ? (
                            <div className="space-y-1 py-2 pr-2">
                              {nonIndexedArgs.map((arg, argIndex) => (
                                <div key={`${log.key}-data-${argIndex}`} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                                  <span className="font-medium text-slate-500">
                                    {arg.name} ({arg.type}) :
                                  </span>
                                  {isAddressValue(arg.value) ? (
                                    <DecodedLogAddress address={arg.value} nameTagsByAddress={nameTagsByAddress} />
                                  ) : (
                                    <span className="break-all mono">{formatEventArgumentDisplayValue(arg.value, messages.common.unavailable)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : nonIndexedArgs.length === 1 ? (
                            <div className="flex min-h-[30px] items-center py-1.5 pr-2 text-xs text-slate-700">
                              {isAddressValue(nonIndexedArgs[0].value) ? (
                                <>
                                  <span className="mr-1.5 font-medium text-slate-500">
                                    {nonIndexedArgs[0].name} ({nonIndexedArgs[0].type}) :
                                  </span>
                                  <DecodedLogAddress address={nonIndexedArgs[0].value} nameTagsByAddress={nameTagsByAddress} />
                                </>
                              ) : (
                                <span className="break-all mono">
                                  {nonIndexedArgs[0].name} ({nonIndexedArgs[0].type}) : {formatEventArgumentDisplayValue(nonIndexedArgs[0].value, messages.common.unavailable)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="flex min-h-[30px] items-center py-1.5 pr-2 mono text-xs text-slate-500">{txMessages.noNonIndexedEventData}</p>
                          )}
                        </div>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function extractTransactionRawField(rawJson: unknown, field: string) {
  if (!rawJson || typeof rawJson !== 'object' || !('transaction' in rawJson)) {
    return null;
  }

  const transaction = rawJson.transaction;

  if (!transaction || typeof transaction !== 'object' || !(field in transaction)) {
    return null;
  }

  const value = transaction[field as keyof typeof transaction];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function extractTransactionValueInput(rawJson: unknown) {
  const rawValue = extractTransactionRawField(rawJson, 'value');

  if (!rawValue) {
    return '0';
  }

  try {
    return formatEther(BigInt(rawValue));
  } catch {
    return '0';
  }
}

function extractTransactionGasLimit(rawJson: unknown) {
  const rawGas = extractTransactionRawField(rawJson, 'gas');

  return rawGas && /^\d+$/.test(rawGas) ? rawGas : '';
}

function resolveRewriteTransactionType(rawJson: unknown): RewriteTransactionType {
  const rawType = extractTransactionRawField(rawJson, 'type')?.toLowerCase();

  if (rawType === 'eip1559' || rawType === '0x2' || rawType === '2') {
    return 'EIP1559';
  }

  return 'LEGACY';
}

function RewriteArgumentsForm({ args, values, onChange }: { args: Array<{ name: string; type: string }>; values: string[]; onChange: (index: number, value: string) => void }) {
  return (
    <div className="grid gap-3">
      {args.map((arg, index) => {
        const isComplex = arg.type.includes('[') || arg.type === 'tuple';

        return (
          <div key={`${arg.name}-${arg.type}-${index}`} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {arg.name} <span className="text-slate-400">({arg.type})</span>
            </label>
            {isComplex ? (
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
                value={values[index] ?? ''}
                onChange={(event) => onChange(index, event.target.value)}
              />
            ) : (
              <Input value={values[index] ?? ''} onChange={(event) => onChange(index, event.target.value)} placeholder={arg.type} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EvmTxPage() {
  const router = useRouter();
  const messages = useMessages();
  const { locale } = useLocale();
  const txMessages = messages.evmTxDetail;
  const params = useParams<{ hash: string }>();
  const { showToast } = useToast();
  const hash = params.hash;
  const { status } = useEvmHomeData();
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{64}$/.test(hash), [hash]);
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getEvmTransactionByHashDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'debugTrace' | 'json'>('overview');
  const [traceData, setTraceData] = useState<unknown>(null);
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [inputDataView, setInputDataView] = useState<'default' | 'utf8' | 'original'>('default');
  const [showDecodedInputTable, setShowDecodedInputTable] = useState(false);
  const [decodeVersion, setDecodeVersion] = useState(0);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [rewriteEnvironment, setRewriteEnvironment] = useState<RewriteEnvironmentState>(null);
  const [rewriteDialogOpen, setRewriteDialogOpen] = useState(false);
  const [rewriteArgumentValues, setRewriteArgumentValues] = useState<string[]>([]);
  const [rewriteDialogValues, setRewriteDialogValues] = useState<RewriteDialogState>(createInitialRewriteDialogState());
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteActionLoading, setRewriteActionLoading] = useState<'rewrite' | null>(null);
  const [rewriteUnlockDialogOpen, setRewriteUnlockDialogOpen] = useState(false);
  const [rewriteUnlockPassword, setRewriteUnlockPassword] = useState('');
  const [rewriteUnlockError, setRewriteUnlockError] = useState<string | null>(null);
  const [copiedInputDataKey, setCopiedInputDataKey] = useState<string | null>(null);
  const copiedInputDataTimeoutRef = useRef<number | null>(null);
  const decodedInputCopyButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const normalizedReceiptLogs = useMemo(() => normalizeReceiptLogs(transaction?.logs), [transaction]);
  const decodedReceiptLogs = useMemo(() => {
    void decodeVersion;

    return normalizedReceiptLogs.map((log, index) => ({
      key: `${log.logIndex ?? index}-${log.address}-${index}`,
      raw: log,
      decoded: decodeBoundEvmReceiptLog({
        address: log.address,
        topics: log.topics,
        data: log.data,
      }),
    }));
  }, [normalizedReceiptLogs, decodeVersion]);
  const visibleAddresses = useMemo(
    () =>
      transaction
        ? [
            transaction.from,
            ...(transaction.to ? [transaction.to] : []),
            ...(transaction.interactedWith ? [transaction.interactedWith] : []),
            ...decodedReceiptLogs.flatMap((log) => [log.raw.address, ...(log.decoded?.args ?? []).map((arg) => arg.value).filter((value) => isAddressValue(value))]),
          ]
        : [],
    [decodedReceiptLogs, transaction],
  );
  const decodedTransactionInput = useMemo(() => {
    void decodeVersion;

    return transaction
      ? decodeBoundEvmTransactionInput({
          to: transaction.interactedWith ?? transaction.to,
          inputData: transaction.inputData,
        })
      : null;
  }, [transaction, decodeVersion]);
  const decodedMethodLabel = useMemo(() => {
    void decodeVersion;

    return transaction
      ? resolveEvmTransactionMethodLabel({
          to: transaction.interactedWith ?? transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        })
      : '';
  }, [transaction, decodeVersion]);
  const utf8InputData = useMemo(() => (transaction ? decodeHexToUtf8(transaction.inputData) : null), [transaction]);
  const defaultInputDataView = useMemo(
    () =>
      transaction
        ? buildDefaultInputDataView(
            transaction.inputData,
            {
              functionLabel: txMessages.functionLabel,
              methodId: txMessages.methodId,
            },
            decodedTransactionInput?.functionSignature,
            decodedTransactionInput?.selector,
          )
        : '',
    [transaction, decodedTransactionInput],
  );
  const rewriteTargetAddress = useMemo(() => transaction?.interactedWith ?? transaction?.to ?? null, [transaction]);
  const isContractDeployment = Boolean(transaction && !transaction.to);
  const isRewriteTransfer = Boolean(transaction?.to && transaction.inputData === '0x');
  const canRewriteTransaction = Boolean(!isContractDeployment && rewriteTargetAddress && (decodedTransactionInput || isRewriteTransfer));

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmTransactionByHashDirect(hash);

        if (!cancelled) {
          setTransaction(next);
          setErrorMessage(null);
          setTraceData(null);
          setTraceErrorMessage(null);
          setTraceLoading(false);
          setActiveTab('overview');
          setInputDataView('default');
          setShowDecodedInputTable(false);
        }
      } catch (error) {
        if (!cancelled) {
          setTransaction(null);
          setErrorMessage(error instanceof Error ? error.message : txMessages.failedToLoadFallback);
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [hash, isValid]);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEnvironment() {
      try {
        const next = await getActiveEvmContractEnvironmentDirect();

        if (!cancelled) {
          setRewriteEnvironment({
            chainId: next.chainId,
            nativeCurrency: next.nativeCurrency,
          });
        }
      } catch {
        if (!cancelled) {
          setRewriteEnvironment(null);
        }
      }
    }

    void loadEnvironment();
    window.addEventListener('chaindev:active-rpc-profile-changed', loadEnvironment);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', loadEnvironment);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, []);

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

  useEffect(() => {
    return () => {
      if (copiedInputDataTimeoutRef.current != null) {
        window.clearTimeout(copiedInputDataTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyDecodedInputData(value: string, copyId: string) {
    await copyText(value);
    setCopiedInputDataKey(copyId);

    if (copiedInputDataTimeoutRef.current != null) {
      window.clearTimeout(copiedInputDataTimeoutRef.current);
    }

    copiedInputDataTimeoutRef.current = window.setTimeout(() => {
      setCopiedInputDataKey((current) => (current === copyId ? null : current));
      copiedInputDataTimeoutRef.current = null;
    }, 1600);
  }

  function openRewriteDialog() {
    if (!transaction || !canRewriteTransaction || !rewriteTargetAddress) {
      return;
    }

    setRewriteArgumentValues(decodedTransactionInput?.args.map((arg) => arg.value) ?? []);
    setRewriteDialogValues(
      createInitialRewriteDialogState({
        transactionType: resolveRewriteTransactionType(transaction.rawJson),
        value: extractTransactionValueInput(transaction.rawJson),
        gasLimit: extractTransactionGasLimit(transaction.rawJson),
      }),
    );
    setRewriteError(null);
    setRewriteActionLoading(null);
    setRewriteUnlockDialogOpen(false);
    setRewriteUnlockPassword('');
    setRewriteUnlockError(null);
    setRewriteDialogOpen(true);
  }

  async function executeRewriteAction(password?: string) {
    if (!transaction || !rewriteTargetAddress || !activeKey || !canRewriteTransaction) {
      return;
    }

    setRewriteActionLoading('rewrite');
    setRewriteError(null);
    let rewriteSucceeded = false;

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const result = decodedTransactionInput
        ? await forceWriteEvmContractMethodDirect({
            address: rewriteTargetAddress,
            abiJson: decodedTransactionInput.abiJson,
            functionSignature: decodedTransactionInput.functionSignature,
            rawArgs: rewriteArgumentValues,
            privateKey,
            transactionType: rewriteDialogValues.transactionType,
            value: rewriteDialogValues.value,
            gasLimit: rewriteDialogValues.gasLimit,
            gasPrice: rewriteDialogValues.gasPrice,
            maxFeePerGas: rewriteDialogValues.maxFeePerGas,
            maxPriorityFeePerGas: rewriteDialogValues.maxPriorityFeePerGas,
            nonce: rewriteDialogValues.nonce,
          })
        : await forceSendEvmTransactionDirect({
            to: rewriteTargetAddress,
            privateKey,
            transactionType: rewriteDialogValues.transactionType,
            value: rewriteDialogValues.value,
            gasLimit: rewriteDialogValues.gasLimit,
            gasPrice: rewriteDialogValues.gasPrice,
            maxFeePerGas: rewriteDialogValues.maxFeePerGas,
            maxPriorityFeePerGas: rewriteDialogValues.maxPriorityFeePerGas,
            nonce: rewriteDialogValues.nonce,
            data: transaction.inputData,
          });

      setRewriteDialogOpen(false);
      rewriteSucceeded = true;
      showToast(
        result.receipt.status === 'success'
          ? {
              title: txMessages.rewriteSubmitted,
              description: txMessages.rewriteSubmittedDescription
                .replace('{name}', decodedTransactionInput?.functionName ?? txMessages.transfer)
                .replace('{time}', formatChainTimestamp(result.receipt.blockTimestamp))
                .replace('{hash}', formatMiddleEllipsis(result.hash)),
              tone: 'success',
            }
          : {
              title: txMessages.rewriteReverted,
              description: txMessages.rewriteRevertedDescription
                .replace('{name}', decodedTransactionInput?.functionName ?? txMessages.transfer)
                .replace('{time}', formatChainTimestamp(result.receipt.blockTimestamp))
                .replace('{hash}', formatMiddleEllipsis(result.hash)),
              tone: 'info',
            },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : txMessages.failedToRewriteTransaction;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setRewriteUnlockPassword('');
        setRewriteUnlockError(null);
        setRewriteUnlockDialogOpen(true);
        return;
      }

      setRewriteError(
        normalizeContractActionErrorMessage(message, txMessages.failedToRewriteTransaction, {
          transactionRejectedMissingRole: txMessages.transactionRejectedMissingRole,
          transactionRevertedWithReason: txMessages.transactionRevertedWithReason,
        }),
      );
    } finally {
      if (!rewriteSucceeded) {
        setRewriteActionLoading(null);
      }
    }
  }

  async function handleConfirmRewriteUnlock() {
    if (!activeKey) {
      return;
    }

    try {
      await resolveEvmStoredPrivateKey(activeKey.id, rewriteUnlockPassword);
      setRewriteUnlockDialogOpen(false);
      setRewriteUnlockPassword('');
      setRewriteUnlockError(null);
      await executeRewriteAction(rewriteUnlockPassword);
    } catch (error) {
      setRewriteUnlockError(
        normalizeContractActionErrorMessage(error instanceof Error ? error.message : txMessages.failedToUnlockPrivateKey, txMessages.failedToUnlockPrivateKey, {
          transactionRejectedMissingRole: txMessages.transactionRejectedMissingRole,
          transactionRevertedWithReason: txMessages.transactionRevertedWithReason,
        }),
      );
    }
  }

  async function handleOpenDebugTraceTab() {
    setActiveTab('debugTrace');

    if (traceData !== null || traceLoading) {
      return;
    }

    setTraceLoading(true);
    setTraceErrorMessage(null);

    try {
      const next = await getEvmTransactionDebugTraceDirect(hash);
      setTraceData(next);
    } catch (error) {
      setTraceErrorMessage(error instanceof Error ? error.message : txMessages.providerNoDebugTrace);
    } finally {
      setTraceLoading(false);
    }
  }

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>{txMessages.invalidHashTitle}</h1>
          <p>{txMessages.invalidHashDescription}</p>
        </main>
      </AppShell>
    );
  }

  if (!transaction) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-52" groups={3} rowsPerGroup={4} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>{txMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  const showDebugTraceTab = transaction.status === 'reverted';
  const traceReturnValue = extractTraceReturnValue(traceData);
  const decodedTraceReturnValue = decodeTraceReturnValue(traceReturnValue);
  const hasLogs = transaction.logsCount > 0;
  const liveConfirmationsLabel =
    transaction.blockNumber && status?.latestBlockNumber != null
      ? Math.max(0, status.latestBlockNumber - Number(transaction.blockNumber) + 1).toLocaleString(locale)
      : transaction.confirmationsLabel;

  function openTxInputDecoder() {
    if (!transaction) {
      return;
    }

    window.sessionStorage.setItem(DECODE_EVM_TX_STORAGE_KEY, transaction.inputData);
    router.push('/tools/decode-evm-tx');
  }

  function openTxLogsDecoder() {
    if (!transaction) {
      return;
    }

    window.sessionStorage.setItem(DECODE_EVM_EVENT_STORAGE_KEY, JSON.stringify(transaction.logs, null, 2));
    router.push('/tools/decode-evm-event');
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{txMessages.transactionDetails}</h1>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === 'overview' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('overview')}
          >
            {txMessages.overview}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              !hasLogs ? 'cursor-not-allowed bg-slate-100 text-slate-300' : activeTab === 'logs' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
            onClick={() => {
              if (hasLogs) {
                setActiveTab('logs');
              }
            }}
            disabled={!hasLogs}
            aria-disabled={!hasLogs}
          >
            {txMessages.logs} ({transaction.logsCount})
          </button>
          {showDebugTraceTab ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === 'debugTrace' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              onClick={() => void handleOpenDebugTraceTab()}
            >
              {txMessages.debugTrace}
            </button>
          ) : null}
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${activeTab === 'json' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => setActiveTab('json')}
          >
            {txMessages.json}
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                <DetailGroup>
                  <dl>
                    <DetailRow label={txMessages.transactionHash} value={transaction.hash} mono />
                    <DetailRow
                      label={txMessages.status}
                      value={
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            transaction.status === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : transaction.status === 'reverted'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {translateRuntimeText(transaction.statusLabel, locale)}
                        </span>
                      }
                    />
                    <DetailRow
                      label={messages.common.block}
                      value={
                        transaction.blockNumber ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                            {liveConfirmationsLabel ? (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
                                {translateRuntimeText(`${liveConfirmationsLabel} ${messages.common.block} ${txMessages.confirmations}`, locale)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          messages.common.pending
                        )
                      }
                    />
                    <DetailRow
                      label={txMessages.timestamp}
                      value={
                        transaction.timestampMs ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>
                              <RelativeTime timestampMs={transaction.timestampMs} />
                            </span>
                            <span className="text-slate-500">({translateRuntimeText(transaction.timestampLabel, locale)})</span>
                          </span>
                        ) : (
                          messages.common.unavailable
                        )
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow
                      label={messages.common.from}
                      value={
                        <AddressLink
                          address={transaction.from}
                          href={`/evm/address/${transaction.from}`}
                          label={nameTagsByAddress[transaction.from] ?? transaction.from}
                          className="font-medium text-sky-600 hover:text-sky-700 mono"
                          tooltipClassName="max-w-[90vw]"
                        />
                      }
                    />
                    <DetailRow
                      label={txMessages.interactedWithTo}
                      value={
                        transaction.interactedWith ? (
                          <AddressLink
                            address={transaction.interactedWith}
                            href={`/evm/address/${transaction.interactedWith}`}
                            label={resolvePreferredToAddressLabel(transaction.interactedWith, { nameTagsByAddress })}
                            className="font-medium text-sky-600 hover:text-sky-700 mono"
                            tooltipClassName="max-w-[90vw]"
                          />
                        ) : (
                          txMessages.contractCreation
                        )
                      }
                    />
                    <DetailRow
                      label={txMessages.method}
                      value={
                        decodedTransactionInput ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{decodedMethodLabel}</span>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 mono">{decodedTransactionInput.selector}</span>
                          </span>
                        ) : (
                          decodedMethodLabel
                        )
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label={txMessages.value} value={translateRuntimeText(transaction.valueLabel, locale)} />
                    <DetailRow label={txMessages.transactionFee} value={translateRuntimeText(transaction.feeLabel, locale)} />
                    <DetailRow label={txMessages.gasFees} value={translateRuntimeText(transaction.gasFeesLabel, locale)} />
                    <DetailRow
                      label={txMessages.gasLimitAndUsageByTxn}
                      value={translateRuntimeText(`${transaction.gasLimitLabel} | ${transaction.gasUsedLabel} (${transaction.gasUsedPercent})`, locale)}
                    />
                    <DetailRow label={txMessages.nonce} value={translateRuntimeText(transaction.nonceLabel, locale)} />
                    <DetailRow label={txMessages.positionInBlock} value={translateRuntimeText(transaction.positionLabel, locale)} />
                    <DetailRow label={txMessages.txnType} value={transaction.typeLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow
                      label={txMessages.inputData}
                      value={
                        showDecodedInputTable && decodedTransactionInput ? (
                          <div className="space-y-3">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <div className="max-h-[360px] overflow-auto">
                                <table className="data-table">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">#</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.name}</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.type}</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.data}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {decodedTransactionInput.args.map((arg, index) => (
                                      <tr key={`${arg.name}-${index}`} className="border-t border-slate-200">
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{index}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.name}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.type}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <div className="min-w-0 max-w-full">
                                              {arg.type === 'address' ? (
                                                <Link href={`/evm/address/${arg.value}`} className="break-all text-[#6d4aff] hover:text-[#5935ff]">
                                                  {arg.value}
                                                </Link>
                                              ) : (
                                                <span className="break-all whitespace-pre-wrap">{arg.value}</span>
                                              )}
                                            </div>
                                            <span className="relative inline-flex shrink-0">
                                              <button
                                                ref={(node) => {
                                                  decodedInputCopyButtonRefs.current[`decoded-input-${index}`] = node;
                                                }}
                                                type="button"
                                                className="inline-flex h-5 w-5 items-center justify-center text-slate-400 transition hover:text-sky-600"
                                                aria-label={txMessages.copyInputData}
                                                onClick={() => void handleCopyDecodedInputData(arg.value, `decoded-input-${index}`)}
                                              >
                                                <IconCopy className="size-3.5" stroke={1.8} />
                                              </button>
                                              <FloatingTooltip
                                                open={copiedInputDataKey === `decoded-input-${index}`}
                                                anchorRef={{ current: decodedInputCopyButtonRefs.current[`decoded-input-${index}`] }}
                                                className="whitespace-nowrap border border-slate-200 bg-white text-slate-700"
                                              >
                                                <span className="block whitespace-nowrap">{messages.common.copied}</span>
                                              </FloatingTooltip>
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setShowDecodedInputTable(false)}>
                              <IconArrowsExchange className="mr-1.5 size-3.5" stroke={1.8} />
                              {txMessages.switchBack}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              readOnly
                              className="min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[14px] font-medium leading-6 text-slate-500 mono outline-none"
                              value={
                                inputDataView === 'default'
                                  ? defaultInputDataView
                                  : inputDataView === 'utf8'
                                    ? utf8InputData || txMessages.unableToDecodeUtf8
                                    : transaction.inputData
                              }
                            />
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="w-[170px]">
                                <Select value={inputDataView} onValueChange={(value) => setInputDataView(value as 'default' | 'utf8' | 'original')}>
                                  <SelectTrigger className="h-8 rounded-md px-3 text-xs">
                                    <SelectValue placeholder={txMessages.viewInputAs} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="default">{txMessages.defaultView}</SelectItem>
                                    <SelectItem value="utf8">{txMessages.utf8}</SelectItem>
                                    <SelectItem value="original">{txMessages.original}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button type="button" variant="secondary" size="sm" disabled={!decodedTransactionInput} onClick={() => setShowDecodedInputTable(true)}>
                                <IconCode className="mr-1.5 size-3.5" stroke={1.8} />
                                {txMessages.decodeInputData}
                              </Button>
                              <button
                                type="button"
                                className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'whitespace-nowrap' })}
                                onClick={openTxInputDecoder}
                              >
                                <IconArrowRight className="mr-1.5 size-3.5" stroke={1.8} />
                                {messages.decodeEvmTx.openInDecoder}
                              </button>
                              <Button type="button" variant="secondary" size="sm" disabled={!canRewriteTransaction} onClick={openRewriteDialog}>
                                {txMessages.rewrite}
                              </Button>
                            </div>
                          </div>
                        )
                      }
                      mono
                    />
                  </dl>
                </DetailGroup>
              </div>
            </section>
          </>
        ) : activeTab === 'logs' ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              {transaction.logsCount ? (
                <DecodedReceiptLogsSection
                  logs={decodedReceiptLogs}
                  nameTagsByAddress={nameTagsByAddress}
                  onOpenDecoder={openTxLogsDecoder}
                />
              ) : (
                <p className="text-sm text-slate-500">{txMessages.noReceiptLogs}</p>
              )}
            </section>

            {transaction.logsCount ? (
              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">{txMessages.rawJson}</h3>
                <JsonViewPanel value={transaction.logs as object} />
              </section>
            ) : null}
          </div>
        ) : activeTab === 'debugTrace' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            {traceLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : traceErrorMessage ? (
              <p className="text-sm text-slate-500">{translateRuntimeText(traceErrorMessage, locale)}</p>
            ) : traceReturnValue ? (
              <div className="space-y-2">
                <DetailRow label={txMessages.rawReturnValue} value={traceReturnValue} mono />
                <DetailRow label={txMessages.decodedReturnValue} value={decodedTraceReturnValue ?? txMessages.unableToDecode} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">{txMessages.noTraceReturnValue}</p>
            )}
          </section>
        ) : (
          <JsonViewPanel value={transaction.rawJson as object} />
        )}
      </main>
      <ModalDialog
        open={rewriteDialogOpen}
        onOpenChange={(open) => {
          setRewriteDialogOpen(open);

          if (!open) {
            setRewriteError(null);
            setRewriteActionLoading(null);
          }
        }}
        title={txMessages.rewriteTransaction}
        description={
          decodedTransactionInput
            ? txMessages.rewriteDecodedDescription
            : txMessages.rewriteTransferDescription
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRewriteDialogOpen(false);
                setRewriteError(null);
              }}
            >
              {messages.common.cancel}
            </Button>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={!activeKey || !canRewriteTransaction || !isRewriteDialogReady(rewriteDialogValues) || rewriteActionLoading === 'rewrite'}
              onClick={() => void executeRewriteAction()}
            >
              {rewriteActionLoading === 'rewrite' ? (
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
        maxWidthClassName="max-w-xl"
      >
        {canRewriteTransaction && rewriteTargetAddress ? (
          <div className="grid gap-4 pb-1">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.contract}</p>
                <p className="mt-1 break-all text-sm text-slate-900 mono">{rewriteTargetAddress}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.method}</p>
                <p className="mt-1 text-sm text-slate-900">{decodedTransactionInput ? decodedTransactionInput.functionSignature : messages.labels.sendTransaction}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.selectedKey}</p>
                <p className="mt-1 text-sm text-slate-900">{activeKey?.name ?? txMessages.noKeySelected}</p>
              </div>
              {decodedTransactionInput ? (
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{txMessages.artifact}</p>
                  <p className="mt-1 text-sm text-slate-900">{decodedTransactionInput.artifactName}</p>
                </div>
              ) : null}
            </div>

            {!activeKey ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{txMessages.selectGlobalKeyFirst}</div> : null}

            {decodedTransactionInput ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium text-slate-700">{txMessages.functionArguments}</p>
                <div className="max-h-64 overflow-y-auto pr-1">
                  <RewriteArgumentsForm
                    args={decodedTransactionInput.args.map((arg) => ({
                      name: arg.name,
                      type: arg.type,
                    }))}
                    values={rewriteArgumentValues}
                    onChange={(index, value) => {
                      const nextArgs = [...rewriteArgumentValues];
                      nextArgs[index] = value;
                      setRewriteArgumentValues(nextArgs);
                      setRewriteError(null);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {txMessages.nativeTransferNoArgs}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.txnType}</label>
                <Select
                  value={rewriteDialogValues.transactionType}
                  onValueChange={(value) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      transactionType: value as RewriteTransactionType,
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
                <label className="text-sm font-medium text-slate-700">{txMessages.valueNative.replace('{currency}', rewriteEnvironment?.nativeCurrency ?? 'Native')}</label>
                <Input
                  value={rewriteDialogValues.value}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder={messages.sendTx.zeroPlaceholder}
                />
              </div>
              {rewriteDialogValues.transactionType === 'LEGACY' ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{txMessages.gasPriceGwei}</label>
                <Input
                  value={rewriteDialogValues.gasPrice}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
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
                      value={rewriteDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setRewriteDialogValues((current) => ({
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
                      value={rewriteDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setRewriteDialogValues((current) => ({
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
                  value={rewriteDialogValues.gasLimit}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      gasLimit: event.target.value,
                    }))
                  }
                  placeholder={messages.sendTx.zeroPlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{txMessages.nonce}</label>
                <Input
                  value={rewriteDialogValues.nonce}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder={messages.sendTx.autoPlaceholder}
                />
              </div>
            </div>

            {rewriteError ? (
              <div className="max-h-32 overflow-auto rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="break-all whitespace-pre-wrap">{translateRuntimeText(rewriteError, locale)}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </ModalDialog>
      <SecretInputDialog
        open={rewriteUnlockDialogOpen}
        onOpenChange={(open) => {
          setRewriteUnlockDialogOpen(open);

          if (!open) {
            setRewriteUnlockPassword('');
            setRewriteUnlockError(null);
          }
        }}
        title={messages.privateKeys.unlockPrivateKey}
        description={activeKey ? txMessages.unlockDescription.replace('{name}', activeKey.name) : txMessages.unlockFallbackDescription}
        value={rewriteUnlockPassword}
        onValueChange={setRewriteUnlockPassword}
        placeholder={messages.sendTx.password}
        confirmLabel={messages.sendTx.unlock}
        errorMessage={rewriteUnlockError}
        confirmDisabled={!rewriteUnlockPassword.trim()}
        onConfirm={() => void handleConfirmRewriteUnlock()}
      />
    </AppShell>
  );
}
