import { useAuthStore } from "@/stores/auth.ts";
import { storageHub, type CacheEntry } from "@fileuni/shared";

export type CacheScope = "own" | "all";

export interface CacheCategorySummary {
  id: string;
  key_count: number;
  bytes: number;
  supports_own_user: boolean;
  supports_all_users: boolean;
}

export interface CacheScanSummary {
  local_total_keys: number;
  local_total_bytes: number;
  managed_total_keys: number;
  managed_total_bytes: number;
  categories: CacheCategorySummary[];
}

export interface CacheClearResult {
  removed_keys: number;
  freed_bytes: number;
}

interface PersistEnvelope<TState> {
  state?: TState;
}

interface FileManagerPersistState {
  userStates?: Record<string, unknown>;
}

interface AuthPersistState {
  usersMap?: Record<string, unknown>;
  currentUserId?: string | null;
  currentUserData?: unknown;
  isLoggedIn?: boolean;
}

const MANAGED_CATEGORY_IDS = [
  "email_address_book",
  "chat_cache",
  "file_manager_cache",
  "user_session_cache",
  "extension_cache",
  "ui_preferences_cache",
] as const;

export type ManagedCategoryId = (typeof MANAGED_CATEGORY_IDS)[number];

const bytesOf = (rawValue: string): number => {
  return new TextEncoder().encode(rawValue).length;
};

const bytesOfPair = (key: string, value: string): number => {
  return bytesOf(key) + bytesOf(value);
};

const isEmailAddressBookKey = (key: string): boolean => key.startsWith("fileuni_email_contacts_");
const isChatKey = (key: string): boolean => (
  key.startsWith("chat_config_")
  || key.startsWith("chat_history_")
  || key.startsWith("chat_nicknames_")
  || key.startsWith("chat_pending_guests_")
  || key.startsWith("chat_inviter_id_")
);
const isFileManagerKey = (key: string): boolean => key === "fileuni-file-manager-v5";
const isUserSessionKey = (key: string): boolean => key === "fileuni-auth";
const isExtensionKey = (key: string): boolean => key.startsWith("ext-ui-overrides:");
const isUiPreferencesKey = (key: string): boolean => (
  key === "fileuni-theme"
  || key === "fileuni-language"
  || key === "fileuni-language-raw"
);

const belongsToUser = (key: string, userId: string): boolean => {
  if (!userId) {
    return false;
  }
  return (
    key.endsWith(`_${userId}`)
    || key.endsWith(`:${userId}`)
    || key === `fileuni_email_contacts_${userId}`
    || key === `chat_config_${userId}`
    || key === `chat_history_${userId}`
    || key === `chat_nicknames_${userId}`
    || key === `chat_pending_guests_${userId}`
    || key === `chat_inviter_id_${userId}`
    || key === `ext-ui-overrides:${userId}`
  );
};

const pickCategoryId = (key: string): ManagedCategoryId | null => {
  if (isEmailAddressBookKey(key)) return "email_address_book";
  if (isChatKey(key)) return "chat_cache";
  if (isFileManagerKey(key)) return "file_manager_cache";
  if (isUserSessionKey(key)) return "user_session_cache";
  if (isExtensionKey(key)) return "extension_cache";
  if (isUiPreferencesKey(key)) return "ui_preferences_cache";
  return null;
};

const shouldIncludeByScope = (key: string, categoryId: ManagedCategoryId, userId: string, scope: CacheScope): boolean => {
  if (scope === "all") {
    return true;
  }

  if (categoryId === "ui_preferences_cache") {
    return true;
  }

  if (categoryId === "file_manager_cache" || categoryId === "user_session_cache") {
    return true;
  }

  return belongsToUser(key, userId);
};

const listCategoryItems = async (categoryId: ManagedCategoryId, userId: string, scope: CacheScope): Promise<CacheEntry[]> => {
  const allEntries = await storageHub.listAllEntries();
  return allEntries
    .filter((item) => pickCategoryId(item.key) === categoryId)
    .filter((item) => shouldIncludeByScope(item.key, categoryId, userId, scope));
};

const clearFileManagerForOwnUser = async (userId: string): Promise<CacheClearResult> => {
  const key = "fileuni-file-manager-v5";
  const rawValue = await storageHub.getItem(key);
  if (!rawValue) {
    return { removed_keys: 0, freed_bytes: 0 };
  }

  let parsed: PersistEnvelope<FileManagerPersistState> | null = null;
  try {
    parsed = JSON.parse(rawValue) as PersistEnvelope<FileManagerPersistState>;
  } catch {
    await storageHub.removeItem(key);
    return { removed_keys: 1, freed_bytes: bytesOfPair(key, rawValue) };
  }

  const beforeBytes = bytesOfPair(key, rawValue);
  const stateObj = parsed?.state;
  const userStates = stateObj?.userStates;
  if (!stateObj || typeof userStates !== "object" || !userStates || !Object.prototype.hasOwnProperty.call(userStates, userId)) {
    return { removed_keys: 0, freed_bytes: 0 };
  }

  delete (userStates as Record<string, unknown>)[userId];
  const remainingCount = Object.keys(userStates as Record<string, unknown>).length;
  if (remainingCount === 0) {
    await storageHub.removeItem(key);
    return { removed_keys: 1, freed_bytes: beforeBytes };
  }

  const nextRaw = JSON.stringify(parsed);
  await storageHub.setItem(key, nextRaw);
  const afterBytes = bytesOfPair(key, nextRaw);
  return {
    removed_keys: 1,
    freed_bytes: Math.max(0, beforeBytes - afterBytes),
  };
};

