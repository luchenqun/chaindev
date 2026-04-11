"use client";

import {
  IconEdit,
  IconLinkPlus,
  IconLoader2,
  IconPlugConnected,
  IconRocket,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AbiParameter } from "viem";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlashMessage } from "@/components/ui/flash-message";
import { Input } from "@/components/ui/input";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { SecretInputDialog } from "@/components/ui/secret-input-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getContractConstructor } from "@/domains/evm/client/abi-utils";
import {
  createEvmContractArtifact,
  createEvmContractBinding,
  deleteEvmContractArtifact,
  deleteEvmContractBinding,
  listEvmContractArtifacts,
  listEvmContractBindingsByScope,
  parseEvmContractArtifactImportPayload,
  subscribeEvmContractRegistry,
  updateEvmContractArtifact,
  updateEvmContractBinding,
  type EvmContractArtifact,
  type EvmContractBinding,
} from "@/domains/evm/client/contract-registry";
import {
  deployEvmContractDirect,
  getActiveEvmContractEnvironmentDirect,
  prepareEvmContractDeployDirect,
} from "@/domains/evm/client/contract-executor";
import {
  getActiveEvmStoredPrivateKey,
  isEvmStoredPrivateKeyUnlocked,
  resolveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  type EvmStoredPrivateKey,
} from "@/domains/evm/client/keyring";
import { AppShell } from "@/platform/layout/app-shell";

const textareaClassName =
  "min-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400";
const importTextareaClassName =
  "min-h-24 max-h-32 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-400";
type EnvironmentState = {
  providerProfileId: string;
  providerName: string;
  chainId: string;
  nativeCurrency: string;
} | null;

