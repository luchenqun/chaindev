'use client';

import { IconCopy } from '@tabler/icons-react';
import { type KeyboardEvent, useEffect, useState } from 'react';
import { decodeAbiParameters, decodeEventLog, isAddress, parseAbiItem, toEventSelector, type Abi, type AbiEvent, type AbiParameter, type Hex } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { JsonInput } from '@/components/ui/json-input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { parseContractAbiJson } from '@/domains/evm/client/abi-utils';
import { listEvmContractArtifacts, subscribeEvmContractRegistry, type EvmContractArtifact } from '@/domains/evm/client/contract-registry';
import { decodeBoundEvmReceiptLog } from '@/domains/evm/client/transaction-decoder';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

const TEXTAREA_CLASS_NAME =
  'min-h-32 max-h-80 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';

type EventLogRecord = {
  address?: string;
  topics: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
  transactionIndex?: string;
  blockHash?: string;
  blockTimestamp?: string;
  logIndex?: string;
  removed?: boolean;
};

type DecodedEventArgument = {
  name: string;
  type: string;
  indexed: boolean;
  value: string;
  rawHex: string | null;
};

type DecodedEventLogResult = {
  key: string;
  logIndex: number;
  raw: EventLogRecord;
  eventSignature: string | null;
  eventName: string | null;
  sourceLabel: string | null;
  args: DecodedEventArgument[];
  decodeError: string | null;
};

type EventAbiParseResult = {
  label: string;
  abi: Abi;
  abiJson: string;
};

type EventAbiSource = {
  label: string;
  sourceLabel: string;
  abi: Abi;
};

type FourByteEventRecord = {
  id: number;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
};

type FourByteEventApiResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FourByteEventRecord[];
};

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return JSON.stringify(value, (_key, currentValue) => (typeof currentValue === 'bigint' ? currentValue.toString() : currentValue), 2);
}

function normalizeHexValue(value: string | undefined, fallback = '0x') {
  if (!value) {
    return fallback as Hex;
  }

  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-f]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('INVALID_HEX');
  }

  return normalized as Hex;
}

function isAbiEventItem(item: Abi[number] | unknown): item is AbiEvent {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'event' && 'name' in item;
}

function hasTupleComponents(parameter: AbiParameter): parameter is AbiParameter & { components: readonly AbiParameter[] } {
  return 'components' in parameter && Array.isArray(parameter.components);
}

function getCanonicalAbiParameterType(parameter: AbiParameter): string {
  if (!parameter.type.endsWith(']')) {
    if (parameter.type !== 'tuple') {
      return parameter.type;
    }

    const components = hasTupleComponents(parameter) ? parameter.components : [];
    return `(${components.map(getCanonicalAbiParameterType).join(',')})`;
  }

  const arraySuffix = parameter.type.slice(parameter.type.indexOf('['));
  const baseParameter = {
    ...parameter,
    type: parameter.type.slice(0, parameter.type.indexOf('[')),
  } satisfies AbiParameter;

  return `${getCanonicalAbiParameterType(baseParameter)}${arraySuffix}`;
}

function getEventSignature(event: AbiEvent) {
  return `${event.name}(${event.inputs.map(getCanonicalAbiParameterType).join(',')})`;
}

function isSingleAbiItemLike(value: unknown) {
  return Boolean(value && typeof value === 'object' && 'type' in value && typeof (value as { type?: unknown }).type === 'string');
}

function tryParseEventSignatureToAbi(signature: string) {
  const trimmed = signature.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const abiItem = parseAbiItem(`event ${trimmed}`);
    return parseContractAbiJson(JSON.stringify([abiItem]));
  } catch {
    return null;
  }
}

