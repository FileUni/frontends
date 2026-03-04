import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X, Key, Info } from 'lucide-react';
import { useChat } from '@/hooks/ChatContext.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { toast } from '@fileuni/shared';

export const SessionKeyModal: React.FC = () => {
  const { t } = useTranslation();
  const { isKeyModalOpen, closeKeyModal, keyTargetId, sessionKeys, setSessionKey, nicknames } = useChat();
  const [keyValue, setKeyValue] = useState('');

  useEffect(() => {
    if (isKeyModalOpen) {
      setKeyValue(sessionKeys[keyTargetId] || '');
    }
  }, [isKeyModalOpen, keyTargetId, sessionKeys]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKeyModalOpen) closeKeyModal();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isKeyModalOpen, closeKeyModal]);

  if (!isKeyModalOpen) return null;

  const handleSave = () => {
    setSessionKey(keyTargetId, keyValue.trim());
    if (keyValue.trim()) toast.success(t('chat.sessionKeySet'));
    closeKeyModal();
  };

  const targetName = nicknames[keyTargetId] || keyTargetId.slice(0, 8);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-background border border-border rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-border bg-muted/10 relative">
          <button 
            onClick={closeKeyModal}
            className="absolute right-6 top-6 p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X size={20} className="opacity-40" />
          </button>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">{t('chat.setSessionKey')}</h2>
              <p className="text-sm font-black uppercase opacity-30 tracking-widest">{t('chat.e2e')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-2xl bg-primary/5 border border-primary/10">
            <Info size={18} className="text-primary shrink-0" />
            <p className="text-sm font-bold leading-tight">
              {t('chat.encryptionHint')}
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black uppercase opacity-40 tracking-[0.2em] ml-1">
              {t('chat.conversationWith', { name: targetName })}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">
                <Key size={18} />
              </div>
              <Input
                type="password"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={t('chat.enterSessionKeyPlaceholder')}
                className="h-14 pl-12 pr-4 text-base rounded-2xl bg-muted/20 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="ghost" 
              onClick={closeKeyModal}
              className="flex-1 h-14 rounded-2xl font-black uppercase text-sm tracking-widest"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1 h-14 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-primary/20"
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
