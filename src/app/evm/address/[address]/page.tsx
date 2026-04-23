'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { IconBinaryTree2, IconInfoCircle, IconTag } from '@tabler/icons-react';
import { RelativeTime } from '@/components/relative-time';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteEvmAddressTag, getEvmAddressTag, getEvmAddressTags, subscribeEvmAddressTags, upsertEvmAddressTag } from '@/domains/evm/client/address-tags';
import { resolvePreferredAddressLabel, resolvePreferredToAddressLabel } from '@/domains/evm/client/address-display';
import { getEvmAddressCacheSnapshot, MAX_CACHED_EVM_TRANSACTIONS, subscribeEvmTransactionCache } from '@/domains/evm/client/transaction-cache';
import {
  createEvmContractBinding,
  getEvmContractArtifact,
  listEvmContractArtifacts,
  listEvmContractBindingsByScope,
  subscribeEvmContractRegistry,
  updateEvmContractBinding,
  type EvmContractArtifact,
  type EvmContractBinding,
} from '@/domains/evm/client/contract-registry';
import { resolveEvmTransactionMethodLabel } from '@/domains/evm/client/transaction-decoder';
import { getActiveEvmContractEnvironmentDirect } from '@/domains/evm/client/contract-executor';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { AddressContractPanel } from '@/domains/evm/ui/address-contract-panel';
import { getActiveEvmCurrencyNameClient, getEvmAddressSummaryDirect, hydrateEvmCachedTransactionInputsByHashDirect } from '@/domains/evm/client/queries';
import { AppShell } from '@/platform/layout/app-shell';
import { TransactionHashCell, TransactionMethodBadge, TransactionPreviewButton } from '@/domains/evm/ui/transaction-list-cells';

const VISIBLE_TRANSACTIONS = 25;
type AddressPageTab = 'transactions' | 'contract';
type ContractSubview = 'code' | 'read' | 'write';
type ContractEnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
} | null;

