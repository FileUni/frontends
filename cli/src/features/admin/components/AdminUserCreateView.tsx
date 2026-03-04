import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useToastStore } from "@fileuni/shared";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { UserPlus, Save, ArrowLeft } from "lucide-react";
import { client } from "@/lib/api.ts";
import { normalizeEmailInput, normalizePhoneInput } from "@/lib/contactNormalize.ts";
import type { paths } from "@/types/api.ts";
import { useConfigStore } from "@/stores/config.ts";
import { fetchRolesAndPermissions, type RolePermissionView } from "./roleApi";

type UserCreateBody =
  paths["/api/v1/users/admin/users"]["post"]["requestBody"]["content"]["application/json"];

export const AdminUserCreateView = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { capabilities } = useConfigStore();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<RolePermissionView[]>([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    email: "",
    phone: "",
    role_id: 100,
    status: "active",
  });

  const isMatch =
    form.password === form.confirmPassword && form.confirmPassword !== "";
  const canSubmit =
    form.username.length >= 3 && form.password.length >= 6 && isMatch;

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchRolesAndPermissions();
        setRoles(data.roles);
        if (data.roles.length > 0 && !data.roles.some((role) => role.role_id === form.role_id)) {
          setForm((prev) => ({ ...prev, role_id: data.roles[0]?.role_id || 100 }));
        }
      } catch (error) {
        console.error(error);
      }
    };
    void loadRoles();
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: UserCreateBody = {
        username: form.username,
        password: form.password,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        role_id: form.role_id,
      };
      await client.POST("/api/v1/users/admin/users", {
        body,
      });
      addToast(t("pages.admin.userCreate.createSuccess"), "success");
      window.location.hash = "mod=admin&page=users";
    } catch (e: unknown) {
      /* Handled */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center gap-4">
        <a
          href="#mod=admin&page=users"
          className="p-2 hover:bg-white/5 rounded-full transition-colors opacity-50 hover:opacity-100"
        >
          <ArrowLeft size={24} />
        </a>
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            {t("pages.admin.userCreate.provisionIdentity")}
          </h1>
          <p className="text-sm font-bold opacity-40 uppercase tracking-widest mt-1">
            {t("pages.admin.userCreate.manualAccountCreation")}
          </p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12">
          <UserPlus size={160} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.username")} *
              </label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder={t("pages.admin.userCreate.usernamePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.fullName")}
              </label>
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder={t("pages.admin.userCreate.fullNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.initialPassword")} *
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={t("pages.admin.userCreate.passwordPlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.confirmPassword")} *
              </label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder={t(
                  "pages.admin.userCreate.confirmPasswordPlaceholder",
                )}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.role")}
              </label>
              <select
                value={form.role_id}
                onChange={(e) =>
                  setForm({ ...form, role_id: Number(e.target.value) })
                }
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 font-bold"
              >
                {roles.length === 0 ? (
                  <>
                    <option value={100}>{t("pages.admin.userCreate.regularUser")}</option>
                    <option value={0}>{t("pages.admin.userCreate.systemAdministrator")}</option>
                  </>
                ) : (
                  roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.name} (#{role.role_id})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                {t("pages.admin.userCreate.status")}
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 font-bold"
              >
                <option value="active">
                  {t("pages.admin.userCreate.active")}
                </option>
                <option value="inactive">
                  {t("pages.admin.userCreate.inactive")}
                </option>
                <option value="banned">
                  {t("pages.admin.userCreate.banned")}
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {capabilities?.enable_email_auth !== false && (
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                  {t("pages.admin.userCreate.email")}
                </label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setForm({ ...form, email: normalizeEmailInput(form.email) })}
                  placeholder={t("pages.admin.userCreate.emailPlaceholder")}
                />
              </div>
            )}
            {capabilities?.enable_mobile_auth !== false && (
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                  {t("pages.admin.userCreate.phone")}
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  onBlur={() => setForm({ ...form, phone: normalizePhoneInput(form.phone) })}
                  placeholder={t("pages.admin.userCreate.phonePlaceholder")}
                />
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-white/5 flex justify-end">
            <Button
              type="submit"
              className="h-14 px-12 text-lg"
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <span className="loading-spinner animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <Save size={20} className="mr-2" />{" "}
                  {t("pages.admin.userCreate.createUser")}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
