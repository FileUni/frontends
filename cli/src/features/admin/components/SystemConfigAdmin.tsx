import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import * as toml from 'smol-toml';
import { client, extractData, handleApiError } from '@/lib/api.ts';
import type { components } from '@/lib/api.ts';
import {
  type ConfigError,
  type ConfigNoteEntry as SharedConfigNoteEntry,
  SystemConfigWorkbench,
  LicenseManagementModal,
  useToastStore,
  useThemeStore,
} from '@fileuni/shared';
import { useAuthzStore } from '@/stores/authz.ts';
import { useAuthStore } from '@/stores/auth.ts';
import { Key } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

type ConfigRawResponse = components['schemas']['ConfigRawResponse'];
type ConfigNotesResponse = components['schemas']['ConfigNotesResponse'];
type ApiConfigNoteEntry = components['schemas']['ConfigNoteEntry'];

type LicenseStatus = {
  is_valid: boolean;
  msg: string;
  device_code: string;
  current_users: number;
  max_users: number;
  features: string[];
};

type ConfigValidationError = {
  message: string;
  line?: number;
  column?: number;
  key?: string | null;
};

type LineDiffStats = {
  changed: number;
  added: number;
  removed: number;
};

const isConfigValidationError = (value: unknown): value is ConfigValidationError => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.message !== 'string') return false;
  if (candidate.line !== undefined && typeof candidate.line !== 'number') return false;
  if (candidate.column !== undefined && typeof candidate.column !== 'number') return false;
  if (candidate.key !== undefined && candidate.key !== null && typeof candidate.key !== 'string') return false;
  return true;
};

