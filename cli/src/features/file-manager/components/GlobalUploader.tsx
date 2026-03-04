import { useEffect, useMemo, useState } from "react";
import { useUploadStore, type UploadTask } from "../store/useUploadStore.ts";
import { useUploadActions } from "../hooks/useUploadActions.ts";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle,
  Inbox,
} from "lucide-react";
import { Progress } from "@/components/ui/Progress.tsx";
import { useThemeStore } from "@fileuni/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";

// DnD Kit
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  task: UploadTask;
  isDark: boolean;
  onRemove: (id: string) => void;
}

/**
 * Ultra-compact upload item
 */
const CompactUploadItem = ({ task, isDark, onRemove }: SortableItemProps) => {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-3 py-2.5 rounded-xl border transition-all group relative flex flex-col gap-1.5",
        isDark
          ? "bg-white/[0.02] border-white/5"
          : "bg-gray-50/50 border-gray-100",
        task.status === "error" && "border-red-500/20 bg-red-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="shrink-0">
            {task.status === "completed" ? (
              <CheckCircle2 size={18} className="text-green-500" />
            ) : task.status === "error" ? (
              <AlertCircle size={18} className="text-red-500" />
            ) : task.status === "uploading" ? (
              <Loader2 size={18} className="animate-spin text-primary" />
            ) : (
              <Clock size={18} className="text-zinc-500" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold truncate text-white/90 leading-tight">
              {task.file.name}
            </span>
            <span className="text-sm opacity-30 font-mono truncate">
              {task.targetPath || "/"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-black font-mono text-primary/80">
            {task.progress}%
          </span>
          <button
            onClick={() => onRemove(task.id)}
            className="p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <Progress
        value={task.progress}
        className="h-0.5 bg-white/5"
        barClassName={cn(
          "transition-all duration-300",
          task.status === "error" ? "bg-red-500" : "bg-primary",
        )}
      />

      {task.status === "error" && (
        <p className="text-[14px] text-red-400 font-bold truncate italic mt-0.5">
          {task.errorMsg}
        </p>
      )}
    </div>
  );
};

export const GlobalUploader = () => {
  const {
    tasks,
    isMinimized,
    setMinimized,
    removeTask,
    clearCompleted,
    reorderTasks,
  } = useUploadStore();
  const { uploadFile } = useUploadActions();
  const { theme } = useThemeStore();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"uploading" | "completed">(
    "uploading",
  );
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Categorize tasks
  const uploadingTasks = useMemo(
    () => tasks.filter((t) => t.status !== "completed"),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === "completed"),
    [tasks],
  );

  // Concurrency control
  useEffect(() => {
    const uploadingCount = tasks.filter((t) => t.status === "uploading").length;
    if (uploadingCount === 0) {
      const nextTask = tasks.find((t) => t.status === "pending");
      if (nextTask) {
        uploadFile(nextTask);
      }
    }
  }, [tasks, uploadFile]);

  // Auto-switch tab if current is empty
  useEffect(() => {
    if (
      activeTab === "uploading" &&
      uploadingTasks.length === 0 &&
      completedTasks.length > 0
    ) {
      setActiveTab("completed");
    } else if (
      activeTab === "completed" &&
      completedTasks.length === 0 &&
      uploadingTasks.length > 0
    ) {
      setActiveTab("uploading");
    }
  }, [uploadingTasks.length, completedTasks.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      reorderTasks(oldIndex, newIndex);
    }
  };

  if (tasks.length === 0) return null;

  const currentList =
    activeTab === "uploading" ? uploadingTasks : completedTasks;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[150] w-[340px] border rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-500 flex flex-col",
        isDark
          ? "bg-zinc-900/95 border-white/10 text-white"
          : "bg-white/95 border-gray-200 text-gray-900",
        isMinimized ? "h-16" : "h-[480px] backdrop-blur-xl",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "h-16 px-5 border-b flex items-center justify-between cursor-pointer shrink-0",
          isDark ? "bg-white/[0.02]" : "bg-gray-50/50",
        )}
        onClick={() => setMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shadow-inner">
            {uploadingTasks.length === 0 ? (
              <CheckCircle size={20} />
            ) : (
              <Loader2 size={20} className="animate-spin" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-black tracking-tight">
              {uploadingTasks.length === 0
                ? t("filemanager.messages.uploadComplete")
                : t("filemanager.uploader.remaining", {
                    count: uploadingTasks.length,
                  })}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: `${(completedTasks.length / tasks.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-black opacity-40 uppercase">
                {completedTasks.length}/{tasks.length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              tasks.forEach((t) => removeTask(t.id));
            }}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl opacity-20 hover:opacity-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs & List */}
      {!isMinimized && (
        <>
          <div className="flex border-b border-white/5 p-1 bg-white/[0.01]">
            <button
              onClick={() => setActiveTab("uploading")}
              className={cn(
                "flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                activeTab === "uploading"
                  ? "bg-primary text-white shadow-lg"
                  : "opacity-40 hover:opacity-60",
              )}
            >
              <RefreshCw
                size={18}
                className={
                  activeTab === "uploading" && uploadingTasks.length > 0
                    ? "animate-spin"
                    : ""
                }
              />
              {t("filemanager.uploader.uploading", {
                count: uploadingTasks.length,
              })}
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={cn(
                "flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                activeTab === "completed"
                  ? "bg-primary text-white shadow-lg"
                  : "opacity-40 hover:opacity-60",
              )}
            >
              <CheckCircle2 size={18} />
              {t("filemanager.uploader.completed", {
                count: completedTasks.length,
              })}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {currentList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                <Inbox size={40} strokeWidth={1} />
                <p className="text-sm font-bold mt-2 uppercase tracking-widest">
                  {t("filemanager.uploader.empty")}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentList.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {currentList.map((task) => (
                    <CompactUploadItem
                      key={task.id}
                      task={task}
                      isDark={isDark}
                      onRemove={removeTask}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div
            className={cn(
              "p-3 border-t flex justify-between items-center bg-white/[0.01]",
              isDark ? "border-white/5" : "border-gray-100",
            )}
          >
            <button
              onClick={clearCompleted}
              disabled={completedTasks.length === 0}
              className="text-sm font-black text-primary hover:underline uppercase tracking-widest disabled:opacity-20 disabled:no-underline"
            >
              {t("filemanager.uploader.clearAll")}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold opacity-30 italic">
                FileUni
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
