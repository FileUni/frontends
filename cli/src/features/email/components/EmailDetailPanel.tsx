import React from "react";
import { ArrowLeft, Edit3, Mail, Maximize2, Paperclip, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button.tsx";
import { SafeHtmlRenderer, formatDate, formatSize, stripHtml } from "./emailUtils.tsx";
import type { EmailMessage, EmailMessageDetail } from "./emailTypes.ts";
import { cn } from "@/lib/utils.ts";

interface EmailDetailPanelProps {
  activeView: "accounts" | "folders" | "messages" | "detail";
  selectedMessage: EmailMessage | null;
  messageDetail: EmailMessageDetail | null;
  loadingDetail: boolean;
  safeMode: boolean;
  setSafeMode: (value: boolean) => void;
  onBack: () => void;
  onCloseDetail: () => void;
  onOpenFull: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onSaveAttachment: (attachmentId: number, filename: string) => void;
  onDownloadAttachment: (attachmentId: number, filename: string) => void;
}

export const EmailDetailPanel: React.FC<EmailDetailPanelProps> = ({
  activeView,
  selectedMessage,
  messageDetail,
  loadingDetail,
  safeMode,
  setSafeMode,
  onBack,
  onCloseDetail,
  onOpenFull,
  onReply,
  onReplyAll,
  onSaveAttachment,
  onDownloadAttachment,
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("w-full lg:w-[450px] xl:w-[600px] flex flex-col bg-background/40", activeView !== "detail" && "hidden lg:flex")}>
      {selectedMessage ? (
        <div className="flex-1 flex flex-col overflow-hidden text-foreground">
          <div className="h-14 border-b border-border/40 px-4 flex items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2"><button className="lg:hidden p-1 hover:bg-muted rounded-lg" onClick={onBack}><ArrowLeft size={18} /></button><span className="text-sm font-black uppercase tracking-widest opacity-40">{t("email.messageThread")}</span></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 rounded-lg text-sm font-black uppercase" onClick={onReply}><Edit3 size={18} />{t("email.reply")}</Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 rounded-lg text-sm font-black uppercase" onClick={onReplyAll}><RefreshCw size={18} />{t("email.replyAll")}</Button>
              <div className="w-px h-4 bg-border/40 mx-1" />
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onOpenFull}><Maximize2 size={16} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onCloseDetail}><X size={16} /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div>
              <h1 className="text-xl font-black tracking-tight leading-tight mb-4">{selectedMessage.subject}</h1>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/30 text-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">{(selectedMessage.from_name || selectedMessage.from_addr).charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><div className="font-bold truncate text-foreground">{selectedMessage.from_name || selectedMessage.from_addr}</div><div className="opacity-50 truncate">{selectedMessage.from_addr}</div></div>
                <div className="text-sm opacity-40 text-right">{formatDate(selectedMessage.date)}<br/>{formatSize(selectedMessage.size)}</div>
              </div>
            </div>
            {loadingDetail ? <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-primary/20" size={32} /></div> : messageDetail && (
              <div className="space-y-6">
                {messageDetail.body_html && (
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-4">
                    <div className="text-sm text-orange-500 font-bold leading-snug">{safeMode ? t("email.securityShieldBlocked") : t("email.securityShieldActive")}</div>
                    <Button size="sm" variant="outline" className="h-9 text-sm border-orange-500/30 text-orange-500 hover:bg-orange-500 rounded-lg px-3" onClick={() => setSafeMode(!safeMode)}>{safeMode ? t("email.showContent") : t("email.backToSafe")}</Button>
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {!safeMode && messageDetail.body_html ? <SafeHtmlRenderer html={messageDetail.body_html} emptyText={t("email.noContent")} /> : <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{messageDetail.body_text || stripHtml(messageDetail.body_html || "") || t("email.noContent")}</div>}
                </div>
                {messageDetail.attachments && messageDetail.attachments.length > 0 && (
                  <div className="rounded-2xl border border-border/40 p-3 space-y-2 bg-muted/10">
                    <div className="text-sm font-black uppercase tracking-widest opacity-50">{t("email.attachments")}</div>
                    <div className="space-y-2">
                      {messageDetail.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-border/40 p-2 bg-background/80">
                          <Paperclip size={18} className="text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-bold">{attachment.filename}</div>
                            <div className="text-sm opacity-50">{formatSize(attachment.size)}</div>
                          </div>
                          <Button variant="outline" size="sm" className="h-9 text-sm rounded-lg" onClick={() => onSaveAttachment(attachment.id, attachment.filename)}>
                            {t("email.saveToVfs")}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 text-sm rounded-lg" onClick={() => onDownloadAttachment(attachment.id, attachment.filename)}>
                            {t("common.download")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : <div className="flex-1 flex items-center justify-center opacity-10"><Mail size={120} strokeWidth={0.5} /></div>}
    </div>
  );
};
