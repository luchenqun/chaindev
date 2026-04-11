"use client";

import JsonView from "@uiw/react-json-view";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconArrowsExchange, IconCode } from "@tabler/icons-react";
import { decodeErrorResult } from "viem";
import { Button } from "@/components/ui/button";
import { DetailPageSkeleton } from "@/components/ui/loading-placeholders";
import { RelativeTime } from "@/components/relative-time";
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
