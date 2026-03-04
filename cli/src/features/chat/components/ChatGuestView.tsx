import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatProvider, useChat } from '@/hooks/ChatContext.tsx';
import { MessageSquare, Shield, Clock, Globe, Zap } from 'lucide-react';
import { Input } from '@/components/ui/Input.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { ChatUnifiedUI } from '@/components/chat/ChatUnifiedUI';

/**
 * 访客入口视图 - 仅负责输入邀请码并初始化 ChatProvider
 * Guest Entry View - Only responsible for invite code entry and initializing ChatProvider
 */
export const ChatGuestView: React.FC<{ inviteCode?: string }> = ({ inviteCode }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState(inviteCode || '');
  const [activeCode, setActiveCode] = useState(inviteCode || '');

  // 渲染主体由 ChatUnifiedUI 负责 / Rendering logic is handled by ChatUnifiedUI
  const GuestWrapper: React.FC = () => {
    const { setIsOpen } = useChat();
    useEffect(() => {
      // 访客模式下自动打开聊天界面 / Auto-open chat UI in guest mode
      setIsOpen(true);
    }, []);
    return <ChatUnifiedUI />;
  };

  if (!activeCode) {
    return (
      <div className="max-w-xl mx-auto mt-24 p-12 bg-background border border-border rounded-[3rem] shadow-2xl space-y-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary mx-auto shadow-inner">
          <MessageSquare size={48} />
        </div>
        <div className="space-y-3">
          <h2 className="text-4xl font-black tracking-tighter">{t('chat.guestEntry')}</h2>
          <p className="text-muted-foreground font-medium">{t('chat.welcomeDesc')}</p>
        </div>
        
        <div className="space-y-5">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('chat.inviteCode')}
            className="text-center h-16 text-2xl tracking-widest font-black uppercase rounded-2xl border-2 focus:border-primary/50"
          />
          <Button
            onClick={() => setActiveCode(code.trim())}
            className="w-full h-16 text-xl rounded-2xl shadow-xl shadow-primary/20"
            disabled={!code.trim()}
          >
            {t('chat.joinChat')}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
           <div className="space-y-2">
             <Shield size={20} className="text-primary mx-auto opacity-60" />
             <p className="text-sm font-black uppercase opacity-40 tracking-widest">{t('chat.e2eEncryption')}</p>
           </div>
           <div className="space-y-2">
             <Clock size={20} className="text-primary mx-auto opacity-60" />
             <p className="text-sm font-black uppercase opacity-40 tracking-widest">{t('chat.saveHistory')}</p>
           </div>
           <div className="space-y-2">
             <Globe size={20} className="text-primary mx-auto opacity-60" />
             <p className="text-sm font-black uppercase opacity-40 tracking-widest">{t('chat.multiBackend')}</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-muted/5 overflow-hidden">
      <div className="h-16 shrink-0" />
      <div className="flex-1 p-4 overflow-hidden relative">
        <ChatProvider auth={{ type: 'guest', inviteCode: activeCode }}>
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 select-none">
             <Zap size={48} className="text-primary animate-pulse" />
             <p className="font-black uppercase tracking-[0.2em] text-sm">{t('chat.terminalActive')}</p>
          </div>
          <GuestWrapper />
        </ChatProvider>
      </div>
    </div>
  );
};
