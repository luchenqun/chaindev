'use client';

import { IconSearch } from '@tabler/icons-react';
import { load as loadYaml } from 'js-yaml';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { JsonViewPanel } from '@/components/ui/json-view-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';
import { AppShell } from '@/platform/layout/app-shell';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const API_SPECS = [
  { value: 'cosmos', label: 'Cosmos SDK', file: '/cosmos.yaml', baseUrl: 'rest' },
  { value: 'quarix', label: 'Quarix', file: '/quarix.yaml', baseUrl: 'rest' },
  { value: 'cometbft', label: 'CometBFT', file: '/cometbft.yaml', baseUrl: 'rpc' },
] as const;
const bodyTextareaClassName =
  'min-h-28 w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100';

type HttpMethod = (typeof HTTP_METHODS)[number];
type ApiSpecValue = (typeof API_SPECS)[number]['value'];
type ApiBaseUrl = (typeof API_SPECS)[number]['baseUrl'];
type SwaggerParameter = {
  $ref?: string;
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  type?: string;
  schema?: unknown;
};
type SwaggerOperation = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
};
type SwaggerPathItem = Partial<Record<HttpMethod, SwaggerOperation>>;
type SwaggerDocument = {
  paths?: Record<string, SwaggerPathItem>;
  parameters?: Record<string, SwaggerParameter>;
};
type RestEndpoint = {
  id: string;
  path: string;
  method: HttpMethod;
  module: string;
  summary: string;
  operationId: string;
  pathParameters: SwaggerParameter[];
  queryParameters: SwaggerParameter[];
  bodyParameter: SwaggerParameter | null;
};
type FieldErrors = Record<string, string>;

function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.includes(value as HttpMethod);
}

function inferModule(path: string) {
  const parts = path.split('/').filter(Boolean);

  return parts[1] ?? parts[0] ?? 'cosmos';
}

function normalizeSwaggerDocument(value: unknown): SwaggerDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as SwaggerDocument;
}

function resolveSwaggerParameter(document: SwaggerDocument, parameter: SwaggerParameter) {
  if (!parameter.$ref) {
    return parameter;
  }

  const prefix = '#/parameters/';

  if (!parameter.$ref.startsWith(prefix)) {
    return parameter;
  }

  return document.parameters?.[parameter.$ref.slice(prefix.length)] ?? parameter;
}

function createEndpoints(document: SwaggerDocument) {
  const endpoints: RestEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method) || !operation) {
        continue;
      }

      const parameters = (operation.parameters ?? []).map((parameter) => resolveSwaggerParameter(document, parameter));

      endpoints.push({
        id: `${method.toUpperCase()} ${path}`,
        path,
        method,
        module: operation.tags?.[0] && operation.tags[0] !== 'Query' && operation.tags[0] !== 'Service' ? operation.tags[0] : inferModule(path),
        summary: operation.summary ?? operation.description ?? operation.operationId ?? path,
        operationId: operation.operationId ?? '',
        pathParameters: parameters.filter((parameter) => parameter.in === 'path'),
        queryParameters: parameters.filter((parameter) => parameter.in === 'query'),
        bodyParameter: parameters.find((parameter) => parameter.in === 'body') ?? null,
      });
    }
  }

  return endpoints.sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
}

function createBodyTemplate(endpoint: RestEndpoint | null) {
  if (!endpoint?.bodyParameter) {
    return '{}';
  }

  const schema = endpoint.bodyParameter.schema;

  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return '{}';
  }

  const properties = (schema as { properties?: Record<string, unknown> }).properties ?? {};
  const template = Object.fromEntries(Object.keys(properties).map((key) => [key, '']));

  return JSON.stringify(template, null, 2);
}

function replacePathParameters(path: string, values: Record<string, string>) {
  return path.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const value = values[name]?.trim();

    return value ? encodeURIComponent(value) : match;
  });
}

function buildEndpointPath(endpoint: RestEndpoint, pathValues: Record<string, string>, queryValues: Record<string, string>) {
  const pathname = replacePathParameters(endpoint.path, pathValues);
  const searchParams = new URLSearchParams();

  for (const parameter of endpoint.queryParameters) {
    const name = parameter.name?.trim();
    const value = name ? queryValues[name]?.trim() : '';

    if (name && value) {
      searchParams.set(name, value);
    }
  }

  const queryString = searchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

function validatePathParameters(endpoint: RestEndpoint, pathValues: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};

  for (const parameter of endpoint.pathParameters) {
    const name = parameter.name?.trim();

    if (name && !pathValues[name]?.trim()) {
      errors[`path:${name}`] = `${name} is required.`;
    }
  }

  return errors;
}