function ContractInputsForm({
  inputs,
  values,
  onChange,
}: {
  inputs: readonly AbiParameter[];
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  if (!inputs.length) {
    return <p className="text-sm text-slate-500">This contract deployment does not require constructor arguments.</p>;
  }

  return (
    <div className="grid gap-3">
      {inputs.map((input, index) => {
        const isComplex = input.type.includes("[") || input.type === "tuple";
        const label = input.name || `arg${index + 1}`;

        return (
          <div key={`${label}-${input.type}-${index}`} className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">
              {label} <span className="text-slate-400">({input.type})</span>
            </label>
            {isComplex ? (
              <textarea
                className={textareaClassName}
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={input.type === "tuple" ? '{"value":"..."}' : '["value"]'}
              />
            ) : (
              <Input
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={input.type === "bool" ? "true or false" : input.type}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export default function EvmContractsRegistryPage() {
  const [environment, setEnvironment] = useState<EnvironmentState>(null);
  const [artifacts, setArtifacts] = useState<EvmContractArtifact[]>([]);
  const [bindings, setBindings] = useState<EvmContractBinding[]>([]);
  const [activeKey, setActiveKey] = useState<EvmStoredPrivateKey | null>(null);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);
  const [artifactForm, setArtifactForm] = useState({
    id: null as string | null,
    name: "",
    abiJson: "",
    bytecode: "",
  });
  const [artifactImportText, setArtifactImportText] = useState("");
  const [bindingForm, setBindingForm] = useState({
    id: null as string | null,
    artifactId: "",
    address: "",
    label: "",
  });
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [deployArtifactId, setDeployArtifactId] = useState<string | null>(null);
  const [deployArgumentValues, setDeployArgumentValues] = useState<string[]>([]);
  const [deployValue, setDeployValue] = useState("");
  const [deployAutoBind, setDeployAutoBind] = useState(true);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployPreview, setDeployPreview] = useState<Awaited<ReturnType<typeof prepareEvmContractDeployDirect>> | null>(null);
  const [deployResult, setDeployResult] = useState<{
    hash: string;
    contractAddress: string;
    bindingId: string | null;
    bindingError: string | null;
  } | null>(null);
  const [deployActionLoading, setDeployActionLoading] = useState<"prepare" | "deploy" | null>(null);
  const [deployUnlockDialogOpen, setDeployUnlockDialogOpen] = useState(false);
  const [deployUnlockPassword, setDeployUnlockPassword] = useState("");
  const [deployUnlockError, setDeployUnlockError] = useState<string | null>(null);
  const [pendingDeployAction, setPendingDeployAction] = useState<"prepare" | "deploy" | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "artifact"; id: string; title: string; description: string }
    | { type: "binding"; id: string; title: string; description: string }
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const environmentRef = useRef<EnvironmentState>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextEnvironment = await getActiveEvmContractEnvironmentDirect();

      if (cancelled) {
        return;
      }

      environmentRef.current = nextEnvironment;
      setEnvironment(nextEnvironment);
      setArtifacts(listEvmContractArtifacts());
      setBindings(listEvmContractBindingsByScope(nextEnvironment.chainId, nextEnvironment.providerProfileId));
      setLoading(false);
    }

    void load();

    const unsubscribe = subscribeEvmContractRegistry(() => {
      setArtifacts(listEvmContractArtifacts());

      if (environmentRef.current) {
        setBindings(
          listEvmContractBindingsByScope(
            environmentRef.current.chainId,
            environmentRef.current.providerProfileId,
          ),
        );
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
        artifactId: "",
        address: "",
        label: "",
      });
      void load();
    };

    window.addEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("chaindev:active-rpc-profile-changed", handleProfileChanged);
    };
  }, []);

  useEffect(() => {
    function loadActiveKey() {
      setActiveKey(getActiveEvmStoredPrivateKey());
    }

    loadActiveKey();

    return subscribeEvmKeyring(loadActiveKey);
  }, []);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [flashMessage]);

  const artifactsById = useMemo(
    () => Object.fromEntries(artifacts.map((artifact) => [artifact.id, artifact])),
    [artifacts],
  );
  const deployArtifact = useMemo(
    () => (deployArtifactId ? artifacts.find((artifact) => artifact.id === deployArtifactId) ?? null : null),
    [artifacts, deployArtifactId],
  );
  const deployConstructor = useMemo(
    () => (deployArtifact ? getContractConstructor(deployArtifact.abiJson) : null),
    [deployArtifact],
  );

  function resetArtifactForm() {
    setArtifactForm({
      id: null,
      name: "",
      abiJson: "",
      bytecode: "",
    });
    setArtifactImportText("");
    setArtifactError(null);
  }

  function resetBindingForm() {
    setBindingForm({
      id: null,
      artifactId: "",
      address: "",
      label: "",
    });
    setBindingError(null);
  }

  function resetDeployState() {
    setDeployArtifactId(null);
    setDeployArgumentValues([]);
    setDeployValue("");
    setDeployAutoBind(true);
    setDeployError(null);
    setDeployPreview(null);
    setDeployResult(null);
    setDeployActionLoading(null);
    setDeployUnlockDialogOpen(false);
    setDeployUnlockPassword("");
    setDeployUnlockError(null);
    setPendingDeployAction(null);
  }

  function startArtifactEdit(artifact: EvmContractArtifact) {
    setArtifactForm({
      id: artifact.id,
      name: artifact.name,
      abiJson: artifact.abiJson,
      bytecode: artifact.bytecode ?? "",
    });
    setArtifactImportText("");
    setArtifactError(null);
    setArtifactDialogOpen(true);
  }

  function startArtifactCreate() {
    resetArtifactForm();
    setArtifactDialogOpen(true);
  }

  function startBindingEdit(binding: EvmContractBinding) {
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
    setBindingForm({
      id: null,
      artifactId: artifact?.id ?? "",
      address: "",
      label: artifact?.name ?? "",
    });
    setBindingError(null);
    setBindingDialogOpen(true);
  }

  function startDeployArtifact(artifact: EvmContractArtifact) {
    setDeployArtifactId(artifact.id);
    const constructorItem = getContractConstructor(artifact.abiJson);
    setDeployArgumentValues(constructorItem.inputs.map(() => ""));
    setDeployValue("");
    setDeployAutoBind(true);
    setDeployError(null);
    setDeployPreview(null);
    setDeployResult(null);
    setDeployActionLoading(null);
    setDeployUnlockDialogOpen(false);
    setDeployUnlockPassword("");
    setDeployUnlockError(null);
    setPendingDeployAction(null);
  }

  function handleSaveArtifact() {
    try {
      if (artifactForm.id) {
        updateEvmContractArtifact(artifactForm.id, artifactForm);
        setFlashMessage({
          title: "Artifact updated",
          description: `"${artifactForm.name.trim()}" was saved successfully.`,
        });
      } else {
        createEvmContractArtifact(artifactForm);
        setFlashMessage({
          title: "Artifact created",
          description: `"${artifactForm.name.trim()}" was added successfully.`,
        });
      }

      resetArtifactForm();
      setArtifactDialogOpen(false);
    } catch (error) {
      setArtifactError(error instanceof Error ? error.message : "Failed to save contract artifact.");
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
      setArtifactError(error instanceof Error ? error.message : "Failed to parse contract artifact.");
    }
  }

  function handleImportInputChange(value: string) {
    setArtifactImportText(value);

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      setArtifactError(null);
      return;
    }

    const looksCompleteJson =
      (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
      (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"));

    if (!looksCompleteJson) {
      return;
    }

    applyImportedArtifact(trimmedValue);
  }

  function handleSaveBinding() {
    if (!environment) {
      setBindingError("No active EVM provider selected.");
      return;
    }

    try {
      if (bindingForm.id) {
        updateEvmContractBinding(bindingForm.id, {
          ...bindingForm,
          chainId: environment.chainId,
          providerProfileId: environment.providerProfileId,
          providerName: environment.providerName,
        });
        setFlashMessage({
          title: "Binding updated",
          description: `"${bindingForm.label.trim() || bindingForm.address}" was updated successfully.`,
        });
      } else {
        createEvmContractBinding({
          ...bindingForm,
          chainId: environment.chainId,
          providerProfileId: environment.providerProfileId,
          providerName: environment.providerName,
        });
        setFlashMessage({
          title: "Binding created",
          description: `"${bindingForm.label.trim() || bindingForm.address}" was added successfully.`,
        });
      }

      resetBindingForm();
      setBindingDialogOpen(false);
    } catch (error) {
      setBindingError(error instanceof Error ? error.message : "Failed to save contract binding.");
    }
  }

  function updateDeployArgumentValue(index: number, value: string) {
    setDeployArgumentValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setDeployPreview(null);
    setDeployResult(null);
    setDeployError(null);
  }

  async function executeDeployAction(action: "prepare" | "deploy") {
    if (!deployArtifact) {
      setDeployError("Select a contract artifact first.");
      return;
    }

    if (!deployArtifact.bytecode) {
      setDeployError("This artifact does not include deployable bytecode.");
      return;
    }

    if (!activeKey) {
      setDeployError("Select a global private key first.");
      return;
    }

    setDeployActionLoading(action);
    setDeployError(null);

    try {
      const privateKey = await resolveEvmStoredPrivateKey(activeKey.id);

      if (action === "prepare") {
        const preview = await prepareEvmContractDeployDirect({
          abiJson: deployArtifact.abiJson,
          bytecode: deployArtifact.bytecode,
          rawArgs: deployArgumentValues,
          privateKey,
          value: deployValue,
        });
        setDeployPreview(preview);
        setDeployResult(null);
        return;
      }

      const result = await deployEvmContractDirect({
        abiJson: deployArtifact.abiJson,
        bytecode: deployArtifact.bytecode,
        rawArgs: deployArgumentValues,
        privateKey,
        value: deployValue,
      });

      let bindingId: string | null = null;
      let deployBindingError: string | null = null;

      if (deployAutoBind && environment) {
        try {
          const binding = createEvmContractBinding({
            artifactId: deployArtifact.id,
            address: result.contractAddress,
            label: deployArtifact.name,
            chainId: environment.chainId,
            providerProfileId: environment.providerProfileId,
            providerName: environment.providerName,
          });
          bindingId = binding.id;
        } catch (error) {
          deployBindingError =
            error instanceof Error ? error.message : "Failed to create a binding for the deployed contract.";
        }
      }

      setFlashMessage({
        title: "Contract deployed",
        description: deployBindingError
          ? `Deployed to ${result.contractAddress}. Binding was not created.`
          : bindingId
            ? `Deployed to ${result.contractAddress} and binding was created.`
            : `Deployed to ${result.contractAddress}.`,
      });
      resetDeployState();
      setDeployPreview(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deploy contract.";

      if (message === "Password is required.") {
        setPendingDeployAction(action);
        setDeployUnlockPassword("");
        setDeployUnlockError(null);
        setDeployUnlockDialogOpen(true);
        return;
      }

      setDeployError(message);
    } finally {
      setDeployActionLoading(null);
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
      setDeployUnlockPassword("");
      setDeployUnlockError(null);
      await executeDeployAction(nextAction);
    } catch (error) {
      setDeployUnlockError(error instanceof Error ? error.message : "Failed to unlock the selected private key.");
    }
  }

  function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      if (deleteTarget.type === "artifact") {
        deleteEvmContractArtifact(deleteTarget.id);

        if (artifactForm.id === deleteTarget.id) {
          resetArtifactForm();
        }
      } else {
        deleteEvmContractBinding(deleteTarget.id);

        if (bindingForm.id === deleteTarget.id) {
          resetBindingForm();
        }
      }

      setDeleteTarget(null);
    } catch (error) {
      if (deleteTarget.type === "artifact") {
        setArtifactError(error instanceof Error ? error.message : "Failed to delete contract artifact.");
      } else {
        setBindingError(error instanceof Error ? error.message : "Failed to delete contract binding.");
      }
    }
  }

  return (
    <AppShell>
      {flashMessage ? (
        <FlashMessage
          title={flashMessage.title}
          description={flashMessage.description}
        />
      ) : null}
      <main className="section-block">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-[1.171875rem] font-semibold text-slate-900">Contract Registry</h1>
              <p className="mt-2 text-sm text-slate-500">
                Store contract artifacts and bind deployed contracts to the active EVM environment.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Provider</p>
                {loading ? <Skeleton className="mt-2 h-4 w-24" /> : <p className="mt-1 text-sm font-semibold text-slate-900">{environment?.providerName ?? "Unavailable"}</p>}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Chain ID</p>
                {loading ? <Skeleton className="mt-2 h-4 w-16" /> : <p className="mt-1 text-sm font-semibold text-slate-900">{environment?.chainId ?? "Unavailable"}</p>}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-lg font-semibold text-slate-900">Saved Artifacts</p>
              <p className="mt-1 text-sm text-slate-500">Reusable ABI and bytecode definitions shared across EVM environments.</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={startArtifactCreate}>
                Add
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Name</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Functions</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Events</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Bytecode</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Updated</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.length ? (
                  artifacts.map((artifact) => (
                    <tr key={artifact.id} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{artifact.name}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{artifact.functionCount}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{artifact.eventCount}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{artifact.bytecode ? "Available" : "Missing"}</td>
                      <td className="px-5 py-3 text-sm text-slate-500">{formatTimestamp(artifact.updatedAt)}</td>
                      <td className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-end gap-0">
                          <ActionIconButton
                            disabled={!artifact.bytecode}
                            className={artifact.bytecode ? "text-slate-400 hover:text-sky-600" : "text-slate-300"}
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
                                type: "artifact",
                                id: artifact.id,
                                title: "Delete Contract Artifact",
                                description: `Delete the artifact "${artifact.name}"?`,
                              })
                            }
                          >
                            <IconTrash className="size-4" stroke={1.8} />
                          </ActionIconButton>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                      No saved artifacts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-lg font-semibold text-slate-900">Bound Contracts</p>
            <p className="mt-1 text-sm text-slate-500">Deployed contracts bound to the active provider and chain scope.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Label</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Address</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Artifact</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Chain ID</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-left text-[13px] font-semibold text-slate-800">Provider</th>
                  <th className="border-b border-slate-200 px-5 py-3 text-right text-[13px] font-semibold text-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bindings.length ? (
                  bindings.map((binding) => (
                    <tr key={binding.id} className="border-t border-slate-200">
                      <td className="px-5 py-3 text-sm font-medium text-slate-900">{binding.label}</td>
                      <td className="px-5 py-3 text-sm">
                        <Link
                          href={`/evm/address/${binding.address}`}
                          className="font-medium text-sky-600 hover:text-sky-700 mono"
                        >
                          {binding.address}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{artifactsById[binding.artifactId]?.name ?? "Missing Artifact"}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{binding.chainId}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{binding.providerName}</td>
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
                                type: "binding",
                                id: binding.id,
                                title: "Delete Bound Contract",
                                description: `Delete the contract binding "${binding.label}"?`,
                              })
                            }
                          >
                            <IconTrash className="size-4" stroke={1.8} />
                          </ActionIconButton>
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

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          title={deleteTarget?.title ?? "Delete"}
          description={deleteTarget?.description}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
        />

        <ModalDialog
          open={artifactDialogOpen}
          onOpenChange={(open) => {
            setArtifactDialogOpen(open);

            if (!open) {
              resetArtifactForm();
            }
          }}
          title={artifactForm.id ? "Edit Artifact" : "Create Artifact"}
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
              <Button type="button" onClick={handleSaveArtifact}>
                {artifactForm.id ? "Update Artifact" : "Save Artifact"}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Import Artifact JSON
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Paste artifact JSON and autofill the form.
                  </p>
                </div>
                {artifactImportText ? (
                  <ActionIconButton
                    className="text-slate-400 hover:text-slate-700"
                    tooltip="Clear import input"
                    aria-label="Clear import input"
                    onClick={() => handleImportInputChange("")}
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
            <Input
              value={artifactForm.name}
              onChange={(event) => setArtifactForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Contract Name"
            />
            <textarea
              className={textareaClassName}
              value={artifactForm.abiJson}
              onChange={(event) => setArtifactForm((current) => ({ ...current, abiJson: event.target.value }))}
              placeholder='[{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"}]'
            />
            <textarea
              className={textareaClassName}
              value={artifactForm.bytecode}
              onChange={(event) => setArtifactForm((current) => ({ ...current, bytecode: event.target.value }))}
              placeholder="Optional bytecode (0x...)"
            />
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
          title={bindingForm.id ? "Edit Binding" : "Bind Contract Address"}
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
              <Button type="button" onClick={handleSaveBinding} disabled={!artifacts.length}>
                {bindingForm.id ? "Update Binding" : "Save Binding"}
              </Button>
            </>
          }
          maxWidthClassName="max-w-xl"
        >
          <div className="grid gap-3">
            <Select
              value={bindingForm.artifactId || undefined}
              onValueChange={(value) => setBindingForm((current) => ({ ...current, artifactId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a contract artifact" />
              </SelectTrigger>
              <SelectContent>
                {artifacts.map((artifact) => (
                  <SelectItem key={artifact.id} value={artifact.id}>
                    {artifact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={bindingForm.address}
              onChange={(event) => setBindingForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Deployed Contract Address"
            />
            <Input
              value={bindingForm.label}
              onChange={(event) => setBindingForm((current) => ({ ...current, label: event.target.value }))}
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
                variant="outline"
                onClick={() => void executeDeployAction("prepare")}
                disabled={!deployArtifact || deployActionLoading !== null || !deployArtifact.bytecode}
              >
                {deployActionLoading === "prepare" ? "Preparing..." : "Preview Deployment"}
              </Button>
              <Button
                type="button"
                onClick={() => void executeDeployAction("deploy")}
                disabled={!deployPreview || deployActionLoading !== null}
                aria-busy={deployActionLoading === "deploy"}
              >
                {deployActionLoading === "deploy" ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  "Deploy Contract"
                )}
              </Button>
            </>
          }
          maxWidthClassName="max-w-3xl"
        >
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Artifact</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{deployArtifact?.name ?? "Unavailable"}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Constructor</p>
                <p className="mt-1 text-sm text-slate-700">
                  {deployConstructor?.inputs.length ? `${deployConstructor.inputs.length} argument(s)` : "No arguments"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Selected Key</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeKey?.name ?? "No Key Selected"}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Environment</p>
                <p className="mt-1 text-sm text-slate-700">
                  {environment ? `${environment.providerName} / Chain ${environment.chainId}` : "Unavailable"}
                </p>
                {activeKey && activeKey.securityMode === "encrypted" && !isEvmStoredPrivateKeyUnlocked(activeKey.id) ? (
                  <p className="mt-2 text-xs text-amber-600">This key is encrypted and will require unlock before deployment.</p>
                ) : null}
              </div>
            </div>

            {!activeKey ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Select a global private key first from{" "}
                <Link href="/evm/settings/private-keys" className="font-semibold underline underline-offset-2">
                  Settings / Private Keys
                </Link>
                .
              </div>
            ) : null}

            {!deployArtifact?.bytecode ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                This artifact does not include deployable bytecode.
              </div>
            ) : null}

            <div className="grid gap-3">
              <p className="text-sm font-medium text-slate-700">Constructor Arguments</p>
              <ContractInputsForm
                inputs={deployConstructor?.inputs ?? []}
                values={deployArgumentValues}
                onChange={updateDeployArgumentValue}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Native Value ({environment?.nativeCurrency ?? "Native"})
                </label>
                <Input
                  value={deployValue}
                  onChange={(event) => {
                    setDeployValue(event.target.value);
                    setDeployPreview(null);
                    setDeployResult(null);
                    setDeployError(null);
                  }}
                  placeholder="0"
                />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={deployAutoBind}
                  onChange={(event) => setDeployAutoBind(event.target.checked)}
                />
                Auto-create binding
              </label>
            </div>

            {deployPreview ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deployment Preview</p>
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">From</dt>
                    <dd className="mt-1 break-all text-sm text-slate-900 mono">{deployPreview.accountAddress}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Estimated Gas</dt>
                    <dd className="mt-1 text-sm text-slate-900">{deployPreview.estimatedGas}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Gas Price</dt>
                    <dd className="mt-1 text-sm text-slate-900">{deployPreview.gasPriceLabel}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Value</dt>
                    <dd className="mt-1 text-sm text-slate-900">{deployPreview.valueLabel}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

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
                  {deployResult.bindingError ? (
                    <div className="text-sm text-amber-700">{deployResult.bindingError}</div>
                  ) : null}
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

            {deployError ? <p className="text-sm text-rose-600">{deployError}</p> : null}
          </div>
        </ModalDialog>

        <SecretInputDialog
          open={deployUnlockDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDeployUnlockDialogOpen(false);
              setDeployUnlockPassword("");
              setDeployUnlockError(null);
              setPendingDeployAction(null);
            }
          }}
          title="Unlock Private Key"
          description={
            activeKey
              ? `Enter the password for "${activeKey.name}" to continue the deployment flow.`
              : "Enter the password to continue."
          }
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
      </main>
    </AppShell>
  );
}
