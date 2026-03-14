// VFS Storage Configuration Modal
// Visual editor for vfs_storage_hub.{connectors,pools,policies,default_pool}

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, HardDrive, Layers, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResolvedTheme } from '../lib/theme';
import { Button } from './ui/Button';

type ConfigObject = Record<string, unknown>;

type TomlAdapter = {
  parse: (source: string) => unknown;
  stringify: (value: unknown) => string;
};

type VfsDriver = 'fs' | 's3' | 'webdav' | 'memory' | 'android_saf' | 'ios_scoped_fs';

type KvPair = {
  key: string;
  value: string;
};

type ConnectorDraft = {
  id: string;
  name: string;
  driver: VfsDriver;
  root: string;
  enable: boolean;
  options: KvPair[];
};

type PoolDraft = {
  id: string;
  name: string;
  primary_connector: string;
  backup_connector: string;
  enable_write_cache: boolean;
  enable: boolean;
  options: KvPair[];
};

type PolicyDraft = {
  id: string;
  role_id: string;
  pool_name: string;
  default_quota: string;
};

type ActiveTab = 'pools' | 'connectors' | 'policies';

export interface VfsStorageConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  tomlAdapter: TomlAdapter;
  content: string;
  onContentChange: (value: string) => void;
}

const isRecord = (value: unknown): value is ConfigObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const ensureRecord = (target: ConfigObject, key: string): ConfigObject => {
  const value = target[key];
  if (isRecord(value)) {
    return value;
  }
  const next: ConfigObject = {};
  target[key] = next;
  return next;
};

const deepClone = <T,>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

const makeId = (() => {
  let seed = 0;
  return (prefix: string): string => {
    seed += 1;
    return `${prefix}-${Date.now()}-${seed}`;
  };
})();

const kvFromOptions = (raw: unknown): KvPair[] => {
  if (!isRecord(raw)) {
    return [];
  }
  return Object.entries(raw)
    .filter(([, value]) => typeof value === 'string')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
};

const kvToOptions = (pairs: KvPair[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const k = pair.key.trim();
    if (!k) continue;
    out[k] = pair.value;
  }
  return out;
};

const normalizeOptionsForDriver = (driver: VfsDriver, pairs: KvPair[]): KvPair[] => {
  if (driver !== 's3') {
    return pairs;
  }
  const hasAccessKeyId = pairs.some((pair) => pair.key === 'access_key_id');
  const hasSecretAccessKey = pairs.some((pair) => pair.key === 'secret_access_key');
  const hasLegacyAccessKey = pairs.some((pair) => pair.key === 'access_key');
  const hasLegacySecretKey = pairs.some((pair) => pair.key === 'secret_key');

  let next = pairs;
  if (!hasAccessKeyId && hasLegacyAccessKey) {
    next = next.map((pair) => (pair.key === 'access_key' ? { ...pair, key: 'access_key_id' } : pair));
  }
  if (!hasSecretAccessKey && hasLegacySecretKey) {
    next = next.map((pair) => (pair.key === 'secret_key' ? { ...pair, key: 'secret_access_key' } : pair));
  }

  // Drop legacy keys when normalized counterparts exist.
  const normalizedHasAccessKeyId = next.some((pair) => pair.key === 'access_key_id');
  const normalizedHasSecretAccessKey = next.some((pair) => pair.key === 'secret_access_key');
  if (normalizedHasAccessKeyId) {
    next = next.filter((pair) => pair.key !== 'access_key');
  }
  if (normalizedHasSecretAccessKey) {
    next = next.filter((pair) => pair.key !== 'secret_key');
  }
  return next;
};

const getOption = (pairs: KvPair[], key: string): string => {
  const found = pairs.find((pair) => pair.key === key);
  return found ? found.value : '';
};

const upsertOption = (pairs: KvPair[], key: string, value: string): KvPair[] => {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return pairs;
  }
  const nextValue = value;
  const existingIndex = pairs.findIndex((pair) => pair.key === normalizedKey);
  if (existingIndex < 0) {
    if (nextValue.trim().length === 0) return pairs;
    return [...pairs, { key: normalizedKey, value: nextValue }].sort((a, b) => a.key.localeCompare(b.key));
  }
  const next = pairs.slice();
  if (nextValue.trim().length === 0) {
    next.splice(existingIndex, 1);
    return next;
  }
  next[existingIndex] = { key: normalizedKey, value: nextValue };
  return next;
};

