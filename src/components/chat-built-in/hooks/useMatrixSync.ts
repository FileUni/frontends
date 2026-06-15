import { useEffect } from 'react';
import { useMatrixStore } from '../store/matrixStore';

export function useMatrixSync() {
  const accounts = useMatrixStore((s) => s.accounts);
  const clients = useMatrixStore((s) => s.clients);
  const initAccountSync = useMatrixStore((s) => s.initAccountSync);

  useEffect(() => {
    for (const account of accounts) {
      if (!clients[account.id]) {
        initAccountSync(account.id).catch(() => {});
      }
    }
  }, [accounts, clients, initAccountSync]);
}
