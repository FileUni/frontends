import React, { Suspense, lazy, type ComponentType } from 'react';
import type { TFunction } from 'i18next';
import { useNavigationStore, type RouteParams } from '@/stores/navigation';
import { useAuthStore } from '@/stores/auth';
import { useAuthzStore } from '@/stores/authz';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/features/user-center/components/DashboardLayout';
import { FileSidebar } from '@/features/file-manager/components/FileSidebar';

// Dynamic import public components
const WelcomeView = lazy(() => import('@/features/public/components/WelcomeView').then(m => ({ default: m.WelcomeView })));
const LoginView = lazy(() => import('@/features/public/components/LoginView').then(m => ({ default: m.LoginView })));
const RegisterView = lazy(() => import('@/features/public/components/RegisterView').then(m => ({ default: m.RegisterView })));
const ForgotPasswordView = lazy(() => import('@/features/public/components/ForgotPasswordView').then(m => ({ default: m.ForgotPasswordView })));
const AccountsView = lazy(() => import('@/features/public/components/AccountsView').then(m => ({ default: m.AccountsView })));
const TosContent = lazy(() => import('@/features/public/components/TosContent').then(m => ({ default: m.TosContent })));
const PrivacyContent = lazy(() => import('@/features/public/components/PrivacyContent').then(m => ({ default: m.PrivacyContent })));

// Dynamic import user center components
const UserHomeView = lazy(() => import('@/features/user-center/components/UserHomeView').then(m => ({ default: m.UserHomeView })));
const ProfileView = lazy(() => import('@/features/user-center/components/ProfileView').then(m => ({ default: m.ProfileView })));
const SecurityView = lazy(() => import('@/features/user-center/components/SecurityView').then(m => ({ default: m.SecurityView })));
const SessionsView = lazy(() => import('@/features/user-center/components/SessionsView').then(m => ({ default: m.SessionsView })));
const CacheManagerView = lazy(() => import('@/features/user-center/components/CacheManagerView').then(m => ({ default: m.CacheManagerView })));

// Dynamic import file manager components
const FileManagerView = lazy(() => import('@/features/file-manager/components/FileManagerView').then(m => ({ default: m.FileManagerView })));
const PublicShareView = lazy(() => import('@/features/file-manager/components/PublicShareView').then(m => ({ default: m.PublicShareView })));
const MySharesView = lazy(() => import('@/features/file-manager/components/MySharesView').then(m => ({ default: m.MySharesView })));

// Dynamic import chat components
const ChatPage = lazy(() => import('@/features/chat/components/ChatPage').then(m => ({ default: m.ChatPage })));
const ChatGuestView = lazy(() => import('@/features/chat/components/ChatGuestView').then(m => ({ default: m.ChatGuestView })));

// Dynamic import admin components
const UserManagement = lazy(() => import('@/features/admin/components/UserManagement').then(m => ({ default: m.UserManagement })));
const AdminUserCreateView = lazy(() => import('@/features/admin/components/AdminUserCreateView').then(m => ({ default: m.AdminUserCreateView })));
const AdminUserEditView = lazy(() => import('@/features/admin/components/AdminUserEditView').then(m => ({ default: m.AdminUserEditView as ComponentType<{ userId?: string }> })));
const SystemConfigAdmin = lazy(() => import('@/features/admin/components/SystemConfigAdmin').then(m => ({ default: m.SystemConfigAdmin })));
const PermissionAdmin = lazy(() => import('@/features/admin/components/PermissionAdmin').then(m => ({ default: m.PermissionAdmin })));
const BlacklistAdmin = lazy(() => import('@/features/admin/components/BlacklistAdmin').then(m => ({ default: m.BlacklistAdmin })));
const FileSystemAdmin = lazy(() => import('@/features/admin/components/FileSystemAdmin').then(m => ({ default: m.FileSystemAdmin })));
const SystemBackupAdmin = lazy(() => import('@/features/admin/components/SystemBackupAdmin').then(m => ({ default: m.SystemBackupAdmin })));
const ExtensionManagerAdmin = lazy(() => import('@/features/admin/components/ExtensionManagerAdmin').then(m => ({ default: m.ExtensionManagerAdmin })));
const DomainAcmeDdnsAdmin = lazy(() =>
  import('@/features/admin/components/DomainAcmeDdnsAdmin').then(m => ({ default: m.DomainAcmeDdnsAdmin })),
);
const WebAdmin = lazy(() => import('@/features/admin/components/WebAdmin').then(m => ({ default: m.WebAdmin })));
const AuditLogAdmin = lazy(() => import('@/features/admin/components/AuditLogAdmin').then(m => ({ default: m.AuditLogAdmin })));
const TaskAdmin = lazy(() => import('@/features/admin/components/TaskAdmin').then(m => ({ default: m.TaskAdmin })));

/**
 * Route dispatcher
 */
