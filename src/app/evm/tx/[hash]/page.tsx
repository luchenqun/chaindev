"use client";

import JsonView from "@uiw/react-json-view";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowsExchange, IconCode, IconLoader2 } from "@tabler/icons-react";
import { decodeErrorResult, formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { FlashMessage } from "@/components/ui/flash-message";
import { Input } from "@/components/ui/input";
import { DetailPageSkeleton } from "@/components/ui/loading-placeholders";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { RelativeTime } from "@/components/relative-time";
import { SecretInputDialog } from "@/components/ui/secret-input-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from "@/domains/evm/client/address-tags";
import { resolvePreferredToAddressLabel } from "@/domains/evm/client/address-display";
import { subscribeEvmContractRegistry } from "@/domains/evm/client/contract-registry";
import {
  forceSendEvmTransactionDirect,
  forceWriteEvmContractMethodDirect,
  getActiveEvmContractEnvironmentDirect,
  getEvmTransactionManualDefaultsDirect,
  getEvmContractWriteManualDefaultsDirect,
} from "@/domains/evm/client/contract-executor";
import {
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  peekEvmStoredPrivateKey,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from "@/domains/evm/client/keyring";
import {
  decodeBoundEvmTransactionInput,
  decodeHexToUtf8,
  resolveEvmTransactionMethodLabel,
} from "@/domains/evm/client/transaction-decoder";
import {
  getEvmTransactionByHashDirect,
  getEvmTransactionDebugTraceDirect,
} from "@/domains/evm/client/queries";
import { AddressLink } from "@/domains/evm/ui/address-link";
import { useEvmHomeData } from "@/domains/evm/ui/home-data-provider";
import { AppShell } from "@/platform/layout/app-shell";

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={mono ? "self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono" : "self-start text-sm text-slate-900"}>
        {value}
      </dd>
    </div>
  );
}

function DetailGroup({ children, separated = false }: { children: React.ReactNode; separated?: boolean }) {
  return <div className={separated ? "border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0" : "pb-2.5 last:pb-0"}>{children}</div>;
}

function extractTraceReturnValue(traceData: unknown) {
  if (!traceData || typeof traceData !== "object") {
    return null;
  }

  const candidate =
    "returnValue" in traceData
      ? traceData.returnValue
      : "output" in traceData
        ? traceData.output
        : null;

  if (typeof candidate !== "string" || candidate.length === 0) {
    return null;
  }

  return candidate.startsWith("0x") ? candidate : `0x${candidate}`;
}

function decodeTraceReturnValue(returnValue: string | null) {
  if (!returnValue || returnValue === "0x") {
    return null;
  }

  try {
    const decoded = decodeErrorResult({ data: returnValue as `0x${string}` });

    if (!decoded.args || decoded.args.length === 0) {
      return decoded.errorName;
    }

    return `${decoded.errorName}: ${decoded.args.map((value) => String(value)).join(", ")}`;
  } catch {
    return null;
  }
}

