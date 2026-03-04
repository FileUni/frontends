import { Input } from '@/components/ui/Input.tsx';
import { useTranslation } from 'react-i18next';

type Props = {
  version: string;
  setVersion: (value: string) => void;
  downloadUrl: string;
  setDownloadUrl: (value: string) => void;
  archiveKind: string;
  setArchiveKind: (value: string) => void;
  downloadUrlTemplate: string;
  setDownloadUrlTemplate: (value: string) => void;
  githubDownloadMirror: string;
  setGithubDownloadMirror: (value: string) => void;
  binPath: string;
  setBinPath: (value: string) => void;
  targetOs: string;
  setTargetOs: (value: string) => void;
  targetArch: string;
  setTargetArch: (value: string) => void;
  title: string;
  hint: string;
};

export const InstallSettingsPanel = (props: Props) => {
  const { t } = useTranslation();
  return (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
    <h3 className="text-lg font-black">{props.title}</h3>
    <p className="text-sm opacity-70">{props.hint}</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Input value={props.version} onChange={(e) => props.setVersion(e.target.value)} placeholder={t('admin.extensions.versionPlaceholder')} />
      <Input value={props.downloadUrl} onChange={(e) => props.setDownloadUrl(e.target.value)} placeholder={t('admin.extensions.downloadUrlPlaceholder')} />
      <Input value={props.archiveKind} onChange={(e) => props.setArchiveKind(e.target.value)} placeholder={t('admin.extensions.archiveKindPlaceholder')} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Input value={props.downloadUrlTemplate} onChange={(e) => props.setDownloadUrlTemplate(e.target.value)} placeholder={t('admin.extensions.downloadTemplatePlaceholder')} />
      <Input value={props.githubDownloadMirror} onChange={(e) => props.setGithubDownloadMirror(e.target.value)} placeholder={t('admin.extensions.githubMirrorPlaceholder')} />
      <Input value={props.binPath} onChange={(e) => props.setBinPath(e.target.value)} placeholder={t('admin.extensions.binPathPlaceholder')} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Input value={props.targetOs} onChange={(e) => props.setTargetOs(e.target.value)} placeholder={t('admin.extensions.targetOsPlaceholder')} />
      <Input value={props.targetArch} onChange={(e) => props.setTargetArch(e.target.value)} placeholder={t('admin.extensions.targetArchPlaceholder')} />
    </div>
  </div>
  );
};
