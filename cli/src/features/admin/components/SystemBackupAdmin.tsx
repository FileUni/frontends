import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@fileuni/shared';
import { Modal } from '@/components/ui/Modal.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { client } from '@/lib/api.ts';
import { Archive, Download, Upload, AlertTriangle, RefreshCw, Database, Server } from 'lucide-react';

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'msg' in error) {
    const message = (error as { msg?: unknown }).msg;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return error instanceof Error ? error.message : 'Unknown error';
};

export const SystemBackupAdmin: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  
  // Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExport = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
        const response = await client.POST("/api/v1/admin/system/backup/export", {
            parseAs: "blob",
        });
        
        if (response.error) {
            addToast(t("admin.saveError") + ": " + JSON.stringify(response.error), "error");
            return;
        }

        const blob = response.data;
        if (!(blob instanceof Blob)) return;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
        a.download = `backup_fileuni_${timestamp}.tar.gz`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addToast(t("admin.backup.exportSuccess"), "success");
    } catch (e: unknown) {
        addToast(t("admin.saveError") + ": " + getErrorMessage(e), "error");
    } finally {
        setLoading(false);
    }
  };

  const handleLocalBackup = async () => {
    if (localLoading) return;
    setLocalLoading(true);
    try {
        const { data, error } = await client.POST("/api/v1/admin/system/backup/run-local");
        if (error) {
            addToast(t("admin.saveError") + ": " + JSON.stringify(error), "error");
        } else {
            addToast(t("admin.backup.localSuccess", { path: data?.data }), "success");
        }
    } catch (e: unknown) {
        addToast(t("admin.saveError") + ": " + getErrorMessage(e), "error");
    } finally {
        setLocalLoading(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setPendingFile(e.target.files[0]);
    setIsImportModalOpen(true);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!pendingFile) return;

    setLoading(true);
    setIsImportModalOpen(false);
    
    try {
        const { error } = await client.POST("/api/v1/admin/system/backup/import", {
            body: {
                file: pendingFile
            },
            bodySerializer: (body: { file: File }) => {
                const fd = new FormData();
                fd.append("file", body.file);
                return fd;
            }
        });

        if (error) {
            addToast(t("admin.saveError") + ": " + JSON.stringify(error), "error");
        } else {
            addToast(t("admin.backup.importSuccess"), "success");
        }
    } catch (err: unknown) {
        addToast(t("admin.saveError") + ": " + getErrorMessage(err), "error");
    } finally {
        setLoading(false);
        setPendingFile(null);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner shrink-0">
          <Archive size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t("admin.backup.title")}</h2>
          <p className="text-sm font-bold opacity-40 uppercase tracking-widest">
            Core Data Management
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="p-8 bg-white/[0.03] rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/20">
                <Download size={20} />
              </div>
              <h3 className="text-lg font-bold">{t("admin.backup.exportTitle")}</h3>
            </div>
            <p className="text-sm opacity-60 leading-relaxed mb-4">
              {t("admin.backup.exportDesc")}
            </p>
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/90 text-sm mb-8 flex gap-3">
              <Database size={16} className="shrink-0" />
              <p>{t("admin.backup.largeDbWarning")}</p>
            </div>
          </div>
          <Button
            onClick={handleExport}
            disabled={loading}
            className="h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
          >
            {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Download className="mr-2" size={18} />}
            {loading ? t("common.loading") : t("admin.backup.exportBtn")}
          </Button>
        </div>

        {/* Local Backup Section */}
        <div className="p-8 bg-white/[0.03] rounded-[2rem] border border-white/5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                <Server size={20} />
              </div>
              <h3 className="text-lg font-bold">{t("admin.backup.localTitle")}</h3>
            </div>
            <p className="text-sm opacity-60 leading-relaxed mb-8">
              {t("admin.backup.localDesc")}
            </p>
          </div>
          <Button
            onClick={handleLocalBackup}
            disabled={localLoading}
            variant="outline"
            className="h-14 rounded-2xl font-black uppercase tracking-widest text-sm border-indigo-500/30 hover:bg-indigo-500/10"
          >
            {localLoading ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Archive className="mr-2" size={18} />}
            {localLoading ? t("common.loading") : t("admin.backup.localBtn")}
          </Button>
        </div>

        {/* Import Section */}
        <div className="p-8 bg-white/[0.03] rounded-[2rem] border border-white/5 border-l-4 border-l-red-500 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center border border-red-500/20">
                <Upload size={20} />
              </div>
              <h3 className="text-lg font-bold text-red-500">{t("admin.backup.importTitle")}</h3>
            </div>
            <p className="text-sm opacity-60 leading-relaxed mb-8">
              {t("admin.backup.importDesc")}
              <br/><strong className="text-red-500/80">{t("admin.backup.importWarning")}</strong>
            </p>
          </div>
          
          <div className="relative">
            <input
                type="file"
                accept=".tar.gz,.tgz"
                onChange={onFileSelect}
                disabled={loading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <Button
                variant="destructive"
                disabled={loading}
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-red-500/20"
            >
                {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Upload className="mr-2" size={18} />}
                {loading ? t("common.loading") : t("admin.backup.importBtn")}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
            setIsImportModalOpen(false);
            setPendingFile(null);
        }}
        title={t("admin.backup.confirmTitle")}
      >
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-red-600/20 border border-red-500/50 text-red-500">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle size={20} />
              <span className="font-black uppercase text-sm tracking-widest">Critical Action</span>
            </div>
            <p className="text-sm font-bold leading-relaxed">
              {t("admin.backup.confirmMsg")}
            </p>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 italic text-sm opacity-60">
            <Archive size={16} />
            <p className="truncate">File: {pendingFile?.name}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
                {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              disabled={loading}
              onClick={handleImportConfirm}
              className="shadow-lg shadow-red-500/20"
            >
              {loading ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Upload className="mr-2" size={16} />}
              {t("admin.backup.confirmBtn")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
