import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { FileIcon } from './FileIcon.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Download, Lock, ShieldAlert, Clock, Calendar, ChevronRight, ArrowLeft, ExternalLink, ShieldCheck, Share2, QrCode, File as FileIconLucide } from 'lucide-react';
import { client, extractData, isApiError, BASE_URL } from '@/lib/api.ts';
import { cn } from '@/lib/utils.ts';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigationStore } from '@/stores/navigation.ts';
import { useThemeStore } from '@fileuni/shared';

import type { components } from '@/types/api.ts';

type ShareInfo = components["schemas"]["PublicShareInfo"];
type ShareInfoWithMetrics = ShareInfo & { view_count?: number | null };

interface ShareEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const PublicShareView = ({ token: propToken }: { token?: string }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { params, navigate } = useNavigationStore();
  const token = propToken || params.token || params.id || '';
  
  const [loading, setLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState<ShareInfoWithMetrics | null>(null);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const currentPath = params.sub_path || '/';
  const [contents, setContents] = useState<ShareEntry[]>([]);
  const [listLoading, setContentLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const fetchShare = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await extractData<ShareInfoWithMetrics>(client.GET('/api/v1/file/public/share/{id}', {
        params: { 
          path: { id: token },
          query: { password: password || undefined }
        }
      }));

      if (!data.is_public && !password) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      
      setShareInfo(data);
      setPasswordRequired(false);
      if (data.is_dir) {
        fetchContents(currentPath);
      }
    } catch (e: unknown) {
      if (isApiError(e)) {
        if (e.msg?.includes('PASSWORD_REQUIRED')) {
          setPasswordRequired(true);
        } else if (e.msg?.includes('expired') || e.msg?.includes('EXPIRED')) {
          setErrorMessage(t('filemanager.publicShare.linkExpired'));
        } else {
          setErrorMessage(e.msg);
        }
      } else {
        setErrorMessage(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchContents = async (path: string) => {
    if (!token) return;
    setContentLoading(true);
    try {
      const data = await extractData<ShareEntry[]>(client.GET('/api/v1/file/public/share/{id}/list', {
        params: {
          path: { id: token },
          query: { 
            password: password || undefined,
            path: path
          }
        }
      }));

      setContents(data);
      
      // Sync sub_path via navigate; set to undefined for root to avoid redundant params
      if (path !== currentPath) {
        navigate({ sub_path: path === '/' ? undefined : path });
      }
      setPasswordRequired(false);
    } catch (e: unknown) {
      if (isApiError(e) && e.msg?.includes('PASSWORD_REQUIRED')) {
        setPasswordRequired(true);
        setShareInfo(null);
      }
      console.error("Failed to load folder contents:", e);
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => { 
    if (token) fetchShare(); 
  }, [token]);

  // Reload directory when sub_path changes
  useEffect(() => {
    if (shareInfo?.is_dir && token) {
      fetchContents(currentPath);
    }
  }, [currentPath, shareInfo?.is_dir]);

  const downloadItem = (path: string = '/') => {
    const backendUrl = BASE_URL || window.location.origin;
    const downloadUrl = `${backendUrl}/api/v1/file/public/direct/${token}${path.startsWith('/') ? path : '/' + path}${password ? `?password=${password}` : ''}`;
    window.open(downloadUrl, '_blank');
  };

  const handleBack = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    navigate({ sub_path: parentPath === '/' ? undefined : parentPath });
  };

  // Generate correct QR code URL with hash routing
  const getQrUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    let url = `${baseUrl}#mod=file-manager&page=share&token=${token}`;
    if (currentPath && currentPath !== '/') {
      url += `&sub_path=${encodeURIComponent(currentPath)}`;
    }
    return url;
  };

  if (!mounted || loading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse opacity-50 uppercase tracking-widest text-primary">{t('filemanager.publicShare.verifying')}</div>;

  if (errorMessage) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", isDark ? "bg-[#09090b]" : "bg-gray-50")}>
        <div className={cn(
          "w-full max-w-md border rounded-[2.5rem] p-10 shadow-2xl text-center",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-8 shadow-inner border border-red-500/20">
            <ShieldAlert size={40} />
          </div>
          <h1 className={cn("text-3xl font-black mb-2 italic uppercase", isDark ? "text-white" : "text-gray-900")}>{t('filemanager.publicShare.accessDenied')}</h1>
          <p className="text-sm opacity-50 font-bold mb-8 uppercase tracking-[0.2em]">{errorMessage}</p>
          <Button variant="outline" className="w-full h-16 text-lg uppercase font-black rounded-2xl" onClick={() => fetchShare()}>{t('filemanager.publicShare.tryAgain')}</Button>
        </div>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", isDark ? "bg-[#09090b]" : "bg-gray-50")}>
        <div className={cn(
          "w-full max-w-md border rounded-[2.5rem] p-10 shadow-2xl text-center",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="w-20 h-20 rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-8 shadow-inner border border-orange-500/20">
            <Lock size={40} />
          </div>
          <h1 className={cn("text-3xl font-black mb-2 uppercase", isDark ? "text-white" : "text-gray-900")}>{t('filemanager.publicShare.encryptedTitle')}</h1>
          <p className="text-sm opacity-50 font-bold mb-8">{t('filemanager.publicShare.passwordRequiredDesc')}</p>
          <div className="space-y-4">
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              onKeyUp={e => e.key === 'Enter' && fetchShare()}
              placeholder={t('filemanager.publicShare.enterPassword')} 
              className={cn("h-16 text-center text-xl tracking-widest font-black rounded-2xl", isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")} 
            />
            <Button className="w-full h-16 text-lg font-black uppercase rounded-2xl" onClick={fetchShare}>{t('filemanager.publicShare.unlockBtn')}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!shareInfo) return null;

  const isBaseDir = shareInfo.is_dir;

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 md:p-10 relative overflow-x-hidden pt-20", isDark ? "bg-[#09090b]" : "bg-gray-50")}>
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/20 blur-[140px]" />
      </div>

      <div className={cn(
        "w-full max-w-4xl border rounded-[3rem] shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col md:flex-row overflow-hidden min-h-[600px]",
        isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-gray-200"
      )}>
        
        {/* Left Side: Meta Info */}
        <div className={cn(
          "w-full md:w-80 p-8 md:p-10 border-b md:border-b-0 md:border-r flex flex-col items-center text-center shrink-0 relative",
          isDark ? "bg-white/[0.02] border-white/10" : "bg-gray-50/50 border-gray-100"
        )}>
          {/* QR Toggle Button */}
          <button 
            onClick={() => setShowQr(!showQr)}
            className={cn(
              "absolute top-6 right-6 p-2 rounded-xl transition-all z-20",
              showQr ? "bg-primary text-white" : cn("opacity-40 hover:opacity-100", isDark ? "bg-white/5" : "bg-gray-200")
            )}
            title={t('filemanager.shareModal.showQrCode')}
          >
            <QrCode size={18} />
          </button>

          {showQr ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300 w-full py-10">
              <div className="p-4 bg-white rounded-[2rem] shadow-2xl">
                <QRCodeSVG value={getQrUrl()} size={160} level="M" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-primary">{t('filemanager.publicShare.qrMobileAccess')}</p>
                <p className="text-[14px] font-bold opacity-40 uppercase tracking-widest px-4">{t('filemanager.publicShare.qrScanDesc')}</p>
              </div>
              <Button variant="ghost" className="text-sm font-black uppercase opacity-40" onClick={() => setShowQr(false)}>{t('filemanager.publicShare.qrBackToInfo')}</Button>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 text-primary flex items-center justify-center shadow-inner border border-primary/20 mb-8 transform hover:rotate-12 transition-transform duration-500">
                <FileIcon name={shareInfo.file_name} isDir={shareInfo.is_dir} size={48} />
              </div>
              
              <div className="space-y-3 mb-10 w-full">
                <h1 className={cn("text-2xl font-black break-all leading-tight", isDark ? "text-white" : "text-gray-900")}>{shareInfo.file_name}</h1>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[14px] font-black uppercase tracking-widest opacity-40">
                  <span className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full border", isDark ? "bg-white/5 border-white/5" : "bg-gray-100 border-gray-200")}><Calendar size={10} /> {new Date(shareInfo.created_at).toLocaleDateString()}</span>
                  {shareInfo.expire_at && <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20"><Clock size={10} /> Expiring</span>}
                </div>
              </div>

              <div className="w-full grid grid-cols-1 gap-3 mb-10">
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                  isDark ? "bg-white/[0.03] border-white/5 hover:bg-white/5" : "bg-white border-gray-100 hover:bg-gray-50"
                )}>
                  <span className="text-[14px] font-black uppercase opacity-30 tracking-widest">{t('filemanager.publicShare.views')}</span>
                  <span className="text-lg font-black text-primary group-hover:scale-110 transition-transform">{shareInfo.view_count ?? 0}</span>
                </div>
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between",
                  isDark ? "bg-white/[0.03] border-white/5" : "bg-white border-gray-100"
                )}>
                  <span className="text-[14px] font-black uppercase opacity-30 tracking-widest">{t('filemanager.publicShare.status')}</span>
                  <span className="text-sm font-black text-green-500 uppercase flex items-center gap-1.5"><ShieldCheck size={18} /> {t('filemanager.publicShare.active')}</span>
                </div>
              </div>

              {!isBaseDir && (
                <div className="w-full mt-auto">
                  <Button className="w-full h-16 text-lg font-black uppercase rounded-2xl shadow-lg shadow-primary/20 group" onClick={() => downloadItem('/')}>
                    <Download size={24} className="mr-3 group-hover:animate-bounce" /> {t('filemanager.publicShare.downloadNow')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Side: Content Area (Directory Explorer) */}
        <div className={cn("flex-1 flex flex-col min-w-0", isDark ? "bg-black/20" : "bg-gray-50/30")}>
          {isBaseDir ? (
            <>
              <div className={cn("px-8 py-6 border-b flex items-center justify-between", isDark ? "border-white/10 bg-white/[0.01]" : "border-gray-100 bg-gray-50/50")}>
                <div className="flex items-center gap-3 min-w-0">
                  {currentPath !== '/' && (
                    <button onClick={handleBack} className={cn("p-2 rounded-xl transition-colors shrink-0", isDark ? "bg-white/5 hover:bg-white/10" : "bg-white border border-gray-200 hover:bg-gray-100")}>
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest opacity-40 truncate">
                    <Share2 size={18} className="text-primary shrink-0" />
                    <span className={cn("truncate", isDark ? "text-white" : "text-gray-900")}>Root{currentPath !== '/' && currentPath}</span>
                  </div>
                </div>
                {listLoading && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="space-y-1">
                  {contents.map((item) => (
                    <div 
                      key={item.path}
                      onClick={() => item.is_dir ? navigate({ sub_path: item.path }) : null}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border border-transparent transition-all group",
                        item.is_dir ? "cursor-pointer hover:bg-white/5 hover:border-white/5" : "hover:bg-white/[0.02]",
                        !isDark && item.is_dir && "hover:bg-gray-100 hover:border-gray-200",
                        !isDark && !item.is_dir && "hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                          item.is_dir ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                          <FileIcon name={item.name} isDir={item.is_dir} size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-bold truncate", isDark ? "text-white/90" : "text-gray-900")}>{item.name}</p>
                          <div className="flex items-center gap-3 text-[14px] font-black uppercase tracking-widest opacity-30">
                            {!item.is_dir && <span>{formatSize(item.size)}</span>}
                            <span>{new Date(item.modified).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.is_dir ? (
                          <ChevronRight size={18} className="opacity-30" />
                        ) : (
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg hover:bg-primary/20 hover:text-primary" onClick={() => downloadItem(item.path)}>
                            <Download size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {!listLoading && contents.length === 0 && (
                    <div className="h-64 flex flex-col items-center justify-center opacity-20">
                      <FileIconLucide size={48} className="mb-4" />
                      <p className="font-black uppercase text-sm tracking-widest">{t('filemanager.publicShare.emptyFolder')}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
               <div className="max-w-md space-y-6">
                  <div className={cn("p-6 rounded-[2rem] border space-y-4", isDark ? "bg-white/[0.02] border-white/5" : "bg-white border-gray-100 shadow-sm")}>
                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-30">{t('filemanager.publicShare.previewNotAvailable')}</p>
                    <p className={cn("text-sm font-medium opacity-50 leading-relaxed", !isDark && "text-gray-900")}>
                      You are viewing a direct share of a file. Click the button on the left to download the content directly to your device.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className={cn("h-px flex-1", isDark ? "bg-white/5" : "bg-gray-100")} />
                    <ExternalLink size={16} className="opacity-10" />
                    <div className={cn("h-px flex-1", isDark ? "bg-white/5" : "bg-gray-100")} />
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
