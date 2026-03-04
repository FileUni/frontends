import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { Switch } from '@/components/ui/Switch.tsx';
import { useConfigStore } from '@/stores/config.ts';

type ArchiveOperationMode = 'compress' | 'decompress';

type ArchiveFormat = 'zip' | '7z' | 'gz' | 'tar.gz';

export type ArchiveOperationSubmitPayload =
  | {
      mode: 'compress';
      paths: string[];
      targetName: string;
      format: ArchiveFormat;
      level: number;
      password?: string;
      encryptFilenames: boolean;
      deleteSource: boolean;
    }
  | {
      mode: 'decompress';
      paths: string[];
      targetPath: string;
      overwrite: boolean;
      password?: string;
      deleteArchive: boolean;
    };

interface Props {
  isOpen: boolean;
  mode: ArchiveOperationMode;
  paths: string[];
  defaultTargetPath: string;
  defaultArchiveName: string;
  onClose: () => void;
  onSubmit: (payload: ArchiveOperationSubmitPayload) => Promise<void>;
}

function normalizeLogicalPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function ArchiveOperationModal({
  isOpen,
  mode,
  paths,
  defaultTargetPath,
  defaultArchiveName,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { capabilities } = useConfigStore();

  const isBatch = useMemo(() => paths.length > 1, [paths.length]);

  // Decompress fields
  const [targetPath, setTargetPath] = useState(defaultTargetPath);
  const [overwrite, setOverwrite] = useState(false);
  const [deleteArchive, setDeleteArchive] = useState(false);
  const [decompressPassword, setDecompressPassword] = useState('');

  // Compress fields
  const [targetName, setTargetName] = useState(defaultArchiveName);
  const defaultFormat = (capabilities?.default_compression_format as ArchiveFormat) || 'zip';
  const allowedFormats: ArchiveFormat[] = capabilities?.has_7z ? ['zip', '7z', 'tar.gz', 'gz'] : ['zip', 'tar.gz', 'gz'];
  const [format, setFormat] = useState<ArchiveFormat>(allowedFormats.includes(defaultFormat) ? defaultFormat : 'zip');
  
  const maxLevel = capabilities?.compression_max_level ?? 9;
  const [level, setLevel] = useState<number>(Math.min(6, maxLevel));
  const [encryptFilenames, setEncryptFilenames] = useState(false);
  const [deleteSource, setDeleteSource] = useState(false);
  const [compressPassword, setCompressPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needs7zForDecompress = useMemo(() => {
    if (mode !== 'decompress' || !paths.length) return false;
    if (capabilities?.has_7z) return false;
    
    // 检查选中的文件是否有非原生支持的后缀 / Check if selected files have non-native extensions
    const nativeExts = ['.zip', '.tar.gz', '.gz'];
    return paths.some(p => {
        const lower = p.toLowerCase();
        return !nativeExts.some(ext => lower.endsWith(ext));
    });
  }, [mode, paths, capabilities?.has_7z]);

  useEffect(() => {
    if (!isOpen) return;

    // Reset form values on open
    setTargetPath(defaultTargetPath);
    setTargetName(defaultArchiveName);

    setOverwrite(false);
    setDeleteArchive(false);
    setEncryptFilenames(false);
    setDeleteSource(false);

    setDecompressPassword('');
    setCompressPassword('');

    const allowed = capabilities?.has_7z ? ['zip', '7z', 'tar.gz', 'gz'] : ['zip', 'tar.gz', 'gz'];
    setFormat(allowed.includes(defaultFormat as ArchiveFormat) ? (defaultFormat as ArchiveFormat) : 'zip');
    setLevel(Math.min(6, maxLevel));
    setError(null);
  }, [isOpen, defaultTargetPath, defaultArchiveName, defaultFormat, capabilities?.has_7z, maxLevel]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paths.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'decompress') {
        await onSubmit({
          mode: 'decompress',
          paths,
          targetPath: normalizeLogicalPath(targetPath),
          overwrite,
          password: decompressPassword.trim() ? decompressPassword.trim() : undefined,
          deleteArchive,
        });
      } else {
        const maxLevelVal = capabilities?.compression_max_level ?? 9;
        const safeLevel = Number.isFinite(level) ? Math.min(maxLevelVal, Math.max(1, level)) : Math.min(6, maxLevelVal);
        await onSubmit({
          mode: 'compress',
          paths,
          targetName: targetName.trim() || 'archive',
          format,
          level: safeLevel,
          password: compressPassword.trim() ? compressPassword.trim() : undefined,
          encryptFilenames,
          deleteSource,
        });
      }
    } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError(String(e));
        }
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'decompress'
      ? t('filemanager.archive.decompressTitle')
      : t('filemanager.archive.compressTitle');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
            <div className="bg-red-500/10 p-3 rounded-xl text-red-500 text-sm font-bold border border-red-500/20">
                {error}
            </div>
        )}
        {needs7zForDecompress && (
            <div className="bg-amber-500/10 p-3 rounded-xl text-amber-500 text-sm font-bold border border-amber-500/20">
                {t('filemanager.archive.requires7zWarning')}
            </div>
        )}
        {mode === 'decompress' ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60">
                {t('filemanager.archive.targetPath')}
              </label>
              <Input
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder={t('filemanager.archive.targetPathPlaceholder')}
                className="font-mono"
                autoFocus
              />
              <p className="text-sm opacity-50">
                {t('filemanager.archive.targetPathHint')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold">
                    {t('filemanager.archive.overwrite')}
                  </div>
                  <div className="text-sm opacity-60">
                    {t('filemanager.archive.overwriteHint')}
                  </div>
                </div>
                <Switch checked={overwrite} onChange={setOverwrite} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold">
                    {t('filemanager.archive.deleteArchive')}
                  </div>
                  <div className="text-sm opacity-60">
                    {t('filemanager.archive.deleteArchiveHint')}
                  </div>
                </div>
                <Switch checked={deleteArchive} onChange={setDeleteArchive} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60">
                {t('filemanager.archive.passwordOptional')}
              </label>
              <Input
                value={decompressPassword}
                onChange={(e) => setDecompressPassword(e.target.value)}
                placeholder={t('filemanager.archive.passwordPlaceholder')}
                type="password"
                className="font-mono"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60">
                {t('filemanager.archive.archiveName')}
              </label>
              <Input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder={t('filemanager.archive.archiveNamePlaceholder')}
                className="font-mono"
                autoFocus
              />
              {isBatch && (
                <p className="text-sm opacity-50">
                  {t('filemanager.archive.batchNameHint')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-black uppercase opacity-60 text-foreground">
                  {t('filemanager.archive.format')}
                </label>
                <select
                  className="h-10 w-full rounded-xl bg-background border border-border px-3 text-sm font-bold text-foreground"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ArchiveFormat)}
                >
                  <option value="zip">ZIP</option>
                  {capabilities?.has_7z && <option value="7z">7Z</option>}
                  <option value="tar.gz">TAR.GZ</option>
                  <option value="gz">GZ (Single File)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black uppercase opacity-60 text-foreground">
                  {t('filemanager.archive.level')} (Max: {maxLevel})
                </label>
                <Input
                  type="number"
                  min={1}
                  max={maxLevel}
                  value={level}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val > maxLevel) setLevel(maxLevel);
                    else if (val < 1) setLevel(1);
                    else setLevel(val);
                  }}
                  className="font-mono text-foreground bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(format === '7z' && compressPassword.length > 0) && (
                <div className="flex items-center justify-between gap-4 animate-in fade-in zoom-in-95">
                    <div>
                    <div className="text-sm font-bold">
                        {t('filemanager.archive.encryptFilenames')}
                    </div>
                    <div className="text-sm opacity-60">
                        {t('filemanager.archive.encryptFilenamesHint')}
                    </div>
                    </div>
                    <Switch checked={encryptFilenames} onChange={setEncryptFilenames} />
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold">
                    {t('filemanager.archive.deleteSource')}
                  </div>
                  <div className="text-sm opacity-60">
                    {t('filemanager.archive.deleteSourceHint')}
                  </div>
                </div>
                <Switch checked={deleteSource} onChange={setDeleteSource} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60">
                {t('filemanager.archive.passwordOptional')}
              </label>
              <Input
                value={compressPassword}
                onChange={(e) => setCompressPassword(e.target.value)}
                placeholder={t('filemanager.archive.passwordPlaceholder')}
                type="password"
                className="font-mono"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" className="rounded-xl" disabled={submitting || needs7zForDecompress}>
            {submitting ? t('common.loading') : t('common.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
