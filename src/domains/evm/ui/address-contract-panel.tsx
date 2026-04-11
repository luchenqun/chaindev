"use client";

import JsonView from "@uiw/react-json-view";
import {
  IconBrandTelegram,
  IconChevronDown,
  IconCopy,
  IconLoader2,
  IconPlayerPlay,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { toFunctionSelector } from "viem";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Button } from "@/components/ui/button";
import { FlashMessage } from "@/components/ui/flash-message";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { SecretInputDialog } from "@/components/ui/secret-input-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReadContractFunctions,
  getWriteContractFunctions,
  type EvmContractFunctionDescriptor,
} from "@/domains/evm/client/abi-utils";
import {
  forceWriteEvmContractMethodDirect,
  getEvmContractWriteManualDefaultsDirect,
  prepareEvmContractWriteDirect,
  readEvmContractMethodDirect,
  writeEvmContractMethodDirect,
} from "@/domains/evm/client/contract-executor";
import {
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from "@/domains/evm/client/keyring";
import {
  type EvmContractArtifact,
  type EvmContractBinding,
} from "@/domains/evm/client/contract-registry";

const textareaClassName =
  "min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400";

type EnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
};

type ContractSubview = "code" | "read" | "write";

type WritePreviewState = {
  accountAddress: string;
  functionSignature: string;
  estimatedGas: string;
  gasPriceLabel: string;
  valueLabel: string;
};

type ManualWriteTransactionType = "LEGACY" | "EIP1559";

type ManualWriteDialogState = {
  transactionType: ManualWriteTransactionType;
  value: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  nonce: string;
};

