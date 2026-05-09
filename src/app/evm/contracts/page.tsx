'use client';

import { IconListDetails, IconEdit, IconLinkPlus, IconLoader2, IconPlugConnected, IconRocket, IconTrash, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAddress, toEventSelector, toFunctionSelector, type Abi, type AbiEvent, type AbiParameter } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FloatingTooltip } from '@/components/ui/floating-tooltip';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { formatLocalizedDateTime } from '@/i18n/format';
import { getContractConstructor, getContractFunctions, parseContractAbiJson } from '@/domains/evm/client/abi-utils';
import {
  createEvmContractArtifact,
  createEvmContractBinding,
  deleteEvmContractArtifact,
  deleteEvmContractBinding,
  isGeneratedDefaultEvmContractBinding,
  listEvmContractArtifacts,
  listEvmContractBindingsByScope,
  parseEvmContractArtifactImportPayload,
  subscribeEvmContractRegistry,
  syncEvmContractRegistryFromServer,
  updateEvmContractArtifact,
  updateEvmContractBinding,
  type EvmContractArtifact,
  type EvmContractBinding,
} from '@/domains/evm/client/contract-registry';
import { forceDeployEvmContractDirect, getActiveEvmContractEnvironmentDirect, getEvmContractDeployManualDefaultsDirect } from '@/domains/evm/client/contract-executor';
import { getArtifactDefaultAddressByName } from '@/domains/evm/lib/precompile-artifact-default-addresses';
import {
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  peekEvmStoredPrivateKey,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from '@/domains/evm/client/keyring';
import { AddressLink } from '@/domains/evm/ui/address-link';
import { useLocale, useMessages } from '@/i18n/locale-provider';
import { translateRuntimeText } from '@/i18n/runtime-translations';
import { AppShell } from '@/platform/layout/app-shell';
import { AccountWorkbenchShell } from '@/platform/layout/account-workbench-shell';

const textareaClassName =
  'min-h-32 w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';
const importTextareaClassName =
  'min-h-24 max-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400';
type EnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
} | null;

type DeployTransactionType = 'LEGACY' | 'EIP1559';

type DeployDialogState = {
  transactionType: DeployTransactionType;
  value: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasLimit: string;
  nonce: string;
};

type ArtifactDetailsCategory = 'read' | 'write' | 'event';

type ArtifactDetailsItem = {
  category: ArtifactDetailsCategory;
  signature: string;
  methodId: string;
  badgeLabel: string;
};

function hasTupleComponents(parameter: AbiParameter): parameter is AbiParameter & { components: readonly AbiParameter[] } {
  return 'components' in parameter && Array.isArray(parameter.components);
}

function getCanonicalAbiParameterType(parameter: AbiParameter): string {
  if (!parameter.type.endsWith(']')) {
    if (parameter.type !== 'tuple') {
      return parameter.type;
    }

    const components = hasTupleComponents(parameter) ? parameter.components : [];
    return `(${components.map(getCanonicalAbiParameterType).join(',')})`;
  }

  const arraySuffix = parameter.type.slice(parameter.type.indexOf('['));
  const baseParameter = {
    ...parameter,
    type: parameter.type.slice(0, parameter.type.indexOf('[')),
  } satisfies AbiParameter;

  return `${getCanonicalAbiParameterType(baseParameter)}${arraySuffix}`;
}

function isAbiEventItem(item: Abi[number] | unknown): item is AbiEvent {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'event' && 'name' in item;
}

function getEventSignature(event: AbiEvent) {
  return `${event.name}(${event.inputs.map(getCanonicalAbiParameterType).join(',')})`;
}

function createComplexParameterTemplateValue(parameter: AbiParameter): unknown {
  if (parameter.type.endsWith(']')) {
    const baseType = parameter.type.slice(0, parameter.type.lastIndexOf('['));
    const baseParameter = {
      ...parameter,
      type: baseType,
    } satisfies AbiParameter;

    return [createComplexParameterTemplateValue(baseParameter)];
  }

  if (parameter.type === 'tuple') {
    const components = hasTupleComponents(parameter) ? parameter.components : [];

    return Object.fromEntries(components.map((component, index) => [component.name || `field${index + 1}`, createComplexParameterTemplateValue(component)]));
  }

  if (parameter.type === 'bool') {
    return 'false';
  }

  if (/^u?int\d*$/.test(parameter.type)) {
    return '0';
  }

  if (parameter.type === 'address') {
    return '0x0000000000000000000000000000000000000000';
  }

  if (parameter.type === 'bytes' || /^bytes\d+$/.test(parameter.type)) {
    return '0x';
  }

  return '';
}

function getComplexParameterTemplate(parameter: AbiParameter) {
  return JSON.stringify(createComplexParameterTemplateValue(parameter), null, 2);
}

function getInitialArgumentValue(parameter: AbiParameter) {
  return parameter.type.includes('[') || parameter.type === 'tuple' ? getComplexParameterTemplate(parameter) : '';
}

