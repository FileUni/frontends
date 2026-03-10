import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, EyeOff, RefreshCw, AlertTriangle, Check, X } from 'lucide-react';
import { useResolvedTheme } from '../lib/theme';
import { cn } from '../lib/utils';


export type AdminPasswordMode = 'modal' | 'panel';

export interface AdminPasswordPanelProps {
  mode?: AdminPasswordMode;
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm: (password: string) => Promise<void | string | { username?: string }>;
  loading?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  showWarning?: boolean;
  warningTitle?: string;
  warningDescription?: string;
  showRandomGenerator?: boolean;
  minPasswordLength?: number;
  zIndex?: number;
}

const generateRandomPassword = (length = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const AdminPasswordPanel: React.FC<AdminPasswordPanelProps> = ({
  mode = 'panel',
  isOpen = true,
  onClose,
  onConfirm,
  loading = false,
  title,
  description,
  confirmLabel,
  showWarning = false,
  warningTitle,
  warningDescription,
  showRandomGenerator = true,
  minPasswordLength = 8,
  zIndex = 100,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAdminUsername, setSuccessAdminUsername] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const isDark = resolvedTheme === 'dark';

  const resolvedTitle = title || (mode === 'modal' ? t('launcher.reset_admin_password') : t('setup.admin.title'));
  const resolvedDescription = description || (mode === 'modal' ? t('launcher.reset_admin_password_desc') : t('setup.admin.subtitle'));
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  const resolvedWarningTitle = warningTitle || t('setup.admin.finalConfirm');
  const resolvedWarningDescription = warningDescription || t('setup.admin.finalConfirmDesc');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setSuccessAdminUsername(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (mode !== 'modal' || !isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, isOpen, loading, onClose]);

  const handleRandomPassword = useCallback(() => {
    const newPass = generateRandomPassword(16);
    setPassword(newPass);
  }, []);

  const handleConfirm = async () => {
    if (password.length < minPasswordLength) {
      setError(t('launcher.messages.password_too_short') || `Password must be at least ${minPasswordLength} characters`);
      return;
    }
    setError(null);
    const result = await onConfirm(password);
    const resolvedUsername = typeof result === 'string'
      ? result
      : (typeof result === 'object' && result !== null && typeof result.username === 'string' ? result.username : 'admin');
    setSuccessAdminUsername(resolvedUsername);
  };

  const isConfirmDisabled = loading || password.length < minPasswordLength;

  if (!mounted) return null;

  const innerContent = (
    <div className={cn(
      "border overflow-hidden",
      mode === 'panel' ? "bg-card border-border rounded-3xl sm:rounded-[2.5rem] shadow-2xl" : 
      cn(
        "max-w-md w-full animate-in fade-in zoom-in duration-300 rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]",
        isDark ? "bg-slate-950 border-white/10 ring-1 ring-white/5" : "bg-white border-gray-200"
      )
    )}>
      <div className={cn(
        "p-6 sm:p-8 relative",
        mode === 'modal' && (isDark ? "bg-amber-500/5 border-b border-white/5" : "bg-amber-50/50 border-b border-gray-100")
      )}>
        {mode === 'modal' && onClose && (
          <button 
            onClick={onClose}
            className={cn(
              "absolute top-6 right-6 p-2 rounded-xl transition-all",
              isDark ? "hover:bg-white/5 text-slate-500 hover:text-slate-300" : "hover:bg-gray-100 text-slate-400 hover:text-slate-900"
            )}
          >
            <X size={20} />
          </button>
        )}
        <div className={cn("flex items-center gap-4", mode === 'modal' ? "flex-col text-center" : "flex-row")}>
          <div className={cn(
            "shrink-0",
            mode === 'modal' ? cn("p-5 rounded-3xl shadow-inner", isDark ? "bg-amber-500/20 shadow-black/40" : "bg-amber-100 shadow-amber-200/50") : ""
          )}>
            {mode === 'modal' ? (
              <Shield size={40} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <img src="/ui/favicon.svg" alt="FileUni Logo" width={48} height={48} className="shadow-xl" />
            )}
          </div>
          <div className={cn(mode === 'modal' ? "" : "min-w-0")}>
            <h2 className={cn(
              "font-black tracking-tight",
              mode === 'modal' ? "text-2xl" : "text-2xl",
              isDark ? "text-slate-100" : "text-slate-900"
            )}>
              {resolvedTitle}
            </h2>
            <p className={cn("text-sm mt-1 font-medium", isDark ? "text-slate-500" : "text-slate-500")}>
              {resolvedDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
        {error && (
          <div className={cn(
            "p-4 border rounded-2xl text-sm font-bold flex items-center gap-3 animate-in shake duration-300",
            isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-600"
          )}>
            <AlertTriangle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <div className={cn(
          "p-4 border rounded-2xl text-xs font-bold leading-relaxed",
          isDark ? "bg-cyan-500/5 border-cyan-500/10 text-cyan-400" : "bg-cyan-50 border-cyan-100 text-cyan-700"
        )}>
          {t(
            'setup.admin.resetRuleHint',
            'Reset policy: if an admin exists, reset the first admin password; if none exists, create an admin user with username admin.',
          )}
        </div>

        {successAdminUsername && (
          <div className={cn(
            "p-4 border rounded-2xl text-sm font-black flex items-center gap-3",
            isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          )}>
            <Check size={18} className="shrink-0" />
            {t(
              'setup.admin.resetSuccessWithUser',
              { username: successAdminUsername, defaultValue: `Admin password applied. Current admin username: ${successAdminUsername}` },
            )}
          </div>
        )}

        <div className="space-y-2.5">
          <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isDark ? "text-slate-600" : "text-slate-400")}>
            {t('setup.admin.password')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full h-12 px-4 pr-11 rounded-xl font-bold outline-none border transition-all",
                  isDark ? "bg-white/5 border-white/10 text-white focus:border-amber-500/50" : "bg-gray-50 border-gray-200 text-slate-900 focus:border-amber-500"
                )}
                autoFocus={mode === 'modal'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn(
                  "absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors",
                  isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-900"
                )}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {showRandomGenerator && (
              <button
                type="button"
                onClick={handleRandomPassword}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                  isDark ? "bg-white/5 border-white/10 text-slate-400 hover:bg-amber-500 hover:text-white hover:border-amber-500" : "bg-gray-50 border-gray-200 text-slate-500 hover:bg-amber-500 hover:text-white hover:border-amber-500"
                )}
                title={t('setup.admin.generate_password') || 'Generate random password'}
              >
                <RefreshCw size={20} />
              </button>
            )}
          </div>
        </div>

        {showWarning && (
          <div className={cn(
            "p-4 border rounded-2xl flex gap-3 items-start shadow-sm",
            isDark ? "bg-amber-500/5 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-black">{resolvedWarningTitle}</p>
              {resolvedWarningDescription && (
                <p className="text-xs font-bold opacity-80 leading-relaxed">{resolvedWarningDescription}</p>
              )}
            </div>
          </div>
        )}

        <div className={cn(
          "flex gap-3 pt-4 sm:pt-6",
          mode === 'modal' ? "justify-end border-t" : "justify-between",
          isDark ? "border-white/5" : "border-gray-100",
          onClose ? "" : "justify-end"
        )}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={cn(
                "h-12 px-6 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50",
                isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-900"
              )}
            >
              {t('common.cancel')}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={cn(
              "h-12 px-8 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl",
              mode === 'modal'
                ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/25"
                : "bg-primary text-white shadow-primary/25",
              isConfirmDisabled && "opacity-50 cursor-not-allowed grayscale"
            )}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === 'modal') {
    if (!isOpen) return null;
    return (
      <div className={cn(
        "fixed inset-0 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-300",
        isDark ? "bg-black/95" : "bg-slate-900/80"
      )} style={{ zIndex }}>
        {innerContent}
      </div>
    );
  }

  return innerContent;
};
