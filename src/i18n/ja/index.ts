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
  "about": aboutByResourceLocale.ja,
  "admin": {
    ...adminByResourceLocale.ja,
    "settings": adminSettingByResourceLocale.ja.admin.settings,
    "config": {
      ...adminByResourceLocale.ja.config,
      ...adminSettingByResourceLocale.ja.admin.config,
    },
  },
  "auth": authByResourceLocale.ja,
  "blacklist": blacklistByResourceLocale.ja,
  "chatBuiltIn": chatBuiltInByResourceLocale.ja,
  "cacheManager": cacheManagerByResourceLocale.ja,
  "common": commonByResourceLocale.ja,
  "errors": errorsByResourceLocale.ja,
  "filemanager": filemanagerByResourceLocale.ja,
  "forgotPassword": forgotPasswordByResourceLocale.ja,
  "launcher": launcherByResourceLocale.ja,
  "nav": navByResourceLocale.ja,
  "pages": pagesByResourceLocale.ja,
  "player": playerByResourceLocale.ja,
  "privacy": privacyByResourceLocale.ja,
  "profile": profileByResourceLocale.ja,
  "security": securityByResourceLocale.ja,
  "sessions": sessionsByResourceLocale.ja,
  "systemConfig": systemConfigByResourceLocale.ja,
  "tos": tosByResourceLocale.ja,
  "welcome": welcomeByResourceLocale.ja,
} as const;

export default translation;
