import React from "react";
import { Clock, Paperclip, RefreshCw, Send, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Modal } from "@/components/ui/Modal.tsx";
import { EmailRichEditor } from "./EmailRichEditor.tsx";
import type { ComposeAttachment, EmailAccount } from "./emailTypes.ts";

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
  composeFromAccount: string;
  setComposeFromAccount: (value: string) => void;
  composeTo: string;
  setComposeTo: (value: string) => void;
  composeCc: string;
  setComposeCc: (value: string) => void;
  composeBcc: string;
  setComposeBcc: (value: string) => void;
  composeSubject: string;
  setComposeSubject: (value: string) => void;
  composeBody: string;
  setComposeBody: (value: string) => void;
  composeAttachments: ComposeAttachment[];
  setComposeAttachments: React.Dispatch<React.SetStateAction<ComposeAttachment[]>>;
  contacts: { name: string; addr: string }[];
  currentDraftId: string | null;
  createClientUniqueId: () => string;
  onSend: () => Promise<void>;
  sending: boolean;
}

export const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen,
  onClose,
  accounts,
  composeFromAccount,
  setComposeFromAccount,
  composeTo,
  setComposeTo,
  composeCc,
  setComposeCc,
  composeBcc,
  setComposeBcc,
  composeSubject,
  setComposeSubject,
  composeBody,
  setComposeBody,
  composeAttachments,
  setComposeAttachments,
  contacts,
  currentDraftId,
  createClientUniqueId,
  onSend,
  sending,
}) => {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const useSimpleAccountPicker = accounts.length > 0 && accounts.length <= 4;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("email.compose")} maxWidth="max-w-4xl">
      <div className="flex flex-col h-[80vh] text-foreground">
        <div className="flex-1 overflow-y-auto space-y-4 p-1 custom-scrollbar">
          <div className="space-y-2 pb-2 border-b border-border/40">
            <div className="flex items-start gap-3">
              <label className="w-16 h-9 shrink-0 text-sm font-black uppercase opacity-40 flex items-center">{t("email.from")}</label>
              <div className="flex-1">
                {useSimpleAccountPicker ? (
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((account) => {
                      const active = composeFromAccount === account.id;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => setComposeFromAccount(account.id)}
                          className={`h-9 px-3 rounded-lg text-sm font-bold border transition-colors ${
                            active
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-input bg-muted/20 text-foreground hover:bg-muted/35"
                          }`}
                        >
                          {account.display_name || account.email_address}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select value={composeFromAccount} onChange={e => setComposeFromAccount(e.target.value)} className="w-full h-9 bg-background border border-input rounded-lg text-sm font-bold px-2 text-foreground focus:ring-1 focus:ring-primary/30 outline-none">
                    <option value="" className="bg-background text-foreground">{t("email.selectAccount")}</option>
                    {accounts.map(a => <option key={a.id} value={a.id} className="bg-background text-foreground">{a.display_name || a.email_address}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 relative"><label className="w-16 text-sm font-black uppercase opacity-40">{t("email.to")}</label><Input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder={t("email.recipientPlaceholder")} className="flex-1 h-9 border-none bg-muted/20 rounded-lg text-sm" list="email-contacts" /></div>
            <div className="flex items-center gap-3 relative"><label className="w-16 text-sm font-black uppercase opacity-40">{t("email.cc")}</label><Input value={composeCc} onChange={e => setComposeCc(e.target.value)} placeholder={t("email.ccPlaceholder")} className="flex-1 h-9 border-none bg-muted/20 rounded-lg text-sm" list="email-contacts" /></div>
            <div className="flex items-center gap-3 relative"><label className="w-16 text-sm font-black uppercase opacity-40">{t("email.bcc")}</label><Input value={composeBcc} onChange={e => setComposeBcc(e.target.value)} placeholder={t("email.bccPlaceholder")} className="flex-1 h-9 border-none bg-muted/20 rounded-lg text-sm" list="email-contacts" /></div>
            <div className="flex items-center gap-3"><label className="w-16 text-sm font-black uppercase opacity-40">{t("email.subject")}</label><Input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder={t("email.subjectPlaceholder")} className="flex-1 h-9 border-none bg-muted/20 rounded-lg text-sm font-bold" /></div>
            <datalist id="email-contacts">
              {contacts.map((c, i) => {
                const contactValue = c.name && c.name.trim().length > 0 ? c.name : `<${c.addr}>`;
                return <option key={i} value={contactValue} />;
              })}
            </datalist>
          </div>
          <div className="flex-1 min-h-[300px]">
            <EmailRichEditor content={composeBody} onChange={setComposeBody} isDark={document.documentElement.classList.contains("dark")} />
          </div>
          {composeAttachments.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 py-2">
              {composeAttachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-2 rounded-xl bg-primary/5 border border-primary/10 group">
                  <div className="flex items-center gap-2 min-w-0"><Paperclip size={18} className="text-primary" /><div className="truncate text-sm font-bold">{att.name}</div></div>
                  <button onClick={() => setComposeAttachments(prev => prev.filter((item) => item.id !== att.id))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded-md"><X size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/40">
          <div className="flex items-center gap-2"><span className="text-sm font-black uppercase opacity-30 flex items-center gap-1"><Clock size={18} /> {currentDraftId ? t("email.autoSaved") : t("email.notSaved")}</span></div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => {
              const files = Array.from(e.target.files || []);
              const incoming = files.map((file) => ({
                id: createClientUniqueId(),
                name: file.name,
                size: file.size,
                file,
              }));
              setComposeAttachments((prev) => [...prev, ...incoming]);
              e.target.value = "";
            }} />
            <Button variant="ghost" size="sm" className="h-9 rounded-xl gap-2" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} /><span className="text-sm font-black uppercase">{t("email.addAttachment")}</span></Button>
            <Button variant="outline" className="px-6 rounded-xl h-10" onClick={onClose}>{t("common.cancel")}</Button>
            <Button className="px-8 rounded-xl h-10 shadow-lg shadow-primary/20" onClick={onSend} disabled={sending || !composeFromAccount || !composeTo}>
              {sending ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <Send size={18} className="mr-2" />}
              {sending ? t("email.sending") : t("email.send")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
