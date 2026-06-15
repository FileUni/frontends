import React, { Suspense, lazy, type ComponentType } from "react";
import type { TFunction } from "i18next";
import { useNavigationStore, type RouteParams } from "@/stores/navigation";
import { useAuthStore } from "@/stores/auth";
import { useAuthzStore } from "@/stores/authz";
import { useTranslation } from "react-i18next";
import { renderNextcloudPublicPage } from "./nextcloud-routes";
import { DashboardLayout } from "@/components/user-center/components/DashboardLayout";
import { FileSidebar } from "@/components/file-manager/components/FileSidebar";
import { PluginEmbeddedView } from '@/components/plugin/PluginEmbeddedView';
const ChatBuiltInApp = lazy(() =>
  import('@/components/chat-built-in/ChatBuiltInApp').then((m) => ({
    default: m.ChatBuiltInApp,
  }))
);

// Dynamic import public components
const WelcomeView = lazy(() =>
  import("@/components/public/components/WelcomeView").then((m) => ({
    default: m.WelcomeView,
  })),
);
const LoginView = lazy(() =>
  import("@/components/public/components/LoginView").then((m) => ({
    default: m.LoginView,
  })),
);
const RegisterView = lazy(() =>
  import("@/components/public/components/RegisterView").then((m) => ({
    default: m.RegisterView,
  })),
);
const ForgotPasswordView = lazy(() =>
  import("@/components/public/components/ForgotPasswordView").then((m) => ({
    default: m.ForgotPasswordView,
  })),
);
const AccountsView = lazy(() =>
  import("@/components/public/components/AccountsView").then((m) => ({
    default: m.AccountsView,
  })),
);
const TosContent = lazy(() =>
  import("@/components/public/components/TosContent").then((m) => ({
    default: m.TosContent,
  })),
);
const PrivacyContent = lazy(() =>
  import("@/components/public/components/PrivacyContent").then((m) => ({
    default: m.PrivacyContent,
  })),
);

// Dynamic import user center components
const UserHomeView = lazy(() =>
  import("@/components/user-center/components/UserHomeView").then((m) => ({
    default: m.UserHomeView,
  })),
);
const ProfileView = lazy(() =>
  import("@/components/user-center/components/ProfileView").then((m) => ({
    default: m.ProfileView,
  })),
);
const SecurityView = lazy(() =>
  import("@/components/user-center/components/SecurityView").then((m) => ({
    default: m.SecurityView,
  })),
);
const SessionsView = lazy(() =>
  import("@/components/user-center/components/SessionsView").then((m) => ({
    default: m.SessionsView,
  })),
);
const CacheManagerView = lazy(() =>
  import("@/components/user-center/components/CacheManagerView").then((m) => ({
    default: m.CacheManagerView,
  })),
);

// Dynamic import file manager components
const FileManagerView = lazy(() =>
  import("@/components/file-manager/components/FileManagerView").then((m) => ({
    default: m.FileManagerView,
  })),
);
const PublicShareView = lazy(() =>
  import("@/components/file-manager/components/PublicShareView").then((m) => ({
    default: m.PublicShareView,
  })),
);
const MySharesView = lazy(() =>
  import("@/components/file-manager/components/MySharesView").then((m) => ({
    default: m.MySharesView,
  })),
);