function validateQueryParameters(endpoint: RestEndpoint, queryValues: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};

  for (const parameter of endpoint.queryParameters) {
    const name = parameter.name?.trim();

    if (name && parameter.required && !queryValues[name]?.trim()) {
      errors[`query:${name}`] = `${name} is required.`;
    }
  }

  return errors;
}

function validateBodyParameter(endpoint: RestEndpoint, bodyJson: string): FieldErrors {
  if (!endpoint.bodyParameter?.required) {
    return {};
  }

  if (!bodyJson.trim() || bodyJson.trim() === '{}') {
    return { body: 'Body is required.' };
  }

  return {};
}

async function requestCosmosRestDirect(input: { endpointPath: string; method: HttpMethod; bodyJson: string; baseUrl: ApiBaseUrl }) {
  const profile = getActiveCosmosProvider();
  const target = `${input.baseUrl === 'rpc' ? profile.rpcUrl : profile.restUrl}${input.endpointPath}`;
  const shouldSendBody = input.method !== 'get' && input.method !== 'delete';
  const response = await fetch(target, {
    method: input.method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
    },
    body: shouldSendBody ? input.bodyJson : undefined,
  });
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as unknown;

    if (input.baseUrl === 'rpc' && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'result' in parsed) {
      return (parsed as { result: unknown }).result;
    }

    return parsed;
  } catch {
    return text;
  }
}

