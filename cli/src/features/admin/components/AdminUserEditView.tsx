import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Switch } from '@/components/ui/Switch.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { 
  Database, Save, RefreshCw, 
  ShieldAlert, ArrowLeft, Key, Trash2, Lock, 
  HardDrive, UserCircle,
  Hash, RotateCcw, Cloud
} from 'lucide-react';
import { client } from '@/lib/api.ts';
import { normalizeEmailInput, normalizePhoneInput, isPhoneInputValid } from '@/lib/contactNormalize.ts';
import type { components } from '@/types/api.ts';
import { cn } from '@/lib/utils.ts';
import { Plus } from 'lucide-react';
import { fetchRolesAndPermissions, fetchUserPermissions, updateUserPermissions, type RolePermissionView, type PermissionCatalogItem } from './roleApi';

type UserUpdateBody = components["schemas"]["AdminUpdateUserRequest"];
type FileSettingsBody = components["schemas"]["UserFileSettings"];
type UserResponse = components["schemas"]["UserResponse"];
type UserStatusValue = 'active' | 'inactive' | 'banned';
interface AdminUserEditForm {
  full_name: string;
  nickname: string;
  email: string;
  phone: string;
  other_phones: string[];
  role_id: number;
  status: UserStatusValue;
  bio?: string;
}

const createDefaultFileSettings = (userId: string): FileSettingsBody => ({
  user_id: userId,
  pool_name: '',
  base_dir: '',
  storage_type: 'vfs',
  sftp_enable_password: true,
  storage_quota: 0,
  storage_used: 0,
  s3_access_key: '',
  s3_secret_key: '',
  thumbnail_disable_audio: false,
  thumbnail_disable_image: false,
  thumbnail_disable_markdown: false,
  thumbnail_disable_office: false,
  thumbnail_disable_pdf: false,
  thumbnail_disable_tex: false,
  thumbnail_disable_text: false,
  thumbnail_disable_video: false,
});

const normalizeUserStatus = (
  status: UserResponse['status'] | string | null | undefined,
): UserStatusValue => {
  if (!status) return 'active';
  if (typeof status === 'string') {
    const normalized = status.toLowerCase();
    if (normalized === 'inactive') return 'inactive';
    if (normalized === 'banned') return 'banned';
    return 'active';
  }
  if ('Inactive' in status) return 'inactive';
  if ('Banned' in status) return 'banned';
  return 'active';
};

