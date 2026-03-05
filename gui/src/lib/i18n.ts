import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zhTranslation, enTranslation } from '@fileuni/shared';

// Must initialize at the top level of the module
i18next
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation }
    },
    lng: 'zh',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    parseMissingKeyHandler: (key) => {
      return `[${key}]`;
    },
    initImmediate: false 
  });

export default i18next;
