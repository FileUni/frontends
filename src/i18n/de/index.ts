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
  "about": aboutByResourceLocale.de,
  "admin": {
    ...adminByResourceLocale.de,
    "settings": adminSettingByResourceLocale.de.admin.settings,
    "config": {
      ...adminByResourceLocale.de.config,
      ...adminSettingByResourceLocale.de.admin.config,
    },
  },
  "auth": authByResourceLocale.de,
  "blacklist": blacklistByResourceLocale.de,
  "chatBuiltIn": chatBuiltInByResourceLocale.de,
  "cacheManager": cacheManagerByResourceLocale.de,
  "common": commonByResourceLocale.de,
  "errors": errorsByResourceLocale.de,
  "filemanager": filemanagerByResourceLocale.de,
  "forgotPassword": forgotPasswordByResourceLocale.de,
  "launcher": launcherByResourceLocale.de,
  "nav": navByResourceLocale.de,
  "pages": pagesByResourceLocale.de,
  "player": playerByResourceLocale.de,
  "privacy": privacyByResourceLocale.de,
  "profile": profileByResourceLocale.de,
  "security": securityByResourceLocale.de,
  "sessions": sessionsByResourceLocale.de,
  "systemConfig": systemConfigByResourceLocale.de,
  "tos": tosByResourceLocale.de,
  "welcome": welcomeByResourceLocale.de,
} as const;

export default translation;