function stringifyResult(value: unknown) {
  return JSON.stringify(
    value,
    (_, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
    2,
  );
}

function FunctionArgumentsForm({
  fn,
  values,
  onChange,
}: {
  fn: EvmContractFunctionDescriptor;
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  if (!fn.inputs.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {fn.inputs.map((input, index) => {
        const isComplex = input.type.includes("[") || input.type === "tuple";
        const label = input.name || `arg${index + 1}`;

        return (
          <div key={`${fn.signature}-${label}-${index}`} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {label} <span className="text-slate-400">({input.type})</span>
            </label>
            {isComplex ? (
              <textarea
                className={textareaClassName}
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={input.type === "tuple" ? '{"value":"..."}' : '["value"]'}
              />
            ) : (
              <Input
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={input.type === "bool" ? "true or false" : input.type}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getInitialValues(functions: EvmContractFunctionDescriptor[]) {
  return Object.fromEntries(functions.map((fn) => [fn.signature, fn.inputs.map(() => "")]));
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
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
  const parsedValue = parseDisplayValue(value);

  if (
    typeof parsedValue === "string" ||
    typeof parsedValue === "number" ||
    typeof parsedValue === "boolean" ||
    parsedValue === null
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900">
        <span className="break-all">{String(parsedValue)}</span>
      </div>
    );
  }

  return (
    <pre className="max-h-[260px] overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-800">
      {value}
    </pre>
  );
}

function formatMiddleEllipsis(value: string, leading = 10, trailing = 8) {
  if (value.length <= leading + trailing + 3) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

function getReceiptStatusClasses(status: string) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "reverted") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
}

function toWritePreviewState(input: {
  accountAddress: string;
  functionSignature: string;
  estimatedGas: string;
  gasPriceLabel: string;
  valueLabel: string;
}): WritePreviewState {
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
    transactionType: "EIP1559",
    value: "0",
    gasPrice: "",
    maxFeePerGas: "",
    maxPriorityFeePerGas: "",
    gasLimit: "",
    nonce: "",
  };
}

function isManualWriteDialogReady(state: ManualWriteDialogState) {
  if (!state.value.trim() || !state.gasLimit.trim() || !state.nonce.trim()) {
    return false;
  }

  if (state.transactionType === "LEGACY") {
    return !!state.gasPrice.trim();
  }

  return !!state.maxFeePerGas.trim() && !!state.maxPriorityFeePerGas.trim();
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
  if (!preview && !result && !error) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
        Write the transaction to view the result.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {preview ? (
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Simulated Transaction
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">From</dt>
              <dd className="mt-1 break-all text-sm text-slate-900 mono">{preview.accountAddress}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Method</dt>
              <dd className="mt-1 text-sm text-slate-900">{preview.functionSignature}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estimated Gas</dt>
              <dd className="mt-1 text-sm text-slate-900">{preview.estimatedGas || "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Gas Price</dt>
              <dd className="mt-1 text-sm text-slate-900">{preview.gasPriceLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Value</dt>
              <dd className="mt-1 text-sm text-slate-900">{preview.valueLabel}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {preview && (result || error) ? <div className="border-t border-slate-200" /> : null}
      {result ? (
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Submitted Transaction
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Transaction Hash</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                <Link href={`/evm/tx/${result.hash}`} className="mono text-sky-600 hover:text-sky-700">
                  {formatMiddleEllipsis(result.hash)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getReceiptStatusClasses(result.receipt.status)}`}
                >
                  {result.receipt.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Block Number</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">
                <Link href={`/evm/block/${result.receipt.blockNumber}`} className="text-sky-600 hover:text-sky-700">
                  {result.receipt.blockNumber}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Gas Used</dt>
              <dd className="mt-1 text-sm text-slate-900">{result.receipt.gasUsed}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Effective Gas Price</dt>
              <dd className="mt-1 text-sm text-slate-900">{result.receipt.effectiveGasPrice}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {error ? (
        <div className="px-4 py-4 text-sm text-rose-700">{error}</div>
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
  if (!functions.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        {emptyText}
      </div>
    );
  }

  const allExpanded = functions.length > 0 && expandedSignatures.length === functions.length;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={allExpanded ? onCollapseAll : onExpandAll}>
            {allExpanded ? (
              <IconChevronDown className="mr-1.5 size-3.5 rotate-180" stroke={1.8} />
            ) : (
              <IconSparkles className="mr-1.5 size-3.5" stroke={1.8} />
            )}
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onReset}>
            <IconRefresh className="mr-1.5 size-3.5" stroke={1.8} />
            Reset
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
              <div
                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3"
                onClick={() => onToggle(fn.signature)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {fn.name} <span className="font-medium text-slate-400">({selector})</span>
                    </p>
                    {inputBadgeLabel && fn.inputs.length ? (
                      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {inputBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="flex items-center gap-0"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip="Copy signature"
                    aria-label="Copy signature"
                    onClick={() => onCopySignature(fn)}
                  >
                    <IconCopy className="size-4" stroke={1.8} />
                  </ActionIconButton>
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip={isExpanded ? "Collapse" : "Expand"}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={() => onToggle(fn.signature)}
                  >
                    <IconChevronDown
                      className={`size-4 transition ${isExpanded ? "rotate-180" : ""}`}
                      stroke={1.8}
                    />
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
  initialTab = "read",
}: {
  binding: EvmContractBinding;
  artifact: EvmContractArtifact;
  environment: EnvironmentState;
  initialTab?: ContractSubview;
}) {
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
  const [writeResults, setWriteResults] = useState<
    Record<string, Awaited<ReturnType<typeof writeEvmContractMethodDirect>>>
  >({});
  const [writeErrors, setWriteErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [pendingWriteAction, setPendingWriteAction] = useState<{
    signature: string;
    type: "write" | "manual-open" | "manual-confirm";
  } | null>(null);
  const [manualWriteTarget, setManualWriteTarget] = useState<string | null>(null);
  const [manualWriteDialogValues, setManualWriteDialogValues] = useState<ManualWriteDialogState>(
    createInitialManualWriteDialogState(),
  );
  const [manualWriteDialogError, setManualWriteDialogError] = useState<string | null>(null);

  const readFunctions = useMemo(
    () => getReadContractFunctions(artifact.abiJson),
    [artifact.abiJson],
  );
  const abiJsonValue = useMemo(() => JSON.parse(artifact.abiJson) as object, [artifact.abiJson]);
  const writeFunctions = useMemo(
    () => getWriteContractFunctions(artifact.abiJson),
    [artifact.abiJson],
  );

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
    setReadArgumentValues(getInitialValues(readFunctions));
    setReadResults({});
    setReadErrors({});
  }, [readFunctions]);

  useEffect(() => {
    setExpandedWriteSignatures([]);
    setWriteArgumentValues(getInitialValues(writeFunctions));
    setWritePreviews({});
    setWriteResults({});
    setWriteErrors({});
    setWriteValueBySignature({});
    setManualWriteTarget(null);
    setManualWriteDialogError(null);
    setManualWriteDialogValues(createInitialManualWriteDialogState());
  }, [writeFunctions]);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [flashMessage]);

  function updateReadArgumentValue(signature: string, index: number, value: string) {
    setReadArgumentValues((current) => ({
      ...current,
      [signature]: current[signature]?.map((item, itemIndex) => (itemIndex === index ? value : item)) ?? [],
    }));
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
    setWriteArgumentValues((current) => ({
      ...current,
      [signature]: current[signature]?.map((item, itemIndex) => (itemIndex === index ? value : item)) ?? [],
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
        rawArgs: readArgumentValues[signature] ?? fn.inputs.map(() => ""),
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
        [signature]: error instanceof Error ? error.message : "Failed to read contract method.",
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
      setErrorMessage("Select a global private key first.");
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
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map(() => "");
      const value = writeValueBySignature[signature] ?? "";
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit contract transaction.";

      if (message === "Password is required.") {
        setPendingWriteAction({ signature, type: "write" });
        setUnlockPassword("");
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: message,
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
      setErrorMessage("Select a global private key first.");
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
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map(() => "");
      const value = fn.stateMutability === "payable" ? (writeValueBySignature[signature] ?? "0") : "0";
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
        maxFeePerGas: defaults.maxFeePerGas,
        maxPriorityFeePerGas: defaults.maxPriorityFeePerGas,
        gasLimit: defaults.estimatedGas,
        nonce: defaults.nonce,
      });
      setManualWriteDialogError(defaults.simulationError);
      setManualWriteTarget(signature);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare manual contract transaction.";

      if (message === "Password is required.") {
        setPendingWriteAction({ signature, type: "manual-open" });
        setUnlockPassword("");
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: message,
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
      setErrorMessage("Select a global private key first.");
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
      const rawArgs = writeArgumentValues[signature] ?? fn.inputs.map(() => "");
      const result = await forceWriteEvmContractMethodDirect({
        address: binding.address,
        abiJson: artifact.abiJson,
        functionSignature: signature,
        rawArgs,
        privateKey,
        transactionType: manualWriteDialogValues.transactionType,
        value: manualWriteDialogValues.value,
        gasLimit: manualWriteDialogValues.gasLimit,
        gasPrice: manualWriteDialogValues.gasPrice,
        maxFeePerGas: manualWriteDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: manualWriteDialogValues.maxPriorityFeePerGas,
        nonce: manualWriteDialogValues.nonce,
      });

      setWriteResults((current) => ({
        ...current,
        [signature]: result,
      }));
      setWriteValueBySignature((current) => ({
        ...current,
        [signature]: manualWriteDialogValues.value,
      }));
      setWriteErrors((current) => {
        const next = { ...current };
        delete next[signature];
        return next;
      });
      setManualWriteTarget(null);
      setManualWriteDialogError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to force-send contract transaction.";

      if (message === "Password is required.") {
        setPendingWriteAction({ signature, type: "manual-confirm" });
        setUnlockPassword("");
        setUnlockError(null);
        setUnlockDialogOpen(true);
        return;
      }

      setWriteErrors((current) => ({
        ...current,
        [signature]: message,
      }));
      setManualWriteDialogError(message);
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
      if (pendingWriteAction.type === "manual-open") {
        await openManualWriteDialog(pendingWriteAction.signature, unlockPassword);
      } else if (pendingWriteAction.type === "manual-confirm") {
        await executeManualWriteAction(pendingWriteAction.signature, unlockPassword);
      } else {
        await executeWriteAction(pendingWriteAction.signature, unlockPassword);
      }
      setUnlockDialogOpen(false);
      setUnlockPassword("");
      setPendingWriteAction(null);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock private key.");
    }
  }

  const activeKeyStateLabel = !activeKey
    ? "No Key Selected"
    : activeKey.securityMode === "plain"
      ? activeKey.name
      : isEvmStoredPrivateKeyUnlocked(activeKey.id)
        ? `${activeKey.name} (Unlocked)`
        : `${activeKey.name} (Locked)`;

  function toggleExpandedSignature(
    signature: string,
    setExpanded: Dispatch<SetStateAction<string[]>>,
  ) {
    setExpanded((current) =>
      current.includes(signature) ? current.filter((item) => item !== signature) : [...current, signature],
    );
  }

  function resetReadView() {
    setExpandedReadSignatures([]);
    setReadArgumentValues(getInitialValues(readFunctions));
    setReadResults({});
    setReadErrors({});
  }

  function resetWriteView() {
    setExpandedWriteSignatures([]);
    setWriteArgumentValues(getInitialValues(writeFunctions));
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
    setFlashMessage({
      title: "Signature copied",
      description: `${fn.signature} was copied successfully.`,
    });
  }

  function handleToggleReadSignature(signature: string) {
    const fn = readFunctions.find((item) => item.signature === signature);

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
      setExpandedReadSignatures((current) => [...current, fn.signature]);
    }

    if (fn.inputs.length === 0 || isExpanded) {
      void handleRead(fn.signature);
    }
  }

  return (
    <>
      {flashMessage ? <FlashMessage title={flashMessage.title} description={flashMessage.description} /> : null}
      <div className="inline-flex flex-wrap rounded-[14px] bg-slate-100 p-1">
        {[
          { value: "code" as const, label: "Code" },
          { value: "read" as const, label: "Read Contract" },
          { value: "write" as const, label: "Write Contract" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`inline-flex h-8 items-center rounded-[10px] px-4 text-xs font-semibold transition ${
              activeTab === tab.value
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                : "text-slate-900 hover:text-slate-700"
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

      {activeTab === "code" ? (
        <section className="mt-4 grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Binding</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{binding.label}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Artifact</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{artifact.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Address</p>
                <p className="mt-1 break-all text-sm text-slate-700 mono">{binding.address}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Environment</p>
                <p className="mt-1 text-sm text-slate-700">
                  {environment.providerName} / Chain {environment.chainId}
                </p>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Contract ABI</p>
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip="Copy ABI"
                    aria-label="Copy ABI"
                    onClick={() => {
                      void navigator.clipboard.writeText(artifact.abiJson);
                      setFlashMessage({
                        title: "ABI copied",
                        description: "Contract ABI was copied successfully.",
                      });
                    }}
                  >
                    <IconCopy className="size-4" stroke={1.8} />
                  </ActionIconButton>
                </div>
                <div className="mt-3 max-h-[420px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <JsonView
                    className="json-view-wrap"
                    value={abiJsonValue}
                    collapsed={2}
                    shortenTextAfterLength={0}
                    enableClipboard={false}
                    displayDataTypes={false}
                    displayObjectSize={false}
                    style={{
                      "--w-rjv-background-color": "transparent",
                      "--w-rjv-border-left": "1px dashed rgba(148, 163, 184, 0.28)",
                      "--w-rjv-font-family":
                        '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                      "--w-rjv-color": "#0f172a",
                      "--w-rjv-arrow-color": "#64748b",
                      "--w-rjv-line-color": "rgba(148, 163, 184, 0.24)",
                      "--w-rjv-curlybraces-color": "#475569",
                      "--w-rjv-brackets-color": "#475569",
                      "--w-rjv-colon-color": "#94a3b8",
                      "--w-rjv-key-string": "#0369a1",
                      "--w-rjv-key-number": "#0369a1",
                      "--w-rjv-type-string-color": "#b45309",
                      "--w-rjv-type-int-color": "#7c3aed",
                      "--w-rjv-type-float-color": "#7c3aed",
                      "--w-rjv-type-bigint-color": "#7c3aed",
                      "--w-rjv-type-boolean-color": "#15803d",
                      "--w-rjv-type-null-color": "#b91c1c",
                      "--w-rjv-type-undefined-color": "#b91c1c",
                    } as CSSProperties}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Artifact Bytecode</p>
                <pre className="mt-3 max-h-[260px] overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-800">
                  {artifact.bytecode ?? "No bytecode saved for this artifact."}
                </pre>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "read" ? (
        <div className="mt-4 grid gap-4">
          <FunctionListSection
            title="Read Contract"
            functions={readFunctions}
            expandedSignatures={expandedReadSignatures}
            onToggle={handleToggleReadSignature}
            onExpandAll={() => setExpandedReadSignatures(readFunctions.map((fn) => fn.signature))}
            onCollapseAll={() => setExpandedReadSignatures([])}
            onReset={resetReadView}
            onCopySignature={copyFunctionSignature}
            renderHeaderActions={(fn) => (
              (() => {
                const isExpanded = expandedReadSignatures.includes(fn.signature);
                const canQuery = fn.inputs.length === 0 || isExpanded;
                const isLoading = actionLoadingKey === `read:${fn.signature}`;

                return (
                  <ActionIconButton
                    className={
                      canQuery
                        ? "text-slate-400 hover:text-slate-700"
                        : "text-slate-300 hover:text-slate-300"
                    }
                    tooltip={isLoading ? "Querying..." : "Query"}
                    aria-label={isLoading ? "Querying..." : "Query"}
                    onClick={() => handleQueryAction(fn)}
                    disabled={!canQuery || actionLoadingKey !== null}
                  >
                    {isLoading ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconPlayerPlay className="size-4" stroke={1.8} />
                    )}
                  </ActionIconButton>
                );
              })()
            )}
            inputBadgeLabel="Input"
            emptyText="No read methods are available for this contract."
            renderExpanded={(fn) => (
              <div className="grid gap-4">
                <FunctionArgumentsForm
                  fn={fn}
                  values={readArgumentValues[fn.signature] ?? fn.inputs.map(() => "")}
                  onChange={(index, value) => updateReadArgumentValue(fn.signature, index, value)}
                />
                {readResults[fn.signature] ? (
                  <ValuePreview value={readResults[fn.signature]} />
                ) : readErrors[fn.signature] ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                    {readErrors[fn.signature]}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400">
                    Query the method to view the returned result.
                  </div>
                )}
              </div>
            )}
          />
        </div>
      ) : null}

      {activeTab === "write" ? (
        <div className="mt-4 grid gap-4">
          <article className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected Key</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeKeyStateLabel}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Binding</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{binding.label}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Contract</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{artifact.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Environment</p>
                <p className="mt-1 text-sm text-slate-700">
                  {environment.providerName} / Chain {environment.chainId}
                </p>
              </div>
            </div>
            {!activeKey ? (
              <p className="mt-4 text-sm text-amber-600">
                Select a global private key first before preparing or sending contract writes.
              </p>
            ) : null}
          </article>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <FunctionListSection
            title="Write Contract"
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
                Manual Send
              </label>
            }
            renderHeaderActions={(fn) => (
              (() => {
                const canWrite = fn.inputs.length === 0 || expandedWriteSignatures.includes(fn.signature);
                const isLoading =
                  actionLoadingKey === `write:${fn.signature}` ||
                  actionLoadingKey === `manual:${fn.signature}` ||
                  actionLoadingKey === `manual-confirm:${fn.signature}`;

                return (
                  <ActionIconButton
                    className={
                      canWrite
                        ? "text-slate-400 hover:text-slate-700"
                        : "text-slate-300 hover:text-slate-300"
                    }
                    tooltip={isLoading ? "Writing..." : manualWriteMode ? "Manual Write" : "Write"}
                    aria-label={isLoading ? "Writing..." : manualWriteMode ? "Manual Write" : "Write"}
                    onClick={() =>
                      void (manualWriteMode ? openManualWriteDialog(fn.signature) : executeWriteAction(fn.signature))
                    }
                    disabled={!activeKey || !canWrite || actionLoadingKey !== null}
                  >
                    {isLoading ? (
                      <IconLoader2 className="size-4 animate-spin" />
                    ) : (
                      <IconBrandTelegram className="size-4" stroke={1.8} />
                    )}
                  </ActionIconButton>
                );
              })()
            )}
            inputBadgeLabel="Input"
            emptyText="No write methods are available for this contract."
            renderExpanded={(fn) => (
              <div className="grid gap-4">
                <FunctionArgumentsForm
                  fn={fn}
                  values={writeArgumentValues[fn.signature] ?? fn.inputs.map(() => "")}
                  onChange={(index, value) => updateWriteArgumentValue(fn.signature, index, value)}
                />
                {fn.stateMutability === "payable" && !manualWriteMode ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">
                      Native Value ({environment.nativeCurrency})
                    </label>
                    <Input
                      value={writeValueBySignature[fn.signature] ?? ""}
                      onChange={(event) => updateWriteValue(fn.signature, event.target.value)}
                      placeholder="0"
                    />
                  </div>
                ) : null}
                <WriteExecutionPreview
                  preview={writePreviews[fn.signature] ?? null}
                  result={writeResults[fn.signature] ?? null}
                  error={writeErrors[fn.signature] ?? null}
                />
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
            setUnlockPassword("");
            setUnlockError(null);
            setPendingWriteAction(null);
          }
        }}
        title="Unlock Private Key"
        description={
          activeKey
            ? `Enter the password for "${activeKey.name}" to continue the contract write flow.`
            : "Enter the password to continue."
        }
        value={unlockPassword}
        onValueChange={setUnlockPassword}
        placeholder="Password"
        confirmLabel="Unlock"
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
        title="Manual Write"
        description="Review the simulated values, adjust them if needed, then confirm to force-send the transaction."
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (manualWriteTarget) {
                  void executeManualWriteAction(manualWriteTarget);
                }
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={
                !manualWriteTarget ||
                !isManualWriteDialogReady(manualWriteDialogValues) ||
                actionLoadingKey === `manual-confirm:${manualWriteTarget}`
              }
            >
              {manualWriteTarget && actionLoadingKey === `manual-confirm:${manualWriteTarget}` ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Confirm Force Send"
              )}
            </Button>
          </>
        }
        maxWidthClassName="max-w-lg"
      >
        {manualWriteTarget ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Contract</p>
              <p className="break-all text-sm text-slate-900 mono">{binding.address}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Method</p>
              <p className="text-sm text-slate-900">{manualWriteTarget}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Selected Key</p>
              <p className="text-sm text-slate-900">{activeKey?.name ?? "No Key Selected"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Chain ID</p>
              <p className="text-sm text-slate-900">{environment.chainId}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Txn Type</label>
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
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIP1559">EIP1559</SelectItem>
                    <SelectItem value="LEGACY">LEGACY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Value ({environment.nativeCurrency})</label>
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
              {manualWriteDialogValues.transactionType === "LEGACY" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Gas Price (Gwei)</label>
                  <Input
                    value={manualWriteDialogValues.gasPrice}
                    onChange={(event) =>
                      setManualWriteDialogValues((current) => ({
                        ...current,
                        gasPrice: event.target.value,
                      }))
                    }
                    placeholder="0.001"
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Max Fee Per Gas (Gwei)</label>
                    <Input
                      value={manualWriteDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setManualWriteDialogValues((current) => ({
                          ...current,
                          maxFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="0.001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Max Priority Fee Per Gas (Gwei)</label>
                    <Input
                      value={manualWriteDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setManualWriteDialogValues((current) => ({
                          ...current,
                          maxPriorityFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="0.001"
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Gas Limit</label>
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
                <label className="text-sm font-medium text-slate-700">Nonce</label>
                <Input
                  value={manualWriteDialogValues.nonce}
                  onChange={(event) =>
                    setManualWriteDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            {manualWriteDialogError ? (
              <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {manualWriteDialogError}
              </div>
            ) : null}
          </div>
        ) : null}
      </ModalDialog>
      <style jsx global>{`
        .json-view-wrap .w-rjv-value {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>
    </>
  );
}
