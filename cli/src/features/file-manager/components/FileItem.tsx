import React from 'react';
import { useFileStore } from '../store/useFileStore.ts';
import { useSelectionStore } from '../store/useSelectionStore.ts';
import { FileIcon } from './FileIcon.tsx';
import { FileThumbnail } from './FileThumbnail.tsx';
import { cn } from '@/lib/utils.ts';
import type { FileInfo } from '../types/index.ts';
import { useDraggable, useDroppable } from '@dnd-kit/core';

import { Share2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COLOR_MAP: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-green-500',
  5: 'bg-blue-500',
  6: 'bg-cyan-500',
  7: 'bg-blue-700',
};

interface FileItemProps {
  file: FileInfo;
  onContextMenu: (e: React.MouseEvent, file: FileInfo) => void;
  onAction?: (action: string, target: FileInfo | null) => void;
}

/**
 * MacOS Style Status Component
 * Favorites use refined small dots that don't break list alignment.
 */
const StatusIcons = ({ file, mode, className }: { file: FileInfo, mode: 'grid' | 'list', className?: string }) => {
  const isFavorite = file.favorite_color > 0;
  const isShared = file.has_active_share;
  const isDirect = file.has_active_direct;
  const favoriteColorClass = isFavorite ? (COLOR_MAP[file.favorite_color] || 'bg-primary') : '';

  if (!isFavorite && !isShared && !isDirect) return null;

  if (mode === 'grid') {
    return (
      <div className={cn("flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/5 shadow-lg", className)}>
        {isFavorite && (
          <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.2)]", favoriteColorClass)} />
        )}
        {isShared && <Share2 size={10} className="text-primary" />}
        {isDirect && <Zap size={10} className="text-yellow-500" fill="currentColor" />}
      </div>
    );
  }

  // List mode: compact layout with dot as primary indicator
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isFavorite && (
        <div className={cn("w-2 h-2 rounded-full shrink-0 shadow-sm", favoriteColorClass)} />
      )}
      {isShared && <Share2 size={18} className="text-primary shrink-0" />}
      {isDirect && <Zap size={18} className="text-yellow-500 shrink-0" fill="currentColor" />}
    </div>
  );
};

