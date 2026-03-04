import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  Rocket,
  ShieldCheck,
  Zap,
  Cpu,
  RefreshCw,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { client } from "@/lib/api";
import { ConfigSetEditor } from "./ConfigSetEditor";
import { useAuthStore } from "@/stores/auth.ts";
import { useThemeStore } from "@fileuni/shared";
import { cn } from "@/lib/utils.ts";
import type { SystemCapabilities } from "@/stores/config.ts";


export const WelcomeView = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { isLoggedIn, usersMap, _hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const savedUsers = Object.values(usersMap);

  useEffect(() => {
    setMounted(true);
    checkCapabilities();
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const checkCapabilities = async () => {
    try {
      const { data } = await client.GET(
        "/api/v1/system/backend-capabilities-handshake",
      );
      if (data?.data) {
        const caps = data.data as unknown as SystemCapabilities;
        setSetupMode(!!caps.is_config_set_mode);
      }
    } catch (e) {
      console.error("Failed to fetch capabilities", e);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || loading || !_hasHydrated)
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-primary opacity-20" size={48} />
      </div>
    );

  if (setupMode) {
    return (
      <div className="min-h-screen bg-background px-2 py-2 sm:px-4 sm:py-4">
        <ConfigSetEditor />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] pt-16 overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl w-full px-6 py-12 text-center">
        <div className="inline-flex mb-8 transform rotate-3 hover:rotate-0 transition-transform duration-500">
          <img src="/ui/favicon.svg" alt={t('common.logoAlt')} width={80} height={80} className="shadow-2xl shadow-primary/20" />
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight">
          {t("welcome.title")}
        </h1>

        <p className="text-xl md:text-2xl opacity-70 mb-10 max-w-3xl mx-auto font-medium leading-relaxed italic">
          {t("welcome.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isLoggedIn ? (
            <>
              <a
                href="#mod=user&page=welcome"
                className="px-10 h-14 bg-primary text-white rounded-2xl font-black text-lg flex items-center gap-2 shadow-xl shadow-primary/30 hover:scale-105 transition-all"
              >
                <LayoutDashboard size={20} />
                {t("common.dashboard") || "Dashboard"}
              </a>
              <a
                href="#mod=user&page=accounts"
                className={cn(
                  "px-10 h-14 border rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all",
                  isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900 shadow-sm"
                )}
              >
                <Users size={20} />
                {t("auth.switchUser") || "Switch Account"}
              </a>
            </>
          ) : (
            <>
              <a
                href="#mod=public&page=login"
                className="px-10 h-14 bg-primary text-white rounded-2xl font-black text-lg flex items-center gap-2 shadow-xl shadow-primary/30 hover:scale-105 transition-all"
              >
                <Rocket size={20} />
                {t("welcome.getStarted")}
              </a>
              {savedUsers.length > 0 && (
                <a
                  href="#mod=user&page=accounts"
                  className={cn(
                    "px-10 h-14 border rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all",
                    isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900 shadow-sm"
                  )}
                >
                  <Users size={20} />
                  {t("auth.switchUser") || "Accounts"}
                </a>
              )}
              <a
                href="#mod=public&page=register"
                className={cn(
                  "px-10 h-14 border rounded-2xl font-black text-lg flex items-center justify-center transition-all",
                  isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-900 shadow-sm"
                )}
              >
                {t("common.register")}
              </a>
            </>
          )}
        </div>

        {/* Feature Badges */}
        <div className="mt-16 flex flex-wrap justify-center gap-6">
          <div className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all",
            isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200 shadow-sm"
          )}>
            <Zap className="text-yellow-500" size={18} />
            <span className={cn("text-sm font-black uppercase tracking-wider", isDark ? "text-white/80" : "text-gray-700")}>
              Blazing Fast
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all",
            isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200 shadow-sm"
          )}>
            <ShieldCheck className="text-green-500" size={18} />
            <span className={cn("text-sm font-black uppercase tracking-wider", isDark ? "text-white/80" : "text-gray-700")}>
              Secure Core
            </span>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all",
            isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200 shadow-sm"
          )}>
            <Cpu className="text-blue-500" size={18} />
            <span className={cn("text-sm font-black uppercase tracking-wider", isDark ? "text-white/80" : "text-gray-700")}>
              Modular
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
