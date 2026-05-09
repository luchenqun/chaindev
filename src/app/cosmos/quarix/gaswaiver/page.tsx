'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { ListPageSkeleton } from '@/components/ui/loading-placeholders';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';

type QueryState = {
  loading: boolean;
  error: string | null;
  data: unknown;
};

type QueryCardProps = {
  title: string;
  description?: string;
  fields?: ReactNode;
  actionLabel: string;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  data: unknown;
  emptyMessage: string;
  resultSummary?: string | null;
  loadingLabel: string;
};

const INITIAL_QUERY_STATE: QueryState = {
  loading: false,
  error: null,
  data: null,
};

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      continue;
    }

    params.set(key, normalizedValue);
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

async function requestQuarixGasWaiver(path: string) {
  const profile = getActiveCosmosProvider();
  const response = await fetch(`${profile.restUrl}${path}`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return (await response.json()) as unknown;
}

function createLoadedSummary(value: unknown, countLabel: string, keyLabel: string) {
  if (Array.isArray(value)) {
    return countLabel.replace('{count}', String(value.length));
  }

  if (value && typeof value === 'object') {
    return keyLabel.replace('{count}', String(Object.keys(value as Record<string, unknown>).length));
  }

  return null;
}

function QueryCard({ title, description, fields, actionLabel, onSubmit, loading, error, data, emptyMessage, resultSummary, loadingLabel }: QueryCardProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-2 text-[15px] leading-7 text-slate-500">{description}</p> : null}
          </div>
          <Button type="button" variant="secondary" className="h-10 gap-2 whitespace-nowrap" disabled={loading} onClick={onSubmit}>
            <IconSearch className="size-4" stroke={1.8} />
            {actionLabel}
          </Button>
        </div>
        {fields ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{fields}</div> : null}
      </div>
      <div className="px-6 py-5">
        {loading ? <div className="text-sm text-slate-500">{loadingLabel}</div> : null}
        {!loading && error ? <div className="text-sm text-rose-600">{error}</div> : null}
        {!loading && !error && data == null ? <div className="text-sm text-slate-500">{emptyMessage}</div> : null}
        {!loading && !error && data != null ? (
          <div className="space-y-3">
            {resultSummary ? <div className="text-sm text-slate-500">{resultSummary}</div> : null}
            <JsonViewPanel value={data as object} className="border-0 p-0 shadow-none" controlsClassName="right-0 top-0" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function QuarixGasWaiverPage() {
  const messages = useMessages();
  const { locale } = useLocale();
  const pageMessages = messages.quarixGasWaiver;
  const [paramsState, setParamsState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [granterInfoState, setGranterInfoState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [normalWaiverState, setNormalWaiverState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [normalMeterState, setNormalMeterState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [premiumWaiverState, setPremiumWaiverState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [premiumMeterState, setPremiumMeterState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [applicationsState, setApplicationsState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [normalWaiversState, setNormalWaiversState] = useState<QueryState>(INITIAL_QUERY_STATE);
  const [contractForGranterInfo, setContractForGranterInfo] = useState('');
  const [contractForNormalWaiver, setContractForNormalWaiver] = useState('');
  const [contractForNormalMeter, setContractForNormalMeter] = useState('');
  const [granteeForNormalMeter, setGranteeForNormalMeter] = useState('');
  const [contractForPremiumWaiver, setContractForPremiumWaiver] = useState('');
  const [granteeForPremiumWaiver, setGranteeForPremiumWaiver] = useState('');
  const [contractForPremiumMeter, setContractForPremiumMeter] = useState('');
  const [granteeForPremiumMeter, setGranteeForPremiumMeter] = useState('');
  const [applicationsGranter, setApplicationsGranter] = useState('');
  const [applicationsOwner, setApplicationsOwner] = useState('');
  const [applicationsLimit, setApplicationsLimit] = useState('20');
  const [normalWaiversOwner, setNormalWaiversOwner] = useState('');
  const [normalWaiversLimit, setNormalWaiversLimit] = useState('20');

  async function runQuery(setter: Dispatch<SetStateAction<QueryState>>, path: string) {
    setter((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const next = await requestQuarixGasWaiver(path);
      setter({
        loading: false,
        error: null,
        data: next,
      });
    } catch (error) {
      setter({
        loading: false,
        error: error instanceof Error ? error.message : pageMessages.failedToLoadFallback,
        data: null,
      });
    }
  }

  useEffect(() => {
    void runQuery(setParamsState, '/quarix/gaswaiver/v1/params');
    const handleActiveRpcProfileChanged = () => {
      void runQuery(setParamsState, '/quarix/gaswaiver/v1/params');
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);

    return () => {
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleActiveRpcProfileChanged);
    };
  }, []);

  const paramsSummary = useMemo(
    () => createLoadedSummary(paramsState.data, pageMessages.loadedItemCount, pageMessages.loadedKeyCount),
    [pageMessages.loadedItemCount, pageMessages.loadedKeyCount, paramsState.data],
  );
  const applicationsSummary = useMemo(
    () => createLoadedSummary(applicationsState.data, pageMessages.loadedItemCount, pageMessages.loadedKeyCount),
    [applicationsState.data, pageMessages.loadedItemCount, pageMessages.loadedKeyCount],
  );
  const normalWaiversSummary = useMemo(
    () => createLoadedSummary(normalWaiversState.data, pageMessages.loadedItemCount, pageMessages.loadedKeyCount),
    [normalWaiversState.data, pageMessages.loadedItemCount, pageMessages.loadedKeyCount],
  );

  return (
    <AppShell mode="cosmos">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pb-10 pt-6">
        <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950">{pageMessages.title}</h1>
                <p className="mt-2 text-[15px] leading-7 text-slate-500">{pageMessages.description}</p>
              </div>
              <ActionIconButton tooltip={messages.common.refresh} className="text-slate-400 hover:text-sky-600" onClick={() => void runQuery(setParamsState, '/quarix/gaswaiver/v1/params')}>
                <IconRefresh className="size-4" stroke={1.8} />
              </ActionIconButton>
            </div>
          </div>
        </section>

        {paramsState.loading && paramsState.data == null ? <ListPageSkeleton titleWidth="w-32" metricCards={0} columns={3} toolbarIcons={1} /> : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <QueryCard
            title={pageMessages.params}
            actionLabel={pageMessages.refresh}
            onSubmit={() => void runQuery(setParamsState, '/quarix/gaswaiver/v1/params')}
            loading={paramsState.loading}
            error={paramsState.error ? translateRuntimeText(paramsState.error, locale) : null}
            data={paramsState.data}
            emptyMessage={pageMessages.noResponseYet}
            resultSummary={paramsSummary}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.granterInfo}
            actionLabel={pageMessages.query}
            fields={<Field label={pageMessages.contract} value={contractForGranterInfo} onChange={setContractForGranterInfo} />}
            onSubmit={() => void runQuery(setGranterInfoState, `/quarix/gaswaiver/v1/gas_waiver_granter_info${buildQueryString({ contract: contractForGranterInfo })}`)}
            loading={granterInfoState.loading}
            error={granterInfoState.error ? translateRuntimeText(granterInfoState.error, locale) : null}
            data={granterInfoState.data}
            emptyMessage={pageMessages.noResponseYet}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.normalGasWaiver}
            actionLabel={pageMessages.query}
            fields={<Field label={pageMessages.contract} value={contractForNormalWaiver} onChange={setContractForNormalWaiver} />}
            onSubmit={() => void runQuery(setNormalWaiverState, `/quarix/gaswaiver/v1/normal_gas_waiver${buildQueryString({ contract: contractForNormalWaiver })}`)}
            loading={normalWaiverState.loading}
            error={normalWaiverState.error ? translateRuntimeText(normalWaiverState.error, locale) : null}
            data={normalWaiverState.data}
            emptyMessage={pageMessages.noResponseYet}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.normalGasWaiverMeter}
            actionLabel={pageMessages.query}
            fields={
              <>
                <Field label={pageMessages.grantee} value={granteeForNormalMeter} onChange={setGranteeForNormalMeter} />
                <Field label={pageMessages.contract} value={contractForNormalMeter} onChange={setContractForNormalMeter} />
              </>
            }
            onSubmit={() =>
              void runQuery(
                setNormalMeterState,
                `/quarix/gaswaiver/v1/normal_gas_waiver_meter${buildQueryString({ grantee: granteeForNormalMeter, contract: contractForNormalMeter })}`,
              )
            }
            loading={normalMeterState.loading}
            error={normalMeterState.error ? translateRuntimeText(normalMeterState.error, locale) : null}
            data={normalMeterState.data}
            emptyMessage={pageMessages.noResponseYet}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.premiumGasWaiver}
            actionLabel={pageMessages.query}
            fields={
              <>
                <Field label={pageMessages.grantee} value={granteeForPremiumWaiver} onChange={setGranteeForPremiumWaiver} />
                <Field label={pageMessages.contract} value={contractForPremiumWaiver} onChange={setContractForPremiumWaiver} />
              </>
            }
            onSubmit={() =>
              void runQuery(
                setPremiumWaiverState,
                `/quarix/gaswaiver/v1/premium_gas_waiver${buildQueryString({ grantee: granteeForPremiumWaiver, contract: contractForPremiumWaiver })}`,
              )
            }
            loading={premiumWaiverState.loading}
            error={premiumWaiverState.error ? translateRuntimeText(premiumWaiverState.error, locale) : null}
            data={premiumWaiverState.data}
            emptyMessage={pageMessages.noResponseYet}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.premiumGasWaiverMeter}
            actionLabel={pageMessages.query}
            fields={
              <>
                <Field label={pageMessages.grantee} value={granteeForPremiumMeter} onChange={setGranteeForPremiumMeter} />
                <Field label={pageMessages.contract} value={contractForPremiumMeter} onChange={setContractForPremiumMeter} />
              </>
            }
            onSubmit={() =>
              void runQuery(
                setPremiumMeterState,
                `/quarix/gaswaiver/v1/premium_gas_waiver_meter${buildQueryString({ grantee: granteeForPremiumMeter, contract: contractForPremiumMeter })}`,
              )
            }
            loading={premiumMeterState.loading}
            error={premiumMeterState.error ? translateRuntimeText(premiumMeterState.error, locale) : null}
            data={premiumMeterState.data}
            emptyMessage={pageMessages.noResponseYet}
            loadingLabel={messages.common.running}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <QueryCard
            title={pageMessages.applications}
            actionLabel={pageMessages.query}
            fields={
              <>
                <Field label={pageMessages.granter} value={applicationsGranter} onChange={setApplicationsGranter} />
                <Field label={pageMessages.owner} value={applicationsOwner} onChange={setApplicationsOwner} />
                <Field label={pageMessages.limit} value={applicationsLimit} onChange={setApplicationsLimit} />
              </>
            }
            onSubmit={() =>
              void runQuery(
                setApplicationsState,
                `/quarix/gaswaiver/v1/gas_waiver_applications${buildQueryString({
                  granter: applicationsGranter,
                  owner: applicationsOwner,
                  'pagination.limit': applicationsLimit,
                })}`,
              )
            }
            loading={applicationsState.loading}
            error={applicationsState.error ? translateRuntimeText(applicationsState.error, locale) : null}
            data={applicationsState.data}
            emptyMessage={pageMessages.noResponseYet}
            resultSummary={applicationsSummary}
            loadingLabel={messages.common.running}
          />

          <QueryCard
            title={pageMessages.normalGasWaivers}
            actionLabel={pageMessages.query}
            fields={
              <>
                <Field label={pageMessages.owner} value={normalWaiversOwner} onChange={setNormalWaiversOwner} />
                <Field label={pageMessages.limit} value={normalWaiversLimit} onChange={setNormalWaiversLimit} />
              </>
            }
            onSubmit={() =>
              void runQuery(
                setNormalWaiversState,
                `/quarix/gaswaiver/v1/normal_gas_waivers${buildQueryString({
                  owner: normalWaiversOwner,
                  'pagination.limit': normalWaiversLimit,
                })}`,
              )
            }
            loading={normalWaiversState.loading}
            error={normalWaiversState.error ? translateRuntimeText(normalWaiversState.error, locale) : null}
            data={normalWaiversState.data}
            emptyMessage={pageMessages.noResponseYet}
            resultSummary={normalWaiversSummary}
            loadingLabel={messages.common.running}
          />
        </div>
      </div>
    </AppShell>
  );
}
