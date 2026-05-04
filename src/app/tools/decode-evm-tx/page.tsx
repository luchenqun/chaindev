'use client';

import { IconArrowsExchange, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { decodeFunctionData, isAddress, parseAbiItem, toFunctionSelector, type Abi, type AbiFunction, type AbiParameter, type Hex } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { JsonInput } from '@/components/ui/json-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseContractAbiJson } from '@/domains/evm/client/abi-utils';
import { listEvmContractArtifacts, subscribeEvmContractRegistry, type EvmContractArtifact } from '@/domains/evm/client/contract-registry';
import { decodeHexToUtf8 } from '@/domains/evm/client/transaction-decoder';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

const TEXTAREA_CLASS_NAME =
  'min-h-32 max-h-80 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';
const INPUT_DATA_TEXTAREA_CLASS_NAME =
  'min-h-10 max-h-64 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';

type FourByteSignatureRecord = {
  id: number;
  text_signature: string;
  hex_signature: string;
  bytes_signature: string;
};

type FourByteApiResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FourByteSignatureRecord[];
};

type DecodedArgument = {
  name: string;
  type: string;
  value: string;
};

type DecodedCandidate = {
  id: string;
  label: string;
  sourceLabel: string;
  functionSignature: string;
  selector: string;
  methodName: string;
  args: DecodedArgument[];
  decodeError: string | null;
  hasInputs: boolean;
};

type AbiParseResult = {
  label: string;
  abi: Abi;
  abiJson: string;
};

function splitInputDataWords(inputData: string) {
  const normalized = inputData.startsWith('0x') ? inputData.slice(2) : inputData;
  const argsHex = normalized.slice(8);

  if (!argsHex) {
    return [];
  }

  const words: string[] = [];

  for (let index = 0; index < argsHex.length; index += 64) {
    words.push(argsHex.slice(index, index + 64));
  }

  return words;
}

function buildDefaultInputDataView(
  inputData: string,
  labels: { functionLabel: string; methodId: string },
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

function normalizeHexData(value: string, errorMessage: string) {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    throw new Error(errorMessage);
  }

  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-f]*$/.test(normalized) || normalized.length < 10 || normalized.length % 2 !== 0) {
    throw new Error(errorMessage);
  }

  return normalized as Hex;
}

function isAbiFunctionItem(item: Abi[number] | unknown): item is AbiFunction {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'function' && 'name' in item;
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

function getFunctionSignature(fn: AbiFunction) {
  return `${fn.name}(${fn.inputs.map(getCanonicalAbiParameterType).join(',')})`;
}

function isSingleAbiItemLike(value: unknown) {
  return Boolean(value && typeof value === 'object' && 'type' in value && typeof (value as { type?: unknown }).type === 'string');
}

function tryParseFunctionSignatureToAbi(signature: string) {
  const trimmed = signature.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const abiItem = parseAbiItem(`function ${trimmed}`);
    return parseContractAbiJson(JSON.stringify([abiItem]));
  } catch {
    return null;
  }
}

function extractAbiFromUnknown(value: unknown, messages: ReturnType<typeof useMessages>['decodeEvmTx']) {
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

function parseManualAbiInput(rawValue: string, messages: ReturnType<typeof useMessages>['decodeEvmTx']) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [] as AbiParseResult[];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const abiFromSignature = tryParseFunctionSignatureToAbi(trimmed);

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

function buildDecodedCandidate(input: {
  id: string;
  label: string;
  sourceLabel: string;
  abi: Abi;
  abiJson: string;
  data: Hex;
  decodeFailedMessage: string;
}) {
  const selector = input.data.slice(0, 10).toLowerCase();
  const functions = input.abi.filter(isAbiFunctionItem);
  const matchedFunction = functions.find((fn) => toFunctionSelector(`function ${getFunctionSignature(fn)}`).toLowerCase() === selector);

  if (!matchedFunction) {
    return null;
  }

  const functionSignature = getFunctionSignature(matchedFunction);
  const hasInputs = matchedFunction.inputs.length > 0;

  try {
    const decoded = decodeFunctionData({
      abi: input.abi,
      data: input.data,
    });
    const decodedArgs = Array.isArray(decoded.args) ? decoded.args : [];

    return {
      id: input.id,
      label: input.label,
      sourceLabel: input.sourceLabel,
      functionSignature,
      selector,
      methodName: matchedFunction.name,
      decodeError: null,
      hasInputs,
      args: matchedFunction.inputs.map((parameter, index) => ({
        name: parameter.name || `arg${index + 1}`,
        type: parameter.type,
        value: stringifyValue(decodedArgs[index]),
      })),
    } satisfies DecodedCandidate;
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      sourceLabel: input.sourceLabel,
      functionSignature,
      selector,
      methodName: matchedFunction.name,
      decodeError: error instanceof Error ? error.message : input.decodeFailedMessage,
      hasInputs,
      args: [],
    } satisfies DecodedCandidate;
  }
}

