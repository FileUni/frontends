import React from "react";
import { ArrowLeft, Mail, Paperclip, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/Input.tsx";
import { cn } from "@/lib/utils.ts";
import { formatDate } from "./emailUtils.tsx";
import type { EmailDraft, EmailMessage } from "./emailTypes.ts";

interface EmailMessagesPanelProps {
  activeView: "accounts" | "folders" | "messages" | "detail";
  selectedFolder: string | null;
  isDraftsView: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  drafts: EmailDraft[];
  filteredMessages: EmailMessage[];
  selectedMessageId: string | null;
  onBack: () => void;
  onResumeDraft: (draft: EmailDraft) => void;
  onOpenMessage: (message: EmailMessage) => void;
}

export const EmailMessagesPanel: React.FC<EmailMessagesPanelProps> = ({
  activeView,
  selectedFolder,
  isDraftsView,
  searchQuery,
  setSearchQuery,
  drafts,
  filteredMessages,
  selectedMessageId,
  onBack,
  onResumeDraft,
  onOpenMessage,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("flex-1 flex flex-col min-w-0 border-r border-border/40 text-foreground", activeView !== "messages" && "hidden lg:flex")}>
      {(selectedFolder || isDraftsView) ? (
        <>
          <div className="h-14 border-b border-border/40 px-3 flex items-center gap-2 bg-muted/5">
            <button className="lg:hidden p-1 hover:bg-muted rounded-lg" onClick={onBack}><ArrowLeft size={16} /></button>
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} /><Input placeholder={t("email.searchMessages")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 rounded-xl bg-background/50 border-none text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isDraftsView ? drafts.map(draft => (
              <div key={draft.id} onClick={() => onResumeDraft(draft)} className="w-full p-3.5 border-b border-border/30 text-left hover:bg-orange-500/5 cursor-pointer transition-all">
                <div className="flex justify-between items-start gap-2 text-foreground">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-sm font-black uppercase text-orange-600 bg-orange-500/10 px-1.5 rounded">{t("email.draft")}</span><span className="font-bold text-sm truncate">{draft.to_addr || t("email.noRecipient")}</span></div>
                    <p className="font-black text-sm truncate mt-1">{draft.subject || t("email.noSubject")}</p>
                  </div>
                  <span className="text-[14px] opacity-40 whitespace-nowrap">{formatDate(draft.updated_at)}</span>
                </div>
              </div>
            )) : filteredMessages.map((message) => (
              <div key={message.id} onClick={() => onOpenMessage(message)} className={cn("w-full p-3.5 border-b border-border/30 text-left transition-all cursor-pointer relative", selectedMessageId === message.id ? "bg-primary/5 shadow-inner" : "hover:bg-muted/20", !message.is_read && "bg-primary/[0.02]")}>
                {!message.is_read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />}
                <div className="flex items-start justify-between gap-2 text-sm text-foreground">
                  <div className="flex-1 min-w-0">
                    <span className={cn("font-black truncate block", !message.is_read ? "text-foreground" : "text-muted-foreground opacity-60")}>{message.from_name || message.from_addr}</span>
                    <p className="font-bold truncate mt-0.5">{message.subject}</p>
                    {message.is_local_pending && (
                      <div className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[14px] font-bold", message.sync_state === "smtp_accepted" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                        <RefreshCw size={10} className={cn(message.sync_state === "smtp_accepted" ? "" : "animate-spin")} />
                        {message.sync_state === "smtp_accepted" ? t("email.smtpAccepted") : t("email.pendingSync")}
                      </div>
                    )}
                    {message.has_attachments && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[14px] font-bold text-primary">
                        <Paperclip size={10} />
                        {t("email.attachments")}
                      </div>
                    )}
                  </div>
                  <span className="text-[14px] opacity-40 whitespace-nowrap pt-0.5">{formatDate(message.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : <div className="flex-1 flex items-center justify-center opacity-10"><Mail size={48} /></div>}
    </div>
  );
};
