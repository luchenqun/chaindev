'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconBinaryTree2, IconInfoCircle, IconTag } from '@tabler/icons-react';
import { RelativeTime } from '@/components/relative-time';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/config/pagination';
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
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { TransactionHashCell, TransactionMethodBadge, TransactionPreviewButton } from '@/domains/evm/ui/transaction-list-cells';

const VISIBLE_TRANSACTIONS = DEFAULT_TABLE_PAGE_SIZE;
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
              {Array.from({ length: VISIBLE_TRANSACTIONS }).map((_, rowIndex) => (
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
    return { label: 'self', className: 'bg-slate-100 text-slate-600' };
  }

  if (fromMatches) {
    return { label: 'out', className: 'bg-amber-50 text-amber-700' };
  }

  return { label: 'in', className: 'bg-emerald-50 text-emerald-700' };
}

function AddressMetric({ label, value, subtext, tooltip }: { label: string; value: React.ReactNode; subtext?: React.ReactNode; tooltip?: React.ReactNode }) {
  const { locale } = useLocale();
  const tooltipTriggerRef = useRef<HTMLSpanElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{translateRuntimeText(label, locale)}</p>
        {tooltip ? (
          <span
            ref={tooltipTriggerRef}
            className="inline-flex"
            onBlur={() => setTooltipOpen(false)}
            onFocus={() => setTooltipOpen(true)}
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
            tabIndex={0}
          >
            <span className="inline-flex items-center justify-center text-slate-300 outline-none">
              <IconInfoCircle className="size-3.5" stroke={1.8} />
            </span>
            <FloatingTooltip
              open={tooltipOpen}
              anchorRef={tooltipTriggerRef}
              className="w-[260px] whitespace-normal bg-slate-800 leading-5 text-white"
            >
              {tooltip}
            </FloatingTooltip>
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
      {subtext ? <p className="mt-1 text-sm text-slate-500">{subtext}</p> : null}
    </div>
  );
}

export default function EvmAddressPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const accountMessages = messages.cosmosAccountDetail;
  const nameTagMessages = messages.nameTags;
  const txMessages = messages.evmTxDetail;
  const contractMessages = messages.contractRegistry;
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
          setErrorMessage(error instanceof Error ? error.message : accountMessages.failedToLoadFallback);
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
      setBindingError(translateRuntimeText('Current provider environment is unavailable.', locale));
      return;
    }

    const selectedArtifactId = bindingArtifactId.trim();

    if (!selectedArtifactId) {
      setBindingError(translateRuntimeText('Select a saved artifact first.', locale));
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

      setBindingError(error instanceof Error ? error.message : messages.contractRegistry.failedToSaveContractBinding);
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
          <h1>{accountMessages.invalidAccountAddressTitle}</h1>
          <p>{accountMessages.invalidAccountAddressDescription}</p>
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
          <h1>{accountMessages.failedToLoadTitle}</h1>
          <p>{translateRuntimeText(errorMessage, locale)}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="section-block">
        <div className="mb-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.navigation.address}</h1>
            <span className="text-sm font-medium text-slate-500 mono">{summary.address}</span>
            <ActionIconButton tooltip={nameTag ? accountMessages.editTag : accountMessages.addTag} className="text-slate-400 hover:text-sky-600" onClick={openTagDialog}>
              <IconTag className="size-4" stroke={1.8} />
            </ActionIconButton>
            <ActionIconButton tooltip={contractBinding ? contractMessages.editBindingTitle : contractMessages.bindContractAddress} className="text-slate-400 hover:text-sky-600" onClick={openBindingDialog}>
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
                <AddressMetric label={messages.common.nonce} value={summary.nonce.toLocaleString(locale)} />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.latestSeen}
                  value={
                    latestSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={latestSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      messages.common.notCachedYet
                    )
                  }
                  tooltip={latestSeenTransaction ? messages.common.latestSeenTooltip : messages.common.populateLocalCache}
                />
              </div>
              <div className="border-b border-slate-200 p-5">
                <AddressMetric
                  label={messages.common.firstSeen}
                  value={
                    firstSeenTransaction ? (
                      <span className="text-base font-semibold text-slate-900">
                        <RelativeTime timestampMs={firstSeenTransaction.timestampMs} />
                      </span>
                    ) : (
                      messages.common.notCachedYet
                    )
                  }
                  tooltip={messages.common.firstSeenTooltip}
                />
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.observedTransactions}
                  value={addressCacheSnapshot.totalTransactions.toLocaleString(locale)}
                  tooltip={messages.common.latestCachedRecords.replace('{count}', String(visibleTransactions.length))}
                />
              </div>
              <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
                <AddressMetric
                  label={messages.common.directions}
                  value={translateRuntimeText(`${inboundCount} ${messages.common.in} / ${outboundCount} ${messages.common.out} / ${selfCount} ${messages.common.self}`, locale)}
                />
              </div>
              <div className="p-5 sm:border-r xl:border-r">
                <AddressMetric
                  label={messages.common.cachedTransactionsLabel}
                  value={addressCacheSnapshot.totalTransactions.toLocaleString(locale)}
                  tooltip={messages.common.cacheCapDescription.replace('{count}', MAX_CACHED_EVM_TRANSACTIONS.toLocaleString(locale))}
                />
              </div>
              <div className="p-5">
                <AddressMetric
                  label={messages.common.addressCoverage}
                  value={
                    addressCacheSnapshot.totalTransactions
                      ? translateRuntimeText(`${addressCacheSnapshot.totalTransactions} ${messages.common.matched}`, locale)
                      : messages.common.noCachedMatches
                  }
                  tooltip={messages.common.recentBlockQueriesCached}
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
            {messages.labels.transactions}
          </button>
          {contractBinding && contractArtifact && contractEnvironment ? (
            <button
              type="button"
              className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${resolvedActiveTab === 'contract' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              onClick={() => navigateToTab('contract')}
            >
              {txMessages.contract}
            </button>
          ) : null}
        </div>

        {resolvedActiveTab === 'transactions' ? (
          <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {messages.common.cachedTransactionsSummary
                    .replace('{visible}', String(visibleTransactions.length))
                    .replace('{total}', addressCacheSnapshot.totalTransactions.toLocaleString(locale))}
                </p>
                <p className="mt-1 text-sm text-slate-500">{messages.evmTxDetail.derivedFromCachedParticipants}</p>
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
                    <th className="border-b border-slate-200 pl-5 pr-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.hash}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.method}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.block}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.age}</th>
                    <th className="w-[44px] border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.direction}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.from}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.common.to}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.amount}</th>
                    <th className="border-b border-slate-200 px-1 py-3 text-left text-[13px] font-semibold text-slate-800">{txMessages.txnFee}</th>
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
                            <span className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-1 text-xs font-semibold ${direction.className}`}>
                              {direction.label === 'in' ? messages.common.in : direction.label === 'out' ? messages.common.out : messages.common.self}
                            </span>
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
                              <span className="text-slate-500">{txMessages.contractCreation}</span>
                            )}
                          </td>
                          <td className="px-1 py-3 text-sm font-medium tabular-nums text-slate-900">{translateRuntimeText(transaction.amountLabel, locale)}</td>
                          <td className="px-1 py-3 text-sm tabular-nums text-slate-500">
                            {transaction.feeLabel ? translateRuntimeText(transaction.feeLabel, locale) : <span className="text-slate-400">--</span>}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-1 py-10 text-center text-sm text-slate-500">
                        {txMessages.noCachedTransactionsAvailableYet}
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
          title={nameTag ? nameTagMessages.editTooltip : accountMessages.addTag}
          description={`${nameTagMessages.setLabelForAddress} ${address}.`}
          footer={
            <>
              {nameTag ? (
                <Button type="button" variant="outline" onClick={handleRemoveTag}>
                  {nameTagMessages.remove}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setTagDialogOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={handleSaveTag}>
                {nameTagMessages.save}
              </Button>
            </>
          }
          maxWidthClassName="max-w-lg"
        >
          <label className="grid gap-2 pb-1">
            <span className="text-sm font-medium text-slate-700">{messages.labels.tag}</span>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder={nameTagMessages.nameTagPlaceholder} />
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
          title={contractBinding ? contractMessages.editBindingTitle : contractMessages.bindContractAddressTitle}
          description={contractMessages.description}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setBindingDialogOpen(false)}>
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSaveBinding()} disabled={!artifacts.length}>
                {contractMessages.saveBinding}
              </Button>
            </>
          }
          maxWidthClassName="max-w-xl"
        >
          <div className="grid gap-4 pb-1">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.navigation.registry}</span>
              <Select value={bindingArtifactId} onValueChange={handleBindingArtifactChange} disabled={!artifacts.length}>
                <SelectTrigger>
                  <SelectValue placeholder={artifacts.length ? messages.navigation.registry : contractMessages.noPersonalArtifacts} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {artifacts.map((artifact) => (
                    <SelectItem key={artifact.id} value={artifact.id}>
                      {artifact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.labels.tag}</span>
              <Input value={bindingLabelInput} onChange={(event) => setBindingLabelInput(event.target.value)} placeholder={contractMessages.bindingLabelPlaceholder} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">{messages.labels.address}</span>
              <Input value={address} readOnly className="bg-slate-50 text-slate-500" />
            </label>

            {bindingError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{translateRuntimeText(bindingError, locale)}</div> : null}
            {!artifacts.length ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                {contractMessages.noPersonalArtifacts}
              </div>
            ) : null}
          </div>
        </ModalDialog>
      </main>
    </AppShell>
  );
}
