import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { client, extractData, handleApiError, isApiError, postCaptchaPolicy } from '@/lib/api.ts';
import { normalizeEmailInput, normalizePhoneInput } from '@/lib/contactNormalize.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { useToastStore } from '@fileuni/shared';
import { useThemeStore } from '@fileuni/shared';
import { cn } from '@/lib/utils.ts';
import { ShieldAlert, ArrowLeft, Send, ChevronRight, Lock, Key } from 'lucide-react';
import type { components } from '@/types/api.ts';
import { TurnstileWidget } from '@/components/common/TurnstileWidget.tsx';

interface RecoveryOptions {
  user_id: string;
  username: string;
  email?: string;
  has_security_question?: boolean;
  security_question?: string;
}
type CaptchaPayload = { token: string; image_base64: string; captcha_type: string; turnstile_site_key?: string | null };

export const ForgotPasswordView = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { addToast } = useToastStore();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaData, setCaptchaData] = useState<CaptchaPayload | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [options, setOptions] = useState<RecoveryOptions | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'phone' | 'question' | null>(null);
  const [verifyForm, setVerifyForm] = useState({ code: '', answer: '', token: '', timer: 0 });
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '', token: '' });

  const showError = (e: unknown) => {
    addToast(handleApiError(e, t), "error");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isTurnstileCaptcha = captchaData?.captcha_type === "turnstile";
  const captchaTokenForSubmit = isTurnstileCaptcha ? turnstileToken : (captchaData?.token ?? "");

  // Timer logic
  useEffect(() => {
    if (verifyForm.timer > 0) {
      const id = setInterval(() => setVerifyForm(f => ({ ...f, timer: f.timer - 1 })), 1000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [verifyForm.timer]);

  const fetchCaptcha = async (isRefresh = false) => {
    try {
      const scene = step <= 1 ? "FORGOT_OPTIONS" : (selectedMethod === 'question' ? "FORGOT_SECURITY" : "SEND_CODE");
      const riskTargetType = step <= 1 || selectedMethod === 'question'
        ? "identifier"
        : (selectedMethod === 'phone' ? "phone" : "email");
      const query = {
        old_captcha_id: isRefresh && captchaData?.token ? captchaData.token : undefined,
        scene,
        risk_target: identifier || undefined,
        risk_target_type: riskTargetType,
        risk_user_id: options?.user_id || undefined,
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

  const handleGetOptions = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const policy = await postCaptchaPolicy({
        scene: "FORGOT_OPTIONS",
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
        setCaptchaData(null);
        setCaptchaCode("");
        setTurnstileToken("");
      }

      const data = await extractData<RecoveryOptions>(client.POST('/api/v1/users/public/forgot-password/options', {
        headers: { "X-No-Toast": "true" },
        body: { 
          username_or_email_or_phone_or_uid: identifier,
          captcha_token: captchaTokenForSubmit || null,
          captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
        }
      }));
      setOptions(data);
      setStep(2);
    } catch (e: unknown) { 
      if (isApiError(e) && e.code === 40301) {
        setNeedCaptcha(true);
        fetchCaptcha();
        addToast(t("auth.captchaRequired"), "warning");
      } else {
        showError(e);
      }
    }
    finally { setLoading(false); }
  };

  const startVerification = async (method: 'email' | 'phone' | 'question') => {
    if (!options) return;
    setSelectedMethod(method);
    setStep(3);
    if (method !== 'question') {
      try {
        const policy = await postCaptchaPolicy({
          scene: "SEND_CODE",
          risk_target: identifier,
          risk_target_type: method,
          risk_user_id: options.user_id,
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
          setCaptchaData(null);
          setCaptchaCode("");
          setTurnstileToken("");
        }

        const data = await extractData<components["schemas"]["SendCaptchaCodeResponse"]>(client.POST('/api/v1/users/public/send-code', {
          headers: { "X-No-Toast": "true" },
          body: { 
            user_id: options.user_id, 
            target: identifier, 
            target_type: method,
            captcha_token: captchaTokenForSubmit || null,
            captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
          }
        }));
        setVerifyForm(f => ({ ...f, token: data.token, timer: 60 }));
        addToast(t('forgotPassword.codeSent'), 'success');
      } catch (e: unknown) { 
         if (isApiError(e) && e.code === 40301) {
           setNeedCaptcha(true);
           fetchCaptcha();
           addToast(t("auth.captchaRequired"), "warning");
         } else {
           showError(e);
         }
      }
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      let token = '';
      if (selectedMethod === 'question') {
        const policy = await postCaptchaPolicy({
          scene: "FORGOT_SECURITY",
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
          setCaptchaData(null);
          setCaptchaCode("");
          setTurnstileToken("");
        }

        const res = await extractData<{ success: boolean, user_id: string, message: string, token?: string }>(client.POST('/api/v1/users/public/forgot-password/verify-security', {
          headers: { "X-No-Toast": "true" },
          body: { 
            username_or_email_or_phone_or_uid: identifier, 
            security_question: options?.security_question || '', 
            security_answer: verifyForm.answer,
            captcha_token: captchaTokenForSubmit || null,
            captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
          }
        }));
        token = res.token || ''; 
      } else {
        const res = await extractData<{ token: string }>(client.POST('/api/v1/users/public/forgot-password/verify-code', {
          headers: { "X-No-Toast": "true" },
          body: { token: verifyForm.token, code: verifyForm.code }
        }));
        token = res.token;
      }
      setResetForm(f => ({ ...f, token }));
      setStep(4);
    } catch (e) { 
      // Decide whether to refresh captcha based on biz_code after verification error
      if (isApiError(e)) {
        if (e.biz_code === 'CAPTCHA_REQUIRED') {
          setNeedCaptcha(true);
          fetchCaptcha(true);
          setCaptchaCode("");
          setTurnstileToken("");
        } else if (e.biz_code === 'INVALID_CAPTCHA') {
          setCaptchaCode("");
          setTurnstileToken("");
        } else {
          showError(e);
        }
      } else {
        showError(e);
      }
    }
    finally { setLoading(false); }
  };

  const handleReset = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) return addToast(t('auth.passwordMismatch'), 'error');
    if (!options) return;
    setLoading(true);
    try {
      if (selectedMethod === 'question') {
        // Use the new security question reset API
        await extractData(client.POST('/api/v1/users/public/reset-password-by-security', {
          headers: { "X-No-Toast": "true" },
          body: { 
            username_or_email_or_phone_or_uid: identifier, 
            security_answer: verifyForm.answer,
            new_password: resetForm.newPassword,
            captcha_token: captchaTokenForSubmit || null,
            captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
          }
        }));
        addToast(t('forgotPassword.resetSuccess'), 'success');
        window.location.hash = 'mod=public&page=login';
      } else {
        // Normal token-based reset
        await extractData(client.POST('/api/v1/users/public/forgot-password/reset', {
          headers: { "X-No-Toast": "true" },
          body: { user_id: options.user_id, token: resetForm.token, new_password: resetForm.newPassword }
        }));
        addToast(t('forgotPassword.resetSuccess'), 'success');
        window.location.hash = 'mod=public&page=login';
      }
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden pt-16">
      <div className={cn(
        "w-full max-w-[420px] backdrop-blur-xl border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 transition-all",
        isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
      )}>
        <div className="h-1.5 bg-gradient-to-r from-orange-500 to-red-600 opacity-80" />
        
        <div className="p-10 pt-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 mb-4 shadow-inner">
              <ShieldAlert size={32} />
            </div>
            <h1 className={cn("text-3xl font-black tracking-tight mb-1", isDark ? "text-white" : "text-gray-900")}>{t('forgotPassword.accountRecovery')}</h1>
            <p className="text-sm opacity-50 font-bold uppercase tracking-widest">{t('forgotPassword.verifyIdentity')}</p>
          </div>

          {step === 1 && (
            <form onSubmit={handleGetOptions} className="space-y-6">
              <Input
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onBlur={() => {
                  const trimmed = identifier.trim();
                  if (trimmed.includes("@")) {
                    setIdentifier(normalizeEmailInput(trimmed));
                  } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
                    // UUID - keep as is
                  } else {
                    const normalized = normalizePhoneInput(trimmed);
                    if (normalized.length > 5 && /^\+?\d+$/.test(normalized)) {
                      setIdentifier(normalized);
                    }
                  }
                }}
                placeholder={t('auth.usernameEmailPhone')}
                required
                className="h-14 rounded-2xl"
              />
              
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
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary group-focus-within:opacity-100 transition-all" size={18} />
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
                          <img src={captchaData.image_base64} alt={t('auth.captcha')} className="w-full h-full object-contain" />
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

              <Button className="w-full h-14 text-lg" disabled={loading}>
                {loading ? <span className="loading-spinner animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : t('forgotPassword.findAccount')}
              </Button>
            </form>
          )}

          {step === 1 && (
            <div className={cn("mt-8 pt-8 border-t text-center space-y-4", isDark ? "border-white/5" : "border-gray-100")}>
              <a href="#mod=public&page=login" className="text-sm font-bold opacity-50 hover:text-primary transition-colors flex items-center justify-center gap-2">
                <ArrowLeft size={16} />
                {t('common.backToLogin')}
              </a>
              <div className="pt-4">
                <a 
                  href="https://docs.fileuni.com/get-admin-passwd/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all",
                    isDark 
                      ? "text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20" 
                      : "text-orange-600 hover:text-orange-500 bg-orange-50 hover:bg-orange-100"
                  )}
                >
                  <Key size={16} />
                  {t('forgotPassword.adminRecovery')}
                </a>
                <p className={cn("text-sm mt-2 opacity-40", isDark ? "text-gray-400" : "text-gray-500")}>
                  {t('forgotPassword.adminRecoveryHint')}
                </p>
              </div>
            </div>
          )}

          {step === 2 && options && (
            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-2xl mb-6 flex items-center gap-4 border font-black",
                isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-100"
              )}>
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white">{options.username[0].toUpperCase()}</div>
                <span className={isDark ? "text-white" : "text-gray-900"}>{options.username}</span>
              </div>
              <p className="text-sm font-black uppercase tracking-widest opacity-30 ml-1">{t('forgotPassword.chooseVerification')}</p>
              
              {options.has_security_question && (
                <button onClick={() => startVerification('question')} className={cn(
                  "w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left group",
                  isDark ? "bg-white/5 border-white/5 hover:border-orange-500/30" : "bg-white border-gray-100 hover:border-orange-500/30 shadow-sm"
                )}>
                  <div className="flex items-center gap-4">
                    <Lock size={20} className="opacity-30 group-hover:text-orange-500" />
                    <div><p className={cn("font-bold", isDark ? "text-white" : "text-gray-900")}>{t('forgotPassword.securityQuestion')}</p><p className="text-sm opacity-40">{t('forgotPassword.verifyWithAnswer')}</p></div>
                  </div>
                  <ChevronRight size={16} className="opacity-20" />
                </button>
              )}
              
              {options.email && (
                <button onClick={() => startVerification('email')} className={cn(
                  "w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left group",
                  isDark ? "bg-white/5 border-white/5 hover:border-orange-500/30" : "bg-white border-gray-100 hover:border-orange-500/30 shadow-sm"
                )}>
                  <div className="flex items-center gap-4">
                    <Send size={20} className="opacity-30 group-hover:text-orange-500" />
                    <div><p className={cn("font-bold", isDark ? "text-white" : "text-gray-900")}>{t('forgotPassword.emailCode')}</p><p className="text-sm opacity-40">{t('forgotPassword.sentTo')} {options.email}</p></div>
                  </div>
                  <ChevronRight size={16} className="opacity-20" />
                </button>
              )}
              
              <Button variant="ghost" className="w-full" onClick={() => setStep(1)}><ArrowLeft size={16} className="mr-2" /> {t('common.back')}</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex items-center gap-3 text-orange-400 font-bold text-sm leading-relaxed italic">
                <ShieldAlert size={16} className="shrink-0" />
                {t('forgotPassword.protectingAccount', { method: selectedMethod || '' })}
              </div>

              {selectedMethod === 'question' ? (
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{options.security_question}</label>
                  <Input value={verifyForm.answer} onChange={e => setVerifyForm({ ...verifyForm, answer: e.target.value })} placeholder={t('forgotPassword.secretAnswerPlaceholder')} className="h-14" />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('common.verificationCode')}</label>
                  <div className="flex gap-2">
                    <Input value={verifyForm.code} onChange={e => setVerifyForm({ ...verifyForm, code: e.target.value })} placeholder={t('forgotPassword.codePlaceholder')} className="flex-1 font-mono tracking-widest h-14" />
                    <Button variant="outline" className="h-14 px-6" disabled={verifyForm.timer > 0 || loading} onClick={() => selectedMethod && startVerification(selectedMethod)}>
                      {verifyForm.timer > 0 ? `${verifyForm.timer}s` : t('forgotPassword.resend')}
                    </Button>
                  </div>
                </div>
              )}

              <Button className="w-full h-14 text-lg" disabled={loading} onClick={handleVerify}>
                {loading ? <span className="loading-spinner animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : t('forgotPassword.confirmIdentity')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>{t('common.cancel')}</Button>
            </div>
          )}

          {step === 4 && (
            <form onSubmit={handleReset} className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                <Key size={32} />
              </div>
              <h3 className="text-xl font-black mb-6">{t('forgotPassword.createNewPassword')}</h3>
              <Input type="password" value={resetForm.newPassword} onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })} placeholder={t('forgotPassword.newPassword')} required className="h-14 rounded-2xl" />
              <Input type="password" value={resetForm.confirmPassword} onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })} placeholder={t('forgotPassword.repeatPassword')} required className="h-14 rounded-2xl" />
              <Button className="w-full h-14 bg-green-600 text-white border-none shadow-green-500/20" disabled={loading}>
                {t('forgotPassword.updatePassword')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
