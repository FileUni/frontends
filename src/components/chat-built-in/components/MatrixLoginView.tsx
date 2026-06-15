import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { useMatrixStore } from '../store/matrixStore';

interface MatrixLoginViewProps {
  onLogin?: () => void;
}

export const MatrixLoginView: React.FC<MatrixLoginViewProps> = ({ onLogin }) => {
  const { t } = useTranslation();
  const [homeserver, setHomeserver] = useState('https://matrix-client.matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useMatrixStore((s) => s.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ homeserverUrl: homeserver, username, password });
      onLogin?.();
    } catch (err) {
      setError((err as Error).message || t('chatBuiltIn.login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-[#40a7e3] flex items-center justify-center mx-auto mb-3">
          <MessageSquare size={28} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('chatBuiltIn.login.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('chatBuiltIn.login.subtitle')}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <input
            type="url"
            placeholder={t('chatBuiltIn.login.homeserverUrl')}
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 outline-none focus:border-[#40a7e3] transition-colors"
            required
          />
        </div>
        <div>
          <input
            type="text"
            placeholder={t('chatBuiltIn.login.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 outline-none focus:border-[#40a7e3] transition-colors"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder={t('chatBuiltIn.login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-500 outline-none focus:border-[#40a7e3] transition-colors"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-[#40a7e3] hover:bg-[#3899d0] disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {loading ? t('chatBuiltIn.login.signingIn') : t('chatBuiltIn.login.signIn')}
        </button>
      </form>

      <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-5">
        <a
          href="https://app.element.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#40a7e3] hover:underline"
        >
          {t('chatBuiltIn.login.register')}
        </a>
      </p>
    </div>
  );
};
