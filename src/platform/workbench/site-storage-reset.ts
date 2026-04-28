'use client';

const FALLBACK_INDEXED_DB_NAMES = ['chaindev-evm-transaction-cache', 'chaindev-cosmos-transaction-cache'];
const STORAGE_OPERATION_TIMEOUT_MS = 800;

type IndexedDbFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string | null }>>;
};

function withTimeout<T>(task: Promise<T>, timeoutMs = STORAGE_OPERATION_TIMEOUT_MS) {
  return Promise.race([
    task,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(undefined as T), timeoutMs);
    }),
  ]);
}

function getCookieClearPaths() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const paths = new Set(['/']);
  let current = '';

  for (const segment of segments) {
    current += `/${segment}`;
    paths.add(current);
  }

  return [...paths];
}

function clearCookies() {
  const hostnameParts = window.location.hostname.split('.');
  const domains = new Set<string>([window.location.hostname]);

  if (hostnameParts.length > 2) {
    domains.add(`.${hostnameParts.slice(-2).join('.')}`);
  }

  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();

    if (!name) {
      continue;
    }

    for (const path of getCookieClearPaths()) {
      document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax`;

      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=${path}; Domain=${domain}; SameSite=Lax`;
      }
    }
  }
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

async function openIndexedDatabase(name: string) {
  return withTimeout(
    new Promise<IDBDatabase | null>((resolve) => {
      const request = window.indexedDB.open(name);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    }),
  );
}

async function clearIndexedDatabase(name: string) {
  const database = await openIndexedDatabase(name);

  if (!database) {
    return;
  }

  const storeNames = Array.from(database.objectStoreNames);

  if (!storeNames.length) {
    database.close();
    return;
  }

  try {
    const transaction = database.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      transaction.objectStore(storeName).clear();
    }

    await withTimeout(waitForTransaction(transaction));
  } finally {
    database.close();
  }
}

async function deleteIndexedDatabase(name: string) {
  await withTimeout(
    new Promise<void>((resolve) => {
      const request = window.indexedDB.deleteDatabase(name);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    }),
  );
}

async function clearIndexedDatabases() {
  if (!('indexedDB' in window)) {
    return;
  }

  const indexedDb = window.indexedDB as IndexedDbFactoryWithDatabases;
  const listedDatabases = (typeof indexedDb.databases === 'function' ? await withTimeout(indexedDb.databases().catch(() => []), 500) : []) ?? [];
  const databaseNames = new Set([...FALLBACK_INDEXED_DB_NAMES, ...listedDatabases.map((database) => database.name).filter((name): name is string => Boolean(name))]);

  for (const name of databaseNames) {
    await clearIndexedDatabase(name).catch(() => undefined);
    await deleteIndexedDatabase(name).catch(() => undefined);
  }
}

async function clearCacheStorage() {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await window.caches.keys().catch(() => []);
  await Promise.all(cacheNames.map((name) => window.caches.delete(name).catch(() => false)));
}

export async function clearAllChaindevBrowserStorage() {
  await clearCacheStorage();
  await clearIndexedDatabases();

  window.localStorage.clear();
  window.sessionStorage.clear();
  clearCookies();
}