function ContractInputsForm({ inputs, values, onChange }: { inputs: readonly AbiParameter[]; values: string[]; onChange: (index: number, value: string) => void }) {
  const messages = useMessages();

  if (!inputs.length) {
    return <p className="text-sm text-slate-500">{messages.contractPanel.noConstructorArguments}</p>;
  }

  return (
    <div className="grid gap-3">
      {inputs.map((input, index) => {
        const isComplex = input.type.includes('[') || input.type === 'tuple';
        const label = input.name || `arg${index + 1}`;

        return (
          <div key={`${label}-${input.type}-${index}`} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {label} <span className="text-slate-400">({input.type})</span>
            </label>
            {isComplex ? (
              <JsonInput
                value={values[index] ?? ''}
                onChange={(value) => onChange(index, value)}
                placeholder={getComplexParameterTemplate(input)}
                textareaClassName={textareaClassName}
              />
            ) : (
              <Input
                value={values[index] ?? ''}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={input.type === 'bool' ? messages.contractPanel.boolPlaceholder : input.type}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return formatLocalizedDateTime(timestamp, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function normalizeDeployErrorMessage(message: string, contractRegistryMessages: ReturnType<typeof useMessages>['contractRegistry']) {
  if (/only developer can create contract/i.test(message)) {
    return contractRegistryMessages.deployRejectedDeveloperOnly;
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `${contractRegistryMessages.deployFailedPrefix} ${rpcDescMatch[1].trim()}.`;
  }

  if (/Missing or invalid parameters\./i.test(message)) {
    return `${contractRegistryMessages.deployFailedPrefix} ${contractRegistryMessages.rpcRejectedRequestParameters}`;
  }

  return message;
}

function normalizeWorkbenchErrorMessage(message: string, fallback: string, contractRegistryMessages: ReturnType<typeof useMessages>['contractRegistry']) {
  if (/only developer can create contract/i.test(message)) {
    return contractRegistryMessages.deployRejectedDeveloperOnly;
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `${fallback} ${rpcDescMatch[1].trim()}.`;
  }

  if (/Missing or invalid parameters\./i.test(message)) {
    return `${fallback} ${contractRegistryMessages.rpcRejectedRequestParameters}`;
  }

  return message;
}

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function getDefaultBindingAddressForArtifact(artifact?: Pick<EvmContractArtifact, 'name'> | null) {
  if (!artifact) {
    return '';
  }

  return getArtifactDefaultAddressByName(artifact.name) ?? '';
}

function InteractContractLink({ href }: { href: string }) {
  const messages = useMessages();
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <span className="inline-flex">
      <Link
        ref={triggerRef}
        href={href}
        aria-label={messages.contractRegistry.interactWithContract}
        className="inline-flex items-center justify-center p-[3px] text-slate-400 transition hover:text-slate-700"
        onBlur={() => setTooltipOpen(false)}
        onFocus={() => setTooltipOpen(true)}
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        <IconLinkPlus className="size-4" stroke={1.8} />
      </Link>
      <FloatingTooltip open={tooltipOpen} anchorRef={triggerRef} className="whitespace-nowrap border border-slate-200 bg-white text-slate-700">
        {messages.contractRegistry.interactWithContract}
      </FloatingTooltip>
    </span>
  );
}

function createInitialDeployDialogState(): DeployDialogState {
  return {
    transactionType: 'EIP1559',
    value: '0',
    gasPrice: 'auto',
    maxFeePerGas: 'auto',
    maxPriorityFeePerGas: 'auto',
    gasLimit: '',
    nonce: 'auto',
  };
}

function isAutoFieldValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  return !normalizedValue || normalizedValue === 'auto';
}

function isValidNativeValueInput(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return false;
  }

  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizedValue);
}

function isDeployDialogReady(state: DeployDialogState) {
  if (!isValidNativeValueInput(state.value) || !state.gasLimit.trim()) {
    return false;
  }

  if (state.transactionType === 'LEGACY') {
    return !!state.gasPrice.trim();
  }

  return (
    (isAutoFieldValue(state.nonce) || !!state.nonce.trim()) &&
    (isAutoFieldValue(state.maxFeePerGas) || !!state.maxFeePerGas.trim()) &&
    (isAutoFieldValue(state.maxPriorityFeePerGas) || !!state.maxPriorityFeePerGas.trim())
  );
}

function areDeployConstructorArgsReady(inputs: readonly AbiParameter[], values: string[]) {
  return inputs.every((_, index) => !!values[index]?.trim());
}

function buildDeploySimulationKey(input: { artifactId: string | null; rawArgs: string[]; value: string }) {
  return JSON.stringify({
    artifactId: input.artifactId,
    rawArgs: input.rawArgs,
    value: input.value.trim(),
  });
}

export default function EvmContractsRegistryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const { locale } = useLocale();
  const messages = useMessages();
  const labelMessages = messages.labels;
  const contractRegistryMessages = messages.contractRegistry;
  const contractPanelMessages = messages.contractPanel;
  const [environment, setEnvironment] = useState<EnvironmentState>(null);
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [bindings, setBindings] = useState<EvmContractBinding[]>([]);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);
  const [artifactForm, setArtifactForm] = useState({
    id: null as string | null,
    scope: 'user' as 'system' | 'user',
    name: '',
    abiJson: '',
    bytecode: '',
    contractAddress: '',
  });
  const [artifactImportText, setArtifactImportText] = useState('');
  const [bindingForm, setBindingForm] = useState({
    id: null as string | null,
    artifactId: '',
    address: '',
    label: '',
  });
  const [artifactDetailsTarget, setArtifactDetailsTarget] = useState<EvmContractArtifact | null>(null);
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [deployArtifactId, setDeployArtifactId] = useState<string | null>(null);
  const [deployArgumentValues, setDeployArgumentValues] = useState<string[]>([]);
  const [deployDialogValues, setDeployDialogValues] = useState<DeployDialogState>(createInitialDeployDialogState());
  const [deployBindingLabel, setDeployBindingLabel] = useState('');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{
    hash: string;
    contractAddress: string;
    bindingId: string | null;
    bindingError: string | null;
  } | null>(null);
  const [deployActionLoading, setDeployActionLoading] = useState<'fill' | 'deploy' | null>(null);
  const [deployUnlockDialogOpen, setDeployUnlockDialogOpen] = useState(false);
  const [deployUnlockPassword, setDeployUnlockPassword] = useState('');
  const [deployUnlockError, setDeployUnlockError] = useState<string | null>(null);
  const [pendingDeployAction, setPendingDeployAction] = useState<'fill' | 'deploy' | null>(null);

  function goToLogin() {
    router.push('/login?callbackUrl=%2Fevm%2Fcontracts');
  }
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { type: 'artifact'; id: string; title: string; description: string } | { type: 'binding'; id: string; title: string; description: string } | null
  >(null);
  const environmentRef = useRef<EnvironmentState>(null);
  const deployDefaultsRequestIdRef = useRef(0);
  const deploySimulationFailureRef = useRef<{ key: string; attempts: number }>({
    key: '',
    attempts: 0,
  });

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    let cancelled = false;

    async function load() {
      if (status === 'authenticated') {
        try {
          await syncEvmContractRegistryFromServer();
        } catch (error) {
          if (!cancelled) {
            setArtifactError(error instanceof Error ? error.message : contractRegistryMessages.failedToLoadRegistry);
          }
        }
      }

      const nextEnvironment = await getActiveEvmContractEnvironmentDirect();

      if (cancelled) {
        return;
      }

      environmentRef.current = nextEnvironment;
      setEnvironment(nextEnvironment);
      setArtifacts(listEvmContractArtifacts());
      setBindings(listEvmContractBindingsByScope(nextEnvironment.chainId, nextEnvironment.providerProfileId, nextEnvironment.providerName));
    }

    void load();

    const unsubscribe = subscribeEvmContractRegistry(() => {
      setArtifacts(listEvmContractArtifacts());

      if (environmentRef.current) {
        setBindings(listEvmContractBindingsByScope(environmentRef.current.chainId, environmentRef.current.providerProfileId, environmentRef.current.providerName));
      }
    });

    const handleProfileChanged = () => {
      setArtifactError(null);
      setBindingError(null);
      setDeleteTarget(null);
      setArtifactDialogOpen(false);
      setBindingDialogOpen(false);
      setBindingForm({
        id: null,
        artifactId: '',
        address: '',
        label: '',
      });
      void load();
    };

    window.addEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('chaindev:active-rpc-profile-changed', handleProfileChanged);
    };
  }, [status]);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  const artifactsById = useMemo(() => Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact])), [artifacts]);
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin);
  const myArtifacts = useMemo(() => artifacts.filter((artifact) => artifact.scope === 'user'), [artifacts]);
  const systemArtifacts = useMemo(() => artifacts.filter((artifact) => artifact.scope === 'system'), [artifacts]);
  const deployArtifact = useMemo(() => (deployArtifactId ? (artifacts.find((artifact) => artifact.id === deployArtifactId) ?? null) : null), [artifacts, deployArtifactId]);
  const artifactDetailsGroups = useMemo(() => {
    if (!artifactDetailsTarget) {
      return {
        read: [] as ArtifactDetailsItem[],
        write: [] as ArtifactDetailsItem[],
        event: [] as ArtifactDetailsItem[],
      };
    }

    const functions = getContractFunctions(artifactDetailsTarget.abiJson);
    const abi = parseContractAbiJson(artifactDetailsTarget.abiJson);

    const read = functions
      .filter((fn) => fn.stateMutability === 'view' || fn.stateMutability === 'pure')
      .map(
        (fn): ArtifactDetailsItem => ({
          category: 'read',
          signature: fn.signature,
          methodId: toFunctionSelector(`function ${fn.signature}`),
          badgeLabel: fn.stateMutability,
        }),
      );

    const write = functions
      .filter((fn) => fn.stateMutability === 'nonpayable' || fn.stateMutability === 'payable')
      .map(
        (fn): ArtifactDetailsItem => ({
          category: 'write',
          signature: fn.signature,
          methodId: toFunctionSelector(`function ${fn.signature}`),
          badgeLabel: fn.stateMutability,
        }),
      );

    const event = abi
      .filter(isAbiEventItem)
      .map(
        (abiEvent): ArtifactDetailsItem => ({
          category: 'event',
          signature: getEventSignature(abiEvent),
          methodId: toEventSelector(getEventSignature(abiEvent)),
          badgeLabel: abiEvent.anonymous ? 'Anonymous' : 'Event',
        }),
      );

    return {
      read,
      write,
      event,
    };
  }, [artifactDetailsTarget]);
  const deployConstructor = useMemo(() => (deployArtifact ? getContractConstructor(deployArtifact.abiJson) : null), [deployArtifact]);
  const deploySimulationKey = useMemo(
    () =>
      buildDeploySimulationKey({
        artifactId: deployArtifact?.id ?? null,
        rawArgs: deployArgumentValues,
        value: deployDialogValues.value,
      }),
    [deployArgumentValues, deployArtifact?.id, deployDialogValues.value],
  );
  const isDeploySimulationReady = useMemo(() => areDeployConstructorArgsReady(deployConstructor?.inputs ?? [], deployArgumentValues), [deployConstructor, deployArgumentValues]);

  useEffect(() => {
    if (deploySimulationFailureRef.current.key !== deploySimulationKey) {
      deploySimulationFailureRef.current = {
        key: deploySimulationKey,
        attempts: 0,
      };
    }
  }, [deploySimulationKey]);

  function resetArtifactForm() {
    setArtifactForm({
      id: null,
      scope: 'user',
      name: '',
      abiJson: '',
      bytecode: '',
      contractAddress: '',
    });
    setArtifactImportText('');
    setArtifactError(null);
  }

  function resetBindingForm() {
    setBindingForm({
      id: null,
      artifactId: '',
      address: '',
      label: '',
    });
    setBindingError(null);
  }

  function resetDeployState() {
    setDeployArtifactId(null);
    setDeployArgumentValues([]);
    setDeployDialogValues(createInitialDeployDialogState());
    setDeployBindingLabel('');
    setDeployError(null);
    setDeployResult(null);
    setDeployActionLoading(null);
    setDeployUnlockDialogOpen(false);
    setDeployUnlockPassword('');
    setDeployUnlockError(null);
    setPendingDeployAction(null);
    deploySimulationFailureRef.current = {
      key: '',
      attempts: 0,
    };
  }

  function startArtifactEdit(artifact: EvmContractArtifact) {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setArtifactForm({
      id: artifact.id,
      scope: artifact.scope,
      name: artifact.name,
      abiJson: artifact.abiJson,
      bytecode: artifact.bytecode ?? '',
      contractAddress: '',
    });
    setArtifactImportText('');
    setArtifactError(null);
    setArtifactDialogOpen(true);
  }

  function startArtifactCreate(scope: 'system' | 'user' = 'user') {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    resetArtifactForm();
    setArtifactForm((current) => ({
      ...current,
      scope,
    }));
    setArtifactDialogOpen(true);
  }

  function canManageArtifact(artifact: EvmContractArtifact) {
    return artifact.scope === 'user' || isAdmin;
  }

  function startBindingEdit(binding: EvmContractBinding) {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setBindingForm({
      id: binding.id,
      artifactId: binding.artifactId,
      address: binding.address,
      label: binding.label,
    });
    setBindingError(null);
    setBindingDialogOpen(true);
  }

  function startBindingCreate(artifact?: EvmContractArtifact) {
    if (status !== 'authenticated') {
      goToLogin();
      return;
    }

    setBindingForm({
      id: null,
      artifactId: artifact?.id ?? '',
      address: getDefaultBindingAddressForArtifact(artifact),
      label: artifact?.name ?? '',
    });
    setBindingError(null);
    setBindingDialogOpen(true);
  }

  function startDeployArtifact(artifact: EvmContractArtifact) {
    setDeployArtifactId(artifact.id);
    const constructorItem = getContractConstructor(artifact.abiJson);
    setDeployArgumentValues(constructorItem.inputs.map((input) => getInitialArgumentValue(input)));
    setDeployDialogValues(createInitialDeployDialogState());
    setDeployBindingLabel(artifact.name);
    setDeployError(null);
    setDeployResult(null);
    setDeployActionLoading(null);
    setDeployUnlockDialogOpen(false);
    setDeployUnlockPassword('');
    setDeployUnlockError(null);
    setPendingDeployAction(null);
    deploySimulationFailureRef.current = {
      key: '',
      attempts: 0,
    };
  }

  useEffect(() => {
    if (
      !deployArtifact ||
      !deployArtifact.bytecode ||
      !activeKey ||
      deployActionLoading === 'deploy' ||
      (activeKey.securityMode === 'encrypted' && !isEvmStoredPrivateKeyUnlocked(activeKey.id)) ||
      !isDeploySimulationReady ||
      !isValidNativeValueInput(deployDialogValues.value)
    ) {
      return;
    }

    if (deploySimulationFailureRef.current.key === deploySimulationKey && deploySimulationFailureRef.current.attempts >= 3) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fillDeployDefaults(undefined, {
        rawArgs: deployArgumentValues,
        value: deployDialogValues.value,
      });
    }, 240);

    return () => {
      window.clearTimeout(timeout);
    };
    // fillDeployDefaults is intentionally omitted here so the debounce effect only reacts
    // to simulation inputs, not to the recreated function identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, deployActionLoading, deployArtifact, deployArgumentValues, deployDialogValues.value, deploySimulationKey, isDeploySimulationReady]);

  async function handleSaveArtifact() {
    try {
      if (artifactForm.id) {
        await updateEvmContractArtifact(artifactForm.id, artifactForm);
        showToast({
          title: contractRegistryMessages.artifactUpdated,
          description: contractRegistryMessages.artifactUpdatedDescription.replace('{name}', artifactForm.name.trim()),
        });
      } else {
        const contractAddress = artifactForm.contractAddress.trim();

        if (contractAddress) {
          if (!environment) {
            throw new Error(contractRegistryMessages.noActiveEvmProviderSelected);
          }

          if (!isAddress(contractAddress)) {
            throw new Error(contractRegistryMessages.invalidContractAddress);
          }
        }

        const createdArtifact = await createEvmContractArtifact(artifactForm);

        if (contractAddress && environment) {
          await createEvmContractBinding({
            artifactId: createdArtifact.id,
            address: contractAddress,
            label: artifactForm.name.trim() || contractAddress,
            chainId: environment.chainId,
            providerProfileId: environment.providerProfileId,
            providerName: environment.providerName,
          });
        }

        showToast({
          title: contractRegistryMessages.artifactCreated,
          description: contractAddress
            ? contractRegistryMessages.artifactCreatedAndBoundDescription.replace('{name}', artifactForm.name.trim())
            : contractRegistryMessages.artifactCreatedDescription.replace('{name}', artifactForm.name.trim()),
        });
      }

      resetArtifactForm();
      setArtifactDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setArtifactError(
        normalizeWorkbenchErrorMessage(
          error instanceof Error ? error.message : contractRegistryMessages.failedToSaveContractArtifact,
          contractRegistryMessages.failedToSaveContractArtifact,
          contractRegistryMessages,
        ),
      );
    }
  }

  function applyImportedArtifact(rawText: string) {
    try {
      const imported = parseEvmContractArtifactImportPayload(rawText);

      setArtifactForm((current) => ({
        ...current,
        name: imported.name || current.name,
        abiJson: imported.abiJson,
        bytecode: imported.bytecode,
      }));
      setArtifactError(null);
    } catch (error) {
      setArtifactError(
        normalizeWorkbenchErrorMessage(
          error instanceof Error ? error.message : contractRegistryMessages.failedToParseContractArtifact,
          contractRegistryMessages.failedToParseContractArtifact,
          contractRegistryMessages,
        ),
      );
    }
  }

  function handleImportInputChange(value: string) {
    setArtifactImportText(value);

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setArtifactError(null);
      return;
    }

    const looksCompleteJson = (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) || (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'));

    if (!looksCompleteJson) {
      return;
    }

    applyImportedArtifact(trimmedValue);
  }

  async function handleSaveBinding() {
    if (!environment) {
      setBindingError(contractRegistryMessages.noActiveEvmProviderSelected);
      return;
    }

    try {
      if (bindingForm.id) {
        await updateEvmContractBinding(bindingForm.id, {
          ...bindingForm,
          chainId: environment.chainId,
          providerProfileId: environment.providerProfileId,
          providerName: environment.providerName,
        });
        showToast({
          title: contractRegistryMessages.bindingUpdated,
          description: bindingForm.label.trim() || bindingForm.address,
        });
      } else {
        await createEvmContractBinding({
          ...bindingForm,
          chainId: environment.chainId,
          providerProfileId: environment.providerProfileId,
          providerName: environment.providerName,
        });
        showToast({
          title: contractRegistryMessages.bindingCreated,
          description: bindingForm.label.trim() || bindingForm.address,
        });
      }

      resetBindingForm();
      setBindingDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setBindingError(
        normalizeWorkbenchErrorMessage(
          error instanceof Error ? error.message : contractRegistryMessages.failedToSaveContractBinding,
          contractRegistryMessages.failedToSaveContractBinding,
          contractRegistryMessages,
        ),
      );
    }
  }

  function updateDeployArgumentValue(index: number, value: string) {
    const nextArgs = [...deployArgumentValues];
    nextArgs[index] = value;
    setDeployArgumentValues(nextArgs);
    setDeployResult(null);
  }

  async function fillDeployDefaults(
    password?: string,
    overrides?: {
      rawArgs?: string[];
      value?: string;
    },
  ) {
    if (!deployArtifact) {
      setDeployError(contractRegistryMessages.deployContractArtifact);
      return;
    }

    if (!deployArtifact.bytecode) {
      setDeployError(contractRegistryMessages.artifactNoDeployableBytecode);
      return;
    }

    if (!activeKey) {
      setDeployError(contractRegistryMessages.selectGlobalKeyFirstWithSettings);
      return;
    }

    setDeployActionLoading('fill');
    const requestId = deployDefaultsRequestIdRef.current + 1;
    deployDefaultsRequestIdRef.current = requestId;
    const rawArgs = overrides?.rawArgs ?? deployArgumentValues;
    const value = overrides?.value ?? deployDialogValues.value;
    const simulationKey = buildDeploySimulationKey({
      artifactId: deployArtifact.id,
      rawArgs,
      value,
    });

    try {
      const privateKey = password ? await resolveEvmStoredPrivateKey(activeKey.id, password) : await peekEvmStoredPrivateKey(activeKey.id);
      const defaults = await getEvmContractDeployManualDefaultsDirect({
        abiJson: deployArtifact.abiJson,
        bytecode: deployArtifact.bytecode,
        rawArgs,
        privateKey,
        value,
      });

      if (requestId !== deployDefaultsRequestIdRef.current) {
        return;
      }

      setDeployDialogValues((current) => ({
        ...current,
        transactionType: defaults.transactionType,
        gasPrice: defaults.gasPrice,
        maxFeePerGas: isAutoFieldValue(current.maxFeePerGas) ? 'auto' : current.maxFeePerGas,
        maxPriorityFeePerGas: isAutoFieldValue(current.maxPriorityFeePerGas) ? 'auto' : current.maxPriorityFeePerGas,
        gasLimit: defaults.estimatedGas || current.gasLimit,
        nonce: isAutoFieldValue(current.nonce) ? 'auto' : current.nonce,
      }));

      if (defaults.simulationError) {
        deploySimulationFailureRef.current = {
          key: simulationKey,
          attempts: deploySimulationFailureRef.current.key === simulationKey ? deploySimulationFailureRef.current.attempts + 1 : 1,
        };
        setDeployError(normalizeDeployErrorMessage(defaults.simulationError, contractRegistryMessages));
      } else {
        deploySimulationFailureRef.current = {
          key: simulationKey,
          attempts: 0,
        };
        setDeployError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : contractRegistryMessages.deployContract;

      if (requestId !== deployDefaultsRequestIdRef.current) {
        return;
      }

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setPendingDeployAction('fill');
        setDeployUnlockPassword('');
        setDeployUnlockError(null);
        setDeployUnlockDialogOpen(true);
        return;
      }

      deploySimulationFailureRef.current = {
        key: simulationKey,
        attempts: deploySimulationFailureRef.current.key === simulationKey ? deploySimulationFailureRef.current.attempts + 1 : 1,
      };
      setDeployError(normalizeDeployErrorMessage(message, contractRegistryMessages));
    } finally {
      if (requestId === deployDefaultsRequestIdRef.current) {
        setDeployActionLoading(null);
      }
    }
  }

  async function executeDeployAction() {
    if (!deployArtifact) {
      setDeployError(contractRegistryMessages.deployContractArtifact);
      return;
    }

    if (!deployArtifact.bytecode) {
      setDeployError(contractRegistryMessages.artifactNoDeployableBytecode);
      return;
    }

    if (!activeKey) {
      setDeployError(contractRegistryMessages.selectGlobalKeyFirstWithSettings);
      return;
    }

    setDeployActionLoading('deploy');
    setDeployError(null);
    deployDefaultsRequestIdRef.current += 1;
    let deploySucceeded = false;

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id);
      const latestDefaults =
        deployDialogValues.transactionType === 'EIP1559' &&
        (isAutoFieldValue(deployDialogValues.maxFeePerGas) || isAutoFieldValue(deployDialogValues.maxPriorityFeePerGas) || isAutoFieldValue(deployDialogValues.nonce))
          ? await getEvmContractDeployManualDefaultsDirect({
              abiJson: deployArtifact.abiJson,
              bytecode: deployArtifact.bytecode,
              rawArgs: deployArgumentValues,
              privateKey,
              value: deployDialogValues.value,
            })
          : isAutoFieldValue(deployDialogValues.nonce)
            ? await getEvmContractDeployManualDefaultsDirect({
                abiJson: deployArtifact.abiJson,
                bytecode: deployArtifact.bytecode,
                rawArgs: deployArgumentValues,
                privateKey,
                value: deployDialogValues.value,
              })
            : null;
      const resolvedDialogValues = {
        ...deployDialogValues,
        maxFeePerGas: isAutoFieldValue(deployDialogValues.maxFeePerGas) ? (latestDefaults?.maxFeePerGas ?? deployDialogValues.maxFeePerGas) : deployDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: isAutoFieldValue(deployDialogValues.maxPriorityFeePerGas)
          ? (latestDefaults?.maxPriorityFeePerGas ?? deployDialogValues.maxPriorityFeePerGas)
          : deployDialogValues.maxPriorityFeePerGas,
        nonce: isAutoFieldValue(deployDialogValues.nonce) ? (latestDefaults?.nonce ?? deployDialogValues.nonce) : deployDialogValues.nonce,
      };
      setDeployDialogValues(resolvedDialogValues);

      const result = await forceDeployEvmContractDirect({
        abiJson: deployArtifact.abiJson,
        bytecode: deployArtifact.bytecode,
        rawArgs: deployArgumentValues,
        privateKey,
        transactionType: resolvedDialogValues.transactionType,
        value: resolvedDialogValues.value,
        gasLimit: resolvedDialogValues.gasLimit,
        gasPrice: resolvedDialogValues.gasPrice,
        maxFeePerGas: resolvedDialogValues.maxFeePerGas,
        maxPriorityFeePerGas: resolvedDialogValues.maxPriorityFeePerGas,
        nonce: resolvedDialogValues.nonce,
      });

      let bindingId: string | null = null;
      let deployBindingError: string | null = null;

      if (deployBindingLabel.trim() && environment) {
        try {
          const binding = await createEvmContractBinding({
            artifactId: deployArtifact.id,
            address: result.contractAddress,
            label: deployBindingLabel.trim(),
            chainId: environment.chainId,
            providerProfileId: environment.providerProfileId,
            providerName: environment.providerName,
          });
          bindingId = binding.id;
        } catch (error) {
          deployBindingError = normalizeWorkbenchErrorMessage(
            error instanceof Error ? error.message : contractRegistryMessages.failedToCreateBindingForDeployedContract,
            contractRegistryMessages.failedToCreateBindingForDeployedContract,
            contractRegistryMessages,
          );
        }
      }

      showToast({
        title: contractRegistryMessages.contractDeployed,
        description: deployBindingError
          ? contractRegistryMessages.deployedBindingNotCreatedDescription.replace('{address}', result.contractAddress)
          : bindingId
            ? contractRegistryMessages.deployedBindingCreatedDescription.replace('{address}', result.contractAddress)
            : contractRegistryMessages.deployedDescription.replace('{address}', result.contractAddress),
      });
      deploySucceeded = true;
      resetDeployState();
    } catch (error) {
      const message = error instanceof Error ? error.message : contractRegistryMessages.deployContract;

      if (message === messages.privateKeys.passwordRequiredForEncrypted) {
        setPendingDeployAction('deploy');
        setDeployUnlockPassword('');
        setDeployUnlockError(null);
        setDeployUnlockDialogOpen(true);
        return;
      }

      setDeployError(normalizeDeployErrorMessage(message, contractRegistryMessages));
    } finally {
      if (!deploySucceeded) {
        setDeployActionLoading(null);
      }
    }
  }

  async function handleConfirmDeployUnlock() {
    if (!activeKey || !pendingDeployAction) {
      return;
    }

    try {
      await resolveEvmStoredPrivateKey(activeKey.id, deployUnlockPassword);
      const nextAction = pendingDeployAction;
      setPendingDeployAction(null);
      setDeployUnlockDialogOpen(false);
      setDeployUnlockPassword('');
      setDeployUnlockError(null);
      if (nextAction === 'fill') {
        await fillDeployDefaults(deployUnlockPassword);
      } else {
        await executeDeployAction();
      }
    } catch (error) {
      setDeployUnlockError(
        normalizeWorkbenchErrorMessage(
          error instanceof Error ? error.message : messages.evmTxDetail.failedToUnlockPrivateKey,
          messages.evmTxDetail.failedToUnlockPrivateKey,
          contractRegistryMessages,
        ),
      );
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      if (deleteTarget.type === 'artifact') {
        await deleteEvmContractArtifact(deleteTarget.id);

        if (artifactForm.id === deleteTarget.id) {
          resetArtifactForm();
        }
      } else {
        await deleteEvmContractBinding(deleteTarget.id);

        if (bindingForm.id === deleteTarget.id) {
          resetBindingForm();
        }
      }

      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      if (deleteTarget.type === 'artifact') {
        setArtifactError(
          normalizeWorkbenchErrorMessage(
            error instanceof Error ? error.message : contractRegistryMessages.failedToDeleteContractArtifact,
            contractRegistryMessages.failedToDeleteContractArtifact,
            contractRegistryMessages,
          ),
        );
      } else {
        setBindingError(
          normalizeWorkbenchErrorMessage(
            error instanceof Error ? error.message : contractRegistryMessages.failedToDeleteContractBinding,
            contractRegistryMessages.failedToDeleteContractBinding,
            contractRegistryMessages,
          ),
        );
      }
    }
  }

  return (
    <AppShell>
      <AccountWorkbenchShell mode="evm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">{messages.navigation.contracts}</h1>
          <p className="mt-2 text-sm text-slate-500">{contractRegistryMessages.description}</p>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">{contractRegistryMessages.boundContracts}</p>
            <p className="mt-1 text-sm text-slate-500">{contractRegistryMessages.description}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{contractRegistryMessages.bindingLabel}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.address}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.evmTxDetail.artifact}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.providerName}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.updated}</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{labelMessages.actions}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.length ? (
                  bindings.map((binding) => (
                    <tr key={binding.id} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{binding.label}</td>
                      <td className="px-5 py-3 text-sm">
                        <AddressLink
                          address={binding.address}
                          href={`/evm/address/${binding.address}`}
                          label={formatAddressLabel(binding.address)}
                          className="font-medium text-sky-600 hover:text-sky-700 mono"
                        />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{artifactsById[binding.artifactId]?.name ?? messages.common.unavailable}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{translateRuntimeText(binding.providerName, locale)}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(binding.updatedAt)}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-end gap-0">
                          <InteractContractLink href={`/evm/address/${binding.address}?tab=contract&contractTab=read`} />
                          {isGeneratedDefaultEvmContractBinding(binding) ? null : (
                            <>
                              <ActionIconButton
                                className="text-slate-400 hover:text-slate-700"
                                tooltip={contractRegistryMessages.editBindingTitle}
                                aria-label={contractRegistryMessages.editBindingTitle}
                                onClick={() => startBindingEdit(binding)}
                              >
                                <IconEdit className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton
                                className="text-slate-400 hover:text-rose-600"
                                tooltip={messages.common.delete}
                                aria-label={messages.common.delete}
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'binding',
                                    id: binding.id,
                                    title: messages.common.delete,
                                    description: contractRegistryMessages.deleteBindingDescription.replace('{name}', binding.label),
                                  })
                                }
                              >
                                <IconTrash className="size-4" stroke={1.8} />
                              </ActionIconButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                        {contractRegistryMessages.noBindings}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {[
          {
            title: contractRegistryMessages.systemArtifacts,
            description: contractRegistryMessages.systemArtifactsDescription,
            items: systemArtifacts,
            showAdd: isAdmin,
            showDefaultContract: true,
            addScope: 'system' as const,
            emptyText: contractRegistryMessages.noSystemArtifacts,
          },
          {
            title: contractRegistryMessages.myArtifacts,
            description: contractRegistryMessages.myArtifactsDescription,
            items: myArtifacts,
            showAdd: true,
            showDefaultContract: false,
            addScope: 'user' as const,
            emptyText: contractRegistryMessages.noPersonalArtifacts,
          },
        ].map((group) => (
          <section key={group.title} className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{translateRuntimeText(group.title, locale)}</p>
                <p className="mt-1 text-sm text-slate-500">{translateRuntimeText(group.description, locale)}</p>
              </div>
              {group.showAdd ? (
                <div className="flex justify-end gap-2">
                  {group.showAdd ? (
                    <Button type="button" size="sm" onClick={() => startArtifactCreate(group.addScope)}>
                      {messages.common.add}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.name}</th>
                    {group.showDefaultContract ? (
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.evmTxDetail.contract}</th>
                    ) : null}
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{contractPanelMessages.functions}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{messages.cosmosTxDetail.events}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{contractPanelMessages.artifactBytecode}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">{labelMessages.updated}</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">{labelMessages.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.length ? (
                    group.items.map((artifact) => (
                      <tr key={artifact.id} className="border-t border-slate-200">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">{artifact.name}</td>
                        {group.showDefaultContract ? (
                          <td className="px-5 py-3 text-sm">
                            {getArtifactDefaultAddressByName(artifact.name) ? (
                              <AddressLink
                                address={getArtifactDefaultAddressByName(artifact.name) ?? ''}
                                href={`/evm/address/${getArtifactDefaultAddressByName(artifact.name)}`}
                                label={formatAddressLabel(getArtifactDefaultAddressByName(artifact.name) ?? '')}
                                className="font-medium text-sky-600 hover:text-sky-700 mono"
                              />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-5 py-3 text-sm text-slate-700">{artifact.functionCount}</td>
                        <td className="px-5 py-3 text-sm text-slate-700">{artifact.eventCount}</td>
                        <td className={`px-5 py-3 text-sm ${artifact.bytecode ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {artifact.bytecode ? contractPanelMessages.available : contractPanelMessages.missing}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(artifact.updatedAt)}</td>
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center justify-end gap-0">
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip={contractRegistryMessages.viewArtifactMethods}
                              aria-label={contractRegistryMessages.viewArtifactMethods}
                              onClick={() => setArtifactDetailsTarget(artifact)}
                            >
                              <IconListDetails className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              disabled={!artifact.bytecode}
                              className={artifact.bytecode ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300'}
                              tooltip={contractRegistryMessages.deployContractArtifact}
                              aria-label={contractRegistryMessages.deployContractArtifact}
                              onClick={() => startDeployArtifact(artifact)}
                            >
                              <IconRocket className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              className="text-slate-400 hover:text-sky-600"
                              tooltip={contractRegistryMessages.bindContractAddress}
                              aria-label={contractRegistryMessages.bindContractAddress}
                              onClick={() => startBindingCreate(artifact)}
                            >
                              <IconPlugConnected className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            {canManageArtifact(artifact) ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip={contractRegistryMessages.editArtifact}
                                  aria-label={contractRegistryMessages.editArtifact}
                                  onClick={() => startArtifactEdit(artifact)}
                                >
                                  <IconEdit className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-rose-600"
                                  tooltip={contractRegistryMessages.deleteArtifact}
                                  aria-label={contractRegistryMessages.deleteArtifact}
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'artifact',
                                      id: artifact.id,
                                      title: messages.common.delete,
                                      description: contractRegistryMessages.deleteArtifactDescription.replace('{name}', artifact.name),
                                    })
                                  }
                                >
                                  <IconTrash className="size-4" stroke={1.8} />
                                </ActionIconButton>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={group.showDefaultContract ? 7 : 6}>
                        {group.emptyText}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={deleteTarget?.title ?? messages.common.delete}
          description={deleteTarget?.description}
          confirmLabel={messages.common.confirm}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />

        <ModalDialog
          open={artifactDetailsTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setArtifactDetailsTarget(null);
            }
          }}
          title={artifactDetailsTarget ? `${artifactDetailsTarget.name} ${contractRegistryMessages.artifactMethods}` : contractRegistryMessages.artifactMethods}
          description={contractRegistryMessages.artifactDescription}
          footer={
            <Button type="button" variant="ghost" onClick={() => setArtifactDetailsTarget(null)}>
              {messages.common.close}
            </Button>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-3">
            {artifactDetailsGroups.read.length || artifactDetailsGroups.write.length || artifactDetailsGroups.event.length ? (
              <div className="grid gap-3">
                {[
                  {
                    key: 'read',
                    title: contractPanelMessages.read,
                    items: artifactDetailsGroups.read,
                    emptyText: contractPanelMessages.noReadMethods,
                  },
                  {
                    key: 'write',
                    title: contractPanelMessages.write,
                    items: artifactDetailsGroups.write,
                    emptyText: contractPanelMessages.noWriteMethods,
                  },
                  {
                    key: 'event',
                    title: contractPanelMessages.event,
                    items: artifactDetailsGroups.event,
                    emptyText: contractPanelMessages.noEvents,
                  },
                ].map((group) => (
                  <div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">{group.title}</p>
                    </div>
                    {group.items.length ? (
                      <ul className="divide-y divide-slate-200">
                        {group.items.map((item) => (
                          <li key={`${item.category}-${item.signature}`} className="flex items-start justify-between gap-4 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="break-words font-mono text-sm leading-6 text-slate-900">
                                {item.signature}
                                <span className="ml-2 text-slate-500">({item.methodId})</span>
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
                              {translateRuntimeText(item.badgeLabel, locale)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-5 text-sm text-slate-500">{group.emptyText}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {contractPanelMessages.noContractMethodsFound}
              </div>
            )}
          </div>
        </ModalDialog>

        <ModalDialog
          open={artifactDialogOpen}
          onOpenChange={(open) => {
            setArtifactDialogOpen(open);

            if (!open) {
              resetArtifactForm();
            }
          }}
          title={artifactForm.id ? contractRegistryMessages.editArtifactTitle : contractRegistryMessages.createArtifact}
          description={contractRegistryMessages.artifactDescription}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setArtifactDialogOpen(false);
                  resetArtifactForm();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSaveArtifact()}>
                {artifactForm.id ? contractPanelMessages.updateArtifact : contractPanelMessages.saveArtifact}
              </Button>
            </>
          }
          maxWidthClassName="max-w-4xl"
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{contractPanelMessages.importArtifactJson}</p>
                  <p className="mt-1 text-sm text-slate-500">{contractPanelMessages.pasteArtifactJsonDescription}</p>
                </div>
                {artifactImportText ? (
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip={messages.evmTxDetail.clearInput}
                    aria-label={messages.evmTxDetail.clearInput}
                    onClick={() => handleImportInputChange('')}
                  >
                    <IconX className="size-4" stroke={1.8} />
                  </ActionIconButton>
                ) : null}
              </div>
              <textarea
                className={`mt-2 ${importTextareaClassName}`}
                value={artifactImportText}
                onChange={(event) => handleImportInputChange(event.target.value)}
                placeholder={contractPanelMessages.artifactImportPlaceholder}
              />
            </div>
            {isAdmin ? (
              <Select
                value={artifactForm.scope}
                onValueChange={(value) =>
                  setArtifactForm((current) => ({
                    ...current,
                    scope: value as 'system' | 'user',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={contractPanelMessages.selectArtifactScope} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{contractPanelMessages.myArtifact}</SelectItem>
                  <SelectItem value="system">{contractPanelMessages.systemArtifact}</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            <Input
              value={artifactForm.name}
              onChange={(event) =>
                setArtifactForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={contractPanelMessages.contractName}
            />
            <textarea
              className={textareaClassName}
              value={artifactForm.abiJson}
              onChange={(event) =>
                setArtifactForm((current) => ({
                  ...current,
                  abiJson: event.target.value,
                }))
              }
              placeholder={contractPanelMessages.abiPlaceholder}
            />
            <textarea
              className={textareaClassName}
              value={artifactForm.bytecode}
              onChange={(event) =>
                setArtifactForm((current) => ({
                  ...current,
                  bytecode: event.target.value,
                }))
              }
              placeholder={contractPanelMessages.optionalBytecode}
            />
            {!artifactForm.id ? (
              <Input
                value={artifactForm.contractAddress}
                onChange={(event) =>
                  setArtifactForm((current) => ({
                    ...current,
                    contractAddress: event.target.value,
                  }))
                }
                placeholder={contractRegistryMessages.optionalContractAddressAfterCreate}
              />
            ) : null}
            {artifactError ? <p className="text-sm text-rose-600">{translateRuntimeText(artifactError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={bindingDialogOpen}
          onOpenChange={(open) => {
            setBindingDialogOpen(open);

            if (!open) {
              resetBindingForm();
            }
          }}
          title={bindingForm.id ? contractRegistryMessages.editBindingTitle : contractRegistryMessages.bindContractAddressTitle}
          description={contractRegistryMessages.bindContractAddressDescription}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBindingDialogOpen(false);
                  resetBindingForm();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button type="button" onClick={() => void handleSaveBinding()} disabled={!artifacts.length}>
                {bindingForm.id ? contractRegistryMessages.updateBinding : contractRegistryMessages.saveBinding}
              </Button>
            </>
          }
          maxWidthClassName="max-w-xl"
        >
          <div className="grid gap-3">
            <Select
              value={bindingForm.artifactId || undefined}
              onValueChange={(value) =>
                setBindingForm((current) => {
                  const previousArtifact = current.artifactId ? (artifactsById[current.artifactId] ?? null) : null;
                  const nextArtifact = artifactsById[value] ?? null;
                  const previousDefaultAddress = getDefaultBindingAddressForArtifact(previousArtifact);
                  const nextDefaultAddress = getDefaultBindingAddressForArtifact(nextArtifact);
                  const shouldReplaceAddress = !current.address || current.address === previousDefaultAddress;

                  return {
                    ...current,
                    artifactId: value,
                    address: shouldReplaceAddress ? nextDefaultAddress : current.address,
                  };
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={contractRegistryMessages.selectContractArtifact} />
              </SelectTrigger>
              <SelectContent>
                {artifacts.map((artifact) => (
                  <SelectItem key={artifact.id} value={artifact.id}>
                    {artifact.scope === 'system' ? `${contractPanelMessages.systemArtifact} · ${artifact.name}` : artifact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={bindingForm.address}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder={contractRegistryMessages.deployedContractAddress}
            />
            <Input
              value={bindingForm.label}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder={contractRegistryMessages.bindingLabel}
            />
            {bindingError ? <p className="text-sm text-rose-600">{translateRuntimeText(bindingError, locale)}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={deployArtifact !== null}
          onOpenChange={(open) => {
            if (!open) {
              resetDeployState();
            }
          }}
          title={contractRegistryMessages.deployContract}
          description={contractRegistryMessages.deployContractDescription}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetDeployState();
                }}
              >
                {messages.common.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void executeDeployAction()}
                disabled={!deployArtifact || deployActionLoading === 'deploy' || !deployArtifact.bytecode || !isDeployDialogReady(deployDialogValues)}
                aria-busy={deployActionLoading === 'deploy'}
              >
                {deployActionLoading === 'deploy' ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    {contractRegistryMessages.deploying}
                  </>
                ) : (
                  contractRegistryMessages.deployContract
                )}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{messages.evmTxDetail.artifact}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{deployArtifact?.name ?? contractRegistryMessages.unavailable}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{contractRegistryMessages.constructor}</p>
                <p className="mt-1 text-sm text-slate-700">
                  {deployConstructor?.inputs.length
                    ? contractRegistryMessages.argumentCount.replace('{count}', String(deployConstructor.inputs.length))
                    : contractRegistryMessages.noArguments}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{contractRegistryMessages.selectedKey}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{activeKey?.name ?? messages.evmTxDetail.noKeySelected}</p>
              </div>
              {activeKey && activeKey.securityMode === 'encrypted' && !isEvmStoredPrivateKeyUnlocked(activeKey.id) ? (
                <p className="text-xs text-amber-600 sm:col-span-2 lg:col-span-3">{contractRegistryMessages.encryptedKeyRequiresUnlock}</p>
              ) : null}
            </div>

            {!activeKey ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {contractRegistryMessages.selectGlobalKeyFirstWithSettings}{' '}
                <Link href="/settings/private-keys" className="font-semibold underline underline-offset-2">
                  {messages.navigation.settings} / {messages.navigation.privateKeys}
                </Link>
                .
              </div>
            ) : null}

            {!deployArtifact?.bytecode ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{contractRegistryMessages.artifactNoDeployableBytecode}</div>
            ) : null}

            <div className="grid gap-3">
              <p className="text-sm font-medium text-slate-700">{contractRegistryMessages.constructorArguments}</p>
              <div className="max-h-64 overflow-y-auto pr-1">
                <ContractInputsForm inputs={deployConstructor?.inputs ?? []} values={deployArgumentValues} onChange={updateDeployArgumentValue} />
              </div>
              {deployConstructor?.inputs.length && !isDeploySimulationReady ? (
                <p className="text-xs text-slate-500">{contractRegistryMessages.fillConstructorArgumentsFirst}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.txnType}</label>
                <Select
                  value={deployDialogValues.transactionType}
                  onValueChange={(value) =>
                    setDeployDialogValues((current) => ({
                      ...current,
                      transactionType: value as DeployTransactionType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={contractRegistryMessages.selectTransactionType} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIP1559">{translateRuntimeText('EIP-1559', locale)}</SelectItem>
                    <SelectItem value="LEGACY">{messages.sendTx.legacy}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  {contractRegistryMessages.nativeValue.replace('{currency}', environment?.nativeCurrency ?? 'Native')}
                </label>
                <Input
                  value={deployDialogValues.value}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDeployDialogValues((current) => ({
                      ...current,
                      value: nextValue,
                    }));
                    setDeployResult(null);
                  }}
                  placeholder="0"
                />
              </div>
              {deployDialogValues.transactionType === 'LEGACY' ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.gasPriceGwei}</label>
                  <Input
                    value={deployDialogValues.gasPrice}
                    onChange={(event) =>
                      setDeployDialogValues((current) => ({
                        ...current,
                        gasPrice: event.target.value,
                      }))
                    }
                    placeholder={messages.sendTx.autoPlaceholder}
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.maxFeePerGasGwei}</label>
                    <Input
                      value={deployDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setDeployDialogValues((current) => ({
                          ...current,
                          maxFeePerGas: event.target.value,
                        }))
                      }
                      placeholder={messages.sendTx.autoPlaceholder}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.maxPriorityFeePerGasGwei}</label>
                    <Input
                      value={deployDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setDeployDialogValues((current) => ({
                          ...current,
                          maxPriorityFeePerGas: event.target.value,
                        }))
                      }
                      placeholder={messages.sendTx.autoPlaceholder}
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.gasLimit}</label>
                <Input
                  value={deployDialogValues.gasLimit}
                  onChange={(event) =>
                    setDeployDialogValues((current) => ({
                      ...current,
                      gasLimit: event.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">{messages.evmTxDetail.nonce}</label>
                <Input
                  value={deployDialogValues.nonce}
                  onChange={(event) =>
                    setDeployDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder={messages.sendTx.autoPlaceholder}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">{contractRegistryMessages.bindingLabel}</label>
                <Input
                  value={deployBindingLabel}
                  onChange={(event) => setDeployBindingLabel(event.target.value)}
                  placeholder={deployArtifact?.name ?? contractRegistryMessages.bindingLabelPlaceholder}
                />
                <p className="text-xs text-slate-500">{contractRegistryMessages.leaveEmptyForNoBinding}</p>
              </div>
            </div>

            {deployResult ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{contractRegistryMessages.deploymentResult}</p>
                <dl className="mt-3 grid gap-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">{contractRegistryMessages.contractAddress}</dt>
                    <dd className="mt-1 text-sm text-slate-900 mono">{deployResult.contractAddress}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">{messages.evmTxDetail.transactionHash}</dt>
                    <dd className="mt-1 text-sm text-slate-900 mono">{deployResult.hash}</dd>
                  </div>
                  {deployResult.bindingError ? <div className="text-sm text-amber-700">{translateRuntimeText(deployResult.bindingError, locale)}</div> : null}
                  {deployResult.bindingId ? (
                    <div>
                      <Link
                        href={`/evm/address/${deployResult.contractAddress}?tab=contract&contractTab=read`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
                      >
                        <IconLinkPlus className="size-4" stroke={1.8} />
                        {contractRegistryMessages.openInteract}
                      </Link>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {deployError ? (
              <div className="max-h-32 overflow-auto rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="break-all whitespace-pre-wrap">{translateRuntimeText(deployError, locale)}</p>
              </div>
            ) : null}
          </div>
        </ModalDialog>

        <SecretInputDialog
          open={deployUnlockDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDeployUnlockDialogOpen(false);
              setDeployUnlockPassword('');
              setDeployUnlockError(null);
              setPendingDeployAction(null);
            }
          }}
          title={messages.privateKeys.unlockPrivateKey}
          description={activeKey ? messages.evmTxDetail.unlockDescription.replace('{name}', activeKey.name) : messages.evmTxDetail.unlockFallbackDescription}
          value={deployUnlockPassword}
          onValueChange={setDeployUnlockPassword}
          placeholder={messages.sendTx.password}
          confirmLabel={messages.sendTx.unlock}
          confirmDisabled={!deployUnlockPassword.trim()}
          errorMessage={deployUnlockError}
          onConfirm={() => {
            void handleConfirmDeployUnlock();
          }}
        />
      </AccountWorkbenchShell>
    </AppShell>
  );
}
