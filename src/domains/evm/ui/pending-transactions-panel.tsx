'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getEvmAddressTags, subscribeEvmAddressTags } from '@/domains/evm/client/address-tags';
import { resolvePreferredAddressLabel, resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { subscribeEvmContractRegistry } from '@/domains/evm/client/contract-registry';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
import { getEvmPendingTransactionsDirect } from '@/domains/evm/client/queries';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { TransactionMethodBadge } from '@/domains/evm/ui/transaction-list-cells';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';

function PendingTransactionsPanelSkeleton({ className = '' }: { className?: string }) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)] ${className}`.trim()}>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 animate-pulse">
          <div className="h-7 w-52 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[1250px] table-fixed">
          <colgroup>
            <col className="w-[235px]" />
            <col className="w-[150px]" />
            <col className="w-[185px]" />
            <col className="w-[185px]" />
            <col className="w-[150px]" />
            <col className="w-[95px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
          </colgroup>
          <thead>
            <tr>
              {Array.from({ length: 8 }).map((_, index) => (
                <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: DEFAULT_TABLE_PAGE_SIZE }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-200">
                {Array.from({ length: 8 }).map((_, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PendingTransactionsPanel({ className = '' }: { className?: string }) {
  const messages = useMessages();
  const { locale } = useLocale();
  const pendingMessages = messages.pendingTransactions;
  const commonMessages = messages.common;
  const { pollIntervalMs } = useEvmHomeData();
  const [data, setData] = useState<Awaited<ReturnType<typeof getEvmPendingTransactionsDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [decodeVersion, setDecodeVersion] = useState(0);

  const visibleAddresses = useMemo(() => [...new Set(data?.transactions.flatMap((transaction) => [transaction.from, ...(transaction.to ? [transaction.to] : [])]) ?? [])], [data]);
  const decodedMethodLabelByHash = useMemo(() => {
    void decodeVersion;

    return Object.fromEntries(
      (data?.transactions ?? []).map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [data, decodeVersion]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    function clearScheduledLoad() {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    async function load() {
      clearScheduledLoad();

      try {
        const next = await getEvmPendingTransactionsDirect(100, pollIntervalMs);

        if (cancelled) {
          return;
        }

        setData(next);
        setErrorMessage(null);
        timeoutId = window.setTimeout(() => {
          void load();
        }, next.pollIntervalMs);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setData(null);
        setErrorMessage(error instanceof Error ? error.message : pendingMessages.failedToLoad);
        timeoutId = window.setTimeout(() => {
          void load();
        }, 12_000);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function handleProfileChanged() {
      setLoading(true);
      void load();
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      clearScheduledLoad();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [pollIntervalMs]);

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

  if (loading) {
    return <PendingTransactionsPanelSkeleton className={className} />;
  }

  if (!data) {
    return (
      <section className={`rounded-3xl border border-slate-200 bg-white px-5 py-10 shadow-[0_6px_18px_rgba(15,23,42,0.06)] ${className}`.trim()}>
        <h2 className="text-lg font-semibold text-slate-900">{pendingMessages.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{errorMessage ? translateRuntimeText(errorMessage, locale) : errorMessage}</p>
      </section>
    );
  }

  return (
    <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)] ${className}`.trim()}>
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900">{translateRuntimeText(data.title, locale)}</p>
          <p className="mt-1 text-sm text-slate-500">{translateRuntimeText(data.subtitle, locale)}</p>
        </div>
        <div className="text-sm text-slate-500">
          {pendingMessages.showingCount
            .replace('{displayed}', data.displayedTransactions.toLocaleString(locale))
            .replace('{total}', data.totalTransactions.toLocaleString(locale))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[1250px] table-fixed">
          <colgroup>
            <col className="w-[235px]" />
            <col className="w-[150px]" />
            <col className="w-[185px]" />
            <col className="w-[185px]" />
            <col className="w-[150px]" />
            <col className="w-[95px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.hash}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.method}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{commonMessages.from}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{commonMessages.to}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.amount}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.nonce}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.gasPrice}</th>
              <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{pendingMessages.maxTxCost}</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length ? (
              data.transactions.map((transaction) => (
                <tr key={transaction.hash} className="border-t border-slate-200">
                  <td className="truncate px-5 py-3 text-sm">
                    <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/tx/${transaction.hash}`}>
                      {transaction.hashLabel}
                    </Link>
                  </td>
                  <td className="truncate px-5 py-3 text-sm">
                    <TransactionMethodBadge methodLabel={decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel} />
                  </td>
                  <td className="truncate px-5 py-3 text-sm">
                    <AddressLink
                      address={transaction.from}
                      href={`/evm/address/${transaction.from}`}
                      label={resolvePreferredAddressLabel(transaction.from, {
                        nameTagsByAddress,
                        fallbackLabel: transaction.fromLabel,
                      })}
                      className="font-medium text-sky-600 hover:text-sky-700"
                    />
                  </td>
                  <td className="truncate px-5 py-3 text-sm text-slate-700">
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
                      <span>{translateRuntimeText(transaction.toLabel, locale)}</span>
                    )}
                  </td>
                  <td className="truncate px-5 py-3 text-sm font-medium text-slate-900">{translateRuntimeText(transaction.amountLabel, locale)}</td>
                  <td className="truncate px-5 py-3 text-sm tabular-nums text-slate-700">{translateRuntimeText(transaction.nonceLabel, locale)}</td>
                  <td className="truncate px-5 py-3 text-sm text-slate-700">{translateRuntimeText(transaction.gasPriceLabel, locale)}</td>
                  <td className="truncate px-5 py-3 text-sm font-medium text-slate-900">{translateRuntimeText(transaction.maxTxCostLabel, locale)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                  {pendingMessages.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
