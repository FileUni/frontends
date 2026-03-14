import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge.tsx';
import { Download, Play, Square, RefreshCw, ExternalLink, Settings, Terminal, Activity, Trash2 } from 'lucide-react';
import type { ToolKind } from './types.ts';

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return error instanceof Error ? error.message : String(error);
};

export type ToolProps = {
  tool: string;
  kind: ToolKind;
  installed: boolean;
  executablePath?: string;
  installDir?: string;
  binPathConfig?: string;
  homepage: string;
  description: string;
  followStart?: boolean;
  running?: boolean;
  pid?: number | null;
  
  // Install fields
  version: string;
  setVersion: (v: string) => void;
  binPath: string;
  setBinPath: (v: string) => void;
  proxy: string;
  setProxy: (v: string) => void;
  downloadUrl: string;
  setDownloadUrl: (v: string) => void;
  
  // Extra fields
  extraFields?: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    isTextArea?: boolean;
  }[];

  onDownload: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onFetchLatest?: () => Promise<void>;
  
  // Standard actions
  onStartService?: () => Promise<void>;
  onStopService?: () => Promise<void>;
  onRestart?: () => Promise<void>;
  loading?: boolean;

  // Extra actions
  extraActions?: {
    label: string;
    onClick: () => Promise<string | void> | void;
    variant?: 'outline' | 'primary' | 'ghost' | 'destructive';
    showOutputInModal?: boolean;
  }[];
};

