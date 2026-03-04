import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Modal } from '@/components/ui/Modal.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Link as LinkIcon, Copy, CheckCircle2, Lock, Clock, Dices, Download, Zap, Settings, Info, User, QrCode, X, Upload, FilePenLine, Trash2 } from 'lucide-react';
import type { FileInfo } from '../types/index.ts';
import { client, BASE_URL } from '@/lib/api.ts';
import { useThemeStore } from '@fileuni/shared';
import { cn } from '@/lib/utils.ts';
import { useFileActions } from '../hooks/useFileActions.ts';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  file: FileInfo | null;
}

import type { components } from '@/types/api.ts';

type ShareData = components["schemas"]["Resp"] & { data: { id: string } };

export const ShareModal = ({ isOpen, onClose, file }: Props) => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const { theme } = useThemeStore();
  const { loadFiles } = useFileActions();
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  
  const [mainTab, setMainTab] = useState<'view' | 'edit'>('view');
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [showQr, setShowQr] = useState(false);
  
  const isEditing = !!(file && file.id && file.view_count !== undefined);

  const [form, setForm] = useState({
    password: '',
    expireDate: '',
    maxDownloads: 0,
    enableDirect: false,
    canUpload: false,
    canUpdateNoCreate: false,
    canDelete: false,
    passwordMode: 'keep' as 'keep' | 'change' | 'remove',
  });

  const formatDateForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  React.useEffect(() => {
    if (isOpen && isEditing && file) {
      setForm({
        password: '',
        expireDate: file.expire_at ? formatDateForInput(new Date(file.expire_at)) : '',
        maxDownloads: file.max_downloads || 0,
        enableDirect: file.enable_direct || false,
        canUpload: file.can_upload || false,
        canUpdateNoCreate: file.can_update_no_create || false,
        canDelete: file.can_delete || false,
        passwordMode: 'keep',
      });
      setMainTab('view');
    } else if (isOpen && !isEditing) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setForm({
        password: '',
        expireDate: formatDateForInput(defaultDate),
        maxDownloads: 0,
        enableDirect: false,
        canUpload: false,
        canUpdateNoCreate: false,
        canDelete: false,
        passwordMode: 'change', 
      });
      setMainTab('edit');
    }
    setShareData(null);
    setActiveTab('basic');
    setShowQr(false);
  }, [isOpen, isEditing, file]);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleDirect = () => {
    setForm(prev => ({ ...prev, enableDirect: !prev.enableDirect }));
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(prev => ({ ...prev, password: result, passwordMode: 'change' }));
  };

  const setQuickPassword = (pwd: string) => {
    setForm(prev => ({ ...prev, password: pwd, passwordMode: 'change' }));
  };

  const setExpireByDays = (days: number) => {
    if (days === 0) {
      setForm({ ...form, expireDate: '' });
      return;
    }
    const date = new Date();
    date.setDate(date.getDate() + days);
    setForm({ ...form, expireDate: formatDateForInput(date) });
  };

  const getExpireDays = () => {
    if (!form.expireDate) return undefined;
    const now = new Date();
    const target = new Date(form.expireDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : undefined;
  };

  const handleCreateShare = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const createBody: Record<string, unknown> = {
        path: file.path,
        password: form.password || undefined,
        expire_days: getExpireDays(),
        max_downloads: form.maxDownloads > 0 ? form.maxDownloads : undefined,
        enable_direct: form.enableDirect,
        can_upload: file.is_dir ? form.canUpload : undefined,
        can_update_no_create: file.is_dir ? form.canUpdateNoCreate : undefined,
        can_delete: file.is_dir ? form.canDelete : undefined,
      };
      const { data: res } = await client.POST('/api/v1/file/shares/create', {
        body: createBody as unknown as never
      });
      if (res?.success) {
        setShareData(res as ShareData);
        addToast(t('filemanager.shareModal.successTitle'), 'success');
        loadFiles();
        setMainTab('view');
      }
    } catch (e: unknown) { } finally { setLoading(false); }
  };

  const handleUpdateShare = async () => {
    if (!file || !file.id) return;
    setLoading(true);
    try {
      const days = getExpireDays();
      const body: Record<string, unknown> = { 
        enable_direct: form.enableDirect,
        expire_days: form.expireDate === '' ? null : (days !== undefined ? days : null),
        max_downloads: form.maxDownloads > 0 ? form.maxDownloads : null,
        can_upload: file.is_dir ? form.canUpload : undefined,
        can_update_no_create: file.is_dir ? form.canUpdateNoCreate : undefined,
        can_delete: file.is_dir ? form.canDelete : undefined,
      };
      
      if (form.passwordMode === 'change') { 
        body.password = form.password || null; 
      } else if (form.passwordMode === 'remove') { 
        body.password = null; 
      }

      const { data: res } = await client.PATCH('/api/v1/file/shares/{id}', {
        params: { path: { id: file.id } },
        body: body as unknown as never
      });

      if (res?.success) {
        addToast(t('common.manage') || 'Updated successfully', 'success');
        loadFiles();
        
        // Construct full ShareData response
        const newShareData = { 
          ...res, 
          data: { id: file.id } 
        } as unknown as ShareData;
        
        setShareData(newShareData);
        setMainTab('view');
      }
    } catch (e: unknown) { } finally { setLoading(false); }
  };

  const handleClose = () => {
    setShareData(null);
    setForm({
      password: '',
      expireDate: '',
      maxDownloads: 0,
      enableDirect: false,
      canUpload: false,
      canUpdateNoCreate: false,
      canDelete: false,
      passwordMode: 'keep',
    });
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast(t('filemanager.shareModal.copySuccess'), 'success');
  };

  // Unified logic to get share ID
  const shareId = shareData?.data.id || (isEditing ? file?.id : null);

  const getFullBaseUrl = () => {
    const origin = window.location.origin;
    const path = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
    return origin + path;
  };

  const shareUrl = shareId 
    ? `${getFullBaseUrl()}#mod=file-manager&page=share&token=${shareId}`
    : "";
  
  const directUrl = shareId
    ? `${BASE_URL || window.location.origin}/api/v1/file/public/direct/${shareId}/`
    : '';

  const getCombinedAllInfo = () => {
    let info = `${t('filemanager.shareModal.copyFormat.title')}\n${t('filemanager.shareModal.copyFormat.file')}: ${file?.name}\n${t('filemanager.shareModal.copyFormat.link')}: ${shareUrl}`;
    const hasVisiblePwd = (form.passwordMode === 'change' || (!isEditing && form.password)) && form.password;
    
    if (hasVisiblePwd) {
      info += `\n${t('filemanager.shareModal.copyFormat.password')}: ${form.password}`;
    } else if (file?.has_password && form.passwordMode === 'keep') {
      info += `\n${t('filemanager.shareModal.copyFormat.password')}: ${t('filemanager.shareModal.copyFormat.existingPassword')}`;
    }

    if (form.enableDirect || file?.enable_direct) {
      info += `\n\n${t('filemanager.shareModal.copyFormat.directTitle')}\n${t('filemanager.shareModal.copyFormat.url')}: ${directUrl}\n${t('filemanager.shareModal.copyFormat.user')}: fileuni`;
      if (hasVisiblePwd) {
        info += `\n${t('filemanager.shareModal.copyFormat.pass')}: ${form.password}`;
      } else if (file?.has_password && form.passwordMode === 'keep') {
        info += `\n${t('filemanager.shareModal.copyFormat.pass')}: ${t('filemanager.shareModal.copyFormat.existingPassword')}`;
      }
    }
    return info;
  };

  const currentHasPassword = () => {
    if (form.passwordMode === 'remove') return false;
    if (form.passwordMode === 'change') return !!form.password;
    return !!file?.has_password;
  };

  const PresetTag = ({ label, days }: { label: string, days: number }) => (
    <button
      type="button"
      onClick={() => setExpireByDays(days)}
      className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[14px] font-black uppercase tracking-tighter opacity-60 hover:opacity-100 hover:bg-primary/20 hover:text-primary transition-all"
    >
      {label}
    </button>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={isEditing ? t('filemanager.shareModal.viewEditTitle') : t('filemanager.shareModal.title')} 
      maxWidth="max-w-md"
      bodyClassName="p-0"
    >
      <div className="flex flex-col h-full">
        {isEditing && (
          <div className="flex border-b border-white/5 bg-black/20 shrink-0">
            <button 
              onClick={() => setMainTab('view')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black uppercase tracking-[0.2em] transition-all border-b-2",
                mainTab === 'view' ? "border-primary text-primary bg-primary/5" : "border-transparent opacity-40 hover:opacity-100"
              )}
            >
              <Info size={18} /> {t('filemanager.shareModal.viewTab')}
            </button>
            <button 
              onClick={() => setMainTab('edit')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black uppercase tracking-[0.2em] transition-all border-b-2",
                mainTab === 'edit' ? "border-primary text-primary bg-primary/5" : "border-transparent opacity-40 hover:opacity-100"
              )}
            >
              <Settings size={18} /> {t('filemanager.shareModal.editTab')}
            </button>
          </div>
        )}

        {mainTab === 'view' ? (
          <div className="p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {shareData && (
              <div className="flex flex-col items-center text-center space-y-1 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center shadow-inner">
                  <CheckCircle2 size={20} />
                </div>
                <h4 className="text-base font-black tracking-tight text-green-500">{t('filemanager.shareModal.successTitle')}</h4>
              </div>
            )}

            <div className="space-y-3">
              <div className={cn(
                "rounded-2xl border overflow-hidden transition-all flex flex-col",
                isDark ? "bg-black/20 border-white/5" : "bg-gray-50 border-gray-100"
              )}>
                {/* Header with QR Toggle */}
                <div className="p-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <LinkIcon size={18} className="text-primary" />
                    <span className="text-[14px] font-black uppercase opacity-40 tracking-widest">{t('filemanager.shareModal.sharePackage')}</span>
                  </div>
                  <button
                    onClick={() => setShowQr(!showQr)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      showQr ? "bg-red-500 text-white shadow-lg hover:bg-red-600" : "bg-white/5 opacity-40 hover:opacity-100"
                    )}
                    title={showQr ? t('filemanager.shareModal.hideQrCode') : t('filemanager.shareModal.showQrCode')}
                  >
                    {showQr ? <X size={18} /> : <QrCode size={18} />}
                  </button>
                </div>

                {showQr ? (
                  <div className="p-6 flex flex-col items-center justify-center bg-white space-y-3 animate-in zoom-in-95 duration-300">
                    <QRCodeSVG 
                      value={getCombinedAllInfo()} 
                      size={140}
                      level="H"
                    />
                    <p className="text-[14px] font-black text-black/40 uppercase tracking-widest">{t('filemanager.shareModal.qrDesc')}</p>
                  </div>
                ) : (
                  <>
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-black uppercase opacity-40 tracking-widest">{t('filemanager.shareModal.shareUrlLabel')}</span>
                        {currentHasPassword() && (
                          <div className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[14px] font-black uppercase border border-yellow-500/20">
                            <Lock size={10} className="inline mr-1" /> {t('filemanager.shareModal.protected')}
                          </div>
                        )}
                      </div>
                      <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-sm text-primary/80 break-all leading-relaxed shadow-inner">
                        {shareUrl}
                      </div>
                    </div>

                    {(form.passwordMode === 'change' || (!isEditing && form.password)) && form.password && (
                      <div className="px-4 py-2 bg-yellow-500/5 border-y border-yellow-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Lock size={18} className="text-yellow-500" />
                          <div className="flex flex-col">
                            <span className="text-[14px] font-black uppercase opacity-40 leading-none mb-1">{t('filemanager.shareModal.accessPasswordLabel')}</span>
                            <span className="text-sm font-mono font-black text-yellow-500 tracking-wider">{form.password}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {(form.enableDirect || file?.enable_direct) && (
                      <div className="p-3 bg-primary/5 border-t border-white/5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Zap size={18} className="text-yellow-500" />
                          <span className="text-[14px] font-black uppercase opacity-40 tracking-[0.2em]">{t('filemanager.shareModal.directLinkTitle')}</span>
                        </div>
                        <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-sm text-primary/60 break-all leading-relaxed shadow-inner">
                          {directUrl}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="flex items-center gap-1.5 text-[14px] font-black uppercase opacity-40"><User size={10} /> {t('filemanager.shareModal.directUser')}</span>
                            <div className="bg-black/20 p-2 rounded-lg font-mono text-sm text-center border border-white/5 opacity-80 text-primary">fileuni</div>
                          </div>
                          <div className="space-y-1">
                            <span className="flex items-center gap-1.5 text-[14px] font-black uppercase opacity-40"><Lock size={10} /> {t('filemanager.shareModal.directPass')}</span>
                            <div className="bg-black/20 p-2 rounded-lg font-mono text-sm text-center border border-white/5 truncate opacity-80 text-yellow-500">
                              {(form.passwordMode === 'change' || !isEditing) && form.password ? form.password : '********'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button 
                  onClick={() => copyToClipboard(getCombinedAllInfo())}
                  className="w-full py-3 bg-primary text-white text-sm font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Copy size={18} /> {currentHasPassword() || form.enableDirect || file?.enable_direct ? t('filemanager.shareModal.copyAllInfo') : t('filemanager.shareModal.copyLink')}
                </button>
              </div>
            </div>

            <Button variant="ghost" className="w-full h-10 rounded-xl text-sm font-black uppercase tracking-widest opacity-40 hover:opacity-100" onClick={handleClose}>
              {t('filemanager.shareModal.done')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex border-b border-white/5 px-4">
              <button onClick={() => setActiveTab('basic')} className={cn("px-4 py-2.5 text-[14px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'basic' ? "border-primary text-primary" : "border-transparent opacity-40 hover:opacity-100")}>{t('filemanager.shareModal.basicTab')}</button>
              <button onClick={() => setActiveTab('advanced')} className={cn("px-4 py-2.5 text-[14px] font-black uppercase tracking-widest transition-all border-b-2", activeTab === 'advanced' ? "border-primary text-primary" : "border-transparent opacity-40 hover:opacity-100")}>{t('filemanager.shareModal.advancedTab')}</button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
              {activeTab === 'basic' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[14px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2"><Clock size={10} /> {t('filemanager.shareModal.expirationLabel')}</label>
                      <div className="flex items-center gap-1">
                        <PresetTag label="24h" days={1} /><PresetTag label="7D" days={7} /><PresetTag label="30D" days={30} /><PresetTag label="∞" days={0} />
                      </div>
                    </div>
                    <div className="relative group">
                      <Input type="datetime-local" value={form.expireDate} onChange={e => setForm({...form, expireDate: e.target.value})} className="h-9 text-sm font-mono" />
                      {!form.expireDate && <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-20"><span className="text-[14px] font-black uppercase tracking-widest">{t('filemanager.shareModal.expirePermanent')}</span></div>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[14px] font-black uppercase tracking-widest opacity-40 ml-1 flex items-center gap-2"><Lock size={10} /> {t('filemanager.shareModal.passwordLabel')}</label>
                    {isEditing && (
                      <div className="flex flex-wrap gap-1">
                        {(['keep', 'remove', 'change'] as const).map((mode) => (
                          <button key={mode} type="button" onClick={() => setForm({...form, passwordMode: mode})} className={cn("flex-1 py-1.5 rounded-lg text-[14px] font-black uppercase transition-all border whitespace-nowrap px-2", form.passwordMode === mode ? (mode === 'remove' ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-primary/20 border-primary text-primary") : "bg-white/5 border-transparent opacity-40")}>{mode === 'keep' ? t('filemanager.shareModal.keepOldPassword') : mode === 'remove' ? t('filemanager.shareModal.removePassword') : t('common.manage')}</button>
                        ))}
                      </div>
                    )}
                    {(form.passwordMode === 'change' || !isEditing) && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        {isEditing && <p className="text-[14px] text-yellow-500 font-bold bg-yellow-500/5 p-1.5 rounded-lg leading-relaxed italic border border-yellow-500/10">{t('filemanager.shareModal.passwordChangeWarning')}</p>}
                        <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value, passwordMode: 'change' })} placeholder={t('filemanager.shareModal.passwordPlaceholder')} className="h-9 text-sm" />
                        <div className="flex flex-wrap items-center gap-1">
                          <button type="button" onClick={generateRandomPassword} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[14px] font-black uppercase bg-white/5 hover:bg-white/10 text-white/60 border border-white/5 transition-all"><Dices size={10} className="text-primary" /> {t('filemanager.shareModal.randomPassword')}</button>
                          <div className="flex items-center gap-1 px-1">{['1111', '1234', '8888'].map(pwd => (<button key={pwd} type="button" onClick={() => setQuickPassword(pwd)} className="px-1.5 py-0.5 rounded-md text-[14px] font-black opacity-40 hover:opacity-100 hover:bg-white/5 transition-all">{pwd}</button>))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {file?.is_dir && (
                    <div className="space-y-2">
                      <label className="text-[14px] font-black uppercase tracking-widest opacity-40 ml-1">{t('filemanager.shareModal.writePermissionsLabel')}</label>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, canUpload: !prev.canUpload }))}
                          className={cn(
                            "h-9 rounded-xl border text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            form.canUpload ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 opacity-50 hover:opacity-100"
                          )}
                        >
                          <Upload size={18} /> {t('filemanager.shareModal.permissionUpload')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, canUpdateNoCreate: !prev.canUpdateNoCreate }))}
                          className={cn(
                            "h-9 rounded-xl border text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            form.canUpdateNoCreate ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 opacity-50 hover:opacity-100"
                          )}
                        >
                          <FilePenLine size={18} /> {t('filemanager.shareModal.permissionUpdateNoCreate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, canDelete: !prev.canDelete }))}
                          className={cn(
                            "h-9 rounded-xl border text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            form.canDelete ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/5 border-white/5 opacity-50 hover:opacity-100"
                          )}
                        >
                          <Trash2 size={18} /> {t('filemanager.shareModal.permissionDelete')}
                        </button>
                      </div>
                      <p className="text-[14px] opacity-40 font-medium px-1">{t('filemanager.shareModal.writePermissionsDesc')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="space-y-2">
                    <label className="text-[14px] font-black uppercase tracking-widest opacity-40 ml-1 flex items-center gap-2"><Download size={10} /> {t('filemanager.shareModal.maxDownloadsLabel')}</label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={form.maxDownloads} onChange={e => setForm({ ...form, maxDownloads: parseInt(e.target.value) || 0 })} className="h-9 text-sm font-bold w-20" />
                      <button type="button" onClick={() => setForm({ ...form, maxDownloads: 0 })} className={cn("flex-1 h-9 rounded-xl border font-bold text-sm transition-all uppercase", form.maxDownloads === 0 ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 opacity-40")}>{t('filemanager.shareModal.unlimited')}</button>
                    </div>
                  </div>
                  <div className={cn("flex items-center justify-between p-2.5 rounded-xl border transition-all", form.enableDirect ? "bg-yellow-500/10 border-yellow-500/20" : "bg-white/5 border-white/5")}>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className={form.enableDirect ? "text-yellow-500" : "opacity-40"} />
                        <p className="text-[14px] font-black uppercase tracking-widest">{t('filemanager.shareModal.enableDirectLabel')}</p>
                      </div>
                      <p className="text-[14px] opacity-40 font-medium max-w-[180px]">{t('filemanager.shareModal.enableDirectDesc')}</p>
                    </div>
                    <button type="button" onClick={toggleDirect} className={cn("w-9 h-4.5 rounded-full relative transition-all duration-300 shrink-0", form.enableDirect ? "bg-yellow-500 shadow-md shadow-yellow-500/20" : "bg-zinc-600")}>
                      <div className={cn("absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 shadow-sm", form.enableDirect ? "left-5" : "left-0.5")} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pt-0 border-t border-white/5 bg-white/[0.01] shrink-0">
              <Button className="w-full h-10 rounded-xl text-sm font-black tracking-widest uppercase shadow-lg shadow-primary/20" onClick={isEditing ? handleUpdateShare : handleCreateShare} disabled={loading}>
                {loading ? <span className="loading-spinner animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : isEditing ? t('filemanager.shareModal.updateBtn') : t('filemanager.shareModal.generateBtn')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
