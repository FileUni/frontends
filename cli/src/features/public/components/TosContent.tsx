import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from '@/lib/i18n.ts';
import { useThemeStore } from '@fileuni/shared';
import { cn } from '@/lib/utils.ts';
import { storageHub } from '@fileuni/shared';

export const TosContent = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const base = '/ui';

  useEffect(() => {
    setMounted(true);
    const savedLang = storageHub.getLocalItem('fileuni-language-raw') || 'zh';
    i18next.changeLanguage(savedLang);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (!mounted) return <div className="h-screen bg-background" />;

  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      <h1 className="text-5xl font-black mb-10 tracking-tight">{t('tos.title')}</h1>
      <div className={cn(
        "p-10 rounded-[3rem] space-y-8 leading-relaxed font-medium opacity-80 text-lg shadow-2xl border",
        isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
      )}>
        <section>
          <h2 className="text-xl font-black text-primary uppercase tracking-widest mb-4">1. {t('tos.acceptableUse.title')}</h2>
          <p>{t('tos.acceptableUse.content')}</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-primary uppercase tracking-widest mb-4">2. {t('tos.termination.title')}</h2>
          <p>{t('tos.termination.content')}</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-primary uppercase tracking-widest mb-4">3. {t('tos.disclaimers.title')}</h2>
          <p>{t('tos.disclaimers.content')}</p>
        </section>
      </div>
      <div className="mt-12 text-center">
        <a 
          href={`${base}/`} 
          className={cn(
            "btn btn-ghost font-black uppercase tracking-widest transition-all",
            "opacity-40 hover:opacity-100"
          )}
        >
          {t('tos.backToWorkspace')}
        </a>
      </div>
    </div>
  );
};

export default TosContent;
