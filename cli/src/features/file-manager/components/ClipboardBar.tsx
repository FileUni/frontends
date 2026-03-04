import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../store/useFileStore.ts';
import { useThemeStore } from '@fileuni/shared';
import { useFileActions } from '../hooks/useFileActions.ts';
import type { ClipboardItem } from '../types/index.ts';
import { 
  Clipboard, X, Scissors, Copy, Check, Trash2, 
  ChevronUp, ChevronDown, FileText, Folder, 
  ArrowRight, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/utils.ts';

// DnD Kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  item: ClipboardItem;
  id: string; // Used for dnd-kit identification
  isDark: boolean;
  currentPath: string;
  onRemove: (path: string) => void;
  pasteSingleItem: (item: ClipboardItem, targetPath: string, type: 'copy' | 'cut') => void;
}

/**
 * 可拖拽排序的剪切板条目 / Sortable Clipboard Item
 */
const SortableClipboardItem = ({ item, id, isDark, currentPath, onRemove, pasteSingleItem }: SortableItemProps) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "relative pl-2 pr-2 py-2 rounded-xl border transition-all group flex items-center justify-between gap-2",
        isDark ? "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]" : "bg-gray-50/30 border-gray-100 hover:bg-gray-100/50"
      )}
    >
      {/* Drag Handle & Intent Bar Container */}
      <div className="flex items-center self-stretch">
        <div 
          {...attributes} 
          {...listeners}
          className="p-1 hover:bg-white/10 rounded cursor-grab active:cursor-grabbing opacity-20 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical size={18} />
        </div>
        <div className={cn(
          "w-0.5 h-4 rounded-full mx-1",
          item.type === 'cut' ? "bg-orange-500" : "bg-blue-500"
        )} />
      </div>

      {/* Info Section */}
      <div className="flex items-start gap-2 min-w-0 flex-1 ml-1">
        <div className="mt-1 shrink-0">
          {item.is_dir ? <Folder size={18} className="text-yellow-500/70" /> : <FileText size={18} className="text-blue-400/70" />}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={cn(
            "text-sm font-black truncate leading-tight tracking-tight",
            isDark ? "text-white" : "text-zinc-950"
          )}>
            {item.name}
          </span>
          <div 
            className="flex items-center gap-1 opacity-30 hover:opacity-60 transition-opacity cursor-help"
            title={item.path}
          >
            <ArrowRight size={8} className="shrink-0" />
            <span className="text-[14px] font-mono truncate">{item.path}</span>
          </div>
        </div>
      </div>
      
      {/* Right Side: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button 
          onClick={() => pasteSingleItem(item, currentPath, 'copy')}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            isDark ? "hover:bg-blue-500/20 text-white/30 hover:text-blue-400" : "hover:bg-blue-100 text-zinc-400 hover:text-blue-600"
          )}
          title={t('filemanager.clipboard.copyHere')}
        >
          <Copy size={13} />
        </button>
        <button 
          onClick={() => pasteSingleItem(item, currentPath, 'cut')}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            isDark ? "hover:bg-orange-500/20 text-white/30 hover:text-orange-400" : "hover:bg-orange-100 text-zinc-400 hover:text-orange-600"
          )}
          title={t('filemanager.clipboard.moveHere')}
        >
          <Scissors size={13} />
        </button>
        <div className={cn("w-px h-3 mx-0.5", isDark ? "bg-white/5" : "bg-zinc-200")} />
        <button 
          onClick={() => onRemove(item.path)}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            isDark ? "hover:bg-red-500/20 text-white/20 hover:text-red-500" : "hover:bg-red-100 text-zinc-300 hover:text-red-600"
          )}
          title={t('filemanager.clipboard.remove')}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export const ClipboardBar = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const store = useFileStore();
  const clipboard = store.getClipboard();
  const fmMode = store.fmMode;
  const { clearClipboard, removeFromClipboard, getCurrentPath, reorderClipboard } = store;
  const { pasteItems, pasteSingleItem } = useFileActions();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      // Find indexes using path as stable identifier
      const oldIndex = clipboard.findIndex(i => i.path === active.id);
      const newIndex = clipboard.findIndex(i => i.path === over.id);
      reorderClipboard(oldIndex, newIndex);
    }
  };

  if (clipboard.length === 0) return null;

  const currentPath = getCurrentPath();
  const hasCut = clipboard.some(i => i.type === 'cut');
  const canPaste = fmMode === 'files';

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-[140] w-[340px] shadow-[0_20px_70px_rgba(0,0,0,0.5)] transition-all duration-500 flex flex-col border backdrop-blur-xl",
      isDark ? "bg-zinc-900/95 border-white/10 text-white" : "bg-white/95 border-gray-200 text-gray-900",
      isExpanded ? "h-[450px] rounded-[2rem]" : "h-14 rounded-full overflow-hidden"
    )}>
      {/* Header / Summary Bar */}
      <div 
        className={cn(
          "h-14 px-5 flex items-center justify-between cursor-pointer shrink-0 transition-colors",
          isExpanded ? "border-b border-white/5 bg-white/[0.02]" : "hover:bg-white/[0.03]"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shadow-inner transition-transform duration-500",
            isExpanded ? "rotate-12 scale-110" : "",
            hasCut ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"
          )}>
            <Clipboard size={16} />
          </div>
          <div>
            <h4 className={cn(
              "text-sm font-black uppercase tracking-widest leading-none",
              isDark ? "text-white/90" : "text-zinc-900"
            )}>
              {t('filemanager.clipboard.title')}
            </h4>
            <p className="text-[14px] font-bold opacity-30 mt-1 uppercase">
              {clipboard.length} / 100 {t('common.items')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isExpanded && canPaste && (
            <Button 
              size="sm" 
              className="h-7 px-3 rounded-full bg-primary text-white font-bold text-[14px] uppercase shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              onClick={(e) => { e.stopPropagation(); pasteItems(clipboard, currentPath); }}
              title="Ctrl+V"
            >
              {t('filemanager.actions.pasteHere')}
            </Button>
          )}
          <div className="p-1.5 opacity-20 hover:opacity-100 transition-opacity">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded List with Sortable */}
      {isExpanded && (
        <>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clipboard.map(i => i.path)} strategy={verticalListSortingStrategy}>
                {clipboard.map((item) => (
                  <SortableClipboardItem 
                    key={item.path} 
                    id={item.path}
                    item={item} 
                    isDark={isDark} 
                    currentPath={currentPath}
                    onRemove={removeFromClipboard}
                    pasteSingleItem={canPaste ? pasteSingleItem : () => {}}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Footer Actions */}
          <div className={cn(
            "p-4 border-t flex justify-between items-center bg-white/[0.01]",
            isDark ? "border-white/5" : "border-gray-100"
          )}>
            <button 
              onClick={clearClipboard}
              className="text-sm font-black text-red-400/60 hover:text-red-500 hover:underline uppercase tracking-tighter flex items-center gap-1.5 transition-all"
            >
              <Trash2 size={18} />
              {t('filemanager.clipboard.clear')}
            </button>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                onClick={() => setIsExpanded(false)}
                className="h-8 px-3 rounded-xl text-sm font-bold opacity-40 hover:opacity-100 uppercase"
              >
                {t('common.close')}
              </Button>
              <Button 
                size="sm" 
                disabled={!canPaste}
                className={cn(
                  "h-9 px-5 rounded-xl bg-primary text-white font-bold text-sm uppercase shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2",
                  !canPaste && "opacity-20 cursor-not-allowed grayscale"
                )}
                onClick={() => { pasteItems(clipboard, currentPath); setIsExpanded(false); }}
              >
                <Check size={18} />
                {t('filemanager.actions.pasteHere')}
                {canPaste && <span className="opacity-40 text-sm ml-1">(Ctrl+V)</span>}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
