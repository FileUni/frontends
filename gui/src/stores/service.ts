/**
 * Service State Management
 *
 * Uses Zustand to manage global FileUni service state
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

/**
 * Service status types
 */
export type ServiceStatus = 'running' | 'stopped' | 'checking' | 'unknown';

/**
 * Service state interface
 */
interface ServiceState {
  /** Current status */
  status: ServiceStatus;
  /** Whether service is running */
  isRunning: boolean;
  /** Whether operation is in progress */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** App version */
  version: string;
  /** OS type */
  osType: string;
  /** Whether service installation is supported */
  supportService: boolean;
  /** Whether running on NixOS */
  isNixos: boolean;

  // Actions
  /** Get service status */
  fetchStatus: () => Promise<void>;
  /** Start service */
  startService: () => Promise<void>;
  /** Stop service */
  stopService: () => Promise<void>;
  /** Install service */
  installService: (level: 'system' | 'user', autostart: boolean) => Promise<void>;
  /** Uninstall service */
  uninstallService: () => Promise<void>;
  /** Get app info */
  fetchAppInfo: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

/**
 * Service state store
 */
export const useServiceStore = create<ServiceState>((set, get) => ({
  status: 'checking',
  isRunning: false,
  isLoading: false,
  error: null,
  version: '0.1.0',
  osType: 'unknown',
  supportService: false,
  isNixos: false,

  /**
   * Get service status
   */
  fetchStatus: async () => {
    set({ status: 'checking', error: null });
    try {
      const result = await invoke<{ status: string; is_running: boolean }>('get_service_status');
      set({
        status: result.is_running ? 'running' : 'stopped',
        isRunning: result.is_running,
      });
    } catch (err) {
      set({
        status: 'unknown',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  /**
   * Start service
   */
  startService: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke<string>('start_service');
      // Wait for service to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      await get().fetchStatus();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  /**
   * Stop service
   */
  stopService: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke<string>('stop_service');
      // Wait for service to stop
      await new Promise(resolve => setTimeout(resolve, 500));
      await get().fetchStatus();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  /**
   * Install service
   */
  installService: async (level: 'system' | 'user', autostart: boolean) => {
    set({ isLoading: true, error: null });
    try {
      await invoke<string>('install_service', { level, autostart });
      set({ isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  /**
   * Uninstall service
   */
  uninstallService: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke<string>('uninstall_service');
      set({ isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  /**
   * Get app info
   */
  fetchAppInfo: async () => {
    try {
      const [version, osInfo] = await Promise.all([
        invoke<string>('get_app_version'),
        invoke<{ os_type: string; support_service: boolean; nixos_hint: boolean }>('get_os_info'),
      ]);
      
      set({
        version,
        osType: osInfo.os_type,
        supportService: osInfo.support_service,
        isNixos: osInfo.nixos_hint,
      });
    } catch (err) {
      console.error('Failed to fetch app info:', err);
    }
  },

  /**
   * Clear error
   */
  clearError: () => set({ error: null }),
}));
