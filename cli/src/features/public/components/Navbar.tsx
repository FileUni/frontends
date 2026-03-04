import React, { useMemo, useState, useEffect } from 'react';
import { useThemeStore, type Theme } from '@fileuni/shared';
import { useLanguageStore, type Language } from '@fileuni/shared';
import { useAuthStore } from '@/stores/auth.ts';
import { useAuthzStore } from '@/stores/authz.ts';
import { useConfigStore } from '@/stores/config.ts';
import { useNavigationStore } from '@/stores/navigation.ts';
import { useTranslation } from 'react-i18next';
import i18next from '@/lib/i18n.ts';
import { storageHub } from '@fileuni/shared';
import { 
  Sun, Moon, Laptop, LayoutDashboard, FolderOpen, 
  ShieldAlert, LogIn, UserPlus, Home, Menu, X, LogOut,
  Users, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { StatusIndicator } from './StatusIndicator.tsx';
import { useChat } from '@/hooks/ChatContext.tsx';


export const Navbar = () => {
  const { theme, setTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { currentUserData, isLoggedIn, logout } = useAuthStore();
  const { hasPermission } = useAuthzStore();
  const { capabilities, fetchCapabilities } = useConfigStore();
  const { t } = useTranslation();
  
  // Safe useChat for cases where provider might not be initialized yet
  let setChatOpen: ((open: boolean) => void) | null = null;
  let isChatActive = false;
  try {
    const chat = useChat();
    setChatOpen = chat.setIsOpen;
    isChatActive = chat.isOpen;
  } catch {}

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { params } = useNavigationStore();
  const base = '#';

  useEffect(() => {
    setMounted(true);
    fetchCapabilities();
    const savedLang = storageHub.getLocalItem('fileuni-language-raw') || 'zh';
    i18next.changeLanguage(savedLang);
  }, []);

  const mod = params.mod || 'public';
  const page = params.page || 'index';
  const canAccessAdmin = hasPermission("admin.access");
  const canUseChat = hasPermission("feature.chat.use") && capabilities?.enable_chat !== false;
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const navItems = useMemo(() => {
    if (capabilities?.is_config_set_mode) return []; // Config-set mode: hide nav links

    const items = [];
    items.push({ name: t('nav.backToPublic'), icon: Home, path: `${base}mod=public&page=index`, active: mod === 'public' && page === 'index' });

    if (!isLoggedIn) {
      items.push({ name: t('common.login'), icon: LogIn, path: `${base}mod=public&page=login`, active: mod === 'public' && page === 'login' });
      if (capabilities?.enable_registration !== false) {
        items.push({ name: t('common.register'), icon: UserPlus, path: `${base}mod=public&page=register`, active: mod === 'public' && page === 'register' });
      }
    } else {
      items.push({ name: t('nav.dashboard'), icon: LayoutDashboard, path: `${base}mod=user&page=welcome`, active: mod === 'user' });
      //  检查是否启用文件管理 API / Check if file manager API is enabled
      if (capabilities?.enable_api !== false) {
        items.push({ name: t('nav.filemanager'), icon: FolderOpen, path: `${base}mod=file-manager`, active: mod === 'file-manager' });
      }
      if (canAccessAdmin) {
        items.push({
          name: t('nav.adminPanel'),
          icon: ShieldAlert,
          path: `${base}mod=admin`,
          active: mod === 'admin',
          className: "text-red-500"
        });
      }
      
      // 添加统一聊天入口 / Add unified chat entry
      if (setChatOpen && canUseChat) {
        items.push({
          name: t('chat.title', { defaultValue: 'Chat' }),
          icon: MessageSquare,
          onClick: () => { setChatOpen(true); setIsMenuOpen(false); },
          active: isChatActive
        });
      }
    }
    return items;
  }, [isLoggedIn, canAccessAdmin, canUseChat, mod, page, t, mounted, capabilities, setChatOpen, isChatActive]);

  if (!mounted) return null;

  const handleLogout = () => {
    logout();
    window.location.hash = `mod=public&page=login`;
  };

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 h-16 border-b backdrop-blur-md z-[100] flex items-center justify-between px-4 md:px-8",
        isDark ? "border-white/5 bg-zinc-950/80" : "border-gray-200 bg-white/80"
      )}>
        {/* Brand */}
        <a href={`${base}mod=public&page=index`} className="flex items-center gap-3 group shrink-0">
          <img src="/ui/favicon.svg" alt={t('common.logoAlt')} width={36} height={36} className="shadow-lg rounded-xl" />
          <span className={cn("font-black text-lg tracking-tight hidden sm:block", isDark ? "text-white" : "text-gray-900")}>{t('common.brandName')}</span>
        </a>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
              <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-sm">
                {currentUserData?.user.username[0].toUpperCase()}
              </div>
              <span className="text-sm font-black opacity-70">{currentUserData?.user.username}</span>
            </div>
          )}
          
          {isLoggedIn && <StatusIndicator isDark={isDark} />}
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "p-2 rounded-xl text-primary border transition-all",
              isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-gray-100 border-gray-200 hover:bg-gray-200"
            )}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Unified Dropdown Menu */}
      {isMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-[100]"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className={cn(
            "fixed top-16 right-0 z-[110] w-full md:w-80 h-[calc(100vh-4rem)] overflow-y-auto animate-in slide-in-from-right-2 duration-200 shadow-2xl border-l",
            isDark ? "bg-zinc-950 border-white/5" : "bg-white border-gray-100"
          )}>
            <div className="p-6 space-y-8">
              {/* Active User (Top) */}
              {isLoggedIn && (
                <div className="flex items-center gap-4 p-4 rounded-[2rem] bg-primary/10 border border-primary/20 relative group">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-primary/20 shrink-0">
                    {currentUserData?.user.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-lg truncate leading-tight">{currentUserData?.user.username}</p>
                    <p className="text-sm font-black uppercase opacity-40 tracking-widest">{t('nav.activeWorkspace')}</p>
                  </div>
                  
                  <div className="divider divider-horizontal mx-0 h-8 border-primary/20" />
                  
                  <a 
                    href={`#mod=user&page=accounts&redirect=${encodeURIComponent(window.location.hash)}`}
                    className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-inner"
                    title={t('auth.switchUser')}
                  >
                    <Users size={16} />
                  </a>
                </div>
              )}

              {/* Navigation Items */}
              <div>
                <p className={cn("text-sm font-black uppercase tracking-[0.2em] opacity-30 mb-4 px-2")}>{t('common.menu')}</p>
                <div className="space-y-1">
                  {navItems.map(item => {
                    const content = (
                      <>
                        <item.icon size={18} />
                        {item.name}
                      </>
                    );
                    const commonClass = cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-black transition-all w-full text-left",
                      item.active 
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : cn("opacity-60 hover:opacity-100", isDark ? "hover:bg-white/5" : "hover:bg-gray-100"),
                      item.className
                    );

                    if (item.onClick) {
                      return (
                        <button key={item.name} onClick={item.onClick} className={commonClass}>
                          {content}
                        </button>
                      );
                    }

                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        className={commonClass}
                      >
                        {content}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* System Actions */}
              <div className="space-y-6">
                <div>
                  <p className={cn("text-sm font-black uppercase tracking-[0.2em] opacity-30 mb-4 px-2")}>{t('common.language')}</p>
                  <div className="grid grid-cols-3 gap-2 p-1">
                    {(['auto', 'zh', 'en'] as Language[]).map((lang) => (
                      <button 
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-sm font-black transition-all flex flex-col items-center gap-1",
                          language === lang 
                            ? "bg-primary text-white shadow-md shadow-primary/20" 
                            : cn("opacity-40 hover:opacity-100", isDark ? "hover:bg-white/5" : "hover:bg-gray-100")
                        )}
                      >
                        {lang === 'auto' && <Laptop size={18} />}
                        <span>{t(`languages.${lang}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={cn("text-sm font-black uppercase tracking-[0.2em] opacity-30 mb-4 px-2")}>{t('common.theme')}</p>
                  <div className="grid grid-cols-3 gap-2 p-1">
                    {([
                      { id: 'system', icon: Laptop },
                      { id: 'light', icon: Sun },
                      { id: 'dark', icon: Moon }
                    ] as { id: Theme, icon: React.ElementType }[]).map((mode) => (
                      <button 
                        key={mode.id}
                        onClick={() => setTheme(mode.id)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl text-sm font-black transition-all flex flex-col items-center gap-1",
                          theme === mode.id 
                            ? "bg-primary text-white shadow-md shadow-primary/20" 
                            : cn("opacity-40 hover:opacity-100", isDark ? "hover:bg-white/5" : "hover:bg-gray-100")
                        )}
                      >
                        <mode.icon size={18} />
                        <span>{t(`themes.${mode.id}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              {isLoggedIn && (
                <div className="pt-4">
                  <button 
                    onClick={handleLogout}
                    className={cn(
                      "w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl text-sm font-black transition-all border shadow-sm",
                      isDark 
                        ? "text-red-500 border-red-500/20 hover:bg-red-500/10" 
                        : "text-red-600 border-red-200 bg-red-50/50 hover:bg-red-50"
                    )}
                  >
                    <LogOut size={18} />
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
