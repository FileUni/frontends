import React, { useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Globe,
  Info,
  Loader2,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

const PROJECT_HOMEPAGE_URL = 'https://fileuni.com';
const PROJECT_DOCS_URL = 'https://docs.fileuni.com';
const PROJECT_REPOSITORY_URL = 'https://github.com/FileUni/FileUni-Project';

export interface AboutUpdateInfo {
  current_version: string;
  current_channel: string;
  has_update: boolean;
  stable?: AboutReleaseChannelInfo | null;
  prerelease?: AboutReleaseChannelInfo | null;
}

export interface AboutReleaseChannelInfo {
  channel: string;
  version: string;
  has_update: boolean;
  release_page_url: string;
  target_download_url?: string | null;
  published_at?: string | null;
}

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  showCheckUpdates?: boolean;
  isCheckingUpdates?: boolean;
  updateInfo?: AboutUpdateInfo | null;
  updateError?: string | null;
  onCheckUpdates?: () => void | Promise<void>;
  onOpenLink?: (url: string) => void;
  zIndex?: number;
}

// Modern vertical card link for better space utilization
const LinkCard: React.FC<{
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onOpenLink?: (url: string) => void;
}> = ({ href, label, icon: Icon, onOpenLink }) => {
  const className = cn(
    'group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/40 bg-secondary/20 p-4 transition-all duration-300',
    'hover:bg-secondary/40 hover:border-primary/20 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5'
  );

  const content = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/50 group-hover:scale-110 group-hover:ring-primary/20 transition-all duration-300">
        <Icon size={20} className="text-foreground/80 group-hover:text-primary transition-colors" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
        <ExternalLink size={10} className="opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0 transition-all" />
      </div>
    </>
  );

  if (onOpenLink) {
    return (
      <button type="button" onClick={() => onOpenLink(href)} className={className}>
        {content}
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
};

const ReleaseRow: React.FC<{
  info: AboutReleaseChannelInfo;
  title: string;
  onOpenLink?: (url: string) => void;
  t: any;
}> = ({ info, title, onOpenLink, t }) => {
  const downloadUrl = info.target_download_url || info.release_page_url;
  
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-secondary/10 p-4 transition-all hover:bg-secondary/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border",
              info.channel === 'prerelease' 
                ? "border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/5" 
                : "border-primary/30 text-primary bg-primary/5"
            )}>
              {title}
            </span>
            {info.has_update && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 animate-pulse">
                <Sparkles size={10} /> {t('about.state.updateAvailable')}
              </span>
            )}
          </div>
          <div className="font-mono text-sm font-bold text-foreground tracking-tight">{info.version}</div>
          {info.published_at && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
              <Calendar size={12} />
              {info.published_at}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-8 w-8 rounded-lg p-0 shadow-sm"
            onClick={() => onOpenLink ? onOpenLink(downloadUrl) : window.open(downloadUrl, '_blank')}
            title={t('about.downloadChannel')}
          >
            <Download size={14} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 rounded-lg p-0 bg-transparent"
            onClick={() => onOpenLink ? onOpenLink(info.release_page_url) : window.open(info.release_page_url, '_blank')}
            title={t('about.viewReleasePage')}
          >
            <ExternalLink size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  showCheckUpdates = false,
  isCheckingUpdates = false,
  updateInfo = null,
  updateError = null,
  onCheckUpdates,
  onOpenLink,
  zIndex = 130,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentVersionText = currentVersion || '—';
  const currentChannel = updateInfo?.current_channel || 'stable';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      style={{ zIndex }}
    >
      {/* Background Overlay: Maximum isolation */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl transition-opacity" onClick={onClose} />

      {/* Main Container: Solid Opaque Background */}
      <div className="relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modern Header: Solid, no transparency */}
        <div className="relative flex flex-col items-center px-6 pt-12 pb-8 text-center bg-background border-b border-border/50">
           <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground/50 hover:bg-secondary hover:text-foreground transition-all"
          >
            <X size={20} />
          </button>

          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 ring-4 ring-background">
            <Info size={32} className="text-primary-foreground" />
          </div>
          
          <h2 className="text-2xl font-black tracking-tight text-foreground">FileUni</h2>
          
          <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Version</span>
            <span className="text-xs font-mono font-bold text-foreground">{currentVersionText}</span>
          </div>

          <p className="mt-5 max-w-[320px] text-sm font-medium leading-relaxed text-muted-foreground/80">
            {t('about.subtitle')}
          </p>
        </div>

        <div className="flex-1 space-y-8 px-8 pb-8 bg-background pt-8">
          {/* Links Grid: Solid Cards */}
          <div className="grid grid-cols-3 gap-3">
            <LinkCard href={PROJECT_HOMEPAGE_URL} label={t('about.links.website')} icon={Globe} onOpenLink={onOpenLink} />
            <LinkCard href={PROJECT_DOCS_URL} label={t('about.links.docs')} icon={BookOpen} onOpenLink={onOpenLink} />
            <LinkCard href={PROJECT_REPOSITORY_URL} label="GitHub" icon={Github} onOpenLink={onOpenLink} />
          </div>

          {/* Update Section */}
          {showCheckUpdates && (
            <div className="space-y-4">
              <div className="h-px w-full bg-border/50" />
              
              {/* Header / Action Bar: Opaque */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary p-1.5 pl-4 shadow-sm">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Sparkles size={14} className="text-primary" />
                  {t('about.updateSectionTitle')}
                </div>
                {onCheckUpdates && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onCheckUpdates()}
                    disabled={isCheckingUpdates}
                    className="h-8 gap-2 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm border border-border/50"
                  >
                    {isCheckingUpdates ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                    {isCheckingUpdates ? t('about.checking') : t('about.checkUpdates')}
                  </Button>
                )}
              </div>

              {/* Status Display: Solid background */}
              {updateError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-center shadow-inner">
                  <div className="text-[10px] font-black text-destructive uppercase tracking-widest">{t('about.updateError')}</div>
                  <div className="mt-2 text-xs font-bold text-destructive/80">{updateError}</div>
                </div>
              ) : updateInfo ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className={cn(
                    'flex items-center justify-center gap-2.5 py-2 text-[11px] font-black uppercase tracking-[0.2em]',
                    updateInfo.has_update ? 'text-amber-500' : 'text-emerald-500'
                  )}>
                    {updateInfo.has_update ? <Download size={16} className="animate-bounce" /> : <CheckCircle2 size={16} />}
                    <span>
                      {updateInfo.has_update
                        ? t('about.updateAvailableForCurrentChannel', { channel: t(`about.channels.${currentChannel}`) })
                        : t('about.upToDateForCurrentChannel', { channel: t(`about.channels.${currentChannel}`) })}
                    </span>
                  </div>

                  <div className="grid gap-2.5">
                    {updateInfo.stable && (
                      <ReleaseRow 
                        info={updateInfo.stable} 
                        title={t('about.channels.stable')} 
                        onOpenLink={onOpenLink}
                        t={t}
                      />
                    )}
                    {updateInfo.prerelease && (
                      <ReleaseRow 
                        info={updateInfo.prerelease} 
                        title={t('about.channels.prerelease')} 
                        onOpenLink={onOpenLink}
                        t={t}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Minimal Footer: Solid and centered */}
        <div className="flex items-center justify-between border-t border-border/50 bg-secondary px-8 py-5 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
           <span>FileUni Project</span>
           <span className="opacity-50">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
};


