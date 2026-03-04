import React, { useState, useEffect, useRef } from 'react';
import { client, BASE_URL } from '@/lib/api.ts';
import { useThemeStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { useUserFileSettingsStore } from '@/stores/userFileSettings.ts';
import { cn } from '@/lib/utils.ts';
import type { FileInfo } from '../types/index.ts';
import { getThumbnailCategory } from '../utils/thumbnailUtils.ts';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ImagePreview } from './ImagePreview.tsx';
import { MarkdownVditorEditor } from './MarkdownVditorEditor.tsx';
import { VideoPlayer } from './VideoPlayer.tsx';
import { AudioPreview } from './AudioPreview.tsx';
import { TextPreviewAndEditor } from './TextPreviewAndEditor.tsx';
import { TexPreviewAndEditor } from './TexPreviewAndEditor.tsx';
import { LargeFileWarning } from './LargeFileWarning.tsx';
import { OpenWithMenu } from './OpenWithMenu.tsx';
import { Button } from '@/components/ui/Button.tsx';

// 动态导入 PdfPreview 以避免构建时 SSR 报错
const PdfPreview = React.lazy(() => import('./PdfPreview.tsx').then(m => ({ default: m.PdfPreview })));

const FALLBACK_PREVIEW_LIMIT_MB = 10;

// 扩展名映射表 / Extension Map
const TYPE_MAP = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif'],
  VIDEO: ['mp4', 'webm', 'mov', 'flv', 'avi', 'mkv', 'wmv'],
  AUDIO: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'],
  TEXT: [
      'txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'yml', 'yaml', 'toml',
      'html', 'css', 'sql', 'sh', 'bash', 'xml', 'conf', 'ini', 'log',
      'csv', 'tsv',
      'latex', 'cnf', 'cfg', 'dockerfile', 'makefile'
  ],
  TEX: ['tex', 'latex'],
  MARKDOWN: ['md'],
  PDF: ['pdf']
};

interface Props {
  path: string;
  onClose: () => void;
}

/**
 * 统一预览页面 / Unified Preview Page
 */