export default function CosmosRestToolPage() {
  const [endpoints, setEndpoints] = useState<RestEndpoint[]>([]);
  const [apiSpec, setApiSpec] = useState<ApiSpecValue>('cosmos');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [search, setSearch] = useState('');
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [bodyJson, setBodyJson] = useState('{}');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const selectedEndpoint = useMemo(() => endpoints.find((endpoint) => endpoint.id === selectedEndpointId) ?? null, [endpoints, selectedEndpointId]);
  const selectedApiSpec = API_SPECS.find((item) => item.value === apiSpec) ?? API_SPECS[0];
  const filteredEndpoints = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return endpoints;
    }

    return endpoints.filter((endpoint) => {
      return `${endpoint.method} ${endpoint.path} ${endpoint.summary} ${endpoint.operationId} ${endpoint.module}`.toLowerCase().includes(normalizedSearch);
    });
  }, [endpoints, search]);
  const endpointPath = selectedEndpoint ? buildEndpointPath(selectedEndpoint, pathValues, queryValues) : '';

  useEffect(() => {
    let disposed = false;

    async function loadSwagger() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(selectedApiSpec.file, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Failed to load ${selectedApiSpec.file}: ${response.status}`);
        }

        const document = normalizeSwaggerDocument(loadYaml(await response.text()));
        const nextEndpoints = createEndpoints(document);

        if (disposed) {
          return;
        }

        setEndpoints(nextEndpoints);
        setSelectedEndpointId(nextEndpoints[0]?.id ?? '');
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : `Failed to load ${selectedApiSpec.file}.`);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadSwagger();

    return () => {
      disposed = true;
    };
  }, [selectedApiSpec.file]);

  useEffect(() => {
    setPathValues({});
    setQueryValues({});
    setBodyJson(createBodyTemplate(selectedEndpoint));
    setResult(null);
    setError(null);
    setFieldErrors({});
  }, [selectedEndpoint]);

  async function handleRun() {
    if (!selectedEndpoint) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    setFieldErrors({});

    try {
      const nextFieldErrors = {
        ...validatePathParameters(selectedEndpoint, pathValues),
        ...validateQueryParameters(selectedEndpoint, queryValues),
        ...validateBodyParameter(selectedEndpoint, bodyJson),
      };

      if (Object.keys(nextFieldErrors).length) {
        setFieldErrors(nextFieldErrors);
        return;
      }

      if (selectedEndpoint.bodyParameter) {
        JSON.parse(bodyJson);
      }

      const response = await requestCosmosRestDirect({
        endpointPath,
        method: selectedEndpoint.method,
        bodyJson,
        baseUrl: selectedApiSpec.baseUrl,
      });

      setResult(response && typeof response === 'object' && !Array.isArray(response) ? (response as Record<string, unknown>) : { result: response });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to execute REST request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell mode="cosmos">
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex min-w-0 items-baseline justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="shrink-0 text-2xl font-semibold text-slate-950">REST API</h1>
                <p className="min-w-0 truncate text-sm text-slate-500">Call endpoints generated from YAML specs.</p>
              </div>
              <span className="shrink-0 text-sm text-slate-500">{loading ? 'Loading...' : `${endpoints.length} endpoints`}</span>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 lg:border-r lg:border-b-0">
              <div className="space-y-3 border-b border-slate-200 p-4">
                <Select value={apiSpec} onValueChange={(value) => setApiSpec(value as ApiSpecValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_SPECS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" stroke={1.8} />
                  <Input value={search} placeholder="Search endpoint" className="pl-9" onChange={(event) => setSearch(event.target.value)} />
                </div>
              </div>
              <div className="max-h-[720px] overflow-y-auto p-2">
                {filteredEndpoints.map((endpoint) => {
                  const active = endpoint.id === selectedEndpointId;

                  return (
                    <button
                      key={endpoint.id}
                      type="button"
                      className={
                        active
                          ? 'block w-full rounded-xl bg-sky-50 px-3 py-2.5 text-left text-sky-700'
                          : 'block w-full rounded-xl px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                      }
                      onClick={() => setSelectedEndpointId(endpoint.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase text-slate-600">{endpoint.method}</span>
                        <span className="min-w-0 truncate text-sm font-medium">{endpoint.operationId || endpoint.module}</span>
                      </span>
                      <span className="mt-1 block truncate font-mono text-xs text-slate-500">{endpoint.path}</span>
                    </button>
                  );
                })}
                {!filteredEndpoints.length ? <div className="px-3 py-8 text-center text-sm text-slate-500">No endpoints found.</div> : null}
              </div>
            </aside>

            <section className="min-w-0 p-6">
              {selectedEndpoint ? (
                <div className="space-y-5">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold uppercase text-slate-700">{selectedEndpoint.method}</span>
                      <span className="truncate font-mono text-sm text-slate-700">{selectedEndpoint.path}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950">{selectedEndpoint.operationId || selectedEndpoint.summary}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedEndpoint.summary}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="rest-endpoint">
                      Endpoint
                    </label>
                    <Input id="rest-endpoint" value={endpointPath} readOnly className="mt-1 font-mono text-sm" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedEndpoint.pathParameters.map((parameter) => {
                      const name = parameter.name ?? '';
                      const fieldError = fieldErrors[`path:${name}`];

                      return (
                        <div key={`path-${name}`}>
                          <label className="block text-sm font-medium text-slate-700" htmlFor={`path-${name}`}>
                            {name} <span className="text-rose-500">*</span> <span className="text-slate-400">(path)</span>
                          </label>
                          <Input
                            id={`path-${name}`}
                            value={pathValues[name] ?? ''}
                            placeholder={parameter.type ?? 'string'}
                            className={fieldError ? 'mt-1 border-rose-300 focus-visible:ring-rose-200' : 'mt-1'}
                            onChange={(event) => setPathValues((current) => ({ ...current, [name]: event.target.value }))}
                          />
                          {fieldError ? <p className="mt-1 text-xs text-rose-600">{fieldError}</p> : null}
                        </div>
                      );
                    })}

                    {selectedEndpoint.queryParameters.map((parameter) => {
                      const name = parameter.name ?? '';
                      const fieldError = fieldErrors[`query:${name}`];

                      return (
                        <div key={`query-${name}`}>
                          <label className="block text-sm font-medium text-slate-700" htmlFor={`query-${name}`}>
                            {name} {parameter.required ? <span className="text-rose-500">*</span> : null} <span className="text-slate-400">(query)</span>
                          </label>
                          <Input
                            id={`query-${name}`}
                            value={queryValues[name] ?? ''}
                            placeholder={parameter.type ?? 'string'}
                            className={fieldError ? 'mt-1 border-rose-300 focus-visible:ring-rose-200' : 'mt-1'}
                            onChange={(event) => setQueryValues((current) => ({ ...current, [name]: event.target.value }))}
                          />
                          {fieldError ? <p className="mt-1 text-xs text-rose-600">{fieldError}</p> : null}
                        </div>
                      );
                    })}
                  </div>

                  {selectedEndpoint.bodyParameter ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Body {selectedEndpoint.bodyParameter.required ? <span className="text-rose-500">*</span> : null}</label>
                      <JsonInput
                        value={bodyJson}
                        onChange={setBodyJson}
                        textareaClassName={`mt-1 ${bodyTextareaClassName} ${fieldErrors.body ? 'border-rose-300 focus:border-rose-300 focus:ring-rose-100' : ''}`}
                      />
                      {fieldErrors.body ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.body}</p> : null}
                    </div>
                  ) : null}

                  {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

                  <div className="flex justify-end border-t border-slate-200 pt-4">
                    <Button type="button" disabled={submitting || loading} onClick={() => void handleRun()}>
                      {submitting ? 'Running...' : 'Run'}
                    </Button>
                  </div>

                  {result ? (
                    <div className="border-t border-slate-200 pt-4">
                      <JsonViewPanel className="max-h-[900px] overflow-y-auto overflow-x-hidden bg-slate-50 shadow-none" jsonClassName="whitespace-pre-wrap break-all" value={result} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  {loading ? `Loading ${selectedApiSpec.file}...` : 'No REST endpoints available.'}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
