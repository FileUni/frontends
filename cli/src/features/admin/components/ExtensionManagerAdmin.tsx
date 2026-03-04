import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button.tsx';
import { handleApiError } from '@/lib/api.ts';
import { useAuthStore } from '@/stores/auth.ts';
import { useConfigStore } from '@/stores/config.ts';
import { useToastStore } from '@fileuni/shared';
import { useTranslation } from 'react-i18next';
import { useNavigationStore } from '@/stores/navigation.ts';
import { storageHub } from '@fileuni/shared';
import { ToolPanel } from './extensions/ToolPanel.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Puzzle, Cpu } from 'lucide-react';
import {
  fetchLatestToolInfoApi,
  fetchServicesApi,
  fetchToolsApi,
  installToolApi,
  deleteToolApi,
  resetOpenlistAdminApi,
  serviceActionApi,
} from './extensions/api.ts';

import type { InstallBody, ToolInfo, ToolKind } from './extensions/types.ts';

type ToolState = {
  version: string;
  downloadUrl: string;
  binPath: string;
  proxy: string;
  // Extra fields
  dataPath?: string;
  rcloneConfigPath?: string;
  rcloneMountCommand?: string;
  rcloneUnmountCommand?: string;
};

type PersistedToolState = Omit<ToolState, 'version' | 'downloadUrl'>;

