import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Loader2, Folder, File, Download, 
  ArrowLeft, Search, Archive, X
} from 'lucide-react';
import { client, BASE_URL } from '@/lib/api.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { cn } from '@/lib/utils.ts';
import { toast } from '@fileuni/shared';

interface ArchiveEntry {
  path: string;
  is_dir: boolean;
  size: number;
  modified?: string;
}

interface Props {
  archivePath: string;
  password?: string | undefined;
  onClose: () => void;
}

export const ArchiveBrowser = ({ archivePath, password, onClose }: Props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [currentSubPath, setCurrentSubPath] = useState(''); // 压缩包内的当前路径
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载压缩包内容 / Load archive contents
  useEffect(() => {
    const fetchContents = async () => {
      setLoading(true);
      try {
        const { data, error } = await client.GET('/api/v1/file/archive/list', {
          params: { query: { path: archivePath, password } }
        });

        if (error) throw error;
        if (data?.success) {
          setEntries(data.data as ArchiveEntry[]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load archive contents";
        toast.error(msg);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchContents();
  }, [archivePath, password]);

  // 过滤并组织当前层级的文件 / Filter and organize current level files
  const currentEntries = useMemo(() => {
    let filtered = entries;
    
    if (searchKeyword) {
        filtered = entries.filter(e => e.path.toLowerCase().includes(searchKeyword.toLowerCase()));
        return filtered.sort((a, b) => (a.is_dir === b.is_dir ? 0 : a.is_dir ? -1 : 1));
    }

    // 提取当前层级 / Extract current level
    const prefix = currentSubPath ? (currentSubPath.endsWith('/') ? currentSubPath : currentSubPath + '/') : '';
    const result = new Map<string, ArchiveEntry>();

    for (const entry of entries) {
      if (!entry.path.startsWith(prefix) || entry.path === prefix) continue;
      
      const relative = entry.path.slice(prefix.length);
      const parts = relative.split('/');
      const name = parts[0];
      const isDir = parts.length > 1 || entry.is_dir;

      if (!result.has(name)) {
        result.set(name, {
          path: prefix + name,
          is_dir: isDir,
          size: isDir ? 0 : entry.size,
          modified: entry.modified
        });
      }
    }

    return Array.from(result.values()).sort((a, b) => (a.is_dir === b.is_dir ? 0 : a.is_dir ? -1 : 1));
  }, [entries, currentSubPath, searchKeyword]);

  const handleEntryClick = (entry: ArchiveEntry) => {
    if (entry.is_dir) {
      setCurrentSubPath(entry.path + '/');
    } else {
      handleDownload(entry.path);
    }
  };

  const handleDownload = async (fileInArchive: string) => {
    try {
      // 1. 获取下载凭证 / Get download token
      const { data: tokenRes } = await client.GET('/api/v1/file/get-file-download-token', {
        params: { query: { path: archivePath } } 
      });

      if (!tokenRes?.data?.token) {
        throw new Error("Failed to get download token");
      }

      const token = tokenRes.data.token;
      
      // 2. 构建下载 URL / Construct download URL
      // 直接使用 a 标签下载，避免 Blob 炸掉浏览器内存 / Direct link download to save memory
      let url = `${BASE_URL}/api/v1/file/archive/extract-file?archive_path=${encodeURIComponent(archivePath)}&file_path=${encodeURIComponent(fileInArchive)}&file_download_token=${encodeURIComponent(token)}`;
      if (password) {
          url += `&password=${encodeURIComponent(password)}`;
      }

      toast.info(t('common.downloadStarted') || "Starting download...");

      // 3. 触发原生下载 / Trigger native download
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInArchive.split('/').pop() || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (e: unknown) {
      console.error("Archive download error:", e);
      const msg = e instanceof Error ? e.message : "Download failed";
      toast.error(msg);
    }
  };

  const breadcrumbs = useMemo(() => {
    const parts = currentSubPath.split('/').filter(Boolean);
    return [
      { name: archivePath.split('/').pop() || 'Archive', path: '' },
      ...parts.map((p, i) => ({
        name: p,
        path: parts.slice(0, i + 1).join('/') + '/'
      }))
    ];
  }, [currentSubPath, archivePath]);

  return (
    <div className="fixed inset-0 z-[150] bg-background flex flex-col animate-in fade-in duration-300">
      {/* 顶部导航栏 / Top Navigation */}
      <div className="h-16 border-b border-border bg-card/50 backdrop-blur-md px-4 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl h-10 w-10 p-0">
            <ArrowLeft size={20} />
          </Button>
          
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth">
            {breadcrumbs.map((bc, i) => (
              <React.Fragment key={bc.path}>
                {i > 0 && <span className="opacity-20 mx-1">/</span>}
                <button 
                  onClick={() => { setCurrentSubPath(bc.path); setSearchKeyword(''); }}
                  className={cn(
                    "text-sm font-bold transition-all hover:text-primary",
                    i === breadcrumbs.length - 1 ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {bc.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input 
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder={t('common.search')}
                    className="h-9 w-48 bg-muted/50 border border-border rounded-xl pl-9 pr-4 text-sm font-bold focus:w-64 transition-all outline-none focus:border-primary"
                />
            </div>
            <Badge variant="ghost" className="bg-primary/10 text-primary border-0 font-black hidden sm:flex">
                {entries.length} {t('common.items')}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl h-10 w-10 p-0 text-muted-foreground hover:text-destructive">
                <X size={20} />
            </Button>
        </div>
      </div>

      {/* 文件展示区 / File Display Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="text-sm font-black uppercase tracking-widest">{t('common.loadingArchive') || 'Opening Archive...'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
            {currentEntries.map((entry) => (
              <div 
                key={entry.path}
                onDoubleClick={() => handleEntryClick(entry)}
                className="group flex flex-col items-center p-4 rounded-[2rem] hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all cursor-pointer text-center relative"
              >
                <div className="mb-3 transform group-hover:scale-110 transition-transform duration-300">
                  {entry.is_dir ? (
                    <div className="w-12 h-12 flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-2xl">
                        <Folder size={32} fill="currentColor" fillOpacity={0.2} />
                    </div>
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary rounded-2xl">
                        <File size={32} strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold truncate w-full px-1 text-foreground opacity-80 group-hover:opacity-100">
                  {entry.path.split('/').filter(Boolean).pop()}
                </span>
                {!entry.is_dir && (
                  <span className="text-[14px] opacity-30 mt-1 font-mono">
                    {(entry.size / 1024).toFixed(1)} KB
                  </span>
                )}
                {!entry.is_dir && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(entry.path); }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-background border border-border opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white"
                    >
                        <Download size={10} />
                    </button>
                )}
              </div>
            ))}
            
            {currentEntries.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20">
                    <Archive size={64} strokeWidth={1} />
                    <p className="text-sm font-black mt-4 uppercase tracking-widest">{t('common.noItems')}</p>
                </div>
            )}
          </div>
        )}
      </div>

      {/* 底部信息栏 / Footer */}
      <div className="h-10 border-t border-border bg-card/30 px-4 flex items-center justify-between text-sm font-bold text-muted-foreground uppercase tracking-widest">
        <div className="flex gap-4">
            <span>{currentSubPath || '/'}</span>
        </div>
        <div className="flex gap-4">
            <span>{t('filemanager.archive.browserMode')}</span>
        </div>
      </div>
    </div>
  );
};
