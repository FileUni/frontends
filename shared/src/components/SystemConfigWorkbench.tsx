import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, WandSparkles } from 'lucide-react';
import { ConfigEditorPanel } from './ConfigEditorPanel';
import { ConfigQuickWizardModal, type ConfigQuickWizardModalProps } from './ConfigQuickWizardModal';
import type { ConfigError, ConfigNoteEntry } from './ConfigRawEditor';
import { useThemeStore } from '../stores/theme';
import { cn } from '../lib/utils';

type LineDiffStats = {
  changed: number;
  added: number;
  removed: number;
};

const calculateLineDiffStats = (before: string, after: string): LineDiffStats => {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (let i = 0; i < maxLen; i += 1) {
    const oldLine = beforeLines[i];
    const newLine = afterLines[i];
    if (oldLine === undefined && newLine !== undefined) {
      added += 1;
    } else if (oldLine !== undefined && newLine === undefined) {
      removed += 1;
    } else if (oldLine !== newLine) {
      changed += 1;
    }
  }

  return { changed, added, removed };
};

export interface SystemConfigWorkbenchProps {
  tomlAdapter: ConfigQuickWizardModalProps['tomlAdapter'];
  loading: boolean;
  configPath?: string | null;
  content: string;
  savedContent: string;
  notes: Record<string, ConfigNoteEntry>;
  validationErrors: ConfigError[];
  busy: boolean;
  onChange: (value: string) => void;
  onTest: () => void;
  onSave: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  reloadSummary?: string;
  reloadSummaryLevel?: 'success' | 'warning' | 'error' | 'info';
  quickWizardLicense?: ConfigQuickWizardModalProps['licenseWizard'];
  quickWizardEnabled?: boolean;
  runtimeOs?: string;
  onClearValidationErrors?: () => void;
  onResetAdminPassword?: (password: string) => Promise<void | string | { username?: string }>;
  isResettingAdminPassword?: boolean;
}

