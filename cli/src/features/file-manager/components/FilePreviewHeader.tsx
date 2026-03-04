import React from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { BASE_URL, client, extractData } from '@/lib/api.ts';
import { useThemeStore } from '@fileuni/shared';

interface FilePreviewHeaderProps {
  path: string;
  fileName?: string;
  loading?: boolean;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: string;
  isDark?: boolean;
  onClose?: () => void;
}

/**
 * 统一的文件预览页眉组件 / Unified File Preview Header Component
 * 遵循 Navbar 色彩规范，确保在明暗模式下均具有高辨识度
 */
export const FilePreviewHeader = ({
  path,
  fileName: propFileName,
  loading,
  extra,
  icon,
  subtitle,
  isDark: propIsDark,
  onClose
}: FilePreviewHeaderProps) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const fileName = propFileName || path.split('/').pop() || 'File';

  const isDark = propIsDark ?? (theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches));

  const handleDownload = async () => {
    try {
      const data = await extractData<{ token: string }>(client.GET('/api/v1/file/get-file-download-token', { 
        params: { query: { path } } 
      }));
      
      const downloadUrl = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.token)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  const defaultOnClose = () => {
    if (onClose) {
      onClose();
    } else {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      if (params.has('preview_path')) {
        params.delete('preview_path');
        window.location.hash = params.toString();
      } else {
        window.history.back();
      }
    }
  };

  return (
    <header className={cn(
      "h-16 shrink-0 border-b flex items-center justify-between px-6 z-50 transition-all duration-300",
      isDark ? "bg-zinc-950 text-white border-white/5" : "bg-white text-zinc-900 border-gray-200 shadow-sm"
    )}>
      {/* Left Info */}
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform hover:rotate-6",
          isDark ? "bg-white/5 text-primary" : "bg-primary/10 text-primary shadow-inner"
        )}>
          {icon || <FileText size={20} />}
        </div>
        <div className="min-w-0">
          <h3 className="font-black truncate text-sm tracking-tight">{fileName}</h3>
          <p className={cn(
            "text-sm font-black uppercase tracking-[0.2em]",
            isDark ? "text-white/30" : "text-gray-400"
          )}>
            {subtitle || "File Preview"}
          </p>
        </div>
      </div>
      
      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Extra buttons (Edit, Save, etc.) - No broad text overrides here */}
        <div className="flex items-center gap-2">
          {extra}
        </div>
        
        {extra && <div className={cn("w-px h-6", isDark ? "bg-white/10" : "bg-gray-200")} />}
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownload}
            disabled={loading}
            title={t('common.download')}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isDark 
                ? "bg-white/5 border-white/10 text-primary hover:bg-white/10 shadow-lg shadow-black/20" 
                : "bg-gray-100 border-gray-200 text-primary hover:bg-gray-200 shadow-sm"
            )}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          </button>

          <button 
            onClick={defaultOnClose}
            title={t('common.close')}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isDark 
                ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white" 
                : "bg-red-50 border-red-100 text-red-600 hover:bg-red-500 hover:text-white"
            )}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
