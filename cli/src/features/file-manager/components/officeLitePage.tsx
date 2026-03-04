import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { DocxLiteEditor } from './officeDocxEditor.tsx';
import { XlsxLiteEditor } from './officeXlsxEditor.tsx';
import { PptxLitePreview } from './officePptxPreview.tsx';
import { getFileExtension, OFFICE_DOCX_EXTS, OFFICE_PPTX_EXTS, OFFICE_XLSX_EXTS } from '../utils/officeLite.ts';

interface Props {
  path: string;
  onClose: () => void;
}

export const OfficeLitePage: React.FC<Props> = ({ path, onClose }) => {
  const { t } = useTranslation();
  const ext = getFileExtension(path);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (OFFICE_DOCX_EXTS.has(ext)) {
    return <DocxLiteEditor path={path} onClose={onClose} />;
  }

  if (OFFICE_XLSX_EXTS.has(ext)) {
    return <XlsxLiteEditor path={path} onClose={onClose} />;
  }

  if (OFFICE_PPTX_EXTS.has(ext)) {
    return <PptxLitePreview path={path} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[210] flex flex-col items-center justify-center bg-background text-center gap-4">
      <AlertCircle size={64} className="opacity-60" />
      <p className="text-sm font-black uppercase tracking-widest">
        {t('filemanager.officeLite.unsupported')}
      </p>
      <Button variant="outline" onClick={onClose} className="h-10 px-6 rounded-xl font-bold uppercase tracking-widest text-sm">
        {t('common.close')}
      </Button>
    </div>
  );
};
