import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { cn } from '../lib/utils';


export interface ConfigPathValidationResult {
  valid: boolean;
  error?: string;
}

export interface RuntimeDirsValue {
  configDir: string;
  appDataDir: string;
}

interface RuntimeDirsPreset {
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
  initialValue?: RuntimeDirsValue | undefined;
  currentPreset?: RuntimeDirsPreset | undefined;
  defaultPreset?: RuntimeDirsPreset | undefined;
}

export const ConfigPathSelector: React.FC<ConfigPathSelectorProps> = ({
  isOpen,
  onClose,
  onConfirmPath,
  onValidatePath,
  onBrowsePath,
  onPreparePath,
  canClose = true,
  initialValue,
  currentPreset,
  defaultPreset,
}) => {
  const { t } = useTranslation();
  const [configDir, setConfigDir] = useState('');
  const [appDataDir, setAppDataDir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const extractErrorMessage = (errorValue: unknown): string => {
    if (errorValue instanceof Error) {
      return errorValue.message;
    }
    return String(errorValue);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfigDir(initialValue?.configDir ?? defaultPreset?.configDir ?? '');
      setAppDataDir(initialValue?.appDataDir ?? defaultPreset?.appDataDir ?? '');
      setIsSubmitting(false);
    }
  }, [
    isOpen,
    initialValue?.configDir,
    initialValue?.appDataDir,
    defaultPreset?.configDir,
    defaultPreset?.appDataDir,
  ]);

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

  if (!mounted || !isOpen) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 backdrop-blur-2xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300",
      isDark ? "bg-black/95" : "bg-slate-900/80"
    )}>
      <div className={cn(
        "rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in duration-300",
        isDark ? "bg-slate-950 border border-white/10 ring-1 ring-white/5" : "bg-white border border-gray-200"
      )}>
        <div className="bg-gradient-to-r from-blue-600 to-cyan-700 p-6 text-white relative">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md shadow-inner">
              <img src="/ui/favicon.svg" alt="FileUni Logo" width={48} height={48} className="drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{t('config_selector.title')}</h2>
              <p className="text-sm text-blue-100/80">{t('config_selector.subtitle')}</p>
            </div>
          </div>
          {canClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          <div className={cn(
            "p-4 border rounded-xl flex items-start gap-3",
            isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"
          )}>
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <p className={cn("text-sm font-medium", isDark ? "text-amber-200" : "text-amber-800")}>
              {t('config_selector.no_config_warning')}
            </p>
          </div>

          {error && (
            <div className={cn(
              "p-3 border rounded-xl text-sm font-semibold flex items-center gap-2",
              isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-600"
            )}>
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2.5">
            <label className={cn("text-xs font-black uppercase tracking-[0.1em]", isDark ? "text-slate-500" : "text-slate-400")}>
              {t('config_selector.config_path')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={configDir}
                onChange={(event) => setConfigDir(event.target.value)}
                placeholder={t('config_selector.path_placeholder')}
                className={cn(
                  "flex-1 px-4 py-3 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                  isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-slate-900"
                )}
              />
              <button
                onClick={() => void handleBrowse('config')}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  isDark ? "bg-slate-900 hover:bg-slate-800 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-slate-700"
                )}
              >
                {t('config_selector.browse')}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className={cn("text-xs font-black uppercase tracking-[0.1em]", isDark ? "text-slate-500" : "text-slate-400")}>
              {t('config_selector.app_data_path')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={appDataDir}
                onChange={(event) => setAppDataDir(event.target.value)}
                placeholder={t('config_selector.app_data_placeholder')}
                className={cn(
                  "flex-1 px-4 py-3 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                  isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-slate-900"
                )}
              />
              <button
                onClick={() => void handleBrowse('appData')}
                className={cn(
                  "px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  isDark ? "bg-slate-900 hover:bg-slate-800 text-slate-300" : "bg-gray-100 hover:bg-gray-200 text-slate-700"
                )}
              >
                {t('config_selector.browse')}
              </button>
            </div>
          </div>

          <p className={cn("text-xs font-medium italic", isDark ? "text-slate-600" : "text-slate-400")}>
            {t('config_selector.default_hint')}
          </p>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className={cn("w-full border-t", isDark ? "border-white/5" : "border-gray-100")} />
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.2em]">
              <span className={cn("px-4", isDark ? "bg-slate-950 text-slate-700" : "bg-white text-slate-400")}>
                {t('config_selector.or')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setConfigDir(currentPreset?.configDir ?? '');
                setAppDataDir(currentPreset?.appDataDir ?? '');
              }}
              className={cn(
                "p-4 text-xs border rounded-xl transition-all text-left group",
                isDark ? "bg-white/[0.02] border-white/5 hover:border-white/10" : "bg-gray-50 border-gray-200 hover:bg-white hover:shadow-md"
              )}
            >
              <span className={cn("font-black uppercase tracking-wider block mb-2", isDark ? "text-slate-400" : "text-slate-600")}>
                {t('config_selector.current_dir')}
              </span>
              <span className={cn("block truncate mb-1", isDark ? "text-slate-500" : "text-slate-400")}>{currentPreset?.configDir ?? ''}</span>
              <span className={cn("block truncate", isDark ? "text-slate-500" : "text-slate-400")}>{currentPreset?.appDataDir ?? ''}</span>
            </button>
            <button
              onClick={() => {
                setConfigDir(defaultPreset?.configDir ?? '');
                setAppDataDir(defaultPreset?.appDataDir ?? '');
              }}
              className={cn(
                "p-4 text-xs border rounded-xl transition-all text-left group",
                isDark ? "bg-white/[0.02] border-white/5 hover:border-white/10" : "bg-gray-50 border-gray-200 hover:bg-white hover:shadow-md"
              )}
            >
              <span className={cn("font-black uppercase tracking-wider block mb-2", isDark ? "text-slate-400" : "text-slate-600")}>
                {t('config_selector.default_dir')}
              </span>
              <span className={cn("block truncate mb-1", isDark ? "text-slate-500" : "text-slate-400")}>{defaultPreset?.configDir ?? ''}</span>
              <span className={cn("block truncate", isDark ? "text-slate-500" : "text-slate-400")}>{defaultPreset?.appDataDir ?? ''}</span>
            </button>
          </div>
        </div>

        <div className={cn(
          "flex items-center justify-end gap-3 p-6 border-t",
          isDark ? "border-white/10 bg-black/40" : "border-gray-100 bg-gray-50"
        )}>
          <button
            onClick={onClose}
            disabled={!canClose || isSubmitting}
            className={cn(
              "px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50",
              isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-500 hover:text-slate-900"
            )}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-700 hover:to-cyan-800 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {t('config_selector.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
