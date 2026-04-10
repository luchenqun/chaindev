"use client";

export type EvmCachedTransactionItem = {
  hash: string;
  hashLabel: string;
  blockNumber: string;
  timestampMs: number | null;
  from: string;
  fromLabel: string;
  to: string | null;
  toLabel: string;
  methodLabel: string;
  amountLabel: string;
  maxTxCostLabel: string;
};

type EvmCachedTransactionRecord = EvmCachedTransactionItem & {
  sortTimestamp: number;
};

type EvmAddressTransactionRecord = {
  id: string;
  addressLower: string;
  sortTimestamp: number;
  hash: string;
};

export type EvmAddressCacheSnapshot = {
  totalTransactions: number;
  transactions: EvmCachedTransactionItem[];
  latestSeenTransaction: EvmCachedTransactionItem | null;
  firstSeenTransaction: EvmCachedTransactionItem | null;
  inboundCount: number;
  outboundCount: number;
  selfCount: number;
};

export const MAX_CACHED_EVM_TRANSACTIONS = 200_000;

const DB_NAME = "chaindev-evm-transaction-cache";
const DB_VERSION = 1;
const TRANSACTIONS_STORE = "transactions";
const ADDRESS_TRANSACTIONS_STORE = "addressTransactions";
const TRANSACTIONS_BY_TIMESTAMP_INDEX = "bySortTimestamp";
const ADDRESS_BY_HASH_INDEX = "byHash";
const ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX = "byAddressAndTimestamp";

let databasePromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function toPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function getSortTimestamp(item: Pick<EvmCachedTransactionItem, "timestampMs" | "blockNumber">) {
  if (item.timestampMs != null) {
    return item.timestampMs;
  }

  const blockNumber = Number.parseInt(item.blockNumber, 10);
  return Number.isFinite(blockNumber) ? blockNumber : 0;
}

function getAddressRecords(item: EvmCachedTransactionRecord) {
  const records: EvmAddressTransactionRecord[] = [];
  const fromLower = item.from.toLowerCase();
  const toLower = item.to?.toLowerCase() ?? null;

  records.push({
    id: `${fromLower}:${item.hash}`,
    addressLower: fromLower,
    sortTimestamp: item.sortTimestamp,
    hash: item.hash,
  });

  if (toLower && toLower !== fromLower) {
    records.push({
      id: `${toLower}:${item.hash}`,
      addressLower: toLower,
      sortTimestamp: item.sortTimestamp,
      hash: item.hash,
    });
  }

  return records;
}

async function getDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("IndexedDB is unavailable in this environment.");
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
          const transactionsStore = database.createObjectStore(TRANSACTIONS_STORE, {
            keyPath: "hash",
          });
          transactionsStore.createIndex(TRANSACTIONS_BY_TIMESTAMP_INDEX, ["sortTimestamp", "hash"]);
        }

        if (!database.objectStoreNames.contains(ADDRESS_TRANSACTIONS_STORE)) {
          const addressTransactionsStore = database.createObjectStore(ADDRESS_TRANSACTIONS_STORE, {
            keyPath: "id",
          });
          addressTransactionsStore.createIndex(
            ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX,
            ["addressLower", "sortTimestamp", "hash"],
          );
          addressTransactionsStore.createIndex(ADDRESS_BY_HASH_INDEX, "hash");
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
  }

  return databasePromise;
}

async function collectOldestTransactionHashesToTrim(overflow: number) {
  if (overflow <= 0) {
    return [];
  }

  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTIONS_STORE);
  const index = store.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);

  const hashes = await new Promise<string[]>((resolve, reject) => {
    const next: string[] = [];
    const request = index.openCursor();

    request.onerror = () => reject(request.error ?? new Error("Failed to scan cached transactions."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || next.length >= overflow) {
        resolve(next);
        return;
      }

      const value = cursor.value as EvmCachedTransactionRecord;
      next.push(value.hash);
      cursor.continue();
    };
  });

  await waitForTransaction(transaction);
  return hashes;
}

async function trimCachedTransactionsIfNeeded() {
  const database = await getDatabase();
  const countTransaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const currentCount = await toPromise(countTransaction.objectStore(TRANSACTIONS_STORE).count());
  await waitForTransaction(countTransaction);

  const overflow = currentCount - MAX_CACHED_EVM_TRANSACTIONS;

  if (overflow <= 0) {
    return;
  }

  const hashesToDelete = await collectOldestTransactionHashesToTrim(overflow);

  if (!hashesToDelete.length) {
    return;
  }

  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE],
    "readwrite",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);
  const addressByHashIndex = addressTransactionsStore.index(ADDRESS_BY_HASH_INDEX);

  for (const hash of hashesToDelete) {
    transactionsStore.delete(hash);

    await new Promise<void>((resolve, reject) => {
      const request = addressByHashIndex.openKeyCursor(IDBKeyRange.only(hash));

      request.onerror = () => reject(request.error ?? new Error("Failed to trim cached address records."));
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        addressTransactionsStore.delete(cursor.primaryKey);
        cursor.continue();
      };
    });
  }

  await waitForTransaction(transaction);
}

