"use client";

import JsonView from "@uiw/react-json-view";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconLanguage,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { DetailPageSkeleton } from "@/components/ui/loading-placeholders";
import { RelativeTime } from "@/components/relative-time";
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from "@/domains/evm/client/address-tags";
import { resolvePreferredToAddressLabel } from "@/domains/evm/client/address-display";
import { subscribeEvmContractRegistry } from "@/domains/evm/client/contract-registry";
import { resolveEvmTransactionMethodLabel } from "@/domains/evm/client/transaction-decoder";
import { AddressLink } from "@/domains/evm/ui/address-link";
import {
  getEvmBlockByNumberDirect,
} from "@/domains/evm/client/queries";
import { AppShell } from "@/platform/layout/app-shell";
import { TransactionHashCell, TransactionPreviewButton } from "@/domains/evm/ui/transaction-list-cells";

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={mono ? "self-start break-all whitespace-pre-wrap text-sm text-slate-900 mono" : "self-start text-sm text-slate-900"}>{value}</dd>
    </div>
  );
}

function DetailRowWithAction({
  label,
  value,
  action,
  mono = false,
}: {
      label: string;
      value: React.ReactNode;
      action: React.ReactNode;
      mono?: boolean;
    }) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="flex items-center gap-0.5 text-sm font-medium text-slate-500">
        <span>{label}</span>
        {action}
      </dt>
      <dd className={mono ? "self-start break-all whitespace-pre-wrap text-left text-sm text-slate-900 mono" : "self-start text-left text-sm text-slate-900"}>{value}</dd>
    </div>
  );
}

function DetailRowBlockHeight({
  height,
  canOpenPrevious,
  previousBlockNumber,
  onOpenPrevious,
  onOpenNext,
}: {
  height: string;
  canOpenPrevious: boolean;
  previousBlockNumber: number;
  onOpenPrevious: () => void;
  onOpenNext: () => void;
}) {
  return (
    <div className="grid gap-1 py-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-4">
      <dt className="text-sm font-medium text-slate-500">Block Height</dt>
      <dd className="flex flex-wrap items-center gap-2 self-start text-sm text-slate-900">
        <span>{height}</span>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canOpenPrevious}
          onClick={onOpenPrevious}
          aria-label={`Open block ${previousBlockNumber}`}
        >
          <IconChevronLeft className="size-3" stroke={2} />
        </button>
        <button
          type="button"
          className="inline-flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:text-slate-800"
          onClick={onOpenNext}
          aria-label={`Open block ${Number(height) + 1}`}
        >
          <IconChevronRight className="size-3" stroke={2} />
        </button>
      </dd>
    </div>
  );
}

function DetailGroup({ children, separated = false }: { children: React.ReactNode; separated?: boolean }) {
  return <div className={separated ? "border-t border-slate-200 pt-2.5 pb-2.5 last:pb-0" : "pb-2.5 last:pb-0"}>{children}</div>;
}

function decodeHexToAscii(value: string) {
  if (!value.startsWith("0x")) {
    return value;
  }

  const hex = value.slice(2);

  if (!hex || hex.length % 2 !== 0) {
    return "ASCII unavailable";
  }

  let output = "";

  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);

    if (Number.isNaN(byte)) {
      return "ASCII unavailable";
    }

    if (byte === 0) {
      continue;
    }

    output += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
  }

  return output || "ASCII unavailable";
}

