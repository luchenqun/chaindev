import {
  DEFAULT_COSMOS_RPC_PROFILE,
  DEFAULT_EVM_PRIVATE_KEY_VALUE,
  DEFAULT_EVM_RPC_PROFILE,
} from '@/platform/workbench/defaults';
import { db } from '@/db/client';
import { evmPrivateKeys, rpcProfiles } from '@/db/schema/workbench';
import { createServerEvmPrivateKey } from '@/server/repositories/evm-private-keys';
import { addRpcProfile } from '@/server/repositories/rpc-profiles';
import { eq, sql } from 'drizzle-orm';

export async function seedDefaultWorkbenchForUser(userId: string) {
  const rpcProfileCount =
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(rpcProfiles)
      .where(eq(rpcProfiles.userId, userId))
      .get()?.count ?? 0;

  if (rpcProfileCount === 0) {
    await addRpcProfile({
      userId,
      mode: DEFAULT_EVM_RPC_PROFILE.mode,
      name: DEFAULT_EVM_RPC_PROFILE.name,
      nativeCurrencySymbol: DEFAULT_EVM_RPC_PROFILE.nativeCurrencySymbol,
      rpcUrl: DEFAULT_EVM_RPC_PROFILE.rpcUrl,
      restUrl: DEFAULT_EVM_RPC_PROFILE.restUrl,
      wsUrl: DEFAULT_EVM_RPC_PROFILE.wsUrl,
    });
    await addRpcProfile({
      userId,
      mode: DEFAULT_COSMOS_RPC_PROFILE.mode,
      name: DEFAULT_COSMOS_RPC_PROFILE.name,
      nativeCurrencySymbol: DEFAULT_COSMOS_RPC_PROFILE.nativeCurrencySymbol,
      rpcUrl: DEFAULT_COSMOS_RPC_PROFILE.rpcUrl,
      restUrl: DEFAULT_COSMOS_RPC_PROFILE.restUrl,
      wsUrl: DEFAULT_COSMOS_RPC_PROFILE.wsUrl,
    });
  }

  const privateKeyCount =
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(evmPrivateKeys)
      .where(eq(evmPrivateKeys.userId, userId))
      .get()?.count ?? 0;

  if (privateKeyCount === 0) {
    await createServerEvmPrivateKey({
      userId,
      name: 'Alice',
      privateKey: DEFAULT_EVM_PRIVATE_KEY_VALUE,
      securityMode: 'plain',
    });
  }
}
