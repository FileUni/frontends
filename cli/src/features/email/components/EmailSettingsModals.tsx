import React from "react";
import { RefreshCw, Share, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Modal } from "@/components/ui/Modal.tsx";
import { client, extractData } from "@/lib/api.ts";
import { toast } from "@fileuni/shared";
import type { EmailAccount } from "./emailTypes.ts";

type EmailExportPayload = { encrypted_data: string };
type EmailImportPayload = { imported: number };

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'msg' in error) {
    const message = (error as { msg?: unknown }).msg;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return error instanceof Error ? error.message : fallback;
};

interface ExportImportModalProps {
  showExportModal: boolean;
  setShowExportModal: (open: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (open: boolean) => void;
  exportPassword: string;
  setExportPassword: (value: string) => void;
  importPassword: string;
  setImportPassword: (value: string) => void;
  importData: string;
  setImportData: (value: string) => void;
  importMode: "text" | "file";
  setImportMode: (value: "text" | "file") => void;
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
  isImporting: boolean;
  setIsImporting: (value: boolean) => void;
  onAccountsChanged: () => void;
}

export const EmailExportImportModals: React.FC<ExportImportModalProps> = ({
  showExportModal,
  setShowExportModal,
  showImportModal,
  setShowImportModal,
  exportPassword,
  setExportPassword,
  importPassword,
  setImportPassword,
  importData,
  setImportData,
  importMode,
  setImportMode,
  isExporting,
  setIsExporting,
  isImporting,
  setIsImporting,
  onAccountsChanged,
}) => {
  const { t } = useTranslation();
  const importFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    if (!exportPassword) return toast.error(t("email.exportPasswordRequired"));
    setIsExporting(true);
    try {
      const res = await extractData<EmailExportPayload>(client.POST("/api/v1/email/accounts/export", { body: { export_password: exportPassword } }));
      const blob = new Blob([res.encrypted_data], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `email_accounts_backup_${new Date().toISOString().split("T")[0]}.rsce`;
      anchor.click();
      toast.success(t("email.exportSuccess"));
      setShowExportModal(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("email.exportFailed")));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    const encryptedData = importData.trim();
    if (!importPassword || !encryptedData) return toast.error(t("email.importRequired"));
    setIsImporting(true);
    try {
      const res = await extractData<EmailImportPayload>(client.POST("/api/v1/email/accounts/import", { body: { encrypted_data: encryptedData, import_password: importPassword } }));
      toast.success(`${t("email.importSuccess")}: ${res.imported}`);
      setShowImportModal(false);
      onAccountsChanged();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, t("email.importFailed")));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title={t("email.exportAccounts")} maxWidth="max-w-md">
        <div className="space-y-4 py-2 text-foreground">
          <p className="text-sm text-muted-foreground leading-relaxed">{t("email.exportDescription")}</p>
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.exportPassword")}</label><Input type="password" value={exportPassword} onChange={e => setExportPassword(e.target.value)} placeholder={t("email.passwordPlaceholder")} /></div>
          <Button className="w-full h-11 rounded-2xl shadow-lg shadow-primary/20 font-black uppercase text-sm" onClick={handleExport} disabled={isExporting}>{isExporting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Share className="mr-2" size={16} />}{t("email.exportNow")}</Button>
        </div>
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title={t("email.importAccounts")} maxWidth="max-w-lg">
        <div className="space-y-4 py-2 text-foreground">
          <div className="flex gap-2 p-1 bg-muted/20 rounded-xl">
            <button onClick={() => setImportMode("text")} className={cn("flex-1 py-2 text-sm font-black uppercase rounded-lg transition-all", importMode === "text" ? "bg-background shadow-sm text-primary" : "text-muted-foreground opacity-60")}>{t("email.importModeText")}</button>
            <button onClick={() => setImportMode("file")} className={cn("flex-1 py-2 text-sm font-black uppercase rounded-lg transition-all", importMode === "file" ? "bg-background shadow-sm text-primary" : "text-muted-foreground opacity-60")}>{t("email.importModeFile")}</button>
          </div>
          {importMode === "text" ? (
            <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.encryptedData")}</label><textarea value={importData} onChange={e => setImportData(e.target.value)} className="w-full h-32 p-3 rounded-xl border border-input bg-background font-mono text-sm resize-none custom-scrollbar text-foreground" placeholder={t("email.pasteEncryptedData")} /></div>
          ) : (
            <div className="h-32 border-2 border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-muted/10 transition-all">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".rsce,.txt,.json,.enc,text/plain,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setImportData(text);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer"
                onClick={() => importFileInputRef.current?.click()}
              >
                <Upload className="text-muted-foreground/40" size={24} />
                <span className="text-sm font-black uppercase opacity-40">{t("email.clickOrDropFile")}</span>
                {importData && <span className="text-sm text-primary font-bold">{t("email.fileLoaded")}</span>}
              </button>
            </div>
          )}
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.importPassword")}</label><Input type="password" value={importPassword} onChange={e => setImportPassword(e.target.value)} placeholder={t("email.passwordPlaceholder")} /></div>
          <Button className="w-full h-11 rounded-2xl shadow-lg shadow-primary/20 font-black uppercase text-sm" onClick={handleImport} disabled={isImporting}>{isImporting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Share className="mr-2" size={16} />}{t("email.importNow")}</Button>
        </div>
      </Modal>
    </>
  );
};

