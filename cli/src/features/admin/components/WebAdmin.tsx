import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { Switch } from '@/components/ui/Switch.tsx';
import { client, extractData, handleApiError } from '@/lib/api.ts';
import { useToastStore } from '@fileuni/shared';
import { Globe, Plus, RefreshCw, ShieldCheck, Trash2, Pencil, Save, Server, Network } from 'lucide-react';

type RouteMode = 'static' | 'proxy';

interface SiteBinding {
  listen_ip: string;
  listen_port: number;
  hostnames: string[];
  is_default: boolean;
}

interface SitePayload {
  name: string;
  enabled: boolean;
  bindings: SiteBinding[];
  tls_enabled: boolean;
  tls_acme_cert_id?: string;
  tls_cert_path?: string;
  tls_key_path?: string;
  route_mode: RouteMode;
  static_root?: string;
  proxy_upstream?: string;
  proxy_tls_insecure_skip_verify: boolean;
}

interface SiteView extends SitePayload {
  id: string;
  created_at: string;
  updated_at: string;
}

interface SiteDraft {
  id?: string;
  name: string;
  enabled: boolean;
  bindings: SiteBinding[];
  tls_enabled: boolean;
  tls_acme_cert_id: string;
  tls_cert_path: string;
  tls_key_path: string;
  route_mode: RouteMode;
  static_root: string;
  proxy_upstream: string;
  proxy_tls_insecure_skip_verify: boolean;
}

const defaultBinding = (): SiteBinding => ({
  listen_ip: '0.0.0.0',
  listen_port: 80,
  hostnames: ['example.com'],
  is_default: false,
});

const defaultDraft = (): SiteDraft => ({
  name: 'new-site',
  enabled: true,
  bindings: [defaultBinding()],
  tls_enabled: false,
  tls_acme_cert_id: '',
  tls_cert_path: '',
  tls_key_path: '',
  route_mode: 'static',
  static_root: './dist/site',
  proxy_upstream: 'http://127.0.0.1:8080',
  proxy_tls_insecure_skip_verify: false,
});

const toDraft = (site: SiteView): SiteDraft => ({
  id: site.id,
  name: site.name,
  enabled: site.enabled,
  bindings: site.bindings.length > 0 ? site.bindings.map((item) => ({ ...item })) : [defaultBinding()],
  tls_enabled: site.tls_enabled,
  tls_acme_cert_id: site.tls_acme_cert_id || '',
  tls_cert_path: site.tls_cert_path || '',
  tls_key_path: site.tls_key_path || '',
  route_mode: site.route_mode,
  static_root: site.static_root || '',
  proxy_upstream: site.proxy_upstream || '',
  proxy_tls_insecure_skip_verify: site.proxy_tls_insecure_skip_verify ?? false,
});

const normalizeHostnames = (raw: string): string[] => {
  const out = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return Array.from(new Set(out));
};

const listenerKey = (item: SiteBinding, tlsEnabled: boolean): string => `${item.listen_ip}:${item.listen_port}:${tlsEnabled ? 'tls' : 'plain'}`;

const hasHostOverlap = (left: string[], right: string[]): boolean => {
  for (const lhs of left) {
    for (const rhs of right) {
      if (lhs === rhs || lhs === '*' || rhs === '*') {
        return true;
      }
    }
  }
  return false;
};

interface ListenerDiagnostic {
  listenerKey: string;
  currentBindings: SiteBinding[];
  remoteBindings: Array<{ site: string; binding: SiteBinding }>;
  errors: string[];
}

interface DomainCertAssetView {
  id: string;
  name: string;
  domains_json?: string | null;
  expires_at?: string | null;
  status?: string | null;
}

interface DomainAssetView {
  fqdn: string;
  status?: string | null;
}