export const AdminUserEditView = ({ userId: initialUserId }: { userId?: string }) => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);
  const [rawUser, setRawUser] = useState<UserResponse | null>(null);
  const [roles, setRoles] = useState<RolePermissionView[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalogItem[]>([]);
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, number>>({});

  // Resolve userId from props or URL path
  const [userId, setUserId] = useState<string | undefined>(initialUserId);

  useEffect(() => {
    if (initialUserId) {
      setUserId(initialUserId);
    } else {
      // 从 Hash 参数解析 ID / Parse ID from Hash params
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const queryId = params.get('id');
      if (queryId) {
        setUserId(queryId);
      }
    }
  }, [initialUserId]);

  const [form, setForm] = useState<AdminUserEditForm>({
    full_name: '',
    nickname: '',
    email: '',
    phone: '',
    other_phones: [],
    role_id: 100,
    status: 'active',
  });

  const [fileSettings, setFileSettings] = useState<FileSettingsBody>(createDefaultFileSettings(userId || ''));

  // Modals
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch user base info
      const { data: userRes } = await client.GET('/api/v1/users/admin/users/{user_id}', { 
        params: { path: { user_id: userId || '' } } 
      });
      
      if (userRes?.success && userRes.data) {
        const u = userRes.data;
        setRawUser(u);
        
        setForm({
          full_name: u.full_name || '',
          nickname: u.nickname || '',
          email: u.email || '',
          phone: u.phone || '',
          other_phones: u.other_phones || [],
          role_id: u.role_id,
          status: normalizeUserStatus(u.status),
        });
      }

      const userPermissionData = await fetchUserPermissions(userId);
      setPermissionCatalog(userPermissionData.catalog || []);
      const nextOverrides: Record<string, number> = {};
      (userPermissionData.overrides || []).forEach((item) => {
        nextOverrides[item.perm_key] = item.effect;
      });
      setPermissionOverrides(nextOverrides);

      // Fetch file settings
      const { data: settingsRes } = await client.GET('/api/v1/file/admin/user-settings/{user_id}', {
        params: { path: { user_id: userId || '' } }
      });
      if (settingsRes?.success && settingsRes.data) {
        const s = settingsRes.data;
        const defaults = createDefaultFileSettings(s.user_id || userId || '');
        setFileSettings({
          ...defaults,
          user_id: s.user_id || defaults.user_id,
          pool_name: s.pool_name || defaults.pool_name,
          base_dir: s.base_dir || defaults.base_dir,
          storage_type: s.storage_type || defaults.storage_type,
          sftp_enable_password: Boolean(s.sftp_enable_password),
          storage_quota: Number(s.storage_quota ?? defaults.storage_quota),
          storage_used: Number(s.storage_used ?? defaults.storage_used),
          s3_access_key: s.s3_access_key || '',
          s3_secret_key: s.s3_secret_key || '',
          thumbnail_disable_audio: Boolean(s.thumbnail_disable_audio),
          thumbnail_disable_image: Boolean(s.thumbnail_disable_image),
          thumbnail_disable_markdown: Boolean(s.thumbnail_disable_markdown),
          thumbnail_disable_office: Boolean(s.thumbnail_disable_office),
          thumbnail_disable_pdf: Boolean(s.thumbnail_disable_pdf),
          thumbnail_disable_tex: Boolean(s.thumbnail_disable_tex),
          thumbnail_disable_text: Boolean(s.thumbnail_disable_text),
          thumbnail_disable_video: Boolean(s.thumbnail_disable_video),
        });
      }
    } catch (e: unknown) { console.error(e); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchRolesAndPermissions();
        setRoles(data.roles);
      } catch (error) {
        console.error(error);
      }
    };
    void loadRoles();
  }, []);

  const handleUpdate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      await client.PUT('/api/v1/users/admin/users/{user_id}', {
        params: { path: { user_id: userId } },
        body: {
          full_name: form.full_name,
          nickname: form.nickname,
          email: form.email,
          phone: form.phone,
          role_id: form.role_id,
          status: form.status,
          bio: form.bio,
        } as UserUpdateBody
      });
      await client.PUT('/api/v1/file/admin/user-settings/{user_id}', {
        params: { path: { user_id: userId } },
        body: fileSettings
      });
      const overrideList = (Object.entries(permissionOverrides) as Array<[string, number]>)
        .filter(([, effect]) => effect === 1 || effect === -1)
        .map(([perm_key, effect]) => ({ perm_key, effect }));
      await updateUserPermissions(userId, overrideList);
      addToast(t('admin.saveSuccess'), 'success');
      fetchData();
    } catch (e: unknown) { /* handled */ }
    finally { setSaving(false); }
  };

  const handleRecalibrate = async () => {
    if (!userId) return;
    setRecalibrating(true);
    try {
      const { data: res } = await client.POST('/api/v1/file/admin/recalibrate/{user_id}', {
        params: { path: { user_id: userId } }
      });
      if (res?.success && res.data) {
        const usageData = res.data as { storage_used: number | string };
        setFileSettings(s => ({ ...s, storage_used: Number(usageData.storage_used) }));
        addToast('Storage usage recalibrated', 'success');
      }
    } catch (e) { /* handled */ }
    finally { setRecalibrating(false); }
  };

  const handleResetPassword = async () => {
    if (!userId || newPassword !== confirmPassword || newPassword.length < 6) return;
    setIsResetting(true);
    try {
      await client.POST('/api/v1/users/admin/users/{user_id}/reset-password', {
        params: { path: { user_id: userId } },
        body: { new_password: newPassword }
      });
      addToast(t('admin.users.resetPwdSuccess'), 'success');
      setResetPwdOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) { /* handled */ }
    finally { setIsResetting(false); }
  };

  const handleDelete = async () => {
    if (!userId) return;
    setIsDeleting(true);
    try {
      await client.DELETE('/api/v1/users/admin/users/{user_id}', {
        params: { path: { user_id: userId } }
      });
      addToast(t('admin.users.deleteSuccess'), 'success');
      window.location.hash = 'mod=admin&page=users';
    } catch (e) { /* handled */ }
    finally { setIsDeleting(false); }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes === -1) return t('admin.edit.unlimited');
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
  };

  if (loading) return <div className="h-64 flex items-center justify-center font-black animate-pulse opacity-50 uppercase tracking-widest">{t('admin.edit.accessing')}</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => window.location.hash = 'mod=admin&page=users'}
          className="p-2 hover:bg-white/5 rounded-full transition-colors opacity-50 hover:opacity-100"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-4">
            {rawUser?.username}
            {rawUser?.is_deleted && <span className="text-sm bg-red-500 text-white px-2 py-1 rounded font-black uppercase">{t('admin.users.status.deleted')}</span>}
          </h1>
          <p className="text-sm font-mono opacity-40 uppercase tracking-widest mt-1 flex items-center gap-2">
            <Hash size={10} /> {userId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <form onSubmit={handleUpdate} className="lg:col-span-8 space-y-8">
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl space-y-10">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <UserCircle size={20} />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">{t('admin.edit.identity')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.fullName')}</label>
                <Input value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder={t('admin.edit.fullNamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.nickname')}</label>
                <Input value={form.nickname || ''} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder={t('admin.edit.nicknamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.email')}</label>
                <Input
                  type="email"
                  value={form.email || ''}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setForm({ ...form, email: normalizeEmailInput(form.email || '') })}
                  placeholder={t('admin.edit.emailPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.phone') || 'Phone'}</label>
                <Input
                  value={form.phone || ''}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  onBlur={() => setForm({ ...form, phone: normalizePhoneInput(form.phone || '') })}
                  placeholder={t('admin.edit.phonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.role')}</label>
                <select value={form.role_id ?? 100} onChange={e => setForm({ ...form, role_id: Number(e.target.value) })} className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 font-bold focus:border-primary transition-all">
                  {roles.length === 0 ? (
                    <>
                      <option value={100}>{t('admin.users.roles.user')}</option>
                      <option value={0}>{t('admin.users.roles.admin')}</option>
                    </>
                  ) : (
                    roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.name} (#{role.role_id})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('profile.extraPhones') || 'Extra Phones'}</label>
                <button
                  type="button"
                  onClick={() => {
                    if ((form.other_phones?.length || 0) < 10) {
                      setForm({ ...form, other_phones: [...(form.other_phones || []), ''] });
                    }
                  }}
                  className="text-sm font-black text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus size={18} /> {t('profile.addNew')}
                </button>
              </div>
              <div className="space-y-3">
                {(form.other_phones || []).map((phone, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={phone}
                      onChange={e => {
                        const next = [...(form.other_phones || [])];
                        next[idx] = e.target.value;
                        setForm({ ...form, other_phones: next });
                      }}
                      onBlur={() => {
                        const next = [...(form.other_phones || [])];
                        next[idx] = normalizePhoneInput(phone);
                        setForm({ ...form, other_phones: next });
                      }}
                      placeholder={t('admin.edit.phoneExtraPlaceholder')}
                      className={cn("font-mono text-sm", phone && !isPhoneInputValid(phone) && "border-red-500")}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, other_phones: (form.other_phones || []).filter((_, i) => i !== idx) })}
                      className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 transition-all hover:text-white shrink-0 border border-red-500/20"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shadow-inner">
                  <HardDrive size={20} />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">{t('admin.edit.storageVfs')}</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.homeDir')}</label>
                <Input value={fileSettings.base_dir || ''} onChange={e => setFileSettings({ ...fileSettings, base_dir: e.target.value })} placeholder={t('admin.edit.homeDirPlaceholder')} className="font-mono text-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1 flex justify-between">
                    <span>{t('admin.edit.quota')}</span>
                    <span className="text-primary font-black">{Number(fileSettings.storage_quota) > 0 ? formatSize(Number(fileSettings.storage_quota)) : t('admin.edit.unlimited')}</span>
                  </label>
                  <Input type="number" value={fileSettings.storage_quota ?? 0} onChange={e => setFileSettings({ ...fileSettings, storage_quota: Number(e.target.value) })} placeholder={t('admin.edit.quotaPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.pool')}</label>
                  <Input value={fileSettings.pool_name || ''} onChange={e => setFileSettings({ ...fileSettings, pool_name: e.target.value })} placeholder={t('admin.edit.poolPlaceholder')} />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/5 group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-orange-500" />
                  <div>
                    <span className="text-sm font-black uppercase tracking-widest block">{t('admin.edit.sftpPass')}</span>
                    <p className="text-sm opacity-40 font-bold">{t('admin.edit.sftpPassDesc') || 'Allow login to SFTP using password'}</p>
                  </div>
                </div>
                <Switch 
                  checked={fileSettings.sftp_enable_password} 
                  onChange={(val) => setFileSettings({ ...fileSettings, sftp_enable_password: val })} 
                />
              </div>

              <div className="space-y-6 pt-6 border-t border-white/5">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight uppercase">{t('admin.edit.s3Credentials')}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.s3AccessKey') || 'S3 Access Key'}</label>
                    <Input 
                      value={fileSettings.s3_access_key || ''} 
                      onChange={e => setFileSettings({ ...fileSettings, s3_access_key: e.target.value })} 
                      placeholder={t('admin.edit.s3AccessKeyPlaceholder')} 
                      className="font-mono text-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('admin.edit.s3SecretKey') || 'S3 Secret Key'}</label>
                    <Input 
                      value={fileSettings.s3_secret_key || ''} 
                      onChange={e => setFileSettings({ ...fileSettings, s3_secret_key: e.target.value })} 
                      placeholder={t('admin.edit.s3SecretKeyPlaceholder')} 
                      className="font-mono text-sm" 
                    />
                  </div>
                </div>
                <p className="text-[14px] opacity-30 font-bold uppercase tracking-widest ml-1 italic">
                  {t('admin.edit.s3KeysHint')}
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shadow-inner">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">{t('pages.admin.permissions.title')}</h3>
              </div>
              <p className="text-sm opacity-50">{t('admin.perms.subtitle') || 'User override has higher priority than role permission'}</p>
              <div className="space-y-3">
                {permissionCatalog.map((item) => (
                  <div key={item.perm_key} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border border-white/10 rounded-xl p-3">
                    <div className="md:col-span-7">
                      <p className="font-mono text-sm font-bold">{item.perm_key}</p>
                      <p className="text-sm opacity-50">{item.desc_en}</p>
                    </div>
                    <div className="md:col-span-5">
                      <select
                        value={permissionOverrides[item.perm_key] ?? 0}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setPermissionOverrides((prev) => ({ ...prev, [item.perm_key]: next }));
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 font-bold text-sm"
                      >
                        <option value={0}>{t('admin.permissions.inherit')}</option>
                        <option value={1}>{t('admin.permissions.allow')}</option>
                        <option value={-1}>{t('admin.permissions.deny')}</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-end">
              <Button type="submit" className="h-14 px-12 text-lg shadow-lg shadow-primary/20" disabled={saving}>
                {saving ? <RefreshCw className="animate-spin mr-2" /> : <><Save size={20} className="mr-2" /> {t('admin.edit.saveChanges')}</>}
              </Button>
            </div>
          </div>
        </form>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest opacity-30 mb-6 flex items-center gap-2">
              <Database size={18} /> {t('admin.edit.usageStats')}
            </h3>
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5 relative group">
                <button 
                  type="button"
                  onClick={handleRecalibrate} 
                  className="absolute top-4 right-4 p-2 hover:bg-primary/20 rounded-lg text-primary opacity-0 group-hover:opacity-100 transition-all"
                >
                  <RefreshCw size={18} className={recalibrating ? "animate-spin" : ""} />
                </button>
                <p className="text-sm font-black opacity-40 uppercase mb-1">{t('admin.edit.occupied')}</p>
                <p className="text-2xl font-black">{formatSize(Number(fileSettings.storage_used))}</p>
              </div>
              
              <div className="space-y-2 px-2">
                <div className="flex justify-between text-sm font-black uppercase opacity-40">
                  <span>{t('admin.edit.quotaUsage')}</span>
                  <span>{Number(fileSettings.storage_quota) > 0 ? Math.round((Number(fileSettings.storage_used) / Number(fileSettings.storage_quota)) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full transition-all duration-1000",
                    (Number(fileSettings.storage_quota) > 0 && Number(fileSettings.storage_used) / Number(fileSettings.storage_quota) > 0.9) ? "bg-red-500" : "bg-primary"
                  )} style={{ width: `${Math.min(100, (Number(fileSettings.storage_used) / (Number(fileSettings.storage_quota) || 1)) * 100)}%` }} />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm font-black uppercase">
                  <span className="opacity-40">{t('admin.users.table.created')}</span>
                  <span className="opacity-70">{new Date(rawUser?.created_at || '').toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black uppercase">
                  <span className="opacity-40">{t('admin.users.table.status')}</span>
                  <span className="opacity-70">
                    {form.status ? t(`admin.users.status.${String(form.status).toLowerCase()}`) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/10 rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-red-500/50 mb-6 flex items-center gap-2">
              <ShieldAlert size={18} /> {t('admin.edit.criticalActions')}
            </h3>
            <div className="space-y-3">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setResetPwdOpen(true)}
                className="w-full justify-start border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white h-12 transition-all"
              >
                <Key size={16} className="mr-3" /> {t('admin.edit.forceReset')}
              </Button>
              {!rawUser?.is_deleted && (
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => setDeleteOpen(true)}
                  className="w-full justify-start border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white h-12 transition-all"
                >
                  <Trash2 size={16} className="mr-3" /> {t('admin.edit.softDelete')}
                </Button>
              )}
              {rawUser?.is_deleted && (
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={async () => {
                    if (!userId) return;
                    await client.POST('/api/v1/users/admin/users/{user_id}/restore', { params: { path: { user_id: userId } } });
                    addToast(t('admin.users.restoreSuccess'), 'success');
                    fetchData();
                  }}
                  className="w-full justify-start border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white h-12 transition-all"
                >
                  <RotateCcw size={16} className="mr-3" /> {t('admin.users.restore')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPwdOpen}
        onClose={() => setResetPwdOpen(false)}
        title={t('admin.users.resetPassword')}
      >
        <div className="space-y-6">
          <p className="text-sm opacity-60">
            {t('admin.users.resetPwdConfirm', { username: rawUser?.username })}
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.users.newPassword')}</label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t('admin.edit.passwordPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.users.confirmPassword')}</label>
              <Input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t('admin.edit.passwordPlaceholder')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setResetPwdOpen(false)}>{t('common.cancel')}</Button>
            <Button 
              disabled={isResetting || newPassword !== confirmPassword || newPassword.length < 6}
              onClick={handleResetPassword}
            >
              {isResetting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Key size={16} className="mr-2" />}
              {t('admin.users.resetPassword')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('admin.users.deleteUser')}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
            <ShieldAlert size={24} />
            <p className="text-sm font-bold">
              {t('admin.users.deleteConfirm', { username: rawUser?.username })}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button 
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Trash2 size={16} className="mr-2" />}
              {t('admin.users.confirmDelete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
