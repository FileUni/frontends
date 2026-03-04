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
      <div className="p-10 bg-white/[0.03] rounded-[3rem] border border-white/10 shadow-2xl space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
              <Activity size={40} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <h4 className="text-4xl font-black tracking-tight uppercase leading-none">{t('admin.extensions.operationSection')}</h4>
                <Badge variant={props.installed ? 'success' : 'outline'} className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
                  {props.installed ? t('admin.extensions.status.installed') : t('admin.extensions.status.notInstalled')}
                </Badge>
                {props.installed && showServiceActions && (
                  <Badge variant={props.running ? 'success' : 'secondary'} className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
                    {props.running ? t('admin.extensions.running') : t('admin.extensions.stopped')}
                  </Badge>
                )}
              </div>
              {props.installDir && (
                <p className="text-base font-mono opacity-60 flex items-center gap-2.5 uppercase font-bold tracking-tight">
                  <Terminal size={18} /> {props.installDir}/{props.binPathConfig}
                </p>
              )}
              <p className="text-base opacity-50 font-bold uppercase tracking-[0.2em]">{props.tool === 'openlist' ? 'OpenList' : props.tool} {t('admin.extensions.management')}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {props.pid && <Badge variant="outline" className="font-mono text-sm opacity-70 px-5 py-2 rounded-2xl bg-white/5 border-white/10">{t('admin.extensions.pidLabel')}: {props.pid}</Badge>}
            <a
              href={props.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="w-16 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/70 hover:text-white"
              title={t('admin.extensions.homepage')}
            >
              <ExternalLink size={28} />
            </a>
            <Button 
              variant="primary" 
              className={`h-16 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-base gap-4 shadow-2xl transition-all active:scale-95 ${highlightInstall ? 'animate-bounce ring-8 ring-primary/30' : 'shadow-primary/20'}`}
              onClick={() => setInstallModalOpen(true)}
            >
              <Settings size={24} />
              {t('admin.extensions.configSection')}
            </Button>
          </div>
        </div>

        {!props.installed ? (
          <div className="py-24 px-10 text-center border-2 border-dashed border-white/10 rounded-[3rem] bg-white/[0.01] group hover:bg-white/[0.02] transition-all cursor-pointer" onClick={triggerInstallHint}>
            <Terminal size={80} className="mx-auto mb-10 opacity-10 group-hover:opacity-20 transition-opacity" />
            <p className="text-2xl font-bold opacity-40">{t('admin.extensions.installFirstHint')}</p>
            <p className="text-base opacity-20 mt-4 uppercase tracking-[0.2em] font-black">{t('admin.extensions.clickSettingsToInstall')}</p>
          </div>
        ) : (
          <div className="space-y-16">
            {showServiceActions && (
              <div className="space-y-8">
                <label className="text-base font-black uppercase opacity-50 ml-2 tracking-[0.2em]">{t('admin.extensions.serviceControl')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
                  <Button 
                    variant={props.running ? 'ghost' : 'primary'} 
                    className="h-28 rounded-[2.5rem] font-black uppercase tracking-widest text-lg gap-4 shadow-2xl transition-all active:scale-95"
                    onClick={props.onStartService}
                    disabled={props.running || props.loading}
                  >
                    <Play size={28} fill="currentColor" />
                    {t('admin.extensions.serviceStart')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-28 rounded-[2.5rem] font-black uppercase tracking-widest text-lg gap-4 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95"
                    onClick={props.onStopService}
                    disabled={!props.running || props.loading}
                  >
                    <Square size={28} fill="currentColor" />
                    {t('admin.extensions.serviceStop')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="h-28 rounded-[2.5rem] font-black uppercase tracking-widest text-lg gap-4 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                    onClick={props.onRestart}
                    disabled={props.loading}
                  >
                    <RefreshCw size={28} className={props.loading ? 'animate-spin' : ''} />
                    {t('admin.extensions.serviceRestart')}
                  </Button>
                  {props.onDelete && (
                    <Button 
                      variant="ghost" 
                      className="h-28 rounded-[2.5rem] font-black uppercase tracking-widest text-lg gap-4 bg-red-500/5 border border-red-500/10 hover:bg-red-500/20 hover:text-red-400 transition-all active:scale-95"
                      onClick={props.onDelete}
                      disabled={props.loading || props.running || !props.installed}
                    >
                      <Trash2 size={28} />
                      {t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {props.extraActions && props.extraActions.length > 0 && (
              <div className="space-y-8">
                <label className="text-base font-black uppercase opacity-50 ml-2 tracking-[0.2em]">{t('admin.extensions.toolActions')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {props.extraActions.map((action, idx) => (
                    <Button 
                      key={idx} 
                      variant={action.variant === 'primary' ? 'primary' : 'ghost'} 
                      className={`h-28 rounded-[2.5rem] font-black uppercase tracking-widest text-lg gap-4 shadow-xl transition-all active:scale-95 ${action.variant !== 'primary' ? 'bg-white/5 border border-white/10 hover:bg-white/10' : ''}`}
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
              <div className="p-12 bg-white/[0.02] rounded-[3rem] border border-white/5 text-2xl opacity-60 leading-relaxed font-medium">
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
        <div className="p-12 space-y-12">
          <div className="flex items-center justify-between bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-3xl bg-primary/20 text-primary flex items-center justify-center">
                <Settings size={36} />
              </div>
              <div>
                <h4 className="font-bold text-2xl leading-tight">{t('admin.extensions.fetchLatestTitle')}</h4>
                <p className="text-sm opacity-60 font-medium uppercase tracking-wider mt-2">{t('admin.extensions.fetchLatestHint')}</p>
              </div>
            </div>
            {props.onFetchLatest && (
              <Button 
                size="lg" 
                variant="primary" 
                className="rounded-[1.5rem] h-16 px-10 font-black uppercase tracking-widest text-sm gap-4 shadow-2xl shadow-primary/20"
                onClick={props.onFetchLatest}
                disabled={props.loading}
              >
                <RefreshCw size={24} className={props.loading ? 'animate-spin' : ''} />
                {t('admin.extensions.fetchLatestBtn')}
              </Button>
            )}
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-4 gap-6">
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-3 overflow-hidden">
                <label className="text-sm font-black uppercase opacity-50 tracking-widest">{t('admin.extensions.installDir')}</label>
                <div className="text-xl font-mono font-bold opacity-80 truncate" title={props.installDir}>{props.installDir || '--'}</div>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-3 overflow-hidden">
                <label className="text-sm font-black uppercase opacity-50 tracking-widest">{t('admin.extensions.binPath')}</label>
                <div className="text-xl font-mono font-bold text-primary truncate" title={props.binPath}>{props.binPath || '--'}</div>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-3 overflow-hidden">
                <label className="text-sm font-black uppercase opacity-50 tracking-widest">{t('admin.extensions.version')}</label>
                <div className="text-xl font-mono font-bold text-primary truncate" title={props.version}>{props.version || '--'}</div>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-3 overflow-hidden flex flex-col justify-center">
                <label className="text-sm font-black uppercase opacity-50 tracking-widest">{t('admin.extensions.followStart')}</label>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant={props.followStart ? 'success' : 'secondary'} className="rounded-xl px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
                    {props.followStart ? t('common.enabled') : t('common.disabled')}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-base font-black uppercase opacity-50 ml-2 tracking-widest">{t('admin.extensions.githubProxy')}</label>
              <Input value={props.proxy} onChange={(e) => props.setProxy(e.target.value)} placeholder={t('admin.extensions.githubMirrorPlaceholder')} className="h-16 rounded-[1.5rem] bg-white/5 border border-white/10 text-lg px-8 font-medium" />
            </div>

            <div className="space-y-3">
              <label className="text-base font-black uppercase opacity-50 ml-2 tracking-widest">{t('admin.extensions.customDownloadUrl')}</label>
              <Input value={props.downloadUrl} onChange={(e) => props.setDownloadUrl(e.target.value)} className="h-16 rounded-[1.5rem] bg-white/5 border border-white/10 text-lg px-8 font-medium" />
            </div>

            {props.extraFields && props.extraFields.length > 0 && (
              <div className="pt-10 space-y-10 border-t border-white/10">
                {props.extraFields.map((field, idx) => (
                  <div key={idx} className="space-y-4">
                    <label className="text-base font-black uppercase opacity-50 ml-2 tracking-widest">{field.label}</label>
                    {field.isTextArea ? (
                      <textarea
                        className="w-full min-h-[200px] rounded-[2.5rem] border border-white/10 bg-white/5 p-8 text-lg font-mono focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all leading-relaxed"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={field.placeholder} className="h-16 rounded-[1.5rem] bg-white/5 border border-white/10 text-lg px-8" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-6 pt-6">
            <Button 
              className="flex-1 h-20 rounded-[1.5rem] font-black uppercase tracking-widest text-base shadow-2xl shadow-primary/20 gap-5 transition-all active:scale-95"
              variant="primary"
              onClick={props.onDownload}
              disabled={props.loading}
            >
              {props.loading ? <RefreshCw size={32} className="animate-spin" /> : <Download size={32} />}
              {props.installed ? t('admin.extensions.updateBtn') : t('admin.extensions.installBtn')}
            </Button>
            <Button 
              variant="outline" 
              className="h-20 px-12 rounded-[1.5rem] font-black uppercase tracking-widest text-base border-white/10 bg-white/5 hover:bg-white/10 transition-all"
              onClick={() => setInstallModalOpen(false)}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle} maxWidth="max-w-5xl">
        <div className="p-12 space-y-10">
          <div className="p-10 bg-black/40 rounded-[3rem] border border-white/10 font-mono text-base overflow-auto max-h-[70vh] leading-relaxed shadow-inner">
            <pre className="whitespace-pre-wrap break-all opacity-80">{modalContent}</pre>
          </div>
          <div className="flex justify-end">
            <Button 
              className="rounded-[1.5rem] px-16 h-16 font-black uppercase tracking-widest text-sm"
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
