import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { 
  X, Plus, Folder, File as FileIconLucide, 
  ChevronLeft as ScrollLeft, ChevronRight as ScrollRight,
  ArrowLeftToLine, ArrowRightToLine, XCircle 
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useFileStore, type Tab } from "../store/useFileStore.ts";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Sub-component: Tab Context Menu ---
const TabContextMenu = ({ x, y, tabId, onClose }: { x: number; y: number; tabId: string; onClose: () => void; }) => {
  const { t } = useTranslation();
  const { closeOtherTabs, closeLeftTabs, closeRightTabs } = useFileStore();

  const actions = [
    { id: "close_others", label: t("filemanager.tabs.closeOthers"), icon: XCircle, onClick: () => closeOtherTabs(tabId) },
    { id: "close_left", label: t("filemanager.tabs.closeLeft"), icon: ArrowLeftToLine, onClick: () => closeLeftTabs(tabId) },
    { id: "close_right", label: t("filemanager.tabs.closeRight"), icon: ArrowRightToLine, onClick: () => closeRightTabs(tabId) },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-[101] w-56 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100" style={{ left: x, top: y }}>
        {actions.map((action) => (
          <button key={action.id} onClick={() => { action.onClick(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-sm font-bold group">
            <action.icon size={16} className="opacity-40 group-hover:opacity-100" />
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
};

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  onRemove: (id: string) => void;
  onActivate: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

// --- Sub-component: Sortable Tab ---
const SortableTab = ({ tab, isActive, onRemove, onActivate, onContextMenu }: SortableTabProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : isActive ? 20 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-active={isActive} onClick={() => onActivate(tab.id)} onContextMenu={(e) => onContextMenu(e, tab.id)}
      className={cn(
        "group h-9 px-3 rounded-lg flex items-center gap-2 cursor-grab active:cursor-grabbing transition-all min-w-[120px] max-w-[200px] relative shrink-0 select-none border",
        isActive ? "bg-background text-foreground border-zinc-200 dark:border-white/10 shadow-sm z-20 scale-[1.01]" : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground opacity-80 hover:opacity-100",
        isDragging && "opacity-50 scale-95 z-50 bg-background shadow-2xl",
      )}>
      {isActive && <div className="absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]" />}
      <div className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")}>
        {tab.path === "/" || !tab.path.includes(".") ? <Folder size={18} /> : <FileIconLucide size={18} />}
      </div>
      <span className={cn("text-sm font-black uppercase tracking-widest truncate flex-1 pointer-events-none", isActive ? "text-foreground" : "text-inherit")}>{tab.title}</span>
      <button onClick={(e) => { e.stopPropagation(); onRemove(tab.id); }} className={cn("p-1 rounded-md transition-all shrink-0 hover:bg-destructive/10 hover:text-destructive", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        <X size={10} />
      </button>
    </div>
  );
};

// --- Main Component: Tabs Bar ---
export const FileManagerTabs = () => {
  const store = useFileStore();
  const { setActiveTabId, addTab, removeTab, setTabs } = store;
  const tabs = store.getTabs();
  const currentPath = store.getCurrentPath();
  const activeTabId = useFileStore((state) => state.userStates[state._getUid()]?.activeTabId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string; } | null>(null);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowScrollLeft(scrollLeft > 10);
      setShowScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll, tabs]);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      e.stopPropagation();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((t) => t.id === active.id);
      const newIndex = tabs.findIndex((t) => t.id === over.id);
      setTabs(arrayMove(tabs, oldIndex, newIndex));
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div className="relative h-11 flex items-center shrink-0 overflow-hidden bg-muted/10 px-2 transition-colors border-b border-border/30">
      {showScrollLeft && (
        <div className="absolute left-0 inset-y-0 w-12 bg-gradient-to-r from-background to-transparent z-30 flex items-center justify-start pl-1 pointer-events-none">
          <button onClick={() => handleScroll("left")} className="pointer-events-auto w-8 h-8 rounded-full bg-background shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
            <ScrollLeft size={16} strokeWidth={3} />
          </button>
        </div>
      )}

      <div ref={scrollContainerRef} onWheel={handleWheel} onScroll={checkScroll} className="flex-1 h-full flex items-center overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x select-none">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center h-full gap-1 px-2">
              {tabs.map((tab) => (
                <SortableTab key={tab.id} tab={tab} isActive={activeTabId === tab.id} onActivate={setActiveTabId} onRemove={removeTab} onContextMenu={(e: React.MouseEvent, id: string) => setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: id })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button className="p-1 h-8 w-8 rounded-md opacity-30 hover:opacity-100 hover:bg-muted hover:text-primary shrink-0 transition-all ml-1" onClick={() => addTab(currentPath)}>
          <Plus size={18} />
        </button>
      </div>

      {showScrollRight && (
        <div className="absolute right-0 inset-y-0 w-12 bg-gradient-to-l from-background to-transparent z-30 flex items-center justify-end pr-1 pointer-events-none">
          <button onClick={() => handleScroll("right")} className="pointer-events-auto w-8 h-8 rounded-full bg-background shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
            <ScrollRight size={16} strokeWidth={3} />
          </button>
        </div>
      )}

      {tabContextMenu && <TabContextMenu x={tabContextMenu.x} y={tabContextMenu.y} tabId={tabContextMenu.tabId} onClose={() => setTabContextMenu(null)} />}
    </div>
  );
};
