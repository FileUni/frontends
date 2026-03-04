import React from "react";
import { useTranslation } from "react-i18next";
import { AppRouter } from "@/components/Router";
import { Navbar } from "@/features/public/components/Navbar.tsx";
import { ToastContainer } from "@/components/ui/Toast.tsx";
import { ToastI18nContext } from "@fileuni/shared";
import { GlobalAudioPlayer } from "@/features/file-manager/components";
import { ChatProvider, ChatErrorBoundary } from "@/hooks/ChatContext";
import { ChatUnifiedUI } from "@/components/chat/ChatUnifiedUI";
import { EmailUnifiedUI } from "@/components/email/EmailUnifiedUI";
import { useAuthStore } from "@/stores/auth";
import { useAuthzStore } from "@/stores/authz";
import { useConfigStore } from "@/stores/config";
import { MustChangePasswordModal } from "@/features/public/components/MustChangePasswordModal.tsx";

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();

  const toastI18n = React.useMemo(() => ({
    doNotShowAgain: t('common.doNotShowAgain'),
    viewDetails: t('common.viewDetails'),
    hideDetails: t('common.hideDetails'),
    copy: t('common.copy'),
  }), [t]);

  return (
    <ToastI18nContext.Provider value={toastI18n}>
      {children}
    </ToastI18nContext.Provider>
  );
};

/**
 * SPA Main Application Entry
 */
export const App: React.FC = () => {
  const { currentUserId, isLoggedIn } = useAuthStore();
  const { capabilities, fetchCapabilities } = useConfigStore();
  const { fetchEntitlements, clear: clearEntitlements, hasPermission } = useAuthzStore();
  const isSetupMode = capabilities?.is_config_set_mode === true;

  React.useEffect(() => {
    void fetchCapabilities();
  }, [fetchCapabilities]);

  const chatAuth = React.useMemo(() => {
    if (!currentUserId) return null;
    return { type: "system" as const, userId: currentUserId };
  }, [currentUserId]);

  const content = (
    <>
      {!isSetupMode && <Navbar />}
      <main className="flex-1 flex flex-col">
        <AppRouter />
      </main>
      {!isSetupMode && <GlobalAudioPlayer />}
      {!isSetupMode && <MustChangePasswordModal />}
    </>
  );

  React.useEffect(() => {
    if (!isLoggedIn) {
      clearEntitlements();
      return;
    }
    void fetchEntitlements();
  }, [isLoggedIn, currentUserId, fetchEntitlements, clearEntitlements]);

  const canUseChat = (capabilities?.enable_chat !== false) && hasPermission("feature.chat.use");
  const canUseEmail = (capabilities?.enable_email_manager !== false) && hasPermission("feature.email_manager.use");

  if (isSetupMode || !chatAuth) {
    return (
      <ToastProvider>
        {content}
        <ToastContainer />
      </ToastProvider>
    );
  }

  if (!canUseChat) {
    return (
      <ToastProvider>
        {content}
        {canUseEmail && <EmailUnifiedUI />}
        <ToastContainer />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ChatErrorBoundary fallback={content}>
        <ChatProvider auth={chatAuth}>
          {content}
          <ChatErrorBoundary>
            <ChatUnifiedUI />
          </ChatErrorBoundary>
          {canUseEmail && <EmailUnifiedUI />}
          <ToastContainer />
        </ChatProvider>
      </ChatErrorBoundary>
    </ToastProvider>
  );
};