const toPayload = (draft: SiteDraft): SitePayload => ({
  name: draft.name.trim(),
  enabled: draft.enabled,
  bindings: draft.bindings.map((item) => ({
    listen_ip: item.listen_ip.trim(),
    listen_port: Number(item.listen_port),
    hostnames: item.hostnames,
    is_default: item.is_default,
  })),
  tls_enabled: draft.tls_enabled,
  tls_acme_cert_id: draft.tls_acme_cert_id.trim() || undefined,
  tls_cert_path: draft.tls_cert_path.trim() || undefined,
  tls_key_path: draft.tls_key_path.trim() || undefined,
  route_mode: draft.route_mode,
  static_root: draft.route_mode === 'static' ? (draft.static_root.trim() || undefined) : undefined,
  proxy_upstream: draft.route_mode === 'proxy' ? (draft.proxy_upstream.trim() || undefined) : undefined,
  proxy_tls_insecure_skip_verify:
    draft.route_mode === 'proxy' && draft.proxy_upstream.trim().startsWith('https://')
      ? draft.proxy_tls_insecure_skip_verify
      : false,
});

export const WebAdmin: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();

  const [sites, setSites] = useState<SiteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [domainCertAssets, setDomainCertAssets] = useState<DomainCertAssetView[]>([]);
  const [domainAssets, setDomainAssets] = useState<DomainAssetView[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<SiteDraft>(defaultDraft());
  const canToggleProxyTlsInsecure = draft.route_mode === 'proxy' && draft.proxy_upstream.trim().startsWith('https://');

  useEffect(() => {
    if (!canToggleProxyTlsInsecure && draft.proxy_tls_insecure_skip_verify) {
      setDraft((prev) => ({ ...prev, proxy_tls_insecure_skip_verify: false }));
    }
  }, [canToggleProxyTlsInsecure, draft.proxy_tls_insecure_skip_verify]);

  const draftWarnings = useMemo(() => {
    const warnings: string[] = [];
    const defaultCounter = new Map<string, number>();
    const hostnameCounter = new Set<string>();

    for (const binding of draft.bindings) {
      const groupKey = listenerKey(binding, draft.tls_enabled);
      if (binding.is_default) {
        const count = defaultCounter.get(groupKey) || 0;
        defaultCounter.set(groupKey, count + 1);
      }

      for (const host of binding.hostnames) {
        const hostKey = `${groupKey}:${host}`;
        if (hostnameCounter.has(hostKey)) {
          warnings.push(t('admin.web.warnings.duplicateHostInSite', { key: `${binding.listen_ip}:${binding.listen_port}`, host }));
        } else {
          hostnameCounter.add(hostKey);
        }
      }
    }

    for (const [key, count] of defaultCounter.entries()) {
      if (count > 1) {
        warnings.push(t('admin.web.warnings.multiDefaultInListener', { key }));
      }
    }

    const others = sites.filter((item) => item.id !== draft.id && item.enabled && item.tls_enabled === draft.tls_enabled);
    for (const current of draft.bindings) {
      for (const otherSite of others) {
        for (const otherBinding of otherSite.bindings) {
          if (current.listen_ip !== otherBinding.listen_ip || current.listen_port !== otherBinding.listen_port) {
            continue;
          }
          if (current.is_default && otherBinding.is_default) {
            warnings.push(t('admin.web.warnings.defaultConflict', { site: otherSite.name, key: `${current.listen_ip}:${current.listen_port}` }));
          }
          if (hasHostOverlap(current.hostnames, otherBinding.hostnames)) {
            warnings.push(t('admin.web.warnings.hostnameConflict', { site: otherSite.name, key: `${current.listen_ip}:${current.listen_port}` }));
          }
        }
      }
    }

    return Array.from(new Set(warnings));
  }, [draft, sites, t]);

  const listenerDiagnostics = useMemo<ListenerDiagnostic[]>(() => {
    const groups = new Map<string, ListenerDiagnostic>();
    const others = sites.filter((item) => item.id !== draft.id && item.enabled && item.tls_enabled === draft.tls_enabled);

    const getGroup = (key: string): ListenerDiagnostic => {
      const existing = groups.get(key);
      if (existing) {
        return existing;
      }
      const created: ListenerDiagnostic = {
        listenerKey: key,
        currentBindings: [],
        remoteBindings: [],
        errors: [],
      };
      groups.set(key, created);
      return created;
    };

    for (const binding of draft.bindings) {
      const key = listenerKey(binding, draft.tls_enabled);
      const group = getGroup(key);
      group.currentBindings.push(binding);
    }

    for (const otherSite of others) {
      for (const otherBinding of otherSite.bindings) {
        const key = listenerKey(otherBinding, draft.tls_enabled);
        const group = getGroup(key);
        group.remoteBindings.push({ site: otherSite.name, binding: otherBinding });
      }
    }

    for (const group of groups.values()) {
      const defaultCount = group.currentBindings.filter((item) => item.is_default).length;
      if (defaultCount > 1) {
        group.errors.push(t('admin.web.warnings.multiDefaultInListener', { key: group.listenerKey }));
      }

      const hostnameSeen = new Set<string>();
      for (const current of group.currentBindings) {
        for (const host of current.hostnames) {
          const hostKey = host.toLowerCase();
          if (hostnameSeen.has(hostKey)) {
            group.errors.push(t('admin.web.warnings.duplicateHostInSite', { key: group.listenerKey, host }));
          } else {
            hostnameSeen.add(hostKey);
          }
        }
      }

      for (const current of group.currentBindings) {
        for (const remote of group.remoteBindings) {
          if (current.is_default && remote.binding.is_default) {
            group.errors.push(t('admin.web.warnings.defaultConflict', { site: remote.site, key: group.listenerKey }));
          }
          if (hasHostOverlap(current.hostnames, remote.binding.hostnames)) {
            group.errors.push(t('admin.web.warnings.hostnameConflict', { site: remote.site, key: group.listenerKey }));
          }
        }
      }

      group.errors = Array.from(new Set(group.errors));
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aScore = a.errors.length;
      const bScore = b.errors.length;
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      return a.listenerKey.localeCompare(b.listenerKey);
    });
  }, [draft, sites, t]);

  const totals = useMemo(() => {
    const enabled = sites.filter((s) => s.enabled).length;
    const tls = sites.filter((s) => s.tls_enabled).length;
    const proxy = sites.filter((s) => s.route_mode === 'proxy').length;
    return {
      all: sites.length,
      enabled,
      tls,
      proxy,
    };
  }, [sites]);

  const loadSites = async () => {
    try {
      const data = await extractData<SiteView[]>(client.GET('/api/v1/admin/web/sites'));
      setSites(Array.isArray(data) ? data : []);
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };

  const loadDomainCertAssets = async () => {
    try {
      const data = await extractData<DomainCertAssetView[]>(client.GET('/api/v1/admin/domain-acme-ddns/assets/certs'));
      setDomainCertAssets(Array.isArray(data) ? data : []);
    } catch {
      setDomainCertAssets([]);
    }
  };

  const loadDomainAssets = async () => {
    try {
      const data = await extractData<DomainAssetView[]>(client.GET('/api/v1/admin/domain-acme-ddns/assets/domains'));
      setDomainAssets(Array.isArray(data) ? data : []);
    } catch {
      setDomainAssets([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadSites();
      await loadDomainCertAssets();
      await loadDomainAssets();
      setLoading(false);
    };
    run();
  }, []);

  const openCreateModal = () => {
    setDraft(defaultDraft());
    setIsModalOpen(true);
  };

  const openEditModal = (site: SiteView) => {
    setDraft(toDraft(site));
    setIsModalOpen(true);
  };

  const validateDraft = (current: SiteDraft): string | null => {
    if (!current.name.trim()) {
      return t('admin.web.validation.nameRequired');
    }

    if (current.bindings.length === 0) {
      return t('admin.web.validation.bindingsRequired');
    }

    for (const binding of current.bindings) {
      if (!binding.listen_ip.trim()) {
        return t('admin.web.validation.listenIpsRequired');
      }
      if (!Number.isInteger(binding.listen_port) || binding.listen_port <= 0 || binding.listen_port > 65535) {
        return t('admin.web.validation.listenPortsRequired');
      }
      if (binding.hostnames.length === 0) {
        return t('admin.web.validation.hostnamesRequired');
      }
    }

    if (current.tls_enabled && !current.tls_acme_cert_id.trim() && (!current.tls_cert_path.trim() || !current.tls_key_path.trim())) {
      return t('admin.web.validation.tlsFilesRequired');
    }
    if (current.route_mode === 'static' && !current.static_root.trim()) {
      return t('admin.web.validation.staticRootRequired');
    }
    if (current.route_mode === 'proxy' && !current.proxy_upstream.trim()) {
      return t('admin.web.validation.proxyUpstreamRequired');
    }
    return null;
  };

  const saveSite = async () => {
    const err = validateDraft(draft);
    if (err) {
      addToast(err, 'error');
      return;
    }

    if (draftWarnings.length > 0) {
      const ok = window.confirm(`${t('admin.web.warnings.confirmSave')}\n\n${draftWarnings.map((item) => `- ${item}`).join('\n')}`);
      if (!ok) {
        return;
      }
    }

    setSaving(true);
    try {
      const payload = toPayload(draft);
      if (draft.id) {
        await extractData<SiteView>(
          client.PUT('/api/v1/admin/web/sites/{id}', {
            params: { path: { id: draft.id } },
            body: payload,
          }),
        );
      } else {
        await extractData<SiteView>(
          client.POST('/api/v1/admin/web/sites', {
            body: payload,
          }),
        );
      }

      await loadSites();
      setIsModalOpen(false);
      addToast(t('admin.web.saveSuccess'), 'success');
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSite = async (site: SiteView) => {
    const ok = window.confirm(t('admin.web.deleteConfirm', { name: site.name }));
    if (!ok) {
      return;
    }

    try {
      await extractData<boolean>(
        client.DELETE('/api/v1/admin/web/sites/{id}', {
          params: { path: { id: site.id } },
        }),
      );
      await loadSites();
      addToast(t('admin.web.deleteSuccess'), 'success');
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };

  const reloadRuntime = async () => {
    try {
      await extractData<{ success: boolean }>(client.POST('/api/v1/admin/web/reload'));
      addToast(t('admin.web.reloadSuccess'), 'success');
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    }
  };

  const testConnection = async () => {
    const upstream = draft.proxy_upstream.trim();
    if (!upstream) {
      addToast(t('admin.web.validation.proxyUpstreamRequired'), 'error');
      return;
    }

    setTesting(true);
    try {
      const result = await extractData<{ success: boolean; message: string }>(
        client.POST('/api/v1/admin/web/test-upstream', {
          body: { upstream },
        }),
      );
      if (result.success) {
        addToast(result.message, 'success');
      } else {
        addToast(result.message, 'error');
      }
    } catch (error) {
      addToast(handleApiError(error, t), 'error');
    } finally {
      setTesting(false);
    }
  };

  const updateBinding = (index: number, patch: Partial<SiteBinding>) => {
    setDraft((prev) => {
      const nextBindings = [...prev.bindings];
      const current = { ...nextBindings[index], ...patch };
      nextBindings[index] = current;
      if (patch.is_default === true) {
        const targetKey = listenerKey(current, prev.tls_enabled);
        for (let i = 0; i < nextBindings.length; i += 1) {
          if (i === index) {
            continue;
          }
          const otherKey = listenerKey(nextBindings[i], prev.tls_enabled);
          if (otherKey === targetKey) {
            nextBindings[i] = { ...nextBindings[i], is_default: false };
          }
        }
      }
      return { ...prev, bindings: nextBindings };
    });
  };

  const removeBinding = (index: number) => {
    setDraft((prev) => {
      const nextBindings = prev.bindings.filter((_, i) => i !== index);
      return { ...prev, bindings: nextBindings.length > 0 ? nextBindings : [defaultBinding()] };
    });
  };

  const addBinding = () => {
    setDraft((prev) => ({ ...prev, bindings: [...prev.bindings, defaultBinding()] }));
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="rounded-[2rem] border border-border bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-transparent p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-600">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{t('admin.web.title')}</h2>
              <p className="text-sm font-bold uppercase tracking-wider opacity-60">{t('admin.web.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={reloadRuntime}>
              <RefreshCw size={16} className="mr-2" />
              {t('admin.web.reload')}
            </Button>
            <Button type="button" onClick={openCreateModal}>
              <Plus size={16} className="mr-2" />
              {t('admin.web.newSite')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold uppercase tracking-wider opacity-50">{t('admin.web.stats.total')}</p>
          <p className="mt-2 text-2xl font-black">{totals.all}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold uppercase tracking-wider opacity-50">{t('admin.web.stats.enabled')}</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{totals.enabled}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold uppercase tracking-wider opacity-50">{t('admin.web.stats.tls')}</p>
          <p className="mt-2 text-2xl font-black text-sky-600">{totals.tls}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold uppercase tracking-wider opacity-50">{t('admin.web.stats.proxy')}</p>
          <p className="mt-2 text-2xl font-black text-sky-600">{totals.proxy}</p>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-black uppercase tracking-wider opacity-60 border-b border-border">
          <div className="col-span-3">{t('admin.web.table.site')}</div>
          <div className="col-span-2">{t('admin.web.table.bindings')}</div>
          <div className="col-span-2">{t('admin.web.table.hostnames')}</div>
          <div className="col-span-1">{t('admin.web.table.mode')}</div>
          <div className="col-span-1">TLS</div>
          <div className="col-span-1">{t('admin.web.table.status')}</div>
          <div className="col-span-2 text-right">{t('admin.web.table.actions')}</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm opacity-60">{t('common.loading')}</div>
        ) : sites.length === 0 ? (
          <div className="p-10 text-center text-sm opacity-60">{t('admin.web.empty')}</div>
        ) : (
          <div className="divide-y divide-border">
            {sites.map((site) => (
              <div key={site.id} className="grid grid-cols-12 gap-2 px-4 py-4 items-center text-sm">
                <div className="col-span-3 min-w-0">
                  <div className="font-bold truncate">{site.name}</div>
                  <div className="text-sm opacity-60 truncate">{site.id}</div>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1 text-sm opacity-70">
                    <Network size={18} /> {site.bindings.length} {t('admin.web.table.bindings')}
                  </div>
                  <div className="flex items-center gap-1 text-sm opacity-70">
                    <Server size={18} /> {site.bindings.map((item) => item.listen_port).join(', ')}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm opacity-80 truncate">{site.bindings.flatMap((item) => item.hostnames).slice(0, 4).join(', ')}</div>
                </div>
                <div className="col-span-1">
                  <span className="rounded-full border border-border px-2 py-1 text-sm font-bold uppercase">{site.route_mode}</span>
                </div>
                <div className="col-span-1">
                  {site.tls_enabled ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold"><ShieldCheck size={18} />{t('common.on')}</span>
                  ) : (
                    <span className="text-sm opacity-50">{t('common.off')}</span>
                  )}
                </div>
                <div className="col-span-1">
                  <span
                    className={`rounded-full px-2 py-1 text-sm font-bold ${site.enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'}`}
                  >
                    {site.enabled ? t('common.enabled') : t('common.disabled')}
                  </span>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditModal(site)}>
                    <Pencil size={18} className="mr-1" />
                    {t('common.edit')}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => deleteSite(site)}>
                    <Trash2 size={18} className="mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={draft.id ? t('admin.web.editSite') : t('admin.web.newSite')}
        maxWidth="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.siteName')}</label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('admin.web.form.siteNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.routeMode')}</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={draft.route_mode === 'static' ? 'primary' : 'outline'}
                  onClick={() => setDraft({ ...draft, route_mode: 'static', proxy_tls_insecure_skip_verify: false })}
                  className="h-12"
                >
                  {t('admin.web.form.static')}
                </Button>
                <Button
                  type="button"
                  variant={draft.route_mode === 'proxy' ? 'primary' : 'outline'}
                  onClick={() => setDraft({ ...draft, route_mode: 'proxy' })}
                  className="h-12"
                >
                  {t('admin.web.form.proxy')}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.enabled')}</span>
                <Switch checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.tls')}</span>
                <Switch checked={draft.tls_enabled} onChange={(v) => setDraft({ ...draft, tls_enabled: v })} />
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4 space-y-3">
              {draft.route_mode === 'static' ? (
                <>
                  <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.staticRoot')}</label>
                  <Input value={draft.static_root} onChange={(e) => setDraft({ ...draft, static_root: e.target.value })} placeholder={t('admin.web.form.staticRootPlaceholder')} />
                </>
              ) : (
                <>
                  <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.proxyUpstream')}</label>
                  <div className="flex gap-2">
                    <Input
                      value={draft.proxy_upstream}
                      onChange={(e) => setDraft({ ...draft, proxy_upstream: e.target.value })}
                      placeholder={t('admin.web.form.proxyUpstreamPlaceholder')}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={testConnection} disabled={testing}>
                      {testing ? <RefreshCw size={18} className="animate-spin" /> : <Network size={18} />}
                    </Button>
                  </div>
                  <div className="rounded-xl border border-border p-3 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.proxyTlsInsecure')}</span>
                      <Switch
                        checked={draft.proxy_tls_insecure_skip_verify}
                        disabled={!canToggleProxyTlsInsecure}
                        onChange={(v) => setDraft({ ...draft, proxy_tls_insecure_skip_verify: v })}
                      />
                    </div>
                    {!canToggleProxyTlsInsecure && (
                      <p className="text-sm opacity-60 mt-2">{t('admin.web.form.proxyTlsInsecureHint')}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider">{t('admin.web.form.bindings')}</h3>
              <Button type="button" variant="outline" size="sm" onClick={addBinding}>
                <Plus size={18} className="mr-1" /> {t('admin.web.form.addBinding')}
              </Button>
            </div>

            <div className="space-y-3">
              {draft.bindings.map((binding, index) => (
                <div key={`binding-${index}`} className="grid grid-cols-12 gap-2 rounded-xl border border-border p-3">
                  <div className="col-span-12 md:col-span-3 space-y-1">
                    <label className="text-sm font-bold uppercase tracking-wider opacity-60">{t('admin.web.form.ip')}</label>
                    <Input
                      value={binding.listen_ip}
                      onChange={(e) => updateBinding(index, { listen_ip: e.target.value })}
                      placeholder={t('admin.web.form.ipPlaceholder')}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-2 space-y-1">
                    <label className="text-sm font-bold uppercase tracking-wider opacity-60">{t('admin.web.form.port')}</label>
                    <Input
                      value={String(binding.listen_port)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateBinding(index, { listen_port: Number.isFinite(v) ? v : 0 });
                      }}
                      placeholder={t('admin.web.form.portPlaceholder')}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-5 space-y-1">
                    <label className="text-sm font-bold uppercase tracking-wider opacity-60">{t('admin.web.form.hostnames')}</label>
                    <Input
                      value={binding.hostnames.join(', ')}
                      onChange={(e) => updateBinding(index, { hostnames: normalizeHostnames(e.target.value) })}
                      placeholder={t('admin.web.form.hostnamesPlaceholder')}
                      list="web-domain-asset-suggestions"
                    />
                    <p className="text-sm opacity-60">{t('admin.web.form.hostnameSuggestionHint')}</p>
                  </div>
                  <div className="col-span-8 md:col-span-1 space-y-1">
                    <label className="text-sm font-bold uppercase tracking-wider opacity-60">{t('admin.web.form.default')}</label>
                    <div className="h-12 flex items-center">
                      <Switch checked={binding.is_default} onChange={(v) => updateBinding(index, { is_default: v })} />
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-1 flex items-end justify-end">
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeBinding(index)}>
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {domainAssets.length > 0 && (
              <datalist id="web-domain-asset-suggestions">
                {domainAssets.map((item) => (
                  <option key={item.fqdn} value={item.fqdn} />
                ))}
              </datalist>
            )}
          </div>

          <div className="rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider">{t('admin.web.diagnostics.title')}</h3>
              <span className="text-sm font-bold opacity-60">{t('admin.web.diagnostics.listenerCount', { count: listenerDiagnostics.length })}</span>
            </div>
            <p className="text-sm opacity-70">{t('admin.web.diagnostics.desc')}</p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {listenerDiagnostics.map((diag) => (
                <div
                  key={diag.listenerKey}
                  className={`rounded-xl border p-3 ${
                    diag.errors.length > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black">{diag.listenerKey}</span>
                    <span className={`text-sm font-bold uppercase ${diag.errors.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {diag.errors.length > 0 ? t('admin.web.diagnostics.conflict') : t('admin.web.diagnostics.clean')}
                    </span>
                  </div>
                  <div className="mt-2 text-sm opacity-80">
                    <div>
                      {t('admin.web.diagnostics.current')}: {diag.currentBindings.map((item) => item.hostnames.join('|')).join(' ; ')}
                    </div>
                    {diag.remoteBindings.length > 0 && (
                      <div className="mt-1">
                        {t('admin.web.diagnostics.remote')}:{' '}
                        {diag.remoteBindings
                          .map((item) => `${item.site}[${item.binding.hostnames.join('|')}]`)
                          .join(' ; ')}
                      </div>
                    )}
                  </div>
                  {diag.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {diag.errors.map((msg) => (
                        <p key={msg} className="text-sm text-amber-800">
                          {msg}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {draftWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
              <p className="text-sm font-black uppercase tracking-wider text-amber-700">{t('admin.web.warnings.title')}</p>
              <div className="mt-2 space-y-1">
                {draftWarnings.map((item) => (
                  <p key={item} className="text-sm text-amber-800">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {draft.tls_enabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.tlsAcmeCert')}</label>
                <select
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={draft.tls_acme_cert_id}
                  onChange={(e) => setDraft({ ...draft, tls_acme_cert_id: e.target.value })}
                >
                  <option value="">{t('admin.web.form.tlsAcmeCertNone')}</option>
                  {domainCertAssets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${item.name} (${item.id})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.tlsCertPath')}</label>
                  <Input
                    value={draft.tls_cert_path}
                    onChange={(e) => setDraft({ ...draft, tls_cert_path: e.target.value })}
                    placeholder={t('admin.web.form.tlsCertPathPlaceholder')}
                    disabled={Boolean(draft.tls_acme_cert_id.trim())}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider opacity-70">{t('admin.web.form.tlsKeyPath')}</label>
                  <Input
                    value={draft.tls_key_path}
                    onChange={(e) => setDraft({ ...draft, tls_key_path: e.target.value })}
                    placeholder={t('admin.web.form.tlsKeyPathPlaceholder')}
                    disabled={Boolean(draft.tls_acme_cert_id.trim())}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={saveSite} disabled={saving}>
              {saving ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WebAdmin;
