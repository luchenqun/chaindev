'use client';

import { IconListDetails, IconEdit, IconLinkPlus, IconLoader2, IconPlugConnected, IconRocket, IconTrash, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isAddress, type AbiParameter } from 'viem';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { JsonInput } from '@/components/ui/json-input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { SecretInputDialog } from '@/components/ui/secret-input-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { getContractConstructor, getContractFunctions } from '@/domains/evm/client/abi-utils';
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

function hasTupleComponents(parameter: AbiParameter): parameter is AbiParameter & { components: readonly AbiParameter[] } {
  return 'components' in parameter && Array.isArray(parameter.components);
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
  if (!inputs.length) {
    return <p className="text-sm text-slate-500">This contract deployment does not require constructor arguments.</p>;
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
              <Input value={values[index] ?? ''} onChange={(event) => onChange(index, event.target.value)} placeholder={input.type === 'bool' ? 'true or false' : input.type} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function normalizeDeployErrorMessage(message: string) {
  if (/only developer can create contract/i.test(message)) {
    return 'Deployment rejected by the current chain. Only developer-authorized accounts can create contracts.';
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `Deployment failed: ${rpcDescMatch[1].trim()}.`;
  }

  if (/Missing or invalid parameters\./i.test(message)) {
    return 'Deployment failed. The current RPC node rejected the request parameters.';
  }

  return message;
}

function normalizeWorkbenchErrorMessage(message: string, fallback: string) {
  if (/only developer can create contract/i.test(message)) {
    return 'Deployment rejected by the current chain. Only developer-authorized accounts can create contracts.';
  }

  const rpcDescMatch = message.match(/desc\s*=\s*(.+?)(?:\s+Version:|$)/i);

  if (rpcDescMatch?.[1]) {
    return `${fallback} ${rpcDescMatch[1].trim()}.`;
  }

  if (/Missing or invalid parameters\./i.test(message)) {
    return `${fallback} The current RPC node rejected the request parameters.`;
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

function createInitialDeployDialogState(): DeployDialogState {
  return {
    transactionType: 'EIP1559',
    value: '0',
    gasPrice: '',
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
            setArtifactError(error instanceof Error ? error.message : 'Failed to load contract registry.');
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
  const artifactDetailsFunctions = useMemo(() => (artifactDetailsTarget ? getContractFunctions(artifactDetailsTarget.abiJson) : []), [artifactDetailsTarget]);
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
          title: 'Artifact updated',
          description: `"${artifactForm.name.trim()}" was saved successfully.`,
        });
      } else {
        const contractAddress = artifactForm.contractAddress.trim();

        if (contractAddress) {
          if (!environment) {
            throw new Error('No active EVM provider selected.');
          }

          if (!isAddress(contractAddress)) {
            throw new Error('Contract address must be a valid EVM address.');
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
          title: 'Artifact created',
          description: contractAddress ? `"${artifactForm.name.trim()}" was added and bound successfully.` : `"${artifactForm.name.trim()}" was added successfully.`,
        });
      }

      resetArtifactForm();
      setArtifactDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setArtifactError(normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to save contract artifact.', 'Failed to save contract artifact.'));
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
      setArtifactError(normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to parse contract artifact.', 'Failed to parse contract artifact.'));
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
      setBindingError('No active EVM provider selected.');
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
          title: 'Binding updated',
          description: `"${bindingForm.label.trim() || bindingForm.address}" was updated successfully.`,
        });
      } else {
        await createEvmContractBinding({
          ...bindingForm,
          chainId: environment.chainId,
          providerProfileId: environment.providerProfileId,
          providerName: environment.providerName,
        });
        showToast({
          title: 'Binding created',
          description: `"${bindingForm.label.trim() || bindingForm.address}" was added successfully.`,
        });
      }

      resetBindingForm();
      setBindingDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthRequiredError') {
        goToLogin();
        return;
      }

      setBindingError(normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to save contract binding.', 'Failed to save contract binding.'));
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
      setDeployError('Select a contract artifact first.');
      return;
    }

    if (!deployArtifact.bytecode) {
      setDeployError('This artifact does not include deployable bytecode.');
      return;
    }

    if (!activeKey) {
      setDeployError('Select a global private key first.');
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
        setDeployError(normalizeDeployErrorMessage(defaults.simulationError));
      } else {
        deploySimulationFailureRef.current = {
          key: simulationKey,
          attempts: 0,
        };
        setDeployError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to simulate deployment.';

      if (requestId !== deployDefaultsRequestIdRef.current) {
        return;
      }

      if (message === 'Password is required.') {
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
      setDeployError(normalizeDeployErrorMessage(message));
    } finally {
      if (requestId === deployDefaultsRequestIdRef.current) {
        setDeployActionLoading(null);
      }
    }
  }

  async function executeDeployAction() {
    if (!deployArtifact) {
      setDeployError('Select a contract artifact first.');
      return;
    }

    if (!deployArtifact.bytecode) {
      setDeployError('This artifact does not include deployable bytecode.');
      return;
    }

    if (!activeKey) {
      setDeployError('Select a global private key first.');
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
            error instanceof Error ? error.message : 'Failed to create a binding for the deployed contract.',
            'Failed to create a binding for the deployed contract.',
          );
        }
      }

      showToast({
        title: 'Contract deployed',
        description: deployBindingError
          ? `Deployed to ${result.contractAddress}. Binding was not created.`
          : bindingId
            ? `Deployed to ${result.contractAddress} and binding was created.`
            : `Deployed to ${result.contractAddress}.`,
      });
      deploySucceeded = true;
      resetDeployState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deploy contract.';

      if (message === 'Password is required.') {
        setPendingDeployAction('deploy');
        setDeployUnlockPassword('');
        setDeployUnlockError(null);
        setDeployUnlockDialogOpen(true);
        return;
      }

      setDeployError(normalizeDeployErrorMessage(message));
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
        normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to unlock the selected private key.', 'Failed to unlock the selected private key.'),
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
        setArtifactError(normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to delete contract artifact.', 'Failed to delete contract artifact.'));
      } else {
        setBindingError(normalizeWorkbenchErrorMessage(error instanceof Error ? error.message : 'Failed to delete contract binding.', 'Failed to delete contract binding.'));
      }
    }
  }

  return (
    <AppShell>
      <AccountWorkbenchShell mode="evm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-[1.171875rem] font-semibold text-slate-900">Contract Registry</h1>
          <p className="mt-2 text-sm text-slate-500">Store contract artifacts and bind deployed contracts to the active EVM environment.</p>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">Bound Contracts</p>
            <p className="mt-1 text-sm text-slate-500">Deployed contracts bound to the active provider and chain scope.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Label</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Address</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Artifact</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Provider</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Updated</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">Actions</th>
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
                      <td className="px-5 py-3 text-sm text-slate-700">{artifactsById[binding.artifactId]?.name ?? 'Missing Artifact'}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{binding.providerName}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(binding.updatedAt)}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-end gap-0">
                          <span className="group relative inline-flex">
                            <Link
                              href={`/evm/address/${binding.address}?tab=contract&contractTab=read`}
                              aria-label="Interact with contract"
                              className="inline-flex items-center justify-center p-[3px] text-slate-400 transition hover:text-slate-700"
                            >
                              <IconLinkPlus className="size-4" stroke={1.8} />
                            </Link>
                            <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition duration-75 group-hover:opacity-100 group-focus-within:opacity-100">
                              Interact with contract
                            </span>
                          </span>
                          {isGeneratedDefaultEvmContractBinding(binding) ? null : (
                            <>
                              <ActionIconButton
                                className="text-slate-400 hover:text-slate-700"
                                tooltip="Edit binding"
                                aria-label="Edit binding"
                                onClick={() => startBindingEdit(binding)}
                              >
                                <IconEdit className="size-4" stroke={1.8} />
                              </ActionIconButton>
                              <ActionIconButton
                                className="text-slate-400 hover:text-rose-600"
                                tooltip="Delete binding"
                                aria-label="Delete binding"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'binding',
                                    id: binding.id,
                                    title: 'Delete Bound Contract',
                                    description: `Delete the contract binding "${binding.label}"?`,
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
                      No contract bindings found for the active provider scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {[
          {
            title: 'System Artifacts',
            description: 'Shared ABI and bytecode definitions published by administrators for all users.',
            items: systemArtifacts,
            showAdd: isAdmin,
            showDefaultContract: true,
            addScope: 'system' as const,
            emptyText: 'No system artifacts yet.',
          },
          {
            title: 'My Artifacts',
            description: 'Your reusable ABI and bytecode definitions for the current account.',
            items: myArtifacts,
            showAdd: true,
            showDefaultContract: false,
            addScope: 'user' as const,
            emptyText: 'No personal artifacts yet.',
          },
        ].map((group) => (
          <section key={group.title} className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{group.title}</p>
                <p className="mt-1 text-sm text-slate-500">{group.description}</p>
              </div>
              {group.showAdd ? (
                <div className="flex justify-end gap-2">
                  {group.showAdd ? (
                    <Button type="button" size="sm" onClick={() => startArtifactCreate(group.addScope)}>
                      Add
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Name</th>
                    {group.showDefaultContract ? (
                      <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Default Contract</th>
                    ) : null}
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Functions</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Events</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Bytecode</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Updated</th>
                    <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">Actions</th>
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
                        <td className={`px-5 py-3 text-sm ${artifact.bytecode ? 'text-emerald-600' : 'text-slate-700'}`}>{artifact.bytecode ? 'Available' : 'Missing'}</td>
                        <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(artifact.updatedAt)}</td>
                        <td className="px-5 py-3 text-sm">
                          <div className="flex items-center justify-end gap-0">
                            <ActionIconButton
                              className="text-slate-400 hover:text-slate-700"
                              tooltip="View artifact methods"
                              aria-label="View artifact methods"
                              onClick={() => setArtifactDetailsTarget(artifact)}
                            >
                              <IconListDetails className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              disabled={!artifact.bytecode}
                              className={artifact.bytecode ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300'}
                              tooltip="Deploy contract artifact"
                              aria-label="Deploy contract artifact"
                              onClick={() => startDeployArtifact(artifact)}
                            >
                              <IconRocket className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            <ActionIconButton
                              className="text-slate-400 hover:text-sky-600"
                              tooltip="Bind contract address"
                              aria-label="Bind contract address"
                              onClick={() => startBindingCreate(artifact)}
                            >
                              <IconPlugConnected className="size-4" stroke={1.8} />
                            </ActionIconButton>
                            {canManageArtifact(artifact) ? (
                              <>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-slate-700"
                                  tooltip="Edit artifact"
                                  aria-label="Edit artifact"
                                  onClick={() => startArtifactEdit(artifact)}
                                >
                                  <IconEdit className="size-4" stroke={1.8} />
                                </ActionIconButton>
                                <ActionIconButton
                                  className="text-slate-400 hover:text-rose-600"
                                  tooltip="Delete artifact"
                                  aria-label="Delete artifact"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'artifact',
                                      id: artifact.id,
                                      title: 'Delete Contract Artifact',
                                      description: `Delete the artifact "${artifact.name}"?`,
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
          title={deleteTarget?.title ?? 'Delete'}
          description={deleteTarget?.description}
          confirmLabel="Delete"
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
          title={artifactDetailsTarget ? `${artifactDetailsTarget.name} Methods` : 'Artifact Methods'}
          description="List of contract methods parsed from the saved ABI."
          footer={
            <Button type="button" variant="ghost" onClick={() => setArtifactDetailsTarget(null)}>
              Close
            </Button>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-3">
            {artifactDetailsFunctions.length ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-200">
                  {artifactDetailsFunctions.map((fn) => (
                    <li key={fn.signature} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="min-w-0 truncate font-mono text-sm text-slate-900">{fn.signature}</span>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
                        {fn.stateMutability}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No contract methods were found in this ABI.
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
          title={artifactForm.id ? 'Edit Artifact' : 'Create Artifact'}
          description="Save ABI and optional bytecode for reuse across environments."
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
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveArtifact()}>
                {artifactForm.id ? 'Update Artifact' : 'Save Artifact'}
              </Button>
            </>
          }
          maxWidthClassName="max-w-4xl"
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Import Artifact JSON</p>
                  <p className="mt-1 text-sm text-slate-500">Paste artifact JSON and autofill the form.</p>
                </div>
                {artifactImportText ? (
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip="Clear import input"
                    aria-label="Clear import input"
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
                placeholder='{"contractName":"Simple","abi":[...],"bytecode":"0x..."}'
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
                  <SelectValue placeholder="Select artifact scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">My Artifact</SelectItem>
                  <SelectItem value="system">System Artifact</SelectItem>
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
              placeholder="Contract Name"
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
              placeholder='[{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"}]'
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
              placeholder="Optional bytecode (0x...)"
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
                placeholder="Optional contract address (auto-bind after create)"
              />
            ) : null}
            {artifactError ? <p className="text-sm text-rose-600">{artifactError}</p> : null}
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
          title={bindingForm.id ? 'Edit Binding' : 'Bind Contract Address'}
          description="Bind a deployed contract address to the active provider and chain."
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
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveBinding()} disabled={!artifacts.length}>
                {bindingForm.id ? 'Update Binding' : 'Save Binding'}
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
                <SelectValue placeholder="Select a contract artifact" />
              </SelectTrigger>
              <SelectContent>
                {artifacts.map((artifact) => (
                  <SelectItem key={artifact.id} value={artifact.id}>
                    {artifact.scope === 'system' ? `[System] ${artifact.name}` : artifact.name}
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
              placeholder="Deployed Contract Address"
            />
            <Input
              value={bindingForm.label}
              onChange={(event) =>
                setBindingForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Binding Label"
            />
            {bindingError ? <p className="text-sm text-rose-600">{bindingError}</p> : null}
          </div>
        </ModalDialog>

        <ModalDialog
          open={deployArtifact !== null}
          onOpenChange={(open) => {
            if (!open) {
              resetDeployState();
            }
          }}
          title="Deploy Contract"
          description="Deploy this saved artifact with the current global private key."
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetDeployState();
                }}
              >
                Cancel
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
                    Deploying...
                  </>
                ) : (
                  'Deploy Contract'
                )}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid max-h-[68vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Artifact</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{deployArtifact?.name ?? 'Unavailable'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Constructor</p>
                <p className="mt-1 text-sm text-slate-700">{deployConstructor?.inputs.length ? `${deployConstructor.inputs.length} argument(s)` : 'No arguments'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected Key</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{activeKey?.name ?? 'No Key Selected'}</p>
              </div>
              {activeKey && activeKey.securityMode === 'encrypted' && !isEvmStoredPrivateKeyUnlocked(activeKey.id) ? (
                <p className="text-xs text-amber-600 sm:col-span-2 lg:col-span-3">This key is encrypted and will require unlock before deployment.</p>
              ) : null}
            </div>

            {!activeKey ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Select a global private key first from{' '}
                <Link href="/evm/settings/private-keys" className="font-semibold underline underline-offset-2">
                  Settings / Private Keys
                </Link>
                .
              </div>
            ) : null}

            {!deployArtifact?.bytecode ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">This artifact does not include deployable bytecode.</div>
            ) : null}

            <div className="grid gap-3">
              <p className="text-sm font-medium text-slate-700">Constructor Arguments</p>
              <div className="max-h-64 overflow-y-auto pr-1">
                <ContractInputsForm inputs={deployConstructor?.inputs ?? []} values={deployArgumentValues} onChange={updateDeployArgumentValue} />
              </div>
              {deployConstructor?.inputs.length && !isDeploySimulationReady ? (
                <p className="text-xs text-slate-500">Fill all constructor arguments first. Gas and nonce will be simulated automatically after that.</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Txn Type</label>
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
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIP1559">EIP1559</SelectItem>
                    <SelectItem value="LEGACY">LEGACY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Native Value ({environment?.nativeCurrency ?? 'Native'})</label>
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
                  <label className="text-sm font-medium text-slate-700">Gas Price (Gwei)</label>
                  <Input
                    value={deployDialogValues.gasPrice}
                    onChange={(event) =>
                      setDeployDialogValues((current) => ({
                        ...current,
                        gasPrice: event.target.value,
                      }))
                    }
                    placeholder="0.001"
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Max Fee Per Gas (Gwei)</label>
                    <Input
                      value={deployDialogValues.maxFeePerGas}
                      onChange={(event) =>
                        setDeployDialogValues((current) => ({
                          ...current,
                          maxFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="auto"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-700">Max Priority Fee Per Gas (Gwei)</label>
                    <Input
                      value={deployDialogValues.maxPriorityFeePerGas}
                      onChange={(event) =>
                        setDeployDialogValues((current) => ({
                          ...current,
                          maxPriorityFeePerGas: event.target.value,
                        }))
                      }
                      placeholder="auto"
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Gas Limit</label>
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
                <label className="text-sm font-medium text-slate-700">Nonce</label>
                <Input
                  value={deployDialogValues.nonce}
                  onChange={(event) =>
                    setDeployDialogValues((current) => ({
                      ...current,
                      nonce: event.target.value,
                    }))
                  }
                  placeholder="auto"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Binding Label</label>
                <Input value={deployBindingLabel} onChange={(event) => setDeployBindingLabel(event.target.value)} placeholder={deployArtifact?.name ?? 'Binding label'} />
                <p className="text-xs text-slate-500">Leave empty if you do not want to create a binding after deployment.</p>
              </div>
            </div>

            {deployResult ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Deployment Result</p>
                <dl className="mt-3 grid gap-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Contract Address</dt>
                    <dd className="mt-1 text-sm text-slate-900 mono">{deployResult.contractAddress}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Transaction Hash</dt>
                    <dd className="mt-1 text-sm text-slate-900 mono">{deployResult.hash}</dd>
                  </div>
                  {deployResult.bindingError ? <div className="text-sm text-amber-700">{deployResult.bindingError}</div> : null}
                  {deployResult.bindingId ? (
                    <div>
                      <Link
                        href={`/evm/address/${deployResult.contractAddress}?tab=contract&contractTab=read`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
                      >
                        <IconLinkPlus className="size-4" stroke={1.8} />
                        Open Interact
                      </Link>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}

            {deployError ? (
              <div className="max-h-32 overflow-auto rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="break-all whitespace-pre-wrap">{deployError}</p>
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
          title="Unlock Private Key"
          description={activeKey ? `Enter the password for "${activeKey.name}" to continue the deployment flow.` : 'Enter the password to continue.'}
          value={deployUnlockPassword}
          onValueChange={setDeployUnlockPassword}
          placeholder="Password"
          confirmLabel="Unlock"
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
