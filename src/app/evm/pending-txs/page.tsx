'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PendingTransactionsSkeleton } from '@/components/ui/loading-placeholders';
import {
  getEvmAddressTags,
  subscribeEvmAddressTags,
} from '@/domains/evm/client/address-tags';
import { resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { subscribeEvmContractRegistry } from '@/domains/evm/client/contract-registry';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { getEvmPendingTransactionsDirect } from '@/domains/evm/client/queries';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useEvmHomeData } from '@/domains/evm/ui/home-data-provider';
import { AppShell } from '@/platform/layout/app-shell';

export default function EvmPendingTransactionsPage() {
  const { pollIntervalMs } = useEvmHomeData();
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getEvmPendingTransactionsDirect>
  > | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameTagsByAddress, setNameTagsByAddress] = useState<
    Record<string, string | null>
  >({});
  const [decodeVersion, setDecodeVersion] = useState(0);

  const visibleAddresses = useMemo(
    () => [
      ...new Set(
        data?.transactions.flatMap((transaction) => [
          transaction.from,
          ...(transaction.to ? [transaction.to] : []),
        ]) ?? [],
      ),
    ],
    [data],
  );
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
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load pending transactions.',
        );
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
      void load();
    }

    void load();
    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      cancelled = true;
      clearScheduledLoad();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, [pollIntervalMs]);

  useEffect(() => {
    const unsubscribe = subscribeEvmContractRegistry(() => {
      setDecodeVersion((current) => current + 1);
    });

    const handleProfileChanged = () => {
      setDecodeVersion((current) => current + 1);
    };

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      unsubscribe();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
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

    window.addEventListener(
      'chaindev:active-rpc-profile-changed',
      handleProfileChanged,
    );

    return () => {
      unsubscribe();
      window.removeEventListener(
        'chaindev:active-rpc-profile-changed',
        handleProfileChanged,
      );
    };
  }, [visibleAddresses]);

  if (loading) {
    return (
      <AppShell>
        <PendingTransactionsSkeleton />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Pending transactions are unavailable</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">
            Pending Transactions
          </h1>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">
                {data.title}
              </p>
              <p className="mt-1 text-sm text-slate-500">{data.subtitle}</p>
            </div>
            <div className="text-sm text-slate-500">
              Showing {data.displayedTransactions.toLocaleString('en-US')} of{' '}
              {data.totalTransactions.toLocaleString('en-US')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Transaction Hash
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Method
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    From
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    To
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Amount
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Nonce
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Gas Price
                  </th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">
                    Max Tx Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.length ? (
                  data.transactions.map((transaction) => (
                    <tr
                      key={transaction.hash}
                      className="border-t border-slate-200"
                    >
                      <td className="px-5 py-3 text-sm">
                        <Link
                          className="font-medium text-sky-600 hover:text-sky-700"
                          href={`/evm/tx/${transaction.hash}`}
                        >
                          {transaction.hashLabel}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {decodedMethodLabelByHash[transaction.hash] ??
                          transaction.methodLabel}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <AddressLink
                          address={transaction.from}
                          href={`/evm/address/${transaction.from}`}
                          label={
                            nameTagsByAddress[transaction.from] ??
                            transaction.fromLabel
                          }
                          className="font-medium text-sky-600 hover:text-sky-700"
                        />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {transaction.to ? (
                          <AddressLink
                            address={transaction.to}
                            href={`/evm/address/${transaction.to}`}
                            label={resolvePreferredToAddressLabel(
                              transaction.to,
                              {
                                nameTagsByAddress,
                                fallbackLabel: transaction.toLabel,
                              },
                            )}
                            className="font-medium text-sky-600 hover:text-sky-700"
                          />
                        ) : (
                          <span>{transaction.toLabel}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">
                        {transaction.amountLabel}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-700">
                        {transaction.nonceLabel}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {transaction.gasPriceLabel}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">
                        {transaction.maxTxCostLabel}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      No pending transactions were returned by the current
                      provider.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
