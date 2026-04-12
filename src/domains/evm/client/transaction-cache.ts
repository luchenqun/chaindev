"use client";

import { resolveEvmTransactionMethodLabel } from "@/domains/evm/client/transaction-decoder";

export type EvmCachedTransactionItem = {
  hash: string;
  hashLabel: string;
  blockNumber: string;
  blockNumberValue: number;
  timestampMs: number | null;
  from: string;
  fromLabel: string;
  fromLower: string;
  to: string | null;
  toLabel: string;
  toLower: string | null;
  methodLabel: string;
  methodKey: string;
  methodSelector: string | null;
  inputData?: string;
  amountLabel: string;
  valueWei: string;
  valueWeiSortKey: string;
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

export type EvmCachedTransactionSearchFilters = {
  fromAddress?: string | null;
  toAddress?: string | null;
  methodQuery?: string | null;
  startTimeMs?: number | null;
  endTimeMs?: number | null;
  startBlockNumber?: number | null;
  endBlockNumber?: number | null;
  minValueWei?: bigint | null;
  maxValueWei?: bigint | null;
};

export const MAX_CACHED_EVM_TRANSACTIONS = 200_000;
export const EVM_VALUE_WEI_SORT_KEY_WIDTH = 80;

const DB_NAME = "chaindev-evm-transaction-cache";
const DB_VERSION = 3;
const TRANSACTIONS_STORE = "transactions";
const ADDRESS_TRANSACTIONS_STORE = "addressTransactions";
const ADDRESS_SUMMARIES_STORE = "addressSummaries";
const TRANSACTIONS_BY_TIMESTAMP_INDEX = "bySortTimestamp";
const TRANSACTIONS_BY_BLOCK_INDEX = "byBlockNumberAndTimestamp";
const TRANSACTIONS_BY_FROM_TIMESTAMP_INDEX = "byFromAndTimestamp";
const TRANSACTIONS_BY_TO_TIMESTAMP_INDEX = "byToAndTimestamp";
const TRANSACTIONS_BY_METHOD_TIMESTAMP_INDEX = "byMethodAndTimestamp";
const TRANSACTIONS_BY_METHOD_SELECTOR_TIMESTAMP_INDEX = "byMethodSelectorAndTimestamp";
const TRANSACTIONS_BY_VALUE_INDEX = "byValueAndTimestamp";
const ADDRESS_BY_HASH_INDEX = "byHash";
const ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX = "byAddressAndTimestamp";
const ADDRESS_SUMMARIES_BY_LAST_SEEN_INDEX = "byLastSeen";
const ADDRESS_SUMMARIES_BY_TX_COUNT_INDEX = "byTxCount";
const CURSOR_MIN_STRING = "";
const CURSOR_MAX_STRING = "\uffff";

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

export function formatEvmValueWeiSortKey(value: bigint | string) {
  const normalized = typeof value === "bigint" ? value.toString() : value;
  return normalized.padStart(EVM_VALUE_WEI_SORT_KEY_WIDTH, "0");
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
    blockNumberValue: record.blockNumberValue,
    timestampMs: record.timestampMs,
    from: record.from,
    fromLabel: record.fromLabel,
    fromLower: record.fromLower,
    to: record.to,
    toLabel: record.toLabel,
    toLower: record.toLower,
    methodLabel: record.methodLabel,
    methodKey: record.methodKey,
    methodSelector: record.methodSelector,
    inputData: record.inputData,
    amountLabel: record.amountLabel,
    valueWei: record.valueWei,
    valueWeiSortKey: record.valueWeiSortKey,
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
        const storeNames = [
          TRANSACTIONS_STORE,
          ADDRESS_TRANSACTIONS_STORE,
          ADDRESS_SUMMARIES_STORE,
        ];
        const hasLegacyStores = storeNames.some((storeName) => database.objectStoreNames.contains(storeName));

        if (hasLegacyStores) {
          storeNames.forEach((storeName) => {
            if (database.objectStoreNames.contains(storeName)) {
              database.deleteObjectStore(storeName);
            }
          });
        }

        const transactionsStore = database.createObjectStore(TRANSACTIONS_STORE, {
          keyPath: "hash",
        });
        transactionsStore.createIndex(TRANSACTIONS_BY_TIMESTAMP_INDEX, ["sortTimestamp", "hash"]);
        transactionsStore.createIndex(TRANSACTIONS_BY_BLOCK_INDEX, ["blockNumberValue", "sortTimestamp", "hash"]);
        transactionsStore.createIndex(TRANSACTIONS_BY_FROM_TIMESTAMP_INDEX, ["fromLower", "sortTimestamp", "hash"]);
        transactionsStore.createIndex(TRANSACTIONS_BY_TO_TIMESTAMP_INDEX, ["toLower", "sortTimestamp", "hash"]);
        transactionsStore.createIndex(TRANSACTIONS_BY_METHOD_TIMESTAMP_INDEX, ["methodKey", "sortTimestamp", "hash"]);
        transactionsStore.createIndex(
          TRANSACTIONS_BY_METHOD_SELECTOR_TIMESTAMP_INDEX,
          ["methodSelector", "sortTimestamp", "hash"],
        );
        transactionsStore.createIndex(TRANSACTIONS_BY_VALUE_INDEX, ["valueWeiSortKey", "sortTimestamp", "hash"]);

        const addressTransactionsStore = database.createObjectStore(ADDRESS_TRANSACTIONS_STORE, {
          keyPath: "id",
        });
        addressTransactionsStore.createIndex(
          ADDRESS_BY_ADDRESS_TIMESTAMP_INDEX,
          ["addressLower", "sortTimestamp", "hash"],
        );
        addressTransactionsStore.createIndex(ADDRESS_BY_HASH_INDEX, "hash");

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
  let changed = false;

  for (const item of uniqueItems) {
    const existingRecord = await toPromise(transactionsStore.get(item.hash));

    if (existingRecord) {
      if (existingRecord.inputData || !item.inputData) {
        continue;
      }

      transactionsStore.put({
        ...existingRecord,
        inputData: item.inputData,
      });
      changed = true;
      continue;
    }

    const record: EvmCachedTransactionRecord = {
      ...item,
      sortTimestamp: getSortTimestamp(item),
    };

    transactionsStore.put(record);
    changed = true;

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

  if (!changed) {
    return;
  }

  await trimCachedTransactionsIfNeeded();
  emitChange();
}

export async function hydrateEvmCachedTransactionInputData(
  items: Array<{ hash: string; inputData: string }>,
) {
  if (!items.length) {
    return;
  }

  const uniqueItems = [...new Map(items.map((item) => [item.hash, item])).values()];
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readwrite");
  const transactionsStore = transaction.objectStore(TRANSACTIONS_STORE);
  let updated = false;

  for (const item of uniqueItems) {
    const existingRecord = await toPromise(transactionsStore.get(item.hash));

    if (!existingRecord || existingRecord.inputData === item.inputData) {
      continue;
    }

    transactionsStore.put({
      ...existingRecord,
      inputData: item.inputData,
    });
    updated = true;
  }

  await waitForTransaction(transaction);

  if (updated) {
    emitChange();
  }
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

function normalizeMethodQuery(query: string | null | undefined) {
  const normalized = query?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function isMethodSelectorQuery(query: string | null | undefined) {
  return Boolean(query && /^0x[0-9a-f]{8}$/i.test(query));
}

function buildTimestampRange(startTimeMs: number | null | undefined, endTimeMs: number | null | undefined) {
  const lower = startTimeMs != null ? Math.max(0, startTimeMs) : 0;
  const upper = endTimeMs != null ? Math.max(lower, endTimeMs) : Number.MAX_SAFE_INTEGER;
  return { lower, upper };
}

function buildSearchCursorRequest(
  store: IDBObjectStore,
  filters: Required<EvmCachedTransactionSearchFilters>,
) {
  const timestampRange = buildTimestampRange(filters.startTimeMs, filters.endTimeMs);

  if (filters.fromAddress) {
    const index = store.index(TRANSACTIONS_BY_FROM_TIMESTAMP_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [filters.fromAddress, timestampRange.lower, CURSOR_MIN_STRING],
        [filters.fromAddress, timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  if (filters.toAddress) {
    const index = store.index(TRANSACTIONS_BY_TO_TIMESTAMP_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [filters.toAddress, timestampRange.lower, CURSOR_MIN_STRING],
        [filters.toAddress, timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  if (filters.methodQuery && isMethodSelectorQuery(filters.methodQuery)) {
    const normalizedMethod = normalizeMethodQuery(filters.methodQuery);
    const index = store.index(TRANSACTIONS_BY_METHOD_SELECTOR_TIMESTAMP_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [normalizedMethod, timestampRange.lower, CURSOR_MIN_STRING],
        [normalizedMethod, timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  if (filters.methodQuery && (filters.methodQuery === "transfer" || filters.methodQuery === "create")) {
    const normalizedMethod = normalizeMethodQuery(filters.methodQuery);
    const index = store.index(TRANSACTIONS_BY_METHOD_TIMESTAMP_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [normalizedMethod, timestampRange.lower, CURSOR_MIN_STRING],
        [normalizedMethod, timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  if (filters.startBlockNumber != null || filters.endBlockNumber != null) {
    const lower = Math.max(0, filters.startBlockNumber ?? 0);
    const upper = Math.max(lower, filters.endBlockNumber ?? Number.MAX_SAFE_INTEGER);
    const index = store.index(TRANSACTIONS_BY_BLOCK_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [lower, timestampRange.lower, CURSOR_MIN_STRING],
        [upper, timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  if (filters.startTimeMs != null || filters.endTimeMs != null) {
    const index = store.index(TRANSACTIONS_BY_TIMESTAMP_INDEX);
    return index.openCursor(
      IDBKeyRange.bound(
        [timestampRange.lower, CURSOR_MIN_STRING],
        [timestampRange.upper, CURSOR_MAX_STRING],
      ),
      "prev",
    );
  }

  return store.index(TRANSACTIONS_BY_TIMESTAMP_INDEX).openCursor(null, "prev");
}

function matchesSearchFilters(
  record: EvmCachedTransactionRecord,
  filters: Required<EvmCachedTransactionSearchFilters>,
) {
  if (filters.fromAddress && record.fromLower !== filters.fromAddress) {
    return false;
  }

  if (filters.toAddress && record.toLower !== filters.toAddress) {
    return false;
  }

  if (filters.methodQuery) {
    const normalizedMethod = normalizeMethodQuery(filters.methodQuery);

    if (!normalizedMethod) {
      return false;
    }

    if (isMethodSelectorQuery(normalizedMethod)) {
      if (record.methodSelector !== normalizedMethod) {
        return false;
      }
    } else {
      const resolvedMethodLabel = resolveEvmTransactionMethodLabel({
        to: record.to,
        inputData: record.inputData,
        fallbackMethodLabel: record.methodLabel,
      }).toLowerCase();

      if (
        !resolvedMethodLabel.includes(normalizedMethod) &&
        !record.methodKey.includes(normalizedMethod)
      ) {
        return false;
      }
    }
  }

  if (filters.startTimeMs != null && (record.timestampMs == null || record.timestampMs < filters.startTimeMs)) {
    return false;
  }

  if (filters.endTimeMs != null && (record.timestampMs == null || record.timestampMs > filters.endTimeMs)) {
    return false;
  }

  if (filters.startBlockNumber != null && record.blockNumberValue < filters.startBlockNumber) {
    return false;
  }

  if (filters.endBlockNumber != null && record.blockNumberValue > filters.endBlockNumber) {
    return false;
  }

  if (filters.minValueWei != null || filters.maxValueWei != null) {
    const valueWei = BigInt(record.valueWei);

    if (filters.minValueWei != null && valueWei < filters.minValueWei) {
      return false;
    }

    if (filters.maxValueWei != null && valueWei > filters.maxValueWei) {
      return false;
    }
  }

  return true;
}

async function collectMatchingTransactionsPage(input: {
  store: IDBObjectStore;
  filters: Required<EvmCachedTransactionSearchFilters>;
  offset: number;
  limit: number;
}) {
  const { store, filters, offset, limit } = input;

  return new Promise<{ totalMatches: number; transactions: EvmCachedTransactionItem[] }>((resolve, reject) => {
    const transactions: EvmCachedTransactionItem[] = [];
    let totalMatches = 0;
    const request = buildSearchCursorRequest(store, filters);

    request.onerror = () => reject(request.error ?? new Error("Failed to search cached transactions."));
    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        resolve({
          totalMatches,
          transactions,
        });
        return;
      }

      const record = cursor.value as EvmCachedTransactionRecord;

      if (matchesSearchFilters(record, filters)) {
        if (totalMatches >= offset && transactions.length < limit) {
          transactions.push(toPublicTransaction(record));
        }

        totalMatches += 1;
      }

      cursor.continue();
    };
  });
}

export async function searchEvmCachedTransactions(
  input: EvmCachedTransactionSearchFilters & {
    page?: number;
    pageSize?: number;
  },
): Promise<EvmCachedTransactionsPage> {
  const normalizedPage = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? Math.floor(input.page ?? 1) : 1;
  const normalizedPageSize =
    Number.isFinite(input.pageSize) && (input.pageSize ?? 0) > 0 ? Math.floor(input.pageSize ?? 25) : 25;
  const filters: Required<EvmCachedTransactionSearchFilters> = {
    fromAddress: input.fromAddress?.trim().toLowerCase() || null,
    toAddress: input.toAddress?.trim().toLowerCase() || null,
    methodQuery: normalizeMethodQuery(input.methodQuery),
    startTimeMs: input.startTimeMs ?? null,
    endTimeMs: input.endTimeMs ?? null,
    startBlockNumber: input.startBlockNumber ?? null,
    endBlockNumber: input.endBlockNumber ?? null,
    minValueWei: input.minValueWei ?? null,
    maxValueWei: input.maxValueWei ?? null,
  };
  const database = await getDatabase();
  const transaction = database.transaction(TRANSACTIONS_STORE, "readonly");
  const store = transaction.objectStore(TRANSACTIONS_STORE);
  const offset = (normalizedPage - 1) * normalizedPageSize;

  let result = await collectMatchingTransactionsPage({
    store,
    filters,
    offset,
    limit: normalizedPageSize,
  });
  const totalPages = Math.max(1, Math.ceil(result.totalMatches / normalizedPageSize));
  const safePage = Math.min(normalizedPage, totalPages);

  if (safePage !== normalizedPage) {
    result = await collectMatchingTransactionsPage({
      store,
      filters,
      offset: (safePage - 1) * normalizedPageSize,
      limit: normalizedPageSize,
    });
  }

  await waitForTransaction(transaction);

  return {
    page: safePage,
    pageSize: normalizedPageSize,
    totalTransactions: result.totalMatches,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    transactions: result.transactions,
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
