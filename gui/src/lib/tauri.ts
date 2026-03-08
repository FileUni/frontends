import { invoke as tauriInvoke, isTauri } from '@tauri-apps/api/core';
import { listen as tauriListen, type Event, type UnlistenFn } from '@tauri-apps/api/event';

export const isTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return isTauri();
};

const ensureTauriRuntime = (): void => {
  if (!isTauriRuntime()) {
    throw new Error('Tauri runtime is unavailable in the current context.');
  }
};

export const safeInvoke = async <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  ensureTauriRuntime();
  return tauriInvoke<T>(command, args);
};

export const safeListen = async <T>(
  event: string,
  handler: (event: Event<T>) => void,
): Promise<UnlistenFn> => {
  ensureTauriRuntime();
  return tauriListen<T>(event, handler);
};
