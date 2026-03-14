import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { 
  Database, Activity, ShieldAlert, RefreshCw, 
  Unlock, HardDrive, Cpu, AlertTriangle, Users
} from 'lucide-react';
import { client, extractData, handleApiError } from '@/lib/api.ts';

type AdminStorageStats = {
  total_users: number;
  total_used: number;
  total_quota: number;
};

type MaintenanceStatus = {
  locked_users: string[];
  is_global_maintenance: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isAdminStorageStats = (value: unknown): value is AdminStorageStats => {
  if (!isRecord(value)) return false;
  return (
    typeof value.total_users === 'number' &&
    Number.isFinite(value.total_users) &&
    typeof value.total_used === 'number' &&
    Number.isFinite(value.total_used) &&
    typeof value.total_quota === 'number' &&
    Number.isFinite(value.total_quota)
  );
};

const isMaintenanceStatus = (value: unknown): value is MaintenanceStatus => {
  if (!isRecord(value)) return false;
  if (typeof value.is_global_maintenance !== 'boolean') return false;
  if (!Array.isArray(value.locked_users)) return false;
  return value.locked_users.every((u) => typeof u === 'string');
};

export const FileSystemAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStorageStats | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [lockedUsers, setLockedUsers] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncingUserIndex, setSyncingUserIndex] = useState(false);
  const [userIdForIndexSync, setUserIdForIndexSync] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, maintenanceRes] = await Promise.allSettled([
        extractData<unknown>(client.GET('/api/v1/file/admin/storage-stats')),
        extractData<unknown>(client.GET('/api/v1/file/admin/maintenance/status')),
      ]);

      if (statsRes.status === 'fulfilled' && isAdminStorageStats(statsRes.value)) {
        setStats(statsRes.value);
      } else {
        setStats(null);
      }

      if (
        maintenanceRes.status === 'fulfilled' &&
        isMaintenanceStatus(maintenanceRes.value)
      ) {
        setMaintenanceStatus(maintenanceRes.value);
        setLockedUsers(maintenanceRes.value.locked_users);
      } else {
        setMaintenanceStatus(null);
        setLockedUsers([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const data = await extractData<{ task_id: string; total_users: number }>(
        client.POST('/api/v1/file/admin/full-index-sync')
      );
      addToast(`${t('admin.fs.sync_success')} (task_id=${data.task_id})`, 'success');
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    }
    finally { setSyncing(false); }
  };

  const handleSyncIndexForUser = async () => {
    const userId = userIdForIndexSync.trim();
    if (!userId) {
      addToast(t('admin.fs.user_id_required'), 'warning');
      return;
    }

    setSyncingUserIndex(true);
    try {
      const data = await extractData<{ task_id: string; user_id: string; path: string }>(
        client.POST(`/api/v1/file/admin/index-sync/${encodeURIComponent(userId)}`)
      );
      addToast(
        t('admin.fs.sync_user_success', { user_id: data.user_id, task_id: data.task_id }),
        'success'
      );
      setUserIdForIndexSync('');
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setSyncingUserIndex(false);
    }
  };

  const handleGlobalUnlock = async () => {
    if (!confirm(t('admin.fs.unlock_confirm'))) return;
    setUnlocking(true);
    try {
      // 使用类型化的 client 调用终止 WAL 逻辑
      const { data: res } = await client.POST('/api/v1/file/admin/file-manager/wal/terminate');
      if (res?.success) {
        addToast(t('admin.fs.unlock_success'), 'success');
        fetchData();
      }
    } catch (e) { console.error(e); }
    finally { setUnlocking(false); }
  };

  const formatSize = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
      return t('common.na');
    }
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  if (loading) return <div className="h-64 flex items-center justify-center font-black animate-pulse opacity-50 uppercase tracking-widest">{t('admin.loading')}</div>;

  const hasStats = stats !== null;
  const hasMaintenance = maintenanceStatus !== null;

  const totalUsed = hasStats ? stats.total_used : null;
  const totalQuota = hasStats ? stats.total_quota : null;
  const totalUsers = hasStats ? stats.total_users : null;

  const quotaPct =
    typeof totalUsed === 'number' && typeof totalQuota === 'number' && totalQuota > 0
      ? Math.min(100, (totalUsed / totalQuota) * 100)
      : null;
  const isGlobalMaintenance = hasMaintenance ? maintenanceStatus.is_global_maintenance : null;

  return (
    <div className="space-y-10">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Database className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 -rotate-12 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.cluster_storage')}</p>
          <h3 className="text-3xl font-black">{formatSize(totalUsed)}</h3>
          <p className="text-sm font-bold mt-4 text-primary uppercase tracking-widest">
            {t('admin.fs.system_status')}:{' '}
            {isGlobalMaintenance === null
              ? t('common.na')
              : (isGlobalMaintenance ? t('common.on') : t('common.off'))}
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Activity className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.usage_efficiency')}</p>
          <h3 className="text-3xl font-black">
            {quotaPct === null ? t('common.na') : `${quotaPct.toFixed(1)}%`}
          </h3>
          <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${quotaPct ?? 0}%` }}
            />
          </div>
          <p className="text-sm font-bold mt-4 opacity-40 uppercase tracking-widest">
            {formatSize(totalUsed)} / {formatSize(totalQuota)}
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Cpu className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.total_users')}</p>
          <h3 className="text-3xl font-black tabular-nums">{typeof totalUsers === 'number' ? totalUsers : t('common.na')}</h3>
          <p className="text-sm font-bold mt-4 opacity-40 uppercase tracking-widest">
            {t('admin.fs.locked_users')}:{' '}
            {hasMaintenance ? lockedUsers.length : t('common.na')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Maintenance Actions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <HardDrive size={18} className="text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.fs.global_ops')}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData} className="opacity-50 hover:opacity-100">
              <RefreshCw size={18} className="mr-2" /> {t('common.refresh')}
            </Button>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl space-y-6">
            <p className="text-sm font-bold opacity-50 italic">
              {t('admin.fs.global_ops_desc')}
            </p>
            <div className="grid grid-cols-1 gap-4">
              <Button variant="outline" className="h-16 justify-between group" onClick={handleFullSync} disabled={syncing}>
                <span className="flex items-center gap-3">
                  <RefreshCw size={20} className={syncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                  <span className="font-black uppercase tracking-widest text-sm">{t('admin.fs.sync_index')}</span>
                </span>
                <span className="text-sm opacity-30 font-bold">RE-INDEX CLUSTER</span>
              </Button>
            </div>

            <div className="pt-5 border-t border-white/5 space-y-3">
              <p className="text-sm font-bold opacity-50 italic">
                {t('admin.fs.sync_user_index_desc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <Input
                    value={userIdForIndexSync}
                    onChange={(e) => setUserIdForIndexSync(e.target.value)}
                    placeholder={t('admin.fs.user_id_placeholder')}
                    className="h-12 font-mono"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-12 px-5 justify-center"
                  onClick={handleSyncIndexForUser}
                  disabled={syncingUserIndex}
                >
                  <RefreshCw size={18} className={syncingUserIndex ? 'animate-spin mr-2' : 'mr-2'} />
                  <span className="font-black uppercase tracking-widest text-sm">{t('admin.fs.sync_user_index')}</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 pt-4">
            <ShieldAlert size={18} className="text-red-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-red-500">{t('admin.fs.emergency_control')}</h2>
          </div>
          <div className="bg-red-500/5 border border-red-500/10 rounded-[2.5rem] p-8 shadow-xl space-y-6">
            <p className="text-sm font-bold text-red-400/60 italic">
              {t('admin.fs.emergency_desc')}
            </p>
            <Button variant="outline" className="w-full h-16 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white group" onClick={handleGlobalUnlock} disabled={unlocking}>
              <Unlock size={20} className="mr-3 group-hover:scale-110 transition-transform" />
              <span className="font-black uppercase tracking-widest text-sm">{t('admin.fs.force_unlock')}</span>
            </Button>
          </div>
        </div>

        {/* Locked Users List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Users size={18} className="text-orange-500" />
              <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.fs.locked_users')}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData} className="opacity-50 hover:opacity-100">
              <RefreshCw size={18} className="mr-2" /> {t('common.refresh')}
            </Button>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl min-h-[400px]">
            {!hasMaintenance ? (
              <div className="h-full flex flex-col items-center justify-center py-20 opacity-30 italic text-center">
                <AlertTriangle size={48} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">{t('admin.fs.maintenance_status_unavailable')}</p>
              </div>
            ) : lockedUsers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 italic">
                <AlertTriangle size={48} className="mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">{t('admin.fs.no_locked_users')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lockedUsers.map(user => (
                  <div key={user} className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <span className="font-mono text-sm font-black">{user}</span>
                    </div>
                    <Badge variant="warning">{t('admin.fs.statusRecovering')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Badge = ({ children, variant = 'ghost' }: { children: React.ReactNode, variant?: 'success' | 'warning' | 'ghost' }) => {
  const styles = {
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
    warning: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    ghost: 'bg-white/5 text-white/40 border-white/10'
  };
  return (
    <span className={`px-2 py-1 rounded-md text-sm font-black border uppercase tracking-tighter ${styles[variant]}`}>
      {children}
    </span>
  );
};
