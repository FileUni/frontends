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
  "about": aboutByResourceLocale['zh-CN'],
  "admin": {
    ...adminByResourceLocale['zh-CN'],
    "settings": adminSettingByResourceLocale['zh-CN'].admin.settings,
    "config": {
      ...adminByResourceLocale['zh-CN'].config,
      ...adminSettingByResourceLocale['zh-CN'].admin.config,
    },
  },
  "auth": authByResourceLocale['zh-CN'],
  "blacklist": blacklistByResourceLocale['zh-CN'],
  "chatBuiltIn": chatBuiltInByResourceLocale['zh-CN'],
  "cacheManager": cacheManagerByResourceLocale['zh-CN'],
  "common": commonByResourceLocale['zh-CN'],
  "errors": errorsByResourceLocale['zh-CN'],
  "filemanager": filemanagerByResourceLocale['zh-CN'],
  "forgotPassword": forgotPasswordByResourceLocale['zh-CN'],
  "launcher": launcherByResourceLocale['zh-CN'],
  "nav": navByResourceLocale['zh-CN'],
  "pages": pagesByResourceLocale['zh-CN'],
  "player": playerByResourceLocale['zh-CN'],
  "privacy": privacyByResourceLocale['zh-CN'],
  "profile": profileByResourceLocale['zh-CN'],
  "security": securityByResourceLocale['zh-CN'],
  "sessions": sessionsByResourceLocale['zh-CN'],
  "systemConfig": systemConfigByResourceLocale['zh-CN'],
  "tos": tosByResourceLocale['zh-CN'],
  "welcome": welcomeByResourceLocale['zh-CN'],
} as const;

export default translation;
