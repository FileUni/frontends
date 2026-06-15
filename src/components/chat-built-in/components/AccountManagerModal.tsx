import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixStore } from '../store/matrixStore';
import { MatrixLoginView } from './MatrixLoginView';

interface AccountManagerModalProps {
  onClose: () => void;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const accounts = useMatrixStore((s) => s.accounts);
  const activeAccountId = useMatrixStore((s) => s.activeAccountId);
  const switchAccount = useMatrixStore((s) => s.switchAccount);
  const removeAccount = useMatrixStore((s) => s.removeAccount);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleSwitch = (id: string) => {
    switchAccount(id);
    onClose();
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    await removeAccount(id);
    setRemovingId(null);
  };

  const handleLoginSuccess = () => {
    setView('list');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="bg-[#e8ecef] dark:bg-[#1f1f1f] rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#333]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {view === 'add' ? t('chatBuiltIn.login.title') : t('chatBuiltIn.sidebar.accounts')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label={t('chatBuiltIn.sidebar.close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'list' ? (
          <div className="p-3 space-y-1 max-h-[60vh] overflow-y-auto">
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                {t('chatBuiltIn.sidebar.noAccounts')}
              </p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#40a7e3] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {account.label[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">
                      {account.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {account.credentials.userId}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {account.id !== activeAccountId ? (
                      <button
                        type="button"
                        className="px-3 py-1 text-xs rounded-lg bg-[#40a7e3] text-white hover:bg-[#3899d0] transition-colors disabled:opacity-50"
                        onClick={() => handleSwitch(account.id)}
                        disabled={removingId === account.id}
                      >
                        {t('chatBuiltIn.sidebar.switch')}
                      </button>
                    ) : (
                      <span className="px-2 py-1 text-xs text-[#40a7e3] font-medium">
                        {t('chatBuiltIn.sidebar.active')}
                      </span>
                    )}
                    <button
                      type="button"
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                      onClick={() => handleRemove(account.id)}
                      disabled={removingId === account.id}
                      aria-label={t('chatBuiltIn.sidebar.removeAccount')}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}

            {accounts.length < 5 && (
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 text-sm text-[#40a7e3] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors border border-dashed border-gray-300 dark:border-[#444]"
                onClick={() => setView('add')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('chatBuiltIn.sidebar.addAccount')}
              </button>
            )}
          </div>
        ) : (
          <div className="p-5">
            <MatrixLoginView onLogin={handleLoginSuccess} />
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
              >
                {t('chatBuiltIn.sidebar.backToAccounts')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