export const ExtensionManagerAdmin = () => {
  const { t, i18n } = useTranslation();
  const { addToast } = useToastStore();
  const { params, navigate } = useNavigationStore();
  const { currentUserData } = useAuthStore();
  const { capabilities, fetchCapabilities } = useConfigStore();

  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [serviceStatus, setServiceStatus] = useState<Record<string, { follow_start: boolean; running: boolean; pid?: number | null; kind: ToolKind }>>({});
  const [loading, setLoading] = useState(true);
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>({});
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  const extPage = params.ext || 'openlist';
  
  const currentTool = useMemo(() => tools.find(t => t.name === extPage), [tools, extPage]);
  const extItems = useMemo(() => {
    const order = ['openlist', 'rclone', 'kopia'];
    return [...tools].sort((a, b) => {
      const idxA = order.indexOf(a.name);
      const idxB = order.indexOf(b.name);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    }).map(t => ({
      key: t.name,
      label: t.name === 'openlist' ? 'OpenList' : t.name === 'rclone' ? 'Rclone' : t.name.charAt(0).toUpperCase() + t.name.slice(1),
      installed: t.installed
    }));
  }, [tools]);

  const updateToolState = (tool: string, patch: Partial<ToolState>) => {
    setToolStates(prev => ({
      ...prev,
      [tool]: { ...prev[tool], ...patch }
    }));
  };

  const fetchTools = async () => {
    const data = await fetchToolsApi();
    if (data) setTools(data);
  };

  const fetchServices = async () => {
    const data = await fetchServicesApi();
    if (data) {
      const next: Record<string, { follow_start: boolean; running: boolean; pid?: number | null; kind: ToolKind }> = {};
      for (const item of data) {
        next[item.tool] = { follow_start: item.follow_start, running: item.running, pid: item.pid, kind: item.kind };
      }
      setServiceStatus(next);
    }
  };

  const fetchLatestInfo = async () => {
    setIsFetchingInfo(true);
    try {
      const info = await fetchLatestToolInfoApi(extPage);
      if (info) {
        updateToolState(extPage, {
          version: info.version,
          downloadUrl: info.download_url,
        });
        addToast(t('admin.extensions.fetchLatestSuccess'), 'success');
      }
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all([fetchTools(), fetchServices(), fetchCapabilities()]);
      } catch (error) {
        addToast(handleApiError(error, t), 'error');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [addToast, t, fetchCapabilities]);

  useEffect(() => {
    if (!params.ext && extItems.length > 0) {
      navigate({ mod: 'admin', page: 'extensions', ext: extItems[0].key });
    }
  }, [params.ext, navigate, extItems]);

  // Persistence for user-defined settings (EXCLUDE version and downloadUrl)
  useEffect(() => {
    const userId = currentUserData?.user.id;
    if (!userId) return;
    const key = `ext-ui-overrides-v2:${userId}`;
    try {
      const raw = storageHub.getLocalItem(key);
      if (!raw) return;
      const v = JSON.parse(raw);
      setToolStates(prev => {
        const next = { ...prev };
        Object.keys(v).forEach(tool => {
          // Only restore persistent settings, not transient suggestions
          next[tool] = { 
            ...next[tool], 
            ...v[tool],
            version: '', // Always reset suggestion on load
            downloadUrl: '' 
          };
        });
        return next;
      });
    } catch (_e) {}
  }, [currentUserData?.user.id]);

  useEffect(() => {
    const userId = currentUserData?.user.id;
    if (!userId) return;
    const key = `ext-ui-overrides-v2:${userId}`;
    // Filter out version and downloadUrl before saving
    const toSave: Record<string, PersistedToolState> = {};
    Object.keys(toolStates).forEach(tool => {
      const currentState = toolStates[tool];
      if (!currentState) return;
      const { version, downloadUrl, ...persistent } = currentState;
      toSave[tool] = persistent;
    });
    storageHub.setLocalItem(key, JSON.stringify(toSave));
  }, [currentUserData?.user.id, toolStates]);

  const controlService = async (tool: string, action: 'start' | 'stop' | 'restart') => {
    try {
      await serviceActionApi(tool, action);
      await fetchServices();
      addToast(t('admin.extensions.serviceActionSuccess'), 'success');
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };

  const installToolQuick = async (tool: string) => {
    const state = toolStates[tool];
    if (!state) return;
    try {
      const body: InstallBody = { 
        version: state.version, 
        download_link: state.downloadUrl,
        github_proxy: state.proxy,
        target_bin_dir: state.binPath
      };
      if (!body.download_link) {
        addToast(t('admin.extensions.downloadUrlMissing'), 'error');
        return;
      }
      await installToolApi(tool, body);
      addToast(t('admin.extensions.downloadSuccess', { tool }), 'success');
      await fetchTools();
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };

  const deleteToolQuick = async (tool: string) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await deleteToolApi(tool);
      addToast(t('common.success'), 'success');
      await fetchTools();
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };


  if (loading) return <div className="py-10 text-sm font-semibold opacity-70">{t('admin.extensions.loading')}</div>;

  const currentState = toolStates[extPage] || { version: '', downloadUrl: '', binPath: '', proxy: '' };
  const lang = i18n.language.startsWith('en') ? 'en' : 'zh';
  const description = currentTool ? (lang === 'en' ? currentTool.description_en : currentTool.description_zh) : '';

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-[2rem] border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary group-hover:scale-110 transition-transform duration-500 shadow-inner">
              <Puzzle size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{t("admin.extensions.title")}</h2>
              <p className="text-sm font-bold opacity-60 uppercase tracking-wider">{t("admin.extensions.subtitle") || 'Extension & Plugin Infrastructure'}</p>
            </div>
          </div>
          <Badge variant="outline" className="h-10 px-4 rounded-2xl border-white/10 bg-white/5 opacity-60 flex gap-3 items-center backdrop-blur-md">
            <Cpu size={16} className="opacity-40" />
            <span className="font-mono text-sm uppercase font-black tracking-widest">{capabilities?.runtime_os || 'linux'} / {capabilities?.runtime_arch || 'x86_64'}</span>
          </Badge>
        </div>
      </div>

      <div className="p-2 bg-white/[0.03] rounded-[2rem] border border-white/5 flex gap-2 flex-wrap shadow-2xl backdrop-blur-sm mx-1">
        {extItems.map((item) => (
          <Button 
            key={item.key} 
            size="sm" 
            variant={extPage === item.key ? 'primary' : 'ghost'} 
            onClick={() => navigate({ mod: 'admin', page: 'extensions', ext: item.key })}
            className={`relative rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[14px] transition-all duration-300 ${extPage === item.key ? 'shadow-xl shadow-primary/30' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`}
          >
            {item.label}
            {item.installed && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-sm shadow-green-500/50"></span>
              </span>
            )}
          </Button>
        ))}
      </div>

      <ToolPanel
        tool={extPage}
        kind={currentTool?.kind || 'service'}
        installed={currentTool?.installed || false}
        installDir={currentTool?.install_dir}
        binPathConfig={currentTool?.bin_path}
        homepage={currentTool?.homepage || ''}
        description={description}
        followStart={serviceStatus[extPage]?.follow_start}
        running={serviceStatus[extPage]?.running}
        pid={serviceStatus[extPage]?.pid}
        loading={isFetchingInfo}
        version={currentState.version}
        setVersion={(v) => updateToolState(extPage, { version: v })}
        binPath={currentState.binPath || currentTool?.bin_path || ''}
        setBinPath={(v) => updateToolState(extPage, { binPath: v })}
        proxy={currentState.proxy}
        setProxy={(v) => updateToolState(extPage, { proxy: v })}
        downloadUrl={currentState.downloadUrl}
        setDownloadUrl={(v) => updateToolState(extPage, { downloadUrl: v })}
        extraFields={[
          ...(extPage === 'openlist' ? [{ label: t('admin.extensions.openlist.dataPathLabel'), value: currentState.dataPath || './data/extensions/state/openlist/data', onChange: (v: string) => updateToolState(extPage, { dataPath: v }), placeholder: './data/extensions/state/openlist/data' }] : []),
          ...(extPage === 'rclone' ? [
            { label: t('admin.extensions.rclone.configPathLabel'), value: currentState.rcloneConfigPath || './data/extensions/state/rclone/rclone.conf', onChange: (v: string) => updateToolState(extPage, { rcloneConfigPath: v }), placeholder: './data/extensions/state/rclone/rclone.conf' },
            { label: t('admin.extensions.rclone.mountCommandLabel'), value: currentState.rcloneMountCommand || '${BinPath} mount remote: /mnt/remote --config=${ConfigFilePath}', onChange: (v: string) => updateToolState(extPage, { rcloneMountCommand: v }), isTextArea: true },
            { label: t('admin.extensions.rclone.unmountCommandLabel'), value: currentState.rcloneUnmountCommand || 'fusermount -u /mnt/remote', onChange: (v: string) => updateToolState(extPage, { rcloneUnmountCommand: v }), isTextArea: true },
          ] : [])
        ]}
        extraActions={[
          ...(extPage === 'openlist' ? [{ label: t('admin.extensions.openlist.resetAdmin'), onClick: async () => { const res = await resetOpenlistAdminApi(currentState.dataPath || './data/extensions/state/openlist/data'); return res?.stdout || res?.stderr || ''; }, showOutputInModal: true }] : []),
          ...(extPage === 'rclone' ? [{
            label: t('admin.extensions.rclone.copyMount'),
            onClick: () => {
              const binPath = currentTool?.executable_path || 'rclone';
              const configPath = currentState.rcloneConfigPath || './data/extensions/state/rclone/rclone.conf';
              const text = (currentState.rcloneMountCommand || '').replaceAll('${BinPath}', binPath).replaceAll('${ConfigFilePath}', configPath);
              navigator.clipboard.writeText(text);
              addToast(t('admin.extensions.rclone.copyMountSuccess'), 'success');
            }
          }] : [])
        ]}
        onDownload={() => installToolQuick(extPage)}
        onDelete={() => deleteToolQuick(extPage)}
        onFetchLatest={fetchLatestInfo}
        onStartService={() => controlService(extPage, 'start')}
        onStopService={() => controlService(extPage, 'stop')}
        onRestart={() => controlService(extPage, 'restart')}
      />

    </div>
  );
};
