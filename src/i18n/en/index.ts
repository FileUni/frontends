import { adminByResourceLocale } from '../bundles/admin';
import { adminSettingByResourceLocale } from '../bundles/adminSetting';
import { aboutByResourceLocale } from '../bundles/about';
import { authByResourceLocale } from '../bundles/auth';
import { commonByResourceLocale } from '../bundles/common';
import { errorsByResourceLocale } from '../bundles/errors';
import { forgotPasswordByResourceLocale } from '../bundles/forgotPassword';
import { launcherByResourceLocale } from '../bundles/launcher';
import { navByResourceLocale } from '../bundles/nav';
import { privacyByResourceLocale } from '../bundles/privacy';
import { profileByResourceLocale } from '../bundles/profile';
import { securityByResourceLocale } from '../bundles/security';
import { sessionsByResourceLocale } from '../bundles/sessions';
import { tosByResourceLocale } from '../bundles/tos';
import { cacheManagerByResourceLocale } from '../bundles/cacheManager';
import { chatBuiltInByResourceLocale } from '../bundles/chatBuiltIn';
import { filemanagerByResourceLocale } from '../bundles/filemanager';
import { pagesByResourceLocale } from '../bundles/pages';
import { systemConfigByResourceLocale } from '../bundles/systemConfig';
import { blacklistByResourceLocale } from '../bundles/blacklist';
import { playerByResourceLocale } from '../bundles/player';
import { welcomeByResourceLocale } from '../bundles/welcome';

const translation = {
  "about": aboutByResourceLocale.en,
  "admin": {
    ...adminByResourceLocale.en,
    "settings": adminSettingByResourceLocale.en.admin.settings,
    "config": {
      ...adminByResourceLocale.en.config,
      ...adminSettingByResourceLocale.en.admin.config,
    },
  },
  "auth": authByResourceLocale.en,
  "blacklist": blacklistByResourceLocale.en,
  "chatBuiltIn": chatBuiltInByResourceLocale.en,
  "cacheManager": cacheManagerByResourceLocale.en,
  "common": commonByResourceLocale.en,
  "errors": errorsByResourceLocale.en,
  "filemanager": filemanagerByResourceLocale.en,
  "forgotPassword": forgotPasswordByResourceLocale.en,
  "launcher": launcherByResourceLocale.en,
  "nav": navByResourceLocale.en,
  "pages": pagesByResourceLocale.en,
  "player": playerByResourceLocale.en,
  "privacy": privacyByResourceLocale.en,
  "profile": profileByResourceLocale.en,
  "security": securityByResourceLocale.en,
  "sessions": sessionsByResourceLocale.en,
  "systemConfig": systemConfigByResourceLocale.en,
  "tos": tosByResourceLocale.en,
  "welcome": welcomeByResourceLocale.en,
} as const;

export default translation;
