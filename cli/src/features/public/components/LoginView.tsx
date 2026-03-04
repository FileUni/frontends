import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useAuthStore } from "@/stores/auth.ts";
import { useToastStore } from "@fileuni/shared";
import { useConfigStore } from "@/stores/config.ts";
import { useThemeStore } from "@fileuni/shared";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Modal } from "@/components/ui/Modal.tsx";
import { useNavigationStore } from "@/stores/navigation.ts";
import { cn } from "@/lib/utils.ts";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronRight,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  XCircle,
  Clock,
  Globe,
  AlertTriangle,
  Users,
} from "lucide-react";
import { client, extractData, isApiError, postCaptchaPolicy } from "@/lib/api.ts";
import { normalizeEmailInput, normalizePhoneInput } from "@/lib/contactNormalize.ts";
import type { components } from "@/types/api.ts";

import { TurnstileWidget } from "@/components/common/TurnstileWidget.tsx";

type UserSession = components["schemas"]["UserSession"];
type CaptchaPayload = {
  token: string;
  image_base64: string;
  captcha_type: string;
  turnstile_site_key?: string | null;
};

export const LoginView = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { navigate } = useNavigationStore();
  const {
    usersMap,
    saveLoginInfo,
  } = useAuthStore();
  const { addToast } = useToastStore();
  const { capabilities, fetchCapabilities } = useConfigStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaData, setCaptchaData] = useState<CaptchaPayload | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Device Limit States
  const [showDeviceLimit, setShowDeviceLimit] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [limitInfo, setLimitInfo] = useState({ current: 0, max: 0 });

  const savedUsers = Object.values(usersMap);
  const isTurnstileCaptcha = captchaData?.captcha_type === "turnstile";
  const captchaTokenForSubmit = isTurnstileCaptcha ? turnstileToken : (captchaData?.token ?? "");

  useEffect(() => {
    setMounted(true);
    fetchCapabilities();
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const fetchCaptcha = async (isRefresh = false) => {
    try {
      const query = {
        old_captcha_id: isRefresh && captchaData?.token ? captchaData.token : undefined,
        scene: "LOGIN",
        risk_target: identifier || undefined,
        risk_target_type: "identifier",
      };
        
      const data = await extractData<CaptchaPayload>(
        client.GET("/api/v1/users/public/captcha", {
          params: { query }
        })
      );
      setCaptchaData(data);
      setCaptchaCode("");
      setTurnstileToken("");
    } catch (e) {
      console.error("Failed to fetch captcha", e);
    }
  };

  const handleLogin = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!agreement) {
      addToast(t("auth.agreement"), "warning");
      return;
    }

    setLoading(true);
    try {
      const policy = await postCaptchaPolicy({
        scene: "LOGIN",
        risk_target: identifier,
        risk_target_type: "identifier",
      });
      if (policy.deny_request) {
        addToast(t("errors.TOO_MANY_ATTEMPTS") || "Too many attempts", "error");
        return;
      }
      if (policy.require_captcha) {
        setNeedCaptcha(true);
        if (!captchaData) {
          await fetchCaptcha();
          addToast(t("auth.captchaRequired"), "warning");
          return;
        }
        if (!captchaTokenForSubmit) {
          addToast(t("auth.captchaRequired"), "warning");
          return;
        }
        if (!isTurnstileCaptcha && !captchaCode.trim()) {
          addToast(t("auth.captchaRequired"), "warning");
          return;
        }
      } else {
        setNeedCaptcha(false);
        setCaptchaCode("");
        setCaptchaData(null);
        setTurnstileToken("");
      }

      const loginData = await extractData<components["schemas"]["LoginResponse"]>(
        client.POST("/api/v1/users/public/login", {
          body: {
            username_or_email_or_phone_or_uid: identifier,
            password: password,
            captcha_token: captchaTokenForSubmit || null,
            captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
          },
        })
      );

      const isDefaultAdmin = (identifier === 'admin' || loginData.user.username === 'admin') && password === 'admin888';

      saveLoginInfo(
        {
          user: loginData.user,
          access_token: loginData.tokens.access_token,
          refresh_token: loginData.tokens.refresh_token,
          login_time: new Date().toISOString(),
        },
        isDefaultAdmin
      );

      addToast(t("auth.loginSuccess"), "success");
      navigate({ mod: "user", page: "welcome" });
    } catch (e: unknown) {
      if (isApiError(e)) {
        if (e.code === 40301) {
          setNeedCaptcha(true);
          fetchCaptcha();
          addToast(t("auth.captchaRequired"), "warning");
          return;
        }

        const msg = e.msg || "";
        // Detect device limit error
        if (msg.includes("MAX_DEVICES_EXCEEDED")) {
          await fetchPublicSessions();
          setShowDeviceLimit(true);
          return;
        }
        
        addToast(msg || t("errors.INTERNAL_ERROR"), "error");
      } else {
        console.error("Login error:", e);
        addToast(e instanceof Error ? e.message : t("errors.INTERNAL_ERROR"), "error");
      }

      // If captcha error or required, decide whether to refresh based on biz_code
      if (isApiError(e)) {
        if (e.biz_code === 'CAPTCHA_REQUIRED') {
          setNeedCaptcha(true);
          fetchCaptcha(true); // Force new captcha
          setCaptchaCode("");
          setTurnstileToken("");
        } else if (e.biz_code === 'INVALID_CAPTCHA') {
          // Only clear input, don't refresh image, allow retry based on max_attempts
          // Only clear input, don't refresh image, allow retry based on max_attempts
          setCaptchaCode("");
          setTurnstileToken("");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicSessions = async () => {
    try {
      const resData = await extractData<components["schemas"]["SessionListResponse"]>(
        client.POST("/api/v1/users/public/sessions/list", {
          body: {
            username_or_email_or_phone_or_uid: identifier,
            password: password,
          },
        })
      );
      setSessions(resData.sessions || []);
      setLimitInfo({
        current: Number(resData.total) || 0,
        max: Number(resData.max_devices) || 0,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const { data } = await client.POST(
        "/api/v1/users/public/sessions/delete",
        {
          body: {
            username_or_email_or_phone_or_uid: identifier,
            password: password,
            session_id: sessionId,
          },
        },
      );
      if (data?.success) {
        addToast(t("sessions.revokeAccess"), "success");
        // After successful removal, attempt to login again
        setShowDeviceLimit(false);
        handleLogin();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getDeviceIcon = (name: string | null | undefined) => {
    const n = (name || "").toLowerCase();
    if (n.includes("phone") || n.includes("iphone") || n.includes("android"))
      return <Smartphone size={18} />;
    if (n.includes("pad") || n.includes("tablet")) return <Tablet size={18} />;
    if (n.includes("window") || n.includes("linux") || n.includes("mac"))
      return <Monitor size={18} />;
    return <Laptop size={18} />;
  };

  if (!mounted) return <div className="h-screen bg-background" />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden pt-16">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-300px] left-[-300px] w-[800px] h-[800px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={cn(
          "backdrop-blur-xl border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all",
          isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="h-1.5 bg-gradient-to-r from-primary to-blue-600 opacity-80" />

          <div className="p-10 pt-12">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center mb-4">
                <img src="/ui/favicon.svg" alt={t('common.logoAlt')} width={64} height={64} className="shadow-lg" />
              </div>
              <h1 className={cn("text-3xl font-black tracking-tight mb-1", isDark ? "text-white" : "text-gray-900")}>
                {t("common.login")}
              </h1>
              <p className="text-sm opacity-50 font-bold uppercase tracking-widest">
                {t("auth.loginTitle")}
              </p>
            </div>

            {savedUsers.length > 0 && (
              <div
                className={cn(
                  "mb-8 p-4 rounded-3xl border flex items-center justify-between group cursor-pointer transition-all",
                  isDark ? "bg-primary/5 border-primary/10 hover:bg-primary/10" : "bg-primary/5 border-primary/20 hover:bg-primary/10"
                )}
                onClick={() => navigate({ mod: "user", page: "accounts" })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className={cn("text-sm font-black leading-tight", isDark ? "text-white" : "text-gray-900")}>
                      {t("auth.switchToExistingAccount")}
                    </p>
                    <p className="text-sm opacity-40 font-bold uppercase tracking-tighter">
                      {t("auth.manageAccountsDescShort") ||
                        "Select from logged in users"}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="opacity-20 group-hover:opacity-100 transition-opacity"
                />
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                  {capabilities?.enable_mobile_auth &&
                  capabilities?.enable_email_auth
                    ? t("auth.usernameEmailPhone")
                    : capabilities?.enable_email_auth
                      ? t("auth.usernameEmail")
                      : capabilities?.enable_mobile_auth
                        ? t("auth.usernamePhone")
                        : t("common.usernameRegister")}
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary group-focus-within:opacity-100 transition-all"
                    size={18}
                  />
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onBlur={() => {
                      const trimmed = identifier.trim();
                      if (trimmed.includes("@")) {
                        setIdentifier(normalizeEmailInput(trimmed));
                      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
                        // UUID - keep as is
                      } else {
                        // Try to normalize phone number, keep as is if clearly not a phone number
                        const normalized = normalizePhoneInput(trimmed);
                        if (normalized.length > 5 && /^\+?\d+$/.test(normalized)) {
                          setIdentifier(normalized);
                        }
                      }
                    }}
                    className="pl-12"
                    placeholder={
                      capabilities?.enable_mobile_auth &&
                      capabilities?.enable_email_auth
                        ? t("auth.usernameEmailPhone")
                        : t("common.usernameRegister")
                    }
                    required
                  />
                </div>
              </div>

              {needCaptcha && (
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
                    {t("auth.captcha")}
                  </label>
                  {isTurnstileCaptcha ? (
                    <div className="space-y-2">
                      {captchaData?.turnstile_site_key ? (
                        <TurnstileWidget siteKey={captchaData.turnstile_site_key} onTokenChange={setTurnstileToken} />
                      ) : (
                        <p className="text-sm font-bold uppercase tracking-widest text-red-500">{t('auth.turnstileSiteKeyMissing')}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="relative flex-1 group">
                        <Lock
                          className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary group-focus-within:opacity-100 transition-all"
                          size={18}
                        />
                        <Input
                          value={captchaCode}
                          onChange={(e) => setCaptchaCode(e.target.value)}
                          className="pl-12"
                          placeholder={t('common.verificationCode')}
                          required
                        />
                      </div>
                      <div
                        className={cn(
                          "w-36 h-12 sm:w-40 sm:h-14 rounded-xl border overflow-hidden cursor-pointer hover:border-primary/50 transition-all flex items-center justify-center",
                          isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                        )}
                        onClick={() => fetchCaptcha(true)}
                        title={t("auth.refreshCaptcha")}
                      >
                        {captchaData ? (
                          <img
                            src={captchaData.image_base64}
                            alt={t('auth.captcha')}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                  )}
                  {captchaData?.captcha_type && (
                    <p className="text-sm font-bold uppercase tracking-widest opacity-40">
                      {`Type: ${captchaData.captcha_type.replace("image:", "")}`}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40">
                    {t("common.password")}
                  </label>
                  <a
                    href="#mod=public&page=forgot-password"
                    className="text-sm font-black text-primary hover:underline"
                  >
                    {t("common.forgotPassword")}
                  </a>
                </div>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary group-focus-within:opacity-100 transition-all"
                    size={18}
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12"
                    placeholder=""
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group p-1 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={cn(
                      "w-4 h-4 rounded transition-all cursor-pointer",
                      isDark ? "border-white/10 bg-white/5 checked:bg-primary" : "border-gray-300 bg-white checked:bg-primary"
                    )}
                  />
                  <span className="text-sm font-bold opacity-60 leading-tight">
                    {t("common.rememberMe")}
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group p-1 select-none">
                  <input
                    type="checkbox"
                    checked={agreement}
                    onChange={(e) => setAgreement(e.target.checked)}
                    className={cn(
                      "mt-1 w-4 h-4 rounded transition-all cursor-pointer",
                      isDark ? "border-white/10 bg-white/5 checked:bg-primary" : "border-gray-300 bg-white checked:bg-primary"
                    )}
                  />
                  <span className="text-sm font-bold opacity-60 leading-tight">
                    {t("auth.agreementPrefix")}
                    <a
                      href="#mod=public&page=privacy"
                      className="text-primary hover:underline mx-1"
                    >
                      {t("auth.privacyPolicy")}
                    </a>
                    {t("auth.and")}
                    <a
                      href="#mod=public&page=tos"
                      className="text-primary hover:underline mx-1"
                    >
                      {t("auth.termsOfService")}
                    </a>
                  </span>
                </label>
              </div>

              <Button className="w-full h-14 text-lg" disabled={loading}>
                {loading ? (
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {t("common.login")} <ArrowRight size={20} />
                  </span>
                )}
              </Button>
            </form>

            {capabilities?.enable_registration !== false && (
              <div className={cn("mt-10 pt-10 border-t text-center", isDark ? "border-white/5" : "border-gray-100")}>
                <p className="text-sm font-bold opacity-50 mb-4">
                  {t("auth.noAccount")}
                </p>
                <a
                  href="#mod=public&page=register"
                  className="inline-flex items-center justify-center px-8 py-3 rounded-xl border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all font-black uppercase text-sm tracking-widest"
                >
                  {t("common.register")}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Device Limit Management Modal */}
      <Modal
        isOpen={showDeviceLimit}
        onClose={() => setShowDeviceLimit(false)}
        title={t("auth.deviceLimitExceeded")}
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-4">
            <AlertTriangle
              className="text-orange-500 shrink-0 mt-1"
              size={20}
            />
            <p className="text-sm font-bold text-orange-200/80 leading-relaxed">
              {t("auth.deviceLimitDesc", {
                count: limitInfo.current,
                max: limitInfo.max,
              })}
            </p>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border group transition-all",
                  isDark ? "bg-white/[0.03] border-white/5" : "bg-gray-50 border-gray-100"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isDark ? "bg-white/5" : "bg-white border border-gray-100")}>
                    {getDeviceIcon(session.device_name)}
                  </div>
                  <div>
                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-gray-900")}>
                      {session.device_name || t("sessions.unknownDevice")}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-[14px] font-mono opacity-40 uppercase tracking-tighter">
                      <span className="flex items-center gap-1">
                        <Globe size={10} /> {session.ip_address}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />{" "}
                        {new Date(
                          session.last_accessed_at || "",
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(session.id || "")}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all border border-transparent hover:border-red-500/20 shadow-inner"
                  title={t("sessions.revokeAccess")}
                >
                  <XCircle size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className={cn("pt-4 border-t", isDark ? "border-white/5" : "border-gray-100")}>
            <Button
              variant="outline"
              className="w-full border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
              onClick={async () => {
                if (!confirm(t("sessions.revokeConfirm"))) return;
                const { data } = await client.POST(
                  "/api/v1/users/public/sessions/delete-all",
                  {
                    body: {
                      username_or_email_or_phone_or_uid: identifier,
                      password: password,
                    },
                  },
                );
                if (data?.success) {
                  setShowDeviceLimit(false);
                  handleLogin();
                }
              }}
            >
              {t("auth.revokeAll")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
