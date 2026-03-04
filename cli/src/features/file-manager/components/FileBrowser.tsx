import React from 'react';
import { useFileStore } from '../store/useFileStore.ts';
import { FileItem } from './FileItem.tsx';
import { cn } from '@/lib/utils.ts';
import { Inbox, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { FileInfo } from '../types/index.ts';

interface Props {
  onContextMenu: (e: React.MouseEvent, file: FileInfo) => void;
  onAction?: (action: string, target: FileInfo | null) => void;
}

/**
 * 纯粹的文件列表浏览器 / Pure File List Browser
 * 仅负责网格与列表模式的切换展示，不再干预分页导航。
 */
export const FileBrowser = ({ onContextMenu, onAction }: Props) => {
  const { t } = useTranslation();
  const store = useFileStore();
  const { files, loading, fmMode } = store;
  const viewMode = store.getViewMode();

  if (!loading && files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-20">
        <Inbox size={64} strokeWidth={1} />
        <p className="text-xl font-black mt-4 uppercase tracking-widest">{t('filemanager.emptyFolder')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-2 md:px-4 pb-4">
      {viewMode === 'grid' ? (
        <div className={cn(
          "grid gap-3 md:gap-4 py-4 transition-all duration-500",
          "grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
        )}>
          {files.map((file) => (
            <FileItem 
              key={(fmMode === 'shares' && file.id) ? file.id : file.path} 
              file={file} 
              onContextMenu={onContextMenu}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col py-2">
          {files.map((file) => (
            <FileItem 
              key={(fmMode === 'shares' && file.id) ? file.id : file.path} 
              file={file} 
              onContextMenu={onContextMenu}
              onAction={onAction}
            />
          ))}
        </div>
      )}

      {loading && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-40">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-sm font-black uppercase tracking-[0.2em]">{t('common.loading')}</span>
        </div>
      )}
    </div>
  );
};
