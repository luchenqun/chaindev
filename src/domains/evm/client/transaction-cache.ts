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

type EvmObservedAccountRecord = {
  addressLower: string;
  address: string;
  firstSeenSort: number;
  lastSeenSort: number;
  lastSeenBlockNumber: string;
  totalTxCount: number;
  inboundCount: number;
  outboundCount: number;
  selfCount: number;
};

export type EvmObservedAccountItem = {
  address: string;
  addressLabel: string;
  totalTxCount: number;
  inboundCount: number;
  outboundCount: number;
  selfCount: number;
  firstSeenTimestampMs: number | null;
  lastSeenTimestampMs: number | null;
  lastSeenBlockNumber: string;
};

export type EvmObservedAccountsPage = {
  page: number;
  pageSize: number;
  totalAccounts: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  accounts: EvmObservedAccountItem[];
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

export type EvmTransactionCacheSummary = {
  totalTransactions: number;
  totalObservedAccounts: number;
  latestSeenTransaction: EvmCachedTransactionItem | null;
};

export type EvmCachedTransactionsPage = {
  page: number;
  pageSize: number;
  totalTransactions: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  transactions: EvmCachedTransactionItem[];
};

export const MAX_CACHED_EVM_TRANSACTIONS = 200_000;

const DB_NAME = "chaindev-evm-transaction-cache";
const DB_VERSION = 2;
const TRANSACTIONS_STORE = "transactions";
const ADDRESS_TRANSACTIONS_STORE = "addressTransactions";
const ADDRESS_SUMMARIES_STORE = "addressSummaries";
const TRANSACTIONS_BY_TIMESTAMP_INDEX = "bySortTimestamp";
const ADDRESS_BY_HASH_INDEX = "byHash";
const ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX = "byAddressAndTimestamp";
const ADDRESS_SUMMARIES_BY_LAST_SEEN_INDEX = "byLastSeen";
const ADDRESS_SUMMARIES_BY_TX_COUNT_INDEX = "byTxCount";

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

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function toPublicTransaction(record: EvmCachedTransactionRecord): EvmCachedTransactionItem {
  return {
    hash: record.hash,
    hashLabel: record.hashLabel,
    blockNumber: record.blockNumber,
    timestampMs: record.timestampMs,
    from: record.from,
    fromLabel: record.fromLabel,
    to: record.to,
    toLabel: record.toLabel,
    methodLabel: record.methodLabel,
    amountLabel: record.amountLabel,
    maxTxCostLabel: record.maxTxCostLabel,
  };
}

function toPublicAccount(record: EvmObservedAccountRecord): EvmObservedAccountItem {
  return {
    address: record.address,
    addressLabel: formatAddressLabel(record.address),
    totalTxCount: record.totalTxCount,
    inboundCount: record.inboundCount,
    outboundCount: record.outboundCount,
    selfCount: record.selfCount,
    firstSeenTimestampMs: record.firstSeenSort || null,
    lastSeenTimestampMs: record.lastSeenSort || null,
    lastSeenBlockNumber: record.lastSeenBlockNumber,
  };
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

        if (!database.objectStoreNames.contains(ADDRESS_SUMMARIES_STORE)) {
          const addressSummariesStore = database.createObjectStore(ADDRESS_SUMMARIES_STORE, {
            keyPath: "addressLower",
          });
          addressSummariesStore.createIndex(
            ADDRESS_SUMMARIES_BY_LAST_SEEN_INDEX,
            ["lastSeenSort", "addressLower"],
          );
          addressSummariesStore.createIndex(
            ADDRESS_SUMMARIES_BY_TX_COUNT_INDEX,
            ["totalTxCount", "lastSeenSort", "addressLower"],
          );
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
  }

  return databasePromise;
}

async function countStore(storeName: string) {
  const database = await getDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const count = await toPromise(transaction.objectStore(storeName).count());
  await waitForTransaction(transaction);
  return count;
}

async function ensureAddressSummariesReady() {
  const [transactionCount, summaryCount] = await Promise.all([
    countStore(TRANSACTIONS_STORE),
    countStore(ADDRESS_SUMMARIES_STORE),
  ]);

  if (transactionCount === 0 || summaryCount > 0) {
    return;
  }

  const database = await getDatabase();
  const readTransaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const transactionsStore = readTransaction.objectStore(TRANSACTIONS_STORE);
  const summaryMap = new Map<string, EvmObservedAccountRecord>();

  await new Promise<void>((resolve, reject) => {
    const request = transactionsStore.openCursor();

    request.onerror = () => reject(request.error ?? new Error("Failed to rebuild address summaries."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve();
        return;
      }

      const transactionRecord = cursor.value as EvmCachedTransactionRecord;
      mergeAddressSummary(summaryMap, transactionRecord);
      cursor.continue();
    };
  });

  await waitForTransaction(readTransaction);

  const writeTransaction = database.transaction(ADDRESS_SUMMARIES_STORE, "readwrite");
  const summariesStore = writeTransaction.objectStore(ADDRESS_SUMMARIES_STORE);
  summariesStore.clear();

  for (const record of summaryMap.values()) {
    summariesStore.put(record);
  }

  await waitForTransaction(writeTransaction);
}

function mergeAddressSummary(summaryMap: Map<string, EvmObservedAccountRecord>, item: EvmCachedTransactionRecord) {
  const fromLower = item.from.toLowerCase();
  const toLower = item.to?.toLowerCase() ?? null;
  const isSelf = toLower != null && toLower === fromLower;

  updateAddressSummary(summaryMap, {
    addressLower: fromLower,
    address: item.from,
    sortTimestamp: item.sortTimestamp,
    blockNumber: item.blockNumber,
    inboundCount: 0,
    outboundCount: isSelf ? 0 : 1,
    selfCount: isSelf ? 1 : 0,
    totalTxCount: 1,
  });

  if (toLower && toLower !== fromLower && item.to) {
    updateAddressSummary(summaryMap, {
      addressLower: toLower,
      address: item.to,
      sortTimestamp: item.sortTimestamp,
      blockNumber: item.blockNumber,
      inboundCount: 1,
      outboundCount: 0,
      selfCount: 0,
      totalTxCount: 1,
    });
  }
}

function updateAddressSummary(
  summaryMap: Map<string, EvmObservedAccountRecord>,
  next: {
    addressLower: string;
    address: string;
    sortTimestamp: number;
    blockNumber: string;
    totalTxCount: number;
    inboundCount: number;
    outboundCount: number;
    selfCount: number;
  },
) {
  const current = summaryMap.get(next.addressLower);

  if (!current) {
    summaryMap.set(next.addressLower, {
      addressLower: next.addressLower,
      address: next.address,
      firstSeenSort: next.sortTimestamp,
      lastSeenSort: next.sortTimestamp,
      lastSeenBlockNumber: next.blockNumber,
      totalTxCount: next.totalTxCount,
      inboundCount: next.inboundCount,
      outboundCount: next.outboundCount,
      selfCount: next.selfCount,
    });
    return;
  }

  current.address = next.address;
  current.totalTxCount += next.totalTxCount;
  current.inboundCount += next.inboundCount;
  current.outboundCount += next.outboundCount;
  current.selfCount += next.selfCount;
  current.firstSeenSort = Math.min(current.firstSeenSort, next.sortTimestamp);

  if (next.sortTimestamp >= current.lastSeenSort) {
    current.lastSeenSort = next.sortTimestamp;
    current.lastSeenBlockNumber = next.blockNumber;
  }
}

async function rebuildAddressSummariesForAddresses(addresses: string[]) {
  if (!addresses.length) {
    return;
  }

  const uniqueAddresses = [...new Set(addresses)];
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE, ADDRESS_SUMMARIES_STORE],
    "readwrite",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);
  const summariesStore = transaction.objectStore(ADDRESS_SUMMARIES_STORE);
  const addressIndex = addressTransactionsStore.index(ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX);

  for (const addressLower of uniqueAddresses) {
    const range = IDBKeyRange.bound(
      [addressLower, 0, ""],
      [addressLower, Number.MAX_SAFE_INTEGER, "\uffff"],
    );
    const summaryMap = new Map<string, EvmObservedAccountRecord>();

    await new Promise<void>((resolve, reject) => {
      const request = addressIndex.openCursor(range);

      request.onerror = () => reject(request.error ?? new Error("Failed to rebuild affected account summaries."));
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();
          return;
        }

        const addressRecord = cursor.value as EvmAddressTransactionRecord;
        const transactionRequest = transactionsStore.get(addressRecord.hash);

        transactionRequest.onerror = () =>
          reject(transactionRequest.error ?? new Error("Failed to read cached transaction during summary rebuild."));
        transactionRequest.onsuccess = () => {
          const cachedTransaction = transactionRequest.result as EvmCachedTransactionRecord | undefined;

          if (cachedTransaction) {
            mergeAddressSummary(summaryMap, cachedTransaction);
          }

          cursor.continue();
        };
      };
    });

    const nextSummary = summaryMap.get(addressLower);

    if (nextSummary) {
      summariesStore.put(nextSummary);
    } else {
      summariesStore.delete(addressLower);
    }
  }

  await waitForTransaction(transaction);
}

