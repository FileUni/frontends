import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check } from 'lucide-react';


export interface ConfigPathValidationResult {
  valid: boolean;
  error?: string;
}

export interface RuntimeDirsValue {
  configDir: string;
  appDataDir: string;
}

interface ConfigPathSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPath: (value: RuntimeDirsValue) => Promise<void>;
  onValidatePath: (value: RuntimeDirsValue) => Promise<ConfigPathValidationResult>;
  onBrowsePath: (target: 'config' | 'appData') => Promise<string | null>;
  onPreparePath: (value: RuntimeDirsValue) => Promise<void>;
  canClose?: boolean;
}

export const ConfigPathSelector: React.FC<ConfigPathSelectorProps> = ({
  isOpen,
  onClose,
  onConfirmPath,
  onValidatePath,
  onBrowsePath,
  onPreparePath,
  canClose = true,
}) => {
  const { t } = useTranslation();
  const [configDir, setConfigDir] = useState('');
  const [appDataDir, setAppDataDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractErrorMessage = (errorValue: unknown): string => {
    if (errorValue instanceof Error) {
      return errorValue.message;
    }
    return String(errorValue);
  };

  useEffect(() => {
    if (isOpen) {
      setRunDataDir('');
      setError(null);
      setConfigDir('');
      setAppDataDir('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canClose) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, canClose, onClose]);

  const handleBrowse = async (target: 'config' | 'appData') => {
    try {
      const selected = await onBrowsePath(target);
      if (selected) {
        if (target === 'config') {
          setConfigDir(selected);
        } else {
          setAppDataDir(selected);
        }
        setError(null);
      }
    } catch (errorValue: unknown) {
      setError(extractErrorMessage(errorValue));
    }
  };

  const handleConfirm = async () => {
    const configTrimmed = configDir.trim();
    const appTrimmed = appDataDir.trim();
    if (!configTrimmed || !appTrimmed) {
      setError(t('config_selector.path_required'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = { configDir: configTrimmed, appDataDir: appTrimmed };
      const validation = await onValidatePath(payload);
      if (!validation.valid) {
        setError(validation.error || t('config_selector.invalid_config'));
        return;
      }
      await onPreparePath(payload);
      await onConfirmPath(payload);
    } catch (errorValue: unknown) {
      setError(extractErrorMessage(errorValue));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 text-white">
          <div className="flex items-center gap-4">
            <img src="/ui/favicon.svg" alt="FileUni Logo" width={48} height={48} className="shadow-lg" />
            <div>
              <h2 className="text-lg font-bold">{t('config_selector.title')}</h2>
              <p className="text-sm text-blue-100">{t('config_selector.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-800 dark:text-amber-200">{t('config_selector.no_config_warning')}</p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('config_selector.config_path')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={configDir}
                onChange={(event) => setConfigDir(event.target.value)}
                placeholder={t('config_selector.path_placeholder')}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => void handleBrowse('config')}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors"
              >
                {t('config_selector.browse')}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('config_selector.app_data_path')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appDataDir}
                onChange={(event) => setAppDataDir(event.target.value)}
                placeholder={t('config_selector.app_data_placeholder')}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => void handleBrowse('appData')}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors"
              >
                {t('config_selector.browse')}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-800 text-slate-400">{t('config_selector.or')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setConfigDir('.');
                setAppDataDir('.');
              }}
              className="p-3 text-sm bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-left"
            >
              <span className="font-medium">{t('config_selector.current_dir')}</span>
              <span className="block text-slate-500 mt-1">./</span>
            </button>
            <button
              onClick={() => {
                setConfigDir('~/.config/fileuni');
                setAppDataDir('~/.local/share/fileuni');
              }}
              className="p-3 text-sm bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-left"
            >
              <span className="font-medium">{t('config_selector.home_config')}</span>
              <span className="block text-slate-500 mt-1">~/.config/fileuni</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={!canClose || isSubmitting}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!configDir.trim() || !appDataDir.trim() || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check size={16} />
            {t('config_selector.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