function extractAbiFromUnknown(value: unknown, messages: ReturnType<typeof useMessages>['decodeEvmEvent']) {
  if (Array.isArray(value)) {
    return parseContractAbiJson(JSON.stringify(value));
  }

  if (isSingleAbiItemLike(value)) {
    return parseContractAbiJson(JSON.stringify([value]));
  }

  if (value && typeof value === 'object' && 'abi' in value) {
    const abiValue = (value as { abi?: unknown }).abi;

    if (Array.isArray(abiValue)) {
      return parseContractAbiJson(JSON.stringify(abiValue));
    }

    if (typeof abiValue === 'string') {
      return parseContractAbiJson(abiValue);
    }
  }

  throw new Error(messages.abiArrayRequired);
}

function parseManualAbiInput(rawValue: string, messages: ReturnType<typeof useMessages>['decodeEvmEvent']) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [] as EventAbiParseResult[];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const abiFromSignature = tryParseEventSignatureToAbi(trimmed);

    if (abiFromSignature) {
      return [{ label: trimmed, abi: abiFromSignature, abiJson: JSON.stringify(abiFromSignature, null, 2) }];
    }

    throw new Error(messages.abiJsonInvalid);
  }

  if (Array.isArray(parsed)) {
    const looksLikeAbiArray = parsed.every((entry) => entry && typeof entry === 'object' && 'type' in entry);

    if (looksLikeAbiArray) {
      const abi = parseContractAbiJson(JSON.stringify(parsed));
      return [{ label: messages.manualAbi, abi, abiJson: JSON.stringify(abi, null, 2) }];
    }

    return parsed.map((entry, index) => {
      const abi = extractAbiFromUnknown(entry, messages);
      const label = entry && typeof entry === 'object' && 'contractName' in entry && typeof entry.contractName === 'string'
        ? entry.contractName
        : `${messages.manualAbi} #${index + 1}`;

      return {
        label,
        abi,
        abiJson: JSON.stringify(abi, null, 2),
      };
    });
  }

  if (isSingleAbiItemLike(parsed)) {
    const abi = parseContractAbiJson(JSON.stringify([parsed]));
    return [{ label: messages.manualAbi, abi, abiJson: JSON.stringify(abi, null, 2) }];
  }

  const abi = extractAbiFromUnknown(parsed, messages);
  const label = parsed && typeof parsed === 'object' && 'contractName' in parsed && typeof parsed.contractName === 'string'
    ? parsed.contractName
    : messages.manualAbi;

  return [{ label, abi, abiJson: JSON.stringify(abi, null, 2) }];
}

function parseEventLogs(rawValue: string, messages: ReturnType<typeof useMessages>['decodeEvmEvent']) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new Error(messages.logInputRequired);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(messages.invalidLogInput);
  }

  const receiptLogs =
    parsed && typeof parsed === 'object' && 'logs' in parsed && Array.isArray((parsed as { logs?: unknown }).logs)
      ? (parsed as { logs: unknown[] }).logs
      : null;

  const logs = Array.isArray(parsed) ? parsed : receiptLogs ?? [parsed];

  if (!logs.every((item) => item && typeof item === 'object' && 'topics' in item && Array.isArray((item as { topics?: unknown }).topics))) {
    throw new Error(messages.invalidLogShape);
  }

  return logs.map((item) => {
    const record = item as Record<string, unknown>;

    return {
      address: typeof record.address === 'string' ? record.address : undefined,
      topics: (record.topics as unknown[]).map((topic) => String(topic)),
      data: typeof record.data === 'string' ? record.data : '0x',
      blockNumber: typeof record.blockNumber === 'string' ? record.blockNumber : undefined,
      transactionHash: typeof record.transactionHash === 'string' ? record.transactionHash : undefined,
      transactionIndex: typeof record.transactionIndex === 'string' ? record.transactionIndex : undefined,
      blockHash: typeof record.blockHash === 'string' ? record.blockHash : undefined,
      blockTimestamp: typeof record.blockTimestamp === 'string' ? record.blockTimestamp : undefined,
      logIndex: typeof record.logIndex === 'string' ? record.logIndex : undefined,
      removed: typeof record.removed === 'boolean' ? record.removed : undefined,
    } satisfies EventLogRecord;
  });
}

