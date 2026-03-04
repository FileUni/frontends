import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUploadStore } from '../store/useUploadStore.ts';
import { useFileStore } from '../store/useFileStore.ts';
import { 
  X, Upload, FileUp, FolderUp, 
  Info, AlertCircle, Database
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/utils.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 专业上传模态框 / Professional Upload Modal
 * 支持多文件上传、目录上传以及拖拽上传，并清晰显示目标路径。
 */
export const UploadModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();
  const { addTasks } = useUploadStore();
  const store = useFileStore();
  const currentPath = store.getCurrentPath();
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const directoryInputProps = {
    webkitdirectory: "",
    directory: "",
  } as React.InputHTMLAttributes<HTMLInputElement>;

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      addTasks(files, currentPath);
      onClose();
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">{t('filemanager.upload')}</h3>
              <div className="flex items-center gap-1.5 opacity-40 mt-0.5">
                <Database size={10} />
                <span className="text-sm font-mono truncate max-w-[300px]">{currentPath || '/'}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl h-10 w-10 p-0 hover:bg-white/5">
            <X size={20} className="opacity-40" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Drag & Drop Area */}
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300 relative group",
              isDragging 
                ? "border-primary bg-primary/5 scale-[1.02]" 
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-500",
              isDragging ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-white/5 text-white/20 group-hover:text-primary/50 group-hover:bg-primary/5"
            )}>
              <FileUp size={40} />
            </div>
            <h4 className="text-white font-bold mb-2 text-center transition-colors group-hover:text-primary">
              {isDragging ? t('filemanager.messages.dropToUpload') || "Release to Upload" : t('filemanager.messages.dragFilesHere') || "Drag files or folders here"}
            </h4>
            <p className="text-white/40 text-sm text-center max-w-[280px]">
              {t('filemanager.messages.uploadInstruction') || "Support multiple files and directory structure preservation."}
            </p>

            {/* Hidden Inputs */}
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              className="hidden" 
              onChange={(e) => handleFiles(e.target.files)} 
            />
            <input 
              type="file" 
              ref={dirInputRef} 
              {...directoryInputProps}
              className="hidden" 
              onChange={(e) => handleFiles(e.target.files)} 
            />
          </div>

          {/* Manual Selection Buttons */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 h-14 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all active:scale-95 group"
            >
              <FileUp size={18} className="text-blue-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              <span className="text-sm font-bold text-white/80">{t('filemanager.actions.uploadFiles') || "Select Files"}</span>
            </button>
            <button 
              onClick={() => dirInputRef.current?.click()}
              className="flex items-center justify-center gap-3 h-14 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all active:scale-95 group"
            >
              <FolderUp size={18} className="text-yellow-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              <span className="text-sm font-bold text-white/80">{t('filemanager.actions.uploadDirectory') || "Select Folder"}</span>
            </button>
          </div>

          {/* Status Tips */}
          <div className="mt-8 space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-white/40 leading-relaxed italic">
                {t('filemanager.messages.uploadTip1') || "Directories will be uploaded recursively maintaining their original structure."}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-orange-500/50 mt-0.5 shrink-0" />
              <p className="text-sm text-white/40 leading-relaxed italic">
                {t('filemanager.messages.uploadTip2') || "Existing files with same names will be automatically renamed to avoid data loss."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex justify-end">
          <Button variant="ghost" onClick={onClose} className="rounded-xl px-6 h-11 font-bold">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};
