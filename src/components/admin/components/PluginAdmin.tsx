import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/Button';
import { AdminCard, AdminPage, AdminPageHeader } from './admin-ui';
import { PlugZap, RefreshCw, Upload, Download, Play, Square, Trash2, Settings2, X, Wrench } from 'lucide-react';

type MarketPlugin = {
  id: string;
  name: string;
  summary: string;
  author: string;
  latestVersion: string | null;
  runtimes: string[];
  downloadUrl: string | null;
};

type RegistryPlugin = {
  id: string;
  display_name: string;
  runtime_kind: string;
  source_kind: string;
  current_version: string | null;
  install_status: string;
  enabled: boolean;
};

type RuntimeHandle = {
  plugin_id: string;
  runtime_kind: string;
  status: string;
  detail: string;
};

type PluginStatus = {
  runtime: {
    enabled: boolean;
    temp_dir: string;
    host_api_base_url: string;
    layout: { packages_dir: string; config_dir: string };
  };
  stats: {
    plugin_count: number;
    version_count: number;
    audit_log_count: number;
  };
};

type PluginConfig = {
  plugin_id: string;
  config_dir: string;
  config_file: string;
  content: string;
};

type PluginPermissionGrant = {
  permission_key: string;
  granted: boolean;
};

const authHeaders = (token: string | undefined) => {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

export const PluginAdmin: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const token = useAuthStore((s) => s.currentUserData?.access_token);

  const [market, setMarket] = useState<MarketPlugin[]>([]);
  const [registry, setRegistry] = useState<RegistryPlugin[]>([]);
  const [runtimes, setRuntimes] = useState<RuntimeHandle[]>([]);
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('');
  const [marketUrl, setMarketUrl] = useState('');
  const [configText, setConfigText] = useState('');
  const [configMeta, setConfigMeta] = useState<PluginConfig | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [permissions, setPermissions] = useState<PluginPermissionGrant[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [navigationModalOpen, setNavigationModalOpen] = useState(false);
  const [navigationItems, setNavigationItems] = useState<unknown[]>([]);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [uninstallConfirmOpen, setUninstallConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [marketInstalling, setMarketInstalling] = useState(false);
  const [installTab, setInstallTab] = useState<'upload' | 'market'>('upload');
  const [materializeDialogOpen, setMaterializeDialogOpen] = useState(false);
  const [materializeTarget, setMaterializeTarget] = useState<{
    pluginId: string;
    version: string;
    name: string;
    isUpdate: boolean;
    downloadSteps: { idx: number; defaultUrl: string; userUrl: string }[];
    configSchema: Record<string, unknown> | null;
    configValues: Record<string, string>;
  } | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedRuntime = useMemo(
    () => runtimes.find((item) => item.plugin_id === selectedPluginId) ?? null,
    [runtimes, selectedPluginId],
  );

  const selectedPlugin = useMemo(
    () => registry.find((item) => item.id === selectedPluginId) ?? null,
    [registry, selectedPluginId],
  );

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: init?.headers ?? authHeaders(token),
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const json = (await response.json()) as { msg?: string; message?: string };
        message = json.msg || json.message || message;
      } catch {
        // ignore parse failure
      }
      throw new Error(message);
    }
    const json = (await response.json()) as { data: T };
    return json.data;
  }, [token]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [marketData, registryData, runtimeData, statusData] = await Promise.all([
        fetchJson<{ plugins?: MarketPlugin[] }>('/api/v1/admin/plugins/market/catalog').catch(() => ({ plugins: [] })),
        fetchJson<RegistryPlugin[]>('/api/v1/admin/plugins/registry'),
        fetchJson<{ runtimes: RuntimeHandle[] }>('/api/v1/admin/plugins/runtimes'),
        fetchJson<PluginStatus>('/api/v1/admin/plugins/status'),
      ]);
      setMarket(marketData.plugins ?? []);
      setRegistry(registryData);
      setRuntimes(runtimeData.runtimes ?? []);
      setStatus(statusData);
      if (selectedPluginId && !registryData.some((item) => item.id === selectedPluginId)) {
        setSelectedPluginId(registryData[0]?.id ?? '');
      } else if (!selectedPluginId && registryData[0]) {
        setSelectedPluginId(registryData[0].id);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to load plugin data', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchJson, addToast, selectedPluginId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleInstallFromMarket = async () => {
    if (!marketUrl.trim()) return;
    setMarketInstalling(true);
    try {
      await fetchJson('/api/v1/admin/plugins/market/install', {
        method: 'POST',
        headers: (() => {
          const headers = authHeaders(token);
          headers.set('Content-Type', 'application/json');
          return headers;
        })(),
        body: JSON.stringify({ download_url: marketUrl.trim() }),
      });
      addToast('Plugin package installed from market URL', 'success');
      setMarketUrl('');
      await reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to install plugin', 'error');
    } finally {
      setMarketInstalling(false);
    }
  };

  const openMaterializeDialog = async (pluginId: string, version: string) => {
    const registryPlugin = registry.find((p) => p.id === pluginId);
    const isUpdate = registryPlugin?.install_status === 'installed' && registryPlugin.current_version !== version;
    try {
      const manifestResponse = await fetchJson<{
        name: string;
        config_schema: Record<string, unknown> | null;
        install_commands: { action: string; url?: string }[];
        upgrade_commands: { action: string; url?: string }[];
      }>(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/manifest`);
      const allCommands = [
        ...(isUpdate ? manifestResponse.upgrade_commands : manifestResponse.install_commands),
      ];
      const downloadSteps: { idx: number; defaultUrl: string; userUrl: string }[] = [];
      allCommands.forEach((cmd, idx) => {
        if (cmd.action === 'download' && cmd.url) {
          downloadSteps.push({ idx, defaultUrl: cmd.url, userUrl: '' });
        }
      });
      // compute default config values from schema defaults
      const configValues: Record<string, string> = {};
      const schemaProps = manifestResponse.config_schema?.['properties'] as Record<string, { default?: unknown; type?: string }> | undefined;
      if (schemaProps) {
        for (const [key, prop] of Object.entries(schemaProps)) {
          if (prop.default !== undefined) {
            configValues[key] = String(prop.default);
          }
        }
      }
      setMaterializeTarget({
        pluginId,
        version,
        name: manifestResponse.name,
        isUpdate,
        downloadSteps,
        configSchema: manifestResponse.config_schema ?? null,
        configValues,
      });
      setMaterializeDialogOpen(true);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to load plugin manifest', 'error');
    }
  };

  const handleMaterialize = async () => {
    if (!materializeTarget) return;
    setMaterializing(true);
    try {
      const body: Record<string, unknown> = { version: materializeTarget.version };
      const overrides: Record<string, string> = {};
      for (const step of materializeTarget.downloadSteps) {
        if (step.userUrl.trim()) {
          overrides[String(step.idx)] = step.userUrl.trim();
        }
      }
      if (Object.keys(overrides).length > 0) {
        body['download_url_overrides'] = overrides;
      }
      // send config values if any were set
      if (materializeTarget.configSchema && Object.keys(materializeTarget.configValues).length > 0) {
        body['config_values'] = materializeTarget.configValues;
      }
      const response = await fetch(`/api/v1/admin/plugins/${encodeURIComponent(materializeTarget.pluginId)}/materialize`, {
        method: 'POST',
        headers: (() => {
          const headers = authHeaders(token);
          headers.set('Content-Type', 'application/json');
          return headers;
        })(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const json = await response.json() as { msg?: string; message?: string };
          message = json.msg || json.message || message;
        } catch { /* ignore */ }
        throw new Error(message);
      }
      addToast('Plugin materialized successfully', 'success');
      setMaterializeDialogOpen(false);
      setMaterializeTarget(null);
      await reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to materialize plugin', 'error');
    } finally {
      setMaterializing(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await fetch('/api/v1/admin/plugins/install', {
        method: 'POST',
        headers: authHeaders(token),
        body: await file.arrayBuffer(),
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const json = (await response.json()) as { msg?: string; message?: string };
          message = json.msg || json.message || message;
        } catch {
          // ignore parse failure
        }
        throw new Error(message);
      }
      addToast('Local plugin package installed', 'success');
      await reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to upload plugin package', 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const mutatePlugin = async (pluginId: string, action: 'start' | 'stop' | 'uninstall') => {
    try {
      await fetchJson(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/${action}`, {
        method: 'POST',
        headers: authHeaders(token),
      });
      addToast(`Plugin ${action} completed`, 'success');
      await reload();
    } catch (error) {
      addToast(error instanceof Error ? error.message : `Failed to ${action} plugin`, 'error');
    }
  };

  const openPermissionsModal = async (pluginId: string) => {
    setPermissionsModalOpen(true);
    setPermissionsLoading(true);
    try {
      const data = await fetchJson<PluginPermissionGrant[]>(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/permissions`);
      setPermissions(data);
    } catch (error) {
      setPermissions([]);
      addToast(error instanceof Error ? error.message : 'Failed to load plugin permissions', 'error');
    } finally {
      setPermissionsLoading(false);
    }
  };

  const openTasksModal = async (pluginId: string) => {
    setTasksModalOpen(true);
    setTasksLoading(true);
    try {
      const data = await fetchJson<{ tasks?: unknown[] }>(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/tasks`);
      setTasks(data.tasks ?? []);
    } catch (error) {
      setTasks([]);
      addToast(error instanceof Error ? error.message : 'Failed to load plugin tasks', 'error');
    } finally {
      setTasksLoading(false);
    }
  };

  const openNavigationModal = async (pluginId: string) => {
    setNavigationModalOpen(true);
    setNavigationLoading(true);
    try {
      const data = await fetchJson<{ items?: unknown[] }>(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/nav-items`);
      setNavigationItems(data.items ?? []);
    } catch (error) {
      setNavigationItems([]);
      addToast(error instanceof Error ? error.message : 'Failed to load plugin navigation', 'error');
    } finally {
      setNavigationLoading(false);
    }
  };

  const loadConfig = useCallback(async (pluginId: string) => {
    try {
      const data = await fetchJson<PluginConfig>(`/api/v1/admin/plugins/${encodeURIComponent(pluginId)}/config`);
      setConfigMeta(data);
      setConfigText(data.content);
    } catch (error) {
      setConfigMeta(null);
      setConfigText('');
      addToast(error instanceof Error ? error.message : 'Failed to load plugin config', 'error');
    }
  }, [fetchJson, addToast]);

  const saveConfig = async () => {
    if (!selectedPluginId) return;
    try {
      const data = await fetchJson<PluginConfig>(`/api/v1/admin/plugins/${encodeURIComponent(selectedPluginId)}/config`, {
        method: 'POST',
        headers: (() => {
          const headers = authHeaders(token);
          headers.set('Content-Type', 'application/json');
          return headers;
        })(),
        body: JSON.stringify({ content: configText }),
      });
      setConfigMeta(data);
      setConfigText(data.content);
      addToast('Plugin config saved', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to save plugin config', 'error');
    }
  };

  useEffect(() => {
    if (selectedPluginId) {
      void loadConfig(selectedPluginId);
    }
  }, [selectedPluginId, loadConfig]);

  return (
    <AdminPage>
      <AdminPageHeader
        icon={<PlugZap size={24} />}
        title={t('common.plugins', { defaultValue: 'Plugins' })}
        subtitle={'Plugin market, installation, runtime, and package management'}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
        <AdminCard variant="glass" className="p-6 rounded-[2rem] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Install Plugin</h2>
            <Button variant="ghost" size="sm" onClick={() => void reload()}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
          </div>

          <div className="flex gap-2 border-b border-border pb-2">
            <button type="button" onClick={() => setInstallTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${installTab === 'upload' ? 'bg-primary text-primary-foreground' : 'opacity-60 hover:opacity-100'}`}>
              <Upload size={14} className="inline mr-1" /> Upload
            </button>
            <button type="button" onClick={() => setInstallTab('market')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${installTab === 'market' ? 'bg-primary text-primary-foreground' : 'opacity-60 hover:opacity-100'}`}>
              <Download size={14} className="inline mr-1" /> Market URL
            </button>
          </div>

          {installTab === 'upload' && (
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-white font-bold cursor-pointer">
                <Upload size={16} className="mr-2" /> {uploading ? 'Uploading...' : 'Upload .zip.fupkg'}
                <input type="file" accept=".fupkg,.zip.fupkg" className="hidden" onChange={(e) => void handleUpload(e)} />
              </label>
            </div>
          )}

          {installTab === 'market' && (
            <div className="flex flex-col gap-3">
              <input
                value={marketUrl}
                onChange={(e) => setMarketUrl(e.target.value)}
                placeholder="Paste a .zip.fupkg market download URL"
                className="min-h-11 rounded-xl border border-border bg-background px-4"
              />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void handleInstallFromMarket()} disabled={marketInstalling || !marketUrl.trim()}>
                  <Download size={16} className="mr-2" /> Install from URL
                </Button>
              </div>
              <div className="space-y-3 mt-2">
                {market.length === 0 ? (
                  <div className="text-sm opacity-60">No market plugins loaded yet.</div>
                ) : market.map((plugin) => (
                  <div key={plugin.id} className="rounded-2xl border border-border bg-background/60 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black">{plugin.name}</div>
                        <div className="text-xs opacity-60">{plugin.id} - {plugin.author}</div>
                      </div>
                      <div className="text-xs font-bold opacity-70">{plugin.latestVersion ?? 'n/a'}</div>
                    </div>
                    <div className="text-sm opacity-70">{plugin.summary}</div>
                    <div className="text-xs opacity-50">{plugin.runtimes.join(', ')}</div>
                    {plugin.downloadUrl ? (
                      <Button size="sm" onClick={() => { setMarketUrl(plugin.downloadUrl ?? ''); }}>
                        Use download URL
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}


        </AdminCard>

        <AdminCard variant="glass" className="p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-black">Plugin Runtime Status</h2>
          {status ? (
            <div className="space-y-2 text-sm">
              <div>Enabled: <strong>{String(status.runtime.enabled)}</strong></div>
              <div>Plugin count: <strong>{status.stats.plugin_count}</strong></div>
              <div>Package dir: <code>{status.runtime.layout.packages_dir}</code></div>
              <div>Config dir: <code>{status.runtime.layout.config_dir}</code></div>
              <div>Host API: <code>{status.runtime.host_api_base_url}</code></div>
            </div>
          ) : (
            <div className="text-sm opacity-60">Loading runtime status…</div>
          )}
        </AdminCard>
      </div>

      <AdminCard variant="glass" className="p-6 rounded-[2rem] space-y-4">
        <h2 className="text-lg font-black">Installed Plugins</h2>
        {loading ? (
          <div className="text-sm opacity-60">Loading plugins...</div>
        ) : registry.length === 0 ? (
          <div className="text-sm opacity-60">No plugins registered.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
            <div className="space-y-3">
              {registry.filter((p) => p.install_status === 'pending').length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold opacity-50 uppercase tracking-wider mb-2">Pending Materialize</div>
                  {registry.filter((p) => p.install_status === 'pending').map((plugin) => (
                    <div key={plugin.id} className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-black">{plugin.display_name}</div>
                          <div className="text-xs opacity-60">{plugin.id}</div>
                          <div className="text-xs opacity-50">{plugin.current_version ?? '?'} - pending</div>
                        </div>
                        <Button size="sm" onClick={() => { void openMaterializeDialog(plugin.id, plugin.current_version ?? ''); }}>
                          <Wrench size={14} className="mr-1" /> Materialize
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs font-bold opacity-50 uppercase tracking-wider mb-2">Installed</div>
              {registry.filter((p) => p.install_status !== 'pending').map((plugin) => (
                <button
                  key={plugin.id}
                  type="button"
                  onClick={() => setSelectedPluginId(plugin.id)}
                  className={`w-full rounded-2xl border p-4 text-left ${selectedPluginId === plugin.id ? 'border-primary bg-primary/10' : 'border-border bg-background/50'}`}
                >
                  <div className="font-black">{plugin.display_name}</div>
                  <div className="text-xs opacity-60">{plugin.id}</div>
                  <div className="mt-2 text-sm opacity-70">{plugin.runtime_kind} - {plugin.install_status}</div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-background/50 p-4 space-y-4">
              {selectedPluginId ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-black">{selectedPluginId}</div>
                      <div className="text-xs opacity-60">Runtime: {selectedRuntime?.runtime_kind ?? 'stopped'}</div>
                    </div>
                    <div className="text-xs opacity-60">{selectedRuntime?.status ?? 'inactive'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void mutatePlugin(selectedPluginId, 'start')} disabled={!selectedPlugin || !!selectedRuntime || selectedPlugin.install_status !== 'installed'}>
                      <Play size={16} className="mr-2" /> Start
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void mutatePlugin(selectedPluginId, 'stop')} disabled={!selectedRuntime}>
                      <Square size={16} className="mr-2" /> Stop
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void openPermissionsModal(selectedPluginId)} disabled={!selectedPlugin}>
                      <PlugZap size={16} className="mr-2" /> Permissions
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void openTasksModal(selectedPluginId)} disabled={!selectedPlugin}>
                      <Play size={16} className="mr-2" /> Tasks
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void openNavigationModal(selectedPluginId)} disabled={!selectedPlugin}>
                      <RefreshCw size={16} className="mr-2" /> Navigation
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfigModalOpen(true)} disabled={!selectedPlugin}>
                      <Settings2 size={16} className="mr-2" /> Settings
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setUninstallConfirmOpen(true)} disabled={!selectedPlugin}>
                      <Trash2 size={16} className="mr-2" /> Uninstall
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm opacity-60">Select an installed plugin to inspect it.</div>
              )}
            </div>
          </div>
        )}
      </AdminCard>

      {configModalOpen && selectedPluginId ? (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-[2rem] border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Plugin Settings</h2>
                <div className="text-xs opacity-60">{configMeta?.config_file ?? 'Loading config path…'}</div>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="rounded-xl border border-border p-2 hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              className="min-h-[24rem] w-full rounded-2xl border border-border bg-background p-4 font-mono text-sm"
              spellCheck={false}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfigModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void saveConfig()}>
                Save config
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {permissionsModalOpen && selectedPluginId ? (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Plugin Permissions</h2>
                <div className="text-xs opacity-60">{selectedPluginId}</div>
              </div>
              <button
                type="button"
                onClick={() => setPermissionsModalOpen(false)}
                className="rounded-xl border border-border p-2 hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-[26rem] overflow-auto pr-1">
              {permissionsLoading ? (
                <div className="text-sm opacity-60">Loading permissions…</div>
              ) : permissions.length === 0 ? (
                <div className="text-sm opacity-60">No permissions recorded.</div>
              ) : permissions.map((permission) => (
                <div key={permission.permission_key} className="rounded-2xl border border-border bg-background/60 p-4 flex items-center justify-between gap-3">
                  <div className="font-mono text-sm">{permission.permission_key}</div>
                  <div className={`text-xs font-bold ${permission.granted ? 'text-emerald-500' : 'opacity-50'}`}>
                    {permission.granted ? 'Granted' : 'Not granted'}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setPermissionsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {uninstallConfirmOpen && selectedPlugin ? (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Confirm Uninstall</h2>
                <div className="text-xs opacity-60">{selectedPlugin.id}</div>
              </div>
              <button
                type="button"
                onClick={() => setUninstallConfirmOpen(false)}
                className="rounded-xl border border-border p-2 hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6">
              Uninstalling this plugin will permanently remove its package, plugin data, SQLite broker data, shared records, and plugin settings.
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setUninstallConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void mutatePlugin(selectedPlugin.id, 'uninstall');
                  setUninstallConfirmOpen(false);
                }}
              >
                <Trash2 size={16} className="mr-2" /> Uninstall Plugin
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {materializeDialogOpen && materializeTarget ? (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Materialize: {materializeTarget.name}</h2>
                <div className="text-xs opacity-60">{materializeTarget.pluginId} v{materializeTarget.version}</div>
              </div>
              <button
                type="button"
                onClick={() => { setMaterializeDialogOpen(false); setMaterializeTarget(null); }}
                className="rounded-xl border border-border p-2 hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {materializeTarget.isUpdate && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                This will update the plugin from an older version. The old version will be removed after successful materialize.
              </div>
            )}

            {materializeTarget.downloadSteps.length > 0 && (
              <div className="space-y-3">
                <div className="font-bold text-sm">Download URLs (leave blank to use default)</div>
                {materializeTarget.downloadSteps.map((step) => (
                  <div key={step.idx} className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                    <div className="text-xs font-mono opacity-70">Download step #{step.idx + 1}</div>
                    <input
                      value={step.userUrl}
                      onChange={(e) => {
                        const updated = [...materializeTarget.downloadSteps];
                        const found = updated.find((s) => s.idx === step.idx);
                        if (found) found.userUrl = e.target.value;
                        setMaterializeTarget({ ...materializeTarget, downloadSteps: updated });
                      }}
                      placeholder={step.defaultUrl}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            )}

            {(materializeTarget.configSchema && materializeTarget.configSchema['properties']) ? (
              <div className="space-y-3">
                <div className="font-bold text-sm">Plugin Configuration</div>
                {Object.entries(materializeTarget.configSchema['properties'] as Record<string, { description?: string; type?: string; default?: unknown }>).map(([key, prop]) => (
                  <div key={key} className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
                    <div className="text-xs font-medium">{key}{prop.description ? <span className="opacity-60 ml-1">- {prop.description}</span> : null}</div>
                    <input
                      value={materializeTarget.configValues[key] ?? ''}
                      onChange={(e) => {
                        setMaterializeTarget({
                          ...materializeTarget,
                          configValues: { ...materializeTarget.configValues, [key]: e.target.value },
                        });
                      }}
                      placeholder={prop.default !== undefined ? String(prop.default) : ''}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-background/50 p-4 text-sm">
              Run install lifecycle commands, validate runtime, and mark plugin as installed.
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setMaterializeDialogOpen(false); setMaterializeTarget(null); }}>
                Cancel
              </Button>
              <Button onClick={() => void handleMaterialize()} disabled={materializing}>
                <Wrench size={16} className="mr-2" /> {materializing ? 'Materializing...' : 'Materialize'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tasksModalOpen && selectedPluginId ? (
        <JsonViewerModal
          title="Plugin Tasks"
          subtitle={selectedPluginId}
          loading={tasksLoading}
          emptyText="No tasks recorded."
          value={tasks}
          onClose={() => setTasksModalOpen(false)}
        />
      ) : null}

      {navigationModalOpen && selectedPluginId ? (
        <JsonViewerModal
          title="Plugin Navigation"
          subtitle={selectedPluginId}
          loading={navigationLoading}
          emptyText="No navigation items recorded."
          value={navigationItems}
          onClose={() => setNavigationModalOpen(false)}
        />
      ) : null}
    </AdminPage>
  );
};

const JsonViewerModal: React.FC<{
  title: string;
  subtitle: string;
  loading: boolean;
  emptyText: string;
  value: unknown;
  onClose: () => void;
}> = ({ title, subtitle, loading, emptyText, value, onClose }) => {
  const isEmpty = Array.isArray(value) ? value.length === 0 : !value;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-[2rem] border border-border bg-background shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <div className="text-xs opacity-60">{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border p-2 hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="text-sm opacity-60">Loading…</div>
        ) : isEmpty ? (
          <div className="text-sm opacity-60">{emptyText}</div>
        ) : (
          <pre className="rounded-2xl bg-muted p-4 overflow-auto text-xs max-h-[28rem]">{JSON.stringify(value, null, 2)}</pre>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