function splitInputDataWords(inputData: string) {
  if (!inputData.startsWith("0x") || inputData.length <= 10) {
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

function buildDefaultInputDataView(inputData: string, functionSignature?: string, selector?: string) {
  const lines: string[] = [];

  if (functionSignature) {
    lines.push(`Function: ${functionSignature}`);
    lines.push("");
  }

  lines.push(`MethodID: ${selector ?? inputData.slice(0, 10)}`);

  for (const [index, word] of splitInputDataWords(inputData).entries()) {
    lines.push(`[${index}]:  ${word}`);
  }

  return lines.join("\n");
}

type RewriteTransactionType = "LEGACY" | "EIP1559";

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

function createInitialRewriteDialogState(input?: {
  transactionType?: RewriteTransactionType;
  value?: string;
  gasLimit?: string;
}): RewriteDialogState {
  return {
    transactionType: input?.transactionType ?? "EIP1559",
    value: input?.value ?? "0",
    gasPrice: "",
    maxFeePerGas: "auto",
    maxPriorityFeePerGas: "auto",
    gasLimit: input?.gasLimit ?? "",
    nonce: "auto",
  };
}

function isAutoFieldValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || normalizedValue === "auto";
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

  if (state.transactionType === "LEGACY") {
    return !!state.gasPrice.trim();
  }

  return (
    (isAutoFieldValue(state.nonce) || !!state.nonce.trim()) &&
    (isAutoFieldValue(state.maxFeePerGas) || !!state.maxFeePerGas.trim()) &&
    (isAutoFieldValue(state.maxPriorityFeePerGas) || !!state.maxPriorityFeePerGas.trim())
  );
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

function formatChainTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function formatMiddleEllipsis(value: string, leading = 10, trailing = 8) {
  if (value.length <= leading + trailing + 3) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

function extractTransactionRawField(rawJson: unknown, field: string) {
  if (!rawJson || typeof rawJson !== "object" || !("transaction" in rawJson)) {
    return null;
  }

  const transaction = rawJson.transaction;

  if (!transaction || typeof transaction !== "object" || !(field in transaction)) {
    return null;
  }

  const value = transaction[field as keyof typeof transaction];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function extractTransactionValueInput(rawJson: unknown) {
  const rawValue = extractTransactionRawField(rawJson, "value");

  if (!rawValue) {
    return "0";
  }

  try {
    return formatEther(BigInt(rawValue));
  } catch {
    return "0";
  }
}

function extractTransactionGasLimit(rawJson: unknown) {
  const rawGas = extractTransactionRawField(rawJson, "gas");

  return rawGas && /^\d+$/.test(rawGas) ? rawGas : "";
}

function resolveRewriteTransactionType(rawJson: unknown): RewriteTransactionType {
  const rawType = extractTransactionRawField(rawJson, "type")?.toLowerCase();

  if (rawType === "eip1559" || rawType === "0x2" || rawType === "2") {
    return "EIP1559";
  }

  return "LEGACY";
}

function RewriteArgumentsForm({
  args,
  values,
  onChange,
}: {
  args: Array<{ name: string; type: string }>;
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {args.map((arg, index) => {
        const isComplex = arg.type.includes("[") || arg.type === "tuple";

        return (
          <div key={`${arg.name}-${arg.type}-${index}`} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {arg.name} <span className="text-slate-400">({arg.type})</span>
            </label>
            {isComplex ? (
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400"
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
              />
            ) : (
              <Input
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={arg.type}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EvmTxPage() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash;
  const { status } = useEvmHomeData();
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{64}$/.test(hash), [hash]);
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getEvmTransactionByHashDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "debugTrace" | "json">("overview");
  const [traceData, setTraceData] = useState<unknown>(null);
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [inputDataView, setInputDataView] = useState<"default" | "utf8" | "original">("default");
  const [showDecodedInputTable, setShowDecodedInputTable] = useState(false);
  const [decodeVersion, setDecodeVersion] = useState(0);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [rewriteEnvironment, setRewriteEnvironment] = useState<RewriteEnvironmentState>(null);
  const [rewriteDialogOpen, setRewriteDialogOpen] = useState(false);
  const [rewriteArgumentValues, setRewriteArgumentValues] = useState<string[]>([]);
  const [rewriteDialogValues, setRewriteDialogValues] = useState<RewriteDialogState>(createInitialRewriteDialogState());
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteActionLoading, setRewriteActionLoading] = useState<"fill" | "rewrite" | null>(null);
  const [rewriteUnlockDialogOpen, setRewriteUnlockDialogOpen] = useState(false);
  const [rewriteUnlockPassword, setRewriteUnlockPassword] = useState("");
  const [rewriteUnlockError, setRewriteUnlockError] = useState<string | null>(null);
  const [pendingRewriteAction, setPendingRewriteAction] = useState<"fill" | "rewrite" | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    title: string;
    description?: string;
    tone?: "success" | "info";
  } | null>(null);
  const rewriteDefaultsRequestIdRef = useRef(0);
  const visibleAddresses = useMemo(
    () =>
      transaction
        ? [
            transaction.from,
            ...(transaction.to ? [transaction.to] : []),
            ...(transaction.interactedWith ? [transaction.interactedWith] : []),
          ]
        : [],
    [transaction],
  );
  const decodedTransactionInput = useMemo(
    () => {
      void decodeVersion;

      return transaction
        ? decodeBoundEvmTransactionInput({
            to: transaction.interactedWith ?? transaction.to,
            inputData: transaction.inputData,
          })
        : null;
    },
    [transaction, decodeVersion],
  );
  const decodedMethodLabel = useMemo(
    () => {
      void decodeVersion;

      return transaction
        ? resolveEvmTransactionMethodLabel({
            to: transaction.interactedWith ?? transaction.to,
            inputData: transaction.inputData,
            fallbackMethodLabel: transaction.methodLabel,
          })
        : "";
    },
    [transaction, decodeVersion],
  );
  const utf8InputData = useMemo(
    () => (transaction ? decodeHexToUtf8(transaction.inputData) : null),
    [transaction],
  );
  const defaultInputDataView = useMemo(
    () =>
      transaction
        ? buildDefaultInputDataView(
            transaction.inputData,
            decodedTransactionInput?.functionSignature,
            decodedTransactionInput?.selector,
          )
        : "",
    [transaction, decodedTransactionInput],
  );
  const rewriteTargetAddress = useMemo(
    () => transaction?.interactedWith ?? transaction?.to ?? null,
    [transaction],
  );
  const isRewriteTransfer = Boolean(transaction?.to && transaction.inputData === "0x");
  const canRewriteTransaction = Boolean(rewriteTargetAddress && (decodedTransactionInput || isRewriteTransfer));

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
          setActiveTab("overview");
          setInputDataView("default");
          setShowDecodedInputTable(false);
        }
      } catch (error) {
        if (!cancelled) {
          setTransaction(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load transaction.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
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
    window.addEventListener("chaindev:active-rpc-profile-changed", loadEnvironment);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", loadEnvironment);
    };
  }, []);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [flashMessage]);

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
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

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, [visibleAddresses]);

  useEffect(() => {
    if (
      !rewriteDialogOpen ||
      !canRewriteTransaction ||
      !rewriteTargetAddress ||
      !activeKey ||
      rewriteActionLoading === "rewrite" ||
      (activeKey.securityMode === "encrypted" && !isEvmStoredPrivateKeyUnlocked(activeKey.id)) ||
      !isValidNativeValueInput(rewriteDialogValues.value)
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fillRewriteDefaults(undefined, {
        rawArgs: rewriteArgumentValues,
        value: rewriteDialogValues.value,
      });
    }, 240);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    activeKey,
    canRewriteTransaction,
    decodedTransactionInput,
    rewriteDialogOpen,
    rewriteTargetAddress,
    rewriteArgumentValues,
    rewriteActionLoading,
    rewriteDialogValues.value,
  ]);

  function openRewriteDialog() {
    if (!canRewriteTransaction || !rewriteTargetAddress) {
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
    setRewriteUnlockPassword("");
    setRewriteUnlockError(null);
    setPendingRewriteAction(null);
    setRewriteDialogOpen(true);
  }

  async function fillRewriteDefaults(
    password?: string,
    overrides?: {
      rawArgs?: string[];
      value?: string;
    },
  ) {
    if (!rewriteTargetAddress || !activeKey || !canRewriteTransaction) {
      return;
    }

    setRewriteActionLoading("fill");
    setRewriteError(null);
    const requestId = rewriteDefaultsRequestIdRef.current + 1;
    rewriteDefaultsRequestIdRef.current = requestId;

    try {
      const privateKey = password
        ? await resolveEvmStoredPrivateKey(activeKey.id, password)
        : await peekEvmStoredPrivateKey(activeKey.id);
      const rawArgs = overrides?.rawArgs ?? rewriteArgumentValues;
      const value = overrides?.value ?? rewriteDialogValues.value;
      const defaults = decodedTransactionInput
        ? await getEvmContractWriteManualDefaultsDirect({
            address: rewriteTargetAddress,
            abiJson: decodedTransactionInput.abiJson,
            functionSignature: decodedTransactionInput.functionSignature,
            rawArgs,
            privateKey,
            value,
          })
        : await getEvmTransactionManualDefaultsDirect({
            to: rewriteTargetAddress,
            privateKey,
            value,
            data: transaction.inputData,
          });

      if (requestId !== rewriteDefaultsRequestIdRef.current) {
        return;
      }

      setRewriteDialogValues((current) => ({
        ...current,
        transactionType: defaults.transactionType,
        gasPrice: defaults.gasPrice,
        maxFeePerGas: isAutoFieldValue(current.maxFeePerGas) ? "auto" : current.maxFeePerGas,
        maxPriorityFeePerGas: isAutoFieldValue(current.maxPriorityFeePerGas)
          ? "auto"
          : current.maxPriorityFeePerGas,
        gasLimit: defaults.estimatedGas || current.gasLimit,
        nonce: isAutoFieldValue(current.nonce) ? "auto" : current.nonce,
      }));

      if (defaults.simulationError) {
        setRewriteError(
          normalizeContractActionErrorMessage(
            defaults.simulationError,
            "Failed to prepare rewritten transaction.",
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare rewritten transaction.";

      if (requestId !== rewriteDefaultsRequestIdRef.current) {
        return;
      }

      if (message === "Password is required.") {
        setPendingRewriteAction("fill");
        setRewriteUnlockPassword("");
        setRewriteUnlockError(null);
        setRewriteUnlockDialogOpen(true);
        return;
      }

      setRewriteError(normalizeContractActionErrorMessage(message, "Failed to prepare rewritten transaction."));
    } finally {
      if (requestId === rewriteDefaultsRequestIdRef.current) {
        setRewriteActionLoading(null);
      }
    }
  }

  async function executeRewriteAction(password?: string) {
    if (!rewriteTargetAddress || !activeKey || !canRewriteTransaction) {
      return;
    }

    setRewriteActionLoading("rewrite");
    setRewriteError(null);
    rewriteDefaultsRequestIdRef.current += 1;
    let rewriteSucceeded = false;

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id, password);
      const latestDefaults =
        rewriteDialogValues.transactionType === "EIP1559" &&
        (isAutoFieldValue(rewriteDialogValues.maxFeePerGas) ||
          isAutoFieldValue(rewriteDialogValues.maxPriorityFeePerGas) ||
          isAutoFieldValue(rewriteDialogValues.nonce))
          ? decodedTransactionInput
            ? await getEvmContractWriteManualDefaultsDirect({
                address: rewriteTargetAddress,
                abiJson: decodedTransactionInput.abiJson,
                functionSignature: decodedTransactionInput.functionSignature,
                rawArgs: rewriteArgumentValues,
                privateKey,
                value: rewriteDialogValues.value,
              })
            : await getEvmTransactionManualDefaultsDirect({
                to: rewriteTargetAddress,
                privateKey,
                value: rewriteDialogValues.value,
                data: transaction.inputData,
              })
          : isAutoFieldValue(rewriteDialogValues.nonce)
            ? decodedTransactionInput
              ? await getEvmContractWriteManualDefaultsDirect({
                  address: rewriteTargetAddress,
                  abiJson: decodedTransactionInput.abiJson,
                  functionSignature: decodedTransactionInput.functionSignature,
                  rawArgs: rewriteArgumentValues,
                  privateKey,
                  value: rewriteDialogValues.value,
                })
              : await getEvmTransactionManualDefaultsDirect({
                  to: rewriteTargetAddress,
                  privateKey,
                  value: rewriteDialogValues.value,
                  data: transaction.inputData,
                })
            : null;

      const resolvedDialogValues = {
        ...rewriteDialogValues,
        maxFeePerGas: isAutoFieldValue(rewriteDialogValues.maxFeePerGas)
          ? (latestDefaults?.maxFeePerGas ?? rewriteDialogValues.maxFeePerGas)
          : rewriteDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: isAutoFieldValue(rewriteDialogValues.maxPriorityFeePerGas)
          ? (latestDefaults?.maxPriorityFeePerGas ?? rewriteDialogValues.maxPriorityFeePerGas)
          : rewriteDialogValues.maxPriorityFeePerGas,
        nonce: isAutoFieldValue(rewriteDialogValues.nonce)
          ? (latestDefaults?.nonce ?? rewriteDialogValues.nonce)
          : rewriteDialogValues.nonce,
      };

      setRewriteDialogValues(resolvedDialogValues);

      const result = decodedTransactionInput
        ? await forceWriteEvmContractMethodDirect({
            address: rewriteTargetAddress,
            abiJson: decodedTransactionInput.abiJson,
            functionSignature: decodedTransactionInput.functionSignature,
            rawArgs: rewriteArgumentValues,
            privateKey,
            transactionType: resolvedDialogValues.transactionType,
            value: resolvedDialogValues.value,
            gasLimit: resolvedDialogValues.gasLimit,
            gasPrice: resolvedDialogValues.gasPrice,
            maxFeePerGas: resolvedDialogValues.maxFeePerGas,
            maxPriorityFeePerGas: resolvedDialogValues.maxPriorityFeePerGas,
            nonce: resolvedDialogValues.nonce,
          })
        : await forceSendEvmTransactionDirect({
            to: rewriteTargetAddress,
            privateKey,
            transactionType: resolvedDialogValues.transactionType,
            value: resolvedDialogValues.value,
            gasLimit: resolvedDialogValues.gasLimit,
            gasPrice: resolvedDialogValues.gasPrice,
            maxFeePerGas: resolvedDialogValues.maxFeePerGas,
            maxPriorityFeePerGas: resolvedDialogValues.maxPriorityFeePerGas,
            nonce: resolvedDialogValues.nonce,
            data: transaction.inputData,
          });

      setRewriteDialogOpen(false);
      rewriteSucceeded = true;
      setFlashMessage(
        result.receipt.status === "success"
          ? {
              title: "Rewrite submitted",
              description: `${decodedTransactionInput?.functionName ?? "Transfer"} was re-sent successfully. Included at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
              tone: "success",
            }
          : {
              title: "Rewrite reverted",
              description: `${decodedTransactionInput?.functionName ?? "Transfer"} reverted on-chain at ${formatChainTimestamp(result.receipt.blockTimestamp)}. Tx: ${formatMiddleEllipsis(result.hash)}`,
              tone: "info",
            },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rewrite transaction.";

      if (message === "Password is required.") {
        setPendingRewriteAction("rewrite");
        setRewriteUnlockPassword("");
        setRewriteUnlockError(null);
        setRewriteUnlockDialogOpen(true);
        return;
      }

      setRewriteError(normalizeContractActionErrorMessage(message, "Failed to rewrite transaction."));
    } finally {
      if (!rewriteSucceeded) {
        setRewriteActionLoading(null);
      }
    }
  }

  async function handleConfirmRewriteUnlock() {
    if (!activeKey || !pendingRewriteAction) {
      return;
    }

    try {
      await resolveEvmStoredPrivateKey(activeKey.id, rewriteUnlockPassword);
      const nextAction = pendingRewriteAction;
      setPendingRewriteAction(null);
      setRewriteUnlockDialogOpen(false);
      setRewriteUnlockPassword("");
      setRewriteUnlockError(null);

      if (nextAction === "fill") {
        await fillRewriteDefaults(rewriteUnlockPassword);
      } else {
        await executeRewriteAction(rewriteUnlockPassword);
      }
    } catch (error) {
      setRewriteUnlockError(
        normalizeContractActionErrorMessage(
          error instanceof Error ? error.message : "Failed to unlock private key.",
          "Failed to unlock private key.",
        ),
      );
    }
  }

  async function handleOpenDebugTraceTab() {
    setActiveTab("debugTrace");

    if (traceData !== null || traceLoading) {
      return;
    }

    setTraceLoading(true);
    setTraceErrorMessage(null);

    try {
      const next = await getEvmTransactionDebugTraceDirect(hash);
      setTraceData(next);
    } catch (error) {
      setTraceErrorMessage(
        error instanceof Error
          ? error.message
          : "The selected provider does not expose debug_traceTransaction.",
      );
    } finally {
      setTraceLoading(false);
    }
  }

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid transaction hash</h1>
          <p>The transaction hash must be a 32-byte hex string.</p>
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
          <h1>Failed to load transaction</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const showDebugTraceTab = transaction.status === "reverted";
  const traceReturnValue = extractTraceReturnValue(traceData);
  const decodedTraceReturnValue = decodeTraceReturnValue(traceReturnValue);
  const hasLogs = transaction.logsCount > 0;
  const liveConfirmationsLabel =
    transaction.blockNumber && status?.latestBlockNumber != null
      ? Math.max(0, status.latestBlockNumber - Number(transaction.blockNumber) + 1).toLocaleString("en-US")
      : transaction.confirmationsLabel;

  return (
    <AppShell>
      {flashMessage ? (
        <FlashMessage
          title={flashMessage.title}
          description={flashMessage.description}
          tone={flashMessage.tone}
        />
      ) : null}
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Transaction Details</h1>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === "overview" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              !hasLogs
                ? "cursor-not-allowed bg-slate-100 text-slate-300"
                : activeTab === "logs"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => {
              if (hasLogs) {
                setActiveTab("logs");
              }
            }}
            disabled={!hasLogs}
            aria-disabled={!hasLogs}
          >
            Logs ({transaction.logsCount})
          </button>
          {showDebugTraceTab ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === "debugTrace" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
              onClick={() => void handleOpenDebugTraceTab()}
            >
              Debug Trace
            </button>
          ) : null}
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === "json" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => setActiveTab("json")}
          >
            JSON
          </button>
        </div>

        {activeTab === "overview" ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                <DetailGroup>
                  <dl>
                    <DetailRow label="Transaction Hash" value={transaction.hash} mono />
                    <DetailRow
                      label="Status"
                      value={
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            transaction.status === "success"
                              ? "bg-emerald-50 text-emerald-700"
                              : transaction.status === "reverted"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {transaction.statusLabel}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Block"
                      value={
                        transaction.blockNumber ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                            {liveConfirmationsLabel ? (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
                                {liveConfirmationsLabel} Block Confirmations
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "Pending"
                        )
                      }
                    />
                    <DetailRow
                      label="Timestamp"
                      value={
                        transaction.timestampMs ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span><RelativeTime timestampMs={transaction.timestampMs} /></span>
                            <span className="text-slate-500">({transaction.timestampLabel})</span>
                          </span>
                        ) : (
                          "Unavailable"
                        )
                      }
                    />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow
                      label="From"
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
                      label="Interacted With (To)"
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
                          "Contract Creation"
                        )
                      }
                    />
                    <DetailRow
                      label="Method"
                      value={
                        decodedTransactionInput ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{decodedMethodLabel}</span>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 mono">
                              {decodedTransactionInput.selector}
                            </span>
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
                    <DetailRow label="Value" value={transaction.valueLabel} />
                    <DetailRow label="Transaction Fee" value={transaction.feeLabel} />
                    <DetailRow label="Gas Fees" value={transaction.gasFeesLabel} />
                    <DetailRow
                      label="Gas Limit & Usage by Txn"
                      value={`${transaction.gasLimitLabel} | ${transaction.gasUsedLabel} (${transaction.gasUsedPercent})`}
                    />
                    <DetailRow label="Nonce" value={transaction.nonceLabel} />
                    <DetailRow label="Position In Block" value={transaction.positionLabel} />
                    <DetailRow label="Txn Type" value={transaction.typeLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow
                      label="Input Data"
                      value={
                        showDecodedInputTable && decodedTransactionInput ? (
                          <div className="space-y-3">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <div className="max-h-[360px] overflow-auto">
                                <table className="w-full border-collapse">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">#</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Name</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Type</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-semibold text-slate-800">Data</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {decodedTransactionInput.args.map((arg, index) => (
                                      <tr key={`${arg.name}-${index}`} className="border-t border-slate-200">
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{index}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.name}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">{arg.type}</td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-900 mono">
                                          {arg.type === "address" ? (
                                            <Link
                                              href={`/evm/address/${arg.value}`}
                                              className="break-all text-[#6d4aff] hover:text-[#5935ff]"
                                            >
                                              {arg.value}
                                            </Link>
                                          ) : (
                                            <span className="break-all whitespace-pre-wrap">
                                              {arg.value}
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setShowDecodedInputTable(false)}
                            >
                              <IconArrowsExchange className="mr-1.5 size-3.5" stroke={1.8} />
                              Switch Back
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              readOnly
                              className="min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[14px] font-medium leading-6 text-slate-500 mono outline-none"
                              value={
                                inputDataView === "default"
                                  ? defaultInputDataView
                                  : inputDataView === "utf8"
                                    ? utf8InputData || "Unable to decode input data as UTF-8."
                                    : transaction.inputData
                              }
                            />
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="w-[170px]">
                                <Select
                                  value={inputDataView}
                                  onValueChange={(value) =>
                                    setInputDataView(value as "default" | "utf8" | "original")
                                  }
                                >
                                  <SelectTrigger className="h-8 rounded-md px-3 text-xs">
                                    <SelectValue placeholder="View Input As" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="default">Default View</SelectItem>
                                    <SelectItem value="utf8">UTF-8</SelectItem>
                                    <SelectItem value="original">Original</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!decodedTransactionInput}
                                onClick={() => setShowDecodedInputTable(true)}
                              >
                                <IconCode className="mr-1.5 size-3.5" stroke={1.8} />
                                Decode Input Data
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!canRewriteTransaction}
                                onClick={openRewriteDialog}
                              >
                                ReWrite
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
        ) : activeTab === "logs" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            {transaction.logsCount ? (
              <JsonView
                className="json-view-wrap"
                value={transaction.logs as object}
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
                } as React.CSSProperties}
              />
            ) : (
              <p className="text-sm text-slate-500">No receipt logs were returned for this transaction.</p>
            )}
          </section>
        ) : activeTab === "debugTrace" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            {traceLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-4 w-56" />
              </div>
            ) : traceErrorMessage ? (
              <p className="text-sm text-slate-500">{traceErrorMessage}</p>
            ) : traceReturnValue ? (
              <div className="space-y-2">
                <DetailRow label="Raw Return Value" value={traceReturnValue} mono />
                <DetailRow label="Decoded Return Value" value={decodedTraceReturnValue ?? "Unable to decode"} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">No returnValue was returned by debug_traceTransaction.</p>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView
              className="json-view-wrap"
              value={transaction.rawJson as object}
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
              } as React.CSSProperties}
            />
          </section>
        )}
      </main>
      <ModalDialog
        open={rewriteDialogOpen}
        onOpenChange={(open) => {
          setRewriteDialogOpen(open);

          if (!open) {
            setRewriteError(null);
            setRewriteActionLoading(null);
            setPendingRewriteAction(null);
          }
        }}
        title="ReWrite Transaction"
        description={
          decodedTransactionInput
            ? "Modify the decoded function arguments and resend this call as a force write."
            : "Resend this transfer with updated value and transaction settings."
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
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={
                !activeKey ||
                !canRewriteTransaction ||
                !isRewriteDialogReady(rewriteDialogValues) ||
                rewriteActionLoading === "rewrite"
              }
              onClick={() => void executeRewriteAction()}
            >
              {rewriteActionLoading === "rewrite" ? (
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
        maxWidthClassName="max-w-xl"
      >
        {canRewriteTransaction && rewriteTargetAddress ? (
          <div className="grid gap-4 pb-1">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Contract</p>
                <p className="mt-1 break-all text-sm text-slate-900 mono">{rewriteTargetAddress}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Method</p>
                <p className="mt-1 text-sm text-slate-900">
                  {decodedTransactionInput ? decodedTransactionInput.functionSignature : "Transfer"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Selected Key</p>
                <p className="mt-1 text-sm text-slate-900">{activeKey?.name ?? "No Key Selected"}</p>
              </div>
              {decodedTransactionInput ? (
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Artifact</p>
                  <p className="mt-1 text-sm text-slate-900">{decodedTransactionInput.artifactName}</p>
                </div>
              ) : null}
            </div>

            {!activeKey ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Select a global private key first.
              </div>
            ) : null}

            {decodedTransactionInput ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium text-slate-700">Function Arguments</p>
                <div className="max-h-64 overflow-y-auto pr-1">
                  <RewriteArgumentsForm
                    args={decodedTransactionInput.args.map((arg) => ({ name: arg.name, type: arg.type }))}
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
                This transaction is a native transfer. No function arguments are required.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Txn Type</label>
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
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIP1559">EIP1559</SelectItem>
                    <SelectItem value="LEGACY">LEGACY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Value ({rewriteEnvironment?.nativeCurrency ?? "Native"})
                </label>
                <Input
                  value={rewriteDialogValues.value}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              {rewriteDialogValues.transactionType === "LEGACY" ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">Gas Price (Gwei)</label>
                  <Input
                    value={rewriteDialogValues.gasPrice}
                    onChange={(event) =>
                      setRewriteDialogValues((current) => ({
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
                      value={rewriteDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setRewriteDialogValues((current) => ({
                          ...current,
                          maxFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="auto"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Max Priority Fee Per Gas (Gwei)</label>
                    <Input
                      value={rewriteDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setRewriteDialogValues((current) => ({
                          ...current,
                          maxPriorityFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="auto"
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Gas Limit</label>
                <Input
                  value={rewriteDialogValues.gasLimit}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
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
                  value={rewriteDialogValues.nonce}
                  onChange={(event) =>
                    setRewriteDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder="auto"
                />
              </div>
            </div>

            {rewriteError ? (
              <div className="max-h-32 overflow-auto rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="break-all whitespace-pre-wrap">{rewriteError}</p>
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
            setRewriteUnlockPassword("");
            setRewriteUnlockError(null);
            setPendingRewriteAction(null);
          }
        }}
        title="Unlock Private Key"
        description={
          activeKey
            ? `Enter the password for "${activeKey.name}" to continue the rewrite flow.`
            : "Enter the password to continue."
        }
        value={rewriteUnlockPassword}
        onValueChange={setRewriteUnlockPassword}
        placeholder="Password"
        confirmLabel="Unlock"
        errorMessage={rewriteUnlockError}
        confirmDisabled={!rewriteUnlockPassword.trim()}
        onConfirm={() => void handleConfirmRewriteUnlock()}
      />
      <style jsx global>{`
        .json-view-wrap .w-rjv-value {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      `}</style>
    </AppShell>
  );
}
