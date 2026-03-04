import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/stores/auth.ts';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { User, Mail, FileText, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import { client } from '@/lib/api.ts';
import { isPhoneInputValid, normalizePhoneInput } from '@/lib/contactNormalize.ts';

import { useToastStore } from '@fileuni/shared';

import type { components } from '@/types/api.ts';

type ProfileUpdateBody = components["schemas"]["UpdateProfileRequest"];

export const ProfileView = () => {
  const { t } = useTranslation();
  const { currentUserData } = useAuthStore();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    full_name: '',
    nickname: '',
    bio: '',
    email: '',
    phone: '',
    other_phones: [] as string[],
  });

  useEffect(() => {
    /**
     * 获取当前用户信息并初始化表单 / Fetch current user info and initialize the form
     */
    const fetchProfile = async () => {
      try {
        const { data: res } = await client.GET('/api/v1/users/auth/me');
        if (res?.success && res.data) {
          setForm({
            full_name: res.data.full_name || '',
            nickname: res.data.nickname || '',
            bio: res.data.bio || '',
            email: res.data.email || '',
            phone: res.data.phone || '',
            other_phones: res.data.other_phones || [],
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  /**
   * 校验备用电话列表中的非法索引 / Validate invalid indexes in the extra phones list
   */
  const invalidOtherPhoneIndexes = useMemo(
    () =>
      form.other_phones
        .map((phone, index) => ({ phone: phone.trim(), index }))
        .filter((item) => item.phone.length > 0 && !isPhoneInputValid(item.phone))
        .map((item) => item.index),
    [form.other_phones]
  );

  /**
   * 提交个人资料修改 / Submit profile updates
   */
  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (invalidOtherPhoneIndexes.length > 0) {
      addToast(t('profile.invalidPhoneList'), 'error');
      return;
    }
    setSaving(true);
    try {
      if (!currentUserData?.user.id) return;
      const inputOtherPhones = form.other_phones
        .map((phone) => normalizePhoneInput(phone))
        .filter((phone) => phone.length > 0);
      const body: ProfileUpdateBody = {
        full_name: form.full_name,
        nickname: form.nickname,
        bio: form.bio,
        other_phones: inputOtherPhones,
      };
      const { data: res, error } = await client.PUT('/api/v1/users/auth/{user_id}/profile', {
        params: { path: { user_id: currentUserData.user.id } },
        body,
      });
      if (error || !res?.success || !res.data) {
        return;
      }
      const serverOtherPhones: string[] = Array.isArray(res.data.other_phones)
        ? (res.data.other_phones as string[])
        : [];
      setForm({
        full_name: res.data.full_name || '',
        nickname: res.data.nickname || '',
        bio: res.data.bio || '',
        email: res.data.email || '',
        phone: res.data.phone || '',
        other_phones: serverOtherPhones,
      });

      const changed =
        serverOtherPhones.length !== inputOtherPhones.length ||
        serverOtherPhones.some((phone: string, index: number) => phone !== inputOtherPhones[index]);
      if (changed) {
        addToast(t('profile.phoneListSynced'), 'warning');
      }
      addToast(t('profile.success'), 'success');
    } catch (e: unknown) {
      // Handled
    } finally {
      setSaving(false);
    }
  };

  const addPhone = () => {
    if (form.other_phones.length < 10) {
      setForm({ ...form, other_phones: [...form.other_phones, ''] });
    }
  };

  const updatePhone = (index: number, val: string) => {
    const next = [...form.other_phones];
    next[index] = val;
    setForm({ ...form, other_phones: next });
  };

  const normalizePhoneAt = (index: number) => {
    const next = [...form.other_phones];
    next[index] = normalizePhoneInput(next[index]);
    setForm({ ...form, other_phones: next });
  };

  const removePhone = (index: number) => {
    setForm({ ...form, other_phones: form.other_phones.filter((_, i) => i !== index) });
  };

  if (loading) return <div className="h-64 flex items-center justify-center animate-pulse opacity-50 font-black uppercase tracking-widest">{t('profile.loading')}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-xl">
          <form onSubmit={handleSave} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('profile.fullName')}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                  <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="pl-12" placeholder={t('profile.fullNamePlaceholder')} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('profile.nickname')}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                  <Input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className="pl-12" placeholder={t('profile.nicknamePlaceholder')} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40 ml-1">{t('profile.bio')}</label>
              <div className="relative group">
                <FileText className="absolute left-4 top-4 opacity-30 group-focus-within:text-primary transition-all" size={18} />
                <textarea 
                  value={form.bio} 
                  onChange={e => setForm({ ...form, bio: e.target.value })}
                  className="w-full min-h-[120px] pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-primary outline-none transition-all font-bold text-base"
                  placeholder={t('profile.bioPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('profile.extraPhones')}</label>
                <button type="button" onClick={addPhone} className="text-sm font-black text-primary flex items-center gap-1 hover:underline">
                  <Plus size={18} /> {t('profile.addNew')}
                </button>
              </div>
              <div className="space-y-3">
                {form.other_phones.map((phone, idx) => (
                  <div key={idx} className="animate-in slide-in-from-left-2">
                    <div className="flex gap-2">
                      <Input 
                        value={phone} 
                        onChange={e => updatePhone(idx, e.target.value)} 
                        onBlur={() => normalizePhoneAt(idx)}
                        placeholder={t('profile.phonePlaceholder')}
                        className={`font-mono text-sm ${invalidOtherPhoneIndexes.includes(idx) ? 'border-red-500' : ''}`}
                      />
                      <button type="button" onClick={() => removePhone(idx)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 transition-all hover:text-white shrink-0 border border-red-500/20">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {invalidOtherPhoneIndexes.includes(idx) && (
                      <p className="mt-1 text-sm text-red-500 font-bold">{t('profile.invalidPhoneFormat')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-end">
              <Button type="submit" className="px-12 h-14" disabled={saving || invalidOtherPhoneIndexes.length > 0}>
                {saving ? <span className="loading-spinner w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                  <>
                    <Save size={18} className="mr-2" /> {t('profile.saveChanges')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Mail size={120} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest opacity-30 mb-6">{t('profile.readonlyIdentity')}</h3>
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-sm font-bold opacity-40 uppercase">{t('profile.primaryEmail')}</span>
              <div className="flex items-center gap-2 font-mono text-sm font-black">
                {form.email || t('profile.none')}
                {form.email && <CheckCircle2 size={18} className="text-green-500" />}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-bold opacity-40 uppercase">{t('profile.verifiedPhone')}</span>
              <div className="flex items-center gap-2 font-mono text-sm font-black">
                {form.phone || t('profile.none')}
                {form.phone && <CheckCircle2 size={18} className="text-green-500" />}
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/5">
            <p className="text-sm font-bold opacity-40 leading-relaxed italic">
              {t('profile.verifiedNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
