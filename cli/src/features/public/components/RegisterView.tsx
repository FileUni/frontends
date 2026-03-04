import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { client } from '@/lib/api.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { UserPlus, User, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

import { useToastStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { useThemeStore } from '@fileuni/shared';

export const RegisterView = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { addToast } = useToastStore();
  const { capabilities } = useConfigStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreement, setAgreement] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const passwordStrength = useMemo(() => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  }, [password]);

  const isMatch = password === confirmPassword && confirmPassword !== '';
  const canSubmit = username.length >= 3 && password.length >= 6 && isMatch && agreement;

  const handleRegister = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreement) {
      addToast(t("auth.agreement"), "warning");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await client.POST("/api/v1/users/public/register", {
        body: { username, password },
      });
      
      if (error) {
        addToast(error.msg || t("errors.INTERNAL_ERROR"), "error");
        return;
      }
      
      if (data?.success) {
        addToast(t('auth.registerSuccess'), 'success');
        window.location.hash = 'mod=public&page=login';
      }
    } catch (e: unknown) {
      console.error("Register catch error:", e);
      addToast(t("errors.INTERNAL_ERROR"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (capabilities?.enable_registration === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
        <div className="w-full max-w-[420px] relative z-10 text-center">
          <div className={cn(
            "backdrop-blur-xl border rounded-[2.5rem] p-10 shadow-2xl transition-all",
            isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
          )}>
            <XCircle className="mx-auto text-red-500 mb-4" size={64} />
            <h1 className={cn("text-2xl font-black mb-2", isDark ? "text-white" : "text-gray-900")}>{t('auth.registrationDisabled') || 'Registration Disabled'}</h1>
            <p className="opacity-60 mb-8">{t('auth.registrationDisabledDesc') || 'User registration is currently disabled by system administrator.'}</p>
            <Button onClick={() => window.location.hash = 'mod=public&page=login'} className="w-full">{t('common.backToLogin') || 'Back to Login'}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden pt-16">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[300px] -left-[300px] w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute -bottom-[300px] right-[-300px] w-[800px] h-[800px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={cn(
          "backdrop-blur-xl border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all",
          isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="h-1.5 bg-gradient-to-r from-blue-600 to-primary opacity-80" />
          
          <div className="p-10 pt-12">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 mb-4 shadow-inner">
                <UserPlus size={32} />
              </div>
              <h1 className={cn("text-3xl font-black tracking-tight mb-1", isDark ? "text-white" : "text-gray-900")}>{t('common.register')}</h1>
              <p className="text-sm opacity-50 font-bold">{t('auth.joinEcosystem')}</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('common.usernameRegister')}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                  <Input value={username} onChange={e => setUsername(e.target.value)} className="pl-12" placeholder={t('common.usernameRegister')} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('common.password')}</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                  <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="pl-12 pr-12" placeholder={t('common.password')} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {password && (
                  <div className="flex gap-1 h-1 px-1 mt-2">
                    {[1, 3, 5].map(lvl => (
                      <div key={lvl} className={`flex-1 rounded-full transition-all duration-500 ${passwordStrength >= lvl ? (lvl === 1 ? 'bg-red-500' : lvl === 3 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-white/10'}`} />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('common.confirmPassword')}</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                  <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-12 pr-10" placeholder={t('common.confirmPassword')} required />
                  {confirmPassword && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isMatch ? <CheckCircle2 className="text-green-500" size={18} /> : <XCircle className="text-red-500" size={18} />}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
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
                    {t('auth.agreementPrefix')}
                    <a href="#mod=public&page=privacy" className="text-primary hover:underline mx-1">{t('auth.privacyPolicy')}</a>
                    {t('auth.and')}
                    <a href="#mod=public&page=tos" className="text-primary hover:underline mx-1">{t('auth.termsOfService')}</a>
                  </span>
                </label>
              </div>

              <Button className="w-full h-14 text-lg" disabled={loading || !canSubmit}>
                {loading ? <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('common.register')}
              </Button>
            </form>

            <div className={cn("mt-10 pt-10 border-t text-center", isDark ? "border-white/5" : "border-gray-100")}>
              <p className="text-sm font-bold opacity-50">
                {t('auth.alreadyHaveAccount')}{' '}
                <a href="#mod=public&page=login" className="text-primary hover:underline font-black">{t('common.login')}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
