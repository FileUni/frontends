import React from 'react';
import { Modal } from '@/components/ui/Modal.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useTranslation } from 'react-i18next';
import type { FileInfo } from '../types/index.ts';
import { FileIcon } from './FileIcon.tsx';
import { Calendar, HardDrive, Hash, Info, Type, Clock, Eye, type LucideIcon } from 'lucide-react';
import { useFileActions } from '../hooks/useFileActions.ts';

interface Props {
  file: FileInfo | null;
  onClose: () => void;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface PropertyItemProps {
  icon: LucideIcon;
  label: string;
  value: string | React.ReactNode;
}

export const FilePropertiesModal = ({ file, onClose }: Props) => {
  const { t } = useTranslation();
  const { previewFile } = useFileActions();
  
  if (!file) return null;

  const handlePreview = () => {
    previewFile(file.path);
    onClose();
  };

  const PropertyItem = ({ icon: Icon, label, value }: PropertyItemProps) => (
    <div className="flex items-center gap-3 p-2 px-3 rounded-xl bg-white/[0.02] border border-white/5">
      <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black uppercase opacity-30 leading-none mb-1">{label}</p>
        <p className="text-sm font-bold truncate break-all leading-tight">{value}</p>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={!!file}
      onClose={onClose}
      title={t('filemanager.actions.properties')}
      maxWidth="max-w-md"
      bodyClassName="p-4"
    >
      <div className="space-y-2">
        <div className="flex items-center p-3 gap-4 bg-primary/5 rounded-2xl border border-primary/10 mb-3">
          <FileIcon name={file.name} isDir={file.is_dir} size={40} />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black truncate break-all leading-tight">{file.name}</h3>
            <p className="text-[14px] font-black uppercase opacity-30 mt-0.5">
              {file.is_dir ? t('filemanager.folder') : t('filemanager.file')}
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <PropertyItem icon={Type} label={t('filemanager.prop.name')} value={file.name} />
          <PropertyItem icon={HardDrive} label={t('filemanager.prop.path')} value={file.path} />
          {!file.is_dir && <PropertyItem icon={Hash} label={t('filemanager.prop.size')} value={formatSize(file.size)} />}
          <PropertyItem icon={Calendar} label={t('filemanager.prop.modified')} value={new Date(file.modified).toLocaleString()} />

          {file.accessed_at && (
            <PropertyItem icon={Clock} label={t('filemanager.prop.accessed')} value={new Date(file.accessed_at).toLocaleString()} />
          )}

          {file.original_path && (
            <PropertyItem icon={Info} label={t('filemanager.prop.original')} value={file.original_path} />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          {!file.is_dir && (
            <Button 
              variant="outline"
              size="sm"
              onClick={handlePreview} 
              className="px-4 font-black uppercase text-sm flex items-center gap-2"
            >
              <Eye size={18} />
              {t('filemanager.actions.preview')}
            </Button>
          )}
          <Button 
            onClick={onClose} 
            size="sm"
            className="px-6 font-black uppercase text-sm"
          >
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
