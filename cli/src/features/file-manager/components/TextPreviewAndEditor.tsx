import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import { client, BASE_URL } from '@/lib/api.ts';
import { 
  Loader2, Save, Edit3, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { useToastStore } from '@fileuni/shared';
import { cn } from '@/lib/utils.ts';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';

interface Props {
  path: string;
  isDark?: boolean;
  isForced?: boolean;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

// Monaco 语言映射 / Extension to Monaco Language Map
const LANGUAGE_MAP: Record<string, string> = {
  'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
  'py': 'python', 'rs': 'rust', 'cpp': 'cpp', 'c': 'c', 'h': 'cpp', 'hpp': 'cpp',
  'java': 'java', 'go': 'go', 'php': 'php', 'rb': 'ruby', 'cs': 'csharp',
  'sql': 'sql', 'json': 'json', 'toml': 'toml', 'yaml': 'yaml', 'yml': 'yaml',
  'html': 'html', 'css': 'css', 'less': 'less', 'scss': 'scss',
  'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'ps1': 'powershell',
  'xml': 'xml', 'conf': 'ini', 'ini': 'ini', 'cnf': 'ini', 'cfg': 'ini',
  'log': 'plaintext', 'txt': 'plaintext', 'tex': 'latex', 'latex': 'latex',
  'dockerfile': 'dockerfile', 'makefile': 'makefile', 'md': 'markdown'
};

/**
 * 通用文本预览与编辑器 (Monaco 驱动) / Common Text Preview and Editor (Monaco powered)
 */
export const TextPreviewAndEditor = ({ path, isDark, headerExtra, onClose }: Props) => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const fileName = path.split('/').pop() || 'File';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const language = LANGUAGE_MAP[ext] || 'plaintext';

  // 1. 获取内容 / Fetch content
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
        console.error("Load failed:", e);
        addToast(t('filemanager.errors.loadFailed') || "Failed to load file content", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
    document.title = `${fileName} - Editor`;
  }, [path]);

  // 2. 保存内容 / Save content
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
      console.error("Load failed:", e);
      const msg = e instanceof Error ? e.message : "Load failed";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("h-screen w-screen flex flex-col overflow-hidden", isDark ? "dark bg-[#09090b] text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader 
        path={path}
        isDark={isDark}
        subtitle={language}
        onClose={onClose}
        extra={
          <div className="flex items-center gap-3">
            {headerExtra}
            
            {!loading && (
              <div className={cn(
                "flex items-center p-1 rounded-2xl",
                isDark ? "bg-white/5 border border-white/5 shadow-inner" : "bg-zinc-100 border border-zinc-200"
              )}>
                 <button 
                  onClick={() => setIsEditing(false)}
                  className={cn(
                    "px-5 h-9 rounded-xl text-sm font-black uppercase transition-all flex items-center gap-2", 
                    !isEditing 
                      ? (isDark ? "bg-white/10 text-white shadow-lg" : "bg-white shadow-md text-zinc-900 border border-zinc-200") 
                      : "opacity-40 hover:opacity-100 text-foreground"
                  )}
                 >
                   <Eye size={18} /> {t('filemanager.actions.preview')}
                 </button>
                 <button 
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "px-5 h-9 rounded-xl text-sm font-black uppercase transition-all flex items-center gap-2", 
                    isEditing 
                      ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" 
                      : "opacity-40 hover:opacity-100 text-foreground"
                  )}
                 >
                   <Edit3 size={18} /> {t('filemanager.preview.edit')}
                 </button>
              </div>
            )}

            {isEditing && (
              <Button 
                variant="primary" 
                className="h-10 px-6 rounded-xl text-sm font-black uppercase bg-primary text-white hover:brightness-110 shadow-xl shadow-primary/20 transition-all border-none" 
                onClick={handleSave} 
                disabled={saving}
              >
                {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                {t('common.save')}
              </Button>
            )}
          </div>
        }
      />

      <main className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
            <Loader2 className="animate-spin text-primary" size={40} />
            <p className="text-sm font-black uppercase tracking-[0.3em]">Opening {fileName}...</p>
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            theme={isDark ? 'vs-dark' : 'light'}
            options={{
              readOnly: !isEditing,
              fontSize: 14,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              minimap: { enabled: true },
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: isEditing ? 'all' : 'none',
              padding: { top: 20 },
              scrollBeyondLastLine: false,
              scrollbar: {
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8
              }
            }}
            onChange={(val) => setContent(val || '')}
          />
        )}
      </main>
    </div>
  );
};