// Dynamic import admin components
const UserManagement = lazy(() =>
  import("@/components/admin/components/UserManagement").then((m) => ({
    default: m.UserManagement,
  })),
);
const AdminUserCreateView = lazy(() =>
  import("@/components/admin/components/AdminUserCreateView").then((m) => ({
    default: m.AdminUserCreateView,
  })),
);
const AdminUserEditView = lazy(() =>
  import("@/components/admin/components/AdminUserEditView").then((m) => ({
    default: m.AdminUserEditView as ComponentType<{ userId?: string }>,
  })),
);
const SystemConfigAdmin = lazy(() =>
  import("@/components/admin/components/SystemConfigAdmin").then((m) => ({
    default: m.SystemConfigAdmin,
  })),
);
const PermissionAdmin = lazy(() =>
  import("@/components/admin/components/PermissionAdmin").then((m) => ({
    default: m.PermissionAdmin,
  })),
);
const BlacklistAdmin = lazy(() =>
  import("@/components/admin/components/BlacklistAdmin").then((m) => ({
    default: m.BlacklistAdmin,
  })),
);
const FileSystemAdmin = lazy(() =>
  import("@/components/admin/components/FileSystemAdmin").then((m) => ({
    default: m.FileSystemAdmin,
  })),
);
const RemoteMountAdmin = lazy(() =>
  import("@/components/admin/components/RemoteMountAdmin").then((m) => ({
    default: m.RemoteMountAdmin,
  })),
);
const SystemBackupAdmin = lazy(() =>
  import("@/components/admin/components/SystemBackupAdmin").then((m) => ({
    default: m.SystemBackupAdmin,
  })),
);
const AdminAboutPage = lazy(() =>
  import("@/components/admin/components/AdminAboutPage").then((m) => ({
    default: m.AdminAboutPage,
  })),
);
const ExternalizeNetAutomationAdmin = lazy(() =>
  import("@/components/admin/components/ExternalizeNetAutomationAdmin").then((m) => ({
    default: m.ExternalizeNetAutomationAdmin,
  })),
);
const WebAdmin = lazy(() =>
  import("@/components/admin/components/WebAdmin").then((m) => ({
    default: m.WebAdmin,
  })),
);
const AuditLogAdmin = lazy(() =>
  import("@/components/admin/components/AuditLogAdmin").then((m) => ({
    default: m.AuditLogAdmin,
  })),
);
const PluginAdmin = lazy(() =>
  import("@/components/admin/components/PluginAdmin").then((m) => ({
    default: m.PluginAdmin,
  })),
);
const TaskAdmin = lazy(() =>
  import("@/components/admin/components/TaskAdmin").then((m) => ({
    default: m.TaskAdmin,
  })),
);

/**
 * Route dispatcher
 */
