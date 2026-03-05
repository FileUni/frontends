export type CacheTier = "local" | "idb";

export interface CacheEntry {
  key: string;
  value: string;
  bytes: number;
  tier: CacheTier;
}

const DB_NAME = "fileuni_cache_hub";
const DB_VERSION = 1;
const STORE_NAME = "cache_entries";

let dbPromise: Promise<IDBDatabase> | null = null;

const textEncoder = new TextEncoder();

const bytesOf = (rawValue: string): number => textEncoder.encode(rawValue).length;
const bytesOfPair = (key: string, value: string): number => bytesOf(key) + bytesOf(value);

const IDB_KEY_RULES: RegExp[] = [
  /^chat_history_/,
  /^chat_nicknames_/,
  /^chat_pending_guests_/,
  /^fileuni_email_contacts_/,
  /^fileuni-file-manager-v5$/,
];

export const resolveCacheTier = (key: string): CacheTier => {
  if (IDB_KEY_RULES.some((rule) => rule.test(key))) {
    return "idb";
  }
  return "local";
};

const canUseLocalStorage = (): boolean => {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
};

const canUseIndexedDb = (): boolean => {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
};

const openIndexedDb = async (): Promise<IDBDatabase> => {
  if (!canUseIndexedDb()) {
    throw new Error("IndexedDB unavailable");
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        reject(request.error || new Error("Failed to open IndexedDB"));
      };
    });
  }
  return dbPromise;
};

const readIndexedDbValue = async (key: string): Promise<string | null> => {
  const db = await openIndexedDb();
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      const rawValue = request.result;
      resolve(typeof rawValue === "string" ? rawValue : null);
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
  });
};

const writeIndexedDbValue = async (key: string, value: string): Promise<void> => {
  const db = await openIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
  });
};

const removeIndexedDbValue = async (key: string): Promise<void> => {
  const db = await openIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB remove failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB remove aborted"));
  });
};

const listIndexedDbEntries = async (): Promise<CacheEntry[]> => {
  if (!canUseIndexedDb()) {
    return [];
  }
  const db = await openIndexedDb();
  return new Promise<CacheEntry[]>((resolve, reject) => {
    const entries: CacheEntry[] = [];
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      const key = String(cursor.key);
      const value = typeof cursor.value === "string" ? cursor.value : "";
      entries.push({
        key,
        value,
        bytes: bytesOfPair(key, value),
        tier: "idb",
      });
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB cursor failed"));
  });
};

const listLocalEntries = (): CacheEntry[] => {
  if (!canUseLocalStorage()) {
    return [];
  }
  const entries: CacheEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const value = window.localStorage.getItem(key) || "";
    entries.push({
      key,
      value,
      bytes: bytesOfPair(key, value),
      tier: "local",
    });
  }
  return entries;
};

/**
 * Tiered Storage Manager
 */
export const storageHub = {
  getLocalItem(key: string): string | null {
    if (!canUseLocalStorage()) {
      return null;
    }
    return window.localStorage.getItem(key);
  },

  setLocalItem(key: string, value: string): void {
    if (!canUseLocalStorage()) {
      return;
    }
    window.localStorage.setItem(key, value);
  },

  removeLocalItem(key: string): void {
    if (!canUseLocalStorage()) {
      return;
    }
    window.localStorage.removeItem(key);
  },

  async getItem(key: string): Promise<string | null> {
    const tier = resolveCacheTier(key);
    if (tier === "local") {
      return this.getLocalItem(key);
    }
    if (!canUseIndexedDb()) {
      return this.getLocalItem(key);
    }
    return readIndexedDbValue(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    const tier = resolveCacheTier(key);
    if (tier === "local") {
      this.setLocalItem(key, value);
      return;
    }
    if (!canUseIndexedDb()) {
      this.setLocalItem(key, value);
      return;
    }
    await writeIndexedDbValue(key, value);
    this.removeLocalItem(key);
  },

  async removeItem(key: string): Promise<void> {
    const tier = resolveCacheTier(key);
    if (tier === "local") {
      this.removeLocalItem(key);
      return;
    }
    if (!canUseIndexedDb()) {
      this.removeLocalItem(key);
      return;
    }
    await removeIndexedDbValue(key);
    this.removeLocalItem(key);
  },

  async listAllEntries(): Promise<CacheEntry[]> {
    const localEntries = listLocalEntries();
    const idbEntries = await listIndexedDbEntries().catch(() => []);
    return [...localEntries, ...idbEntries];
  },

  async listManagedEntries(): Promise<CacheEntry[]> {
    const allEntries = await storageHub.listAllEntries();
    return allEntries.filter((item: CacheEntry) => {
      const tier = resolveCacheTier(item.key);
      return tier === "idb" || tier === "local";
    });
  },

  async clearEntries(entries: CacheEntry[]): Promise<void> {
    await Promise.all(entries.map((item) => storageHub.removeItem(item.key)));
  },

  createZustandStorage() {
    return {
      getItem: (name: string) => this.getItem(name),
      setItem: (name: string, value: string) => this.setItem(name, value),
      removeItem: (name: string) => this.removeItem(name),
    };
  },
};