async function collectOldestTransactionsToTrim(overflow: number) {
  if (overflow <= 0) {
    return [];
  }

  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTIONS_STORE);
  const index = store.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);

  const items = await new Promise<EvmCachedTransactionRecord[]>((resolve, reject) => {
    const next: EvmCachedTransactionRecord[] = [];
    const request = index.openCursor();

    request.onerror = () => reject(request.error ?? new Error("Failed to scan cached transactions."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || next.length >= overflow) {
        resolve(next);
        return;
      }

      next.push(cursor.value as EvmCachedTransactionRecord);
      cursor.continue();
    };
  });

  await waitForTransaction(transaction);
  return items;
}

async function trimCachedTransactionsIfNeeded() {
  const currentCount = await countStore(TRANSACTIONS_STORE);
  const overflow = currentCount - MAX_CACHED_EVM_TRANSACTIONS;

  if (overflow <= 0) {
    return;
  }

  const recordsToDelete = await collectOldestTransactionsToTrim(overflow);

  if (!recordsToDelete.length) {
    return;
  }

  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE],
    "readwrite",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);
  const addressByHashIndex = addressTransactionsStore.index(ADDRESS_BY_HASH_INDEX);
  const affectedAddresses = new Set<string>();

  for (const record of recordsToDelete) {
    const fromLower = record.from.toLowerCase();
    affectedAddresses.add(fromLower);

    if (record.to) {
      affectedAddresses.add(record.to.toLowerCase());
    }

    transactionsStore.delete(record.hash);

    await new Promise<void>((resolve, reject) => {
      const request = addressByHashIndex.openKeyCursor(IDBKeyRange.only(record.hash));

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
  await rebuildAddressSummariesForAddresses([...affectedAddresses]);
}

export async function rememberEvmTransactionCache(items: EvmCachedTransactionItem[]) {
  if (!items.length) {
    return;
  }

  const uniqueItems = [...new Map(items.map((item) => [item.hash, item])).values()];
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE, ADDRESS_SUMMARIES_STORE],
    "readwrite",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const addressTransactionsStore = transaction.objectStore(ADDRESS_TRANSACTIONS_STORE);
  const summariesStore = transaction.objectStore(ADDRESS_SUMMARIES_STORE);
  const addressSummaryUpdates = new Map<string, EvmObservedAccountRecord>();

  for (const item of uniqueItems) {
    const existingRecord = await toPromise(transactionsStore.get(item.hash));

    if (existingRecord) {
      continue;
    }

    const record: EvmCachedTransactionRecord = {
      ...item,
      sortTimestamp: getSortTimestamp(item),
    };

    transactionsStore.put(record);

    for (const addressRecord of getAddressRecords(record)) {
      addressTransactionsStore.put(addressRecord);
    }

    mergeAddressSummary(addressSummaryUpdates, record);
  }

  for (const nextSummary of addressSummaryUpdates.values()) {
    const currentSummary = (await toPromise(
      summariesStore.get(nextSummary.addressLower),
    )) as EvmObservedAccountRecord | undefined;

    if (currentSummary) {
      updateAddressSummary(new Map([[currentSummary.addressLower, currentSummary]]), {
        addressLower: nextSummary.addressLower,
        address: nextSummary.address,
        sortTimestamp: nextSummary.lastSeenSort,
        blockNumber: nextSummary.lastSeenBlockNumber,
        totalTxCount: nextSummary.totalTxCount,
        inboundCount: nextSummary.inboundCount,
        outboundCount: nextSummary.outboundCount,
        selfCount: nextSummary.selfCount,
      });
      currentSummary.firstSeenSort = Math.min(currentSummary.firstSeenSort, nextSummary.firstSeenSort);
      summariesStore.put(currentSummary);
    } else {
      summariesStore.put(nextSummary);
    }
  }

  await waitForTransaction(transaction);
  await trimCachedTransactionsIfNeeded();
  emitChange();
}

export async function clearEvmTransactionCache() {
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_TRANSACTIONS_STORE, ADDRESS_SUMMARIES_STORE],
    "readwrite",
  );
  transaction.objectStore(TRANSACTIONS_STORE).clear();
  transaction.objectStore(ADDRESS_TRANSACTIONS_STORE).clear();
  transaction.objectStore(ADDRESS_SUMMARIES_STORE).clear();
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