const buildLocalDefaults = (): {
  connectors: ConnectorDraft[];
  pools: PoolDraft[];
  defaultPool: string;
  policies: PolicyDraft[];
} => {
  const connectorName = 'local-fs';
  const poolName = 'default-pool';
  return {
    connectors: [
      {
        id: makeId('connector'),
        name: connectorName,
        driver: 'fs',
        root: '{APPDATADIR}/vfs',
        enable: true,
        options: [],
      },
    ],
    pools: [
      {
        id: makeId('pool'),
        name: poolName,
        primary_connector: connectorName,
        backup_connector: connectorName,
        enable_write_cache: false,
        enable: true,
        options: [],
      },
    ],
    defaultPool: poolName,
    policies: [],
  };
};

const parseVfsDraftFromContent = (
  content: string,
  tomlAdapter: TomlAdapter,
): {
  connectors: ConnectorDraft[];
  pools: PoolDraft[];
  defaultPool: string;
  policies: PolicyDraft[];
  error: string | null;
} => {
  try {
    const parsed = tomlAdapter.parse(content);
    if (!isRecord(parsed)) {
      return { ...buildLocalDefaults(), error: 'TOML root must be an object' };
    }

    const root = parsed;
    const vfsHub = isRecord(root.vfs_storage_hub) ? root.vfs_storage_hub : {};

    const connectorsRaw = vfsHub.connectors;
    const poolsRaw = vfsHub.pools;
    const policiesRaw = vfsHub.policies;
    const defaultPoolRaw = vfsHub.default_pool;

    const defaults = buildLocalDefaults();

    const connectors: ConnectorDraft[] = Array.isArray(connectorsRaw)
      ? connectorsRaw
        .filter(isRecord)
        .map((conn) => {
          const driver: VfsDriver = (typeof conn.driver === 'string' ? conn.driver : 'fs') as VfsDriver;
          return {
            id: makeId('connector'),
            name: typeof conn.name === 'string' ? conn.name : '',
            driver,
            root: typeof conn.root === 'string' ? conn.root : '',
            enable: typeof conn.enable === 'boolean' ? conn.enable : true,
            options: normalizeOptionsForDriver(driver, kvFromOptions(conn.options)),
          };
        })
      : [];

    const pools: PoolDraft[] = Array.isArray(poolsRaw)
      ? poolsRaw
        .filter(isRecord)
        .map((pool) => ({
          id: makeId('pool'),
          name: typeof pool.name === 'string' ? pool.name : '',
          primary_connector: typeof pool.primary_connector === 'string' ? pool.primary_connector : '',
          backup_connector: typeof pool.backup_connector === 'string' ? pool.backup_connector : '',
          enable_write_cache: typeof pool.enable_write_cache === 'boolean' ? pool.enable_write_cache : false,
          enable: typeof pool.enable === 'boolean' ? pool.enable : true,
          options: kvFromOptions(pool.options),
        }))
      : [];

    const policies: PolicyDraft[] = Array.isArray(policiesRaw)
      ? policiesRaw
        .filter(isRecord)
        .map((policy) => ({
          id: makeId('policy'),
          role_id: typeof policy.role_id === 'string' ? policy.role_id : '',
          pool_name: typeof policy.pool_name === 'string' ? policy.pool_name : '',
          default_quota: typeof policy.default_quota === 'number' ? String(policy.default_quota) : '',
        }))
      : [];

    const effectiveConnectors = connectors.length > 0 ? connectors : defaults.connectors;
    const effectivePools = pools.length > 0 ? pools : defaults.pools;
    const poolNames = new Set(effectivePools.map((p) => p.name).filter((v) => v.trim().length > 0));
    const resolvedDefaultPool = typeof defaultPoolRaw === 'string' && defaultPoolRaw.trim().length > 0
      ? defaultPoolRaw
      : defaults.defaultPool;
    const effectiveDefaultPool = poolNames.has(resolvedDefaultPool)
      ? resolvedDefaultPool
      : (effectivePools[0]?.name || defaults.defaultPool);

    // Ensure policies exists as array on apply (validation requires it).
    return {
      connectors: effectiveConnectors,
      pools: effectivePools,
      defaultPool: effectiveDefaultPool,
      policies,
      error: null,
    };
  } catch (error) {
    return { ...buildLocalDefaults(), error: error instanceof Error ? error.message : String(error) };
  }
};

