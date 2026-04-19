'use client';

import {
  rememberCosmosTransactionCache,
  type CosmosCachedTransactionItem,
} from '@/domains/cosmos/client/transaction-cache';
import {
  decodeCosmosTransactionSummary,
  type DecodedCosmosTransactionSummary,
  type CosmosRestTxResponse,
} from '@/domains/cosmos/client/tx-helpers';
import { getActiveCosmosProvider } from '@/domains/cosmos/client/queries';
type DecodedCosmosHomeTransaction = DecodedCosmosTransactionSummary;

function decodeCosmosHomeTransaction(
  hash: string,
  payload: CosmosRestTxResponse,
): DecodedCosmosHomeTransaction {
  return decodeCosmosTransactionSummary({
    hash,
    payload,
  });
}

export async function decodeCosmosHomeTransactionsByHashes(
  hashes: string[],
) {
  const uniqueHashes = [...new Set(hashes.map((hash) => hash.trim()).filter(Boolean))];

  if (!uniqueHashes.length) {
    return [] as DecodedCosmosHomeTransaction[];
  }

  const profile = getActiveCosmosProvider();
  const results = await Promise.allSettled(
    uniqueHashes.map(async (hash) => {
      const response = await fetch(
        `${profile.restUrl}/cosmos/tx/v1beta1/txs/${hash}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const body = (await response.json()) as CosmosRestTxResponse;
      return decodeCosmosHomeTransaction(hash, body);
    }),
  );
  const transactions = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const cacheCandidates: CosmosCachedTransactionItem[] = transactions.map((transaction) => ({
    providerProfileId: profile.id,
    hash: transaction.hash,
    height: transaction.height,
    timestampMs: transaction.timestampMs,
    typeLabel: transaction.type,
    sender: transaction.sender,
    senderLabel: transaction.senderLabel,
    feeLabel: transaction.feeLabel,
    gasUsed: transaction.gasUsed,
    gasWanted: transaction.gasWanted,
    status: transaction.status,
    statusLabel: transaction.statusLabel,
  }));

  if (cacheCandidates.length) {
    await rememberCosmosTransactionCache(cacheCandidates);
  }

  return transactions;
}
