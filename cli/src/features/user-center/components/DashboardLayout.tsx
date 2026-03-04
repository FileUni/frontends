import React, { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import * as LucideIcons from "lucide-react";
import { useAuthzStore } from "@/stores/authz.ts";
import { useConfigStore } from "@/stores/config.ts";
import { useThemeStore } from "@fileuni/shared";
import { useNavigationStore } from "@/stores/navigation.ts";
import { cn } from "@/lib/utils.ts";

import { MustChangePasswordModal } from "@/features/public/components/MustChangePasswordModal.tsx";

type LucideIconComponent = React.ComponentType<{ size?: number; className?: string }>;

/**
 * 辅助组件：安全渲染图标，防止混淆后的初始化顺序错误 (ReferenceError: L is not defined)
 */
const IconRenderer = ({ name, size = 18, className }: { name: string, size?: number, className?: string }) => {
  const iconRegistry = LucideIcons as unknown as Record<string, LucideIconComponent>;
  const Icon = iconRegistry[name];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
};

export const DashboardLayout: React.FC<{
  children: React.ReactNode;
  title?: string;
  pathname?: string;
  customSidebar?: React.ReactNode;
  fullWidth?: boolean;
}> = ({
  children,
  title,
  customSidebar,
  fullWidth = false,
}) => {
  const { t } = useTranslation();
  const { params } = useNavigationStore();
  const { hasPermission } = useAuthzStore();
  const { capabilities } = useConfigStore();
  const { theme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mod = params.mod || 'public';
  const page = params.page || 'index';
  const isAdmin = mounted && hasPermission("admin.access");
  const enableFileManager = capabilities?.enable_api !== false;

  // Use useMemo to ensure config objects are not initialized at module top level
  const { navItems, adminItems } = useMemo(() => ({
    navItems: [
      { name: t("nav.dashboard"), icon: "LayoutDashboard", m: "user", p: "welcome", path: "#mod=user&page=welcome" },
      { name: t("nav.profile"), icon: "User", m: "user", p: "profile", path: "#mod=user&page=profile" },
      { name: t("nav.security"), icon: "ShieldCheck", m: "user", p: "security", path: "#mod=user&page=security" },
      { name: t("nav.sessions"), icon: "Laptop", m: "user", p: "sessions", path: "#mod=user&page=sessions" },
    ],
    adminItems: [
      { name: t("nav.userList"), icon: "Users", m: "admin", p: "users", path: "#mod=admin&page=users" },
      { name: t("nav.maintenance"), icon: "HardDrive", m: "admin", p: "files", path: "#mod=admin&page=files" },
      { name: t("common.manage"), icon: "ShieldAlert", m: "admin", p: "permissions", path: "#mod=admin&page=permissions" },
      { name: t("admin.blacklist.title") || "Access Guard", icon: "ShieldAlert", m: "admin", p: "blacklist", path: "#mod=admin&page=blacklist" },
      { name: t("admin.backup.title") || "System Backup", icon: "Archive", m: "admin", p: "backup", path: "#mod=admin&page=backup" },
      { name: t("nav.domainDdns"), icon: "Globe", m: "admin", p: "domain-ddns", path: "#mod=admin&page=domain-ddns" },
      { name: t("nav.domainSsl"), icon: "ShieldCheck", m: "admin", p: "domain-ssl", path: "#mod=admin&page=domain-ssl" },
      { name: t("admin.web.title"), icon: "Server", m: "admin", p: "web", path: "#mod=admin&page=web" },
      { name: t("admin.tasks.title") || "Background Tasks", icon: "Activity", m: "admin", p: "tasks", path: "#mod=admin&page=tasks" },
      { name: t("admin.audit.title") || "Audit Logs", icon: "ClipboardList", m: "admin", p: "audit", path: "#mod=admin&page=audit" },
      { name: t("admin.extensions.title") || "Extensions", icon: "Puzzle", m: "admin", p: "extensions", path: "#mod=admin&page=extensions" },
      { name: t("nav.settings"), icon: "Settings", m: "admin", p: "config", path: "#mod=admin&page=config" },
    ]
  }), [t]);

  // Extract sidebar content as inner render function to ensure closure safety
  const renderSidebar = (isMobile = false) => (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {customSidebar && (
          <div className={cn("mb-8 pb-4 border-b", isDark ? "border-white/5" : "border-gray-200")}>
            {customSidebar}
          </div>
        )}

        <p className={cn("px-4 text-sm font-black uppercase tracking-widest opacity-30 mb-4", isDark ? "text-white" : "text-gray-900")}>
          {t("common.manage")}
        </p>
        
        {navItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              (mod === item.m && (item.p ? page === item.p : true))
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : cn("opacity-50 hover:opacity-100", isDark ? "hover:bg-white/5" : "hover:bg-gray-100"),
            )}
          >
            <IconRenderer name={item.icon} size={18} />
            <span className={isDark ? "text-white" : "text-gray-900"}>{item.name}</span>
          </a>
        ))}

        {enableFileManager && (
          <a
            href="#mod=file-manager"
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
              mod === "file-manager"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : cn("opacity-50 hover:opacity-100", isDark ? "hover:bg-white/5" : "hover:bg-gray-100"),
            )}
          >
            <IconRenderer name="FolderOpen" size={18} />
            <span className={isDark ? "text-white" : "text-gray-900"}>{t("nav.filemanager")}</span>
          </a>
        )}

        {isAdmin && (
          <div className={cn("mt-8 pt-4 border-t", isDark ? "border-white/5" : "border-gray-200")}>
            <p className="px-4 text-sm font-black uppercase tracking-widest opacity-30 mb-4 text-red-500">
              {t("common.admin")}
            </p>
            {adminItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={() => isMobile && setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                  (mod === item.m && (item.p ? page === item.p : true))
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : cn("opacity-50 hover:opacity-100", isDark ? "hover:bg-red-500/5 hover:text-red-400" : "hover:bg-red-50 hover:text-red-600"),
                )}
              >
                <IconRenderer name={item.icon} size={18} />
                <span className={isDark ? "text-white" : "text-gray-900"}>{item.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className={cn("mt-auto pt-4 border-t flex flex-wrap gap-x-4 gap-y-2 px-2 pb-2", isDark ? "border-white/5" : "border-gray-200")}>
        <a href="#mod=public&page=tos" className="text-sm font-black uppercase tracking-widest opacity-20 hover:opacity-100 hover:text-primary transition-all">{t("pages.tos.title")}</a>
        <a href="#mod=public&page=privacy" className="text-sm font-black uppercase tracking-widest opacity-20 hover:opacity-100 hover:text-primary transition-all">{t("pages.privacy.title")}</a>
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-screen bg-background flex flex-col", isDark ? "" : "bg-gray-50")}>
      {/* Mobile Top Bar */}
      <div className={cn("md:hidden fixed top-16 left-0 right-0 h-12 backdrop-blur-md border-b z-40 flex items-center px-4", isDark ? "bg-white/[0.03] border-white/5" : "bg-white border-gray-200")}>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn("p-2 -ml-2 rounded-lg text-primary", isDark ? "hover:bg-white/5" : "hover:bg-gray-100")}
        >
          {isMobileMenuOpen ? <IconRenderer name="X" size={20} /> : <IconRenderer name="Menu" size={20} />}
        </button>
        <span className={cn("ml-2 text-sm font-black uppercase tracking-widest opacity-50", isDark ? "text-white" : "text-gray-900")}>
          {title || t("nav.dashboard")}
        </span>
      </div>

      <div className="flex-1 flex pt-16 md:pt-16 h-full overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className={cn("hidden md:flex w-64 border-r flex-col p-4 shrink-0", isDark ? "border-white/5 bg-white/[0.02]" : "border-gray-200 bg-white")}>
          {renderSidebar(false)}
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        {/* Mobile Sidebar Drawer */}
        <aside
          className={cn(
            "md:hidden fixed top-0 left-0 bottom-0 w-72 border-r z-[60] p-4 transition-transform duration-300 ease-in-out",
            isDark ? "bg-zinc-950 border-white/10" : "bg-white border-gray-200",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <img src="/ui/favicon.svg" alt={t('common.logoAlt')} width={32} height={32} className="shadow-lg rounded-lg" />
              <span className={cn("font-black text-sm tracking-tight", isDark ? "text-white" : "text-gray-900")}>{t('common.brandName')}</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className={cn("p-2 rounded-lg", isDark ? "bg-white/5" : "bg-gray-100")}>
              <IconRenderer name="X" size={18} />
            </button>
          </div>
          {renderSidebar(true)}
        </aside>

        {/* Main Content */}
        <main className={cn("flex-1 overflow-y-auto mt-12 md:mt-0 custom-scrollbar", fullWidth ? "p-0" : "p-6 md:p-10")}>
          <div className={cn("w-full animate-in fade-in slide-in-from-bottom-2 duration-500", fullWidth ? "max-w-none h-full" : "max-w-none")}>
            {title && <h1 className="text-4xl font-black tracking-tight mb-8 hidden md:block">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
      <MustChangePasswordModal />
    </div>
  );
};
