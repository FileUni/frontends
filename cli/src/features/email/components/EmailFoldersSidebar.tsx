import React from "react";
import { Archive, ArrowLeft, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import type { EmailFolder } from "./emailTypes.ts";

interface EmailFoldersSidebarProps {
  visible: boolean;
  activeView: "accounts" | "folders" | "messages" | "detail";
  folders: EmailFolder[];
  selectedFolder: string | null;
  onBack: () => void;
  onSelectFolder: (folderId: string) => void;
}

export const EmailFoldersSidebar: React.FC<EmailFoldersSidebarProps> = ({
  visible,
  activeView,
  folders,
  selectedFolder,
  onBack,
  onSelectFolder,
}) => {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <div className={cn("w-52 border-r border-border/40 flex flex-col bg-muted/5", activeView !== "folders" && "hidden md:flex")}>
      <div className="p-3 border-b border-border/40 flex items-center gap-2">
        <button className="md:hidden p-1 hover:bg-muted rounded-lg" onClick={onBack}><ArrowLeft size={16} /></button>
        <span className="text-sm font-black uppercase text-muted-foreground tracking-widest opacity-50">{t("email.foldersLabel")}</span>
      </div>
      <div className="p-2 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
        {folders.map((folder) => (
          <button key={folder.id} onClick={() => onSelectFolder(folder.id)} className={cn("w-full p-2 rounded-xl text-left transition-all flex items-center justify-between text-sm font-medium", selectedFolder === folder.id ? "bg-background shadow-md border border-border/40 text-primary text-foreground" : "hover:bg-background/40 text-muted-foreground")}>
            <div className="flex items-center gap-2">{folder.name.toUpperCase() === "INBOX" ? <Inbox size={18} /> : <Archive size={18} />}<span className="truncate max-w-[100px]">{folder.display_name || folder.name}</span></div>
            {folder.unread_count > 0 && <span className="text-[14px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full shadow-sm">{folder.unread_count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
