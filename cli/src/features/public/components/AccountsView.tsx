import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.ts';
import { useThemeStore } from '@fileuni/shared';
import { AccountSelector } from './AccountSelector.tsx';
import { Users, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { useNavigationStore, type RouteParams } from '@/stores/navigation.ts';
import { cn } from '@/lib/utils.ts';

export const AccountsView = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { logout } = useAuthStore();
  const { params, navigate } = useNavigationStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const getRedirectParams = (): Partial<RouteParams> => {
    // Priority parse redirect param from Hash
    const redirect = params.redirect;
    if (!redirect) return { mod: 'user', page: 'welcome' };

    // If it's a full hash string, parse it
    if (redirect.includes('mod=')) {
      const p = new URLSearchParams(redirect.startsWith('#') ? redirect.substring(1) : redirect);
      const result: Partial<RouteParams> = {};
      p.forEach((v, k) => { result[k] = v; });
      return result;
    }
    return { mod: 'user', page: 'welcome' };
  };

  const handleSelect = (_userId: string) => {
    // Force wait a tick to ensure store switched
    setTimeout(() => {
      const destParams = getRedirectParams();
      navigate(destParams);
    }, 50);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden pt-16">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-300px] left-[-300px] w-[800px] h-[800px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-[480px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={cn(
          "backdrop-blur-xl border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all",
          isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="h-1.5 bg-gradient-to-r from-primary to-blue-600 opacity-80" />

          <div className="p-10 pt-12">
            <div className="flex items-center justify-between mb-10">
              <Button 
                variant="ghost" 
                className="p-2 h-10 w-10 rounded-xl"
                onClick={() => window.history.back()}
              >
                <ArrowLeft size={20} />
              </Button>
              <div className="text-center flex-1 pr-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-2">
                  <Users size={24} />
                </div>
                <h1 className={cn("text-2xl font-black tracking-tight", isDark ? "text-white" : "text-gray-900")}>{t('auth.manageAccounts')}</h1>
              </div>
            </div>

            <AccountSelector 
              showAddButton={true}
              onAddAccount={() => navigate({ mod: 'public', page: 'login' })}
              onSelect={handleSelect}
            />

            <div className={cn("mt-8 pt-6 border-t space-y-3", isDark ? "border-white/5" : "border-gray-100")}>
              <Button 
                variant="outline"
                className="w-full h-12 rounded-2xl border-red-500/20 text-red-500 hover:bg-red-500/10"
                onClick={() => { logout(); navigate({ mod: 'public', page: 'login' }); }}
              >
                <LogOut size={18} className="mr-2" /> {t('common.logout')}
              </Button>
              <p className="text-sm text-center opacity-30 font-bold uppercase tracking-widest px-6">
                {t('auth.manageAccountsDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
