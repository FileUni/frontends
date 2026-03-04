import React from "react";
import { DownloadCloud, Edit3, FileText, Mail, Plus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/Button.tsx";
import type { EmailAccount, EmailDraft } from "./emailTypes.ts";

interface EmailAccountsSidebarProps {
  activeView: "accounts" | "folders" | "messages" | "detail";
  accounts: EmailAccount[];
  drafts: EmailDraft[];
  isDraftsView: boolean;
  selectedAccount: string | null;
  syncingAccountId: string | null;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenCompose: () => void;
  onOpenDrafts: () => void;
  onSelectAccount: (accountId: string) => void;
  onSyncAccount: (accountId: string) => void;
  onEditAccount: (account: EmailAccount) => void;
  onDeleteAccount: (accountId: string) => void;
  onOpenAddAccount: () => void;
}

export const EmailAccountsSidebar: React.FC<EmailAccountsSidebarProps> = ({
  activeView,
  accounts,
  drafts,
  isDraftsView,
  selectedAccount,
  syncingAccountId,
  onOpenExport,
  onOpenImport,
  onOpenCompose,
  onOpenDrafts,
  onSelectAccount,
  onSyncAccount,
  onEditAccount,
  onDeleteAccount,
  onOpenAddAccount,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("w-64 border-r border-border/40 flex flex-col transition-all", activeView !== "accounts" && "hidden md:flex")}>
      <div className="p-4 border-b border-border/40 bg-muted/10 flex items-center justify-between">
        <h2 className="font-black text-base flex items-center gap-2 tracking-tight"><Mail className="text-primary" size={20} />{t("email.title")}</h2>
        <div className="flex gap-1.5">
          <button onClick={onOpenExport} className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-all" title={t("email.export")}><DownloadCloud size={15} /></button>
          <button onClick={onOpenImport} className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-muted-foreground transition-all" title={t("email.import")}><UploadCloud size={15} /></button>
        </div>
      </div>
      <div className="p-3 border-b border-border/40">
        <Button onClick={onOpenCompose} className="w-full gap-2 h-11 rounded-2xl shadow-lg shadow-primary/20 font-black uppercase text-sm"><Edit3 size={16} />{t("email.compose")}</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar text-foreground">
        <button
          onClick={onOpenDrafts}
          className={cn("w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all group", isDraftsView ? "bg-orange-500/10 border-orange-500/20 shadow-sm text-orange-600" : "bg-background/40 border-transparent hover:border-border/60 hover:bg-muted/30 text-muted-foreground")}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className={cn(isDraftsView ? "text-orange-500" : "text-muted-foreground/60")} />
            <span className="font-bold text-sm">{t("email.globalDrafts")}</span>
          </div>
          {drafts.length > 0 && <span className={cn("text-[14px] font-black px-1.5 py-0.5 rounded-full", isDraftsView ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>{drafts.length}</span>}
        </button>
        <div className="h-px bg-border/40 my-2 mx-2" />
        {accounts.map((acc) => (
          <div key={acc.id} onClick={() => onSelectAccount(acc.id)} className={cn("group relative w-full p-2.5 rounded-2xl border text-left cursor-pointer transition-all", selectedAccount === acc.id && !isDraftsView ? "bg-primary/10 border-primary/20 shadow-sm" : "bg-background/40 border-transparent hover:border-border/60 hover:bg-muted/30")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-bold text-sm truncate">{acc.display_name || acc.email_address}</span>
                {(acc.unread_count ?? 0) > 0 && <span className="px-1.5 py-0.5 rounded-full bg-primary text-[14px] font-black text-white shrink-0 shadow-sm">{acc.unread_count}</span>}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => { e.stopPropagation(); onSyncAccount(acc.id); }} className={cn("p-1 rounded-lg hover:bg-primary/20 text-primary", syncingAccountId === acc.id && "animate-spin")}><RefreshCw size={18} /></button>
                <button onClick={(e) => { e.stopPropagation(); onEditAccount(acc); }} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><Edit3 size={18} /></button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteAccount(acc.id); }} className="p-1 rounded-lg hover:bg-destructive/10 text-destructive opacity-60 hover:opacity-100"><Trash2 size={18} /></button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5 opacity-70">{acc.email_address}</p>
          </div>
        ))}
        <button
          onClick={onOpenAddAccount}
          className="w-full py-2 px-3 flex items-center justify-center gap-2 rounded-xl text-sm font-black uppercase text-muted-foreground/60 hover:text-primary hover:bg-primary/5 transition-all mt-4 border border-transparent hover:border-primary/10"
        >
          <Plus size={18} />
          {t("email.addAccount")}
        </button>
      </div>
    </div>
  );
};
