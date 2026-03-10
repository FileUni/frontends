//  License Management Modal
//  Standalone modal for viewing license status and applying license keys.

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Shield, Users, Fingerprint, Key, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResolvedTheme } from '../lib/theme';

export interface LicenseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isValid: boolean;
  currentUsers: number;
  maxUsers: number;
  deviceCode: string;
  licenseKey: string;
  saving: boolean;
  onLicenseKeyChange: (value: string) => void;
  onApplyLicense: () => void;
  expiresAt?: string | null;
  features?: string[];
}

export const LicenseManagementModal: React.FC<LicenseManagementModalProps> = ({
  isOpen,
  onClose,
  isValid,
  currentUsers,
  maxUsers,
  deviceCode,
  licenseKey,
  saving,
  onLicenseKeyChange,
  onApplyLicense,
  expiresAt,
  features,
}) => {
  const { t } = useTranslation();
  const resolvedTheme = useResolvedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className={cn(
          "absolute inset-0 backdrop-blur-2xl transition-all duration-300",
          isDark ? "bg-black/95" : "bg-slate-900/80"
        )} 
        onClick={onClose} 
      />

      <div className={cn(
        "relative w-full max-w-lg max-h-[90vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300",
        isDark ? "bg-slate-950 border-white/10 text-slate-100 ring-1 ring-white/5" : "bg-white border-gray-200 text-slate-900"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-6",
          isDark ? "border-white/10 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "p-2 rounded-lg",
              isDark ? "bg-amber-500/10" : "bg-amber-50"
            )}>
              <Key size={18} className="text-amber-500 shrink-0" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-widest truncate">
                {t('admin.config.quickWizard.steps.license')}
              </h3>
              <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-0.5", isDark ? "text-slate-500" : "text-slate-400")}>
                {t('admin.config.quickWizard.fields.licenseStatus')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "h-8 w-8 rounded-lg border inline-flex items-center justify-center transition-colors",
              isDark ? "border-white/15 text-slate-300 hover:bg-white/10" : "border-gray-200 text-slate-600 hover:bg-gray-100"
            )}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={cn(
              "rounded-xl border p-4 transition-colors",
              isDark ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100 shadow-sm"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={18} className={cn('shrink-0', isValid ? 'text-emerald-500' : 'text-rose-500')} />
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
                  {t('admin.config.quickWizard.fields.licenseStatus')}
                </div>
              </div>
              <div className={cn('text-sm font-black uppercase tracking-tight', isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {isValid
                  ? t('admin.config.quickWizard.options.licenseAuthorized')
                  : t('admin.config.quickWizard.options.licenseUnauthorized')}
              </div>
            </div>

            <div className={cn(
              "rounded-xl border p-4 transition-colors",
              isDark ? "bg-white/[0.02] border-white/5" : "bg-gray-50 border-gray-100 shadow-sm"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-cyan-500 shrink-0" />
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
                  {t('admin.config.quickWizard.fields.maxUsers')}
                </div>
              </div>
              <div className="text-sm font-black font-mono">
                {currentUsers} / {maxUsers}
              </div>
            </div>

            <div className={cn(
              "rounded-xl border p-4 sm:col-span-2 transition-colors",
              isDark ? "bg-black/40 border-white/5" : "bg-zinc-100 border-gray-200 shadow-inner"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint size={18} className="text-purple-500 shrink-0" />
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">
                  {t('admin.config.quickWizard.fields.hwFingerprint')}
                </div>
              </div>
              <div className="text-xs font-mono break-all select-all font-bold opacity-80">
                {deviceCode || '-'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest opacity-40 ml-1 flex items-center gap-2">
              <Key size={14} />
              {t('admin.config.quickWizard.fields.licenseKey')}
            </label>
            <textarea
              className={cn(
                "w-full min-h-[80px] rounded-xl border p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner",
                isDark ? "bg-black/40 border-white/10" : "bg-white border-gray-200"
              )}
              value={licenseKey}
              placeholder={t('admin.config.quickWizard.fields.licenseInputPlaceholder')}
              onChange={(e) => onLicenseKeyChange(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={onApplyLicense}
              disabled={saving || !licenseKey.trim()}
              className="px-8 h-11 rounded-xl shadow-xl shadow-primary/20"
            >
              {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Shield size={18} className="mr-2" />}
              {t('admin.config.quickWizard.actions.applyLicense')}
            </Button>
          </div>
        </div>

        <div className={cn(
          "border-t px-5 py-4",
          isDark ? "border-white/5 bg-black/20 text-slate-500" : "border-gray-100 bg-gray-50 text-slate-400"
        )}>
          <p className="text-xs font-bold leading-relaxed italic">
            {t('admin.config.quickWizard.fields.licenseHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