export const FilePreviewPage: React.FC<Props> = ({ path: p, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { capabilities } = useConfigStore();
  const { settings, fetchSettings } = useUserFileSettingsStore();
  const lastThumbPathRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ playlist: FileInfo[], index: number, type: string } | null>(null);
  const [isForced, setIsForced] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const enableMarkdownVditor = capabilities?.enable_markdown_vditor !== false;
  const jsdelivrBase = capabilities?.jsdelivr_mirror_base || 'https://cdn.jsdelivr.net';

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const init = async () => {
      if (!p) return;
      setLoading(true);
      setError(null);
      setIsForced(false);

      try {
        const name = p.split('/').pop() || '';
        const parent = p.substring(0, p.lastIndexOf('/')) || '/';
        const ext = name.split('.').pop()?.toLowerCase() || '';

        // 确定类型 / Determine type
        let currentType = 'unknown';
        if (TYPE_MAP.IMAGE.includes(ext)) currentType = 'image';
        else if (TYPE_MAP.VIDEO.includes(ext)) currentType = 'video';
        else if (TYPE_MAP.AUDIO.includes(ext)) currentType = 'audio';
        else if (TYPE_MAP.MARKDOWN.includes(ext)) currentType = 'markdown';
        else if (TYPE_MAP.TEX.includes(ext)) currentType = 'tex';
        else if (TYPE_MAP.TEXT.includes(ext)) currentType = 'text';
        else if (TYPE_MAP.PDF.includes(ext)) currentType = 'pdf';

        // 加载当前文件的详细元数据 / Load current file metadata
        let size = 0;
        try {
            const { data: statRes } = await client.GET('/api/v1/file/stat', { params: { query: { path: p } } });
            if (statRes?.data) size = statRes.data.size;
        } catch (e) {
            console.warn("Failed to fetch stat", e);
        }

        // 媒体列表加载 (支持切片预览切换) / Media list loading for gallery mode
        if (['image', 'video', 'audio'].includes(currentType)) {
            try {
                const { data: res } = await client.GET('/api/v1/file/list', { 
                    params: { query: { path: parent } } 
                });
                
                let allFiles: FileInfo[] = [];
                if (Array.isArray(res?.data)) {
                  allFiles = res.data;
                } else if (res?.data && typeof res.data === 'object') {
                  const obj = res.data as Record<string, unknown>;
                  allFiles = (obj.items || obj.data || []) as FileInfo[];
                }

                if (allFiles.length > 0) {
                    const siblings = allFiles.filter((f) => {
                        const fExt = f.name.split('.').pop()?.toLowerCase() || '';
                        if (currentType === 'image') return TYPE_MAP.IMAGE.includes(fExt);
                        if (currentType === 'video') return TYPE_MAP.VIDEO.includes(fExt);
                        if (currentType === 'audio') return TYPE_MAP.AUDIO.includes(fExt);
                        return false;
                    });
                    const idx = siblings.findIndex(f => f.path === p);
                    if (idx !== -1) {
                        setData({ playlist: siblings, index: idx, type: currentType });
                        setLoading(false);
                        return;
                    }
                }
            } catch (err) {
                console.warn("Falling back to single mode", err);
            }
        }

        // 单文件降级 / Single file fallback
        setData({ 
            playlist: [{ name, path: p, is_dir: false, size, modified: new Date().toISOString(), favorite_color: 0, has_active_share: false, has_active_direct: false }], 
            index: 0, 
            type: currentType 
        });

      } catch (e) {
        setError(t('common.error') || "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [p, t]);

  useEffect(() => {
    if (!data || capabilities?.thumbnail?.enabled !== true) return undefined;
    const activePath = data.playlist[data.index]?.path;
    if (!activePath || lastThumbPathRef.current === activePath) return undefined;
    const activeName = data.playlist[data.index]?.name || '';
    const activeExt = activeName.split('.').pop()?.toLowerCase() || '';
    const category = getThumbnailCategory(activeExt);
    if (settings && category) {
      if (category === 'image' && settings.thumbnail_disable_image) return undefined;
      if (category === 'video' && settings.thumbnail_disable_video) return undefined;
      if (category === 'pdf' && settings.thumbnail_disable_pdf) return undefined;
      if (category === 'office' && settings.thumbnail_disable_office) return undefined;
      if (category === 'tex' && settings.thumbnail_disable_tex) return undefined;
      if (category === 'text') {
        if (activeExt === 'md' || activeExt === 'markdown') {
          if (settings.thumbnail_disable_markdown) return undefined;
        } else if (settings.thumbnail_disable_text) {
          return undefined;
        }
      }
    }
    lastThumbPathRef.current = activePath;

    let canceled = false;
    const triggerThumbnail = async () => {
      try {
        const { data: tokenRes } = await client.GET('/api/v1/file/get-file-download-token', {
          params: { query: { path: activePath } }
        });
        const token = tokenRes?.data?.token;
        if (!token || canceled) return;
        const url = `${BASE_URL}/api/v1/file/thumbnail?file_download_token=${encodeURIComponent(token)}`;
        await fetch(url, { method: 'GET' });
      } catch (e) {
        console.warn('Thumbnail warmup failed', e);
      }
    };

    triggerThumbnail();
    return () => { canceled = true; };
  }, [data, capabilities?.thumbnail?.enabled, settings]);

  if (loading) return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-md">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  if (error || !data) return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background text-red-500">
      <AlertCircle size={64} />
      <p className="text-xl font-black uppercase tracking-widest">{error || "File Not Found"}</p>
      <Button variant="outline" onClick={onClose} className="mt-4 rounded-2xl h-12 px-8 uppercase font-black">Close</Button>
    </div>
  );

  const activeFile = data.playlist[data.index];
  const isStreamable = ['video', 'audio'].includes(data.type);
  const limits = capabilities?.preview_size_limits;
  const resolveLimitMb = (value?: number, fallback = FALLBACK_PREVIEW_LIMIT_MB) => (value && value > 0 ? value : fallback);
  const defaultLimitMb = resolveLimitMb(limits?.default_mb, FALLBACK_PREVIEW_LIMIT_MB);
  let typeLimitMb = defaultLimitMb;
  if (data.type === 'image') typeLimitMb = resolveLimitMb(limits?.image_mb, defaultLimitMb);
  if (data.type === 'markdown') typeLimitMb = resolveLimitMb(limits?.markdown_mb, defaultLimitMb);
  if (data.type === 'text') typeLimitMb = resolveLimitMb(limits?.text_mb, defaultLimitMb);
  if (data.type === 'pdf') typeLimitMb = resolveLimitMb(limits?.pdf_mb, defaultLimitMb);
  if (data.type === 'tex') typeLimitMb = resolveLimitMb(limits?.tex_mb, defaultLimitMb);
  const sizeLimitBytes = typeLimitMb * 1024 * 1024;
  const isTooLarge = activeFile.size > sizeLimitBytes;
  
  // 大文件警告 / Large file guard
  if (isTooLarge && !isStreamable && !isForced) {
      return (
          <div className="fixed inset-0 z-[200]">
            <LargeFileWarning 
                file={activeFile} 
                isDark={isDark} 
                onForcePreview={() => setIsForced(true)} 
                onCancel={onClose} 
            />
          </div>
      );
  }

  // 组件公用属性 / Common props
  const commonProps = {
      onClose,
      isDark
  };

  return (
    <div className={cn(
      "fixed inset-0 z-[200] flex flex-col overflow-hidden transition-colors duration-300",
      isDark ? "dark bg-background" : "light bg-background"
    )}>
      {data.type === 'image' && <ImagePreview playlist={data.playlist} initialIndex={data.index} {...commonProps} />}
      {data.type === 'video' && <VideoPlayer playlist={data.playlist} initialIndex={data.index} {...commonProps} />}
      {data.type === 'audio' && <AudioPreview path={activeFile.path} {...commonProps} />}
      
      {data.type === 'markdown' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {enableMarkdownVditor ? (
            <MarkdownVditorEditor path={activeFile.path} cdnBase={jsdelivrBase} {...commonProps} />
          ) : (
            <TextPreviewAndEditor path={activeFile.path} {...commonProps} />
          )}
        </div>
      )}
      
      {data.type === 'text' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TextPreviewAndEditor path={activeFile.path} isForced={isForced} {...commonProps} />
        </div>
      )}

      {data.type === 'tex' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TexPreviewAndEditor path={activeFile.path} {...commonProps} />
        </div>
      )}
      
      {data.type === 'pdf' && (
        <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
          <PdfPreview path={activeFile.path} {...commonProps} />
        </React.Suspense>
      )}
      
      {data.type === 'unknown' && (
          <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-6">
              <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 flex items-center justify-center shadow-inner border border-white/5">
                <AlertCircle size={48} />
              </div>
              <div className="text-center">
                <p className="text-xl font-black uppercase tracking-widest">{t('filemanager.errors.unsupportedType') || 'Unsupported File Type'}</p>
                <p className="text-sm font-mono opacity-40 mt-2">{activeFile.name}</p>
              </div>
              <div className="flex items-center gap-4">
                  <OpenWithMenu file={activeFile} variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase" />
                  <Button variant="ghost" onClick={onClose} className="h-12 px-8 rounded-2xl font-black uppercase">{t('common.close')}</Button>
              </div>
          </div>
      )}
    </div>
  );
};
