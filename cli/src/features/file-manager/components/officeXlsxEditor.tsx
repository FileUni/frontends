import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { transformExcelToFortune } from '@zenmrp/fortune-sheet-excel';
import { transformFortuneToExcel } from '@corbe30/fortune-excel';
import { Save, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/Button.tsx';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';
import { useThemeStore } from '@fileuni/shared';
import { useToastStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { blobToBase64, fetchFileArrayBuffer, fetchFileStatSize, getFileExtension, isComplexOfficeFile, resolveLimitBytes, uploadBase64File } from '../utils/officeLite.ts';

interface Props {
  path: string;
  onClose: () => void;
}

type FortuneWorkbook = React.ComponentProps<typeof Workbook>["data"];
type WorkbookRef = React.ComponentRef<typeof Workbook>;

export const XlsxLiteEditor: React.FC<Props> = ({ path, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const { capabilities } = useConfigStore();
  const { addToast } = useToastStore();
  const sheetRef = useRef<WorkbookRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [sheets, setSheets] = useState<FortuneWorkbook>([]);
  const [isComplex, setIsComplex] = useState(false);
  const [workbookKey, setWorkbookKey] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const officeLimitBytes = resolveLimitBytes(capabilities?.preview_size_limits?.office_mb);
  const isLargeFile = fileSize > officeLimitBytes;

  const loadWorkbook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const size = await fetchFileStatSize(path);
      setFileSize(size);
      if (size > officeLimitBytes && !forceOpen) {
        setLoading(false);
        return;
      }
      const buffer = await fetchFileArrayBuffer(path);
      const result = await transformExcelToFortune(buffer);
      const resultObject = (typeof result === 'object' && result !== null) ? result as Record<string, unknown> : null;
      const nextSheets = Array.isArray(resultObject?.sheets) ? resultObject?.sheets : result;
      const sheetList = Array.isArray(nextSheets) ? nextSheets as FortuneWorkbook : [];
      const ext = getFileExtension(path);
      setSheets(sheetList);
      setIsComplex(isComplexOfficeFile(ext, size) || sheetList.length > 3);
      setWorkbookKey(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workbook');
    } finally {
      setLoading(false);
    }
  }, [path, forceOpen]);

  useEffect(() => {
    setForceOpen(false);
    setSheets([]);
    setIsComplex(false);
  }, [path]);

  useEffect(() => {
    loadWorkbook();
  }, [loadWorkbook]);

  const handleSave = async () => {
    if (!sheetRef.current) return;
    setSaving(true);
    try {
      const exported = await transformFortuneToExcel(sheetRef.current as Record<string, unknown>, 'xlsx', false);
      let blob: Blob;
      if (exported instanceof Blob) {
        blob = exported;
      } else if (exported instanceof ArrayBuffer) {
        blob = new Blob([exported], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      } else if (exported instanceof Uint8Array) {
        const buffer = new ArrayBuffer(exported.byteLength);
        const bytes = new Uint8Array(buffer);
        bytes.set(exported);
        blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      } else {
        throw new Error('Export failed');
      }
      const base64 = await blobToBase64(blob);
      await uploadBase64File(path, base64);
      addToast(t('filemanager.officeLite.saveSuccess'), 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : t('filemanager.officeLite.saveFailed');
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isLargeFile && !forceOpen) {
    return (
      <div className="fixed inset-0 z-[210] flex flex-col items-center justify-center bg-background text-center gap-4 px-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">
          {t('filemanager.officeLite.largeFileWarning', { size: Math.ceil(officeLimitBytes / (1024 * 1024)) })}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="primary" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={() => setForceOpen(true)}>
            {t('filemanager.officeLite.forceOpen')}
          </Button>
          <Button variant="outline" className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("fixed inset-0 z-[210] flex flex-col", isDark ? "bg-background text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader
        path={path}
        subtitle={t('filemanager.officeLite.xlsxEditorTitle')}
        onClose={onClose}
        extra={
          <Button variant="primary" className="h-9 px-4 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? t('filemanager.officeLite.saving') : t('filemanager.officeLite.save')}
            <Save size={18} className="ml-2" />
          </Button>
        }
      />

      <div className="flex-1 min-h-0">
        {isComplex && !loading && !error && (
          <div className={cn(
            "mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
            isDark ? "border-white/10 bg-white/5 text-white/70" : "border-zinc-200 bg-zinc-50 text-zinc-600"
          )}>
            {t('filemanager.officeLite.complexHint')}
          </div>
        )}
        {loading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] opacity-60">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="h-full">
            <Workbook key={workbookKey} ref={sheetRef} data={sheets} onChange={(next: unknown) => setSheets(Array.isArray(next) ? next as FortuneWorkbook : [])} />
          </div>
        )}
      </div>
    </div>
  );
};
