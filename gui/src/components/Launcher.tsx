import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as toml from 'smol-toml';
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Activity,
  Cpu,
  Zap,
  FileText,
  Info,
} from 'lucide-react';
import { useThemeStore, type Theme, useLanguageStore, type Language,
  AboutModal,
  buildAboutUpdateGuideUrl,
  type AboutUpdateInfo,
  type LogEntry,
  ToastContainer,
  toast,
  applyTheme,
  ToastI18nContext,
  LogViewer,
  SystemConfigWorkbench,
  ConfigWorkbenchShell,
  ServiceControlPanel,
  QuickActionsPanel,
  AdminPasswordPanel,
  type ConfigError,
  type ConfigNoteEntry,
  type ServiceInstallLevel
} from '@fileuni/shared';
import { useConfigStore } from '../stores/config';
import '../lib/i18n';
import ConfigSelector from './ConfigSelector';
import { isTauriRuntime, safeInvoke, safeListen } from '../lib/tauri';

// OS info interface
interface OSInfo {
  os_type: string;
  support_service: boolean;
  nixos_hint: boolean;
  is_mobile: boolean;
}

// Service status response
interface ServiceStatusResponse {
  status: string;
  is_running: boolean;
}

interface RuntimeDirsInspection {
  config_dir: string;
  app_data_dir: string;
  config_path: string;
  config_exists: boolean;
  config_dir_exists: boolean;
  app_data_dir_exists: boolean;
}

interface RuntimeDirsPayload {
  config_dir: string;
  app_data_dir: string;
}

interface RuntimeDirPresets {
  current_config_dir: string;
  current_app_data_dir: string;
  default_config_dir: string;
  default_app_data_dir: string;
}

interface MissingConfigPromptState {
  configPath: string;
}

