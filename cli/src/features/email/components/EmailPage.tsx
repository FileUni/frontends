import React from "react";
import { Button } from "@/components/ui/Button.tsx";
import { Modal } from "@/components/ui/Modal.tsx";
import { createClientUniqueId } from "./emailUtils.tsx";
import type { EmailPageProps } from "./emailTypes.ts";
import { EmailAccountsSidebar } from "./EmailAccountsSidebar.tsx";
import { EmailComposeModal } from "./EmailComposeModal.tsx";
import { EmailDetailPanel } from "./EmailDetailPanel.tsx";
import { EmailFoldersSidebar } from "./EmailFoldersSidebar.tsx";
import { EmailMessagesPanel } from "./EmailMessagesPanel.tsx";
import { EmailAccountModal, EmailExportImportModals } from "./EmailSettingsModals.tsx";
import { useEmailPageController } from "./useEmailPageController.ts";

export const EmailPage: React.FC<EmailPageProps> = (_props) => {
  const c = useEmailPageController();

  const resetComposeState = () => {
    c.setCurrentDraftId(null);
    c.setActiveRefId(null);
    c.setComposeTo("");
    c.setComposeCc("");
    c.setComposeBcc("");
    c.setComposeSubject("");
    c.setComposeBody("");
    c.setComposeAttachments([]);
  };

  return (
    <div className="flex h-full bg-transparent overflow-hidden transition-all duration-500">
      <EmailAccountsSidebar
        activeView={c.activeView}
        accounts={c.accounts}
        drafts={c.drafts}
        isDraftsView={c.isDraftsView}
        selectedAccount={c.selectedAccount}
        syncingAccountId={c.syncingAccountId}
        onOpenExport={() => c.setShowExportModal(true)}
        onOpenImport={() => c.setShowImportModal(true)}
        onOpenCompose={() => {
          resetComposeState();
          c.setComposeFromAccount(c.selectedAccount || c.accounts[0]?.id || "");
          c.setShowComposeModal(true);
        }}
        onOpenDrafts={() => {
          c.setIsDraftsView(true);
          c.setSelectedAccount(null);
          c.setSelectedFolder(null);
          c.setActiveView("messages");
        }}
        onSelectAccount={(accountId) => {
          c.setSelectedAccount(accountId);
          c.setIsDraftsView(false);
          c.setActiveView("folders");
        }}
        onSyncAccount={c.handleSyncAccount}
        onEditAccount={c.handleEditAccount}
        onDeleteAccount={c.handleDeleteAccount}
        onOpenAddAccount={() => {
          c.setEditingAccount(null);
          c.setShowAccountModal(true);
          c.setFormEmail("");
          c.setFormPassword("");
          c.setFormDisplayName("");
        }}
      />

      <EmailFoldersSidebar
        visible={!c.isDraftsView && !!c.selectedAccount}
        activeView={c.activeView}
        folders={c.folders}
        selectedFolder={c.selectedFolder}
        onBack={() => c.setActiveView("accounts")}
        onSelectFolder={(folderId) => {
          c.setSelectedFolder(folderId);
          c.setActiveView("messages");
        }}
      />

      <EmailMessagesPanel
        activeView={c.activeView}
        selectedFolder={c.selectedFolder}
        isDraftsView={c.isDraftsView}
        searchQuery={c.searchQuery}
        setSearchQuery={c.setSearchQuery}
        drafts={c.drafts}
        filteredMessages={c.filteredMessages}
        selectedMessageId={c.selectedMessage?.id || null}
        onBack={() => (c.isDraftsView ? c.setActiveView("accounts") : c.setActiveView("folders"))}
        onResumeDraft={c.resumeDraft}
        onOpenMessage={(message) => {
          c.setSelectedMessage(message);
          c.setSafeMode(true);
          c.setActiveView("detail");
          if (message.is_local_pending || message.id.startsWith("local-sent-")) {
            c.setMessageDetail(null);
            return;
          }
          void c.fetchMessageDetail(message.id);
        }}
      />

      <EmailDetailPanel
        activeView={c.activeView}
        selectedMessage={c.selectedMessage}
        messageDetail={c.messageDetail}
        loadingDetail={c.loadingDetail}
        safeMode={c.safeMode}
        setSafeMode={c.setSafeMode}
        onBack={() => c.setActiveView("messages")}
        onCloseDetail={() => {
          c.setSelectedMessage(null);
          c.setMessageDetail(null);
          c.setActiveView("messages");
        }}
        onOpenFull={() => c.setShowFullContentModal(true)}
        onReply={() => {
          if (c.messageDetail) {
            c.handleReply(c.messageDetail);
          }
        }}
        onReplyAll={() => {
          if (c.messageDetail) {
            c.handleReply(c.messageDetail, true);
          }
        }}
        onSaveAttachment={(attachmentId, filename) => {
          if (c.selectedMessage) {
            void c.handleSaveAttachmentToVfs(c.selectedMessage.id, attachmentId, filename);
          }
        }}
        onDownloadAttachment={(attachmentId, filename) => {
          if (c.selectedMessage) {
            void c.handleDownloadAttachment(c.selectedMessage.id, attachmentId, filename);
          }
        }}
      />

      <EmailComposeModal
        isOpen={c.showComposeModal}
        onClose={() => c.setShowComposeModal(false)}
        accounts={c.accounts}
        composeFromAccount={c.composeFromAccount}
        setComposeFromAccount={c.setComposeFromAccount}
        composeTo={c.composeTo}
        setComposeTo={c.setComposeTo}
        composeCc={c.composeCc}
        setComposeCc={c.setComposeCc}
        composeBcc={c.composeBcc}
        setComposeBcc={c.setComposeBcc}
        composeSubject={c.composeSubject}
        setComposeSubject={c.setComposeSubject}
        composeBody={c.composeBody}
        setComposeBody={c.setComposeBody}
        composeAttachments={c.composeAttachments}
        setComposeAttachments={c.setComposeAttachments}
        contacts={c.contacts}
        currentDraftId={c.currentDraftId}
        createClientUniqueId={createClientUniqueId}
        onSend={c.handleSendEmail}
        sending={c.sending}
      />

      <EmailExportImportModals
        showExportModal={c.showExportModal}
        setShowExportModal={c.setShowExportModal}
        showImportModal={c.showImportModal}
        setShowImportModal={c.setShowImportModal}
        exportPassword={c.exportPassword}
        setExportPassword={c.setExportPassword}
        importPassword={c.importPassword}
        setImportPassword={c.setImportPassword}
        importData={c.importData}
        setImportData={c.setImportData}
        importMode={c.importMode}
        setImportMode={c.setImportMode}
        isExporting={c.isExporting}
        setIsExporting={c.setIsExporting}
        isImporting={c.isImporting}
        setIsImporting={c.setIsImporting}
        onAccountsChanged={c.fetchAccounts}
      />

      <EmailAccountModal
        showAccountModal={c.showAccountModal}
        setShowAccountModal={c.setShowAccountModal}
        editingAccount={c.editingAccount}
        setEditingAccount={c.setEditingAccount}
        formEmail={c.formEmail}
        setFormEmail={c.setFormEmail}
        formPassword={c.formPassword}
        setFormPassword={c.setFormPassword}
        formImapHost={c.formImapHost}
        setFormImapHost={c.setFormImapHost}
        formImapPort={c.formImapPort}
        setFormImapPort={c.setFormImapPort}
        formImapSecurity={c.formImapSecurity}
        setFormImapSecurity={c.setFormImapSecurity}
        formSmtpHost={c.formSmtpHost}
        setFormSmtpHost={c.setFormSmtpHost}
        formSmtpPort={c.formSmtpPort}
        setFormSmtpPort={c.setFormSmtpPort}
        formSmtpSecurity={c.formSmtpSecurity}
        setFormSmtpSecurity={c.setFormSmtpSecurity}
        formDisplayName={c.formDisplayName}
        setFormDisplayName={c.setFormDisplayName}
        onSaved={c.fetchAccounts}
      />

      <Modal
        isOpen={c.showSendSuccessModal}
        onClose={() => c.setShowSendSuccessModal(false)}
        title={c.t("email.sendSuccessModalTitle")}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {c.t("email.sendSuccessModalDescription", { address: c.lastSendFromAddress || c.t("email.unknownSenderAddress") })}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => c.setShowSendSuccessModal(false)}>
              {c.t("common.close")}
            </Button>
            <Button onClick={() => void c.openLastSentMailbox()}>
              {c.t("email.viewSentMailbox")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
