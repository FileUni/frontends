import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useAuthStore } from "@/stores/auth.ts";
import { useAuthzStore } from "@/stores/authz.ts";
import { useConfigStore } from "@/stores/config.ts";
import { client, extractData } from "@/lib/api.ts";
import {
  Cpu,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  UserCircle,
  FolderOpen,
  Shield,
  Laptop,
  Database,
} from "lucide-react";
import type { components } from "@/types/api.ts";

type UserResponse = components["schemas"]["UserResponse"];

export const UserHomeView = () => {
  const { t } = useTranslation();
  const { currentUserData } = useAuthStore();
  const { hasPermission } = useAuthzStore();
  const { capabilities } = useConfigStore();
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!currentUserData) {
      setLoading(false);
      return;
    }
    const fetchMe = async () => {
      try {
        const data = await extractData<UserResponse>(client.GET("/api/v1/users/auth/me"));
        if (data) setUserData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [currentUserData]);

  const securityScore = React.useMemo(() => {
    if (!userData) return 0;
    let score = 0;
    if (userData.email_verified) score += 35;
    if (userData.phone_verified) score += 35;
    return score;
  }, [userData]);

  const createdDate = userData?.created_at
    ? new Date(userData.created_at).toLocaleDateString()
    : "...";
  const loginTime =
    mounted && currentUserData?.login_time
      ? new Date(currentUserData.login_time).toLocaleTimeString()
      : "...";

  const navGroups = [
    {
      title: t("common.manage"),
      items: [
        {
          name: t("nav.profile"),
          icon: UserCircle,
          path: "#mod=user&page=profile",
          desc: t("welcome.userCenter"),
        },
        // Check if file manager API is enabled
        ...(capabilities?.enable_api !== false
          ? [
              {
                name: t("nav.filemanager"),
                icon: FolderOpen,
                path: "#mod=file-manager",
                desc: t("welcome.fileManager"),
                primary: true,
              },
            ]
          : []),
        {
          name: t("nav.cacheManager"),
          icon: Database,
          path: "#mod=user&page=cache",
          desc: t("welcome.cacheManager"),
        },
      ],
    },
    {
      title: t("nav.security"),
      items: [
        {
          name: t("nav.security"),
          icon: Shield,
          path: "#mod=user&page=security",
          desc: t("nav.security"),
        },
        {
          name: t("nav.changePassword"),
          icon: ShieldCheck,
          path: "#mod=user&page=security",
          desc: t("security.passwordDesc") || "Update your security credentials",
        },
        {
          name: t("nav.sessions"),
          icon: Laptop,
          path: "#mod=user&page=sessions",
          desc: t("nav.sessions"),
        },
      ],
    },
  ];

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="loading-spinner w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-10">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary to-blue-700 p-8 md:p-12 shadow-2xl text-white">
        <Cpu className="absolute -top-10 -right-10 w-64 h-64 opacity-10 rotate-12" />

        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-4xl font-black border border-white/20 shadow-inner">
            {mounted && currentUserData?.user.username
              ? currentUserData.user.username[0].toUpperCase()
              : "?"}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-4xl font-black tracking-tight">
                {t("welcome.title")}
                {mounted && currentUserData?.user.username
                  ? `, ${currentUserData.user.username}`
                  : ""}
                !
              </h2>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm font-bold uppercase tracking-widest">
                {mounted && hasPermission("admin.access")
                  ? t("common.admin")
                  : t("auth.selectUserTitle")}
              </span>
            </div>
            <p className="mt-2 text-lg opacity-80 font-medium italic">
              {t("welcome.subtitle")}
            </p>

            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} />
                <span className="font-bold">{t("nav.security")}:</span>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${securityScore < 70 ? "bg-orange-400" : "bg-green-400"}`}
                    style={{ width: `${securityScore}%` }}
                  />
                </div>
                <span className="font-black">{securityScore}%</span>
              </div>
              <div className="flex items-center gap-2 opacity-60 font-bold">
                <Calendar size={16} /> {createdDate}
              </div>
              <div className="flex items-center gap-2 opacity-60 font-bold">
                <Clock size={16} /> {loginTime}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-30 ml-4">
              {group.title}
            </h3>
            <div className="space-y-4">
              {group.items.map((item) => (
                <a
                  key={item.name}
                  href={item.path}
                  className="group block p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.06] hover:border-primary/30 transition-all hover:scale-[1.01] hover:shadow-xl shadow-primary/5"
                >
                  <div className="flex items-center gap-6">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors ${item.primary ? "bg-primary text-white" : "bg-white/5 group-hover:bg-primary group-hover:text-white"}`}
                    >
                      <item.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold">{item.name}</h4>
                      <p className="text-sm opacity-50 mt-1 font-medium">
                        {item.desc}
                      </p>
                    </div>
                    <ChevronRight
                      className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                      size={20}
                    />
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
