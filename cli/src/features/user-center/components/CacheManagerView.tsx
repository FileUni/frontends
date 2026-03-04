import React, { useEffect, useState } from "react";
import { Database, Eraser, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button.tsx";
import { cacheManager, type CacheScanSummary, type CacheScope, type ManagedCategoryId } from "@/lib/cacheManager.ts";
import { useAuthStore } from "@/stores/auth.ts";
import { toast } from "@fileuni/shared";

const CATEGORY_ORDER: ManagedCategoryId[] = [
  "email_address_book",
  "chat_cache",
  "file_manager_cache",
  "user_session_cache",
  "extension_cache",
  "ui_preferences_cache",
];

export const CacheManagerView: React.FC = () => {
  const { t } = useTranslation();
  const { currentUserData } = useAuthStore();
  const currentUserId = currentUserData?.user.id || "guest";
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [summary, setSummary] = useState<CacheScanSummary>({
    local_total_keys: 0,
    local_total_bytes: 0,
    managed_total_keys: 0,
    managed_total_bytes: 0,
    categories: CATEGORY_ORDER.map((id) => ({
      id,
      key_count: 0,
      bytes: 0,
      supports_own_user: id !== "ui_preferences_cache",
      supports_all_users: true,
    })),
  });

  useEffect(() => {
    let mounted = true;
    void cacheManager.scan(currentUserId).then((nextSummary) => {
      if (mounted) {
        setSummary(nextSummary);
      }
    });
    return () => {
      mounted = false;
    };
  }, [currentUserId, refreshVersion]);

  const handleRefresh = () => {
    setRefreshVersion((value) => value + 1);
  };

  const handleClear = async (categoryId: ManagedCategoryId, scope: CacheScope) => {
    const scopeLabel = scope === "all" ? t("cacheManager.scopeAllUsers") : t("cacheManager.scopeCurrentUser");
    const confirmText = t("cacheManager.confirmClearCategory", {
      category: t(`cacheManager.categories.${categoryId}.title`),
      scope: scopeLabel,
    });
    if (!window.confirm(confirmText)) {
      return;
    }

    setLoadingAction(`${categoryId}:${scope}`);
    try {
      const result = await cacheManager.clearCategory(categoryId, scope, currentUserId);
      toast.success(
        t("cacheManager.clearSuccess", {
          removed: result.removed_keys,
          size: cacheManager.formatBytes(result.freed_bytes),
        }),
      );
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("cacheManager.clearFailed");
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <Database size={20} className="text-primary" />
              {t("cacheManager.title")}
            </h3>
            <p className="text-base opacity-75 mt-1 leading-relaxed">{t("cacheManager.subtitle")}</p>
          </div>
          <Button variant="outline" className="gap-2 w-full sm:w-auto h-11 text-base" onClick={handleRefresh}>
            <RefreshCw size={18} />
            {t("common.refresh")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl border border-white/10 p-4 bg-background/40">
            <div className="text-sm uppercase tracking-widest opacity-55">{t("cacheManager.managedCacheSize")}</div>
            <div className="text-2xl font-black mt-1">{cacheManager.formatBytes(summary.managed_total_bytes)}</div>
            <div className="text-sm opacity-70 mt-1">{t("cacheManager.managedKeys", { count: summary.managed_total_keys })}</div>
          </div>
          <div className="rounded-2xl border border-white/10 p-4 bg-background/40">
            <div className="text-sm uppercase tracking-widest opacity-55">{t("cacheManager.totalLocalStorage")}</div>
            <div className="text-2xl font-black mt-1">{cacheManager.formatBytes(summary.local_total_bytes)}</div>
            <div className="text-sm opacity-70 mt-1">{t("cacheManager.localKeys", { count: summary.local_total_keys })}</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400 flex items-start gap-2 leading-relaxed">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <span>{t("cacheManager.warningText")}</span>
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORY_ORDER.map((categoryId) => {
          const category = summary.categories.find((item) => item.id === categoryId);
          if (!category) {
            return null;
          }
          const isClearingOwn = loadingAction === `${categoryId}:own`;
          const isClearingAll = loadingAction === `${categoryId}:all`;
          return (
            <div key={categoryId} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-bold">{t(`cacheManager.categories.${categoryId}.title`)}</div>
                  <div className="text-base opacity-70 mt-1 break-words leading-relaxed">{t(`cacheManager.categories.${categoryId}.desc`)}</div>
                  <div className="mt-2 text-base opacity-80">
                    {t("cacheManager.categoryStats", {
                      size: cacheManager.formatBytes(category.bytes),
                      count: category.key_count,
                    })}
                  </div>
                </div>
                <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {category.supports_own_user && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full sm:w-auto whitespace-normal leading-tight min-h-11 text-base"
                      onClick={() => void handleClear(categoryId, "own")}
                      disabled={isClearingOwn || isClearingAll}
                    >
                      <Eraser size={18} />
                      {isClearingOwn ? t("common.loading") : t("cacheManager.clearCurrentUser")}
                    </Button>
                  )}
                  {category.supports_all_users && (
                    <Button
                      variant={category.supports_own_user ? "ghost" : "outline"}
                      size="sm"
                      className={category.supports_own_user ? "gap-2 text-base opacity-80 hover:opacity-100 w-full sm:w-auto whitespace-normal leading-tight min-h-11" : "gap-2 w-full sm:w-auto whitespace-normal leading-tight min-h-11 text-base"}
                      onClick={() => void handleClear(categoryId, "all")}
                      disabled={isClearingOwn || isClearingAll}
                    >
                      <Trash2 size={18} />
                      {isClearingAll ? t("common.loading") : t("cacheManager.clearAllUsers")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