async function fetchFourByteCandidates(selector: string, messages: ReturnType<typeof useMessages>['decodeEvmTx']) {
  const response = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(selector)}`);

  if (!response.ok) {
    throw new Error(`${messages.lookupFailed} (${response.status})`);
  }

  const payload = (await response.json()) as FourByteApiResponse;
  const uniqueSignatures = Array.from(new Map(payload.results.sort((left, right) => left.id - right.id).map((item) => [item.text_signature, item])).values());

  return uniqueSignatures.flatMap((item, index) => {
    try {
      const abiItem = parseAbiItem(`function ${item.text_signature}`);
      const abi = [abiItem] satisfies Abi;

      return [
        {
          id: `4byte:${item.id}:${index}`,
          label: item.text_signature,
          sourceLabel: messages.fourByte,
          abi,
          abiJson: JSON.stringify(abi, null, 2),
        } satisfies AbiParseResult & { id: string; sourceLabel: string },
      ];
    } catch {
      return [];
    }
  });
}

function buildLocalArtifactCandidates(artifacts: EvmContractArtifact[]) {
  return artifacts.map((artifact, index) => ({
    id: `artifact:${artifact.id}:${index}`,
    label: artifact.name,
    sourceLabel: artifact.scope,
    abi: parseContractAbiJson(artifact.abiJson),
    abiJson: artifact.abiJson,
  }));
}

function dedupeCandidatesBySignature(candidates: DecodedCandidate[]) {
  const uniqueCandidates: DecodedCandidate[] = [];
  const seenSignatures = new Set<string>();

  for (const candidate of candidates) {
    if (seenSignatures.has(candidate.functionSignature)) {
      continue;
    }

    seenSignatures.add(candidate.functionSignature);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

export default function DecodeEvmTxPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.decodeEvmTx;
  const commonMessages = messages.common;
  const [inputData, setInputData] = useState('');
  const [abiInput, setAbiInput] = useState('');
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DecodedCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [searchedData, setSearchedData] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDecodedInputTable, setShowDecodedInputTable] = useState(true);
  const [inputDataView, setInputDataView] = useState<'default' | 'utf8' | 'original'>('default');

  useEffect(() => {
    const syncArtifacts = () => {
      setArtifacts(listEvmContractArtifacts());
    };

    syncArtifacts();
    return subscribeEvmContractRegistry(syncArtifacts);
  }, []);

  useEffect(() => {
    if (!candidates.length) {
      setSelectedCandidateId('');
      return;
    }

    const firstDecodableCandidate = candidates.find((candidate) => !candidate.decodeError) ?? candidates[0];

    setSelectedCandidateId((current) => {
      const currentCandidate = candidates.find((candidate) => candidate.id === current);

      if (currentCandidate && !currentCandidate.decodeError) {
        return current;
      }

      return firstDecodableCandidate.id;
    });
  }, [candidates]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0] ?? null,
    [candidates, selectedCandidateId],
  );
  const txMessages = messages.evmTxDetail;
  const utf8InputData = useMemo(() => (searchedData ? decodeHexToUtf8(searchedData) : null), [searchedData]);
  const defaultInputDataView = useMemo(
    () =>
      searchedData
        ? buildDefaultInputDataView(
            searchedData,
            {
              functionLabel: txMessages.functionLabel,
              methodId: txMessages.methodId,
            },
            selectedCandidate?.functionSignature,
            selectedCandidate?.selector,
          )
        : '',
    [searchedData, selectedCandidate, txMessages.functionLabel, txMessages.methodId],
  );

  async function handleDecode() {
    setLoading(true);
    setError(null);

    try {
      const normalizedData = normalizeHexData(inputData, pageMessages.invalidInputData);
      const selector = normalizedData.slice(0, 10).toLowerCase();
      const manualAbis = parseManualAbiInput(abiInput, pageMessages);
      const abiSources =
        manualAbis.length > 0
          ? manualAbis.map((item, index) => ({
              id: `manual:${index}`,
              label: item.label,
              sourceLabel: pageMessages.manualAbi,
              abi: item.abi,
              abiJson: item.abiJson,
            }))
          : buildLocalArtifactCandidates(artifacts);

      const localDecoded = abiSources.flatMap((source) => {
        try {
          const decoded = buildDecodedCandidate({
            id: source.id,
            label: source.label,
            sourceLabel:
              manualAbis.length > 0
                ? pageMessages.manualAbi
                : `${pageMessages.localArtifact} · ${source.sourceLabel === 'system' ? pageMessages.systemArtifact : pageMessages.importedArtifact}`,
            abi: source.abi,
            abiJson: source.abiJson,
            data: normalizedData,
            decodeFailedMessage: pageMessages.decodeFailed,
          });

          return decoded ? [decoded] : [];
        } catch {
          return [];
        }
      });

      let nextCandidates = dedupeCandidatesBySignature(localDecoded);

      if (!manualAbis.length) {
        const fourByteCandidates = await fetchFourByteCandidates(selector, pageMessages);
        const fourByteDecoded = fourByteCandidates.flatMap((source) => {
          try {
            const decoded = buildDecodedCandidate({
              id: source.id,
              label: source.label,
              sourceLabel: pageMessages.fourByte,
              abi: source.abi,
              abiJson: source.abiJson,
              data: normalizedData,
              decodeFailedMessage: pageMessages.decodeFailed,
            });

            return decoded ? [decoded] : [];
          } catch {
            return [];
          }
        });

        nextCandidates = dedupeCandidatesBySignature([...nextCandidates, ...fourByteDecoded]);
      }

      if (!nextCandidates.length) {
        setCandidates([]);
        setSearchedData(normalizedData);
        throw new Error(manualAbis.length > 0 ? pageMessages.noFunctionMatch : pageMessages.noCandidates);
      }

      setCandidates(nextCandidates);
      setSearchedData(normalizedData);
      setShowDecodedInputTable(true);
      setInputDataView('default');
    } catch (decodeError) {
      setCandidates([]);
      setSearchedData('');
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
                <label className="text-sm font-medium text-slate-700">{pageMessages.inputData}</label>
                <AutoGrowTextarea
                  value={inputData}
                  className={INPUT_DATA_TEXTAREA_CLASS_NAME}
                  placeholder={pageMessages.inputDataPlaceholder}
                  onChange={(event) => setInputData(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-slate-700">{pageMessages.abiInput}</label>
                  <span className="text-xs text-slate-500">{pageMessages.abiInputHint}</span>
                </div>
                <JsonInput value={abiInput} onChange={setAbiInput} placeholder={pageMessages.abiInputPlaceholder} textareaClassName={TEXTAREA_CLASS_NAME} />
              </div>

              <div className="flex justify-end">
                <Button type="button" className="min-w-28" disabled={loading} onClick={() => void handleDecode()}>
                  {loading ? pageMessages.decoding : pageMessages.decode}
                </Button>
              </div>
            </section>

            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{translateRuntimeText(error, locale)}</div> : null}

            {selectedCandidate ? (
              <section className="space-y-5 border-t border-slate-200 pt-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{pageMessages.candidates}</div>
                      <p className="text-sm text-slate-600">{pageMessages.candidateCount.replace('{count}', String(candidates.length))}</p>
                    </div>
                    <Select value={selectedCandidate.id} onValueChange={setSelectedCandidateId}>
                      <SelectTrigger>
                        <SelectValue placeholder={pageMessages.selectedCandidate} />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id} disabled={Boolean(candidate.decodeError)}>
                            <span className={candidate.decodeError ? 'text-slate-400' : undefined}>
                              {candidate.functionSignature}
                              {candidate.decodeError ? ` · ${pageMessages.undecodableCandidate}` : ''}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-950">{pageMessages.arguments}</h2>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDecodedInputTable((current) => !current)}
                    >
                      <IconArrowsExchange className="mr-1.5 size-3.5" stroke={1.8} />
                      {showDecodedInputTable ? pageMessages.switchBack : pageMessages.switchToDecoded}
                    </Button>
                  </div>

                  {showDecodedInputTable ? (
                    selectedCandidate.args.length ? (
                      <div className="overflow-hidden rounded-b-2xl bg-white">
                        <div className="overflow-auto">
                          <table className="data-table">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">#</th>
                                <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.labels.name}</th>
                                <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.type}</th>
                                <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">{pageMessages.value}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCandidate.args.map((arg, index) => (
                                <tr key={`${arg.name}-${index}`} className="border-t border-slate-200">
                                  <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{index}</td>
                                  <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.name}</td>
                                  <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.type}</td>
                                  <td className="px-4 py-3 align-top text-sm text-slate-900 mono">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="min-w-0 max-w-full">
                                        {arg.type === 'address' && isAddress(arg.value) ? (
                                          <Link href={`/evm/address/${arg.value}`} className="break-all text-[#6d4aff] hover:text-[#5935ff]">
                                            {arg.value}
                                          </Link>
                                        ) : (
                                          <span className="break-all whitespace-pre-wrap">{arg.value}</span>
                                        )}
                                      </div>
                                      <span className="inline-flex shrink-0">
                                        <ActionIconButton
                                          tooltip={copiedField === `arg-${index}` ? commonMessages.copied : pageMessages.copyValue}
                                          aria-label={copiedField === `arg-${index}` ? commonMessages.copied : pageMessages.copyValue}
                                          className="text-slate-400 hover:text-sky-600"
                                          onClick={() => void handleCopy(`arg-${index}`, arg.value)}
                                        >
                                          <IconCopy className="size-3.5" stroke={1.8} />
                                        </ActionIconButton>
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        {selectedCandidate.decodeError ? pageMessages.candidateDecodeFailed : pageMessages.noArguments}
                      </div>
                    )
                  ) : (
                    <div className="space-y-3 p-4">
                      <textarea
                        readOnly
                        className="min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[14px] font-medium leading-6 text-slate-500 mono outline-none"
                        value={
                          inputDataView === 'default'
                            ? defaultInputDataView
                            : inputDataView === 'utf8'
                              ? utf8InputData || txMessages.unableToDecodeUtf8
                              : searchedData || inputData
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
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ) : searchedData ? (
              <section className="border-t border-slate-200 pt-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {pageMessages.noCandidates}
                </div>
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
