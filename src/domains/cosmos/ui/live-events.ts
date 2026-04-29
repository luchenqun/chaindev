'use client';

export const COSMOS_TRANSACTIONS_AVAILABLE_EVENT = 'chaindev:cosmos-transactions-available';

export type CosmosTransactionsAvailableEventDetail = {
  height: string;
  txCount: number;
  txHashes?: string[];
};

export function notifyCosmosTransactionsAvailable(detail: CosmosTransactionsAvailableEventDetail) {
  window.dispatchEvent(new CustomEvent<CosmosTransactionsAvailableEventDetail>(COSMOS_TRANSACTIONS_AVAILABLE_EVENT, { detail }));
}
