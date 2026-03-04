import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Input } from '@/components/ui/Input.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Pagination } from '@/components/common/Pagination.tsx';
import { 
  ClipboardList, Search,
  RefreshCw, Calendar, User,
  Activity, AlertCircle
} from 'lucide-react';
import { client } from '@/lib/api.ts';

// Journal log entry type - matches yh_journal_log entity / 审计日志条目类型
interface JournalLogEntry {
  id: string | number;
  user_id: string;
  journal_type: string;
  action: string;
  src_info: string;
  dst_info?: string | null;
  status: string;
  error?: string | null;
  created_at: string;
}

export const AuditLogAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<JournalLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  
  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: res } = await client.GET('/api/v1/admin/journal/logs', {
        params: {
          query: {
            page,
            page_size: pageSize,
            user_id: userIdFilter || undefined,
            journal_type: typeFilter || undefined,
            action: actionFilter || undefined,
            status: statusFilter || undefined
          }
        }
      });
      
      if (res?.success && res.data) {
        setLogs(res.data.items);
        setTotal(res.data.total);
      }
    } catch (e) { 
      console.error(e);
      addToast(t('admin.audit.fetchError') || 'Failed to fetch audit logs', 'error');
    }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 whitespace-nowrap">{t('admin.audit.statusSuccess')}</Badge>;
      case 'FAIL':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">{t('admin.audit.statusFail')}</Badge>;
      case 'START':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 whitespace-nowrap">{t('admin.audit.statusStart')}</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FILE':
        return <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20">{t('admin.audit.typeFile')}</Badge>;
      case 'USER':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">{t('admin.audit.typeUser')}</Badge>;
      case 'SYSTEM':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{t('admin.audit.typeSystem')}</Badge>;
      case 'SECURITY':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{t('admin.audit.typeSecurity')}</Badge>;
      case 'FINANCIAL':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{t('admin.audit.typeFinancial')}</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4 min-w-0 w-full xl:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner shrink-0">
            <ClipboardList size={24} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight truncate">{t('admin.audit.title') || 'Audit Logs'}</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] shrink-0" />
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest truncate">
                {t('admin.audit.eventsTotal', { count: total })}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full xl:w-auto">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <div className="relative group min-w-[150px]">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
               <Input 
                value={userIdFilter} 
                onChange={e => setUserIdFilter(e.target.value)} 
                placeholder={t('admin.audit.userIdPlaceholder')} 
                className="pl-9 h-10 text-sm"
              />
            </div>
            <div className="relative group min-w-[120px]">
               <Activity className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
               <Input 
                value={actionFilter} 
                onChange={e => setActionFilter(e.target.value)} 
                placeholder={t('admin.audit.actionPlaceholder')} 
                className="pl-9 h-10 text-sm"
              />
            </div>
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/5 text-sm outline-none focus:border-primary/50 transition-all"
            >
              <option value="">{t('admin.audit.allTypes')}</option>
              <option value="FILE">{t('admin.audit.typeFile')}</option>
              <option value="USER">{t('admin.audit.typeUser')}</option>
              <option value="SYSTEM">{t('admin.audit.typeSystem')}</option>
              <option value="SECURITY">{t('admin.audit.typeSecurity')}</option>
              <option value="FINANCIAL">{t('admin.audit.typeFinancial')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/5 text-sm outline-none focus:border-primary/50 transition-all"
            >
              <option value="">{t('admin.audit.allStatus')}</option>
              <option value="SUCCESS">{t('admin.audit.statusSuccess')}</option>
              <option value="FAIL">{t('admin.audit.statusFail')}</option>
              <option value="START">{t('admin.audit.statusStart')}</option>
            </select>
            <button type="submit" className="h-10 px-4 rounded-xl bg-primary text-white font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              <Search size={18} />
              {t('common.search') || 'Search'}
            </button>
            <button type="button" onClick={() => {
               setUserIdFilter('');
               setActionFilter('');
               setTypeFilter('');
               setStatusFilter('');
            }} className="h-10 px-4 rounded-xl bg-white/5 border border-white/5 font-bold text-sm flex items-center gap-2 hover:bg-white/10 transition-all">
              <RefreshCw size={18} />
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-48">{t('admin.audit.table.time')}</th>
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-40">{t('admin.audit.table.user')}</th>
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-32">{t('admin.audit.table.type')}</th>
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-48">{t('admin.audit.table.action')}</th>
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-64">{t('admin.audit.table.details')}</th>
                <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-30 w-32">{t('admin.audit.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <RefreshCw className="animate-spin" size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.loading') || 'Loading...'}</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <ClipboardList size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.audit.noLogsFound')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-mono opacity-50">
                        <Calendar size={18} className="shrink-0" />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/5 font-black text-sm shrink-0">
                          {log.user_id[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-bold truncate max-w-[120px]" title={log.user_id}>{log.user_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getTypeBadge(log.journal_type)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-black tracking-tight truncate" title={log.action}>{log.action}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm opacity-60 truncate" title={log.src_info}>
                          <span className="font-bold uppercase mr-1 opacity-40">Src:</span>
                          {log.src_info}
                        </div>
                        {log.dst_info && (
                          <div className="text-sm opacity-60 truncate" title={log.dst_info}>
                            <span className="font-bold uppercase mr-1 opacity-40">Dst:</span>
                            {log.dst_info}
                          </div>
                        )}
                        {log.error && (
                          <div className="text-sm text-red-400 truncate flex items-center gap-1" title={log.error}>
                            <AlertCircle size={10} className="shrink-0" />
                            {log.error}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(log.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination 
          current={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          className="bg-background/50 backdrop-blur-md"
        />
      </div>
    </div>
  );
};
