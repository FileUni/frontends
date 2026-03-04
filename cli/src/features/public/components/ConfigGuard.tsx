import React from 'react';
import { useConfigStore } from '@/stores/config.ts';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Home } from 'lucide-react';

interface ConfigGuardProps {
  children: React.ReactNode;
  feature: 'enable_api' | 'enable_webdav' | 'enable_sftp' | 'enable_ftp' | 'enable_s3';
}

/**
 *  配置守卫组件 / Configuration Guard Component
 *  当指定功能被禁用时，显示禁用提示页面 / Shows disabled prompt page when specified feature is disabled
 */
export const ConfigGuard = ({ children, feature }: ConfigGuardProps) => {
  const { capabilities } = useConfigStore();
  const { t } = useTranslation();

  // Check if feature is enabled
  const isEnabled = capabilities?.[feature] !== false;

  if (!isEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">
              {t('configGuard.featureDisabledTitle')}
            </h1>
            <p className="text-sm opacity-50 font-medium">
              {t('configGuard.featureDisabledDesc')}
            </p>
          </div>

          <div className="pt-4">
          <a
            href="#mod=public&page=index"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
              <Home size={18} />
              {t('common.backToHome')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};