export async function rememberEvmTransactionCache(items: EvmCachedTransactionItem[]) {
  if (!items.length) {
    return;
  }

  const uniqueItems = [...new Map(items.map((item) => [item.hash, item])).values()];
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE],
    "readwrite",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);

  for (const item of uniqueItems) {
    const record: EvmCachedTransactionRecord = {
      ...item,
      sortTimestamp: getSortTimestamp(item),
    };

    transactionsStore.put(record);

    for (const addressRecord of getAddressRecords(record)) {
      addressTransactionsStore.put(addressRecord);
    }
  }

  await waitForTransaction(transaction);
  await trimCachedTransactionsIfNeeded();
  emitChange();
}

export async function clearEvmTransactionCache() {
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE],
    "readwrite",
  );
  transaction.objectStore(TRANSACTIONS_STORE).clear();
  transaction.objectStore(ADDRESS_TRANSACTIONS_STORE).clear();
  await waitForTransaction(transaction);
  emitChange();
}

export async function hasEvmCachedTransaction(hash: string) {
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const request = transaction.objectStore(TRANSACTIONS_STORE).get(hash);
  const result = await toPromise(request);
  await waitForTransaction(transaction);
  return result != null;
}

export async function getLatestCachedTransactionHash() {
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTIONS_STORE);
  const index = store.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);

  const latestHash = await new Promise<string | null>((resolve, reject) => {
    const request = index.openCursor(null, "prev");

    request.onerror = () => reject(request.error ?? new Error("Failed to read latest cached transaction."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve(null);
        return;
      }

      const value = cursor.value as EvmCachedTransactionRecord;
      resolve(value.hash);
    };
  });

  await waitForTransaction(transaction);
  return latestHash;
}

export async function getEvmAddressCacheSnapshot(
  address: string,
  limit = 25,
): Promise<EvmAddressCacheSnapshot> {
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE],
    "readonly",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);
  const addressIndex = addressTransactionsStore.index(ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX);
  const addressLower = address.toLowerCase();
  const range = IDBKeyRange.bound(
    [addressLower, 0, ""],
    [addressLower, Number.MAX_SAFE_INTEGER, "\uffff"],
  );

  const snapshot = await new Promise<EvmAddressCacheSnapshot>((resolve, reject) => {
    const request = addressIndex.openCursor(range, "prev");
    const transactions: EvmCachedTransactionItem[] = [];
    let totalTransactions = 0;
    let inboundCount = 0;
    let outboundCount = 0;
    let selfCount = 0;
    let latestSeenTransaction: EvmCachedTransactionItem | null = null;
    let firstSeenTransaction: EvmCachedTransactionItem | null = null;

    request.onerror = () => reject(request.error ?? new Error("Failed to read cached address transactions."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({
          totalTransactions,
          transactions,
          latestSeenTransaction,
          firstSeenTransaction,
          inboundCount,
          outboundCount,
          selfCount,
        });
        return;
      }

      const addressRecord = cursor.value as EvmAddressTransactionRecord;
      const transactionRequest = transactionsStore.get(addressRecord.hash);

      transactionRequest.onerror = () => reject(transactionRequest.error ?? new Error("Failed to read cached transaction."));
      transactionRequest.onsuccess = () => {
        const cachedTransaction = transactionRequest.result as EvmCachedTransactionRecord | undefined;

        if (cachedTransaction) {
          const publicTransaction: EvmCachedTransactionItem = {
            hash: cachedTransaction.hash,
            hashLabel: cachedTransaction.hashLabel,
            blockNumber: cachedTransaction.blockNumber,
            timestampMs: cachedTransaction.timestampMs,
            from: cachedTransaction.from,
            fromLabel: cachedTransaction.fromLabel,
            to: cachedTransaction.to,
            toLabel: cachedTransaction.toLabel,
            methodLabel: cachedTransaction.methodLabel,
            amountLabel: cachedTransaction.amountLabel,
            maxTxCostLabel: cachedTransaction.maxTxCostLabel,
          };

          totalTransactions += 1;

          const fromMatches = publicTransaction.from.toLowerCase() === addressLower;
          const toMatches = publicTransaction.to?.toLowerCase() === addressLower;

          if (fromMatches && toMatches) {
            selfCount += 1;
          } else if (fromMatches) {
            outboundCount += 1;
          } else if (toMatches) {
            inboundCount += 1;
          }

          if (!latestSeenTransaction) {
            latestSeenTransaction = publicTransaction;
          }

          firstSeenTransaction = publicTransaction;

          if (transactions.length < limit) {
            transactions.push(publicTransaction);
          }
        }

        cursor.continue();
      };
    };
  });

  await waitForTransaction(transaction);
  return snapshot;
}

export function subscribeEvmTransactionCache(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