interface EmailAccountModalProps {
  showAccountModal: boolean;
  setShowAccountModal: (open: boolean) => void;
  editingAccount: EmailAccount | null;
  setEditingAccount: (account: EmailAccount | null) => void;
  formEmail: string;
  setFormEmail: (value: string) => void;
  formPassword: string;
  setFormPassword: (value: string) => void;
  formImapHost: string;
  setFormImapHost: (value: string) => void;
  formImapPort: number;
  setFormImapPort: (value: number) => void;
  formImapSecurity: "None" | "SslTls" | "StartTls";
  setFormImapSecurity: (value: "None" | "SslTls" | "StartTls") => void;
  formSmtpHost: string;
  setFormSmtpHost: (value: string) => void;
  formSmtpPort: number;
  setFormSmtpPort: (value: number) => void;
  formSmtpSecurity: "None" | "SslTls" | "StartTls";
  setFormSmtpSecurity: (value: "None" | "SslTls" | "StartTls") => void;
  formDisplayName: string;
  setFormDisplayName: (value: string) => void;
  onSaved: () => void;
}

export const EmailAccountModal: React.FC<EmailAccountModalProps> = ({
  showAccountModal,
  setShowAccountModal,
  editingAccount,
  setEditingAccount,
  formEmail,
  setFormEmail,
  formPassword,
  setFormPassword,
  formImapHost,
  setFormImapHost,
  formImapPort,
  setFormImapPort,
  formImapSecurity,
  setFormImapSecurity,
  formSmtpHost,
  setFormSmtpHost,
  formSmtpPort,
  setFormSmtpPort,
  formSmtpSecurity,
  setFormSmtpSecurity,
  formDisplayName,
  setFormDisplayName,
  onSaved,
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={showAccountModal} onClose={() => { setShowAccountModal(false); setEditingAccount(null); }} title={editingAccount ? t("email.editAccount") : t("email.addAccount")}>
      <div className="space-y-4 py-2 text-foreground">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.emailAddress")}</label><Input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder={t("email.emailPlaceholder")} /></div>
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.displayName")}</label><Input value={formDisplayName} onChange={e => setFormDisplayName(e.target.value)} placeholder={t("email.displayNamePlaceholderForm")} /></div>
        </div>
        <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.password")}</label><Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder={editingAccount ? t("email.keepEmptyToNotChange") : t("email.passwordPlaceholder")} /></div>
        <div className="h-px bg-border/40 my-2" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.imapHost")}</label><Input value={formImapHost} onChange={e => setFormImapHost(e.target.value)} placeholder={t("email.imapHostPlaceholder")} /></div>
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.imapPort")}</label><Input type="number" value={formImapPort} onChange={e => setFormImapPort(Number(e.target.value))} /></div>
        </div>
        <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.imapSecurity")}</label><select value={formImapSecurity} onChange={e => setFormImapSecurity(e.target.value as "None" | "SslTls" | "StartTls")} className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold text-foreground outline-none"><option value="SslTls" className="bg-background text-foreground">{t("email.securitySslTls")}</option><option value="StartTls" className="bg-background text-foreground">{t("email.securityStartTls")}</option><option value="None" className="bg-background text-foreground">{t("email.securityNone")}</option></select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.smtpHost")}</label><Input value={formSmtpHost} onChange={e => setFormSmtpHost(e.target.value)} placeholder={t("email.smtpHostPlaceholder")} /></div>
          <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.smtpPort")}</label><Input type="number" value={formSmtpPort} onChange={e => setFormSmtpPort(Number(e.target.value))} /></div>
        </div>
        <div><label className="text-sm font-black uppercase opacity-40 mb-1 block">{t("email.smtpSecurity")}</label><select value={formSmtpSecurity} onChange={e => setFormSmtpSecurity(e.target.value as "None" | "SslTls" | "StartTls")} className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-bold text-foreground outline-none"><option value="SslTls" className="bg-background text-foreground">{t("email.securitySslTls")}</option><option value="StartTls" className="bg-background text-foreground">{t("email.securityStartTls")}</option><option value="None" className="bg-background text-foreground">{t("email.securityNone")}</option></select></div>
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1 rounded-2xl h-11 font-black uppercase text-sm" onClick={() => setShowAccountModal(false)}>{t("common.cancel")}</Button>
          <Button className="flex-1 rounded-2xl h-11 shadow-lg font-black uppercase text-sm" onClick={async () => {
            try {
              if(editingAccount) {
                await extractData(client.PUT("/api/v1/email/accounts/{id}", { params: { path: { id: editingAccount.id } }, body: { email_address: formEmail, display_name: formDisplayName, password: formPassword || undefined, imap_host: formImapHost, imap_port: formImapPort, imap_security: formImapSecurity, smtp_host: formSmtpHost, smtp_port: formSmtpPort, smtp_security: formSmtpSecurity, is_active: true, sync_enabled: true } }));
                toast.success(t("email.accountUpdated"));
              } else {
                await extractData(client.POST("/api/v1/email/accounts", { body: { email_address: formEmail, password: formPassword, display_name: formDisplayName, imap_host: formImapHost, imap_port: formImapPort, imap_security: formImapSecurity, smtp_host: formSmtpHost, smtp_port: formSmtpPort, smtp_security: formSmtpSecurity } }));
                toast.success(t("email.accountAdded"));
              }
              setShowAccountModal(false);
              setEditingAccount(null);
              onSaved();
            } catch (error: unknown) {
              toast.error(getErrorMessage(error, t("email.saveFailed")));
            }
          }}>{editingAccount ? t("common.save") : t("common.add")}</Button>
        </div>
      </div>
    </Modal>
  );
};
