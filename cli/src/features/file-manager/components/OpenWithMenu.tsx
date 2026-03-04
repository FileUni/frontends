import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink, Play, Monitor, Download, Loader2, FileCode, FileText } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import type { FileInfo } from '../types/index.ts';
import { BASE_URL, client } from '@/lib/api.ts';
import { Button } from '@/components/ui/Button.tsx';
import { OFFICE_DOCX_EXTS, OFFICE_PPTX_EXTS, OFFICE_XLSX_EXTS } from '../utils/officeLite.ts';
import { useConfigStore } from '@/stores/config.ts';

interface Props {
  file: FileInfo;
  onInternalPreview?: () => void;
  className?: string;
  variant?: 'ghost' | 'primary' | 'outline';
}

interface AppInfo {
  id: string;
  name: string;
  app_type: 'internal' | 'web' | 'local';
  protocol?: string;
  url_template?: string;
  icon?: string;
}

export const OpenWithMenu = ({ file, onInternalPreview, className, variant = 'ghost' }: Props) => {
  const { t } = useTranslation();
  const { capabilities } = useConfigStore();
  const [isOpen, setIsOpen] = useState(false);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isOffice = OFFICE_DOCX_EXTS.has(ext) || OFFICE_XLSX_EXTS.has(ext) || OFFICE_PPTX_EXTS.has(ext);
  const isOfficePreviewOnly = OFFICE_PPTX_EXTS.has(ext);
  const enableWopi = capabilities?.enable_wopi !== false;

  // Fetch available app list
  const fetchApps = async () => {
    setLoading(true);
    try {
      const { data } = await client.GET('/api/v1/file/integration/apps', {
        params: { query: { ext } }
      });
      if (data?.data) {
        let nextApps = data.data as AppInfo[];
        if (isOffice) {
          nextApps = nextApps.filter(app => app.id !== 'internal');
          if (!nextApps.some(app => app.id === 'office-lite')) {
            nextApps = nextApps.concat({
              id: 'office-lite',
              name: t('filemanager.officeLite.name'),
              app_type: 'internal'
            });
          }
        }
        if (!enableWopi) {
          nextApps = nextApps.filter(app => app.id !== 'wopi-office');
        }
        setApps(nextApps);
      }
    } catch (e) {
      console.error("Failed to fetch apps", e);
      // Fallback when API fails
      if (isOffice) {
        setApps([{ id: 'office-lite', name: t('filemanager.officeLite.name'), app_type: 'internal' }]);
      } else {
        setApps([{ id: 'internal', name: 'Internal Preview', app_type: 'internal' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && apps.length === 0) {
      fetchApps();
    }
  }, [isOpen, ext]);

  const handleAppClick = async (app: AppInfo) => {
    setIsOpen(false);
    
    if (app.id === 'office-lite') {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        params.delete('preview_path');
        params.set('office_path', file.path);
        params.set('office_mode', isOfficePreviewOnly ? 'preview' : 'edit');
        window.location.hash = params.toString();
        return;
    }

    if (app.app_type === 'internal') {
        onInternalPreview?.();
        return;
    }

    if (app.app_type === 'web') {
        if (app.id === 'wopi-office' && !enableWopi) {
            return;
        }
        // WOPI web editor
        // Must fetch URL from backend because endpoint is JWT-protected
        // Direct window.open(api_url) would fail with 401
        try {
            const { data } = await client.GET('/api/v1/file/integration/wopi/open', {
                params: { query: { path: file.path, mode: 'edit' } }
            });
            if (data?.success && data.data) {
              const resData = data.data as unknown as { url: string };
              if (resData.url) {
                  window.open(resData.url, '_blank');
              }
            }
        } catch (e) {
            console.error("Failed to get WOPI URL", e);
        }
        return;
    }

    if (app.app_type === 'local' && app.protocol) {
        // Local protocol
        try {
            const { data } = await client.GET('/api/v1/file/get-file-download-token', {
                params: { query: { path: file.path } }
            });
            if (data?.data?.token) {
                // If BASE_URL is already absolute (dev), don't add origin
                const apiPath = `/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}&inline=true`;
                const downloadUrl = BASE_URL ? `${BASE_URL}${apiPath}` : `${window.location.origin}${apiPath}`;
                window.location.href = `${app.protocol}${downloadUrl}`;
            }
        } catch (e) {
            console.error("Failed to generate link", e);
        }
    }
  };

  const getIcon = (app: AppInfo) => {
      if (app.id === 'office-lite') return <FileText size={18} />;
      if (app.app_type === 'internal') return <Monitor size={18} />;
      if (app.app_type === 'web') return <ExternalLink size={18} />;
      if (app.id === 'potplayer' || app.id === 'vlc' || app.id === 'iina') return <Play size={18} />;
      if (app.id === 'vscode') return <FileCode size={18} />;
      return <ExternalLink size={18} />;
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <Button 
        variant={variant} 
        className="h-10 px-3 rounded-xl gap-2 text-sm font-bold uppercase"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ExternalLink size={18} />
        <span className="hidden sm:inline">{t('filemanager.previewModal.openWith')}</span>
        <ChevronDown size={18} className={cn("transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          {loading ? (
              <div className="px-4 py-3 flex items-center gap-3 text-sm font-bold opacity-50">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Loading Apps...</span>
              </div>
          ) : (
            <>
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleAppClick(app)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-white/5 text-left transition-colors text-zinc-300 hover:text-white"
                >
                  {getIcon(app)}
                  <span>{app.name}</span>
                </button>
              ))}
              {apps.length === 0 && (
                  <div className="px-4 py-3 text-sm opacity-40 italic">{t('filemanager.previewModal.noAppsFound')}</div>
              )}
            </>
          )}
          <div className="h-px bg-white/5 my-1" />
           <button
             className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-white/5 text-left transition-colors text-zinc-300 hover:text-white"
             onClick={async () => {
                 setIsOpen(false);
                 try {
                    const { data } = await client.GET('/api/v1/file/get-file-download-token', { params: { query: { path: file.path } } });
                    if (data?.data?.token) {
                        const downloadUrl = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}`;
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = file.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                 } catch (e) { console.error(e); }
             }}
           >
             <Download size={18} />
             <span>{t('filemanager.previewModal.downloadFile')}</span>
           </button>
        </div>
      )}
    </div>
  );
};