export const AppRouter: React.FC = () => {
  const { params } = useNavigationStore();
  const { isLoggedIn } = useAuthStore();
  const { t } = useTranslation();
  const { hasPermission } = useAuthzStore();

  const mod = params.mod || "public";
  const page = params.page || "index";

  // Loading placeholder
  const fallback = (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  // Auth check
  const isPublicPage =
    mod === "public" ||
    mod === "chat-built-in" ||
    (mod === "file-manager" && page === "share");
  if (!isLoggedIn && !isPublicPage) {
    return (
      <Suspense fallback={fallback}>
        <LoginView />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <PageRenderer
        mod={mod}
        page={page}
        params={params}
        t={t}
        hasPermission={hasPermission}
      />
    </Suspense>
  );
};

/**
 * Internal Page Renderer component
 */
const PageRenderer: React.FC<{
  mod: string;
  page: string;
  params: RouteParams;
  t: TFunction;
  hasPermission: (permissionKey: string) => boolean;
}> = ({ mod, page, params, t, hasPermission }) => {
  // Public module
  if (mod === "public") {
    const nextcloudPage = renderNextcloudPublicPage(page);
    if (nextcloudPage) return nextcloudPage;
    switch (page) {
      case "index":
        return <WelcomeView />;
      case "login":
        return <LoginView />;
      case "register":
        return <RegisterView />;
      case "forgot-password":
        return <ForgotPasswordView />;
      case "accounts":
        return <AccountsView />;
      case "tos":
        return <TosContent />;
      case "privacy":
        return <PrivacyContent />;
      default:
        return <WelcomeView />;
    }
  }

  // User Center module
  if (mod === "user") {
    switch (page) {
      case "welcome":
        return (
          <DashboardLayout title={t("pages.user.welcome.title")}>
            <UserHomeView />
          </DashboardLayout>
        );
      case "profile":
        return (
          <DashboardLayout title={t("pages.user.profile.title")}>
            <ProfileView />
          </DashboardLayout>
        );
      case "security":
        return (
          <DashboardLayout title={t("pages.user.security.title")}>
            <SecurityView />
          </DashboardLayout>
        );
      case "sessions":
        return (
          <DashboardLayout title={t("pages.user.sessions.title")}>
            <SessionsView />
          </DashboardLayout>
        );
      case "cache":
        return (
          <DashboardLayout title={t("pages.user.cache.title")}>
            <CacheManagerView />
          </DashboardLayout>
        );
      case "accounts":
        return <AccountsView />;
      default:
        return (
          <DashboardLayout title={t("pages.user.welcome.title")}>
            <UserHomeView />
          </DashboardLayout>
        );
    }
  }

  // Admin module
  if (mod === "admin") {
    if (!hasPermission("admin.access")) {
      return (
        <DashboardLayout title={t("common.admin")}>
          <div className="text-center py-20 text-red-500 font-bold">
            {t("errors.PERMISSION_DENIED")}
          </div>
        </DashboardLayout>
      );
    }
    switch (page) {
      case "users":
        return (
          <DashboardLayout title={t("pages.admin.users.title")}>
            <UserManagement />
          </DashboardLayout>
        );
      case "user-create":
        return (
          <DashboardLayout title={t("pages.admin.userCreate.title")}>
            <AdminUserCreateView />
          </DashboardLayout>
        );
      case "user-edit":
        return (
          <DashboardLayout title={t("pages.admin.userEdit.title")}>
            <AdminUserEditView {...(params['id'] ? { userId: params['id'] } : {})} />
          </DashboardLayout>
        );
      case "config":
        return (
          <DashboardLayout title={t("pages.admin.settings.title")}>
            <SystemConfigAdmin />
          </DashboardLayout>
        );
      case "permissions":
        return (
          <DashboardLayout title={t("pages.admin.permissions.title")}>
            <PermissionAdmin />
          </DashboardLayout>
        );
      case "blacklist":
        return (
          <DashboardLayout title={t("admin.blacklist.title") || "Access Guard"}>
            <BlacklistAdmin />
          </DashboardLayout>
        );
      case "about":
      case "AdminAboutPage":
        return (
          <DashboardLayout title={t("about.title")}>
            <AdminAboutPage />
          </DashboardLayout>
        );
      case "files":
      case "fs":
        return (
          <DashboardLayout title={t("pages.admin.fs.title")}>
            <FileSystemAdmin />
          </DashboardLayout>
        );
      case "mounts":
        return (
          <DashboardLayout title={t('admin.mounts.title') || 'Remote Mounts'}>
            <RemoteMountAdmin />
          </DashboardLayout>
        );
      case "backup":
        return (
          <DashboardLayout title={t("admin.backup.title")}>
            <SystemBackupAdmin />
          </DashboardLayout>
        );
      case "domain-ddns":
        return (
          <DashboardLayout title={t("nav.domainDdns")}>
            <ExternalizeNetAutomationAdmin view="ddns" />
          </DashboardLayout>
        );
      case "domain-ssl":
        return (
          <DashboardLayout title={t("nav.domainSsl")}>
            <ExternalizeNetAutomationAdmin view="ssl" />
          </DashboardLayout>
        );
      case "web":
        return (
          <DashboardLayout title={t("admin.web.title")}>
            <WebAdmin />
          </DashboardLayout>
        );
      case "audit":
        return (
          <DashboardLayout title={t("admin.audit.title") || "Audit Logs"}>
            <AuditLogAdmin />
          </DashboardLayout>
        );
      case "tasks":
        return (
          <DashboardLayout title={t("admin.tasks.title") || "Background Tasks"}>
            <TaskAdmin />
          </DashboardLayout>
        );
      case "plugins":
        return (
          <DashboardLayout title={t('common.plugins', { defaultValue: 'Plugins' })}>
            <PluginAdmin />
          </DashboardLayout>
        );

      default:
        return (
          <DashboardLayout title={t("pages.admin.users.title")}>
            <UserManagement />
          </DashboardLayout>
        );
    }
  }

  // File Manager module
  if (mod === "file-manager") {
    if (page === "share") return <PublicShareView token={params['token'] || ""} />;

    const layoutTitle =
      page === "shares"
        ? t("pages.user.shares.title")
        : undefined;

    return (
      <DashboardLayout
        {...(layoutTitle ? { title: layoutTitle } : {})}
        customSidebar={<FileSidebar />}
        fullWidth={true}
      >
        {page === "shares" ? <MySharesView /> : <FileManagerView />}
      </DashboardLayout>
    );
  }

  if (mod === 'plugin') {
    return (
      <DashboardLayout title={t('common.manage')}>
        <PluginEmbeddedView />
      </DashboardLayout>
    );
  }

  // Chat built-in (Matrix + Telegram, standalone, no auth required)
  if (mod === 'chat-built-in') {
    return <ChatBuiltInApp />;
  }

  // Default to home
  return <WelcomeView />;
};
