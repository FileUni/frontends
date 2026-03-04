import { create } from 'zustand';
import { storageHub } from '../lib/storageHub';

// Toast types
export type ToastType = 'info' | 'success' | 'warning' | 'error';

// Toast duration types
export type ToastDuration = 'short' | 'normal' | 'long' | 'persistent';

export const DURATION_MAP: Record<ToastDuration, number> = {
  short: 2000,
  normal: 3000,
  long: 5000,
  persistent: Infinity,
};

// Toast configuration options
export interface ToastOptions {
  type?: ToastType;
  duration?: ToastDuration;
  details?: string; // Error details
  showDoNotShowAgain?: boolean; // Show "do not show again" checkbox
  doNotShowAgainKey?: string; // Storage key for do not show again
  userId?: string | number; // User ID for isolated storage
}

// Toast object
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: ToastDuration;
  details?: string;
  showDoNotShowAgain: boolean;
  doNotShowAgainKey?: string;
  userId?: string | number;
  showDetails: boolean; // Whether to show details
  doNotShowAgainChecked: boolean; // Whether "do not show again" is checked
  createdAt: number;
}

// Storage key prefix
const DO_NOT_SHOW_PREFIX = 'fileuni_do_not_show_';

// Get storage key for "do not show again"
const getDoNotShowKey = (key: string, userId?: string | number): string => {
  const userSuffix = userId ? `_${userId}` : '';
  return `${DO_NOT_SHOW_PREFIX}${key}${userSuffix}`;
};

// Check if a toast should be shown
export const shouldShowToast = async (
  key: string,
  userId?: string | number
): Promise<boolean> => {
  const storageKey = getDoNotShowKey(key, userId);
  const value = await storageHub.getItem(storageKey);
  return value !== 'true';
};

// Set "do not show again"
export const setDoNotShowAgain = async (
  key: string,
  userId?: string | number,
  value: boolean = true
): Promise<void> => {
  const storageKey = getDoNotShowKey(key, userId);
  if (value) {
    await storageHub.setItem(storageKey, 'true');
  } else {
    await storageHub.removeItem(storageKey);
  }
};

// Toast state
interface ToastState {
  toasts: Toast[];

  // Add toast (supports both legacy API: addToast(message, type) and new API: addToast(message, options))
  addToast: (message: string, options?: ToastOptions | ToastType) => Promise<void>;

  // Remove toast
  removeToast: (id: string) => void;

  // Toggle details visibility
  toggleDetails: (id: string) => void;

  // Set "do not show again" checked state
  setDoNotShowAgainChecked: (id: string, checked: boolean) => void;

  // Confirm "do not show again" and close
  confirmDoNotShowAgain: (id: string) => Promise<void>;

  // Set do not show again and close
  setDoNotShowAndClose: (id: string) => Promise<void>;

  // Check and show (with "do not show again" feature)
  checkAndShow: (
    message: string,
    key: string,
    userId?: string | number,
    options?: Omit<ToastOptions, 'showDoNotShowAgain' | 'doNotShowAgainKey'>
  ) => Promise<void>;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: async (message: string, options?: ToastOptions) => {
    const {
      type = 'info',
      duration = 'normal',
      details,
      showDoNotShowAgain = false,
      doNotShowAgainKey,
      userId,
    } = options || {};

    const id = Math.random().toString(36).substring(2, 15);

    const toast: Toast = {
      id,
      message,
      type,
      duration,
      showDoNotShowAgain,
      showDetails: false,
      doNotShowAgainChecked: false,
      createdAt: Date.now(),
      ...(details ? { details } : {}),
      ...(doNotShowAgainKey ? { doNotShowAgainKey } : {}),
      ...(userId !== undefined ? { userId } : {}),
    };

    set((state) => ({ toasts: [...state.toasts, toast] }));

    // If not persistent, set auto-close
    if (duration !== 'persistent') {
      const timeout = DURATION_MAP[duration];
      setTimeout(() => {
        get().removeToast(id);
      }, timeout);
    }
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  toggleDetails: (id: string) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, showDetails: !t.showDetails } : t
      ),
    }));
  },

  setDoNotShowAgainChecked: (id: string, checked: boolean) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, doNotShowAgainChecked: checked } : t
      ),
    }));
  },

  confirmDoNotShowAgain: async (id: string) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast && toast.doNotShowAgainKey && toast.doNotShowAgainChecked) {
      await setDoNotShowAgain(toast.doNotShowAgainKey, toast.userId, true);
    }
    get().removeToast(id);
  },

  // Set do not show again and close
  setDoNotShowAndClose: async (id: string) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (toast && toast.doNotShowAgainKey) {
      await setDoNotShowAgain(toast.doNotShowAgainKey, toast.userId, true);
    }
    get().removeToast(id);
  },

  checkAndShow: async (
    message: string,
    key: string,
    userId?: string | number,
    options?: Omit<ToastOptions, 'showDoNotShowAgain' | 'doNotShowAgainKey'>
  ) => {
    const shouldShow = await shouldShowToast(key, userId);
    if (shouldShow) {
      await get().addToast(message, {
        ...options,
        showDoNotShowAgain: true,
        doNotShowAgainKey: key,
        ...(userId !== undefined ? { userId } : {}),
      });
    }
  },
}));