function parsePageParam(rawPage: string | null) {
  const parsed = Number.parseInt(rawPage ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function AddressPageSkeleton() {
  return (
    <main className="section-block">
      <div className="mb-4 border-b border-slate-200 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-[520px]" />
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <Skeleton className="h-7 w-28" />
            <div className="mt-5 space-y-5">
              {Array.from({ length: 3 }).map((__, rowIndex) => (
                <div key={rowIndex}>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-2 h-5 w-48" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-28 rounded-md" />
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-7 w-80" />
          <Skeleton className="mt-2 h-4 w-[520px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {Array.from({ length: 9 }).map((_, index) => (
                  <th key={index} className="border-b border-slate-200 px-5 py-3 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200">
                  {Array.from({ length: 9 }).map((__, columnIndex) => (
                    <td key={columnIndex} className="px-5 py-3">
                      <Skeleton className={`h-4 ${columnIndex === 0 ? 'w-32' : columnIndex === 4 || columnIndex === 5 ? 'w-28' : 'w-20'}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatBalanceLabel(balance: string, currencyName: string) {
  const amount = Number.parseFloat(balance);

  if (!Number.isFinite(amount)) {
    return `${balance} ${currencyName}`;
  }

  if (amount === 0) {
    return `0 ${currencyName}`;
  }

  return `${amount.toFixed(6).replace(/\.?0+$/, '')} ${currencyName}`;
}

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function getDirection(
  transaction: {
    from: string;
    to: string | null;
  },
  normalizedAddress: string,
) {
  const fromMatches = transaction.from.toLowerCase() === normalizedAddress;
  const toMatches = transaction.to?.toLowerCase() === normalizedAddress;

  if (fromMatches && toMatches) {
    return { label: 'SELF', className: 'bg-slate-100 text-slate-600' };
  }

  if (fromMatches) {
    return { label: 'OUT', className: 'bg-amber-50 text-amber-700' };
  }

  return { label: 'IN', className: 'bg-emerald-50 text-emerald-700' };
}

function AddressMetric({ label, value, subtext, tooltip }: { label: string; value: React.ReactNode; subtext?: React.ReactNode; tooltip?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        {tooltip ? (
          <span className="group relative inline-flex">
            <span className="inline-flex items-center justify-center text-slate-300">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[260px] -translate-x-1/2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-[0_10px_30px_rgba(15,23,42,0.28)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {tooltip}
            </span>
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export default function EvmAddressPage() {
  const params = useParams<{ address: string }>();
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const address = params.address;
  const isValid = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(address), [address]);
  const requestedTab = searchParams.get('tab');
  const requestedContractTab = searchParams.get('contractTab');
  const transactionPage = parsePageParam(searchParams.get('page'));
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getEvmAddressSummaryDirect>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameTag, setNameTag] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [addressCacheSnapshot, setAddressCacheSnapshot] = useState<Awaited<ReturnType<typeof getEvmAddressCacheSnapshot>>>({
    page: 1,
    pageSize: VISIBLE_TRANSACTIONS,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    totalTransactions: 0,
    transactions: [],
    latestSeenTransaction: null,
    firstSeenTransaction: null,
    inboundCount: 0,
    outboundCount: 0,
    selfCount: 0,
  });
  const [nameTagsByAddress, setNameTagsByAddress] = useState<Record<string, string | null>>({});
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [contractEnvironment, setContractEnvironment] = useState<ContractEnvironmentState>(null);
  const [contractBinding, setContractBinding] = useState<EvmContractBinding | null>(null);
  const [contractArtifact, setContractArtifact] = useState<EvmContractArtifact | null>(null);
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingArtifactId, setBindingArtifactId] = useState('');
  const [bindingLabelInput, setBindingLabelInput] = useState('');
  const [bindingError, setBindingError] = useState<string | null>(null);
  const currencyName = getActiveEvmCurrencyNameClient();

  function goToLogin() {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/evm/address/${address}`)}`);
  }

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function loadAddressCache() {
      const nextSnapshot = await getEvmAddressCacheSnapshot(address, transactionPage, VISIBLE_TRANSACTIONS);

      if (!cancelled) {
        setAddressCacheSnapshot(nextSnapshot);
      }
    }

    void loadAddressCache();

    const unsubscribe = subscribeEvmTransactionCache(() => {
      void loadAddressCache();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [address, isValid, transactionPage]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    function loadTag() {
      const nextTag = getEvmAddressTag(address);
      setNameTag(nextTag);
      setTagInput(nextTag ?? '');
    }

    loadTag();

    const unsubscribe = subscribeEvmAddressTags(() => {
      loadTag();
    });

    const handleProfileChanged = () => {
      loadTag();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isValid]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const next = await getEvmAddressSummaryDirect(address);

        if (!cancelled) {
          setSummary(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSummary(null);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load address summary.');
        }
      }
    }

    void load();
    window.addEventListener('chaindev:active-rpc-profile-changed', load);

    return () => {
      cancelled = true;
      window.removeEventListener('chaindev:active-rpc-profile-changed', load);
    };
  }, [address, isValid]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    let cancelled = false;

    async function loadContractBinding() {
      const nextEnvironment = await getActiveEvmContractEnvironmentDirect();

      if (cancelled) {
        return;
      }

      const nextBinding =
        listEvmContractBindingsByScope(nextEnvironment.chainId, nextEnvironment.providerProfileId, nextEnvironment.providerName).find(
          (binding) => binding.addressLower === address.toLowerCase(),
        ) ?? null;

      setContractEnvironment(nextEnvironment);
      setArtifacts(listEvmContractArtifacts());
      setContractBinding(nextBinding);
      setContractArtifact(nextBinding ? getEvmContractArtifact(nextBinding.artifactId) : null);
    }

    void loadContractBinding();

    const unsubscribe = subscribeEvmContractRegistry(() => {
      void loadContractBinding();
    });

    const handleProfileChanged = () => {
      void loadContractBinding();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [address, isValid]);

  const normalizedAddress = address.toLowerCase();
  const visibleTransactions = addressCacheSnapshot.transactions;
  const latestSeenTransaction = addressCacheSnapshot.latestSeenTransaction;
  const firstSeenTransaction = addressCacheSnapshot.firstSeenTransaction;
  const inboundCount = addressCacheSnapshot.inboundCount;
  const outboundCount = addressCacheSnapshot.outboundCount;
  const selfCount = addressCacheSnapshot.selfCount;
  const resolvedActiveTab = requestedTab === 'contract' && contractBinding && contractArtifact && contractEnvironment ? 'contract' : 'transactions';
  const initialContractTab: ContractSubview = requestedContractTab === 'code' || requestedContractTab === 'write' ? requestedContractTab : 'read';
  const visibleAddresses = useMemo(
    () => [...new Set(visibleTransactions.flatMap((transaction) => [transaction.from, ...(transaction.to ? [transaction.to] : [])]))],
    [visibleTransactions],
  );
  const decodedMethodLabelByHash = useMemo(() => {
    void contractBinding;
    void contractArtifact;
    void contractEnvironment;

    return Object.fromEntries(
      visibleTransactions.map((transaction) => [
        transaction.hash,
        resolveEvmTransactionMethodLabel({
          to: transaction.to,
          inputData: transaction.inputData,
          fallbackMethodLabel: transaction.methodLabel,
        }),
      ]),
    );
  }, [visibleTransactions, contractBinding, contractArtifact, contractEnvironment]);

  useEffect(() => {
    const hashesNeedingInputData = visibleTransactions.filter((transaction) => transaction.to && !transaction.inputData).map((transaction) => transaction.hash);

    if (!hashesNeedingInputData.length) {
      return;
    }

    void hydrateEvmCachedTransactionInputsByHashDirect(hashesNeedingInputData);
  }, [visibleTransactions]);

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

  async function handleSaveTag() {
    try {
      if (tagInput.trim()) {
        await upsertEvmAddressTag(address, tagInput);
      } else {
        await deleteEvmAddressTag(address);
      }

      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  async function handleRemoveTag() {
    try {
      await deleteEvmAddressTag(address);
      setTagInput('');
      setTagDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
      }
    }
  }

  function openTagDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setTagInput(nameTag ?? '');
    setTagDialogOpen(true);
  }

  function openBindingDialog() {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    const defaultArtifact = (contractBinding ? getEvmContractArtifact(contractBinding.artifactId) : contractArtifact) ?? artifacts[0] ?? null;

    setBindingError(null);
    setBindingArtifactId(defaultArtifact?.id ?? '');
    setBindingLabelInput(contractBinding?.label ?? defaultArtifact?.name ?? '');
    setBindingDialogOpen(true);
  }

  function handleBindingArtifactChange(nextArtifactId: string) {
    setBindingArtifactId(nextArtifactId);
    setBindingLabelInput(artifacts.find((artifact) => artifact.id === nextArtifactId)?.name ?? '');
  }

  async function handleSaveBinding() {
    if (!contractEnvironment) {
      setBindingError('Current provider environment is unavailable.');
      return;
    }

    const selectedArtifactId = bindingArtifactId.trim();

    if (!selectedArtifactId) {
      setBindingError('Select a saved artifact first.');
      return;
    }

    try {
      const payload = {
        artifactId: selectedArtifactId,
        address,
        label: bindingLabelInput,
        chainId: contractEnvironment.chainId,
        providerProfileId: contractEnvironment.providerProfileId,
        providerName: contractEnvironment.providerName,
      };

      if (contractBinding) {
        await updateEvmContractBinding(contractBinding.id, payload);
      } else {
        await createEvmContractBinding(payload);
      }

      setBindingDialogOpen(false);
      setBindingError(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setBindingError(error instanceof Error ? error.message : 'Failed to bind artifact.');
    }
  }

  function navigateToTab(nextTab: AddressPageTab) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextTab === 'transactions') {
      nextParams.delete('tab');
      nextParams.delete('contractTab');
    } else {
      nextParams.set('tab', nextTab);

      if (!nextParams.get('contractTab')) {
        nextParams.set('contractTab', 'read');
      }
    }

    const query = nextParams.toString();
    router.replace(query ? `/evm/address/${address}?${query}` : `/evm/address/${address}`, {
      scroll: false,
    });
  }

  function handleTransactionPageChange(nextPage: number) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextPage <= 1) {
      nextParams.delete('page');
    } else {
      nextParams.set('page', String(nextPage));
    }

    const query = nextParams.toString();
    router.replace(query ? `/evm/address/${address}?${query}` : `/evm/address/${address}`, {
      scroll: false,
    });
  }

  if (!isValid) {
    return (
      <AppShell>
        <main className="content-panel">
          <h1>Invalid address</h1>
          <p>The address must be a 20-byte hex string.</p>
        </main>
      </AppShell>
    );
  }

  if (!summary) {
    if (!errorMessage) {
      return (
        <AppShell>
          <AddressPageSkeleton />
        </AppShell>
      );
    }

    return (
      <AppShell>
        <main className="content-panel">
          <h1>Failed to load address</h1>
          <p>{errorMessage}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">Address</h1>
            <span className="text-sm font-medium text-slate-500 mono">{summary.address}</span>
            <ActionIconButton tooltip={nameTag ? 'Edit tag' : 'Add tag'} className="text-slate-400 hover:text-sky-600" onClick={openTagDialog}>
              <IconTag className="size-4" stroke={1.8} />
            </ActionIconButton>
            <ActionIconButton tooltip={contractBinding ? 'Edit artifact binding' : 'Bind artifact'} className="text-slate-400 hover:text-sky-600" onClick={openBindingDialog}>
              <IconBinaryTree2 className="size-4" stroke={1.8} />
            </ActionIconButton>
            {nameTag ? <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{nameTag}</span> : null}
          </div>
        </div>

        <section>
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r">
                <AddressMetric label={`${currencyName} Balance`} value={formatBalanceLabel(summary.balance, currencyName)} />
              </div>
              <div className="border-b border-slate-200 p-5 xl:border-r">
                <AddressMetric label="Nonce" value={summary.nonce.toLocaleString('en-US')} />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label="Latest Seen"
                  value={
                    latestSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={latestSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      'Not cached yet'
                    )
                  }
                  tooltip={latestSeenTransaction ? 'Most recent cached transaction involving this address' : 'Browse blocks or transactions first to populate the local cache'}
                />
              </div>
              <div className="border-b border-slate-200 p-5">
                <AddressMetric
                  label="First Seen"
                  value={
                    firstSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={firstSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      'Not cached yet'
                    )
                  }
                  tooltip="Earliest cached transaction currently retained for this address"
                />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r xl:border-r">
                <AddressMetric
                  label="Observed Transactions"
                  value={addressCacheSnapshot.totalTransactions.toLocaleString('en-US')}
                  tooltip={`Showing latest ${visibleTransactions.length} cached records`}
                />
              </div>
              <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
                <AddressMetric label="Directions" value={`${inboundCount} In / ${outboundCount} Out / ${selfCount} Self`} />
              </div>
              <div className="p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label="Cached Transactions"
                  value={addressCacheSnapshot.totalTransactions.toLocaleString('en-US')}
                  tooltip={`IndexedDB cap: ${MAX_CACHED_EVM_TRANSACTIONS.toLocaleString('en-US')}. If the newest cached transaction hash no longer resolves on the current provider, the local cache is cleared.`}
                />
              </div>
              <div className="p-5">
                <AddressMetric
                  label="Address Coverage"
                  value={addressCacheSnapshot.totalTransactions ? `${addressCacheSnapshot.totalTransactions} matched` : 'No cached matches'}
                  tooltip="Only transactions seen from recent block queries are cached locally"
                />
              </div>
            </div>
          </article>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'transactions' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            onClick={() => navigateToTab('transactions')}
          >
            Transactions
          </button>
          {contractBinding && contractArtifact && contractEnvironment ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'contract' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              onClick={() => navigateToTab('contract')}
            >
              Contract
            </button>
          ) : null}
        </div>

        {resolvedActiveTab === 'transactions' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  Showing {visibleTransactions.length} from a total of {addressCacheSnapshot.totalTransactions.toLocaleString('en-US')} cached transactions
                </p>
                <p className="mt-1 text-sm text-slate-500">Showing IndexedDB-cached transactions where the address appears in either the `from` or `to` field.</p>
              </div>
              <PaginationControls
                page={addressCacheSnapshot.page}
                totalPages={addressCacheSnapshot.totalPages}
                hasPreviousPage={addressCacheSnapshot.hasPreviousPage}
                hasNextPage={addressCacheSnapshot.hasNextPage}
                plain
                onPageChange={handleTransactionPageChange}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 pl-5 pr-1 py-3 text-left text-[13px] font-semibold text-slate-800">Hash</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Method</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Block</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Age</th>
                    <th className="w-[44px] border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Dir</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">From</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">To</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Amount</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">Txn Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.length ? (
                    visibleTransactions.map((transaction) => {
                      const direction = getDirection(transaction, normalizedAddress);
                      const decodedMethodLabel = decodedMethodLabelByHash[transaction.hash] ?? transaction.methodLabel;

                      return (
                        <tr key={transaction.hash} className="border-t border-slate-200">
                          <td className="pl-5 pr-1 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <TransactionPreviewButton transaction={transaction} methodLabel={decodedMethodLabel} />
                              <TransactionHashCell {...transaction} />
                            </div>
                          </td>
                          <td className="px-1 py-3 text-sm">
                            <TransactionMethodBadge methodLabel={decodedMethodLabel} />
                          </td>
                          <td className="px-1 py-3 text-sm tabular-nums">
                            <Link className="font-medium text-sky-600 hover:text-sky-700" href={`/evm/block/${transaction.blockNumber}`}>
                              {transaction.blockNumber}
                            </Link>
                          </td>
                          <td className="px-1 py-3 text-sm text-slate-700">
                            <RelativeTime timestampMs={transaction.timestampMs} />
                          </td>
                          <td className="w-[44px] px-1 py-3 text-sm">
                            <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-1 text-xs font-semibold ${direction.className}`}>{direction.label}</span>
                          </td>
                          <td className="px-1 py-3 text-sm">
                            <AddressLink
                              address={transaction.from}
                              href={`/evm/address/${transaction.from}`}
                              label={resolvePreferredAddressLabel(transaction.from, {
                                nameTagsByAddress,
                                fallbackLabel: transaction.from.toLowerCase() === normalizedAddress ? formatAddressLabel(transaction.from) : transaction.fromLabel,
                              })}
                              className="font-medium text-sky-600 hover:text-sky-700"
                            />
                          </td>
                          <td className="px-1 py-3 text-sm">
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
                              <span className="text-slate-500">Contract Creation</span>
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm font-medium tabular-nums text-slate-900">{transaction.amountLabel}</td>
                          <td className="px-1 py-3 text-sm tabular-nums text-slate-500">{transaction.feeLabel ?? <span className="text-slate-400">--</span>}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-1 py-10 text-center text-sm text-slate-500">
                        No cached transactions for this address yet. Browse recent blocks or the tx list first so matching transactions can be written into IndexedDB.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="mt-4">
            {contractBinding && contractArtifact && contractEnvironment ? (
              <AddressContractPanel binding={contractBinding} artifact={contractArtifact} environment={contractEnvironment} initialTab={initialContractTab} />
            ) : null}
          </section>
        )}

        <ModalDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          title={nameTag ? 'Edit Tag' : 'Add Tag'}
          description="Save a short label for this address under the current provider profile."
          footer={
            <>
              {nameTag ? (
                <Button type="button" variant="outline" onClick={handleRemoveTag}>
                  Remove
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveTag}>
                Save
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <label className="grid gap-2 pb-1">
            <span className="text-sm font-medium text-slate-700">Tag</span>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Enter name tag" />
          </label>
        </ModalDialog>

        <ModalDialog
          open={bindingDialogOpen}
          onOpenChange={(open) => {
            setBindingDialogOpen(open);
            if (!open) {
              setBindingError(null);
            }
          }}
          title={contractBinding ? 'Edit Artifact Binding' : 'Bind Artifact'}
          description="Associate this address with a saved artifact under the current provider scope."
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setBindingDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveBinding()} disabled={!artifacts.length}>
                Save
              </Button>
            </>
          }
          maxWidthClassName="max-w-xl"
        >
          <div className="grid gap-4 pb-1">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Artifact</span>
              <Select value={bindingArtifactId} onValueChange={handleBindingArtifactChange} disabled={!artifacts.length}>
                <SelectTrigger>
                  <SelectValue placeholder={artifacts.length ? 'Select artifact' : 'No saved artifacts'} />
                </SelectTrigger>
                <SelectContent>
                  {artifacts.map((artifact) => (
                    <SelectItem key={artifact.id} value={artifact.id}>
                      {artifact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Label</span>
              <Input value={bindingLabelInput} onChange={(event) => setBindingLabelInput(event.target.value)} placeholder="Enter binding label" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <Input value={address} readOnly className="bg-slate-50 text-slate-500" />
            </label>

            {bindingError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{bindingError}</div> : null}
            {!artifacts.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                No saved artifacts yet. Create or import one in the contracts page first.
              </div>
            ) : null}
          </div>
        </ModalDialog>
      </main>
    </AppShell>
  );
}