const clearUserSessionForOwnUser = async (userId: string): Promise<CacheClearResult> => {
  const key = "fileuni-auth";
  const raw = await storageHub.getItem(key);
  if (!raw) {
    return { removed_keys: 0, freed_bytes: 0 };
  }

  let parsed: PersistEnvelope<AuthPersistState> | null = null;
  try {
    parsed = JSON.parse(raw) as PersistEnvelope<AuthPersistState>;
  } catch {
    await storageHub.removeItem(key);
    return { removed_keys: 1, freed_bytes: bytesOfPair(key, raw) };
  }

  const beforeBytes = bytesOfPair(key, raw);
  const stateObj = parsed?.state;
  if (!stateObj || typeof stateObj !== "object") {
    await storageHub.removeItem(key);
    return { removed_keys: 1, freed_bytes: beforeBytes };
  }

  const usersMap = stateObj.usersMap && typeof stateObj.usersMap === "object"
    ? (stateObj.usersMap as Record<string, unknown>)
    : {};
  if (!Object.prototype.hasOwnProperty.call(usersMap, userId)) {
    return { removed_keys: 0, freed_bytes: 0 };
  }
  delete usersMap[userId];
  stateObj.usersMap = usersMap;

  const remainingIds = Object.keys(usersMap);
  if (stateObj.currentUserId === userId) {
    const nextId = remainingIds.length > 0 ? remainingIds[0] : null;
    stateObj.currentUserId = nextId;
    stateObj.currentUserData = nextId ? usersMap[nextId] || null : null;
    stateObj.isLoggedIn = !!nextId;
    const authStore = useAuthStore.getState();
    if (nextId) {
      authStore.switchUser(nextId);
    } else {
      authStore.logout(userId);
    }
  }

  const nextRaw = JSON.stringify(parsed);
  await storageHub.setItem(key, nextRaw);
  const afterBytes = bytesOfPair(key, nextRaw);
  return {
    removed_keys: 1,
    freed_bytes: Math.max(0, beforeBytes - afterBytes),
  };
};

export const cacheManager = {
  async scan(currentUserId: string): Promise<CacheScanSummary> {
    const allEntries = await storageHub.listAllEntries();
    const categoryStats = await Promise.all(
      MANAGED_CATEGORY_IDS.map(async (categoryId) => {
        const items = await listCategoryItems(categoryId, currentUserId, "all");
        return {
          id: categoryId,
          key_count: items.length,
          bytes: items.reduce((sum, item) => sum + item.bytes, 0),
          supports_own_user: categoryId !== "ui_preferences_cache",
          supports_all_users: true,
        } satisfies CacheCategorySummary;
      }),
    );

    const managedTotalKeys = categoryStats.reduce((sum, item) => sum + item.key_count, 0);
    const managedTotalBytes = categoryStats.reduce((sum, item) => sum + item.bytes, 0);

    return {
      local_total_keys: allEntries.length,
      local_total_bytes: allEntries.reduce((sum, item) => sum + item.bytes, 0),
      managed_total_keys: managedTotalKeys,
      managed_total_bytes: managedTotalBytes,
      categories: categoryStats,
    };
  },

  async clearCategory(categoryId: ManagedCategoryId, scope: CacheScope, currentUserId: string): Promise<CacheClearResult> {
    if (typeof window === "undefined") {
      return { removed_keys: 0, freed_bytes: 0 };
    }

    if (categoryId === "ui_preferences_cache" && scope === "own") {
      return { removed_keys: 0, freed_bytes: 0 };
    }

    if (scope === "own" && categoryId === "file_manager_cache") {
      return clearFileManagerForOwnUser(currentUserId);
    }
    if (scope === "own" && categoryId === "user_session_cache") {
      return clearUserSessionForOwnUser(currentUserId);
    }

    const targetItems = await listCategoryItems(categoryId, currentUserId, scope);
    await storageHub.clearEntries(targetItems);
    return {
      removed_keys: targetItems.length,
      freed_bytes: targetItems.reduce((sum, item) => sum + item.bytes, 0),
    };
  },

  formatBytes(rawBytes: number): string {
    if (rawBytes < 1024) return `${rawBytes} B`;
    if (rawBytes < 1024 * 1024) return `${(rawBytes / 1024).toFixed(1)} KB`;
    if (rawBytes < 1024 * 1024 * 1024) return `${(rawBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(rawBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  },
};
