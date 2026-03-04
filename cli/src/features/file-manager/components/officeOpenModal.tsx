import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Download, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { client } from '@/lib/api.ts';
import { useConfigStore } from '@/stores/config.ts';
import { useThemeStore } from '@fileuni/shared';
import { cn } from '@/lib/utils.ts';
import { fetchFileDownloadUrl, fetchFileStatSize, getFileExtension, isComplexOfficeFile, OFFICE_PPTX_EXTS, resolveLimitBytes } from '../utils/officeLite.ts';

interface Props {
  path: string;
  onClose: () => void;
}

interface AppInfo {
  id: string;
  name: string;
  app_type: 'internal' | 'web' | 'local';
  url_template?: string;
}

export const OfficeOpenModal: React.FC<Props> = ({ path, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { capabilities } = useConfigStore();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statSize, setStatSize] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const ext = useMemo(() => getFileExtension(path), [path]);
  const isPreviewOnly = OFFICE_PPTX_EXTS.has(ext);
  const officeLimitBytes = resolveLimitBytes(capabilities?.preview_size_limits?.office_mb);
  const isLargeFile = statSize > officeLimitBytes;
  const isComplex = isComplexOfficeFile(ext, statSize);
  const fileName = path.split('/').pop() || 'Office File';
  const enableWopi = capabilities?.enable_wopi === true;
  const enableMicrosoftViewer = capabilities?.enable_microsoft_viewer === true;
  const enableGoogleViewer = capabilities?.enable_google_viewer === true;

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const size = await fetchFileStatSize(path);
      setStatSize(size);
      const { data } = await client.GET('/api/v1/file/integration/apps', {
        params: { query: { ext } }
      });
      const list = (data?.data as AppInfo[]) || [];
      const merged = list.some(app => app.id === 'office-lite')
        ? list
        : list.concat({ id: 'office-lite', name: t('filemanager.officeLite.name'), app_type: 'internal' });
      setApps(merged.filter(app => app.id === 'office-lite' || (enableWopi && app.id === 'wopi-office')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load apps');
      setApps([{ id: 'office-lite', name: t('filemanager.officeLite.name'), app_type: 'internal' }]);
    } finally {
      setLoading(false);
    }
  }, [enableWopi, ext, path, t]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const openOfficeLite = () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    params.delete('preview_path');
    params.set('office_path', path);
    params.set('office_mode', isPreviewOnly ? 'preview' : 'edit');
    window.location.hash = params.toString();
  };

  const openWopi = async () => {
    try {
      const mode = isPreviewOnly ? 'view' : 'edit';
      const { data } = await client.GET('/api/v1/file/integration/wopi/open', {
        params: { query: { path, mode } }
      });
      if (data?.success && data.data) {
        const resData = data.data as unknown as { url: string };
        if (resData.url) {
          window.open(resData.url, '_blank');
          onClose();
          return;
        }
      }
      setError('Failed to open Office Online');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open Office Online');
    }
  };

  const openExternalViewer = async (provider: 'microsoft' | 'google') => {
    try {
      const fileUrl = await fetchFileDownloadUrl(path, true);
      const viewerUrl = provider === 'microsoft'
        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
        : `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`;
      window.open(viewerUrl, '_blank');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open external viewer');
    }
  };

  const downloadFile = async () => {
    try {
      const downloadUrl = await fetchFileDownloadUrl(path, false);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={cn(
        "w-full max-w-lg rounded-[2rem] border shadow-2xl p-6 space-y-4",
        isDark ? "bg-zinc-950 border-white/10 text-white" : "bg-white border-zinc-200 text-zinc-900"
      )}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black tracking-tight">{t('filemanager.officeLite.openTitle')}</h3>
            <p className="text-sm opacity-60 mt-1">{fileName}</p>
          </div>
          <Button variant="ghost" className="h-9 w-9 rounded-full" onClick={onClose}>
            <XCircle size={18} />
          </Button>
        </div>

        <p className="text-sm opacity-70">{t('filemanager.officeLite.openHint')}</p>
        <p className="text-sm opacity-50">{t('filemanager.officeLite.externalViewerHint')}</p>

        {(isLargeFile || isComplex) && (
          <div className={cn(
            "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
            isDark ? "border-white/10 bg-white/5 text-white/70" : "border-zinc-200 bg-zinc-50 text-zinc-600"
          )}>
            {isLargeFile && (
              <div>{t('filemanager.officeLite.largeFileWarning', { size: Math.ceil(officeLimitBytes / (1024 * 1024)) })}</div>
            )}
            {isComplex && (
              <div className={cn(isLargeFile && "mt-2")}>{t('filemanager.officeLite.complexHint')}</div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] opacity-50">
            <Loader2 size={18} className="animate-spin" />
            {t('filemanager.officeLite.loadingApps')}
          </div>
        ) : (
          <div className="grid gap-3">
            {apps.some(app => app.id === 'office-lite') && (
              <Button variant="primary" className="h-12 rounded-2xl justify-between px-4" onClick={openOfficeLite}>
                <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.officeLite.openLite')}</span>
                <FileText size={16} />
              </Button>
            )}
            {apps.some(app => app.id === 'wopi-office') && enableWopi && (
              <Button variant="outline" className="h-12 rounded-2xl justify-between px-4" onClick={openWopi}>
                <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.officeLite.openWopi')}</span>
                <ExternalLink size={16} />
              </Button>
            )}
            {enableMicrosoftViewer && (
              <Button variant="outline" className="h-12 rounded-2xl justify-between px-4" onClick={() => openExternalViewer('microsoft')}>
                <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.officeLite.openMicrosoftViewer')}</span>
                <ExternalLink size={16} />
              </Button>
            )}
            {enableGoogleViewer && (
              <Button variant="outline" className="h-12 rounded-2xl justify-between px-4" onClick={() => openExternalViewer('google')}>
                <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.officeLite.openGoogleViewer')}</span>
                <ExternalLink size={16} />
              </Button>
            )}
            <Button variant="ghost" className="h-12 rounded-2xl justify-between px-4" onClick={downloadFile}>
              <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.officeLite.openDownload')}</span>
              <Download size={16} />
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
};
