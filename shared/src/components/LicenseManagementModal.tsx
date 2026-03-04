//  License Management Modal
//  Standalone modal for viewing license status and applying license keys.

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Shield, Users, Fingerprint, Key, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface LicenseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Whether the current license is valid */
  isValid: boolean;
  /** Current number of users */
  currentUsers: number;
  /** Maximum allowed users */
  maxUsers: number;
  /** Device code (hardware fingerprint) */
  deviceCode: string;
  /** Current license key input value */
  licenseKey: string;
  /** Whether the license is being saved */
  saving: boolean;
  /** Callback when license key changes */
  onLicenseKeyChange: (value: string) => void;
  /** Callback when applying license */
  onApplyLicense: () => void;
  /** Optional: license expiration date */
  expiresAt?: string | null;
  /** Optional: list of enabled features */
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

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg max-h-[90vh] rounded-2xl border border-white/10 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 min-w-0">
            <Key size={18} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h3
                id="license-modal-title"
                className="text-sm sm:text-base font-black uppercase tracking-wide truncate"
              >
                {t('admin.config.quickWizard.steps.license')}
              </h3>
              <p className="text-sm sm:text-sm text-slate-400">
                {t('admin.config.quickWizard.fields.licenseStatus')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-white/15 text-slate-300 hover:bg-white/10 inline-flex items-center justify-center transition-colors"
            aria-label={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Authorization Status */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={18} className={cn(
                  'shrink-0',
                  isValid ? 'text-emerald-400' : 'text-red-400'
                )} />
                <div className="text-sm uppercase opacity-60">
                  {t('admin.config.quickWizard.fields.licenseStatus')}
                </div>
              </div>
              <div className={cn(
                'text-sm font-bold',
                isValid ? 'text-emerald-300' : 'text-red-300'
              )}>
                {isValid
                  ? t('admin.config.quickWizard.options.licenseAuthorized')
                  : t('admin.config.quickWizard.options.licenseUnauthorized')}
              </div>
            </div>

            {/* User Quota */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users size={18} className="text-cyan-400 shrink-0" />
                <div className="text-sm uppercase opacity-60">
                  {t('admin.config.quickWizard.fields.maxUsers')}
                </div>
              </div>
              <div className="text-sm font-bold">
                {currentUsers} / {maxUsers}
              </div>
            </div>

            {/* Hardware Fingerprint */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint size={18} className="text-purple-400 shrink-0" />
                <div className="text-sm uppercase opacity-60">
                  {t('admin.config.quickWizard.fields.hwFingerprint')}
                </div>
              </div>
              <div className="text-sm sm:text-sm font-mono break-all select-all">
                {deviceCode || '-'}
              </div>
            </div>

            {/* Expiration Date (if provided) */}
            {expiresAt && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                <div className="text-sm uppercase opacity-60 mb-1">
                  {t('admin.config.quickWizard.fields.expiresAt') || 'Expires At'}
                </div>
                <div className="text-sm font-bold">
                  {expiresAt}
                </div>
              </div>
            )}

            {/* Enabled Features (if provided) */}
            {features && features.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
                <div className="text-sm uppercase opacity-60 mb-2">
                  {t('admin.config.quickWizard.fields.features') || 'Enabled Features'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="text-sm px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-mono"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* License Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5">
              <Key size={18} />
              {t('admin.config.quickWizard.fields.licenseKey')}
            </label>
            <input
              type="text"
              className="w-full h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              value={licenseKey}
              placeholder={t('admin.config.quickWizard.fields.licenseInputPlaceholder')}
              onChange={(e) => onLicenseKeyChange(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Apply Button */}
          <div className="flex justify-end">
            <button
              type="button"
              className={cn(
                'h-9 px-4 rounded-lg border text-sm sm:text-sm font-bold transition-colors inline-flex items-center gap-2',
                saving || licenseKey.trim().length === 0
                  ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                  : 'border-primary bg-primary text-primary-foreground hover:opacity-90'
              )}
              onClick={onApplyLicense}
              disabled={saving || licenseKey.trim().length === 0}
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {t('admin.config.quickWizard.actions.applyLicense')}
            </button>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="border-t border-white/10 px-4 py-2.5 sm:px-5 bg-black/20">
          <p className="text-sm sm:text-sm text-slate-500">
            {t('admin.config.quickWizard.fields.licenseHint')}
          </p>
        </div>
      </div>
    </div>
  );
};
