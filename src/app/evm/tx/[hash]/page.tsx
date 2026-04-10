"use client";

import JsonView from "@uiw/react-json-view";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { decodeErrorResult } from "viem";
import { DetailPageSkeleton } from "@/components/ui/loading-placeholders";
import { RelativeTime } from "@/components/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getEvmTransactionByHashDirect,
  getEvmTransactionDebugTraceDirect,
} from "@/domains/evm/client/queries";
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

export default function EvmTxPage() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash;
  const { status } = useEvmHomeData();
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{64}$/.test(hash), [hash]);
  const [transaction, setTransaction] = useState<Awaited<ReturnType<typeof getEvmTransactionByHashDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "debugTrace" | "json">("overview");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [traceData, setTraceData] = useState<unknown>(null);
  const [traceErrorMessage, setTraceErrorMessage] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

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
                        <Link className="font-medium text-sky-600 hover:text-sky-700 mono" href={`/evm/address/${transaction.from}`}>
                          {transaction.from}
                        </Link>
                      }
                    />
                    <DetailRow
                      label="Interacted With (To)"
                      value={
                        transaction.interactedWith ? (
                          <Link
                            className="font-medium text-sky-600 hover:text-sky-700 mono"
                            href={`/evm/address/${transaction.interactedWith}`}
                          >
                            {transaction.interactedWith}
                          </Link>
                        ) : (
                          "Contract Creation"
                        )
                      }
                    />
                    <DetailRow label="Method" value={transaction.methodLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label="Value" value={transaction.valueLabel} />
                    <DetailRow label="Transaction Fee" value={transaction.feeLabel} />
                    <DetailRow label="Gas Price" value={transaction.gasPriceLabel} />
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
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mono text-[13px] leading-6 text-slate-700">
                          {transaction.inputData}
                        </div>
                      }
                      mono
                    />
                  </dl>
                </DetailGroup>
              </div>
            </section>

            <section className="mt-2 rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                {!showMoreDetails ? (
                  <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
                    <dt className="text-sm font-medium text-slate-500">More Details</dt>
                    <dd>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                        onClick={() => setShowMoreDetails(true)}
                      >
                        <IconPlus className="size-4" stroke={2} />
                        Click to show more
                      </button>
                    </dd>
                  </div>
                ) : (
                  <div className="mt-0 pt-0">
                    <dl>
                      <DetailRow label="Hash" value={transaction.hash} mono />
                      <DetailRow label="From" value={transaction.from} mono />
                      <DetailRow label="To" value={transaction.to ?? "Contract Creation"} mono />
                      <DetailRow label="Interacted With" value={transaction.interactedWith ?? "Unavailable"} mono />
                      <DetailRow label="Input Data" value={transaction.inputData} mono />
                    </dl>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:gap-4">
                        <dt className="text-sm font-medium text-slate-500">More Details</dt>
                        <dd>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                            onClick={() => setShowMoreDetails(false)}
                          >
                            <IconMinus className="size-4" stroke={2} />
                            Click to show less
                          </button>
                        </dd>
                      </div>
                    </div>
                  </div>
                )}
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
