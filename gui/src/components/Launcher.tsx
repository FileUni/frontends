import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
} from 'lucide-react';
import { useThemeStore, type Theme, useLanguageStore, type Language,
  type LogEntry,
  ToastContainer,
  toast,
  shouldShowToast,
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

// OS info interface
interface OSInfo {
  os_type: string;
  support_service: boolean;
  nixos_hint: boolean;
}

// Service status response
interface ServiceStatusResponse {
  status: string;
  is_running: boolean;
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
  const { configDir, appDataDir, setRuntimeDirs, hasSelectedRuntimeDirs } = useConfigStore();

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
  const nixosToastShown = useRef(false);

  // Log related state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uptime, setUptime] = useState(0);
  const stats = { cpu: 12, memory: 128, connections: 5 };

  // Config selector state
  const [showConfigSelector, setShowConfigSelector] = useState(false);

  const [serviceInstallLevel, setServiceInstallLevel] = useState<ServiceInstallLevel>('system');
  const [serviceAutostart, setServiceAutostart] = useState(true);

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
  const [isResettingAdminPassword, setIsResettingAdminPassword] = useState(false);

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

  // Check config path on initial load
  useEffect(() => {
    if (!hasSelectedRuntimeDirs) {
      invoke<{ config_dir: string; app_data_dir: string }>('get_default_runtime_dirs')
        .then((defaults) => {
          if (defaults?.config_dir && defaults?.app_data_dir) {
            return handleRuntimeDirsSelected(defaults.config_dir, defaults.app_data_dir);
          }
          setShowConfigSelector(true);
          return undefined;
        })
        .catch(() => {
          setShowConfigSelector(true);
        });
    } else {
      invoke('set_runtime_dirs', {
        config_dir: configDir,
        app_data_dir: appDataDir,
      }).catch(console.error);
    }
  }, [hasSelectedRuntimeDirs, configDir, appDataDir]);

  const handleRuntimeDirsSelected = async (nextConfigDir: string, nextAppDataDir: string) => {
    try {
      await invoke('set_runtime_dirs', {
        config_dir: nextConfigDir,
        app_data_dir: nextAppDataDir,
      });
      setRuntimeDirs(nextConfigDir, nextAppDataDir);
      setShowConfigSelector(false);
      toast.success(t('launcher.messages.config_set_success'));
    } catch (e: unknown) {
      toast.error(String(e));
    }
  };

  const handleEditConfig = async () => {
    setIsEditingConfig(true);
    setConfigFetching(true);
    try {
      const content = await invoke<string>('get_config_content');
      const notes = await invoke<Record<string, ConfigNoteEntry>>('get_config_notes');
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
      await invoke('save_and_reload_config', { content: configContent });
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
      const res = await invoke<string[]>('test_config', { content: configContent });
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
    let unlisten: Promise<() => void>;

    const init = async () => {
      await refreshStatus();
      await getVersion();
      await getOS();

      unlisten = listen<string>('service-action', (event) => {
        if (event.payload === 'start') handleStart();
        if (event.payload === 'stop') handleStop();
      });
    };

    init();

    const unsubscribeLogs = listen<LogEntry>('log-update', (event) => {
      setLogs(prev => [...prev, event.payload].slice(-1000));
    });

    invoke('subscribe_logs').catch(console.error);

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
      if (unlisten) unlisten.then(f => f()).catch(console.error);
      unsubscribeLogs.then(f => f()).catch(console.error);
      clearInterval(uptimeInterval);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [status]);

  const refreshStatus = async () => {
    try {
      const response = await invoke<ServiceStatusResponse>('get_service_status');
      setStatus(response.status);
    } catch (e: unknown) {
      console.error(e);
      setStatus('Unknown');
    }
  };

  const getVersion = async () => {
    try {
      const v = await invoke<string>('get_app_version');
      setVersion(v);
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const getOS = async () => {
    try {
      const info = await invoke<OSInfo>('get_os_info');
      setOsInfo(info);
      if (info.nixos_hint && !nixosToastShown.current) {
        nixosToastShown.current = true;
        const shouldShow = await shouldShowToast('nixos_hint');
        if (shouldShow) {
          toast.warning(
            `${t('launcher.nixos_detected')}\n${t('launcher.nixos_desc')}`,
            {
              duration: 'persistent',
              showDoNotShowAgain: true,
              doNotShowAgainKey: 'nixos_hint'
            }
          );
        }
      }
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke<string>('start_service');
      toast.success(t('launcher.messages.service_started'));
      await refreshStatus();
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke<string>('stop_service');
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
    setLoading(true);
    try {
      await invoke<string>('install_service', { level: serviceInstallLevel, autostart: serviceAutostart });
      toast.success(t('launcher.messages.install_requested'));
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
    setLoading(false);
  };

  const handleUninstall = async () => {
    setLoading(true);
    try {
      await invoke<string>('uninstall_service');
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
      await invoke('open_web_ui');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleOpenConfig = async () => {
    try {
      await invoke('open_config_dir');
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
    }
  };

  const handleResetAdminPassword = async (password: string): Promise<string> => {
    setLoading(true);
    try {
      const res = await invoke<string>('reset_admin_password', { password });
      toast.success(res || t('launcher.reset_admin_password_success'));
      const matched = typeof res === 'string' ? res.match(/user:\s*(.+)$/i) : null;
      return matched?.[1]?.trim() || 'admin';
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e));
      throw e;
    } finally {
      setLoading(false);
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

  // Format uptime
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-200/50 dark:border-slate-800/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
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
                        disableToggle={!hasSelectedRuntimeDirs}
                        disabledHint={t('config_selector.path_required')}
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

                    {configDir && appDataDir && (
                      <div className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-4 flex items-center justify-between gap-4 backdrop-blur-sm group hover:border-blue-500/40 transition-all duration-300">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 transition-colors">
                            <FileText size={18} className="text-slate-400 group-hover:text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{t('launcher.config')}</div>
                            <div className="text-sm font-mono text-slate-600 dark:text-slate-300 truncate" title={configDir}>{configDir}</div>
                            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={appDataDir}>{appDataDir}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowConfigSelector(true)}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white text-slate-600 dark:text-slate-400 text-sm font-bold transition-all shrink-0 shadow-sm"
                        >
                          {t('launcher.change_config')}
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
                      resetAdminPasswordLabel={t('launcher.reset_admin_password')}
                      onOpenWebUi={handleOpenWebUI}
                      onOpenConfigDir={handleOpenConfig}
                      onEditConfig={handleEditConfig}
                      onResetAdminPassword={() => setIsResettingAdminPassword(true)}
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
          <div className="flex justify-center items-center py-6 border-t border-slate-200/50 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-900/30">
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
        canClose={hasSelectedRuntimeDirs}
        onClose={() => setShowConfigSelector(false)}
      />

      <AdminPasswordPanel
        mode="modal"
        isOpen={isResettingAdminPassword}
        onClose={() => setIsResettingAdminPassword(false)}
        onConfirm={handleResetAdminPassword}
        loading={loading}
        showWarning={false}
        showRandomGenerator={true}
        minPasswordLength={6}
      />

      {isEditingConfig && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-2 sm:p-4">
          <ConfigWorkbenchShell
            title={t('launcher.edit_config')}
            configPath={configDir ?? ''}
            onClose={handleCloseConfigEditor}
            closeAriaLabel={t('common.close')}
          >
            <SystemConfigWorkbench
              tomlAdapter={toml}
              loading={configFetching}
              configPath={configDir ?? ''}
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
              onResetAdminPassword={handleResetAdminPassword}
              isResettingAdminPassword={loading}
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
