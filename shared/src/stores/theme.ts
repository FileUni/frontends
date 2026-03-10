import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageHub } from '../lib/storageHub';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const resolveTheme = (theme: Theme): ResolvedTheme => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

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
  const resolved = resolveTheme(theme);
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}
