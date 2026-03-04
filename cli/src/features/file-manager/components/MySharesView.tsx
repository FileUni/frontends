import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Button } from '@/components/ui/Button.tsx';
import { Share2, Zap, RefreshCcw, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { useFileStore } from "../store/useFileStore.ts";
import { useFileActions } from "../hooks/useFileActions.ts";
import { FileBrowser } from "./FileBrowser.tsx";
import { Pagination } from '@/components/common/Pagination.tsx';
import { FileManagerContextMenu } from "./FileManagerContextMenu.tsx";
import { ShareModal } from "./ShareModal.tsx";
import { FilePropertiesModal } from "./FilePropertiesModal";

import type { FileInfo } from '../types/index.ts';

/**
 * My Shares View
 * Reuses standard file browser component for visual and interaction consistency.
 */
export const MySharesView = () => {
  const { t } = useTranslation();
  const store = useFileStore();
  const { setFmMode, setShareFilter, setViewMode } = store;
  const viewMode = store.getViewMode();
  const { loadFiles, cancelShare } = useFileActions();
  
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FileInfo | null; } | null>(null);
  const [activeShareFile, setActiveShareFile] = useState<FileInfo | null>(null);
  const [propertiesFile, setPropertiesFile] = useState<FileInfo | null>(null);

  const pagination = store.getPagination();
  const shareFilter = store.getShareFilter();

  const fetchShares = async (page: number = 1, size: number = pagination.pageSize) => {
    setLoading(true);
    // Explicitly specify mode to avoid async state sync issues
    await loadFiles(undefined, page, size, 'shares');
    setLoading(false);
  };

  useEffect(() => {
    setFmMode('shares');
    fetchShares();
    // Restore filters on unmount
    return () => {
      setShareFilter({ hasPassword: null, enableDirect: null });
    };
  }, []);

  const handleAction = (action: string, target: FileInfo | null) => {
    setContextMenu(null);
    if (!target) return;

    switch (action) {
      case 'cancel_share':
        if (target.id) cancelShare(target.id);
        break;
      case 'share':
        setActiveShareFile(target);
        break;
      case 'properties':
        setPropertiesFile(target);
        break;
      case 'open_location':
        if (target.path) {
          const pathParts = target.path.split('/').filter(Boolean);
          const parentPath = '/' + pathParts.slice(0, -1).join('/');
          store.setCurrentPath(parentPath);
          store.setFmMode('files');
          store.setHighlightedPath(target.path);
        }
        break;
      case 'refresh':
        fetchShares();
        break;
    }
  };

  const toggleDirectFilter = () => {
    const newVal = shareFilter.enableDirect === null ? true : shareFilter.enableDirect === true ? false : null;
    setShareFilter({ enableDirect: newVal });
    fetchShares(1);
  };

  return (
    <div className="flex flex-col bg-background h-screen relative overflow-hidden" onClick={() => setContextMenu(null)}>
      {/* Toolbar Area - Unified Style */}
      <div className="h-16 border-b border-white/5 bg-white/[0.01] flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Share2 className="text-primary" size={24} />
            {t('filemanager.shares.title')}
          </h2>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setShareFilter({ enableDirect: null }); fetchShares(1); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest transition-all",
                shareFilter.enableDirect === null ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 opacity-40 hover:opacity-100"
              )}
            >
              {t('filemanager.shares.allShares')}
            </button>
            <button 
              onClick={toggleDirectFilter}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2",
                shareFilter.enableDirect === true ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" : "bg-white/5 opacity-40 hover:opacity-100"
              )}
            >
              <Zap size={10} fill="currentColor" /> {t('filemanager.shares.directOnly')}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('grid')}
              className={cn("p-2 h-8 w-8 rounded-lg", viewMode === 'grid' ? 'bg-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100')}
            >
              <LayoutGrid size={18} />
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('list')}
              className={cn("p-2 h-8 w-8 rounded-lg", viewMode === 'list' ? 'bg-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100')}
            >
              <List size={18} />
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => fetchShares()} disabled={loading} className="h-10 w-10 rounded-xl border border-white/5 opacity-40 hover:opacity-100">
            <RefreshCcw size={18} className={cn(loading && "animate-spin text-primary")} />
          </Button>
        </div>
      </div>

      {/* Standardized File Browser */}
      <FileBrowser 
        onAction={handleAction}
        onContextMenu={(e, file) => { 
          e.preventDefault(); 
          setContextMenu({ x: e.clientX, y: e.clientY, target: file }); 
        }} 
      />

      {/* Standardized Pagination */}
      <Pagination
        current={pagination.currentPage}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={(p) => fetchShares(p)}
        onPageSizeChange={(s) => fetchShares(1, s)}
        className="border-t bg-background/50 backdrop-blur-md"
      />

      {contextMenu && (
        <FileManagerContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          target={contextMenu.target} 
          onClose={() => setContextMenu(null)} 
          onAction={handleAction} 
        />
      )}

      <ShareModal 
        isOpen={!!activeShareFile} 
        onClose={() => {
          setActiveShareFile(null);
          fetchShares(pagination.currentPage); // Refresh to show changes
        }} 
        file={activeShareFile} 
      />
      <FilePropertiesModal 
        file={propertiesFile} 
        onClose={() => setPropertiesFile(null)} 
      />
    </div>
  );
};
