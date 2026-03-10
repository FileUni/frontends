import { useEffect, useState } from 'react';
import { resolveTheme, useThemeStore, type ResolvedTheme } from '../stores/theme';

const subscribeSystemTheme = (onChange: (theme: ResolvedTheme) => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    onChange(mediaQuery.matches ? 'dark' : 'light');
  };

  update();

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }

  mediaQuery.addListener(update);
  return () => mediaQuery.removeListener(update);
};

export const useResolvedTheme = (): ResolvedTheme => {
  const { theme } = useThemeStore();
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme);
      return undefined;
    }

    return subscribeSystemTheme(setResolvedTheme);
  }, [theme]);

  return resolvedTheme;
};