function readDecodedEventArgument(decodedArgs: unknown, input: AbiEvent['inputs'][number], index: number) {
  if (Array.isArray(decodedArgs)) {
    return decodedArgs[index];
  }

  if (decodedArgs && typeof decodedArgs === 'object') {
    if (input.name && input.name in decodedArgs) {
      return (decodedArgs as Record<string, unknown>)[input.name];
    }

    if (String(index) in decodedArgs) {
      return (decodedArgs as Record<string, unknown>)[String(index)];
    }
  }

  return undefined;
}

function resolveIndexedTopicHex(event: AbiEvent, topics: string[], inputIndex: number) {
  const indexedPosition = event.inputs.slice(0, inputIndex + 1).filter((input) => input.indexed).length;

  return topics[(event.anonymous ? 0 : 1) + indexedPosition - 1] ?? null;
}

function decodeEventArgumentsFromLog(event: AbiEvent, log: EventLogRecord) {
  const indexedValues = new Map<number, unknown>();
  const nonIndexedInputs = event.inputs.flatMap((input, index) => (input.indexed ? [] : [{ input, index }]));
  const nonIndexedDecoded = nonIndexedInputs.length
    ? decodeAbiParameters(
        nonIndexedInputs.map(({ input }) => input),
        normalizeHexValue(log.data, '0x'),
      )
    : [];

  event.inputs.forEach((input, index) => {
    if (!input.indexed) {
      return;
    }

    const topicHex = resolveIndexedTopicHex(event, log.topics, index);

    if (!topicHex) {
      return;
    }

    const [decodedValue] = decodeAbiParameters([input], normalizeHexValue(topicHex));
    indexedValues.set(index, decodedValue);
  });

  let nonIndexedCursor = 0;

  return event.inputs.map((input, index) => {
    if (input.indexed) {
      return indexedValues.get(index);
    }

    const decodedValue = nonIndexedDecoded[nonIndexedCursor];
    nonIndexedCursor += 1;
    return decodedValue;
  });
}

function splitHexWords(value: string | undefined) {
  const normalized = (value ?? '0x').replace(/^0x/i, '');

  if (!normalized) {
    return [] as string[];
  }

  const words: string[] = [];

  for (let index = 0; index < normalized.length; index += 64) {
    words.push(normalized.slice(index, index + 64));
  }

  return words;
}

function isDynamicAbiParameter(parameter: AbiParameter): boolean {
  if (parameter.type === 'string' || parameter.type === 'bytes') {
    return true;
  }

  if (parameter.type.endsWith('[]')) {
    return true;
  }

  if (parameter.type === 'tuple') {
    const components = hasTupleComponents(parameter) ? parameter.components : [];
    return components.some(isDynamicAbiParameter);
  }

  if (parameter.type.startsWith('tuple[')) {
    return true;
  }

  return false;
}

function inferIndexedEventFromLog(event: AbiEvent, log: EventLogRecord) {
  if (event.anonymous) {
    return null;
  }

  if (event.inputs.some((input) => input.indexed)) {
    return event;
  }

  const indexedCount = Math.max(log.topics.length - 1, 0);

  if (indexedCount <= 0 || indexedCount > event.inputs.length) {
    return null;
  }

  const indexedInputs = event.inputs.slice(0, indexedCount);
  if (indexedInputs.some(isDynamicAbiParameter)) {
    return null;
  }

  return {
    ...event,
    inputs: event.inputs.map((input, index) => ({
      ...input,
      indexed: index < indexedCount,
    })),
  } satisfies AbiEvent;
}

function buildLocalArtifactSources(artifacts: EvmContractArtifact[], messages: ReturnType<typeof useMessages>['decodeEvmEvent']) {
  return artifacts.map((artifact) => ({
    label: artifact.name,
    sourceLabel: `${messages.localArtifact} · ${artifact.scope === 'system' ? messages.systemArtifact : messages.importedArtifact}`,
    abi: parseContractAbiJson(artifact.abiJson),
  }));
}

