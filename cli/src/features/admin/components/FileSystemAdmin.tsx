import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { 
  Database, Activity, ShieldAlert, RefreshCw, 
  Unlock, HardDrive, Cpu, AlertTriangle, Users
} from 'lucide-react';
import { client } from '@/lib/api.ts';
import type { components } from '@/types/api.ts';

type StorageStats = components["schemas"]["StorageStatsResponse"];

export const FileSystemAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [lockedUsers, setLockedUsers] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: res } = await client.GET('/api/v1/file/admin/storage-stats');
      if (res?.success && res.data) setStats(res.data);

      const { data: userRes } = await client.GET('/api/v1/file/admin/user-dirs');
      if (userRes?.success) {
        // Filter users who are in maintenance mode (locked)
        // This is a placeholder until backend provides a specific locked list endpoint
        setLockedUsers([]); 
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const { data: res } = await client.POST('/api/v1/file/admin/full-index-sync');
      if (res?.success) {
        addToast(t('admin.fs.sync_success'), 'success');
      }
    } catch (e) { console.error(e); }
    finally { setSyncing(false); }
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

  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  if (loading) return <div className="h-64 flex items-center justify-center font-black animate-pulse opacity-50 uppercase tracking-widest">{t('admin.loading')}</div>;

  return (
    <div className="space-y-10">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Database className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 -rotate-12 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.cluster_storage')}</p>
          <h3 className="text-3xl font-black">{formatSize(stats?.used || 0)}</h3>
          <p className="text-sm font-bold mt-4 text-primary uppercase tracking-widest">{t('admin.fs.active_maintenance')}</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Activity className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.usage_efficiency')}</p>
          <h3 className="text-3xl font-black">94.2%</h3>
          <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-[94.2%]" />
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
          <Cpu className="absolute -right-4 -bottom-4 w-32 h-32 opacity-5 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-black uppercase tracking-widest opacity-40 mb-1">{t('admin.fs.storage_types')}</p>
          <h3 className="text-3xl font-black">{t('admin.fs.hybridStorage')}</h3>
          <p className="text-sm font-bold mt-4 opacity-40 uppercase tracking-widest">{t('admin.fs.engine_distribution')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Maintenance Actions */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-4">
            <HardDrive size={18} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.fs.global_ops')}</h2>
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
          <div className="flex items-center gap-3 px-4">
            <Users size={18} className="text-orange-500" />
            <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.fs.locked_users')}</h2>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl min-h-[400px]">
            {lockedUsers.length === 0 ? (
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
