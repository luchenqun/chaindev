'use client';

import { readActiveRpcProfileCookie } from '@/platform/workbench/rpc-profile-client';

export type CosmosCachedTransactionItem = {
  providerProfileId: string;
  hash: string;
  height: string;
  timestampMs: number | null;
  typeLabel: string;
  sender: string;
  senderLabel: string;
  feeLabel?: string;
  gasUsed: string;
  gasWanted: string;
  status: 'success' | 'failed';
  statusLabel: string;
};

type CosmosCachedTransactionRecord = CosmosCachedTransactionItem & {
  id: string;
  sortTimestamp: number;
};

const DB_NAME = 'chaindev-cosmos-transaction-cache';
const DB_VERSION = 1;
const TRANSACTIONS_STORE = 'transactions';
const BY_PROVIDER_TIMESTAMP_INDEX = 'byProviderTimestamp';

let databasePromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function getSortTimestamp(item: CosmosCachedTransactionItem) {
  if (item.timestampMs != null) {
    return item.timestampMs;
  }

  const height = Number.parseInt(item.height, 10);
  return Number.isFinite(height) ? height : 0;
}

async function getDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        const store = database.createObjectStore(TRANSACTIONS_STORE, {
          keyPath: 'id',
        });
        store.createIndex(BY_PROVIDER_TIMESTAMP_INDEX, ['providerProfileId', 'sortTimestamp']);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });

  return databasePromise;
}

function toRecord(item: CosmosCachedTransactionItem): CosmosCachedTransactionRecord {
  return {
    ...item,
    id: `${item.providerProfileId}:${item.hash}`,
    sortTimestamp: getSortTimestamp(item),
  };
}

export async function rememberCosmosTransactionCache(items: CosmosCachedTransactionItem[]) {
  if (typeof window === 'undefined' || !('indexedDB' in window) || items.length === 0) {
    return items;
  }

  const uniqueItems = [...new Map(items.map((item) => [`${item.providerProfileId}:${item.hash}`, item])).values()];
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, 'readwrite');
  const store = transaction.objectStore(TRANSACTIONS_STORE);

  uniqueItems.forEach((item) => {
    store.put(toRecord(item));
  });

  await waitForTransaction(transaction);
  emitChange();
  return uniqueItems;
}

export async function getRecentCachedCosmosTransactions(limit = 6) {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return [] as CosmosCachedTransactionItem[];
  }

  const profile = readActiveRpcProfileCookie('cosmos');

  if (!profile) {
    return [] as CosmosCachedTransactionItem[];
  }

  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, 'readonly');
  const store = transaction.objectStore(TRANSACTIONS_STORE);
  const index = store.index(BY_PROVIDER_TIMESTAMP_INDEX);
  const range = IDBKeyRange.bound([profile.id, 0], [profile.id, Number.MAX_SAFE_INTEGER]);
  const items = await new Promise<CosmosCachedTransactionItem[]>((resolve, reject) => {
    const request = index.openCursor(range, 'prev');
    const nextItems: CosmosCachedTransactionItem[] = [];

    request.onerror = () => reject(request.error ?? new Error('Failed to read recent cached Cosmos transactions.'));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || nextItems.length >= limit) {
        resolve(nextItems);
        return;
      }

      const value = cursor.value as CosmosCachedTransactionRecord;
      nextItems.push({
        providerProfileId: value.providerProfileId,
        hash: value.hash,
        height: value.height,
        timestampMs: value.timestampMs,
        typeLabel: value.typeLabel,
        sender: value.sender,
        senderLabel: value.senderLabel,
        feeLabel: value.feeLabel,
        gasUsed: value.gasUsed,
        gasWanted: value.gasWanted,
        status: value.status,
        statusLabel: value.statusLabel,
      });
      cursor.continue();
    };
  });

  await waitForTransaction(transaction);
  return items;
}

export function subscribeCosmosTransactionCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
