import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { useTranslation } from 'react-i18next';

interface ProviderFormProps {
  providerKey: string;
  credentialJson: string;
  configJson: string;
  onChangeCredential: (json: string) => void;
  onChangeConfig: (json: string) => void;
}

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  required?: boolean;
  isConfig?: boolean; // if true, maps to config_json
  helper?: string;
}

// Reuse standard high-visibility control base
const controlBase = "h-11 rounded-xl border border-zinc-400/60 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-sm font-bold text-foreground placeholder:opacity-30";

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  aliyun: [
    { key: 'access_key_id', label: 'AccessKey ID', required: true },
    { key: 'access_key_secret', label: 'AccessKey Secret', type: 'password', required: true },
  ],
  tencentcloud: [
    { key: 'secret_id', label: 'SecretId', required: true },
    { key: 'secret_key', label: 'SecretKey', type: 'password', required: true },
  ],
  dnspod: [
    { key: 'token_id', label: 'Token ID', required: true },
    { key: 'token_key', label: 'Token Key', type: 'password', required: true },
  ],
  cloudflare: [
    { key: 'api_token', label: 'API Token', type: 'password', placeholder: 'Cloudflare API Token', required: true },
  ],
  aws: [
    { key: 'access_key_id', label: 'AccessKey ID', required: true },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'hosted_zone_id', label: 'Hosted Zone ID', required: true },
    { key: 'session_token', label: 'Session Token', type: 'password', placeholder: 'Optional' },
  ],
  huaweicloud: [
    { key: 'token', label: 'IAM Token', type: 'password' },
    { key: 'zone_id', label: 'Zone ID', placeholder: 'Optional' },
    { key: 'username', label: 'Username', placeholder: 'Password mode only' },
    { key: 'password', label: 'Password', type: 'password', placeholder: 'Password mode only' },
    { key: 'domain_name', label: 'Domain Name', placeholder: 'Password mode only' },
  ],
  volcengine: [
    { key: 'access_key_id', label: 'AccessKey ID', required: true },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
  ],
  google: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'project_id', label: 'Project ID', required: true, isConfig: true },
    { key: 'managed_zone', label: 'Managed Zone', required: true, isConfig: true },
  ],
  azure: [
    { key: 'subscription_id', label: 'Subscription ID', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Token mode' },
    { key: 'tenant_id', label: 'Tenant ID', placeholder: 'SP mode' },
    { key: 'client_id', label: 'Client ID', placeholder: 'SP mode' },
    { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'SP mode' },
    { key: 'resource_group', label: 'Resource Group', placeholder: 'Optional' },
    { key: 'zone_name', label: 'Zone Name', placeholder: 'Optional' },
  ],
  godaddy: [
    { key: 'key', label: 'API Key', required: true },
    { key: 'secret', label: 'API Secret', type: 'password', required: true },
  ],
  gandi: [
    { key: 'api_key', label: 'API Key', type: 'password' },
    { key: 'bearer_token', label: 'Bearer Token', type: 'password' },
  ],
  digitalocean: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  vultr: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  linode: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  duckdns: [
    { key: 'token', label: 'Token', type: 'password', required: true },
    { key: 'domain', label: 'Domain', placeholder: 'Optional default domain' },
  ],
  callback: [
    { key: 'url', label: 'Webhook URL', required: true },
    { key: 'method', label: 'Method', placeholder: 'POST' },
  ],
};

export const ProviderForm: React.FC<ProviderFormProps> = ({
  providerKey,
  credentialJson,
  configJson,
  onChangeCredential,
  onChangeConfig,
}) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'form' | 'raw'>('form');

  useEffect(() => {
    try {
      const cred = JSON.parse(credentialJson || '{}');
      const conf = JSON.parse(configJson || '{}');
      setFields({ ...cred, ...conf });
    } catch {
      setMode('raw');
    }
  }, [providerKey, credentialJson, configJson]);

  const handleFieldChange = (key: string, value: string) => {
    const newFields = { ...fields, [key]: value };
    setFields(newFields);

    const fieldDefs = PROVIDER_FIELDS[providerKey] || [];
    const credObj: Record<string, string> = {};
    const confObj: Record<string, string> = {};

    fieldDefs.forEach(def => {
      if (newFields[def.key]) {
        if (def.isConfig) {
          confObj[def.key] = newFields[def.key];
        } else {
          credObj[def.key] = newFields[def.key];
        }
      }
    });

    onChangeCredential(JSON.stringify(credObj));
    onChangeConfig(JSON.stringify(confObj));
  };

  const currentDefs = PROVIDER_FIELDS[providerKey];

  if (!currentDefs || mode === 'raw') {
    return (
      <div className="space-y-4 text-foreground">
        <div className="flex justify-end">
          {currentDefs && (
            <button
              type="button"
              className="text-[14px] font-black uppercase tracking-widest text-primary underline underline-offset-4"
              onClick={() => setMode('form')}
            >
              Switch to Form Mode
            </button>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-[14px] font-black uppercase tracking-widest opacity-50 dark:opacity-40 ml-1">{t('admin.domain.credentialJson')}</label>
          <textarea
            className="w-full min-h-[100px] rounded-xl border border-zinc-400/60 dark:border-white/5 bg-white dark:bg-black/20 px-4 py-3 font-mono text-sm text-foreground dark:text-white/80 outline-none focus:border-primary/30 transition-all shadow-inner"
            value={credentialJson}
            onChange={(e) => onChangeCredential(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[14px] font-black uppercase tracking-widest opacity-50 dark:opacity-40 ml-1">{t('admin.domain.configJson')}</label>
          <textarea
            className="w-full min-h-[100px] rounded-xl border border-zinc-400/60 dark:border-white/5 bg-white dark:bg-black/20 px-4 py-3 font-mono text-sm text-foreground dark:text-white/80 outline-none focus:border-primary/30 transition-all shadow-inner"
            value={configJson}
            onChange={(e) => onChangeConfig(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="text-[14px] font-black uppercase tracking-widest text-primary underline underline-offset-4 opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => setMode('raw')}
        >
          {t('common.switchToRawJson')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {currentDefs.map((def) => (
          <div key={def.key} className="space-y-1.5">
            <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">
              {def.label}
              {def.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <Input
              type={def.type || 'text'}
              placeholder={def.placeholder}
              value={fields[def.key] || ''}
                  onChange={(e) => handleFieldChange(def.key, e.target.value)}
              className={controlBase}
            />
            {def.helper && <div className="text-[14px] opacity-50 dark:opacity-30 italic text-foreground/60">{def.helper}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
