import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import * as toml from 'smol-toml';
import {
  type ConfigError,
  type ConfigNoteEntry,
  SystemConfigWorkbench,
  ConfigWorkbenchShell,
  AdminPasswordPanel,
  useToastStore,
} from '@fileuni/shared';
import { client, extractData, handleApiError } from '@/lib/api';
import { CheckCircle, ShieldAlert } from 'lucide-react';

interface ConfigSetStatusResponse {
  is_config_set_mode: boolean;
  is_permitted: boolean;
  message: string;
}

interface ConfigTemplateResponse {
  current_config_path: string;
  current_config_content: string;
}

interface ConfigNotesResponse {
  notes: Record<string, ConfigNoteEntry>;
}

interface BackendCapabilitiesResponse {
  runtime_os?: string;
}

type ConfigValidationError = {
  message: string;
  line?: number;
  column?: number;
  key?: string | null;
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

const extractValidationErrorsFromException = (error: unknown): ConfigValidationError[] => {
  if (typeof error !== 'object' || error === null) return [];
  const payload = (error as Record<string, unknown>).data;
  return normalizeValidationErrors(payload);
};

export const ConfigSetEditor: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();

  const [permitted, setPermitted] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [configPath, setConfigPath] = useState('');
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [runtimeOs, setRuntimeOs] = useState<string>('');
  const [notes, setNotes] = useState<Record<string, ConfigNoteEntry>>({});
  const [validationErrors, setValidationErrors] = useState<ConfigValidationError[]>([]);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [applying, setApplying] = useState(false);
  const [resettingAdminPassword, setResettingAdminPassword] = useState(false);
  const [completed, setCompleted] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await extractData<ConfigSetStatusResponse>(
        client.GET('/api/v1/config-set/status')
      );
      setPermitted(data.is_permitted);
      setPermissionMessage(data.message);
    } catch (e) {
      console.error('Failed to fetch config-set status', e);
      setPermitted(false);
      setPermissionMessage('Failed to check config-set permissions');
    }
  }, []);

  const fetchTemplate = useCallback(async () => {
    try {
      const data = await extractData<ConfigTemplateResponse>(
        client.GET('/api/v1/config-set/template')
      );
      setConfigPath(data.current_config_path);
      setContent(data.current_config_content);
      setSavedContent(data.current_config_content);
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    }
  }, [addToast, t]);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await extractData<ConfigNotesResponse>(
        client.GET('/api/v1/config-set/notes')
      );
      setNotes(data.notes || {});
    } catch (e) {
      console.error('Failed to fetch config notes', e);
    }
  }, []);

  const fetchCapabilities = useCallback(async () => {
    try {
      const data = await extractData<BackendCapabilitiesResponse>(
        client.GET('/api/v1/system/backend-capabilities-handshake')
      );
      setRuntimeOs(typeof data.runtime_os === 'string' ? data.runtime_os : '');
    } catch (e) {
      console.error('Failed to fetch backend capabilities', e);
      setRuntimeOs('');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await fetchStatus();
        await Promise.all([fetchTemplate(), fetchNotes(), fetchCapabilities()]);
      } catch (e) {
        console.error('Config-set init failed', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchStatus, fetchTemplate, fetchNotes, fetchCapabilities]);

  const handleTest = async () => {
    if (testing) return;
    setTesting(true);
    setValidationErrors([]);
    try {
      await extractData(
        client.POST('/api/v1/config-set/config-test', {
          body: { toml_content: content },
        })
      );
      addToast(t('admin.config.testSuccess'), 'success');
    } catch (e) {
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

  const handleApply = async (password: string) => {
    const resolvedAdminUsername = 'admin';
    setAdminUsername(resolvedAdminUsername);
    setApplying(true);
    try {
      await extractData(
        client.POST('/api/v1/config-set/apply', {
          body: {
            config_path: configPath,
            toml_content: content,
            admin_password: password,
          },
        })
      );
      addToast(t('configSet.logs.success') || 'Configuration saved successfully', 'success');
      setCompleted(true);
      return resolvedAdminUsername;
    } catch (e) {
      const errData = extractValidationErrorsFromException(e);
      if (errData.length > 0) {
        setValidationErrors(errData);
        setShowAdminPanel(false);
        addToast(`${t('configSet.logs.failed')}: ${errData[0].message}`, 'error');
      } else {
        addToast(handleApiError(e, t), 'error');
      }
      throw e;
    } finally {
      setApplying(false);
    }
  };

  const handleResetToSaved = () => {
    setContent(savedContent);
    setValidationErrors([]);
  };

  const handleQuickWizardResetAdminPassword = async (password: string) => {
    const resolvedAdminUsername = 'admin';
    setResettingAdminPassword(true);
    try {
      await extractData(
        client.POST('/api/v1/config-set/apply', {
          body: {
            config_path: configPath,
            toml_content: content,
            admin_password: password,
          },
        })
      );
      setAdminUsername(resolvedAdminUsername);
      setCompleted(true);
      addToast(t('launcher.reset_admin_password_success'), 'success');
      return resolvedAdminUsername;
    } catch (e) {
      const errData = extractValidationErrorsFromException(e);
      if (errData.length > 0) {
        setValidationErrors(errData);
        addToast(`${t('configSet.logs.failed')}: ${errData[0].message}`, 'error');
      } else {
        addToast(handleApiError(e, t), 'error');
      }
      throw e;
    } finally {
      setResettingAdminPassword(false);
    }
  };

  const editorErrors: ConfigError[] = validationErrors.map((err) => ({
    message: err.message,
    line: typeof err.line === 'number' ? err.line : 0,
    column: typeof err.column === 'number' ? err.column : 0,
    key: err.key,
  }));

  if (!loading && !permitted) {
    return (
      <ConfigWorkbenchShell
        title={t('configSet.wizard.title')}
        subtitle={t('configSet.wizard.subtitle')}
        configPath={configPath}
      >
        <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-card border-2 border-destructive/20 rounded-3xl sm:rounded-[2.5rem] text-center shadow-2xl">
          <ShieldAlert size={80} className="mx-auto text-destructive mb-8" />
          <h2 className="text-4xl font-black mb-6">{t('configSet.locked.title')}</h2>
          <p className="text-xl opacity-70 mb-10">{permissionMessage}</p>
          <button
            onClick={() => { void fetchStatus(); }}
            className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl"
          >
            {t('common.retry')}
          </button>
        </div>
      </ConfigWorkbenchShell>
    );
  }

  if (completed) {
    return (
      <ConfigWorkbenchShell
        title={t('configSet.wizard.title')}
        subtitle={t('configSet.wizard.subtitle')}
        configPath={configPath}
      >
        <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-card border-2 border-emerald-500/20 rounded-3xl sm:rounded-[2.5rem] text-center shadow-2xl">
          <CheckCircle size={80} className="mx-auto text-emerald-500 mb-8" />
          <h2 className="text-4xl font-black mb-6">{t('configSet.final.title')}</h2>
          <p className="text-xl opacity-70 mb-10">
            {t('configSet.final.subtitle', { user: adminUsername })}
          </p>
          <div className="max-w-md mx-auto p-4 sm:p-5 bg-muted/50 rounded-xl text-left space-y-3 border border-border mb-8">
            <p className="text-sm font-semibold uppercase tracking-wide opacity-60">
              {t('configSet.final.nextSteps')}
            </p>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <p key={i} className="text-sm leading-6">
                  {i}. {t(`configSet.final.step${i}`)}
                </p>
              ))}
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
          >
            {t('configSet.final.reload')}
          </button>
        </div>
      </ConfigWorkbenchShell>
    );
  }

  if (showAdminPanel) {
    return (
      <ConfigWorkbenchShell
        title={t('configSet.wizard.title')}
        subtitle={t('configSet.wizard.subtitle')}
        configPath={configPath}
      >
        <AdminPasswordPanel
          mode="panel"
          showWarning={true}
          showRandomGenerator={true}
          minPasswordLength={8}
          onConfirm={handleApply}
          loading={applying}
          onClose={() => setShowAdminPanel(false)}
          confirmLabel={t('configSet.admin.finish')}
        />
      </ConfigWorkbenchShell>
    );
  }

  return (
    <ConfigWorkbenchShell
      title={t('configSet.wizard.title')}
      subtitle={t('configSet.wizard.subtitle')}
      configPath={configPath}
    >
      <SystemConfigWorkbench
        tomlAdapter={toml}
        loading={loading}
        configPath={configPath}
        content={content}
        savedContent={savedContent}
        notes={notes}
        validationErrors={editorErrors}
        busy={testing}
        onChange={setContent}
        onTest={handleTest}
        onSave={() => setShowAdminPanel(true)}
        onCancel={handleResetToSaved}
        showCancel={false}
        onClearValidationErrors={() => setValidationErrors([])}
        quickWizardEnabled={true}
        runtimeOs={runtimeOs}
        onResetAdminPassword={handleQuickWizardResetAdminPassword}
        isResettingAdminPassword={resettingAdminPassword}
      />
    </ConfigWorkbenchShell>
  );
};
