import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useFileStore, type FMMode } from "../store/useFileStore.ts";
import { useConfigStore } from "@/stores/config.ts";
import { useNavigationStore } from "@/stores/navigation.ts";
import { useFileActions } from "../hooks/useFileActions.ts";
import { cn } from "@/lib/utils.ts";
import {
  Files,
  Star,
  Clock,
  Trash2,
  Share2,
  Database,
} from "lucide-react";

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const FileSidebar = () => {
  const { t } = useTranslation();
  const { params } = useNavigationStore();
  const store = useFileStore();
  const { storageStats } = store;
  const { capabilities } = useConfigStore();
  const { loadStorageStats } = useFileActions();
  useEffect(() => {
    loadStorageStats();
  }, []); // Only on mount

  const mod = params.mod || 'public';
  const page = params.page || 'index';

  const navItems: {
    id: FMMode;
    name: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    hash: string;
  }[] = [
    {
      id: "files",
      name: t("filemanager.allFiles"),
      icon: Files,
      color: "text-blue-500",
      hash: "#mod=file-manager&page=files"
    },
    {
      id: "favorites",
      name: t("filemanager.favorites"),
      icon: Star,
      color: "text-orange-500",
      hash: "#mod=file-manager&page=favorites"
    },
    {
      id: "recent",
      name: t("filemanager.recent"),
      icon: Clock,
      color: "text-green-500",
      hash: "#mod=file-manager&page=recent"
    },
    {
      id: "trash",
      name: t("filemanager.trash"),
      icon: Trash2,
      color: "text-red-500",
      hash: "#mod=file-manager&page=trash"
    },
    { id: "shares", name: t("filemanager.shares.title"), icon: Share2, color: "text-accent", hash: "#mod=file-manager&page=shares" },
  ];

  const used = storageStats?.used || 0;
  const quota = storageStats?.quota || 0;
  const percentage =
    quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;
  const isUnlimited = quota === 0;

  return (
    <div className="flex flex-col space-y-8">
      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <p className="px-4 text-sm font-black uppercase tracking-[0.2em] opacity-20 mb-4">
          Library
        </p>
        {navItems.map((item) => {
          const isActive = mod === 'file-manager' && page === item.id;
          return (
            <a
              key={item.id}
              href={item.hash}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold transition-all",
                isActive
                  ? "bg-primary/10 text-primary shadow-inner"
                  : "opacity-50 hover:opacity-100 hover:bg-white/5",
              )}
            >
              <item.icon
                size={18}
                className={cn(isActive ? "text-primary" : item.color)}
              />
              {item.name}
            </a>
          );
        })}
      </nav>

      {/* Storage Indicator */}
      {capabilities?.enable_quota !== false && (
        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-5 shadow-inner">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
              <Database size={18} /> {t("filemanager.storage")}
            </span>
            <span className="text-sm font-black text-primary">
              {percentage}%
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-[14px] font-bold opacity-30 text-center tracking-tighter">
            {formatSize(used)} of{" "}
            {isUnlimited ? t("admin.edit.unlimited") : formatSize(quota)} Used
          </p>
        </div>
      )}
    </div>
  );
};
