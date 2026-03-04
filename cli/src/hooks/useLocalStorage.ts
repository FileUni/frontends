import { useState, useCallback } from 'react';
import { storageHub } from '@fileuni/shared';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = storageHub.getLocalItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        storageHub.setLocalItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.log(error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