const validateDraft = (
  t: (key: string, params?: Record<string, unknown>) => string,
  connectors: ConnectorDraft[],
  pools: PoolDraft[],
  defaultPool: string,
  policies: PolicyDraft[],
): string[] => {
  const errors: string[] = [];

  if (connectors.length === 0) {
    errors.push(t('admin.config.storage.validation.errors.atLeastOneConnector'));
  }

  const connectorNames = connectors.map((c) => c.name.trim()).filter((v) => v.length > 0);
  const connectorNameSet = new Set(connectorNames);
  if (connectorNames.length !== connectorNameSet.size) {
    errors.push(t('admin.config.storage.validation.errors.connectorNamesUnique'));
  }

  connectors.forEach((c, index) => {
    if (!c.name.trim()) errors.push(t('admin.config.storage.validation.errors.connectorNameRequired', { index }));
    if (!c.driver.trim()) errors.push(t('admin.config.storage.validation.errors.connectorDriverRequired', { index }));
    if (!c.root.trim()) errors.push(t('admin.config.storage.validation.errors.connectorRootRequired', { index }));
  });

  if (pools.length === 0) {
    errors.push(t('admin.config.storage.validation.errors.atLeastOnePool'));
  }

  const poolNames = pools.map((p) => p.name.trim()).filter((v) => v.length > 0);
  const poolNameSet = new Set(poolNames);
  if (poolNames.length !== poolNameSet.size) {
    errors.push(t('admin.config.storage.validation.errors.poolNamesUnique'));
  }

  pools.forEach((p, index) => {
    if (!p.name.trim()) errors.push(t('admin.config.storage.validation.errors.poolNameRequired', { index }));
    if (!p.primary_connector.trim()) errors.push(t('admin.config.storage.validation.errors.poolPrimaryRequired', { index }));
    if (p.primary_connector.trim() && !connectorNameSet.has(p.primary_connector.trim())) {
      errors.push(t('admin.config.storage.validation.errors.poolPrimaryUnknown', { index, name: p.primary_connector }));
    }
    if (p.backup_connector.trim() && !connectorNameSet.has(p.backup_connector.trim())) {
      errors.push(t('admin.config.storage.validation.errors.poolBackupUnknown', { index, name: p.backup_connector }));
    }
  });

  if (!defaultPool.trim()) {
    errors.push(t('admin.config.storage.validation.errors.defaultPoolRequired'));
  } else if (!poolNameSet.has(defaultPool.trim())) {
    errors.push(t('admin.config.storage.validation.errors.defaultPoolNotFound', { name: defaultPool }));
  }

  policies.forEach((policy, index) => {
    if (!policy.role_id.trim()) errors.push(t('admin.config.storage.validation.errors.policyRoleRequired', { index }));
    if (!policy.pool_name.trim()) errors.push(t('admin.config.storage.validation.errors.policyPoolRequired', { index }));
    if (policy.pool_name.trim() && !poolNameSet.has(policy.pool_name.trim())) {
      errors.push(t('admin.config.storage.validation.errors.policyPoolUnknown', { index, name: policy.pool_name }));
    }
    const quota = Number.parseInt(policy.default_quota.trim(), 10);
    if (!Number.isFinite(quota) || quota < 0) {
      errors.push(t('admin.config.storage.validation.errors.policyQuotaInvalid', { index }));
    }
  });

  return errors;
};

