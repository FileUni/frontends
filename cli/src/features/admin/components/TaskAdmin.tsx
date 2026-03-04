import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { 
  Activity, Clock, XCircle, CheckCircle2, 
  AlertCircle, RefreshCw
} from 'lucide-react';
import { client } from '@/lib/api.ts';
import { cn } from '@/lib/utils.ts';

// Background task type - matches yh_task_registry entity / 后台任务类型
interface BackgroundTask {
  id: string;
  user_id: string;
  task_type: string;
  status: string;
  progress: number;
  message?: string | null;
  created_at: string;
  updated_at: string;
}

// Scheduled job status type - matches ScheduledJobStatus / 定时任务状态类型
interface ScheduledJob {
  id: string;
  cron: string;
  next_run?: string | null;
  last_run?: string | null;
}

export const TaskAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchTasks = useCallback(async () => {
    try {
      const { data: res } = await client.POST('/api/v1/admin/tasks/query', {
        body: {
          page,
          page_size: pageSize,
          status: statusFilter || undefined,
          user_id: undefined
        }
      });
      if (res?.success && res.data) {
        setTasks(res.data.tasks);
        setTotal(res.data.total);
      }
    } catch (e) { console.error(e); }
  }, [page, pageSize, statusFilter]);

  const fetchScheduledJobs = useCallback(async () => {
    try {
      const { data: res } = await client.GET('/api/v1/admin/tasks/scheduled');
      if (res?.success && res.data) {
        setScheduledJobs(res.data);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTasks(), fetchScheduledJobs()]);
    setLoading(false);
  }, [fetchTasks, fetchScheduledJobs]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchTasks, 5000); // Auto refresh tasks every 5s
    return () => clearInterval(timer);
  }, [fetchData, fetchTasks]);

  const handleCancelTask = async (id: string) => {
    if (!confirm(t('admin.tasks.cancel_confirm') || 'Are you sure you want to cancel this task?')) return;
    try {
      const { data: res } = await client.POST('/api/v1/admin/tasks/cancel/{id}', {
        params: { path: { id } }
      });
      if (res?.success) {
        addToast(t('admin.tasks.cancel_success') || 'Task cancelled successfully', 'success');
        fetchTasks();
      }
    } catch (e) { console.error(e); }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="text-yellow-500" size={16} />;
      case 'running': return <RefreshCw className="text-primary animate-spin" size={16} />;
      case 'success': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'failed': return <XCircle className="text-red-500" size={16} />;
      case 'interrupted': return <AlertCircle className="text-orange-500" size={16} />;
      default: return <Clock className="text-gray-500" size={16} />;
    }
  };

  if (loading && tasks.length === 0) return <div className="h-64 flex items-center justify-center font-black animate-pulse opacity-50 uppercase tracking-widest">{t('admin.loading')}</div>;

  return (
    <div className="space-y-10">
      {/* Scheduled Jobs Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.tasks.scheduled_jobs') || 'Scheduled Maintenance Tasks'}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchScheduledJobs} className="opacity-50 hover:opacity-100">
            <RefreshCw size={18} className="mr-2" /> {t('common.refresh')}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {scheduledJobs.length === 0 ? (
            <div className="col-span-full bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-10 text-center opacity-30 italic">
              {t('admin.tasks.no_scheduled_jobs') || 'No scheduled jobs found (check configuration)'}
            </div>
          ) : (
            scheduledJobs.map(job => (
              <div key={job.id} className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-sm uppercase tracking-tight">{job.id}</h3>
                  <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">{job.cron}</span>
                </div>
                <div className="space-y-2 opacity-60 text-sm font-bold uppercase tracking-widest">
                  <div className="flex justify-between">
                    <span>Last Run:</span>
                    <span>{job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}</span>
                  </div>
                  <div className="flex justify-between text-primary/80">
                    <span>Next Run:</span>
                    <span>{job.next_run ? new Date(job.next_run).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Active Tasks Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest">{t('admin.tasks.async_tasks') || 'Active & History Tasks'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm font-bold outline-none"
            >
              <option value="">{t('admin.tasks.all_status') || 'All Status'}</option>
              <option value="pending">{t('admin.tasks.status.pending')}</option>
              <option value="running">{t('admin.tasks.status.running')}</option>
              <option value="success">{t('admin.tasks.status.success')}</option>
              <option value="failed">{t('admin.tasks.status.failed')}</option>
            </select>
            <Button variant="ghost" size="sm" onClick={fetchTasks} className="opacity-50 hover:opacity-100">
              <RefreshCw size={18} />
            </Button>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40">{t('admin.tasks.type') || 'Type'}</th>
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40">{t('admin.tasks.user') || 'User'}</th>
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40">{t('admin.tasks.progress') || 'Progress'}</th>
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40">{t('admin.tasks.status') || 'Status'}</th>
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40">{t('admin.tasks.time') || 'Created At'}</th>
                  <th className="px-6 py-4 text-sm font-black uppercase tracking-widest opacity-40 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center opacity-20 italic font-black uppercase tracking-widest">
                      {t('admin.tasks.no_tasks') || 'No tasks found'}
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-black uppercase tracking-tight">{task.task_type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold opacity-60">{task.user_id}</span>
                      </td>
                      <td className="px-6 py-4 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                task.status === 'running' ? "bg-primary animate-pulse" : 
                                task.status === 'success' ? "bg-green-500" : "bg-red-500"
                              )} 
                              style={{ width: `${task.progress}%` }} 
                            />
                          </div>
                          <span className="text-sm font-black tabular-nums">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 uppercase text-sm font-black">
                          {getStatusIcon(task.status)}
                          <span>{task.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold opacity-40">{new Date(task.created_at).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(task.status === 'running' || task.status === 'pending') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCancelTask(task.id)}
                            className="text-red-500 hover:bg-red-500/10 rounded-full h-8 w-8 p-0"
                          >
                            <XCircle size={16} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {total > pageSize && (
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} tasks
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-xl h-8 px-4 text-sm font-black"
                >
                  PREV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * pageSize >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-xl h-8 px-4 text-sm font-black"
                >
                  NEXT
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