export const SystemConfigWorkbench: React.FC<SystemConfigWorkbenchProps> = ({
  tomlAdapter,
  loading,
  configPath,
  content,
  savedContent,
  notes,
  validationErrors,
  busy,
  onChange,
  onTest,
  onSave,
  onCancel,
  showCancel = false,
  reloadSummary = '',
  reloadSummaryLevel = 'info',
  quickWizardLicense,
  quickWizardEnabled = true,
  runtimeOs,
  onClearValidationErrors,
  onResetAdminPassword,
  isResettingAdminPassword,
}) => {
  const { t } = useTranslation();
  const [isQuickWizardOpen, setIsQuickWizardOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useThemeStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isDirty = content !== savedContent;
  const pendingDiffStats = useMemo(() => calculateLineDiffStats(savedContent, content), [savedContent, content]);

  if (loading) {
    return (
      <div className={cn(
        "h-64 flex items-center justify-center font-black animate-pulse uppercase tracking-widest",
        isDark ? "text-white opacity-50" : "text-slate-900 opacity-40"
      )}>
        {t('admin.config.loading')}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col rounded-2xl sm:rounded-[2.5rem] border p-3 sm:p-6 shadow-xl transition-all overflow-hidden",
      isDark 
        ? "bg-white/[0.02] border-white/5 shadow-black/40 hover:border-white/10" 
        : "bg-white border-slate-200 shadow-slate-200/50 hover:border-slate-300"
    )}>
      {validationErrors.length > 0 && (
        <div className={cn(
          "mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border p-3 sm:p-5 animate-in fade-in slide-in-from-top-2 shadow-inner",
          isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className={cn("flex items-center gap-2", isDark ? "text-red-400" : "text-red-700")}>
              <AlertTriangle size={16} className="animate-pulse sm:w-[18px]" />
              <h3 className="text-sm sm:text-sm font-black uppercase tracking-wide">
                {t('admin.config.testFailed')} ({validationErrors.length})
              </h3>
            </div>
            {onClearValidationErrors && (
              <button
                type="button"
                className={cn(
                  "h-7 px-2 text-sm uppercase font-black transition-opacity",
                  isDark ? "text-slate-400 opacity-50 hover:opacity-100" : "text-red-800 opacity-70 hover:opacity-100"
                )}
                onClick={onClearValidationErrors}
              >
                {t('common.clear')}
              </button>
            )}
          </div>
          <div className="max-h-48 sm:max-h-64 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2 sm:gap-2.5">
            {validationErrors.map((err, index) => (
              <div key={`${index}-${err.message}`} className={cn(
                "flex items-start gap-2 sm:gap-3 group p-2.5 sm:p-3 rounded-lg sm:rounded-xl transition-all border",
                isDark 
                  ? "bg-black/20 hover:bg-black/40 border-white/5 hover:border-red-500/20" 
                  : "bg-white hover:bg-red-50/30 border-slate-100 hover:border-red-200"
              )}>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm sm:text-sm leading-relaxed font-mono font-bold transition-colors",
                    isDark ? "text-red-200/90 group-hover:text-red-100" : "text-red-900"
                  )}>
                    {err.message}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {typeof err.key === 'string' && err.key.trim().length > 0 && (
                      <span className={cn(
                        "text-sm sm:text-sm px-1.5 py-0.5 rounded border font-mono font-black",
                        isDark ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-red-200 bg-red-100 text-red-800"
                      )}>
                        key: {err.key}
                      </span>
                    )}
                    {typeof err.line === 'number' && err.line > 0 && (
                      <span className={cn(
                        "text-sm sm:text-sm px-1.5 py-0.5 rounded border font-mono font-bold",
                        isDark ? "border-white/10 bg-black/20 text-red-100/80" : "border-slate-200 bg-slate-100 text-slate-700"
                      )}>
                        line: {err.line}
                      </span>
                    )}
                    {typeof err.column === 'number' && err.column > 0 && (
                      <span className={cn(
                        "text-sm sm:text-sm px-1.5 py-0.5 rounded border font-mono font-bold",
                        isDark ? "border-white/10 bg-black/20 text-red-100/80" : "border-slate-200 bg-slate-100 text-slate-700"
                      )}>
                        column: {err.column}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        "mb-3 sm:mb-4 rounded-xl sm:rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 transition-colors",
        isDark ? "border-white/10 bg-black/20 shadow-none" : "border-slate-200 bg-slate-50 shadow-inner"
      )}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-sm">
          <span className={cn(
            'rounded-lg border px-2 py-0.5 font-black uppercase tracking-wide',
            isDirty 
              ? (isDark ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-amber-500/40 bg-amber-100 text-amber-900') 
              : (isDark ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-emerald-500/40 bg-emerald-100 text-emerald-900'),
          )}>
            {isDirty ? t('admin.config.pendingChanges') : t('admin.config.noPendingChanges')}
          </span>
          <span className={cn("font-black uppercase tracking-widest", isDark ? "text-white opacity-30" : "text-slate-900 opacity-40")}>
            {t('admin.config.diffSummary')}
          </span>
          <span className={cn(
            "rounded border px-2 py-0.5 font-mono font-bold",
            isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-white text-slate-800"
          )}>
            {t('admin.config.changedLines')}: {pendingDiffStats.changed}
          </span>
          <span className={cn(
            "rounded border px-2 py-0.5 font-mono font-bold",
            isDark ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" : "border-emerald-500/20 bg-emerald-50 text-emerald-800"
          )}>
            {t('admin.config.addedLines')}: {pendingDiffStats.added}
          </span>
          <span className={cn(
            "rounded border px-2 py-0.5 font-mono font-bold",
            isDark ? "border-red-400/20 bg-red-500/10 text-red-200" : "border-red-500/20 bg-red-50 text-red-800"
          )}>
            {t('admin.config.removedLines')}: {pendingDiffStats.removed}
          </span>
        </div>
      </div>

      <ConfigEditorPanel
        configPath={configPath || t('admin.config.pathUnavailable')}
        content={content}
        notes={notes}
        errors={validationErrors}
        loading={busy}
        saveDisabled={!isDirty}
        onChange={onChange}
        onTest={onTest}
        onSave={onSave}
        onCancel={onCancel || (() => {})}
        title={t('admin.config.title')}
        testLabel={t('admin.config.testContent')}
        saveLabel={t('admin.config.saveAndReload')}
        cancelLabel={t('common.cancel')}
        showCancel={showCancel}
        isDark={isDark}
        actionsPrefix={quickWizardEnabled ? (
          <button
            type="button"
            className={cn(
              "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border font-black uppercase tracking-wide transition-all inline-flex items-center gap-1.5 shadow-sm",
              isDark 
                ? "border-white/15 hover:bg-white/10 text-slate-300" 
                : "border-slate-300 bg-white hover:bg-slate-50 text-slate-900"
            )}
            onClick={() => setIsQuickWizardOpen(true)}
          >
            <WandSparkles size={18} className="text-primary" />
            {t('admin.config.quickWizard.title')}
          </button>
        ) : undefined}
      />

      {reloadSummary && (
        <div className={cn(
          'mt-3 rounded-xl px-3 py-2 text-sm sm:text-sm font-mono border font-bold shadow-sm transition-colors',
          reloadSummaryLevel === 'success' && (isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-900 border-emerald-200'),
          reloadSummaryLevel === 'warning' && (isDark ? 'bg-amber-500/10 text-amber-200 border-amber-500/30' : 'bg-amber-50 text-amber-900 border-amber-200'),
          reloadSummaryLevel === 'error' && (isDark ? 'bg-red-500/10 text-red-200 border-red-500/30' : 'bg-red-50 text-red-900 border-red-200'),
          reloadSummaryLevel === 'info' && (isDark ? 'bg-white/5 text-white/70 border-white/10' : 'bg-slate-100 text-slate-800 border-slate-200'),
        )}>
          {reloadSummary}
        </div>
      )}

      {quickWizardEnabled && (
        <ConfigQuickWizardModal
          tomlAdapter={tomlAdapter}
          isOpen={isQuickWizardOpen}
          onClose={() => setIsQuickWizardOpen(false)}
          content={content}
          onContentChange={onChange}
          {...(runtimeOs ? { runtimeOs } : {})}
          {...(quickWizardLicense ? { licenseWizard: quickWizardLicense } : {})}
          {...(onResetAdminPassword ? { onResetAdminPassword } : {})}
          {...(typeof isResettingAdminPassword === 'boolean' ? { isResettingAdminPassword } : {})}
        />
      )}
    </div>
  );
};
