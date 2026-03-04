import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, EyeOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
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

  const resolvedTitle = title || (mode === 'modal' ? t('launcher.reset_admin_password') : t('setup.admin.title'));
  const resolvedDescription = description || (mode === 'modal' ? t('launcher.reset_admin_password_desc') : t('setup.admin.subtitle'));
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  const resolvedWarningTitle = warningTitle || t('setup.admin.finalConfirm');
  const resolvedWarningDescription = warningDescription || t('setup.admin.finalConfirmDesc');

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

  const innerContent = (
    <div className={cn(
      "bg-card border border-border rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden",
      mode === 'modal' && "max-w-md w-full animate-in fade-in zoom-in duration-200 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
    )}>
      <div className={cn(
        "p-6 sm:p-8",
        mode === 'modal' && "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border"
      )}>
        <div className={cn("flex items-center gap-4", mode === 'modal' ? "flex-col text-center" : "flex-row")}>
          <div className={cn(
            "shrink-0",
            mode === 'modal' ? "p-4 bg-amber-500/20 rounded-2xl" : ""
          )}>
            {mode === 'modal' ? (
              <Shield size={32} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <img src="/ui/favicon.svg" alt="FileUni Logo" width={48} height={48} className="shadow-xl" />
            )}
          </div>
          <div className={cn(mode === 'modal' ? "" : "min-w-0")}>
            <h2 className={cn(
              "font-bold tracking-tight",
              mode === 'modal' ? "text-xl" : "text-2xl"
            )}>
              {resolvedTitle}
            </h2>
            <p className="opacity-70 text-sm mt-1">{resolvedDescription}</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-4 sm:space-y-6">
        {error && (
          <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="p-3 sm:p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-sm text-cyan-700 dark:text-cyan-300">
          {t(
            'setup.admin.resetRuleHint',
            'Reset policy: if an admin exists, reset the first admin password; if none exists, create an admin user with username admin.',
          )}
        </div>

        {successAdminUsername && (
          <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">
            {t(
              'setup.admin.resetSuccessWithUser',
              { username: successAdminUsername, defaultValue: `Admin password applied. Current admin username: ${successAdminUsername}` },
            )}
          </div>
        )}

        <div className="grid gap-4 grid-cols-1">
          <div className="space-y-2 sm:space-y-3">
            <label className="text-sm sm:text-sm font-semibold uppercase tracking-wide opacity-70">
              {t('setup.admin.password')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 sm:px-4 pr-10 rounded-xl bg-muted/50 border border-border font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus={mode === 'modal'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {showRandomGenerator && (
                <button
                  type="button"
                  onClick={handleRandomPassword}
                  className="w-10 sm:w-11 h-10 sm:h-11 bg-muted/50 hover:bg-primary hover:text-white rounded-xl flex items-center justify-center transition-all border border-border"
                  title={t('setup.admin.generate_password') || 'Generate random password'}
                >
                  <RefreshCw size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {showWarning && (
          <div className="p-3 sm:p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl flex gap-3 text-amber-700 dark:text-amber-400 items-start">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold">{resolvedWarningTitle}</p>
              {resolvedWarningDescription && (
                <p className="text-sm opacity-90">{resolvedWarningDescription}</p>
              )}
            </div>
          </div>
        )}

        <div className={cn(
          "flex gap-3 pt-2 sm:pt-4",
          mode === 'modal' ? "justify-end border-t border-border" : "justify-between",
          onClose ? "" : "justify-end"
        )}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={cn(
                "h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-sm font-semibold transition-all",
                mode === 'modal'
                  ? "text-muted-foreground hover:text-foreground"
                  : "bg-muted/50 border border-border hover:bg-muted"
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
              "h-10 sm:h-11 px-5 sm:px-6 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
              mode === 'modal'
                ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
                : "bg-primary text-primary-foreground",
              isConfirmDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <Check size={16} />
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
      <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4" style={{ zIndex }}>
        {innerContent}
      </div>
    );
  }

  return innerContent;
};