// Convenient toast API
export const toast = {
  // Normal toast
  success: (msg: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(msg, { ...options, type: 'success' }),
  error: (msg: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(msg, { ...options, type: 'error' }),
  info: (msg: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(msg, { ...options, type: 'info' }),
  warning: (msg: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(msg, { ...options, type: 'warning' }),

  // Persistent toast (won't auto-close)
  persistent: {
    success: (msg: string, options?: Omit<ToastOptions, 'type' | 'duration'>) =>
      useToastStore.getState().addToast(msg, { ...options, type: 'success', duration: 'persistent' }),
    error: (msg: string, options?: Omit<ToastOptions, 'type' | 'duration'>) =>
      useToastStore.getState().addToast(msg, { ...options, type: 'error', duration: 'persistent' }),
    info: (msg: string, options?: Omit<ToastOptions, 'type' | 'duration'>) =>
      useToastStore.getState().addToast(msg, { ...options, type: 'info', duration: 'persistent' }),
    warning: (msg: string, options?: Omit<ToastOptions, 'type' | 'duration'>) =>
      useToastStore.getState().addToast(msg, { ...options, type: 'warning', duration: 'persistent' }),
  },

  // Error toast with details
  errorWithDetails: (
    message: string,
    details: string,
    options?: Omit<ToastOptions, 'type' | 'details'>
  ) =>
    useToastStore.getState().addToast(message, {
      ...options,
      type: 'error',
      details,
      duration: options?.duration || 'long',
    }),

  // Check and show (with "do not show again")
  checkAndShow: async (
    message: string,
    key: string,
    userId?: string | number,
    options?: Omit<ToastOptions, 'showDoNotShowAgain' | 'doNotShowAgainKey'>
  ) => {
    await useToastStore.getState().checkAndShow(message, key, userId, options);
  },
};

// Clear "do not show again" settings
export const clearDoNotShowSettings = async (userId?: string | number): Promise<void> => {
  const allEntries = await storageHub.listAllEntries();
  const keysToRemove = allEntries
    .filter((entry) => entry.key.startsWith(DO_NOT_SHOW_PREFIX))
    .filter((entry) => {
      if (!userId) return true;
      return entry.key.endsWith(`_${userId}`);
    });
  
  await Promise.all(keysToRemove.map((entry) => storageHub.removeItem(entry.key)));
};

// Get all "do not show again" settings
export const getDoNotShowSettings = async (
  userId?: string | number
): Promise<{ key: string; value: boolean }[]> => {
  const allEntries = await storageHub.listAllEntries();
  const settings = allEntries
    .filter((entry) => entry.key.startsWith(DO_NOT_SHOW_PREFIX))
    .filter((entry) => {
      if (!userId) return true;
      return entry.key.endsWith(`_${userId}`);
    })
    .map((entry) => ({
      key: entry.key.replace(DO_NOT_SHOW_PREFIX, '').replace(/_\d+$/, ''),
      value: entry.value === 'true',
    }));
  
  return settings;
};
