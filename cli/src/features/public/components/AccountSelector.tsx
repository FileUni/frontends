import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.ts';
import { useToastStore } from '@fileuni/shared';
import { useThemeStore } from '@fileuni/shared';
import { 
  Trash2, ChevronRight, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';

interface AccountSelectorProps {
  onSelect?: (userId: string) => void;
  onAddAccount?: () => void;
  className?: string;
  showAddButton?: boolean;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({ 
  onSelect, 
  onAddAccount,
  className,
  showAddButton = true
}) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { usersMap, currentUserId, switchUser, logout } = useAuthStore();
  const { addToast } = useToastStore();
  const [mounted, setMounted] = useState(false);
  
  const savedUsers = Object.values(usersMap);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleSelect = (userId: string) => {
    if (userId !== currentUserId) {
      switchUser(userId);
      addToast(t("auth.switchSuccess"), "success");
    }
    
    if (onSelect) {
      onSelect(userId);
    } else {
      window.location.reload();
    }
  };

  const handleDelete = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (confirm(t('auth.removeAccountConfirm'))) {
      logout(userId);
      addToast(t("auth.accountRemoved"), "success");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        {savedUsers.map((auth) => (
          <div 
            key={auth.user.id}
            className={cn(
              "group relative flex items-center justify-between p-4 rounded-[1.5rem] transition-all cursor-pointer border",
              auth.user.id === currentUserId 
                ? (isDark ? "bg-primary/10 border-primary/30 shadow-lg shadow-primary/5" : "bg-primary/5 border-primary/20 shadow-sm")
                : (isDark ? "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10" : "bg-white border-gray-100 hover:bg-gray-50 shadow-sm")
            )}
            onClick={() => handleSelect(auth.user.id)}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner",
                auth.user.id === currentUserId 
                  ? "bg-primary text-white" 
                  : (isDark ? "bg-white/5 text-primary/60" : "bg-primary/10 text-primary")
              )}>
                {auth.user.username[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("font-black truncate", isDark ? "text-white" : "text-gray-900")}>{auth.user.username}</p>
                  {auth.user.id === currentUserId && (
                    <span className="text-[14px] px-1.5 py-0.5 rounded-full bg-primary text-white font-black uppercase tracking-tighter">
                      {t('auth.activeAccount')}
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-40 font-bold uppercase tracking-tighter">
                  {auth.user.email || t('auth.member')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => handleDelete(e, auth.user.id)}
                className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title={t('auth.removeAccount')}
              >
                <Trash2 size={16} />
              </button>
              <ChevronRight size={18} className={cn(
                "transition-opacity",
                auth.user.id === currentUserId ? "opacity-40" : "opacity-0 group-hover:opacity-20"
              )} />
            </div>
          </div>
        ))}
      </div>

      {showAddButton && (
        <button 
          onClick={onAddAccount}
          className={cn(
            "w-full h-14 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3 font-black text-sm opacity-60 hover:opacity-100",
            isDark ? "border-white/10 hover:border-primary/50 hover:bg-primary/5" : "border-gray-200 hover:border-primary/50 hover:bg-primary/5"
          )}
        >
          <Plus size={20} />
          {t('auth.addNewAccount')}
        </button>
      )}
    </div>
  );
};
