import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/stores/auth.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { ShieldCheck, Mail, Phone, HelpCircle, AlertTriangle, Trash2, Send, ChevronRight, Cloud, RefreshCw, Key } from 'lucide-react';
import { client, isApiError, postCaptchaPolicy } from '@/lib/api.ts';
import { isPhoneInputValid, normalizeEmailInput, normalizePhoneInput } from '@/lib/contactNormalize.ts';
import type { components } from '@/types/api.ts';
import { TurnstileWidget } from '@/components/common/TurnstileWidget.tsx';

import { useToastStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { PasswordChangeForm } from './PasswordChangeForm.tsx';

type UserResponse = components["schemas"]["UserResponse"];
type SecurityUserResponse = UserResponse & {
  security_answer?: string | null;
  security_question?: string | null;
};
type CaptchaPayload = { token: string; image_base64: string; captcha_type: string; turnstile_site_key?: string | null };

export const SecurityView = () => {
  const { t } = useTranslation();
  const { currentUserData } = useAuthStore();
  const { addToast } = useToastStore();
  const { capabilities } = useConfigStore();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [security, setSecurity] = useState<SecurityUserResponse | null>(null);
  const [s3Keys, setS3Keys] = useState<{ access_key: string, secret_key: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Modal states
  const [activeModal, setActiveModal] = useState<'email' | 'phone' | 'question' | 'password' | 'delete' | null>(null);
  const [bindForm, setBindForm] = useState({ target: '', code: '', token: '', timer: 0 });
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaData, setCaptchaData] = useState<CaptchaPayload | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const isTurnstileCaptcha = captchaData?.captcha_type === "turnstile";
  const captchaTokenForSubmit = isTurnstileCaptcha ? turnstileToken : (captchaData?.token ?? "");
  
  const [deleteConfirm, setDeleteConfirm] = useState({ password: '', phrase: '' });

  const fetchSecurity = useCallback(async () => {
    try {
      const { data: res } = await client.GET('/api/v1/users/auth/me');
      if (res?.success && res.data) setSecurity(res.data as SecurityUserResponse);

      if (capabilities?.enable_s3) {
        const { data: s3Res } = await client.GET('/api/v1/file/s3-keys');
        if (s3Res?.success && s3Res.data) {
          setS3Keys(s3Res.data as { access_key: string, secret_key: string });
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [capabilities]);

  useEffect(() => { fetchSecurity(); }, [fetchSecurity]);

  // Reset form states
  const handleModalClose = () => {
    setActiveModal(null);
    setBindForm({ target: '', code: '', token: '', timer: bindForm.timer }); // Keep timer
    setNeedCaptcha(false);
    setCaptchaCode("");
    setCaptchaData(null);
    setTurnstileToken("");
    setDeleteConfirm({ password: '', phrase: '' });
  };

  const fetchCaptcha = async (isRefresh = false) => {
    try {
      const riskTargetType = activeModal === 'phone' ? "phone" : "email";
      const query = {
        old_captcha_id: isRefresh && captchaData?.token ? captchaData.token : undefined,
        scene: "SEND_CODE",
        risk_target: bindForm.target || undefined,
        risk_target_type: riskTargetType,
        risk_user_id: currentUserData?.user.id,
      };
        
      const { data: res } = await client.GET("/api/v1/users/public/captcha", {
        params: { query }
      });
      if (res?.success && res.data) {
        setCaptchaData(res.data as CaptchaPayload);
        setCaptchaCode("");
        setTurnstileToken("");
      }
    } catch (e) {
      console.error("Failed to fetch captcha", e);
    }
  };

  const handleRegenerateS3 = async () => {
    if (!confirm(t('security.rotateConfirm'))) return;
    setRegenerating(true);
    try {
      const { data: res } = await client.POST('/api/v1/file/s3-keys/regenerate');
      if (res?.success && res.data) {
        setS3Keys(res.data as { access_key: string, secret_key: string });
        addToast(t('security.rotateSuccess'), 'success');
      }
    } catch (e) { console.error(e); }
    finally { setRegenerating(false); }
  };

  // Timer logic
  useEffect(() => {
    if (bindForm.timer > 0) {
      const id = setInterval(() => setBindForm(f => ({ ...f, timer: f.timer - 1 })), 1000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [bindForm.timer]);

  const handleSendCode = async (type: 'email' | 'phone') => {
    try {
      const normalizedTarget = type === "email" ? normalizeEmailInput(bindForm.target) : normalizePhoneInput(bindForm.target);
      setBindForm((f) => ({ ...f, target: normalizedTarget }));
      if (type === "phone" && normalizedTarget && !isPhoneInputValid(normalizedTarget)) {
        addToast(t('security.invalidPhoneFormat'), 'error');
        return;
      }

      const policy = await postCaptchaPolicy({
        scene: "SEND_CODE",
        risk_target: normalizedTarget,
        risk_target_type: type,
        risk_user_id: currentUserData?.user.id,
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

      const { data: res, error } = await client.POST('/api/v1/users/public/send-code', {
        body: { 
          target: normalizedTarget, 
          target_type: type as "email" | "phone", 
          user_id: currentUserData?.user.id,
          captcha_token: captchaTokenForSubmit || null,
          captcha_code: isTurnstileCaptcha ? null : (captchaCode || null),
        }
      });
      
      if (res?.success && res.data) {
        const normalizedTarget = res.data.target?.trim() || '';
        const inputTarget = bindForm.target.trim();
        setBindForm(f => ({ ...f, token: res.data.token, timer: 60, target: normalizedTarget || f.target }));
        if (normalizedTarget && normalizedTarget !== inputTarget) {
          addToast(t('security.targetNormalized'), 'warning');
        }
        addToast(t('auth.loginSuccess'), 'success');
        setNeedCaptcha(false);
      } else if (error && isApiError(error) && error.biz_code === 'CAPTCHA_REQUIRED') {
        setNeedCaptcha(true);
        fetchCaptcha();
      }
    } catch (e: unknown) { /* Handled by interceptor */ }
  };

  const handleVerify = async (type: 'email' | 'phone') => {
    try {
      if (!currentUserData?.user.id) return;
      
      const { data: res, error } = type === 'email' 
        ? await client.POST('/api/v1/users/public/{user_id}/verify-email', {
            params: { path: { user_id: currentUserData.user.id } },
            body: { token: bindForm.token, code: bindForm.code }
          })
        : await client.POST('/api/v1/users/public/{user_id}/verify-phone', {
            params: { path: { user_id: currentUserData.user.id } },
            body: { token: bindForm.token, code: bindForm.code }
          });

      if (error) {
        // Verification failed, clear code but keep modal open
        // Verification failed, clear code but keep modal open
        setBindForm(f => ({ ...f, code: '' }));
        return;
      }

      const inputTarget = bindForm.target.trim();
      const serverTarget =
        type === 'phone'
          ? (res?.data?.phone?.trim() || '')
          : (res?.data?.email?.trim() || '');
      if (serverTarget && serverTarget !== inputTarget) {
        addToast(t('security.targetNormalized'), 'warning');
      }
      addToast(t('security.verifySuccess'), 'success');
      handleModalClose();
      fetchSecurity();
    } catch (e: unknown) {
      setBindForm(f => ({ ...f, code: '' }));
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center opacity-50 font-black uppercase tracking-widest">{t('security.loading')}</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Card */}
        {capabilities?.enable_email_auth !== false && (
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative group overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Mail size={24} />
              </div>
              <Badge variant={security?.email_verified ? 'success' : 'warning'}>
                {security?.email_verified ? t('security.verified') : t('security.unverified')}
              </Badge>
            </div>
            <h3 className="text-xl font-black mb-2">{t('security.emailTitle')}</h3>
            <p className="text-sm opacity-50 font-bold mb-6">{t('security.emailDesc')}</p>
            <div className="bg-white/5 px-4 py-3 rounded-xl font-mono text-sm font-black mb-6 truncate border border-white/5">
              {security?.email || t('security.notBound')}
            </div>
            <Button variant="outline" className="w-full justify-between group/btn" onClick={() => { setBindForm({ ...bindForm, target: security?.email || '' }); setActiveModal('email'); }}>
              {security?.email ? t('security.change') : t('security.bindNow')}
              <ChevronRight size={16} className="opacity-30 group-hover/btn:translate-x-1 transition-all" />
            </Button>
          </div>
        )}

        {/* Phone Card */}
        {capabilities?.enable_mobile_auth !== false && (
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative group overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center shadow-inner">
                <Phone size={24} />
              </div>
              <Badge variant={security?.phone_verified ? 'success' : 'warning'}>
                {security?.phone_verified ? t('security.verified') : t('security.unverified')}
              </Badge>
            </div>
            <h3 className="text-xl font-black mb-2">{t('security.phoneTitle')}</h3>
            <p className="text-sm opacity-50 font-bold mb-6">{t('security.phoneDesc')}</p>
            <div className="bg-white/5 px-4 py-3 rounded-xl font-mono text-sm font-black mb-6 truncate border border-white/5">
              {security?.phone || t('security.notBound')}
            </div>
            <Button variant="outline" className="w-full justify-between group/btn" onClick={() => { setBindForm({ ...bindForm, target: security?.phone || '' }); setActiveModal('phone'); }}>
              {security?.phone ? t('security.change') : t('security.bindNow')}
              <ChevronRight size={16} className="opacity-30 group-hover/btn:translate-x-1 transition-all" />
            </Button>
          </div>
        )}

        {/* Security Question Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl md:col-span-2 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                <HelpCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black">{t('security.questionTitle')}</h3>
                <p className="text-sm opacity-50 font-bold">{t('security.questionDesc')}</p>
              </div>
            </div>
            <Badge variant={security?.security_answer ? 'success' : 'ghost'}>
              {security?.security_answer ? t('security.questionActive') : t('security.questionNotSet')}
            </Badge>
          </div>
          {security?.security_question && (
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-6">
              <span className="text-sm font-black opacity-30 uppercase tracking-widest block mb-1">{t('security.currentQuestion')}</span>
              <p className="text-lg font-bold italic">"{security.security_question}"</p>
            </div>
          )}
          <Button variant="outline" className="w-full md:w-auto px-10" onClick={() => setActiveModal('question')}>
            {security?.security_answer ? t('security.changeQuestion') : t('security.setupNow')}
          </Button>
        </div>

        {/* Change Password Card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl md:col-span-2 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shadow-inner">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black">{t('nav.changePassword')}</h3>
                <p className="text-sm opacity-50 font-bold">{t('security.passwordDesc') || 'Keep your account secure by updating your password regularly.'}</p>
              </div>
            </div>
          </div>
          <Button variant="outline" className="w-full md:w-auto px-10" onClick={() => setActiveModal('password')}>
            {t('security.change') || 'Update Password'}
          </Button>
        </div>

        {/* S3 Credentials Card */}
        {capabilities?.enable_s3 !== false && (
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl md:col-span-2 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                  <Cloud size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{t('security.s3Title')}</h3>
                  <p className="text-sm opacity-50 font-bold">{t('security.s3Desc')}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="font-black text-sm uppercase opacity-40 hover:opacity-100"
                onClick={handleRegenerateS3}
                disabled={regenerating}
              >
                {regenerating ? <RefreshCw className="animate-spin mr-2" size={18} /> : <RefreshCw className="mr-2" size={18} />}
                {regenerating ? t('security.rotating') : t('security.rotateKeys')}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('security.accessKey')}</label>
                <div className="bg-black/40 px-4 py-3 rounded-xl font-mono text-sm border border-white/5 select-all">
                  {s3Keys?.access_key || t('security.notGenerated')}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('security.secretKey')}</label>
                <div className="bg-black/40 px-4 py-3 rounded-xl font-mono text-sm border border-white/5 select-all">
                  {s3Keys?.secret_key ? '••••••••••••••••••••••••••••••••' : t('security.notGenerated')}
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-sm font-bold text-blue-400/60 flex flex-col gap-2 italic">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} />
                Endpoint: {mounted ? (
                  capabilities?.s3_port 
                    ? `${capabilities.s3_use_https ? 'https' : 'http'}://${window.location.hostname}:${capabilities.s3_port}` 
                    : `${window.location.origin}/api/v1/file/s3`
                ) : ''}
              </div>
              <div className="pl-6 opacity-60">
                (Virtual Bucket: user-data)
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-[2.5rem] p-8 shadow-xl md:col-span-2 relative group overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-red-500">{t('security.dangerZone')}</h3>
              <p className="text-sm opacity-50 font-bold">{t('security.dangerDesc')}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-sm font-bold opacity-60 leading-relaxed max-w-xl italic">
              {t('security.deleteNote')}
            </p>
            <Button variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-10 whitespace-nowrap" onClick={() => setActiveModal('delete')}>
              <Trash2 size={18} className="mr-2" /> {t('security.deleteAccount')}
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Modals */}
      <Modal 
        isOpen={activeModal === 'email' || activeModal === 'phone'} 
        onClose={handleModalClose} 
        title={t('security.verifyModalTitle', { type: activeModal === 'email' ? 'Email' : 'Phone' })}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('security.targetAddress')}</label>
            <Input
              value={bindForm.target}
              onChange={(e) => setBindForm({ ...bindForm, target: e.target.value })}
              onBlur={() => {
                if (!activeModal) return;
                const normalized = activeModal === "email" ? normalizeEmailInput(bindForm.target) : normalizePhoneInput(bindForm.target);
                setBindForm((f) => ({ ...f, target: normalized }));
              }}
              placeholder={activeModal === 'email' ? t('security.enterEmail') : t('security.enterPhone')}
            />
          </div>

          {needCaptcha && (
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('auth.captcha')}</label>
              {isTurnstileCaptcha ? (
                <div className="space-y-2">
                  {captchaData?.turnstile_site_key ? (
                    <TurnstileWidget siteKey={captchaData.turnstile_site_key} onTokenChange={setTurnstileToken} />
                  ) : (
                    <p className="text-sm font-bold uppercase tracking-widest text-red-500">{t('auth.turnstileSiteKeyMissing')}</p>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={captchaCode}
                    onChange={(e) => setCaptchaCode(e.target.value)}
                    placeholder={t('auth.captcha') || "Captcha"}
                    className="flex-1"
                  />
                  <div 
                    className="w-24 h-10 rounded-lg border overflow-hidden cursor-pointer flex items-center justify-center bg-white/5"
                    onClick={() => fetchCaptcha(true)}
                  >
                    {captchaData ? (
                      <img src={captchaData.image_base64} alt={t('auth.captcha')} className="w-full h-full object-cover" />
                    ) : (
                      <RefreshCw size={18} className="animate-spin opacity-40" />
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
            <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('common.verificationCode')}</label>
            <div className="flex gap-2">
              <Input value={bindForm.code} onChange={e => setBindForm({ ...bindForm, code: e.target.value })} placeholder={t('common.codePlaceholder')} className="flex-1 font-mono tracking-widest" />
              <Button variant="outline" className="px-4 h-12 whitespace-nowrap" disabled={bindForm.timer > 0 || !bindForm.target || (needCaptcha && !captchaTokenForSubmit)} onClick={() => activeModal && handleSendCode(activeModal as 'email' | 'phone')}>
                {bindForm.timer > 0 ? `${bindForm.timer}s` : <><Send size={16} className="mr-2" /> {t('security.send')}</>}
              </Button>
            </div>
          </div>
          <Button className="w-full h-14" disabled={!bindForm.code || !bindForm.token} onClick={() => activeModal && handleVerify(activeModal as 'email' | 'phone')}>
            {t('security.completeVerify')}
          </Button>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={activeModal === 'password'}
        onClose={handleModalClose}
        title={t('nav.changePassword')}
      >
        <PasswordChangeForm onSuccess={handleModalClose} />
      </Modal>

      {/* Delete Account Modal */}
      <Modal isOpen={activeModal === 'delete'} onClose={handleModalClose} title={t('security.finalConfirm')} className="border-red-500/30">
        <div className="space-y-6 text-center">
          <p className="text-sm font-bold opacity-60">{t('security.typePhrase')}</p>
          <div className="bg-white/5 p-3 rounded-lg font-mono text-sm select-all border border-white/5 text-red-400 font-black">
            {t('auth.deleteConfirmPhrase')}
          </div>
          <Input value={deleteConfirm.phrase} onChange={e => setDeleteConfirm({ ...deleteConfirm, phrase: e.target.value })} placeholder={t('security.phrasePlaceholder')} className="text-center font-bold border-red-500/20 focus:border-red-500" />
          <Input type="password" value={deleteConfirm.password} onChange={e => setDeleteConfirm({ ...deleteConfirm, password: e.target.value })} placeholder={t('security.currentPassword')} className="text-center border-red-500/20 focus:border-red-500" />
          <Button className="w-full h-14 bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" disabled={deleteConfirm.phrase !== t('auth.deleteConfirmPhrase') || !deleteConfirm.password}>
            {t('security.deleteEverything')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
