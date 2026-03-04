import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  configDir: string | null;
  appDataDir: string | null;
  hasSelectedRuntimeDirs: boolean;
  setRuntimeDirs: (configDir: string, appDataDir: string) => void;
  clearRuntimeDirs: () => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      configDir: null,
      appDataDir: null,
      hasSelectedRuntimeDirs: false,
      setRuntimeDirs: (configDir: string, appDataDir: string) => set({
        configDir,
        appDataDir,
        hasSelectedRuntimeDirs: true
      }),
      clearRuntimeDirs: () => set({
        configDir: null,
        appDataDir: null,
        hasSelectedRuntimeDirs: false
      }),
    }),
    {
      name: 'fileuni-config-storage',
    }
  )
);