interface InstallationStatus {
  config_dir: string;
  app_data_dir: string;
  config_path: string;
  config_exists: boolean;
  install_lock_path: string;
  install_lock_exists: boolean;
  is_setup_required: boolean;
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export default function Launcher() {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { configDir, appDataDir, setRuntimeDirs } = useConfigStore();

  // Toast i18n
  const toastI18n = React.useMemo(() => ({
    doNotShowAgain: t('launcher.do_not_show_again'),
    viewDetails: t('launcher.view_details'),
    hideDetails: t('launcher.hide_details'),
    copy: t('launcher.copy'),
  }), [t]);

  const [status, setStatus] = useState<string>('Checking...');
  const [version, setVersion] = useState<string>('0.0.0');
  const [loading, setLoading] = useState<boolean>(false);
  const [osInfo, setOsInfo] = useState<OSInfo | null>(null);

  // Log related state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptime, setUptime] = useState(0);
  const stats = { cpu: 12, memory: 128, connections: 5 };

  // Config selector state
  const [showConfigSelector, setShowConfigSelector] = useState(false);

  const [serviceInstallLevel, setServiceInstallLevel] = useState<ServiceInstallLevel>('system');
  const [serviceAutostart, setServiceAutostart] = useState(true);
  const updateGuideBaseUrl = language === 'en' ? 'https://fileuni.com/update' : 'https://fileuni.com/zh-cn/update';

  // Config editor state
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configContent, setConfigContent] = useState('');
  const [savedConfigContent, setSavedConfigContent] = useState('');
  const [configNotes, setConfigNotes] = useState<Record<string, ConfigNoteEntry>>({});
  const [configErrors, setConfigErrors] = useState<ConfigError[]>([]);
  const [configFetching, setConfigFetching] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [configSummary, setConfigSummary] = useState('');
  const [configSummaryLevel, setConfigSummaryLevel] = useState<'success' | 'warning' | 'error' | 'info'>('info');
  const [configFilePath, setConfigFilePath] = useState('');
  const [runtimeDirPresets, setRuntimeDirPresets] = useState<RuntimeDirPresets | null>(null);
  const [missingConfigPrompt, setMissingConfigPrompt] = useState<MissingConfigPromptState | null>(null);
  const [setupStatus, setSetupStatus] = useState<InstallationStatus | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isSetupAdminPasswordOpen, setIsSetupAdminPasswordOpen] = useState(false);
  const [setupAdminUsername, setSetupAdminUsername] = useState('admin');
  const [setupAdminAction, setSetupAdminAction] = useState('existing_admin');
  const [setupPasswordHint, setSetupPasswordHint] = useState<string | null>(null);
  const [pendingAdminPassword, setPendingAdminPassword] = useState('');
  const [setupApplying, setSetupApplying] = useState(false);
  const [isSetupRequiredPromptOpen, setIsSetupRequiredPromptOpen] = useState(false);
  const [isSetupCompletedPromptOpen, setIsSetupCompletedPromptOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aboutUpdateInfo, setAboutUpdateInfo] = useState<AboutUpdateInfo | null>(null);
  const [aboutUpdateError, setAboutUpdateError] = useState<string | null>(null);
  const [isCheckingAboutUpdates, setIsCheckingAboutUpdates] = useState(false);
  const isServiceRunning = status === 'Running';
  const displayedConfigDir = configDir ?? runtimeDirPresets?.default_config_dir ?? '...';
  const displayedAppDataDir = appDataDir ?? runtimeDirPresets?.default_app_data_dir ?? '...';
  const missingConfigPromptResolver = useRef<((accepted: boolean) => void) | null>(null);

  const inspectRuntimeDirs = async (
    nextConfigDir?: string | null,
    nextAppDataDir?: string | null,
  ) => {
    return safeInvoke<RuntimeDirsInspection>('inspect_runtime_dirs', {
      configDir: nextConfigDir ?? '',
      appDataDir: nextAppDataDir ?? '',
    });
  };

  const bindRuntimeDirs = async (
    nextConfigDir?: string | null,
    nextAppDataDir?: string | null,
  ) => {
    const inspected = await inspectRuntimeDirs(nextConfigDir, nextAppDataDir);
    await safeInvoke<void>('set_runtime_dirs', {
      configDir: inspected.config_dir,
      appDataDir: inspected.app_data_dir,
    });
    setRuntimeDirs(inspected.config_dir, inspected.app_data_dir);
    setConfigFilePath(inspected.config_path);
    return inspected;
  };

  const ensureRuntimeConfigReady = async () => {
    try {
      const inspected = await bindRuntimeDirs(configDir, appDataDir);
      if (inspected.config_exists) {
        return inspected;
      }

      const accepted = await new Promise<boolean>((resolve) => {
        missingConfigPromptResolver.current = resolve;
        setMissingConfigPrompt({
          configPath: inspected.config_path,
        });
      });

      if (!accepted) {
        toast.warning(t('launcher.runtime_config_missing_cancelled'));
        return null;
      }

      const ensured = await safeInvoke<RuntimeDirsInspection>('ensure_runtime_config', {
        configDir: inspected.config_dir,
        appDataDir: inspected.app_data_dir,
      });

      await safeInvoke<void>('set_runtime_dirs', {
        configDir: ensured.config_dir,
        appDataDir: ensured.app_data_dir,
      });
      setRuntimeDirs(ensured.config_dir, ensured.app_data_dir);
      setConfigFilePath(ensured.config_path);
      toast.success(t('launcher.messages.runtime_config_created'));
      return ensured;
    } catch (error) {
      toast.error(extractErrorMessage(error));
      return null;
    }
  };

  const loadSetupWorkbench = async () => {
    setConfigFetching(true);
    try {
      const [content, notes] = await Promise.all([
        safeInvoke<string>('get_config_content'),
        safeInvoke<Record<string, ConfigNoteEntry>>('get_config_notes'),
      ]);
      setConfigContent(content);
      setSavedConfigContent(content);
      setConfigNotes(notes);
      setConfigErrors([]);
      setConfigSummary('');
      setConfigSummaryLevel('info');
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setConfigFetching(false);
    }
  };

  const inspectInstallationState = async (
    nextConfigDir?: string | null,
    nextAppDataDir?: string | null,
  ) => {
    const inspected = await inspectRuntimeDirs(nextConfigDir, nextAppDataDir);
    let status = await safeInvoke<InstallationStatus>('inspect_installation_status', {
      configDir: inspected.config_dir,
      appDataDir: inspected.app_data_dir,
    });

    if (!status.config_exists) {
      const ensured = await safeInvoke<RuntimeDirsInspection>('ensure_runtime_config', {
        configDir: inspected.config_dir,
        appDataDir: inspected.app_data_dir,
      });
      await safeInvoke<void>('set_runtime_dirs', {
        configDir: ensured.config_dir,
        appDataDir: ensured.app_data_dir,
      });
      setRuntimeDirs(ensured.config_dir, ensured.app_data_dir);
      setConfigFilePath(ensured.config_path);
      status = await safeInvoke<InstallationStatus>('inspect_installation_status', {
        configDir: ensured.config_dir,
        appDataDir: ensured.app_data_dir,
      });
    } else {
      setConfigFilePath(status.config_path);
    }

    setSetupStatus(status);
    if (status.is_setup_required) {
      await loadSetupWorkbench();
      setSetupRequired(true);
    } else {
      setSetupRequired(false);
    }
    return status;
  };

  const closeMissingConfigPrompt = (accepted: boolean) => {
    setMissingConfigPrompt(null);
    missingConfigPromptResolver.current?.(accepted);
    missingConfigPromptResolver.current = null;
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const raw = window.localStorage.getItem('fileuni-gui-service-install-options');
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { level?: ServiceInstallLevel; autostart?: boolean };
      if (parsed.level === 'system' || parsed.level === 'user') {
        setServiceInstallLevel(parsed.level);
      }
      if (typeof parsed.autostart === 'boolean') {
        setServiceAutostart(parsed.autostart);
      }
    } catch {
      // Ignore invalid cached payload
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setStatus('Unknown');
      return;
    }

    let cancelled = false;

    const loadRuntimeDirs = async (attempt: number) => {
      try {
        const inspected = await bindRuntimeDirs(configDir, appDataDir);
        await inspectInstallationState(inspected.config_dir, inspected.app_data_dir);
      } catch (error) {
        if (!cancelled && attempt < 5) {
          window.setTimeout(() => {
            void loadRuntimeDirs(attempt + 1);
          }, 300);
          return;
        }
        try {
          const defaults = await safeInvoke<RuntimeDirsPayload>('get_default_runtime_dirs');
          const inspected = await bindRuntimeDirs(defaults.config_dir, defaults.app_data_dir);
          await inspectInstallationState(inspected.config_dir, inspected.app_data_dir);
          return;
        } catch (fallbackError) {
          console.error(fallbackError);
        }
        console.error(error);
      }
    };

    void loadRuntimeDirs(0);

    return () => {
      cancelled = true;
    };
  }, [configDir, appDataDir]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    safeInvoke<RuntimeDirPresets>('get_runtime_dir_presets')
      .then((presets) => {
        setRuntimeDirPresets(presets);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    return () => {
      missingConfigPromptResolver.current?.(false);
      missingConfigPromptResolver.current = null;
    };
  }, []);

  useEffect(() => {
    if (!missingConfigPrompt) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMissingConfigPrompt(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [missingConfigPrompt]);

  const handleRuntimeDirsSelected = async (nextConfigDir: string, nextAppDataDir: string) => {
    try {
      const inspected = await bindRuntimeDirs(nextConfigDir, nextAppDataDir);
      await inspectInstallationState(inspected.config_dir, inspected.app_data_dir);
      setShowConfigSelector(false);
      toast.success(t('launcher.messages.config_set_success'));
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const handleEditConfig = async () => {
    const ready = await ensureRuntimeConfigReady();
    if (!ready) {
      return;
    }
    setIsEditingConfig(true);
    setConfigFetching(true);
    try {
      const content = await safeInvoke<string>('get_config_content');
      const notes = await safeInvoke<Record<string, ConfigNoteEntry>>('get_config_notes');
      setConfigContent(content);
      setSavedConfigContent(content);
      setConfigNotes(notes);
      setConfigErrors([]);
      setConfigSummary('');
      setConfigSummaryLevel('info');
    } catch (e: unknown) {
      toast.error(String(e));
      setIsEditingConfig(false);
    }
    setConfigFetching(false);
  };

  const handleSaveConfig = async () => {
    setConfigBusy(true);
    try {
      await safeInvoke<void>('save_and_reload_config', { content: configContent });
      toast.success(t('admin.config.reloadSuccess'));
      setSavedConfigContent(configContent);
      setConfigSummary(t('admin.config.reloadSuccess'));
      setConfigSummaryLevel('success');
      setConfigErrors([]);
    } catch (e: unknown) {
      toast.error(String(e));
      setConfigSummary(String(e));
      setConfigSummaryLevel('error');
    }
    setConfigBusy(false);
  };

  const handleTestConfig = async () => {
    setConfigBusy(true);
    try {
      const res = await safeInvoke<string[]>('test_config', { content: configContent });
      if (res.length === 0) {
        toast.success(t('launcher.messages.config_test_passed'));
        setConfigErrors([]);
        setConfigSummary('');
        setConfigSummaryLevel('info');
      } else {
        toast.error(t('launcher.messages.config_test_failed'));
        // Try parsing errors
        const errors: ConfigError[] = res.map(msg => ({
          message: msg,
          line: 0,
          column: 0
        }));
        setConfigErrors(errors);
        setConfigSummary(t('launcher.messages.config_test_failed'));
        setConfigSummaryLevel('error');
      }
    } catch (e: unknown) {
      toast.error(String(e));
      setConfigSummary(String(e));
      setConfigSummaryLevel('error');
    }
    setConfigBusy(false);
  };

  useEffect(() => {
    let unlistenServiceAction: (() => void) | null = null;
    let unlistenLogs: (() => void) | null = null;

    const init = async () => {
      if (!isTauriRuntime()) {
        return;
      }
      await refreshStatus();
      await getVersion();
      await getOS();

      unlistenServiceAction = await safeListen<string>('service-action', (event) => {
        if (event.payload === 'start') handleStart();
        if (event.payload === 'stop') handleStop();
      });

      unlistenLogs = await safeListen<LogEntry>('log-update', (event) => {
        setLogs(prev => [...prev, event.payload].slice(-1000));
      });

      await safeInvoke<void>('subscribe_logs');
    };

    init().catch(console.error);

    const uptimeInterval = setInterval(() => {
      if (status === 'Running') {
        setUptime(prev => prev + 1);
      }
    }, 1000);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (useThemeStore.getState().theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      unlistenServiceAction?.();
      unlistenLogs?.();
      clearInterval(uptimeInterval);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [status]);

  const refreshStatus = async () => {
    try {
      const response = await safeInvoke<ServiceStatusResponse>('get_service_status');
      setStatus(response.status);
    } catch (e: unknown) {
      console.error(e);
      setStatus('Unknown');
    }
  };

  const getVersion = async () => {
    try {
      const v = await safeInvoke<string>('get_app_version');
      setVersion(v);
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const getOS = async () => {
    try {
      const info = await safeInvoke<OSInfo>('get_os_info');
      setOsInfo(info);
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleStart = async () => {
    const ready = await ensureRuntimeConfigReady();
    if (!ready) {
      return;
    }
    setLoading(true);
    try {
      await safeInvoke<string>('start_service');
      toast.success(t('launcher.messages.service_started'));
      await refreshStatus();
    } catch (e: unknown) {
      const message = extractErrorMessage(e);
      if (message.includes('Setup wizard has not been completed')) {
        setIsSetupRequiredPromptOpen(true);
      } else {
        toast.error(message);
      }
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await safeInvoke<string>('stop_service');
      toast.success(t('launcher.messages.service_stopped'));
      await refreshStatus();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
    setLoading(false);
  };

  const persistServiceInstallOptions = (level: ServiceInstallLevel, autostart: boolean) => {
    window.localStorage.setItem(
      'fileuni-gui-service-install-options',
      JSON.stringify({ level, autostart })
    );
  };

  const handleInstall = async () => {
    if (osInfo?.nixos_hint) {
      toast.warning(
        `${t('launcher.nixos_detected')}\n${t('launcher.nixos_desc')}`,
        {
          duration: 'persistent',
          showDoNotShowAgain: true,
        }
      );
      return;
    }
    setLoading(true);
    try {
      await safeInvoke<string>('install_service', { level: serviceInstallLevel, autostart: serviceAutostart });
      toast.success(t('launcher.messages.install_requested'));
    } catch (e: unknown) {
      const message = extractErrorMessage(e);
      if (message.includes('Setup wizard has not been completed')) {
        setIsSetupRequiredPromptOpen(true);
      } else {
        toast.error(message);
      }
    }
    setLoading(false);
  };

  const handleUninstall = async () => {
    setLoading(true);
    try {
      await safeInvoke<string>('uninstall_service');
      toast.success(t('launcher.messages.uninstall_requested'));
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
    setLoading(false);
  };

  const handleResetToSavedConfig = () => {
    setConfigContent(savedConfigContent);
    setConfigErrors([]);
    setConfigSummary('');
    setConfigSummaryLevel('info');
  };

  const handleCloseConfigEditor = () => {
    setIsEditingConfig(false);
  };

  useEffect(() => {
    if (!isEditingConfig) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseConfigEditor();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditingConfig]);

  const handleOpenWebUI = async () => {
    try {
      await safeInvoke<void>('open_web_ui');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleOpenConfig = async () => {
    try {
      await bindRuntimeDirs(configDir, appDataDir);
      await safeInvoke<void>('open_config_dir');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleOpenExternalLink = async (url: string) => {
    if (!isTauriRuntime()) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      await safeInvoke<void>('open_external_url', { url });
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleCheckAboutUpdates = async () => {
    setIsCheckingAboutUpdates(true);
    setAboutUpdateError(null);
    try {
      const payload = await safeInvoke<AboutUpdateInfo>('check_latest_release');
      setAboutUpdateInfo(payload);
    } catch (e: unknown) {
      const message = extractErrorMessage(e);
      setAboutUpdateError(message);
      toast.error(message);
    } finally {
      setIsCheckingAboutUpdates(false);
    }
  };

  type SetupWizardResult = {
    admin_username: string;
    admin_action: string;
    password_hint?: string | null;
  };

  const handleApplySetup = async (password: string): Promise<string> => {
    setSetupApplying(true);
    try {
      const res = await safeInvoke<SetupWizardResult>('apply_setup_wizard', {
        content: configContent,
        password,
      });
      const username = res?.admin_username?.trim() || 'admin';
      setSetupAdminUsername(username);
      if (res?.admin_action) {
        setSetupAdminAction(res.admin_action);
      }
      setSetupPasswordHint(res?.password_hint ?? null);
      setSavedConfigContent(configContent);
      setConfigSummary(t('setup.logs.setupSuccess'));
      setConfigSummaryLevel('success');
      setConfigErrors([]);
      setIsSetupAdminPasswordOpen(false);
      toast.success(t('setup.logs.setupSuccess'));
      setIsSetupCompletedPromptOpen(true);
      setPendingAdminPassword('');
      return username;
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
      throw e;
    } finally {
      setSetupApplying(false);
    }
  };

  const handleStoreAdminPassword = async (password: string): Promise<string> => {
    setSetupApplying(true);
    try {
      setPendingAdminPassword(password);
      setIsSetupAdminPasswordOpen(false);
      return setupAdminUsername;
    } finally {
      setSetupApplying(false);
    }
  };

  const enterSetupModeFromPrompt = async () => {
    setIsSetupRequiredPromptOpen(false);
    try {
      await inspectInstallationState(configDir, appDataDir);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const finishSetupAndReturnToLauncher = async () => {
    setIsSetupCompletedPromptOpen(false);
    setSetupRequired(false);
    try {
      await inspectInstallationState(configDir, appDataDir);
      await refreshStatus();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleFinalizeSetup = async () => {
    setConfigBusy(true);
    try {
      await handleApplySetup(pendingAdminPassword);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
      setConfigSummary(extractErrorMessage(e));
      setConfigSummaryLevel('error');
    } finally {
      setConfigBusy(false);
    }
  };

  const toggleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const next = themes[(currentIndex + 1) % themes.length] ?? 'light';
    setTheme(next);
  };

  const toggleLanguage = () => {
    const langs: Language[] = ['zh', 'en'];
    const currentLanguage: Language = language === 'auto' ? 'zh' : language;
    const currentIndex = langs.indexOf(currentLanguage);
    const next = langs[(currentIndex + 1) % langs.length] ?? 'zh';
    setLanguage(next);
  };

  const getStatusText = () => {
    switch (status) {
      case 'Running': return t('launcher.status.running');
      case 'Stopped': return t('launcher.status.stopped');
      case 'Checking...': return t('launcher.status.checking');
      default: return t('launcher.status.unknown');
    }
  };

  const setupFinalMessage =
    (setupAdminAction === 'created_default'
      ? t('setup.final.adminCreatedDefault', { user: setupAdminUsername, password: setupPasswordHint || 'admin888' })
      : setupAdminAction === 'created_with_password'
        ? t('setup.final.adminCreatedWithPassword', { user: setupAdminUsername, password: setupPasswordHint || '' })
        : setupAdminAction === 'reset_password'
          ? t('setup.final.adminReset', { user: setupAdminUsername, password: setupPasswordHint || '' })
          : setupAdminAction === 'existing_admin'
            ? t('setup.final.adminExisting', { user: setupAdminUsername })
            : '');

  // Format uptime
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (setupRequired) {
    return (
      <>
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#020817] dark:via-[#0a0f1d] dark:to-[#0f172a] text-slate-900 dark:text-[#f8fafc] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 pb-6 pt-[calc(1.5rem+var(--safe-area-top))] sm:px-8 sm:pb-8 sm:pt-[calc(2rem+var(--safe-area-top))] border-b border-slate-200/50 dark:border-slate-800/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                {t('setup.wizard.title')}
              </h1>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
                {t('setup.wizard.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleLanguage}
                className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all border border-slate-200/50 dark:border-slate-700/50"
                title={t('launcher.switch_language')}
              >
                <Languages size={20} />
              </button>
              <button
                onClick={toggleTheme}
                className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all border border-slate-200/50 dark:border-slate-700/50"
                title={t('launcher.toggle_theme')}
              >
                {theme === 'light' ? <Sun size={20} /> : theme === 'dark' ? <Moon size={20} /> : <Monitor size={20} />}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="rounded-2xl border border-amber-300/50 bg-amber-50/90 dark:bg-amber-500/10 dark:border-amber-400/30 p-4 sm:p-5">
                <p className="text-sm font-bold leading-6 text-amber-900 dark:text-amber-200">
                  {t('forgotPassword.adminRecoveryHint')}
                </p>
                {setupStatus && (
                  <div className="mt-3 space-y-1 text-xs font-mono text-amber-800 dark:text-amber-300 break-all">
                    <div>{setupStatus.config_path}</div>
                    <div>{setupStatus.install_lock_path}</div>
                  </div>
                )}
              </div>

              <ConfigWorkbenchShell
                title={t('setup.wizard.title')}
                subtitle={t('setup.wizard.subtitle')}
                configPath={configFilePath}
              >
                <SystemConfigWorkbench
                  tomlAdapter={toml}
                  loading={configFetching}
                  configPath={configFilePath}
                  content={configContent}
                  savedContent={savedConfigContent}
                  notes={configNotes}
                  validationErrors={configErrors}
                  busy={configBusy}
                  onChange={setConfigContent}
                  onTest={handleTestConfig}
                  onSave={handleFinalizeSetup}
                  saveLabel={t('setup.admin.finish')}
                  onCancel={handleResetToSavedConfig}
                  allowSaveWithoutChanges={true}
                  forceEnableSave={true}
                  onClearValidationErrors={() => setConfigErrors([])}
                  showCancel={false}
                  reloadSummary={configSummary}
                  reloadSummaryLevel={configSummaryLevel}
                  restartNotice={t('setup.admin.finalConfirmDesc')}
                  quickWizardEnabled={true}
                  onOpenAdminPassword={() => {
                    setIsSetupAdminPasswordOpen(true);
                  }}
                  adminPasswordLabel={t('setup.admin.changePassword')}
                  onResetAdminPassword={handleStoreAdminPassword}
                  isResettingAdminPassword={setupApplying}
                  adminPasswordPanelProps={{
                    showWarning: false,
                    showSuccess: false,
                    showResetHint: false,
                    confirmLabel: t('setup.admin.changePassword'),
                  }}
                />
              </ConfigWorkbenchShell>
            </div>
          </div>

            <AdminPasswordPanel
              mode="modal"
              isOpen={isSetupAdminPasswordOpen}
              onClose={() => setIsSetupAdminPasswordOpen(false)}
              onConfirm={handleStoreAdminPassword}
              loading={setupApplying}
              showWarning={false}
              showRandomGenerator={true}
              minPasswordLength={8}
              confirmLabel={t('setup.admin.changePassword')}
              showSuccess={false}
              showResetHint={false}
              pendingHint={t('setup.admin.pendingHint')}
            />

          {isSetupCompletedPromptOpen && (
            <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl border border-emerald-300/40 bg-white/95 dark:bg-slate-900/95 shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/60">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                    {t('setup.final.title')}
                  </h2>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {setupFinalMessage || t('setup.final.subtitle', { user: setupAdminUsername })}
                  </p>
                </div>
                <div className="px-6 py-5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-end bg-slate-50/80 dark:bg-slate-950/40">
                  <button
                    onClick={() => { void finishSetupAndReturnToLauncher(); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <ToastI18nContext.Provider value={toastI18n}>
          <ToastContainer />
        </ToastI18nContext.Provider>
      </>
    );
  }

  return (
    <>
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#020817] dark:via-[#0a0f1d] dark:to-[#0f172a] text-slate-900 dark:text-[#f8fafc] flex flex-col items-stretch justify-start font-sans transition-colors duration-500 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-500/10 via-pink-500/5 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main container */}
      <div className="w-full h-full bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-xl border-0 sm:border-0 shadow-none relative flex flex-col overflow-hidden">

        {/* Glassmorphism header */}
        <div className="flex items-center justify-between px-6 pb-6 pt-[calc(1.5rem+var(--safe-area-top))] sm:px-8 sm:pb-8 sm:pt-[calc(2rem+var(--safe-area-top))] border-b border-slate-200/50 dark:border-slate-800/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <img src="/favicon.svg" alt="FileUni Logo" width={56} height={56} className="shadow-xl shadow-cyan-500/20 shrink-0 transform group-hover:scale-110 transition-all duration-500 ease-out" />
              {/* Status indicator */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${status === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                {t('launcher.title')}
              </h1>
              <p className="hidden sm:block text-slate-500 dark:text-slate-400 font-bold text-sm tracking-widest uppercase mt-1 opacity-80">
                {t('launcher.subtitle')} • v{version}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            {status === 'Running' && (
              <div className="hidden lg:flex items-center gap-4 mr-6 px-5 py-2.5 bg-slate-100/80 dark:bg-slate-800/40 rounded-2xl text-sm font-bold border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Cpu size={14} className="text-blue-500" /> {stats.cpu}%
                </span>
                <span className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Activity size={14} className="text-emerald-500" /> {stats.connections}
                </span>
                <span className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono">
                  <Zap size={14} className="text-amber-500" /> {formatUptime(uptime)}
                </span>
              </div>
            )}

            <button 
              onClick={toggleLanguage}
              className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg hover:scale-105 active:scale-95"
              title={t('launcher.switch_language')}
            >
              <Languages size={20} />
            </button>
            <button 
              onClick={toggleTheme}
              className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg hover:scale-105 active:scale-95"
              title={t('launcher.toggle_theme')}
            >
              {theme === 'light' ? <Sun size={20} /> : theme === 'dark' ? <Moon size={20} /> : <Monitor size={20} />}
            </button>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg hover:scale-105 active:scale-95"
              title={t('about.open')}
            >
              <Info size={20} />
            </button>
          </div>
        </div>

         {/* Scrollable Content */}
         <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 space-y-6">
            <div className="flex flex-col gap-6">
                {/* Top section: Service Control + Quick Actions side by side */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="flex-1 w-full space-y-6">
                    <div className="relative z-20 group">
                      <ServiceControlPanel
                        isRunning={status === 'Running'}
                        isLoading={loading}
                        supportService={Boolean(osInfo?.support_service)}
                        statusLabel={getStatusText()}
                        title={t('launcher.service_control')}
                        description={t('launcher.service_control_desc')}
                        startLabel={t('launcher.start_service')}
                        stopLabel={t('launcher.stop_service')}
                        systemIntegrationLabel={t('launcher.system_integration')}
                        installLabel={t('launcher.install')}
                        uninstallLabel={t('launcher.uninstall')}
                        installLevelLabel={t('launcher.install_level')}
                        installLevelSystemLabel={t('launcher.install_level_system')}
                        installLevelUserLabel={t('launcher.install_level_user')}
                        installAutostartLabel={t('launcher.install_autostart')}
                        installLevel={serviceInstallLevel}
                        installAutostart={serviceAutostart}
                        onToggleService={() => {
                          if (status === 'Running') {
                            void handleStop();
                          } else {
                            void handleStart();
                          }
                        }}
                        onInstall={() => {
                          void handleInstall();
                        }}
                        onUninstall={() => {
                          void handleUninstall();
                        }}
                        onInstallLevelChange={(level) => {
                          setServiceInstallLevel(level);
                          persistServiceInstallOptions(level, serviceAutostart);
                        }}
                        onInstallAutostartChange={(enabled) => {
                          setServiceAutostart(enabled);
                          persistServiceInstallOptions(serviceInstallLevel, enabled);
                        }}
                      />
                    </div>

                    {isTauriRuntime() && (
                      <div className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 backdrop-blur-sm group hover:border-blue-500/40 transition-all duration-300">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 transition-colors">
                            <FileText size={18} className="text-slate-400 group-hover:text-blue-500" />
                          </div>
                          <div className="min-w-0 space-y-3">
                            <div className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('launcher.runtime_paths')}</div>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1">{t('launcher.config_dir')}</div>
                              <div className="text-sm font-mono text-slate-600 dark:text-slate-300 break-all">{displayedConfigDir}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1">{t('launcher.app_data_dir')}</div>
                              <div className="text-sm font-mono text-slate-500 dark:text-slate-400 break-all">{displayedAppDataDir}</div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (isServiceRunning) {
                              toast.warning(t('launcher.messages.stop_service_before_dirs'));
                              return;
                            }
                            setShowConfigSelector(true);
                          }}
                          disabled={isServiceRunning}
                          className={`px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 text-sm font-bold transition-all shrink-0 shadow-sm self-start ${isServiceRunning
                            ? 'bg-slate-100/60 dark:bg-slate-800/50 cursor-not-allowed'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white'
                          }`}
                          title={isServiceRunning ? t('launcher.messages.stop_service_before_dirs') : undefined}
                        >
                          {t('launcher.modify_runtime_dirs')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-full lg:w-72 shrink-0">
                    <QuickActionsPanel
                      title={t('launcher.quick_actions')}
                      openWebUiLabel={t('launcher.open_web_ui')}
                      configLabel={t('launcher.config')}
                      openConfigDirLabel={t('launcher.open_config_dir')}
                      editConfigLabel={t('launcher.edit_config')}
                      helpLabel={t('launcher.help')}
                      aboutLabel={t('about.open')}
                      configDisabled={isServiceRunning}
                      configDisabledHint={t('launcher.messages.stop_service_before_config')}
                      onConfigDisabled={() => toast.warning(t('launcher.messages.stop_service_before_config'))}
                      onOpenWebUi={handleOpenWebUI}
                      onOpenConfigDir={handleOpenConfig}
                      onEditConfig={handleEditConfig}
                      onOpenAbout={() => setIsAboutOpen(true)}
                      showSetupWizardAction={false}
                    />
                  </div>
                </div>

                {/* Bottom section: Log Viewer - full width */}
                <LogViewer
                  logs={logs}
                  onClear={() => setLogs([])}
                  maxHeight="280px"
                  title={t('launcher.system_logs')}
                  className="shadow-inner"
                />
              </div>
         </div>

          {/* Footer */}
          <div className="flex justify-center items-center pt-6 pb-[calc(1.5rem+var(--safe-area-bottom))] border-t border-slate-200/50 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-8 text-sm text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase opacity-70">
              <span className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                {t('launcher.footer_product')} v{version}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="hidden sm:inline hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-default">{t('launcher.footer_build')}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                {t('launcher.footer_ready')}
              </span>
            </div>
          </div>
        </div>


      {/* Config Selector Modal */}
      <ConfigSelector
        isOpen={showConfigSelector}
        onRuntimeDirsSelected={handleRuntimeDirsSelected}
        canClose={true}
        currentValue={{
          configDir: displayedConfigDir === '...' ? '' : displayedConfigDir,
          appDataDir: displayedAppDataDir === '...' ? '' : displayedAppDataDir,
        }}
        presets={runtimeDirPresets}
        onClose={() => setShowConfigSelector(false)}
      />

      {missingConfigPrompt && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/70 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/60">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {t('launcher.runtime_config_missing_title')}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('launcher.runtime_config_missing_prompt', { path: missingConfigPrompt.configPath })}
              </p>
              <div className="rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 text-sm font-mono break-all text-slate-700 dark:text-slate-200">
                {missingConfigPrompt.configPath}
              </div>
            </div>
            <div className="px-6 py-5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-end gap-3 bg-slate-50/80 dark:bg-slate-950/40">
              <button
                onClick={() => closeMissingConfigPrompt(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              >
                {t('launcher.runtime_config_missing_reject')}
              </button>
              <button
                onClick={() => closeMissingConfigPrompt(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg shadow-blue-500/25 transition-all"
              >
                {t('launcher.runtime_config_missing_accept')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSetupRequiredPromptOpen && (
        <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-amber-300/40 bg-white/95 dark:bg-slate-900/95 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/60">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                {t('setup.wizard.title')}
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('forgotPassword.adminRecoveryHint')}
              </p>
              {setupStatus?.install_lock_path && (
                <div className="rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 text-sm font-mono break-all text-slate-700 dark:text-slate-200">
                  {setupStatus.install_lock_path}
                </div>
              )}
            </div>
            <div className="px-6 py-5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-end gap-3 bg-slate-50/80 dark:bg-slate-950/40">
              <button
                onClick={() => setIsSetupRequiredPromptOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { void enterSetupModeFromPrompt(); }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25 transition-all"
              >
                {t('launcher.setup_wizard')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        currentVersion={version}
        showCheckUpdates={true}
        isCheckingUpdates={isCheckingAboutUpdates}
        updateInfo={aboutUpdateInfo}
        updateError={aboutUpdateError}
        onCheckUpdates={handleCheckAboutUpdates}
        getUpdateGuideUrl={(info, updateInfo) =>
          buildAboutUpdateGuideUrl(updateGuideBaseUrl, info, updateInfo)
        }
        onOpenLink={(url) => {
          void handleOpenExternalLink(url);
        }}
      />

      {isEditingConfig && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-2 sm:p-4">
          <ConfigWorkbenchShell
            title={t('launcher.edit_config')}
            configPath={configFilePath}
            onClose={handleCloseConfigEditor}
            closeAriaLabel={t('common.close')}
          >
            <SystemConfigWorkbench
              tomlAdapter={toml}
              loading={configFetching}
              configPath={configFilePath}
              content={configContent}
              savedContent={savedConfigContent}
              notes={configNotes}
              validationErrors={configErrors}
              busy={configBusy}
              onChange={setConfigContent}
              onTest={handleTestConfig}
              onSave={handleSaveConfig}
              onCancel={handleResetToSavedConfig}
              onClearValidationErrors={() => setConfigErrors([])}
              showCancel={false}
              reloadSummary={configSummary}
              reloadSummaryLevel={configSummaryLevel}
            />
          </ConfigWorkbenchShell>
        </div>
      )}
    </div>

    {/* Toast Container - placed at outermost layer to ensure correct display */}
    <ToastI18nContext.Provider value={toastI18n}>
      <ToastContainer />
    </ToastI18nContext.Provider>
    </>
  );
}
