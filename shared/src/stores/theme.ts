import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageHub } from '../lib/storageHub';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Global Theme State Management
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: 'fileuni-theme',
      storage: createJSONStorage(() => storageHub.createZustandStorage()),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      }
    }
  )
);

/**
 * Apply theme to DOM
 */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = window.document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.remove('light', 'dark');
  root.classList.add(isDark ? 'dark' : 'light');
}