export const AppRouter: React.FC = () => {
  const { params } = useNavigationStore();
  const { isLoggedIn } = useAuthStore();
  const { t } = useTranslation();
  const { hasPermission } = useAuthzStore();

  const mod = params.mod || 'public';
  const page = params.page || 'index';

  // Loading placeholder
  const fallback = (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  // Auth check
  const isPublicPage = mod === 'public' || (mod === 'file-manager' && page === 'share') || (mod === 'chat' && page === 'guest');
  if (!isLoggedIn && !isPublicPage) {
    return (
      <Suspense fallback={fallback}>
        <LoginView />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <PageRenderer mod={mod} page={page} params={params} t={t} hasPermission={hasPermission} />
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
  if (mod === 'public') {
    switch (page) {
      case 'index': return <WelcomeView />;
      case 'login': return <LoginView />;
      case 'register': return <RegisterView />;
      case 'forgot-password': return <ForgotPasswordView />;
      case 'accounts': return <AccountsView />;
      case 'tos': return <DashboardLayout title={t('pages.tos.title')}><TosContent /></DashboardLayout>;
      case 'privacy': return <DashboardLayout title={t('pages.privacy.title')}><PrivacyContent /></DashboardLayout>;
      default: return <WelcomeView />;
    }
  }

  // User Center module
  if (mod === 'user') {
    switch (page) {
      case 'welcome': return <DashboardLayout title={t('pages.user.welcome.title')}><UserHomeView /></DashboardLayout>;
      case 'profile': return <DashboardLayout title={t('pages.user.profile.title')}><ProfileView /></DashboardLayout>;
      case 'security': return <DashboardLayout title={t('pages.user.security.title')}><SecurityView /></DashboardLayout>;
      case 'sessions': return <DashboardLayout title={t('pages.user.sessions.title')}><SessionsView /></DashboardLayout>;
      case 'cache': return <DashboardLayout title={t('pages.user.cache.title')}><CacheManagerView /></DashboardLayout>;
      case 'accounts': return <AccountsView />;
      default: return <DashboardLayout title={t('pages.user.welcome.title')}><UserHomeView /></DashboardLayout>;
    }
  }

  // Admin module
  if (mod === 'admin') {
    if (!hasPermission("admin.access")) {
      return (
        <DashboardLayout title={t('common.admin')}>
          <div className="text-center py-20 text-red-500 font-bold">
            {t('errors.PERMISSION_DENIED')}
          </div>
        </DashboardLayout>
      );
    }
    switch (page) {
      case 'users': return <DashboardLayout title={t('pages.admin.users.title')}><UserManagement /></DashboardLayout>;
      case 'user-create': return <DashboardLayout title={t('pages.admin.userCreate.title')}><AdminUserCreateView /></DashboardLayout>;
      case 'user-edit': return <DashboardLayout title={t('pages.admin.userEdit.title')}><AdminUserEditView userId={params.id} /></DashboardLayout>;
      case 'config': return <DashboardLayout title={t('pages.admin.settings.title')}><SystemConfigAdmin /></DashboardLayout>;
      case 'permissions': return <DashboardLayout title={t('pages.admin.permissions.title')}><PermissionAdmin /></DashboardLayout>;
      case 'blacklist': return <DashboardLayout title={t('admin.blacklist.title') || 'Access Guard'}><BlacklistAdmin /></DashboardLayout>;
      case 'files':
      case 'fs': return <DashboardLayout title={t('pages.admin.fs.title')}><FileSystemAdmin /></DashboardLayout>;
      case 'backup': return <DashboardLayout title={t('admin.backup.title')}><SystemBackupAdmin /></DashboardLayout>;
      case 'domain-ddns': return <DashboardLayout title={t('nav.domainDdns')}><DomainAcmeDdnsAdmin view="ddns" /></DashboardLayout>;
      case 'domain-ssl': return <DashboardLayout title={t('nav.domainSsl')}><DomainAcmeDdnsAdmin view="ssl" /></DashboardLayout>;
      case 'web': return <DashboardLayout title={t('admin.web.title')}><WebAdmin /></DashboardLayout>;
      case 'audit': return <DashboardLayout title={t('admin.audit.title') || 'Audit Logs'}><AuditLogAdmin /></DashboardLayout>;
      case 'tasks': return <DashboardLayout title={t('admin.tasks.title') || 'Background Tasks'}><TaskAdmin /></DashboardLayout>;
      case 'extensions': return <DashboardLayout title={t('admin.extensions.title')}><ExtensionManagerAdmin /></DashboardLayout>;

      default: return <DashboardLayout title={t('pages.admin.users.title')}><UserManagement /></DashboardLayout>;
    }
  }

  // File Manager module
  if (mod === 'file-manager') {
    if (page === 'share') return <PublicShareView token={params.token || ''} />;
    
    const layoutTitle = page === 'shares' ? t('pages.user.shares.title') : t('pages.filemanager.title');
    
    return (
      <DashboardLayout title={layoutTitle} customSidebar={<FileSidebar />} fullWidth={true}>
        {page === 'shares' ? <MySharesView /> : <FileManagerView />}
      </DashboardLayout>
    );
  }

  // Chat module
  if (mod === 'chat') {
    if (page === 'guest') {
      return <ChatGuestView inviteCode={params.invite} />;
    }
    if (!hasPermission("feature.chat.use")) {
      return (
        <DashboardLayout title={t('chat.pageTitle')}>
          <div className="text-center py-20 text-red-500 font-bold">{t('errors.PERMISSION_DENIED')}</div>
        </DashboardLayout>
      );
    }
    return <DashboardLayout title={t('chat.pageTitle')}><ChatPage /></DashboardLayout>;
  }

  // Default to home
  return <WelcomeView />;
};
