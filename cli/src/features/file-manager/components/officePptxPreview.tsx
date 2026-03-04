import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/Button.tsx';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';
import { useThemeStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { BASE_URL, client, extractData } from '@/lib/api.ts';
import { buildJsdelivrGhUrl, fetchFileStatSize, getFileExtension, isComplexOfficeFile, resolveLimitBytes } from '../utils/officeLite.ts';

interface Props {
  path: string;
  onClose: () => void;
}

type JQueryInstance = {
  pptxToHtml?: (options: Record<string, unknown>) => void;
};

type JQueryLike = (target: Element) => JQueryInstance;

const getPptxStyles = (base: string) => ([
  `${base}/css/pptxjs.css`,
  `${base}/css/nv.d3.min.css`
]);

const getPptxScripts = (base: string) => ([
  `${base}/js/jquery-1.11.3.min.js`,
  `${base}/js/jszip.min.js`,
  `${base}/js/filereader.js`,
  `${base}/js/d3.min.js`,
  `${base}/js/nv.d3.min.js`,
  `${base}/js/pptxjs.js`,
  `${base}/js/divs2slides.js`
]);

const loadStyle = (href: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[data-pptx-style="${href}"]`);
    if (existing) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.pptxStyle = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load style: ${href}`));
    document.head.appendChild(link);
  });
};

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-pptx-script="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.pptxScript = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

const ensurePptxAssets = (cdnBase: string): Promise<void> => {
  const w = window as Window & { __pptxAssetsReadyMap?: Record<string, Promise<void>> };
  if (!w.__pptxAssetsReadyMap) {
    w.__pptxAssetsReadyMap = {};
  }
  if (w.__pptxAssetsReadyMap[cdnBase]) return w.__pptxAssetsReadyMap[cdnBase];
  w.__pptxAssetsReadyMap[cdnBase] = (async () => {
    for (const href of getPptxStyles(cdnBase)) {
      await loadStyle(href);
    }
    for (const src of getPptxScripts(cdnBase)) {
      await loadScript(src);
    }
  })();
  return w.__pptxAssetsReadyMap[cdnBase];
};

export const PptxLitePreview: React.FC<Props> = ({ path, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { capabilities } = useConfigStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [forceOpen, setForceOpen] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const officeLimitBytes = resolveLimitBytes(capabilities?.preview_size_limits?.office_mb);
  const isLargeFile = fileSize > officeLimitBytes;
  const ext = getFileExtension(path);
  const isComplex = isComplexOfficeFile(ext, fileSize);
  const jsdelivrBase = capabilities?.jsdelivr_mirror_base || 'https://cdn.jsdelivr.net';
  const pptxCdnBase = buildJsdelivrGhUrl(jsdelivrBase, 'meshesha/PPTXjs', 'master');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const size = await fetchFileStatSize(path);
      setFileSize(size);
      if (size > officeLimitBytes && !forceOpen) {
        setLoading(false);
        return;
      }
      await ensurePptxAssets(pptxCdnBase);
      const data = await extractData<{ token: string }>(
        client.GET('/api/v1/file/get-file-download-token', { params: { query: { path } } })
      );
      const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.token)}`;
      const container = containerRef.current;
      if (!container) {
        throw new Error('Preview container not found');
      }
      container.innerHTML = '';
      const jquery = (window as Window & { $?: JQueryLike }).$;
      if (!jquery) {
        throw new Error('PPTX renderer not available');
      }
      const instance = jquery(container);
      if (!instance.pptxToHtml) {
        throw new Error('PPTX renderer not available');
      }
      instance.pptxToHtml({
        pptxFileUrl: url,
        slidesScale: 1,
        slideMode: false,
        mediaProcess: false
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, [path, forceOpen, pptxCdnBase]);

  useEffect(() => {
    setForceOpen(false);
  }, [path]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  if (isLargeFile && !forceOpen) {
    return (
      <div className="fixed inset-0 z-[210] flex flex-col items-center justify-center bg-background text-center gap-4 px-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">
          {t('filemanager.officeLite.largeFileWarning', { size: Math.ceil(officeLimitBytes / (1024 * 1024)) })}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="primary" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={() => setForceOpen(true)}>
            {t('filemanager.officeLite.forceOpen')}
          </Button>
          <Button variant="outline" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-[210] flex flex-col", isDark ? "bg-background text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader
        path={path}
        subtitle={t('filemanager.officeLite.pptxPreviewTitle')}
        onClose={onClose}
      />

      <div className="flex-1 min-h-0 overflow-auto">
        {isComplex && !loading && (
          <div className={cn(
            "mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
            isDark ? "border-white/10 bg-white/5 text-white/70" : "border-zinc-200 bg-zinc-50 text-zinc-600"
          )}>
            {t('filemanager.officeLite.complexHint')}
          </div>
        )}
        {loading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-60">
            {error}
          </div>
        )}
        {!loading && !error && <div ref={containerRef} className="pptx-preview-container px-6 py-4" />}
      </div>

    </div>
  );
};
