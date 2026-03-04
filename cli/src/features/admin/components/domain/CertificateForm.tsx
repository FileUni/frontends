import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, Mail, Globe, Settings, Plus, Trash2, Cpu, Link as LinkIcon, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CertificateFormProps {
  name: string;
  onChangeName: (name: string) => void;
  domainsJson: string;
  onChangeDomains: (json: string) => void;
  challengeType: 'dns01' | 'http01';
  onChangeChallengeType: (type: 'dns01' | 'http01') => void;
  caProvider: string;
  onChangeCaProvider: (provider: string) => void;
  accountEmail: string;
  onChangeAccountEmail: (email: string) => void;
  dnsConfigJson: string;
  onChangeDnsConfig: (json: string) => void;
  providerAccountId?: string;
  onChangeProviderAccountId: (id: string) => void;
  providers: { id: string; name: string; provider_key: string }[];
  zeroSslAccounts: { id: string; name: string }[];
  exportPath?: string;
  onChangeExportPath: (path: string) => void;
  onOpenProviderModal?: () => void;
  onOpenZeroSslModal?: () => void;
}

const SectionHeader = ({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc?: string }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
      <Icon size={16} />
    </div>
    <div>
      <h4 className="text-sm font-black uppercase tracking-widest text-foreground/80 leading-none mb-1">{title}</h4>
      {desc && <p className="text-[14px] opacity-60 dark:opacity-40 font-bold uppercase tracking-tighter leading-none text-foreground/60 dark:text-foreground/40">{desc}</p>}
    </div>
  </div>
);

// High-visibility classes for form controls
const controlBase = "h-11 rounded-xl border border-zinc-400/60 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all shadow-sm font-bold text-foreground placeholder:opacity-30";
const selectBase = cn(controlBase, "appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem]");
const selectStyle = { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'currentColor\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")' };

