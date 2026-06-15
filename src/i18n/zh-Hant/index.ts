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
  about: aboutByResourceLocale['zh-Hant'],
  admin: {
    ...adminByResourceLocale['zh-Hant'],
    settings: adminSettingByResourceLocale['zh-Hant'].admin.settings,
    config: {
      ...adminByResourceLocale['zh-Hant'].config,
      ...adminSettingByResourceLocale['zh-Hant'].admin.config,
    },
  },
  auth: authByResourceLocale['zh-Hant'],
  blacklist: blacklistByResourceLocale['zh-Hant'],
  chatBuiltIn: chatBuiltInByResourceLocale['zh-Hant'],
  cacheManager: cacheManagerByResourceLocale['zh-Hant'],
  common: commonByResourceLocale['zh-Hant'],
  errors: errorsByResourceLocale['zh-Hant'],
  filemanager: filemanagerByResourceLocale['zh-Hant'],
  forgotPassword: forgotPasswordByResourceLocale['zh-Hant'],
  launcher: launcherByResourceLocale['zh-Hant'],
  nav: navByResourceLocale['zh-Hant'],
  pages: pagesByResourceLocale['zh-Hant'],
  player: playerByResourceLocale['zh-Hant'],
  privacy: privacyByResourceLocale['zh-Hant'],
  profile: profileByResourceLocale['zh-Hant'],
  security: securityByResourceLocale['zh-Hant'],
  sessions: sessionsByResourceLocale['zh-Hant'],
  systemConfig: systemConfigByResourceLocale['zh-Hant'],
  tos: tosByResourceLocale['zh-Hant'],
  welcome: welcomeByResourceLocale['zh-Hant'],
} as const;

export default translation;
