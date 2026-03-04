import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useAuthStore } from '@/stores/auth.ts';
import { AlertTriangle } from 'lucide-react';
import { PasswordChangeForm } from '@/features/user-center/components/PasswordChangeForm.tsx';

export const MustChangePasswordModal = () => {
  const { t } = useTranslation();
  const { mustChangePassword, setMustChangePassword, mustChangePasswordDismissed, setMustChangePasswordDismissed, logout } = useAuthStore();

  if (!mustChangePassword || mustChangePasswordDismissed) return null;

  return (
    <Modal
      isOpen={mustChangePassword}
      onClose={() => setMustChangePasswordDismissed(true)}
      title={t('nav.changePassword')}
      className="max-w-md border-orange-500/30"
    >
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-4">
          <AlertTriangle className="text-orange-500 shrink-0 mt-1" size={20} />
          <div>
            <p className="text-sm font-black text-orange-200/90 leading-tight mb-1">
              {t('auth.defaultPasswordWarning')}
            </p>
            <p className="text-sm font-bold text-orange-200/60 leading-relaxed italic">
              {t('auth.defaultPasswordDesc')}
            </p>
          </div>
        </div>

        <PasswordChangeForm 
          prefilledOldPassword="admin888"
          disableOldPassword={true}
          onSuccess={() => {
            setMustChangePassword(false);
            setMustChangePasswordDismissed(true);
          }}
        />

        <div className="flex flex-col gap-3 pt-2">
          <Button variant="outline" type="button" className="w-full h-12" onClick={() => setMustChangePasswordDismissed(true)}>
            {t('common.doNotShowAgain') || 'Ignore for now'}
          </Button>
          <Button variant="ghost" type="button" className="w-full text-sm opacity-50 hover:opacity-100" onClick={() => logout()}>
            {t('common.logout')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
