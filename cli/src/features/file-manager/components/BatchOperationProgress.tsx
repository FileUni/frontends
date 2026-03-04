import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { toast } from '@fileuni/shared';
import { client, BASE_URL } from '@/lib/api.ts';
import { useAuthStore } from '@/stores/auth.ts';

//  批量任务进度弹窗 / Batch task progress modal
//
//  Why/为什么：后端压缩/解压/批量操作以 task_id 异步执行，需要前端轮询展示进度与统计。
//  What/做什么：轮询 /api/v1/file/admin/file-manager/task/{id} 与 statistics 接口，并在 Modal 中展示。

type TaskStatusValue = 'pending' | 'running' | 'success' | 'failed' | 'interrupted';

type ApiResp<T> = {
  success: boolean;
  code: number;
  biz_code?: string | null;
  msg?: string;
  data: T;
  req_id?: string;
  cip?: string;
};

interface TaskStatus {
  id: string;
  status: TaskStatusValue;
  progress: number;
  message?: string | null;
  created_at: string;
  updated_at: string;
}

interface BatchStatistics {
  total: number;
  success: number;
  failed: number;
  pending: number;
  skipped: number;
  total_size: number;
  total_time_ms: number;
  failed_items: Array<{
    file_path: string;
    error_message: string;
  }>;
}

export function BatchOperationProgress({
  isOpen,
  taskId,
  onClose,
  onFinished,
}: {
  isOpen: boolean;
  taskId: string | null;
  onClose: () => void;
  onFinished?: (status: TaskStatusValue) => void;
}) {
  const { t } = useTranslation();
  const finishedOnceRef = useRef(false);

  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [statistics, setStatistics] = useState<BatchStatistics | null>(null);
  const [showFailedDetails, setShowFailedDetails] = useState(false);
  const [showJsonReport, setShowJsonReport] = useState(false);
  const [jsonReportData, setJsonReportData] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !taskId) return undefined;

    finishedOnceRef.current = false;
    setTaskStatus(null);
    setStatistics(null);
    setLoading(true);

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const { data: taskResp, error: taskError } = await client.GET(
          '/api/v1/file/task/{id}',
          { params: { path: { id: taskId } } },
        );

        if (taskError || !taskResp?.success || !taskResp.data) return;

        const task = taskResp.data as TaskStatus;
        setTaskStatus(task);

        if (
          task.status === 'running' ||
          task.status === 'success' ||
          task.status === 'failed'
        ) {
          const { data: statsResp, error: statsError } = await client.GET(
            '/api/v1/file/task/{id}/statistics',
            { params: { path: { id: taskId } } },
          );

          if (!statsError && statsResp?.success && statsResp.data) {
            setStatistics(statsResp.data as BatchStatistics);
          }
        }

        if (
          task.status === 'success' ||
          task.status === 'failed' ||
          task.status === 'interrupted'
        ) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          if (!finishedOnceRef.current) {
            finishedOnceRef.current = true;
            onFinished?.(task.status);
          }
        }
      } catch (error) {
        console.error('Error fetching task status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, taskId, onFinished]);

  const handleViewJsonReport = async () => {
    if (!taskId) return;

    try {
      const { currentUserData } = useAuthStore.getState();
      const headers: Record<string, string> = {};
      if (currentUserData?.access_token) {
        headers['Authorization'] = `Bearer ${currentUserData.access_token}`;
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/file/task/${taskId}/export`,
        { headers },
      );
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const text = await response.text();
      setJsonReportData(text);
      setShowJsonReport(true);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error(t('filemanager.batch.exportFailed'));
    }
  };

  const handleContinue = async () => {
    if (!taskId) return;

    try {
      const { currentUserData } = useAuthStore.getState();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (currentUserData?.access_token) {
        headers['Authorization'] = `Bearer ${currentUserData.access_token}`;
      }

      const response = await fetch(
        `${BASE_URL}/api/v1/file/task/${taskId}/continue`,
        {
          method: 'POST',
          headers,
        },
      );

      if (!response.ok) {
        const errJson = (await response
          .json()
          .catch(() => ({ msg: 'Request failed' }))) as { msg?: string };
        throw new Error(errJson.msg || 'Request failed');
      }

      const res = (await response.json()) as ApiResp<{ retry_count: number }>;
      const retryCount = res.data?.retry_count || 0;

      toast.success(t('filemanager.batch.continueStarted', { count: retryCount }));

      // 刷新任务状态 / Refresh task status
      window.location.reload();
    } catch (error) {
      console.error('Error continuing operation:', error);
      toast.error(
        error instanceof Error ? error.message : t('filemanager.batch.continueFailed'),
      );
    }
  };

  const handleDownloadJson = () => {
    if (!jsonReportData || !taskId) return;

    const blob = new Blob([jsonReportData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_report_${taskId}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(t('filemanager.batch.reportExported'));
  };

  const getStatusColor = (status: TaskStatusValue) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'running':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-gray-500';
      case 'interrupted':
        return 'bg-orange-500';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  if (!isOpen || !taskId) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('filemanager.batch.operationProgress')}
        className="max-w-2xl"
      >
        {loading ? (
          <div className="p-2">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {taskStatus && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {t('filemanager.batch.status')}
                  </span>
                  <Badge className={getStatusColor(taskStatus.status)}>
                    {t(`filemanager.batch.status_${taskStatus.status}`)}
                  </Badge>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('filemanager.batch.progress')}</span>
                    <span>{taskStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${getStatusColor(
                        taskStatus.status,
                      )}`}
                      style={{ width: `${taskStatus.progress}%` }}
                    ></div>
                  </div>
                </div>

                {taskStatus.message && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {taskStatus.message}
                  </p>
                )}
              </div>
            )}

            {statistics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {statistics.success}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('filemanager.batch.success')}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {statistics.failed}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('filemanager.batch.failed')}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {statistics.total}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('filemanager.batch.total')}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatBytes(statistics.total_size)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('filemanager.batch.totalSize')}
                  </div>
                </div>
              </div>
            )}

            {statistics && statistics.failed > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">
                    {t('filemanager.batch.failedItems')}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => setShowFailedDetails(!showFailedDetails)}
                    className="rounded-xl px-4 py-2 text-sm"
                  >
                    {showFailedDetails
                      ? t('filemanager.batch.hideDetails')
                      : t('filemanager.batch.showDetails')}
                  </Button>
                </div>

                {showFailedDetails && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {statistics.failed_items.map((item, index) => (
                      <div
                        key={index}
                        className="bg-red-50 dark:bg-red-900/20 rounded p-3"
                      >
                        <div className="text-sm font-medium text-red-700 dark:text-red-300">
                          {item.file_path}
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {item.error_message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={handleViewJsonReport} className="rounded-xl px-4 py-2 text-sm">
                {t('filemanager.batch.viewJsonReport')}
              </Button>
              <Button variant="outline" onClick={handleContinue} className="rounded-xl px-4 py-2 text-sm">
                {t('filemanager.batch.retryFailed')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showJsonReport}
        onClose={() => setShowJsonReport(false)}
        title={t('filemanager.batch.jsonReport')}
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <pre className="text-sm bg-black/10 rounded-xl p-4 overflow-auto max-h-[60vh]">
            {jsonReportData || ''}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowJsonReport(false)}>
              {t('common.close')}
            </Button>
            <Button variant="primary" onClick={handleDownloadJson}>
              {t('filemanager.batch.downloadJson')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
