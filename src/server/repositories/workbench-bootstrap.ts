import {
  DEFAULT_EVM_PRIVATE_KEY_VALUE,
  DEFAULT_EVM_RPC_PROFILE,
} from "@/platform/workbench/defaults";
import { createServerEvmPrivateKey } from "@/server/repositories/evm-private-keys";
import { addRpcProfile } from "@/server/repositories/rpc-profiles";

export async function seedDefaultWorkbenchForUser(userId: string) {
  await addRpcProfile({
    userId,
    mode: DEFAULT_EVM_RPC_PROFILE.mode,
    name: DEFAULT_EVM_RPC_PROFILE.name,
    nativeCurrencySymbol: DEFAULT_EVM_RPC_PROFILE.nativeCurrencySymbol,
    rpcUrl: DEFAULT_EVM_RPC_PROFILE.rpcUrl,
    restUrl: DEFAULT_EVM_RPC_PROFILE.restUrl,
  });

  await createServerEvmPrivateKey({
    userId,
    name: "Alice",
    privateKey: DEFAULT_EVM_PRIVATE_KEY_VALUE,
    securityMode: "plain",
  });
}