async function fetchFourByteSources(topic0: string, messages: ReturnType<typeof useMessages>['decodeEvmEvent']) {
  const response = await fetch(`https://www.4byte.directory/api/v1/event-signatures/?hex_signature=${encodeURIComponent(topic0)}`);

  if (!response.ok) {
    throw new Error(`${messages.lookupFailed} (${response.status})`);
  }

  const payload = (await response.json()) as FourByteEventApiResponse;
  const uniqueSignatures = Array.from(new Map(payload.results.sort((left, right) => left.id - right.id).map((item) => [item.text_signature, item])).values());

  return uniqueSignatures.flatMap((item) => {
    try {
      const abiItem = parseAbiItem(`event ${item.text_signature}`);
      return [
        {
          label: item.text_signature,
          sourceLabel: messages.fourByte,
          abi: [abiItem] satisfies Abi,
        } satisfies EventAbiSource,
      ];
    } catch {
      return [];
    }
  });
}

function decodeLogWithSources(input: {
  log: EventLogRecord;
  logIndex: number;
  sources: EventAbiSource[];
  messages: ReturnType<typeof useMessages>['decodeEvmEvent'];
}) {
  const topic0 = input.log.topics[0]?.toLowerCase() ?? null;

  if (!topic0) {
    return {
      key: `log-${input.logIndex}`,
      logIndex: input.logIndex,
      raw: input.log,
      eventSignature: null,
      eventName: null,
      sourceLabel: null,
      args: [],
      decodeError: input.messages.noCandidates,
    } satisfies DecodedEventLogResult;
  }

  for (const source of input.sources) {
    const baseMatchedEvent = source.abi
      .filter(isAbiEventItem)
      .find((event) => !event.anonymous && toEventSelector(getEventSignature(event)).toLowerCase() === topic0);

    if (!baseMatchedEvent) {
      continue;
    }

    const matchedEvent =
      source.sourceLabel === input.messages.fourByte ? inferIndexedEventFromLog(baseMatchedEvent, input.log) ?? baseMatchedEvent : baseMatchedEvent;

    const normalizedTopics = input.log.topics.map((topic) => normalizeHexValue(topic)) as Hex[];
    const decodedTopics: [] | [Hex, ...Hex[]] = normalizedTopics.length > 0 ? [normalizedTopics[0], ...normalizedTopics.slice(1)] : [];
    const normalizedData = normalizeHexValue(input.log.data, '0x');

    try {
      const decoded = decodeEventLog({
        abi: [matchedEvent],
        data: normalizedData,
        topics: decodedTopics,
        strict: false,
      });
      const decodedArgs =
        Array.isArray(decoded.args) && decoded.args.length === matchedEvent.inputs.length ? decoded.args : decodeEventArgumentsFromLog(matchedEvent, input.log);

      return {
        key: `log-${input.logIndex}`,
        logIndex: input.logIndex,
        raw: input.log,
        eventSignature: getEventSignature(matchedEvent),
        eventName: matchedEvent.name,
        sourceLabel: source.sourceLabel,
        decodeError: null,
        args: matchedEvent.inputs.map((eventInput, index) => ({
          name: eventInput.name || `arg${index + 1}`,
          type: eventInput.type,
          indexed: Boolean(eventInput.indexed),
          value: stringifyValue(readDecodedEventArgument(decodedArgs, eventInput, index)),
          rawHex: eventInput.indexed ? resolveIndexedTopicHex(matchedEvent, input.log.topics, index) : null,
        })),
      } satisfies DecodedEventLogResult;
    } catch {
      return {
        key: `log-${input.logIndex}`,
        logIndex: input.logIndex,
        raw: input.log,
        eventSignature: getEventSignature(matchedEvent),
        eventName: matchedEvent.name,
        sourceLabel: source.sourceLabel,
        args: [],
        decodeError: input.messages.candidateDecodeFailed,
      } satisfies DecodedEventLogResult;
    }
  }

  return {
    key: `log-${input.logIndex}`,
    logIndex: input.logIndex,
    raw: input.log,
    eventSignature: null,
    eventName: null,
    sourceLabel: null,
    args: [],
    decodeError: input.messages.noCandidates,
  } satisfies DecodedEventLogResult;
}

