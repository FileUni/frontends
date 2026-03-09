import React, { useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  Globe,
  Info,
  Loader2,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
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

interface LinkActionProps {
  href: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onOpenLink?: (url: string) => void;
}

interface ReleaseCardProps {
  info: AboutReleaseChannelInfo;
  title: string;
  currentChannel: string;
  onOpenLink?: (url: string) => void;
  downloadLabel: string;
  releasePageLabel: string;
  latestVersionLabel: string;
  publishedAtLabel: string;
  currentChannelLabel: string;
  updateAvailableLabel: string;
  upToDateLabel: string;
}

const LinkAction: React.FC<LinkActionProps> = ({ href, label, subtitle, icon: Icon, onOpenLink }) => {
  const content = (
    <>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-inner">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-black uppercase tracking-wide text-foreground">{label}</div>
        <div className="truncate text-sm font-bold text-muted-foreground">{subtitle}</div>
      </div>
      <ExternalLink size={16} className="shrink-0 text-muted-foreground" />
    </>
  );

  const className = cn(
    'flex w-full items-center gap-4 rounded-2xl border border-border bg-background/80 px-4 py-4 transition-all',
    'hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/10',
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

const ReleaseCard: React.FC<ReleaseCardProps> = ({
  info,
  title,
  currentChannel,
  onOpenLink,
  downloadLabel,
  releasePageLabel,
  latestVersionLabel,
  publishedAtLabel,
  currentChannelLabel,
  updateAvailableLabel,
  upToDateLabel,
}) => {
  const isCurrentChannel = info.channel === currentChannel;
  const accentClass = info.channel === 'prerelease'
    ? 'border-fuchsia-400/20 bg-fuchsia-500/8 text-fuchsia-200'
    : 'border-cyan-400/20 bg-cyan-500/8 text-cyan-200';
  const stateClass = info.has_update
    ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
    : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100';
  const downloadUrl = info.target_download_url || info.release_page_url;

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">{title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em]', accentClass)}>
              {info.channel}
            </span>
            {isCurrentChannel && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-slate-200">
                {currentChannelLabel}
              </span>
            )}
          </div>
        </div>

        <div className={cn('rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.18em]', stateClass)}>
          {info.has_update ? updateAvailableLabel : upToDateLabel}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{latestVersionLabel}</div>
        <div className="mt-2 break-all font-mono text-sm font-bold leading-6 text-white sm:text-base">
          {info.version}
        </div>
      </div>

      {info.published_at && (
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-300/90">
          <Calendar size={14} className="shrink-0 text-slate-400" />
          <span className="break-all">{publishedAtLabel}: {info.published_at}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => onOpenLink ? onOpenLink(downloadUrl) : window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
          className="h-10 gap-2 px-4 text-sm"
        >
          <Download size={15} />
          {downloadLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenLink ? onOpenLink(info.release_page_url) : window.open(info.release_page_url, '_blank', 'noopener,noreferrer')}
          className="h-10 gap-2 border-white/15 bg-white/5 px-4 text-sm text-white hover:bg-white/10"
        >
          <ExternalLink size={15} />
          {releasePageLabel}
        </Button>
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
    if (!isOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const currentVersionText = currentVersion || '—';
  const currentChannelText = updateInfo?.current_channel || 'stable';
  const currentChannelLabel = currentChannelText === 'prerelease'
    ? t('about.channels.prerelease')
    : t('about.channels.stable');
  const hasChannelData = Boolean(updateInfo?.stable || updateInfo?.prerelease);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fileuni-about-modal-title"
      style={{ zIndex }}
    >
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-primary/18 via-cyan-500/8 to-transparent px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/8 shadow-inner">
                <Info size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 id="fileuni-about-modal-title" className="text-xl font-black tracking-tight sm:text-2xl">
                  {t('about.title')}
                </h2>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-300/80 sm:text-base">
                  {t('about.subtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black uppercase tracking-wide text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 shadow-inner">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                  FileUni
                </span>
              </div>
              <div className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                {t('about.title')}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-300/75">
                {t('about.subtitle')}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
              <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                    {t('about.currentChannel')}
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/12 px-3 py-1 text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
                    {currentChannelLabel}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                    {t('about.currentVersion')}
                  </div>
                  <div className="mt-3 break-all rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 font-mono text-base font-black leading-7 text-white sm:text-xl">
                    {currentVersionText}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <LinkAction href={PROJECT_HOMEPAGE_URL} label={t('about.links.website')} subtitle="fileuni.com" icon={Globe} onOpenLink={onOpenLink} />
            <LinkAction href={PROJECT_DOCS_URL} label={t('about.links.docs')} subtitle="docs.fileuni.com" icon={BookOpen} onOpenLink={onOpenLink} />
            <LinkAction
              href={PROJECT_REPOSITORY_URL}
              label={t('about.links.repository')}
              subtitle="github.com/FileUni/FileUni-Project"
              icon={GitBranch}
              onOpenLink={onOpenLink}
            />
          </div>

          {showCheckUpdates && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 shadow-inner">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
                    <Sparkles size={16} className="text-primary" />
                    {t('about.updateSectionTitle')}
                  </div>
                  <p className="text-sm leading-6 text-slate-300/85">{t('about.updateSectionDescription')}</p>
                </div>
                {onCheckUpdates && (
                  <Button type="button" onClick={() => void onCheckUpdates()} disabled={isCheckingUpdates} className="h-11 gap-2 px-5 text-sm">
                    {isCheckingUpdates ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    {isCheckingUpdates ? t('about.checking') : t('about.checkUpdates')}
                  </Button>
                )}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  {updateError ? (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-200">
                      <div className="flex items-start gap-3">
                        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                        <div>
                          <div className="font-black uppercase tracking-wide">{t('about.updateError')}</div>
                          <div className="mt-1 font-semibold text-red-200/90">{updateError}</div>
                        </div>
                      </div>
                    </div>
                  ) : updateInfo ? (
                    <div className={cn(
                      'rounded-2xl border px-4 py-4 text-sm',
                      updateInfo.has_update
                        ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                        : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                    )}>
                      <div className="flex items-start gap-3">
                        {updateInfo.has_update ? (
                          <Download size={18} className="mt-0.5 shrink-0 text-amber-300" />
                        ) : (
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                        )}
                        <div className="min-w-0">
                          <div className="font-black uppercase tracking-wide">
                            {updateInfo.has_update
                              ? t('about.updateAvailableForCurrentChannel', { channel: currentChannelLabel })
                              : t('about.upToDateForCurrentChannel', { channel: currentChannelLabel })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm font-semibold text-slate-400">
                      {t('about.updateIdle')}
                    </div>
                  )}
                </div>

                {hasChannelData && (
                    <div className="lg:w-56" />
                )}
              </div>

              {hasChannelData && (
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {updateInfo?.stable && (
                    <ReleaseCard
                      info={updateInfo.stable}
                      title={t('about.channels.stable')}
                      currentChannel={currentChannelText}
                      onOpenLink={onOpenLink}
                      downloadLabel={t('about.downloadChannel')}
                      releasePageLabel={t('about.viewReleasePage')}
                      latestVersionLabel={t('about.latestVersion')}
                      publishedAtLabel={t('about.publishedAt')}
                      currentChannelLabel={t('about.currentChannelBadge')}
                      updateAvailableLabel={t('about.state.updateAvailable')}
                      upToDateLabel={t('about.state.upToDate')}
                    />
                  )}
                  {updateInfo?.prerelease && (
                    <ReleaseCard
                      info={updateInfo.prerelease}
                      title={t('about.channels.prerelease')}
                      currentChannel={currentChannelText}
                      onOpenLink={onOpenLink}
                      downloadLabel={t('about.downloadChannel')}
                      releasePageLabel={t('about.viewReleasePage')}
                      latestVersionLabel={t('about.latestVersion')}
                      publishedAtLabel={t('about.publishedAt')}
                      currentChannelLabel={t('about.currentChannelBadge')}
                      updateAvailableLabel={t('about.state.updateAvailable')}
                      upToDateLabel={t('about.state.upToDate')}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
