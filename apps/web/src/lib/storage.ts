import type { AppState } from "../types";

const dbName = "agent-notifier-local";
const storeName = "state";
const stateKey = "app";
const fallbackKey = "agent-notifier-state";
const storageTimeoutMs = 900;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

export async function readStoredState(): Promise<AppState | null> {
  try {
    if (canUseIndexedDb()) {
      return (
        (await withTimeout(withStore("readonly", (store) => store.get(stateKey)))) ??
        null
      );
    }
  } catch {
    // Fall through to localStorage when IndexedDB is unavailable or blocked.
  }

  try {
    const raw = localStorage.getItem(fallbackKey);
    return raw ? (JSON.parse(raw) as AppState) : null;
  } catch {
    return null;
  }
}

export async function writeStoredState(state: AppState): Promise<void> {
  try {
    if (canUseIndexedDb()) {
      await withTimeout(withStore("readwrite", (store) => store.put(state, stateKey)));
      localStorage.removeItem(fallbackKey);
      return;
    }
  } catch {
    // Fall through to localStorage.
  }

  try {
    localStorage.setItem(fallbackKey, JSON.stringify(state));
  } catch {
    // A blocked fallback store should not prevent the app from rendering.
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("IndexedDB timed out")),
      storageTimeoutMs
    );

    work.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