function decodeLogWithoutManualAbi(input: {
  log: EventLogRecord;
  logIndex: number;
  sources: EventAbiSource[];
  messages: ReturnType<typeof useMessages>['decodeEvmEvent'];
}) {
  const boundDecoded = decodeBoundEvmReceiptLog({
    address: input.log.address,
    topics: input.log.topics,
    data: input.log.data,
  });

  if (boundDecoded) {
    return {
      key: `log-${input.logIndex}`,
      logIndex: input.logIndex,
      raw: input.log,
      eventSignature: boundDecoded.eventSignature,
      eventName: boundDecoded.eventName,
      sourceLabel: null,
      decodeError: null,
      args: boundDecoded.args.map((arg) => ({
        name: arg.name,
        type: arg.type,
        indexed: arg.indexed,
        value: arg.value,
        rawHex: arg.rawHex,
      })),
    } satisfies DecodedEventLogResult;
  }

  return decodeLogWithSources(input);
}

function EventAddressLink({ address }: { address: string }) {
  return <AddressLink address={address} href={`/evm/address/${address}`} label={address} className="break-all text-sky-600 hover:text-sky-700" showCopyButton />;
}

export default function DecodeEvmEventPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.decodeEvmEvent;
  const commonMessages = messages.common;
  const txMessages = messages.evmTxDetail;
  const [logInput, setLogInput] = useState('');
  const [abiInput, setAbiInput] = useState('');
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DecodedEventLogResult[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [topicViews, setTopicViews] = useState<Record<string, 'dec' | 'hex'>>({});
  const [dataViews, setDataViews] = useState<Record<string, 'dec' | 'hex'>>({});

  useEffect(() => {
    const syncArtifacts = () => {
      setArtifacts(listEvmContractArtifacts());
    };

    syncArtifacts();
    return subscribeEvmContractRegistry(syncArtifacts);
  }, []);

  async function handleDecode() {
    setLoading(true);
    setError(null);

    try {
      const parsedLogs = parseEventLogs(logInput, pageMessages);
      const manualAbis = parseManualAbiInput(abiInput, pageMessages);
      const baseSources =
        manualAbis.length > 0
          ? manualAbis.map((item) => ({
              label: item.label,
              sourceLabel: pageMessages.manualAbi,
              abi: item.abi,
            }))
          : buildLocalArtifactSources(artifacts, pageMessages);

      const decodedResults: DecodedEventLogResult[] = [];

      for (const [index, log] of parsedLogs.entries()) {
        const topic0 = log.topics[0]?.toLowerCase();
        const sources =
          manualAbis.length > 0 || !topic0
            ? baseSources
            : [...baseSources, ...(await fetchFourByteSources(topic0, pageMessages))];

        const decodeInput = {
          log,
          logIndex: index,
          sources,
          messages: pageMessages,
        };

        decodedResults.push(manualAbis.length > 0 ? decodeLogWithSources(decodeInput) : decodeLogWithoutManualAbi(decodeInput));
      }

      setResults(decodedResults);
      setTopicViews({});
      setDataViews({});
    } catch (decodeError) {
      setResults([]);
      setError(decodeError instanceof Error ? decodeError.message : pageMessages.decodeFailed);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || loading) {
      return;
    }

    void handleDecode();
  }

  async function handleCopy(field: string, value: string) {
    await copyText(value);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1200);
  }

  return (
    <AppShell>
      <main className="section-block">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-2xl font-semibold text-slate-950">{pageMessages.title}</h1>
            <p className="mt-2 max-w-[1100px] text-sm leading-6 text-slate-600">{pageMessages.description}</p>
          </div>

          <div className="space-y-6 px-6 py-6">
            <section className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{pageMessages.logInput}</label>
                <JsonInput value={logInput} onChange={setLogInput} placeholder={pageMessages.logInputPlaceholder} textareaClassName={TEXTAREA_CLASS_NAME} />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{pageMessages.abiInput}</label>
                <JsonInput value={abiInput} onChange={setAbiInput} placeholder={pageMessages.abiInputPlaceholder} textareaClassName={TEXTAREA_CLASS_NAME} />
              </div>

              <div className="flex justify-end">
                <Button type="button" className="min-w-28" disabled={loading} onClick={() => void handleDecode()}>
                  {loading ? pageMessages.decoding : pageMessages.decode}
                </Button>
              </div>
            </section>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{translateRuntimeText(error, locale)}</div> : null}

            {results.length ? (
              <section className="space-y-5 border-t border-slate-200 pt-5">
                {results.map((result, index) => {
                  const title = result.eventSignature
                    ? pageMessages.logTitle.replace('{index}', String(index + 1))
                    : pageMessages.unableToDecodeLog.replace('{index}', String(index + 1));
                  const indexedArgs = result.args.filter((arg) => arg.indexed);
                  const nonIndexedArgs = result.args.filter((arg) => !arg.indexed);
                  const dataView = dataViews[result.key] ?? 'dec';

                  return (
                    <div key={result.key} className="rounded-2xl border border-slate-200">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
                      </div>

                      <div className="p-4">
                        {result.eventSignature ? (
                          <dl className="space-y-3">
                            <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                              <dt className="text-xs font-semibold text-slate-600">{pageMessages.address}</dt>
                              <dd className="min-w-0 text-xs text-slate-900">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {result.raw.address && isAddress(result.raw.address) ? (
                                    <EventAddressLink address={result.raw.address} />
                                  ) : (
                                    <span className="mono">{result.raw.address ?? '-'}</span>
                                  )}
                                </div>
                              </dd>
                            </div>

                            <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                              <dt className="text-xs font-semibold text-slate-600">{messages.labels.name}</dt>
                              <dd className="min-w-0 text-xs text-slate-900">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="font-semibold text-slate-800">{result.eventName}</span>
                                  <span className="text-slate-500">({result.eventSignature.slice((result.eventName?.length ?? 0) + 1, -1)})</span>
                                </div>
                              </dd>
                            </div>

                            <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                              <dt className="text-xs font-semibold text-slate-600">{pageMessages.topics}</dt>
                              <dd className="min-w-0 space-y-2 text-xs text-slate-900">
                                {result.raw.topics[0] ? (
                                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 mono text-xs text-slate-700">
                                    <span className="mr-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">0</span>
                                    {result.raw.topics[0]}
                                  </div>
                                ) : null}

                                {indexedArgs.map((arg, argIndex) => (
                                  <div key={`${result.key}-topic-${argIndex}`} className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex h-[30px] items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                                      {argIndex + 1}: {arg.name}
                                    </span>
                                    <div className="relative min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-[132px] text-xs text-slate-700">
                                      <div className="absolute bottom-0 right-0 top-0 inline-flex overflow-hidden rounded-r-lg border-l border-slate-200 bg-slate-100">
                                        <button
                                          type="button"
                                          className={
                                            (topicViews[`${result.key}-topic-${argIndex}`] ?? 'dec') === 'dec'
                                              ? 'h-full px-3 text-xs font-semibold text-slate-900'
                                              : 'h-full bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                                          }
                                          onClick={() =>
                                            setTopicViews((current) => ({
                                              ...current,
                                              [`${result.key}-topic-${argIndex}`]: 'dec',
                                            }))
                                          }
                                        >
                                          {txMessages.dec}
                                        </button>
                                        <button
                                          type="button"
                                          className={
                                            (topicViews[`${result.key}-topic-${argIndex}`] ?? 'dec') === 'hex'
                                              ? 'h-full border-l border-slate-200 px-3 text-xs font-semibold text-slate-900'
                                              : 'h-full border-l border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition hover:text-slate-700'
                                          }
                                          onClick={() =>
                                            setTopicViews((current) => ({
                                              ...current,
                                              [`${result.key}-topic-${argIndex}`]: 'hex',
                                            }))
                                          }
                                        >
                                          {txMessages.hex}
                                        </button>
                                      </div>
                                      {(topicViews[`${result.key}-topic-${argIndex}`] ?? 'dec') === 'dec' && arg.type === 'address' && isAddress(arg.value) ? (
                                        <EventAddressLink address={arg.value} />
                                      ) : (
                                        <span className="break-all mono">
                                          {(topicViews[`${result.key}-topic-${argIndex}`] ?? 'dec') === 'hex' ? (arg.rawHex ?? commonMessages.unavailable) : arg.value}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </dd>
                            </div>

                            <div className="grid gap-1 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
                              <dt className="text-xs font-semibold text-slate-600">{pageMessages.data}</dt>
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
                                          [result.key]: 'dec',
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
                                          [result.key]: 'hex',
                                        }))
                                      }
                                    >
                                      {txMessages.hex}
                                    </button>
                                  </div>
                                  {dataView === 'hex' ? (
                                    <p className="flex min-h-[30px] items-center break-all py-1.5 pr-2 mono text-xs text-slate-700">{result.raw.data || '0x'}</p>
                                  ) : nonIndexedArgs.length > 0 ? (
                                    <div className="space-y-1 py-2 pr-2">
                                      {nonIndexedArgs.map((arg, argIndex) => (
                                        <div key={`${result.key}-data-${argIndex}`} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                                          <span className="font-medium text-slate-500">
                                            {arg.name} ({arg.type}) :
                                          </span>
                                          {arg.type === 'address' && isAddress(arg.value) ? (
                                            <EventAddressLink address={arg.value} />
                                          ) : (
                                            <span className="break-all mono">{arg.value}</span>
                                          )}
                                          <ActionIconButton
                                            tooltip={copiedField === `arg-${result.key}-${argIndex}` ? commonMessages.copied : pageMessages.copyValue}
                                            aria-label={copiedField === `arg-${result.key}-${argIndex}` ? commonMessages.copied : pageMessages.copyValue}
                                            className="text-slate-400 hover:text-sky-600"
                                            onClick={() => void handleCopy(`arg-${result.key}-${argIndex}`, arg.value)}
                                          >
                                            <IconCopy className="size-3.5" stroke={1.8} />
                                          </ActionIconButton>
                                        </div>
                                      ))}
                                    </div>
                                  ) : nonIndexedArgs.length === 1 ? (
                                    <div className="flex min-h-[30px] items-center py-1.5 pr-2 text-xs text-slate-700">
                                      {nonIndexedArgs[0].type === 'address' && isAddress(nonIndexedArgs[0].value) ? (
                                        <>
                                          <span className="mr-1.5 font-medium text-slate-500">
                                            {nonIndexedArgs[0].name} ({nonIndexedArgs[0].type}) :
                                          </span>
                                          <EventAddressLink address={nonIndexedArgs[0].value} />
                                        </>
                                      ) : (
                                        <span className="break-all mono">
                                          {nonIndexedArgs[0].name} ({nonIndexedArgs[0].type}) : {nonIndexedArgs[0].value}
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
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              {pageMessages.unableToDecodeLog.replace('{index}', String(index + 1))}
                              {result.decodeError ? `，${result.decodeError}` : ''}
                            </div>
                            <div className="text-sm font-semibold text-slate-950">{pageMessages.rawLog}</div>
                            <JsonViewPanel className="bg-slate-50 shadow-none" value={result.raw as object} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            ) : (
              <section className="border-t border-dashed border-slate-300 px-4 py-8 text-center">
                <div className="mx-auto max-w-2xl">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{pageMessages.ready}</div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">{pageMessages.emptyTitle}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{pageMessages.emptyDescription}</p>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