export const ToolPanel = (props: ToolProps) => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [highlightInstall, setHighlightInstall] = useState(false);

  const execDisplayPath = (() => {
    if (props.executablePath) return props.executablePath;
    const binPath = props.binPathConfig;
    const installDir = props.installDir;
    if (!binPath && !installDir) return '';
    if (!binPath) return installDir || '';

    // Absolute path (Unix/Windows) should not be prefixed.
    const isAbs =
      binPath.startsWith('/') ||
      /^\\\\/.test(binPath) ||
      /^[a-zA-Z]:[\\/]/.test(binPath);
    if (isAbs) return binPath;

    if (!installDir) return binPath;
    return `${installDir.replace(/\/+$/, '')}/${binPath.replace(/^\/+/, '')}`;
  })();

  const handleExtraAction = async (action: NonNullable<ToolProps['extraActions']>[number]) => {
    try {
      const result = await action.onClick();
      if (action.showOutputInModal && typeof result === 'string') {
        setModalTitle(action.label);
        setModalContent(result);
        setModalOpen(true);
      }
    } catch (error: unknown) {
      if (action.showOutputInModal) {
        setModalTitle(`${action.label} - Error`);
        setModalContent(getErrorMessage(error));
        setModalOpen(true);
      }
    }
  };

  const triggerInstallHint = () => {
    setHighlightInstall(true);
    setTimeout(() => setHighlightInstall(false), 2000);
  };

  const showServiceActions = props.kind === 'service' || props.kind === 'both';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Operations Panel */}
      <div className="p-4 sm:p-6 md:p-10 bg-white/[0.03] rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-2xl space-y-6 md:space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
            <div className="w-14 h-14 sm:w-16 md:w-20 sm:h-16 md:h-20 rounded-2xl sm:rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner shrink-0">
              <Activity size={24} className="sm:w-8 sm:h-8 md:w-10 md:h-10" />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <h4 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight uppercase leading-tight">{t('admin.extensions.operationSection')}</h4>
                <Badge variant={props.installed ? 'success' : 'outline'} className="rounded-full px-3 sm:px-4 py-1 text-xs sm:text-sm font-bold uppercase tracking-widest">
                  {props.installed ? t('admin.extensions.status.installed') : t('admin.extensions.status.notInstalled')}
                </Badge>
                {props.installed && showServiceActions && (
                  <Badge variant={props.running ? 'success' : 'secondary'} className="rounded-full px-3 sm:px-4 py-1 text-xs sm:text-sm font-bold uppercase tracking-widest">
                    {props.running ? t('admin.extensions.running') : t('admin.extensions.stopped')}
                  </Badge>
                )}
              </div>
              {execDisplayPath && (
                <p className="text-xs sm:text-sm md:text-base font-mono opacity-60 flex items-center gap-2 uppercase font-bold tracking-tight break-all">
                  <Terminal size={14} className="shrink-0" /> {execDisplayPath}
                </p>
              )}
              <p className="text-xs sm:text-sm md:text-base opacity-50 font-bold uppercase tracking-wider sm:tracking-[0.2em]">{props.tool === 'openlist' ? 'OpenList' : props.tool} {t('admin.extensions.management')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 w-full md:w-auto justify-end">
            {props.pid && <Badge variant="outline" className="font-mono text-xs sm:text-sm opacity-70 px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-white/5 border-white/10 whitespace-nowrap">{t('admin.extensions.pidLabel')}: {props.pid}</Badge>}
            <a
              href={props.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 sm:w-12 md:w-16 sm:h-12 md:h-16 rounded-xl sm:rounded-[1.25rem] md:rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/70 hover:text-white shrink-0"
              title={t('admin.extensions.homepage')}
            >
              <ExternalLink size={18} className="sm:w-5 sm:h-5 md:w-7 md:h-7" />
            </a>
            <Button 
              variant="primary" 
              className={`h-10 sm:h-12 md:h-16 px-4 sm:px-6 md:px-10 rounded-xl sm:rounded-[1.25rem] md:rounded-[1.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-base gap-2 sm:gap-3 md:gap-4 shadow-xl md:shadow-2xl transition-all active:scale-95 whitespace-nowrap ${highlightInstall ? 'animate-bounce ring-4 md:ring-8 ring-primary/30' : 'shadow-primary/20'}`}
              onClick={() => setInstallModalOpen(true)}
            >
              <Settings size={16} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
              {t('admin.extensions.configSection')}
            </Button>
          </div>
        </div>

        {!props.installed ? (
          <div className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 md:px-10 text-center border-2 border-dashed border-white/10 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] bg-white/[0.01] group hover:bg-white/[0.02] transition-all cursor-pointer" onClick={triggerInstallHint}>
            <Terminal size={40} className="sm:w-12 sm:h-12 md:w-20 md:h-20 mx-auto mb-4 sm:mb-6 md:mb-10 opacity-10 group-hover:opacity-20 transition-opacity" />
            <p className="text-lg sm:text-xl md:text-2xl font-bold opacity-40">{t('admin.extensions.installFirstHint')}</p>
            <p className="text-xs sm:text-sm md:text-base opacity-20 mt-2 sm:mt-3 md:mt-4 uppercase tracking-wider sm:tracking-[0.2em] font-black">{t('admin.extensions.clickSettingsToInstall')}</p>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-12 md:space-y-16">
            {showServiceActions && (
              <div className="space-y-4 sm:space-y-6 md:space-y-8">
                <label className="text-xs sm:text-sm md:text-base font-black uppercase opacity-50 ml-2 tracking-wider sm:tracking-[0.2em]">{t('admin.extensions.serviceControl')}</label>
                <div className="grid grid-cols-1 min-[450px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 md:gap-8">
                  <Button 
                    variant={props.running ? 'ghost' : 'primary'} 
                    className="h-14 sm:h-16 md:h-24 lg:h-28 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-lg gap-2 sm:gap-3 md:gap-4 shadow-lg md:shadow-2xl transition-all active:scale-95 whitespace-nowrap"
                    onClick={props.onStartService}
                    disabled={props.running || props.loading}
                  >
                    <Play size={16} className="sm:w-5 sm:h-5 md:w-7 md:h-7" fill="currentColor" />
                    {t('admin.extensions.serviceStart')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-14 sm:h-16 md:h-24 lg:h-28 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-lg gap-2 sm:gap-3 md:gap-4 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 whitespace-nowrap"
                    onClick={props.onStopService}
                    disabled={!props.running || props.loading}
                  >
                    <Square size={16} className="sm:w-5 sm:h-5 md:w-7 md:h-7" fill="currentColor" />
                    {t('admin.extensions.serviceStop')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-14 sm:h-16 md:h-24 lg:h-28 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-lg gap-2 sm:gap-3 md:gap-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
                    onClick={props.onRestart}
                    disabled={props.loading}
                  >
                    <RefreshCw size={16} className={`sm:w-5 sm:h-5 md:w-7 md:h-7 ${props.loading ? 'animate-spin' : ''}`} />
                    {t('admin.extensions.serviceRestart')}
                  </Button>
                  {props.onDelete && (
                    <Button 
                      variant="ghost" 
                      className="h-14 sm:h-16 md:h-24 lg:h-28 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-lg gap-2 sm:gap-3 md:gap-4 bg-red-500/5 border border-red-500/10 hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-95 whitespace-nowrap col-span-1 min-[450px]:col-span-2 sm:col-span-1"
                      onClick={props.onDelete}
                      disabled={props.loading || props.running || !props.installed}
                    >
                      <Trash2 size={16} className="sm:w-5 sm:h-5 md:w-7 md:h-7" />
                      {t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {props.extraActions && props.extraActions.length > 0 && (
              <div className="space-y-4 sm:space-y-6 md:space-y-8">
                <label className="text-xs sm:text-sm md:text-base font-black uppercase opacity-50 ml-2 tracking-wider sm:tracking-[0.2em]">{t('admin.extensions.toolActions')}</label>
                <div className="grid grid-cols-1 min-[450px]:grid-cols-2 gap-3 sm:gap-4 md:gap-8">
                  {props.extraActions.map((action, idx) => (
                    <Button 
                      key={idx} 
                      variant={action.variant === 'primary' ? 'primary' : 'ghost'} 
                      className={`h-14 sm:h-16 md:h-24 lg:h-28 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] font-black uppercase tracking-widest text-xs sm:text-sm md:text-lg gap-2 sm:gap-3 md:gap-4 shadow-lg md:shadow-xl transition-all active:scale-95 whitespace-nowrap ${action.variant !== 'primary' ? 'bg-white/5 border border-white/10 hover:bg-white/10' : ''}`}
                      onClick={() => handleExtraAction(action)}
                      disabled={props.loading}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {props.kind === 'task' && (!props.extraActions || props.extraActions.length === 0) && (
              <div className="p-4 sm:p-6 md:p-12 bg-white/[0.02] rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] border border-white/5 text-base sm:text-lg md:text-2xl opacity-60 leading-relaxed font-medium">
                {t('admin.extensions.taskKindHint')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration & Installation Modal */}
      <Modal 
        isOpen={installModalOpen} 
        onClose={() => setInstallModalOpen(false)} 
        title={`${t('admin.extensions.configSection')} - ${props.tool.charAt(0).toUpperCase() + props.tool.slice(1)}`}
        maxWidth="max-w-5xl"
      >
        <div className="p-4 sm:p-6 md:p-12 space-y-6 sm:space-y-8 md:space-y-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-primary/5 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] border border-primary/10 gap-4 sm:gap-0">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-14 md:w-16 sm:h-14 md:h-16 rounded-2xl sm:rounded-3xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Settings size={24} className="sm:w-7 sm:h-7 md:w-9 md:h-9" />
              </div>
              <div>
                <h4 className="font-bold text-lg sm:text-xl md:text-2xl leading-tight">{t('admin.extensions.fetchLatestTitle')}</h4>
                <p className="text-xs sm:text-sm opacity-60 font-medium uppercase tracking-wider mt-1 sm:mt-2">{t('admin.extensions.fetchLatestHint')}</p>
              </div>
            </div>
            {props.onFetchLatest && (
              <Button 
                size="lg" 
                variant="primary" 
                className="rounded-xl sm:rounded-[1.25rem] md:rounded-[1.5rem] h-10 sm:h-12 md:h-16 px-6 sm:px-8 md:px-10 font-black uppercase tracking-widest text-xs sm:text-sm gap-2 sm:gap-3 md:gap-4 shadow-lg md:shadow-2xl shadow-primary/20 w-full sm:w-auto"
                onClick={props.onFetchLatest}
                disabled={props.loading}
              >
                <RefreshCw size={18} className={`sm:w-5 sm:h-5 md:w-6 md:h-6 ${props.loading ? 'animate-spin' : ''}`} />
                {t('admin.extensions.fetchLatestBtn')}
              </Button>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 min-[450px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              <div className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 space-y-2 sm:space-y-3 overflow-hidden">
                <label className="text-xs sm:text-sm font-black uppercase opacity-50 tracking-wider sm:tracking-widest">{t('admin.extensions.installDir')}</label>
                <div className="text-sm sm:text-base md:text-xl font-mono font-bold opacity-80 truncate" title={props.installDir}>{props.installDir || '--'}</div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 space-y-2 sm:space-y-3 overflow-hidden">
                <label className="text-xs sm:text-sm font-black uppercase opacity-50 tracking-wider sm:tracking-widest">{t('admin.extensions.binPath')}</label>
                <div className="text-sm sm:text-base md:text-xl font-mono font-bold text-primary truncate" title={props.binPath}>{props.binPath || '--'}</div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 space-y-2 sm:space-y-3 overflow-hidden">
                <label className="text-xs sm:text-sm font-black uppercase opacity-50 tracking-wider sm:tracking-widest">{t('admin.extensions.version')}</label>
                <div className="text-sm sm:text-base md:text-xl font-mono font-bold text-primary truncate" title={props.version}>{props.version || '--'}</div>
              </div>
              <div className="p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-[1.5rem] md:rounded-[2rem] bg-white/5 border border-white/10 space-y-2 sm:space-y-3 overflow-hidden flex flex-col justify-center">
                <label className="text-xs sm:text-sm font-black uppercase opacity-50 tracking-wider sm:tracking-widest">{t('admin.extensions.followStart')}</label>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                  <Badge variant={props.followStart ? 'success' : 'secondary'} className="rounded-lg sm:rounded-xl px-3 sm:px-4 py-1 text-xs sm:text-sm font-bold uppercase tracking-widest whitespace-nowrap">
                    {props.followStart ? t('common.enabled') : t('common.disabled')}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-xs sm:text-sm md:text-base font-black uppercase opacity-50 ml-2 tracking-wider sm:tracking-widest">{t('admin.extensions.githubProxy')}</label>
              <Input value={props.proxy} onChange={(e) => props.setProxy(e.target.value)} placeholder={t('admin.extensions.githubMirrorPlaceholder')} className="h-10 sm:h-12 md:h-16 rounded-lg sm:rounded-xl md:rounded-[1.5rem] bg-white/5 border border-white/10 text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 font-medium" />
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="text-xs sm:text-sm md:text-base font-black uppercase opacity-50 ml-2 tracking-wider sm:tracking-widest">{t('admin.extensions.customDownloadUrl')}</label>
              <Input value={props.downloadUrl} onChange={(e) => props.setDownloadUrl(e.target.value)} className="h-10 sm:h-12 md:h-16 rounded-lg sm:rounded-xl md:rounded-[1.5rem] bg-white/5 border border-white/10 text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8 font-medium" />
            </div>

            {props.extraFields && props.extraFields.length > 0 && (
              <div className="pt-6 sm:pt-8 md:pt-10 space-y-6 sm:space-y-8 md:space-y-10 border-t border-white/10">
                {props.extraFields.map((field, idx) => (
                  <div key={idx} className="space-y-2 sm:space-y-4">
                    <label className="text-xs sm:text-sm md:text-base font-black uppercase opacity-50 ml-2 tracking-wider sm:tracking-widest">{field.label}</label>
                    {field.isTextArea ? (
                      <textarea
                        className="w-full min-h-[120px] sm:min-h-[160px] md:min-h-[200px] rounded-xl sm:rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 bg-white/5 p-4 sm:p-6 md:p-8 text-sm sm:text-base md:text-lg font-mono focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-primary/20 transition-all leading-relaxed"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={field.placeholder} className="h-10 sm:h-12 md:h-16 rounded-lg sm:rounded-xl md:rounded-[1.5rem] bg-white/5 border border-white/10 text-sm sm:text-base md:text-lg px-4 sm:px-6 md:px-8" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 pt-4 sm:pt-6">
            <Button 
              className="flex-1 h-12 sm:h-14 md:h-20 rounded-lg sm:rounded-xl md:rounded-[1.5rem] font-black uppercase tracking-widest text-sm sm:text-base shadow-lg md:shadow-2xl shadow-primary/20 gap-2 sm:gap-3 md:gap-5 transition-all active:scale-95"
              variant="primary"
              onClick={props.onDownload}
              disabled={props.loading}
            >
              {props.loading ? <RefreshCw size={20} className="sm:w-6 sm:h-6 md:w-8 md:h-8 animate-spin" /> : <Download size={20} className="sm:w-6 sm:h-6 md:w-8 md:h-8" />}
              {props.installed ? t('admin.extensions.updateBtn') : t('admin.extensions.installBtn')}
            </Button>
            <Button 
              variant="outline" 
              className="h-12 sm:h-14 md:h-20 px-6 sm:px-8 md:px-12 rounded-lg sm:rounded-xl md:rounded-[1.5rem] font-black uppercase tracking-widest text-sm sm:text-base border-white/10 bg-white/5 hover:bg-white/10 transition-all"
              onClick={() => setInstallModalOpen(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} maxWidth="max-w-5xl">
        <div className="p-4 sm:p-6 md:p-12 space-y-6 sm:space-y-8 md:space-y-10">
          <div className="p-4 sm:p-6 md:p-10 bg-black/40 rounded-xl sm:rounded-[1.5rem] md:rounded-[3rem] border border-white/10 font-mono text-xs sm:text-sm md:text-base overflow-auto max-h-[50vh] sm:max-h-[60vh] md:max-h-[70vh] leading-relaxed shadow-inner">
            <pre className="whitespace-pre-wrap break-all opacity-80">{modalContent}</pre>
          </div>
          <div className="flex justify-end">
            <Button 
              className="rounded-lg sm:rounded-xl md:rounded-[1.5rem] px-8 sm:px-12 md:px-16 h-10 sm:h-12 md:h-16 font-black uppercase tracking-widest text-xs sm:text-sm"
              onClick={() => setModalOpen(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
