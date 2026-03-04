import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button.tsx';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';
import { BASE_URL, client } from '@/lib/api.ts';
import { useToastStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { cn } from '@/lib/utils.ts';
import { Loader2, Save, Eye, ChevronDown } from 'lucide-react';
import { buildJsdelivrNpmUrl } from '../utils/officeLite.ts';

type LatexPreviewMode = 'latexmk' | 'latexjs' | 'monaco';

interface Props {
  path: string;
  isDark?: boolean;
  onClose?: () => void;
}

type LatexJsGlobal = {
  HtmlGenerator: new (opts?: Record<string, unknown>) => {
    stylesAndScripts: (base?: string) => Node;
    domFragment: () => DocumentFragment;
  };
  parse: (text: string, options: { generator: unknown }) => unknown;
};

const LATEXJS_VERSION = '0.12.6';

const loadLatexScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Latex.js requires a browser environment'));
      return;
    }
    const existing = document.querySelector(`script[data-latexjs-script="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset.latexjsScript = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

const ensureLatexJs = (src: string): Promise<LatexJsGlobal> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Latex.js requires a browser environment'));
  }
  const w = window as Window & {
    __latexJsReadyMap?: Record<string, Promise<LatexJsGlobal>>;
    latexjs?: LatexJsGlobal;
  };
  if (!w.__latexJsReadyMap) {
    w.__latexJsReadyMap = {};
  }
  if (w.__latexJsReadyMap[src]) return w.__latexJsReadyMap[src];
  w.__latexJsReadyMap[src] = (async () => {
    await loadLatexScript(src);
    const latexjs = w.latexjs;
    if (!latexjs) {
      throw new Error('Latex.js is not available');
    }
    return latexjs;
  })();
  return w.__latexJsReadyMap[src];
};

export const TexPreviewAndEditor = ({ path, isDark, onClose }: Props) => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { capabilities } = useConfigStore();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const defaultMode = (capabilities?.latex_preview_mode || 'monaco') as LatexPreviewMode;
  const enableLatexmk = capabilities?.enable_latexmk === true;
  const enableLatexjs = capabilities?.enable_latexjs === true;
  const enableMonaco = capabilities?.enable_monaco === true;
  const availableModes = useMemo<LatexPreviewMode[]>(() => {
    const modes: LatexPreviewMode[] = [];
    if (enableLatexmk) modes.push('latexmk');
    if (enableLatexjs) modes.push('latexjs');
    if (enableMonaco) modes.push('monaco');
    return modes.length > 0 ? modes : ['monaco'];
  }, [enableLatexmk, enableLatexjs, enableMonaco]);
  const initialMode = availableModes.includes(defaultMode) ? defaultMode : availableModes[0];
  const [previewMode, setPreviewMode] = useState<LatexPreviewMode>(initialMode);
  const [modeOpen, setModeOpen] = useState(false);
  const canRender = previewMode === 'latexmk' || previewMode === 'latexjs';

  const fileName = path.split('/').pop() || 'LaTeX';
  const jsdelivrBase = capabilities?.jsdelivr_mirror_base || 'https://cdn.jsdelivr.net';
  const latexCdnBase = buildJsdelivrNpmUrl(jsdelivrBase, `latex.js@${LATEXJS_VERSION}`);
  const latexScriptUrl = `${latexCdnBase}/dist/latex.js`;
  const latexAssetsBase = `${latexCdnBase}/dist/`;

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const { data: tokenRes } = await client.GET('/api/v1/file/get-file-download-token', {
          params: { query: { path } }
        });

        if (tokenRes?.data?.token) {
          const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(tokenRes.data.token)}&inline=true&mode=text`;
          const res = await fetch(url);
          const text = await res.text();
          setContent(text || '');
        }
      } catch (e) {
        addToast(t('filemanager.errors.loadFailed') || 'Failed to load file content', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
    document.title = `${fileName} - Editor`;
  }, [path]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!availableModes.includes(previewMode)) {
      setPreviewMode(availableModes[0]);
    }
  }, [availableModes, previewMode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await client.PUT('/api/v1/file/content', {
        body: { path, content, is_base64: false }
      });
      if (data?.success) {
        addToast(t('filemanager.previewModal.saveSuccess') || 'Saved successfully', 'success');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderWithLatexmk = async () => {
    setRendering(true);
    try {
      const { data, error } = await client.POST('/api/v1/file/preview/latex', {
        body: { path, content }
      });
      if (error || !data?.success || !data?.data) {
        const msg = (error as { msg?: string } | undefined)?.msg || data?.msg || 'Render failed';
        addToast(msg, 'error');
        return;
      }
      const payload = data.data as unknown as { content_base64: string; content_type: string };
      const binary = atob(payload.content_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: payload.content_type || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
      setPreviewHtml(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Render failed';
      addToast(msg, 'error');
    } finally {
      setRendering(false);
    }
  };

  const renderWithLatexjs = async () => {
    setRendering(true);
    try {
      const latexjs = await ensureLatexJs(latexScriptUrl);
      const generator = new latexjs.HtmlGenerator({ hyphenate: false });
      latexjs.parse(content, { generator });
      const doc = document.implementation.createHTMLDocument('latex-preview');
      const assetsNode = generator.stylesAndScripts(latexAssetsBase);
      doc.head.appendChild(doc.importNode(assetsNode, true));
      const fragment = generator.domFragment();
      doc.body.appendChild(doc.importNode(fragment, true));
      const html = doc.documentElement
        ? doc.documentElement.outerHTML
        : new XMLSerializer().serializeToString(doc);
      setPreviewHtml(html);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Render failed';
      addToast(msg, 'error');
    } finally {
      setRendering(false);
    }
  };

  const handleRender = async () => {
    if (!canRender) return;
    if (previewMode === 'latexmk') {
      await renderWithLatexmk();
    } else if (previewMode === 'latexjs') {
      await renderWithLatexjs();
    }
  };

  const previewPanel = useMemo(() => {
    if (!canRender) {
      return (
        <div className="h-full w-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-40">
          {t('filemanager.texPreview.disabled') || 'Preview disabled'}
        </div>
      );
    }

    if (rendering) {
      return (
        <div className="h-full w-full flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] opacity-60">
          <Loader2 size={18} className="animate-spin" />
          {t('filemanager.texPreview.rendering') || 'Rendering'}
        </div>
      );
    }

    if (previewMode === 'latexmk') {
      if (!previewUrl) {
        return (
          <div className="h-full w-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-40">
            {t('filemanager.texPreview.noPreview') || 'No preview'}
          </div>
        );
      }
      return (
        <iframe
          title="latex-preview"
          src={previewUrl}
          className="w-full h-full border-0 rounded-2xl bg-white"
        />
      );
    }

    if (previewMode === 'latexjs') {
      if (!previewHtml) {
        return (
          <div className="h-full w-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-40">
            {t('filemanager.texPreview.noPreview') || 'No preview'}
          </div>
        );
      }
      return (
        <iframe
          title="latex-preview"
          srcDoc={previewHtml}
          className="w-full h-full border-0 rounded-2xl bg-white"
        />
      );
    }

    return null;
  }, [canRender, previewHtml, previewMode, previewUrl, rendering, t]);

  return (
    <div className={cn('h-screen w-screen flex flex-col overflow-hidden', isDark ? 'dark bg-[#09090b] text-white' : 'bg-white text-zinc-900')}>
      <FilePreviewHeader
        path={path}
        isDark={isDark}
        subtitle={t('filemanager.texPreview.subtitle') || 'LaTeX'}
        onClose={onClose}
        extra={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button
                variant="outline"
                className="h-10 px-4 rounded-xl text-sm font-black uppercase flex items-center gap-2"
                onClick={() => setModeOpen(!modeOpen)}
              >
                {t(`filemanager.texPreview.mode.${previewMode}`) || previewMode}
                <ChevronDown size={18} />
              </Button>
              {modeOpen && (
                <div className="absolute right-0 top-12 z-50 w-40 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
                  {availableModes.map(mode => (
                    <button
                      key={mode}
                      className="w-full px-4 py-2 text-left text-sm font-black uppercase hover:bg-accent"
                      onClick={() => {
                        setPreviewMode(mode);
                        setModeOpen(false);
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                        }
                        setPreviewHtml(null);
                      }}
                    >
                      {t(`filemanager.texPreview.mode.${mode}`) || mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {canRender && (
              <Button
                variant="outline"
                className="h-10 px-6 rounded-xl text-sm font-black uppercase"
                onClick={handleRender}
                disabled={rendering || loading}
              >
                {rendering ? <Loader2 size={18} className="animate-spin mr-2" /> : <Eye size={18} className="mr-2" />}
                {t('filemanager.texPreview.render') || 'Render'}
              </Button>
            )}
            <Button
              variant="primary"
              className="h-10 px-6 rounded-xl text-sm font-black uppercase"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
              {t('common.save')}
            </Button>
          </div>
        }
      />

      <main className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4">
        <section className="flex-1 min-h-0 rounded-2xl border border-border overflow-hidden">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.2em] opacity-60">
              <Loader2 size={18} className="animate-spin" />
              {t('filemanager.editor.opening') || 'Opening'}
            </div>
          ) : (
            <Editor
              height="100%"
              language="latex"
              value={content}
              theme={isDark ? 'vs-dark' : 'light'}
              options={{
                readOnly: false,
                fontSize: 14,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                minimap: { enabled: true },
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
              }}
              onChange={(val) => setContent(val || '')}
            />
          )}
        </section>

        <section className={cn('flex-1 min-h-0 rounded-2xl border border-border overflow-hidden', isDark ? 'bg-black/20' : 'bg-white')}>
          {previewPanel}
        </section>
      </main>
    </div>
  );
};