export const FileItem = ({ file, onContextMenu, onAction }: FileItemProps) => {
  const { t } = useTranslation();
  const store = useFileStore();
  const { files, highlightedPath, setHighlightedPath } = store;
  const itemRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (highlightedPath === file.path && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedPath(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [highlightedPath, file.path, setHighlightedPath]);

  const viewMode = store.getViewMode();
  const { isSelected, toggleSelection } = useSelectionStore();

  const selectId = (store.fmMode === 'shares' && file.id) ? file.id : file.path;
  const selected = isSelected(selectId);

  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id: selectId, data: { file } });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: selectId, data: { file }, disabled: !file.is_dir });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000, opacity: 0.8 } : undefined;
  const longPressTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const handleTouchStart = (e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      onContextMenu(e as unknown as React.MouseEvent, file);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => longPressTimer.current && clearTimeout(longPressTimer.current);

  const handleClick = (e: React.MouseEvent) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    e.stopPropagation();
    const allIds = files.map(f => (store.fmMode === 'shares' && f.id) ? f.id : f.path);
    toggleSelection(selectId, e.ctrlKey || e.metaKey, e.shiftKey, allIds);
  };

  const handleDoubleClick = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (onAction) {
      // Logic: Open if directory, show properties if file
      onAction(file.is_dir ? 'open' : 'properties', file);
    } else {
      if (file.is_dir) {
        store.setFmMode('files');
        store.setCurrentPath(file.path);
      } else {
        // Fallback logic
        store.addToRecentFiles(file);
        // Based on user request, double clicking file should show properties
        onAction?.('properties', file);
      }
    }
  };

  const setRefs = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
    (itemRef as { current: HTMLDivElement | null }).current = node;
  };

  const isTrash = store.fmMode === 'trash';
  const isRecent = store.fmMode === 'recent';
  const isShares = store.fmMode === 'shares';
  const isFavorites = store.fmMode === 'favorites';

  // State of being unfavorited and disappearing
  const isDisappearing = isFavorites && file.favorite_color === 0;

  const displayName = (isTrash && file.original_path) ? file.original_path.split('/').pop() : file.name;

  if (isTrash) {
    console.log(`[TRASH_TRACE] name=${file.name}, orig=${file.original_path}, path=${file.path}`);
  }

  // Core Fix: Display different secondary info based on mode
  const getSecondaryInfo = () => {
    if (isTrash) return file.original_path || '';
    if (isRecent) return file.path;
    
    // Share mode displays: Original Location | Start Time | Expiration
    if (isShares) {
      const parts = [];
      if (file.path) parts.push(file.path);
      if (file.created_at) {
        const start = new Date(file.created_at).toLocaleDateString();
        parts.push(`${t('filemanager.shares.startTime') || 'Start'}: ${start}`);
      }
      if (file.expire_at) {
        const end = new Date(file.expire_at).toLocaleDateString();
        parts.push(`${t('filemanager.shares.expireTime') || 'Expire'}: ${end}`);
      } else {
        parts.push(t('filemanager.shares.permanent') || 'Permanent');
      }
      return parts.join(' | ');
    }
    
    return '';
  };

  const secondaryInfo = getSecondaryInfo();

  const commonClasses = cn(
    "transition-all cursor-pointer select-none border touch-none relative group",
    selected ? "bg-primary/10 border-primary shadow-inner" : "border-transparent",
    highlightedPath === file.path && "animate-pulse ring-2 ring-primary/50 bg-primary/5 border-primary/30",
    isOver && file.is_dir ? "bg-primary/20 border-primary scale-[1.02] border-dashed" : "",
    isDragging && "opacity-30 grayscale blur-[1px]",
    isDisappearing && "animate-pulse opacity-0 scale-95 translate-x-4 pointer-events-none duration-500"
  );

  if (viewMode === 'grid') {
    return (
      <div
        ref={setRefs} style={style} {...attributes} {...listeners}
        onClick={handleClick} onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, file); }}
        className={cn(
          "flex flex-col items-center p-3 rounded-3xl min-h-[140px] justify-start text-center",
          commonClasses,
          !selected && !isOver && "bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]"
        )}
      >
        <StatusIcons file={file} mode="grid" className="absolute top-2 right-2 z-10" />

        <div className="mb-3 mt-2 transform group-hover:scale-110 transition-transform duration-300">
          {file.is_dir ? (
            <FileIcon name={displayName || file.name} isDir={file.is_dir} size={48} />
          ) : (
            <FileThumbnail file={file} size={64} />
          )}
        </div>

        <div className="flex flex-col items-center w-full px-1 min-w-0 flex-1">
          <span className={cn(
            "text-sm font-bold truncate w-full px-1",
            selected ? "text-primary" : "opacity-80 group-hover:opacity-100"
          )}>
            {displayName}
          </span>
          {secondaryInfo && (
            <span className="text-[14px] opacity-30 truncate w-full mt-0.5 uppercase font-black px-1">
              {secondaryInfo}
            </span>
          )}
          <div className="mt-auto pt-2 opacity-30 text-sm font-mono">
            {file.is_dir ? '-' : (file.size / 1024 / 1024).toFixed(1) + ' MB'}
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div
      ref={setRefs} style={style} {...attributes} {...listeners}
      onClick={handleClick} onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, file); }}
      className={cn(
        "flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 border-b border-white/5",
        commonClasses,
        !selected && !isOver && "hover:bg-white/[0.02]"
      )}
    >
      {/* Fixed width prefix area for alignment */}
      <div className="shrink-0 flex items-center gap-3 min-w-[72px] justify-end">
        <StatusIcons file={file} mode="list" />
        {file.is_dir ? (
          <FileIcon name={displayName || file.name} isDir={file.is_dir} size={24} />
        ) : (
          <FileIcon name={displayName || file.name} isDir={false} size={24} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className={cn("text-sm font-bold truncate", selected ? "text-primary" : "")}>{displayName}</div>
          </div>
          {secondaryInfo && (
            <span className="text-sm opacity-20 font-mono truncate max-w-[200px] md:max-w-md">
              {secondaryInfo}
            </span>
          )}
        </div>
      </div>

      <div className="w-20 md:w-24 flex flex-col items-end shrink-0">
        <div className="text-sm font-mono opacity-60">
          {file.is_dir ? '-' : (file.size / 1024 / 1024).toFixed(2) + ' MB'}
        </div>
      </div>

      <div className="w-32 hidden sm:flex flex-col items-end shrink-0">
        <span className="text-sm font-mono opacity-40">
          {new Date(file.modified).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};
