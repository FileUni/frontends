import { useLayoutEffect, useRef, useState } from 'react';
import { useSelectionStore } from '../store/useSelectionStore.ts';
import { useFileStore } from '../store/useFileStore.ts';
import { useConfigStore } from '@/stores/config.ts';
import { useThemeStore } from '@fileuni/shared';
import {
  FolderOpen, Eye, Download, Share2, Scissors, Copy, Pencil, Trash2,
  RotateCw, PlusSquare, FolderPlus, Clipboard, Undo2, Zap, Archive, StarOff, Star,
  ChevronRight, X, FolderSearch, Lock, Unlock, type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import type { FileInfo } from '../types/index.ts';
import { useTranslation } from 'react-i18next';

const FAVORITE_COLORS = [
  { id: 1, name: 'Red', class: 'bg-red-500' },
  { id: 2, name: 'Orange', class: 'bg-orange-500' },
  { id: 3, name: 'Yellow', class: 'bg-yellow-500' },
  { id: 4, name: 'Green', class: 'bg-green-500' },
  { id: 5, name: 'Blue', class: 'bg-blue-500' },
  { id: 6, name: 'Cyan', class: 'bg-cyan-500' },
  { id: 7, name: 'Deep Blue', class: 'bg-blue-700' },
];

interface Props {
  x: number;
  y: number;
  target: FileInfo | null;
  onClose: () => void;
  onAction: (action: string, target: FileInfo | null) => void;
}

interface MenuButtonProps {
  icon?: LucideIcon;
  label: string;
  action?: string;
  className?: string;
  hasSub?: boolean;
  active?: boolean;
  danger?: boolean;
}

/**
 * 优化后的跑马灯组件 / Enhanced Marquee with Fade Effect
 */
const MarqueeTitle = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isLong, setIsLong] = useState(false);

  useLayoutEffect(() => {
    if (containerRef.current && textRef.current) {
      setIsLong(textRef.current.offsetWidth > containerRef.current.offsetWidth - 10);
    }
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      className="overflow-hidden w-full relative group/marquee"
      style={{ maskImage: isLong ? 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' : 'none' }}
    >
      <div className={cn(
        "whitespace-nowrap py-0.5",
        isLong && "animate-marquee-infinite"
      )}>
        <span ref={textRef} className="text-sm font-black tracking-wider opacity-60">
          {text}
        </span>
        {isLong && (
          <span className="text-sm font-black tracking-wider opacity-60 ml-12">
            {text}
          </span>
        )}
      </div>
      <style>{`
        @keyframes marquee-infinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 1.5rem)); }
        }
        .animate-marquee-infinite {
          display: inline-block;
          animation: marquee-infinite 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export const FileManagerContextMenu = ({ x, y, target, onClose, onAction }: Props) => {
  void onClose;
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const store = useFileStore();
  const { capabilities } = useConfigStore();
  const { fmMode } = store;
  const clipboard = store.getClipboard();
  const { selectedIds } = useSelectionStore();
  
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: y, left: x });
  const [showFavoriteSub, setShowFavoriteSub] = useState(false);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    if (menuRef.current) {
      const menuWidth = menuRef.current.offsetWidth;
      const menuHeight = menuRef.current.offsetHeight;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      let nextX = x;
      let nextY = y;

      if (x + menuWidth > winW) nextX = winW - menuWidth - 10;
      if (y + menuHeight > winH) nextY = winH - menuHeight - 10;
      
      setCoords({ top: Math.max(10, nextY), left: Math.max(10, nextX) });
    }
  }, [x, y]);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isBatch = selectedIds.size > 1;

  const isArchive = (file: FileInfo | null) => {
    if (!file || file.is_dir) return false;
    const archives = ['.zip', '.7z', '.rar', '.tar.gz', '.gz', '.tar', '.bz2', '.xz'];
    const lowerName = file.name.toLowerCase();
    return archives.some(ext => lowerName.endsWith(ext));
  };

  const MenuButton = ({ icon: Icon, label, action, className, hasSub, active, danger }: MenuButtonProps) => (
    <button 
      onClick={(e) => {
        if (hasSub) {
          e.stopPropagation();
          setShowFavoriteSub(!showFavoriteSub);
        } else if (action) {
          onAction(action, target);
        }
      }}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 text-[14px] font-medium transition-all text-left outline-none group/btn",
        active ? "bg-primary/10 text-primary" : "hover:bg-primary/10 hover:text-primary",
        danger && "hover:bg-red-500/10 hover:text-red-500",
        isDark ? "text-white/70" : "text-gray-600",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={16} className={cn("shrink-0 opacity-70 group-hover/btn:opacity-100", active && "opacity-100")} />}
        <span className="truncate">{label}</span>
      </div>
      {hasSub && <ChevronRight size={18} className={cn("transition-transform duration-200 opacity-40", showFavoriteSub && "rotate-90 opacity-100")} />}
    </button>
  );

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[200] w-52 border rounded-2xl shadow-2xl overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl",
        isDark ? "bg-zinc-900/95 border-white/10" : "bg-white/95 border-gray-200"
      )}
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-[80vh] overflow-y-auto custom-scrollbar px-1">
        {target && (
          <div className={cn("px-2 py-2 mb-1 rounded-xl mx-1", isDark ? "bg-white/[0.03]" : "bg-gray-50")}>
            <MarqueeTitle text={isBatch ? `${selectedIds.size} ${t('common.items') || 'Items'}` : target.name} />
          </div>
        )}
        
        <div className="space-y-0.5">
          {target ? (
            <>
              {fmMode !== 'files' && (
                <MenuButton icon={Undo2} label={t('filemanager.actions.openOriginalLocation')} action="open_location" className="text-primary" />
              )}
              {fmMode === 'trash' ? (
                <>
                  <MenuButton icon={Undo2} label={t('filemanager.actions.restore')} action="restore" className="text-green-500" />
                  <MenuButton icon={Trash2} label={t('filemanager.actions.deletePermanent')} action="delete_permanent" danger />
                </>
              ) : (
                <>
                  {!isBatch && target.is_dir && <MenuButton icon={FolderOpen} label={t('filemanager.actions.open')} action="open" />}
                  {!target.is_dir && <MenuButton icon={Eye} label={t('filemanager.actions.preview')} action="preview" />}
                  <MenuButton icon={Download} label={t('filemanager.actions.download')} action="download" />

                  <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
                  
                  {fmMode === 'shares' ? (
                    <>
                      <MenuButton icon={Pencil} label={t('filemanager.shareModal.viewEditTitle')} action="share" />
                      <MenuButton icon={Share2} label={t('filemanager.actions.cancelShare')} action="cancel_share" danger />
                    </>
                  ) : fmMode === 'recent' ? (
                    <MenuButton icon={X} label={t('filemanager.actions.removeFromHistory')} action="remove_from_history" danger />
                  ) : (
                    <>
                      <MenuButton icon={Archive} label={t('filemanager.actions.compress')} action="compress" />
                      {isArchive(target) && (
                        <>
                          <MenuButton icon={FolderSearch} label={t('filemanager.archive.browseTitle') || 'Browse Content'} action="browse_archive" className="text-primary" />
                          <MenuButton icon={Zap} label={t('filemanager.actions.extract')} action="extract" className="text-yellow-500" />
                        </>
                      )}
                      {target.is_dir && capabilities?.thumbnail?.enabled && fmMode === 'files' && (
                        <>
                          <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
                          <MenuButton icon={Eye} label={t('filemanager.thumbnail.clearDir')} action="thumb_clear_dir" />
                          <MenuButton icon={Lock} label={t('filemanager.thumbnail.disable')} action="thumb_disable" />
                          <MenuButton icon={Unlock} label={t('filemanager.thumbnail.enable')} action="thumb_enable" />
                        </>
                      )}
                      <div className="relative">
                        <MenuButton
                          icon={target.favorite_color > 0 ? Star : StarOff}
                          label={t('filemanager.actions.favorite')}
                          hasSub={true}
                          active={target.favorite_color > 0}
                          className="text-orange-400"
                        />
                        {showFavoriteSub && (
                          <div className={cn("py-1 animate-in slide-in-from-top-1 rounded-xl mx-1 my-1", isDark ? "bg-white/5" : "bg-gray-50")}>
                            <button
                              onClick={() => onAction('favorite_0', target)}
                              className={cn(
                                "w-full flex items-center gap-3 px-8 py-1.5 text-sm font-bold transition-colors",
                                isDark ? "hover:bg-white/5" : "hover:bg-gray-100",
                                target.favorite_color === 0 ? "text-primary" : "opacity-60"
                              )}
                            >
                              <StarOff size={18} className="shrink-0" />
                              <span>{t('filemanager.actions.unfavorite') || 'None'}</span>
                            </button>
                            <div className={cn("h-px my-1 mx-4 opacity-10", isDark ? "bg-white" : "bg-black")} />
                            {FAVORITE_COLORS.map(color => (
                              <button
                                key={color.id}
                                onClick={() => onAction(`favorite_${color.id}`, target)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-8 py-1.5 text-sm font-bold transition-colors",
                                  isDark ? "hover:bg-white/5" : "hover:bg-gray-100",
                                  target.favorite_color === color.id ? "text-primary" : "opacity-60"
                                )}
                              >
                                <div className={cn("w-2 h-2 rounded-full", color.class)} />
                                <span>{t(`filemanager.colors.${color.name.toLowerCase()}`) || color.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <MenuButton icon={Share2} label={t('filemanager.actions.share')} action="share" />
                    </>
                  )}

                  <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
                  
                  <MenuButton icon={Copy} label={t('filemanager.actions.copy')} action="copy" />
                  <MenuButton icon={Scissors} label={t('filemanager.actions.cut')} action="cut" />
                  {!isBatch && <MenuButton icon={Pencil} label={t('filemanager.actions.rename')} action="rename" />}
                  
                  <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
                  
                  <MenuButton icon={Trash2} label={t('filemanager.actions.delete')} action="delete" danger />
                  <MenuButton icon={PlusSquare} label={t('filemanager.actions.properties')} action="properties" />
                </>
              )}
            </>
          ) : (
            <>
              <MenuButton icon={RotateCw} label={t('filemanager.refresh')} action="refresh" />
              <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
              <MenuButton icon={PlusSquare} label={t('filemanager.newFile')} action="new_file" />
              <MenuButton icon={FolderPlus} label={t('filemanager.newFolder')} action="new_folder" />
              <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
              <MenuButton
                icon={Clipboard}
                label={`${t('filemanager.actions.paste')} (${clipboard.length})`}
                action="paste"
                className={cn(clipboard.length === 0 && "opacity-30 pointer-events-none")}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
