import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zhTranslation, enTranslation } from '@fileuni/shared';

// Must initialize at the top level of the module to ensure translation resources are available during the SSR phase.
i18next
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhTranslation },
      en: { translation: enTranslation }
    },
    lng: 'zh', // Default language
    fallbackLng: 'en', // Any language missing a key will fall back to English
    interpolation: {
      escapeValue: false
    },
    // Handling logic when the key cannot be found in the current language or English.
    parseMissingKeyHandler: (key) => {
      // If even English is missing, display [key] as a placeholder to avoid blank pages.
      return `[${key}]`;
    },
    // Key: Disable asynchronous loading to ensure consistent hydration.
    initImmediate: false 
  });

export default i18next;