export const CertificateForm: React.FC<CertificateFormProps> = ({
  name,
  onChangeName,
  domainsJson,
  onChangeDomains,
  challengeType,
  onChangeChallengeType,
  caProvider,
  onChangeCaProvider,
  accountEmail,
  onChangeAccountEmail,
  dnsConfigJson,
  onChangeDnsConfig,
  providerAccountId,
  onChangeProviderAccountId,
  providers,
  zeroSslAccounts,
  exportPath,
  onChangeExportPath,
  onOpenProviderModal,
  onOpenZeroSslModal,
}) => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<string[]>([]);
  const [dnsConfig, setDnsConfig] = useState<Record<string, unknown>>({});
  const [newDomain, setNewDomain] = useState('');

  const getConfigValue = (key: string): string => {
    const value = dnsConfig[key];
    return typeof value === 'string' ? value : '';
  };

  const parseChallengeType = (value: string): 'dns01' | 'http01' => {
    return value === 'http01' ? 'http01' : 'dns01';
  };

  useEffect(() => {
    try {
      const parsed = JSON.parse(domainsJson || '[]');
      if (Array.isArray(parsed)) setDomains(parsed);
    } catch {
      setDomains([]);
    }
  }, [domainsJson]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(dnsConfigJson || '{}');
      setDnsConfig(parsed);
    } catch {
      setDnsConfig({});
    }
  }, [dnsConfigJson]);

  const updateDomains = (newDomains: string[]) => {
    setDomains(newDomains);
    onChangeDomains(JSON.stringify(newDomains));
  };

  const addDomain = () => {
    if (newDomain.trim()) {
      updateDomains([...domains, newDomain.trim()]);
      setNewDomain('');
    }
  };

  const removeDomain = (index: number) => {
    const next = [...domains];
    next.splice(index, 1);
    updateDomains(next);
  };

  const updateDnsConfig = (key: string, value: string) => {
    const next = { ...dnsConfig, [key]: value };
    setDnsConfig(next);
    onChangeDnsConfig(JSON.stringify(next));
  };

  return (
    <div className="space-y-8">
      {/* Identity Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-gray-100/30 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 shadow-inner">
        <div className="space-y-4">
          <SectionHeader icon={Shield} title={t('admin.domain.certIdentity')} desc={t('admin.domain.certIdentityDesc')} />
          <div className="space-y-2">
            <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.name')}</label>
            <Input value={name} onChange={(e) => onChangeName(e.target.value)} placeholder={t('admin.domain.certNamePlaceholder')} className={controlBase} />
          </div>
        </div>
        <div className="space-y-4">
          <SectionHeader icon={Mail} title={t('admin.domain.contactInfo')} desc={t('admin.domain.contactInfoDesc')} />
          <div className="space-y-2">
            <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.accountEmail')}</label>
            <Input value={accountEmail} onChange={(e) => onChangeAccountEmail(e.target.value)} placeholder={t('admin.domain.certAccountEmailPlaceholder')} className={controlBase} />
          </div>
        </div>
      </div>

      {/* Domain Management */}
      <div className="p-6 rounded-2xl bg-gray-100/30 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 shadow-inner space-y-4">
        <SectionHeader icon={Globe} title={t('admin.domain.domainMgmt')} desc={t('admin.domain.domainMgmtDesc')} />
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder={t('admin.domain.certDomainsInputPlaceholder')}
              className={controlBase}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
            />
            <Button onClick={addDomain} variant="outline" className="h-11 px-6 border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 shrink-0 shadow-sm font-bold">
              <Plus size={16} className="mr-2" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[44px] p-3 rounded-xl bg-gray-200/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 shadow-inner text-foreground">
            {domains.map((d, i) => (
              <Badge key={i} variant="outline" className="h-8 pl-3 pr-1 rounded-lg bg-primary/10 text-primary border-primary/20 flex items-center gap-2 group shadow-sm">
                <span className="text-sm font-mono font-bold">{d}</span>
                <button onClick={() => removeDomain(i)} className="p-1 rounded-md hover:bg-red-500 hover:text-white transition-all opacity-40 group-hover:opacity-100">
                  <Trash2 size={18} />
                </button>
              </Badge>
            ))}
            {domains.length === 0 && <div className="w-full flex items-center justify-center text-[14px] font-black uppercase tracking-widest opacity-40 dark:opacity-20 py-2 italic">{t('admin.domain.noDomainAssets')}</div>}
          </div>
        </div>
      </div>

      {/* Configuration Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-gray-100/30 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 shadow-inner">
        <div className="space-y-6">
          <SectionHeader icon={Settings} title={t('admin.domain.issuanceChallenge')} desc={t('admin.domain.issuanceChallengeDesc')} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.caProvider')}</label>
              <select className={selectBase} style={selectStyle} value={caProvider} onChange={(e) => onChangeCaProvider(e.target.value)}>
                <option value="letsencrypt">Let's Encrypt</option>
                <option value="letsencrypt-staging">Staging (Test)</option>
                <option value="zerossl">ZeroSSL</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.challengeType')}</label>
              <select className={selectBase} style={selectStyle} value={challengeType} onChange={(e) => onChangeChallengeType(parseChallengeType(e.target.value))}>
                <option value="dns01">DNS-01</option>
                <option value="http01">HTTP-01</option>
              </select>
            </div>
          </div>

          {challengeType === 'dns01' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.dnsProvider')}</label>
              <div className="flex gap-2">
                <select className={selectBase} style={selectStyle} value={providerAccountId || ''} onChange={(e) => onChangeProviderAccountId(e.target.value)}>
                  <option value="">{t('admin.acme.form.providerSelectPlaceholder')}</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.provider_key})</option>)}
                </select>
                <Button type="button" variant="outline" onClick={onOpenProviderModal} className="h-11 w-11 p-0 border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 shrink-0 shadow-sm">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          )}

          {challengeType === 'http01' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.acme.form.httpWebroot')}</label>
              <Input value={getConfigValue('webroot') || getConfigValue('http_webroot')} onChange={(e) => updateDnsConfig('webroot', e.target.value)} placeholder={t('admin.domain.certHttpWebrootInputPlaceholder')} className={controlBase} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <SectionHeader icon={Cpu} title={t('admin.domain.advAutomation')} desc={t('admin.domain.advAutomationDesc')} />
          
          {caProvider === 'zerossl' && (
            <div className="space-y-2 p-4 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/5 border border-cyan-500/20 dark:border-cyan-500/10 animate-in fade-in zoom-in-95 shadow-sm">
              <label className="text-[14px] font-black uppercase tracking-widest text-cyan-700 dark:text-cyan-400 opacity-80 flex items-center gap-2">
                <LinkIcon size={18}/> {t('admin.domain.zerosslEab')}
              </label>
              <div className="flex gap-2">
                <select className={cn(selectBase, "border-cyan-500/30 dark:border-cyan-500/20")} style={selectStyle} value={getConfigValue('zerossl_account_id')} onChange={(e) => updateDnsConfig('zerossl_account_id', e.target.value)}>
                  <option value="">{t('admin.acme.form.providerSelectPlaceholder')}</option>
                  {zeroSslAccounts.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <Button type="button" variant="outline" onClick={onOpenZeroSslModal} className="h-11 w-11 p-0 border-cyan-500/30 dark:border-cyan-500/20 bg-white dark:bg-cyan-500/5 hover:bg-cyan-100 dark:hover:bg-cyan-500/10 text-cyan-700 dark:text-cyan-500 shrink-0 shadow-sm">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[14px] font-black uppercase tracking-widest text-foreground/50 dark:text-foreground/40 ml-1">{t('admin.domain.exportPath')}</label>
            <div className="relative">
              <Input value={exportPath || ''} onChange={(e) => onChangeExportPath(e.target.value)} placeholder={t('admin.domain.certExportPlaceholder')} className={controlBase} />
              <ExternalLink size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 dark:text-white/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
