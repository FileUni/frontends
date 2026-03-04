import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useAuthStore } from '@/stores/auth.ts';
import { client } from '@/lib/api.ts';
import { useToastStore } from '@fileuni/shared';
import { Lock, Key, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

interface PasswordChangeFormProps {
  onSuccess?: () => void;
  prefilledOldPassword?: string;
  hideOldPassword?: boolean;
  disableOldPassword?: boolean;
}

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({
  onSuccess,
  prefilledOldPassword = '',
  hideOldPassword = false,
  disableOldPassword = false,
}) => {
  const { t } = useTranslation();
  const { currentUserData } = useAuthStore();
  const { addToast } = useToastStore();

  const [oldPassword, setOldPassword] = useState(prefilledOldPassword);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => {
    let strength = 0;
    if (newPassword.length >= 6) strength++;
    if (newPassword.length >= 10) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) strength++;
    return strength;
  }, [newPassword]);

  const isMatch = newPassword === confirmPassword && confirmPassword !== '';
  const canSubmit = newPassword.length >= 6 && isMatch && (hideOldPassword || oldPassword.length > 0);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      if (!currentUserData?.user.id) return;
      const { data, error } = await client.POST('/api/v1/users/auth/{user_id}/change-password', {
        params: { path: { user_id: currentUserData.user.id } },
        body: {
          old_password: oldPassword,
          new_password: newPassword,
        }
      });

      if (error) {
        addToast(error.msg || t('errors.INTERNAL_ERROR'), 'error');
        return;
      }

      if (data?.success) {
        addToast(t('forgotPassword.resetSuccess'), 'success');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      console.error(e);
      addToast(t('errors.INTERNAL_ERROR'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!hideOldPassword && (
        <div className="space-y-2">
          <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
            {t('security.currentPassword') || t('common.password')}
          </label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
            <Input 
              type={showPasswords ? 'text' : 'password'} 
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)} 
              className="pl-12" 
              placeholder={t('security.currentPassword') || "Current Password"} 
              required 
              disabled={disableOldPassword}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
          {t('forgotPassword.newPassword')}
        </label>
        <div className="relative group">
          <Key className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
          <Input 
            type={showPasswords ? 'text' : 'password'} 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)} 
            className="pl-12 pr-12" 
            placeholder={t('forgotPassword.newPassword')} 
            required 
          />
          <button 
            type="button" 
            onClick={() => setShowPasswords(!showPasswords)}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
          >
            {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {newPassword && (
          <div className="flex gap-1 h-1 px-1 mt-2">
            {[1, 3, 5].map(lvl => (
              <div key={lvl} className={cn(
                "flex-1 rounded-full transition-all duration-500",
                passwordStrength >= lvl 
                  ? (lvl === 1 ? 'bg-red-500' : lvl === 3 ? 'bg-yellow-500' : 'bg-green-500') 
                  : 'bg-white/10'
              )} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">
          {t('common.confirmPassword')}
        </label>
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
          <Input 
            type={showPasswords ? 'text' : 'password'} 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            className="pl-12 pr-12" 
            placeholder={t('common.confirmPassword')} 
            required 
          />
          {confirmPassword && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isMatch ? <CheckCircle2 className="text-green-500" size={18} /> : <XCircle className="text-red-500" size={18} />}
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full h-14 text-lg shadow-xl" disabled={loading || !canSubmit}>
          {loading ? <span className="loading-spinner animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : t('forgotPassword.updatePassword')}
        </Button>
      </div>
    </form>
  );
};