export async function getEvmTransactionCacheSummary(): Promise<EvmTransactionCacheSummary> {
  await ensureAddressSummariesReady();
  const database = await getDatabase();
  const transaction = database.transaction(
    [TRANSACTIONS_STORE, ADDRESS_SUMMARIES_STORE],
    "readonly",
  );
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const summariesStore = transaction.objectStore(ADDRESS_SUMMARIES_STORE);
  const index = transactionsStore.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);

  const [totalTransactions, totalObservedAccounts, latestSeenTransaction] = await Promise.all([
    toPromise(transactionsStore.count()),
    toPromise(summariesStore.count()),
    new Promise<EvmCachedTransactionItem | null>((resolve, reject) => {
      const request = index.openCursor(null, "prev");

      request.onerror = () => reject(request.error ?? new Error("Failed to read cached transaction summary."));
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve(null);
          return;
        }

        resolve(toPublicTransaction(cursor.value as EvmCachedTransactionRecord));
      };
    }),
  ]);

  await waitForTransaction(transaction);

  return {
    totalTransactions,
    totalObservedAccounts,
    latestSeenTransaction,
  };
}

export async function getEvmObservedAccountsPage(
  page = 1,
  pageSize = 25,
): Promise<EvmObservedAccountsPage> {
  await ensureAddressSummariesReady();
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 25;
  const database = await getDatabase();
  const transaction = database.transaction(ADDRESS_SUMMARIES_STORE, "readonly");
  const summariesStore = transaction.objectStore(ADDRESS_SUMMARIES_STORE);
  const index = summariesStore.index(ADDRESS_SUMMARIES_BY_TX_COUNT_INDEX);
  const totalAccounts = await toPromise(summariesStore.count());
  const totalPages = Math.max(1, Math.ceil(totalAccounts / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);
  const offset = (safePage - 1) * normalizedPageSize;

  const accounts = await new Promise<EvmObservedAccountItem[]>((resolve, reject) => {
    const items: EvmObservedAccountItem[] = [];
    let skipped = 0;
    const request = index.openCursor(null, "prev");

    request.onerror = () => reject(request.error ?? new Error("Failed to read observed accounts."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || items.length >= normalizedPageSize) {
        resolve(items);
        return;
      }

      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }

      items.push(toPublicAccount(cursor.value as EvmObservedAccountRecord));
      cursor.continue();
    };
  });

  await waitForTransaction(transaction);

  return {
    page: safePage,
    pageSize: normalizedPageSize,
    totalAccounts,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    accounts,
  };
}

export async function getEvmCachedTransactionsPage(
  page = 1,
  pageSize = 25,
): Promise<EvmCachedTransactionsPage> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 25;
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  const index = transactionsStore.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);
  const totalTransactions = await toPromise(transactionsStore.count());
  const totalPages = Math.max(1, Math.ceil(totalTransactions / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);
  const offset = (safePage - 1) * normalizedPageSize;

  const transactions = await new Promise<EvmCachedTransactionItem[]>((resolve, reject) => {
    const items: EvmCachedTransactionItem[] = [];
    let skipped = 0;
    const request = index.openCursor(null, "prev");

    request.onerror = () => reject(request.error ?? new Error("Failed to read cached transactions."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor || items.length >= normalizedPageSize) {
        resolve(items);
        return;
      }

      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }

      items.push(toPublicTransaction(cursor.value as EvmCachedTransactionRecord));
      cursor.continue();
    };
  });

  await waitForTransaction(transaction);

  return {
    page: safePage,
    pageSize: normalizedPageSize,
    totalTransactions,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    transactions,
  };
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
          const publicTransaction = toPublicTransaction(cachedTransaction);

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
