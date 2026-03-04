import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18next from 'i18next';
import { storageHub } from '../lib/storageHub';

export type Language = 'auto' | 'zh' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

/**
 * Global Language State Management
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'auto',
      setLanguage: (lang) => {
        set({ language: lang });
        applyLanguage(lang);
      },
    }),
    {
      name: 'fileuni-language',
      storage: createJSONStorage(() => storageHub.createZustandStorage()),
      onRehydrateStorage: () => (state) => {
        if (state) applyLanguage(state.language);
      }
    }
  )
);

/**
 * Apply language preference
 */
export function applyLanguage(lang: Language) {
  if (typeof window === 'undefined') return;
  
  let targetLang: string = lang;
  if (lang === 'auto') {
    targetLang = (navigator.language.split('-')[0]) || 'en';
  }
  
  i18next.changeLanguage(targetLang);
  storageHub.setLocalItem('fileuni-language-raw', targetLang);
  document.documentElement.lang = targetLang;
}
