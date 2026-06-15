import { adminByResourceLocale } from '../bundles/admin';
import { adminSettingByResourceLocale } from '../bundles/adminSetting';
import { aboutByResourceLocale } from '../bundles/about';
import { authByResourceLocale } from '../bundles/auth';
import { blacklistByResourceLocale } from '../bundles/blacklist';
import { cacheManagerByResourceLocale } from '../bundles/cacheManager';
import { chatBuiltInByResourceLocale } from '../bundles/chatBuiltIn';
import { commonByResourceLocale } from '../bundles/common';
import { errorsByResourceLocale } from '../bundles/errors';
import { forgotPasswordByResourceLocale } from '../bundles/forgotPassword';
import { launcherByResourceLocale } from '../bundles/launcher';
import { navByResourceLocale } from '../bundles/nav';
import { pagesByResourceLocale } from '../bundles/pages';
import { privacyByResourceLocale } from '../bundles/privacy';
import { profileByResourceLocale } from '../bundles/profile';
import { securityByResourceLocale } from '../bundles/security';
import { sessionsByResourceLocale } from '../bundles/sessions';
import { systemConfigByResourceLocale } from '../bundles/systemConfig';
import { tosByResourceLocale } from '../bundles/tos';
import { filemanagerByResourceLocale } from '../bundles/filemanager';
import { playerByResourceLocale } from '../bundles/player';
import { welcomeByResourceLocale } from '../bundles/welcome';

const translation = {
  "about": aboutByResourceLocale.es,
  "admin": {
    ...adminByResourceLocale.es,
    "settings": adminSettingByResourceLocale.es.admin.settings,
    "config": {
      ...adminByResourceLocale.es.config,
      ...adminSettingByResourceLocale.es.admin.config,
    },
  },
  "auth": authByResourceLocale.es,
  "blacklist": blacklistByResourceLocale.es,
  "chatBuiltIn": chatBuiltInByResourceLocale.es,
  "cacheManager": cacheManagerByResourceLocale.es,
  "common": commonByResourceLocale.es,
  "errors": errorsByResourceLocale.es,
  "filemanager": filemanagerByResourceLocale.es,
  "forgotPassword": forgotPasswordByResourceLocale.es,
  "launcher": launcherByResourceLocale.es,
  "nav": navByResourceLocale.es,
  "pages": pagesByResourceLocale.es,
  "player": playerByResourceLocale.es,
  "privacy": privacyByResourceLocale.es,
  "profile": profileByResourceLocale.es,
  "security": securityByResourceLocale.es,
  "sessions": sessionsByResourceLocale.es,
  "systemConfig": systemConfigByResourceLocale.es,
  "tos": tosByResourceLocale.es,
  "welcome": welcomeByResourceLocale.es,
} as const;

export default translation;