export const VfsStorageConfigModal: React.FC<VfsStorageConfigModalProps> = ({
  isOpen,
  onClose,
  tomlAdapter,
  content,
  onContentChange,
}) => {
  const { t } = useTranslation();
  const resolvedTheme = useResolvedTheme();
  const isDark = resolvedTheme === 'dark';

  const [tab, setTab] = useState<ActiveTab>('pools');
  const [connectors, setConnectors] = useState<ConnectorDraft[]>([]);
  const [pools, setPools] = useState<PoolDraft[]>([]);
  const [defaultPool, setDefaultPool] = useState('');
  const [policies, setPolicies] = useState<PolicyDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setValidationErrors([]);
    const parsed = parseVfsDraftFromContent(content, tomlAdapter);
    setConnectors(parsed.connectors);
    setPools(parsed.pools);
    setDefaultPool(parsed.defaultPool);
    setPolicies(parsed.policies);
    setError(parsed.error);
    setTab('pools');
  }, [content, isOpen, tomlAdapter]);

  const connectorNames = useMemo(() => {
    return connectors
      .map((c) => c.name.trim())
      .filter((v) => v.length > 0);
  }, [connectors]);

  const poolNames = useMemo(() => {
    return pools
      .map((p) => p.name.trim())
      .filter((v) => v.length > 0);
  }, [pools]);

  const driverLabel = (driver: VfsDriver): string => {
    return t(`admin.config.storage.drivers.${driver}`);
  };

  const applyToConfig = () => {
    setValidationErrors([]);
    if (error) {
      setValidationErrors([
        t('admin.config.storage.validation.errors.parseFailed', { message: error }),
      ]);
      return;
    }
    const errs = validateDraft(t, connectors, pools, defaultPool, policies);
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    const parsed = tomlAdapter.parse(content);
    if (!isRecord(parsed)) {
      setValidationErrors([t('admin.config.storage.validation.errors.parseRoot')]);
      return;
    }
    const nextConfig = deepClone(parsed);
    const vfsHub = ensureRecord(nextConfig, 'vfs_storage_hub');

    vfsHub.connectors = connectors.map((c) => ({
      name: c.name.trim(),
      driver: c.driver,
      root: c.root.trim(),
      enable: c.enable,
      options: kvToOptions(c.options),
    }));

    vfsHub.pools = pools.map((p) => {
      const base: ConfigObject = {
        name: p.name.trim(),
        primary_connector: p.primary_connector.trim(),
        enable_write_cache: p.enable_write_cache,
        enable: p.enable,
        options: kvToOptions(p.options),
      };
      if (p.backup_connector.trim().length > 0) {
        base.backup_connector = p.backup_connector.trim();
      }
      return base;
    });

    vfsHub.default_pool = defaultPool.trim();
    vfsHub.policies = policies.map((policy) => ({
      role_id: policy.role_id.trim(),
      pool_name: policy.pool_name.trim(),
      default_quota: Number.parseInt(policy.default_quota.trim(), 10),
    }));

    const nextContent = tomlAdapter.stringify(nextConfig);
    onContentChange(nextContent);
    onClose();
  };

  const resetToLocalDefaults = () => {
    const defaults = buildLocalDefaults();
    setConnectors(defaults.connectors);
    setPools(defaults.pools);
    setDefaultPool(defaults.defaultPool);
    setPolicies(defaults.policies);
    setValidationErrors([]);
    setError(null);
    setTab('pools');
  };

  const updateConnector = (id: string, updater: (prev: ConnectorDraft) => ConnectorDraft) => {
    setConnectors((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const renameConnector = (id: string, nextName: string) => {
    setConnectors((prev) => {
      const current = prev.find((c) => c.id === id);
      const oldName = current?.name ?? '';
      const next = prev.map((c) => (c.id === id ? { ...c, name: nextName } : c));
      if (!oldName.trim() || oldName === nextName) {
        return next;
      }
      setPools((poolsPrev) => poolsPrev.map((p) => ({
        ...p,
        primary_connector: p.primary_connector === oldName ? nextName : p.primary_connector,
        backup_connector: p.backup_connector === oldName ? nextName : p.backup_connector,
      })));
      return next;
    });
  };

  const removeConnector = (id: string) => {
    setConnectors((prev) => {
      const removing = prev.find((c) => c.id === id);
      const next = prev.filter((c) => c.id !== id);
      const removedName = removing?.name ?? '';
      const fallbackName = next[0]?.name ?? '';
      if (removedName.trim().length > 0) {
        setPools((poolsPrev) => poolsPrev.map((p) => ({
          ...p,
          primary_connector: p.primary_connector === removedName ? fallbackName : p.primary_connector,
          backup_connector: p.backup_connector === removedName ? '' : p.backup_connector,
        })));
      }
      return next;
    });
  };

  const addConnector = () => {
    const baseName = 'connector';
    const existing = new Set(connectorNames);
    let index = 1;
    let name = `${baseName}-${index}`;
    while (existing.has(name)) {
      index += 1;
      name = `${baseName}-${index}`;
    }
    setConnectors((prev) => ([
      ...prev,
      {
        id: makeId('connector'),
        name,
        driver: 'fs',
        root: '{APPDATADIR}/vfs',
        enable: true,
        options: [],
      },
    ]));
  };

  const updatePool = (id: string, updater: (prev: PoolDraft) => PoolDraft) => {
    setPools((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  };

  const renamePool = (id: string, nextName: string) => {
    setPools((prev) => {
      const current = prev.find((p) => p.id === id);
      const oldName = current?.name ?? '';
      const next = prev.map((p) => (p.id === id ? { ...p, name: nextName } : p));
      if (!oldName.trim() || oldName === nextName) {
        return next;
      }
      setDefaultPool((prevDefault) => (prevDefault === oldName ? nextName : prevDefault));
      setPolicies((prevPolicies) => prevPolicies.map((policy) => ({
        ...policy,
        pool_name: policy.pool_name === oldName ? nextName : policy.pool_name,
      })));
      return next;
    });
  };

  const removePool = (id: string) => {
    setPools((prev) => {
      const removing = prev.find((p) => p.id === id);
      const next = prev.filter((p) => p.id !== id);
      const removedName = removing?.name ?? '';
      const fallbackName = next[0]?.name ?? '';
      if (removedName.trim().length > 0) {
        setDefaultPool((prevDefault) => (prevDefault === removedName ? fallbackName : prevDefault));
        setPolicies((prevPolicies) => prevPolicies.map((policy) => ({
          ...policy,
          pool_name: policy.pool_name === removedName ? fallbackName : policy.pool_name,
        })));
      }
      return next;
    });
  };

  const addPool = () => {
    const baseName = 'pool';
    const existing = new Set(poolNames);
    let index = 1;
    let name = `${baseName}-${index}`;
    while (existing.has(name)) {
      index += 1;
      name = `${baseName}-${index}`;
    }
    const defaultConnector = connectorNames[0] ?? 'local-fs';
    setPools((prev) => ([
      ...prev,
      {
        id: makeId('pool'),
        name,
        primary_connector: defaultConnector,
        backup_connector: '',
        enable_write_cache: false,
        enable: true,
        options: [],
      },
    ]));
    if (!defaultPool.trim()) {
      setDefaultPool(name);
    }
  };

  const addPolicy = () => {
    const fallbackPool = defaultPool.trim() || poolNames[0] || 'default-pool';
    setPolicies((prev) => ([
      ...prev,
      {
        id: makeId('policy'),
        role_id: '0',
        pool_name: fallbackPool,
        default_quota: '0',
      },
    ]));
  };

  const removePolicy = (id: string) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePolicy = (id: string, updater: (prev: PolicyDraft) => PolicyDraft) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'absolute inset-0 backdrop-blur-2xl transition-all duration-300',
          isDark ? 'bg-black/95' : 'bg-slate-900/80',
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'relative w-full max-w-5xl max-h-[92dvh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300',
          isDark
            ? 'bg-slate-950 border-white/10 text-slate-100 ring-1 ring-white/5'
            : 'bg-white border-gray-200 text-slate-900',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-6',
            isDark ? 'border-white/10 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50',
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-cyan-500/10' : 'bg-cyan-50')}>
              <HardDrive size={18} className="text-cyan-500 shrink-0" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-widest truncate">
                {t('admin.config.storage.title')}
              </h3>
              <p className={cn('text-[10px] font-bold uppercase tracking-widest mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                {t('admin.config.storage.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'h-8 w-8 rounded-lg border inline-flex items-center justify-center transition-colors',
              isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-gray-200 text-slate-600 hover:bg-gray-100',
            )}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div className={cn(
            'rounded-xl border p-3 sm:p-4',
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white',
          )}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-200' : 'text-slate-600')}>
                {t('admin.config.storage.fields.defaultPool')}
              </div>
              <select
                className={cn(
                  'h-10 rounded-lg border px-3 text-sm font-mono font-bold w-full sm:w-auto',
                  isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                )}
                value={defaultPool}
                onChange={(e) => setDefaultPool(e.target.value)}
              >
                {pools.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name || '(unnamed)'}
                  </option>
                ))}
              </select>
              <div className={cn('text-xs font-bold opacity-60 sm:ml-auto', isDark ? 'text-slate-400' : 'text-slate-500')}>
                vfs_storage_hub
              </div>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className={cn(
              'rounded-xl border p-3 sm:p-4',
              isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-900',
            )}>
              <div className="text-xs font-black uppercase tracking-widest mb-2">
                {t('admin.config.storage.validation.title')}
              </div>
              <div className="space-y-1 text-sm font-mono font-bold">
                {validationErrors.map((msg, idx) => (
                  <div key={`${idx}-${msg}`}>- {msg}</div>
                ))}
              </div>
            </div>
          )}

          <div className={cn(
            'grid grid-cols-1 sm:grid-cols-3 gap-2',
          )}>
            <button
              type="button"
              className={cn(
                'h-10 rounded-lg text-sm font-black border transition-all shadow-sm inline-flex items-center justify-center gap-2',
                tab === 'pools'
                  ? (isDark ? 'bg-primary text-white border-primary' : 'bg-primary text-white border-primary')
                  : (isDark ? 'bg-black/20 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'),
              )}
              onClick={() => setTab('pools')}
            >
              <Layers size={16} />
              {t('admin.config.storage.tabs.pools')}
            </button>
            <button
              type="button"
              className={cn(
                'h-10 rounded-lg text-sm font-black border transition-all shadow-sm inline-flex items-center justify-center gap-2',
                tab === 'connectors'
                  ? (isDark ? 'bg-primary text-white border-primary' : 'bg-primary text-white border-primary')
                  : (isDark ? 'bg-black/20 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'),
              )}
              onClick={() => setTab('connectors')}
            >
              <Database size={16} />
              {t('admin.config.storage.tabs.connectors')}
            </button>
            <button
              type="button"
              className={cn(
                'h-10 rounded-lg text-sm font-black border transition-all shadow-sm inline-flex items-center justify-center gap-2',
                tab === 'policies'
                  ? (isDark ? 'bg-primary text-white border-primary' : 'bg-primary text-white border-primary')
                  : (isDark ? 'bg-black/20 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'),
              )}
              onClick={() => setTab('policies')}
            >
              <Layers size={16} />
              {t('admin.config.storage.tabs.policies')}
            </button>
          </div>

          {tab === 'connectors' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {t('admin.config.storage.connectors.title')}
                </div>
                <button
                  type="button"
                  className={cn(
                    'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                    isDark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                  )}
                  onClick={addConnector}
                >
                  <Plus size={16} />
                  {t('admin.config.storage.actions.addConnector')}
                </button>
              </div>

              {connectors.map((c, idx) => (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-2xl border p-3 sm:p-4',
                    isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase tracking-wide truncate">
                        {c.name || `${t('admin.config.storage.connectors.connector')} #${idx + 1}`}
                      </div>
                      <div className={cn('text-xs font-bold uppercase tracking-widest mt-0.5 opacity-60', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {driverLabel(c.driver)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                        isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
                      )}
                      onClick={() => removeConnector(c.id)}
                      disabled={connectors.length <= 1}
                      title={connectors.length <= 1 ? t('admin.config.storage.validation.minimumOneConnector') : undefined}
                    >
                      <Trash2 size={16} />
                      {t('common.delete')}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.name')}
                      <input
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold focus:outline-none focus:ring-2',
                          isDark ? 'border-white/15 bg-black/30 text-white focus:ring-cyan-500/30' : 'border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm',
                        )}
                        value={c.name}
                        onChange={(e) => renameConnector(c.id, e.target.value)}
                      />
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.driver')}
                      <select
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        value={c.driver}
                        onChange={(e) => {
                          const nextDriver = e.target.value as VfsDriver;
                          updateConnector(c.id, (prev) => ({
                            ...prev,
                            driver: nextDriver,
                            options: normalizeOptionsForDriver(nextDriver, prev.options),
                          }));
                        }}
                      >
                        {(['fs', 's3', 'webdav', 'memory', 'android_saf', 'ios_scoped_fs'] as VfsDriver[]).map((driver) => (
                          <option key={driver} value={driver}>
                            {driverLabel(driver)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={cn('text-sm font-black md:col-span-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.root')}
                      <input
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold focus:outline-none focus:ring-2',
                          isDark ? 'border-white/15 bg-black/30 text-white focus:ring-cyan-500/30' : 'border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm',
                        )}
                        value={c.root}
                        placeholder={t(`admin.config.storage.placeholders.root.${c.driver}`)}
                        onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, root: e.target.value }))}
                      />
                      <div className={cn('text-xs font-bold mt-1 opacity-60', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {t(`admin.config.storage.hints.root.${c.driver}`)}
                      </div>
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.enabled')}
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={c.enable}
                          onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, enable: e.target.checked }))}
                        />
                      </div>
                    </label>

                    <div className="md:col-span-2" />
                  </div>

                  {(c.driver === 's3' || c.driver === 'webdav') && (
                    <div className={cn(
                      'mt-3 rounded-xl border p-3',
                      isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50',
                    )}>
                      <div className={cn('text-xs font-black uppercase tracking-widest opacity-60 mb-2', isDark ? 'text-slate-300' : 'text-slate-600')}>
                        {t('admin.config.storage.connectors.commonOptions')}
                      </div>
                      {c.driver === 's3' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            endpoint
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'endpoint')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'endpoint', e.target.value) }))}
                            />
                          </label>
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            region
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'region')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'region', e.target.value) }))}
                            />
                          </label>
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            bucket
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'bucket')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'bucket', e.target.value) }))}
                            />
                          </label>
                          <div />
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            access_key_id
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'access_key_id')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'access_key_id', e.target.value) }))}
                            />
                          </label>
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            secret_access_key
                            <input
                              type="password"
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'secret_access_key')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'secret_access_key', e.target.value) }))}
                            />
                          </label>
                        </div>
                      )}
                      {c.driver === 'webdav' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className={cn('text-sm font-black md:col-span-2', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            endpoint
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'endpoint')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'endpoint', e.target.value) }))}
                            />
                          </label>
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            username
                            <input
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'username')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'username', e.target.value) }))}
                            />
                          </label>
                          <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                            password
                            <input
                              type="password"
                              className={cn(
                                'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                                isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                              )}
                              value={getOption(c.options, 'password')}
                              onChange={(e) => updateConnector(c.id, (prev) => ({ ...prev, options: upsertOption(prev.options, 'password', e.target.value) }))}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={cn(
                    'mt-3 rounded-xl border p-3',
                    isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50',
                  )}>
                    <div className="flex items-center justify-between">
                      <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-300' : 'text-slate-600')}>
                        {t('admin.config.storage.fields.options')}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          'h-8 px-2 rounded-lg border text-xs font-black inline-flex items-center gap-2 transition-all',
                          isDark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                        )}
                        onClick={() => updateConnector(c.id, (prev) => ({ ...prev, options: [...prev.options, { key: '', value: '' }] }))}
                      >
                        <Plus size={14} />
                        {t('admin.config.storage.actions.addOption')}
                      </button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {c.options.map((pair, pairIndex) => (
                        <div key={`${c.id}-opt-${pairIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <input
                            className={cn(
                              'h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                              isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                            )}
                            placeholder={t('admin.config.storage.placeholders.optionKey')}
                            value={pair.key}
                            onChange={(e) => {
                              const nextKey = e.target.value;
                              updateConnector(c.id, (prev) => {
                                const next = prev.options.slice();
                                next[pairIndex] = { ...next[pairIndex], key: nextKey };
                                return { ...prev, options: next };
                              });
                            }}
                          />
                          <input
                            className={cn(
                              'h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                              isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                            )}
                            placeholder={t('admin.config.storage.placeholders.optionValue')}
                            value={pair.value}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              updateConnector(c.id, (prev) => {
                                const next = prev.options.slice();
                                next[pairIndex] = { ...next[pairIndex], value: nextValue };
                                return { ...prev, options: next };
                              });
                            }}
                          />
                          <button
                            type="button"
                            className={cn(
                              'h-10 w-10 rounded-lg border inline-flex items-center justify-center',
                              isDark ? 'border-white/15 text-slate-200 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
                            )}
                            onClick={() => {
                              updateConnector(c.id, (prev) => {
                                const next = prev.options.slice();
                                next.splice(pairIndex, 1);
                                return { ...prev, options: next };
                              });
                            }}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'pools' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {t('admin.config.storage.pools.title')}
                </div>
                <button
                  type="button"
                  className={cn(
                    'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                    isDark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                  )}
                  onClick={addPool}
                >
                  <Plus size={16} />
                  {t('admin.config.storage.actions.addPool')}
                </button>
              </div>

              {pools.map((p, idx) => (
                <div
                  key={p.id}
                  className={cn(
                    'rounded-2xl border p-3 sm:p-4',
                    isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase tracking-wide truncate">
                        {p.name || `${t('admin.config.storage.pools.pool')} #${idx + 1}`}
                      </div>
                      <div className={cn('text-xs font-bold uppercase tracking-widest mt-0.5 opacity-60', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {t('admin.config.storage.pools.primary')}: {p.primary_connector || '-'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                        isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
                      )}
                      onClick={() => removePool(p.id)}
                      disabled={pools.length <= 1}
                      title={pools.length <= 1 ? t('admin.config.storage.validation.minimumOnePool') : undefined}
                    >
                      <Trash2 size={16} />
                      {t('common.delete')}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.name')}
                      <input
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold focus:outline-none focus:ring-2',
                          isDark ? 'border-white/15 bg-black/30 text-white focus:ring-cyan-500/30' : 'border-slate-300 bg-white text-slate-900 focus:ring-cyan-500/20 shadow-sm',
                        )}
                        value={p.name}
                        onChange={(e) => renamePool(p.id, e.target.value)}
                      />
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.pools.primary')}
                      <select
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        value={p.primary_connector}
                        onChange={(e) => updatePool(p.id, (prev) => ({ ...prev, primary_connector: e.target.value }))}
                      >
                        {connectors.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name || '(unnamed)'}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.pools.backup')}
                      <select
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        value={p.backup_connector}
                        onChange={(e) => updatePool(p.id, (prev) => ({ ...prev, backup_connector: e.target.value }))}
                      >
                        <option value="">{t('common.none')}</option>
                        {connectors.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name || '(unnamed)'}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.fields.enabled')}
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={p.enable}
                          onChange={(e) => updatePool(p.id, (prev) => ({ ...prev, enable: e.target.checked }))}
                        />
                      </div>
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.pools.writeCache')}
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={p.enable_write_cache}
                          onChange={(e) => updatePool(p.id, (prev) => ({ ...prev, enable_write_cache: e.target.checked }))}
                        />
                      </div>
                    </label>
                  </div>

                  <div className={cn(
                    'mt-3 rounded-xl border p-3',
                    isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50',
                  )}>
                    <div className="flex items-center justify-between">
                      <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-300' : 'text-slate-600')}>
                        {t('admin.config.storage.fields.options')}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          'h-8 px-2 rounded-lg border text-xs font-black inline-flex items-center gap-2 transition-all',
                          isDark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                        )}
                        onClick={() => updatePool(p.id, (prev) => ({ ...prev, options: [...prev.options, { key: '', value: '' }] }))}
                      >
                        <Plus size={14} />
                        {t('admin.config.storage.actions.addOption')}
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {p.options.map((pair, pairIndex) => (
                        <div key={`${p.id}-opt-${pairIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <input
                            className={cn(
                              'h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                              isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                            )}
                            placeholder={t('admin.config.storage.placeholders.optionKey')}
                            value={pair.key}
                            onChange={(e) => {
                              const nextKey = e.target.value;
                              updatePool(p.id, (prev) => {
                                const next = prev.options.slice();
                                next[pairIndex] = { ...next[pairIndex], key: nextKey };
                                return { ...prev, options: next };
                              });
                            }}
                          />
                          <input
                            className={cn(
                              'h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                              isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                            )}
                            placeholder={t('admin.config.storage.placeholders.optionValue')}
                            value={pair.value}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              updatePool(p.id, (prev) => {
                                const next = prev.options.slice();
                                next[pairIndex] = { ...next[pairIndex], value: nextValue };
                                return { ...prev, options: next };
                              });
                            }}
                          />
                          <button
                            type="button"
                            className={cn(
                              'h-10 w-10 rounded-lg border inline-flex items-center justify-center',
                              isDark ? 'border-white/15 text-slate-200 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100',
                            )}
                            onClick={() => {
                              updatePool(p.id, (prev) => {
                                const next = prev.options.slice();
                                next.splice(pairIndex, 1);
                                return { ...prev, options: next };
                              });
                            }}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'policies' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn('text-xs font-black uppercase tracking-widest opacity-60', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {t('admin.config.storage.policies.title')}
                </div>
                <button
                  type="button"
                  className={cn(
                    'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                    isDark ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
                  )}
                  onClick={addPolicy}
                >
                  <Plus size={16} />
                  {t('admin.config.storage.actions.addPolicy')}
                </button>
              </div>

              <div className={cn('text-sm font-bold opacity-70', isDark ? 'text-slate-400' : 'text-slate-600')}>
                {t('admin.config.storage.policies.hint')}
              </div>

              {policies.length === 0 && (
                <div className={cn(
                  'rounded-xl border p-3',
                  isDark ? 'border-white/10 bg-black/20 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700',
                )}>
                  {t('admin.config.storage.policies.empty')}
                </div>
              )}

              {policies.map((policy, idx) => (
                <div
                  key={policy.id}
                  className={cn(
                    'rounded-2xl border p-3 sm:p-4',
                    isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black uppercase tracking-wide truncate">
                        {t('admin.config.storage.policies.policy')} #{idx + 1}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        'h-9 px-3 rounded-lg border text-sm font-black inline-flex items-center gap-2 transition-all',
                        isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20' : 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100',
                      )}
                      onClick={() => removePolicy(policy.id)}
                    >
                      <Trash2 size={16} />
                      {t('common.delete')}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.policies.roleId')}
                      <input
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        value={policy.role_id}
                        onChange={(e) => updatePolicy(policy.id, (prev) => ({ ...prev, role_id: e.target.value }))}
                      />
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.policies.poolName')}
                      <select
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        value={policy.pool_name}
                        onChange={(e) => updatePolicy(policy.id, (prev) => ({ ...prev, pool_name: e.target.value }))}
                      >
                        {pools.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name || '(unnamed)'}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={cn('text-sm font-black', isDark ? 'text-slate-300' : 'text-slate-700')}>
                      {t('admin.config.storage.policies.defaultQuota')}
                      <input
                        className={cn(
                          'mt-1 w-full h-10 rounded-lg border px-3 text-sm font-mono font-bold',
                          isDark ? 'border-white/15 bg-black/30 text-white' : 'border-slate-300 bg-white text-slate-900',
                        )}
                        placeholder="0"
                        value={policy.default_quota}
                        onChange={(e) => updatePolicy(policy.id, (prev) => ({ ...prev, default_quota: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={cn(
            'border-t px-4 py-4 sm:px-6 flex items-center justify-between gap-2',
            isDark ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50/50',
          )}
        >
          <button
            type="button"
            onClick={resetToLocalDefaults}
            className={cn(
              'h-10 px-4 rounded-lg border text-sm font-black transition-all',
              isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20' : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
            )}
          >
            {t('admin.config.storage.actions.resetLocal')}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'h-10 px-4 rounded-lg border text-sm font-black transition-all',
                isDark ? 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {t('common.cancel')}
            </button>
            <Button
              onClick={applyToConfig}
              className="h-10 px-6 rounded-lg shadow-xl shadow-primary/20"
            >
              {t('admin.config.storage.actions.apply')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