const normalizeValidationErrors = (raw: unknown): ConfigValidationError[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isConfigValidationError);
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const extractValidationErrorsFromException = (error: unknown): ConfigValidationError[] => {
  if (typeof error !== 'object' || error === null) return [];
  const payload = (error as Record<string, unknown>).data;
  return normalizeValidationErrors(payload);
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

const formatLineDiffSummary = (stats: LineDiffStats): string => {
  return `changed ${stats.changed}, added ${stats.added}, removed ${stats.removed}`;
};

export const SystemConfigAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { theme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [configPath, setConfigPath] = useState('');
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [notes, setNotes] = useState<Record<string, ApiConfigNoteEntry>>({});
  const [validationErrors, setValidationErrors] = useState<ConfigValidationError[]>([]);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isResettingAdminPassword, setIsResettingAdminPassword] = useState(false);
  const [reloadSummary, setReloadSummary] = useState('');
  const [reloadSummaryLevel, setReloadSummaryLevel] = useState<'success' | 'warning' | 'error' | 'info'>('info');
  const { currentUserData } = useAuthStore();

  const fetchConfig = useCallback(async () => {
    const data = await extractData<ConfigRawResponse>(client.GET('/api/v1/admin/system/config/raw'));
    if (data) {
      setConfigPath(data.config_path || '');
      setContent(data.toml_content || '');
      setSavedContent(data.toml_content || '');
    }
  }, []);

  const fetchNotes = useCallback(async () => {
    const data = await extractData<ConfigNotesResponse>(client.GET('/api/v1/admin/system/config/notes'));
    if (data) {
      setNotes(data.notes || {});
    }
  }, []);

  const fetchLicenseStatus = useCallback(async () => {
    try {
      const data = await extractData<LicenseStatus>(client.GET('/api/v1/users/admin/license/status'));
      if (data) {
        setLicenseStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const { hasPermission } = useAuthzStore();

  useEffect(() => {
    const load = async () => {
      if (!hasPermission('admin.access')) return;
      try {
        await Promise.all([fetchConfig(), fetchNotes(), fetchLicenseStatus()]);
      } catch (e) {
        addToast(handleApiError(e, t), 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchConfig, fetchNotes, fetchLicenseStatus, addToast, t, hasPermission]);

  useEffect(() => {
    if (!testing && !reloading) return undefined;
    const watchdog = setTimeout(() => {
      setTesting(false);
      setReloading(false);
      addToast('Operation timeout watchdog released busy state', 'warning');
    }, 45000);
    return () => clearTimeout(watchdog);
  }, [testing, reloading, addToast]);

  const handleTest = async () => {
    if (testing || reloading) return;
    setTesting(true);
    setValidationErrors([]);
    try {
      await withTimeout(
        extractData<{ message?: string }>(
          client.POST('/api/v1/admin/system/config/test', {
            body: { toml_content: content },
            headers: { "X-No-Toast": "true" }
          })
        ),
        20_000,
        'Config test request timeout'
      );
      addToast(t('admin.config.testSuccess'), 'success');
    } catch (e) {
      console.error('Config test exception:', e);
      const errData = extractValidationErrorsFromException(e);
      if (errData.length > 0) {
        setValidationErrors(errData);
        addToast(`${t('admin.config.testFailed')}: ${errData[0].message}`, 'error');
      } else {
        addToast(handleApiError(e, t), 'error');
      }
    } finally {
      setTesting(false);
    }
  };

  const handleReload = async () => {
    if (reloading || testing) return;
    setReloading(true);
    setValidationErrors([]);
    setReloadSummary('');
    setReloadSummaryLevel('info');
    try {
      const currentContent = content;
      await withTimeout(
        extractData<{ message?: string }>(
          client.POST('/api/v1/admin/system/config/reload', {
            body: { toml_content: currentContent },
            headers: { "X-No-Toast": "true" }
          })
        ),
        20_000,
        'Config reload request timeout'
      );

      const refreshed = await withTimeout(
        extractData<ConfigRawResponse>(client.GET('/api/v1/admin/system/config/raw')),
        15_000,
        'Config refresh request timeout'
      );

      const serverContent = refreshed.toml_content || '';
      const serverPath = refreshed.config_path || configPath;
      setConfigPath(serverPath);
      setSavedContent(serverContent);
      setContent(serverContent);

      addToast(t('admin.config.reloadSuccess'), 'success');
      const diffSummary = formatLineDiffSummary(calculateLineDiffStats(currentContent, serverContent));
      if (serverContent !== currentContent) {
        const summary = `Config synced with server: ${diffSummary}`;
        setReloadSummary(summary);
        setReloadSummaryLevel('warning');
      } else {
        const summary = `Config synced with server: ${diffSummary}`;
        setReloadSummary(summary);
        setReloadSummaryLevel('success');
      }
    } catch (e) {
      console.error('Config reload exception:', e);
      const errData = extractValidationErrorsFromException(e);
      if (errData.length > 0) {
        setValidationErrors(errData);
        const summary = `${t('admin.config.reloadFailed')}: ${errData[0].message}`;
        setReloadSummary(summary);
        setReloadSummaryLevel('error');
        addToast(summary, 'error');
      } else {
        const summary = handleApiError(e, t);
        setReloadSummary(summary);
        setReloadSummaryLevel('error');
        addToast(summary, 'error');
      }
    } finally {
      setReloading(false);
    }
  };

  const handleUpdateLicense = async () => {
    if (!licenseKey.trim()) return;
    setSaving(true);
    try {
      const res = await client.POST('/api/v1/users/admin/license/update', {
        body: { license_key: licenseKey.trim() }
      });
      if (res.data?.success) {
        addToast(t('admin.saveSuccess'), 'success');
        setLicenseKey('');
        fetchLicenseStatus();
      }
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToSaved = () => {
    setContent(savedContent);
    setValidationErrors([]);
  };

  const handleQuickWizardResetAdminPassword = async (password: string) => {
    if (!currentUserData?.user.id) {
      throw new Error('Current user context unavailable');
    }
    setIsResettingAdminPassword(true);
    try {
      await extractData(
        client.POST('/api/v1/users/admin/users/{user_id}/reset-password', {
          params: { path: { user_id: currentUserData.user.id } },
          body: { new_password: password },
        })
      );
      addToast(t('launcher.reset_admin_password_success'), 'success');
      return currentUserData.user.username || 'admin';
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
      throw e;
    } finally {
      setIsResettingAdminPassword(false);
    }
  };

  const normalizedNotes: Record<string, SharedConfigNoteEntry> = Object.fromEntries(
    Object.entries(notes).map(([key, note]) => [
      key,
      {
        desc_en: note.desc_en || '',
        desc_zh: note.desc_zh || '',
        example: note.example || '',
      },
    ]),
  );

  const editorErrors: ConfigError[] = validationErrors.map((err) => ({
    message: err.message,
    line: typeof err.line === 'number' ? err.line : 0,
    column: typeof err.column === 'number' ? err.column : 0,
    key: err.key,
  }));

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setIsLicenseModalOpen(true)}
          className={cn(
            "px-3 py-1.5 rounded-lg border font-black transition-all inline-flex items-center gap-1.5 shadow-sm",
            isDark 
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 shadow-none" 
              : "border-amber-500/50 bg-amber-50 text-amber-900 hover:bg-amber-100"
          )}
        >
          <Key size={18} className={isDark ? "text-amber-400" : "text-amber-600"} />
          {t('admin.config.quickWizard.steps.license')}
        </button>
      </div>
      <SystemConfigWorkbench
        tomlAdapter={toml}
        loading={loading}
        configPath={configPath}
        content={content}
        savedContent={savedContent}
        notes={normalizedNotes}
        validationErrors={editorErrors}
        busy={testing || reloading}
        onChange={setContent}
        onTest={handleTest}
        onSave={handleReload}
        onCancel={handleResetToSaved}
        showCancel={false}
        onClearValidationErrors={() => setValidationErrors([])}
        reloadSummary={reloadSummary}
        reloadSummaryLevel={reloadSummaryLevel}
        quickWizardLicense={{
          isValid: Boolean(licenseStatus?.is_valid),
          currentUsers: licenseStatus?.current_users || 0,
          maxUsers: licenseStatus?.max_users || 0,
          deviceCode: licenseStatus?.device_code || '',
          licenseKey,
          saving,
          onLicenseKeyChange: setLicenseKey,
          onApplyLicense: () => {
            void handleUpdateLicense();
          },
        }}
        onResetAdminPassword={handleQuickWizardResetAdminPassword}
        isResettingAdminPassword={isResettingAdminPassword}
      />
      {licenseStatus && (
        <LicenseManagementModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          isValid={licenseStatus.is_valid}
          currentUsers={licenseStatus.current_users}
          maxUsers={licenseStatus.max_users}
          deviceCode={licenseStatus.device_code}
          licenseKey={licenseKey}
          saving={saving}
          onLicenseKeyChange={setLicenseKey}
          onApplyLicense={() => void handleUpdateLicense()}
          features={licenseStatus.features}
        />
      )}
    </>
  );
};
