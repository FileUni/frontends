import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useToastStore } from "@fileuni/shared";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Shield, Save, RefreshCw } from "lucide-react";
import { fetchRolesAndPermissions, updateRolePermissions, type PermissionCatalogItem, type RolePermissionView } from "./roleApi";

const bytesToText = (value: number): string => {
  if (value <= 0) {
    return "Unlimited";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(2)} ${units[index]}`;
};

export const PermissionAdmin = () => {
  const { t, i18n } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RolePermissionView[]>([]);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [draftQuota, setDraftQuota] = useState<string>("0");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchRolesAndPermissions();
      setRoles(data.roles);
      setPermissions(data.permissions);
      const fallbackRoleId = data.roles[0]?.role_id ?? null;
      setActiveRoleId((prev) => prev ?? fallbackRoleId);
    } catch (error) {
      console.error(error);
      addToast(t("admin.users.fetchError"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const activeRole = useMemo(() => roles.find((role) => role.role_id === activeRoleId) ?? null, [roles, activeRoleId]);

  useEffect(() => {
    if (!activeRole) {
      setDraftPermissions([]);
      setDraftQuota("0");
      return;
    }
    setDraftPermissions([...activeRole.permission_keys]);
    setDraftQuota(String(activeRole.default_storage_quota));
  }, [activeRole]);

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const permission of permissions) {
      const group = map.get(permission.module_key) ?? [];
      group.push(permission);
      map.set(permission.module_key, group);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [permissions]);

  const togglePermission = (permKey: string) => {
    setDraftPermissions((prev) => (prev.includes(permKey) ? prev.filter((item) => item !== permKey) : [...prev, permKey]));
  };

  const handleSave = async () => {
    if (!activeRole) {
      return;
    }
    const parsedQuota = Number(draftQuota);
    if (!Number.isFinite(parsedQuota) || parsedQuota < 0) {
      addToast(t("errors.INVALID_PARAMETER"), "error");
      return;
    }

    setSaving(true);
    try {
      await updateRolePermissions(activeRole.role_id, {
        permission_keys: draftPermissions.sort(),
        default_storage_quota: parsedQuota,
      });
      addToast(t("admin.saveSuccess"), "success");
      await loadData();
    } catch (error) {
      console.error(error);
      addToast(t("admin.users.fetchError"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 opacity-40">
        <RefreshCw className="animate-spin mb-4" size={28} />
        <p className="text-sm font-black uppercase tracking-widest">{t("admin.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t("pages.admin.permissions.title")}</h2>
            <p className="text-sm font-bold opacity-40 uppercase tracking-widest">
              {t("admin.perms.subtitle") || "Role Permission Management"}
            </p>
          </div>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => void loadData()}>
          <RefreshCw size={16} className="mr-2" />
          {t("filemanager.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 shadow-xl space-y-3">
          {roles.map((role) => (
            <button
              type="button"
              key={role.role_id}
              onClick={() => setActiveRoleId(role.role_id)}
              className={`w-full text-left px-4 py-4 rounded-2xl border transition-all ${
                activeRoleId === role.role_id ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/30 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-black">{role.name}</p>
                <span className="text-sm font-black opacity-50">#{role.role_id}</span>
              </div>
              <p className="text-sm opacity-50 mt-1">{role.role_key}</p>
            </button>
          ))}
        </div>

        <div className="xl:col-span-2 bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl space-y-8">
          {!activeRole ? (
            <div className="py-16 text-center opacity-40">{t("admin.users.noUsers")}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black">{activeRole.name}</h3>
                  <p className="text-sm uppercase tracking-widest opacity-40">{activeRole.role_key}</p>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                  {t("admin.edit.saveChanges")}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40">
                  {t("admin.edit.quota")} ({bytesToText(Number(draftQuota) || 0)})
                </label>
                <Input value={draftQuota} onChange={(event) => setDraftQuota(event.target.value)} />
              </div>

              <div className="space-y-6">
                {groupedPermissions.map(([moduleKey, items]) => (
                  <div key={moduleKey} className="space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-widest opacity-50">{moduleKey}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map((item) => {
                        const checked = draftPermissions.includes(item.perm_key);
                        const description = i18n.language === "zh" ? item.desc_zh : item.desc_en;
                        return (
                          <label
                            key={item.perm_key}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              checked ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(item.perm_key)}
                                className="mt-1"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold">{item.perm_key}</p>
                                <p className="text-sm opacity-50 mt-1">{description}</p>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