export default function EvmBlockDetailPage() {
  const router = useRouter();
  const params = useParams<{ number: string }>();
  const number = params.number;
  const isValid = useMemo(() => /^\d+$/.test(number), [number]);
  const [block, setBlock] = useState<Awaited<ReturnType<typeof getEvmBlockByNumberDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "json">("overview");
  const [extraDataView, setExtraDataView] = useState<"hex" | "ascii">("hex");
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [decodeVersion, setDecodeVersion] = useState(0);
  const visibleAddresses = useMemo(
    () =>
      [...new Set(
        block?.transactions.flatMap((transaction) => [
          transaction.from,
          ...(transaction.to ? [transaction.to] : []),
        ]) ?? [],
      )],
    [block],
  );
  const decodedMethodLabelByHash = useMemo(() => {
    void decodeVersion;

    return Object.fromEntries(
      (block?.transactions ?? []).map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [block, decodeVersion]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmBlockByNumberDirect(BigInt(number));

        if (!cancelled) {
          setBlock(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBlock(null);
          setErrorMessage(error instanceof Error ? error.message : "Failed to load block detail.");
        }
      }
    }

    void load();
    window.addEventListener("chaindev:active-rpc-profile-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("chaindev:active-rpc-profile-changed", load);
    };
  }, [isValid, number]);

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

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid block number</h1>
          <p>The block number must be a non-negative integer.</p>
        </main>
      </AppShell>
    );
  }

  if (!block) {
    if (!errorMessage) {
      return (
        <AppShell>
          <DetailPageSkeleton titleWidth="w-20" groups={3} rowsPerGroup={4} />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load block</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  const previousBlockNumber = Number(block.height) - 1;
  const canOpenPrevious = previousBlockNumber >= 0;
  const decodedExtraData = decodeHexToAscii(block.extraData);
  const hasTransactions = block.transactions.length > 0;
  const currentBlock = block;
  const resolvedActiveTab = activeTab === "transactions" && !hasTransactions ? "overview" : activeTab;
  void currentBlock;

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Block</h1>
            <span className="text-sm font-medium text-slate-500">#{block.height}</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === "overview" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              !hasTransactions
                ? "cursor-not-allowed bg-slate-100 text-slate-300"
                : resolvedActiveTab === "transactions"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => {
              if (hasTransactions) {
                setActiveTab("transactions");
              }
            }}
            disabled={!hasTransactions}
            aria-disabled={!hasTransactions}
          >
            {hasTransactions ? `Transactions (${block.transactions.length})` : "Transactions"}
          </button>
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${
              resolvedActiveTab === "json" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
            }`}
            onClick={() => setActiveTab("json")}
          >
            JSON
          </button>
        </div>

        {resolvedActiveTab === "overview" ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="p-5">
                <DetailGroup>
                  <dl>
                    <DetailRowBlockHeight
                      height={block.height}
                      canOpenPrevious={canOpenPrevious}
                      previousBlockNumber={previousBlockNumber}
                      onOpenPrevious={() => {
                        if (canOpenPrevious) {
                          router.push(`/evm/block/${previousBlockNumber}`);
                        }
                      }}
                      onOpenNext={() => router.push(`/evm/block/${Number(block.height) + 1}`)}
                    />
                    <DetailRow label="Status" value={<span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Confirmed</span>} />
                    <DetailRow
                      label="Timestamp"
                      value={
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span><RelativeTime timestampMs={block.timestamp} /></span>
                          <span className="text-slate-500">({block.timestampLabel})</span>
                        </span>
                      }
                    />
                    <DetailRow
                      label="Transactions"
                      value={
                        hasTransactions ? (
                          <button
                            type="button"
                            className="font-medium text-sky-600 transition hover:text-sky-700"
                            onClick={() => setActiveTab("transactions")}
                          >
                            {block.txCount} transactions
                          </button>
                        ) : (
                          `${block.txCount} transactions`
                        )
                      }
                    />
                    <DetailRow
                      label="Miner"
                      value={
                        <AddressLink
                          address={block.miner}
                          href={`/evm/address/${block.miner}`}
                          label={nameTagsByAddress[block.miner] ?? block.miner}
                          className="font-medium text-sky-600 hover:text-sky-700 mono"
                          tooltipClassName="max-w-[90vw]"
                        />
                      }
                    />
                    <DetailRow label="Withdrawals" value={block.withdrawalsCount ? `${block.withdrawalsCount} withdrawals` : "0 withdrawals"} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRow label="Block Size" value={block.sizeLabel} />
                    <DetailRow label="Gas Used" value={<span>{block.gasUsedLabel} <span className="text-slate-500">({block.gasUsedPercent})</span></span>} />
                    <DetailRow label="Gas Limit" value={block.gasLimitLabel} />
                    <DetailRow label="Base Fee Per Gas" value={block.baseFeeLabel} />
                    <DetailRow label="Difficulty" value={block.difficultyLabel} />
                    <DetailRow label="Total Difficulty" value={block.totalDifficultyLabel} />
                    <DetailRow label="Blob Gas Used" value={block.blobGasUsedLabel} />
                  </dl>
                </DetailGroup>

                <DetailGroup separated>
                  <dl>
                    <DetailRowWithAction
                      label="Extra Data"
                      action={
                        <button
                          type="button"
                          className="inline-flex size-4 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-700"
                          onClick={() => setExtraDataView((current) => (current === "hex" ? "ascii" : "hex"))}
                          aria-label={extraDataView === "hex" ? "Convert extra data to ASCII" : "Show extra data as hex"}
                          title={extraDataView === "hex" ? "Hex to ASCII" : "Show Hex"}
                        >
                          <IconLanguage className="size-3.5" stroke={1.8} />
                        </button>
                      }
                      value={
                        extraDataView === "hex" ? block.extraData : decodedExtraData
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
                      <DetailRow label="Hash" value={block.hash} mono />
                      <DetailRow
                        label="Parent Hash"
                        value={
                          canOpenPrevious ? (
                            <Link className="text-sky-600 hover:text-sky-700 mono" href={`/evm/block/${previousBlockNumber}`}>
                              {block.parentHash}
                            </Link>
                          ) : (
                            block.parentHash
                          )
                        }
                        mono
                      />
                      <DetailRow label="State Root" value={block.stateRoot} mono />
                      <DetailRow label="Transactions Root" value={block.transactionsRoot} mono />
                      <DetailRow label="Receipts Root" value={block.receiptsRoot} mono />
                      <DetailRow label="Withdrawals Root" value={block.withdrawalsRoot} mono />
                      <DetailRow label="Nonce" value={block.nonce} mono />
                      <DetailRow label="SHA3 Uncles" value={block.sha3Uncles} mono />
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
        ) : resolvedActiveTab === "transactions" ? (
          <div className="p-5">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">A total of {block.transactions.length} transactions found</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Transaction Hash</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Method</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Block</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Age</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">From</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">To</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Amount</th>
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Txn Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.transactions.map((transaction) => {
                      const decodedMethodLabel = decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel;

                      return (
                        <tr key={transaction.hash} className="border-t border-slate-200">
                          <td className="px-5 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <TransactionPreviewButton transaction={transaction} methodLabel={decodedMethodLabel} />
                              <TransactionHashCell {...transaction} />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm">
                            <span className="inline-flex min-w-[92px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {decodedMethodLabel}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm tabular-nums">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-700">
                            <RelativeTime timestampMs={transaction.timestampMs} />
                          </td>
                          <td className="px-5 py-3 text-sm">
                            <AddressLink
                              address={transaction.from}
                              href={`/evm/address/${transaction.from}`}
                              label={nameTagsByAddress[transaction.from] ?? transaction.fromLabel}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          </td>
                          <td className="px-5 py-3 text-sm">
                            {transaction.to ? (
                              <AddressLink
                                address={transaction.to}
                                href={`/evm/address/${transaction.to}`}
                                label={resolvePreferredToAddressLabel(transaction.to, {
                                  nameTagsByAddress,
                                  fallbackLabel: transaction.toLabel,
                                })}
                                className="font-medium text-sky-600 hover:text-sky-700"
                              />
                            ) : (
                              <span className="text-slate-500">{transaction.toLabel}</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-sm font-medium tabular-nums text-slate-900">{transaction.valueLabel}</td>
                          <td className="px-5 py-3 text-sm tabular-nums text-slate-500">
                            {transaction.feeLabel ?? <span className="text-slate-400">--</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <JsonView
              className="json-view-wrap"
              value={block.rawJson as object}
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
