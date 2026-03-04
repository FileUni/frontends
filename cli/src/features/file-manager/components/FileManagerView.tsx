import { useState, useEffect, useRef } from "react";
import { FileManagerToolbar } from "./FileManagerToolbar.tsx";
import { FileBrowser } from "./FileBrowser.tsx";
import { FileManagerContextMenu } from "./FileManagerContextMenu.tsx";
import { ShareModal } from "./ShareModal.tsx";
import { GlobalUploader } from "./GlobalUploader.tsx";
import { Pagination } from "@/components/common/Pagination.tsx";

import { useFileActions } from "../hooks/useFileActions.ts";
import { useFileStore } from "../store/useFileStore.ts";
import { useSelectionStore } from "../store/useSelectionStore.ts";
import { useAudioStore } from "@/stores/audio.ts";
import type { FileInfo, ClipboardItem, FileManagerMode } from "../types/index.ts";
import { FileActionModal } from "./FileActionModal.tsx";
import { ConfirmDestructiveModal } from "./ConfirmDestructiveModal.tsx";
import { FilePropertiesModal } from "./FilePropertiesModal.tsx";
import { ArchiveOperationModal, type ArchiveOperationSubmitPayload } from "./ArchiveOperationModal.tsx";
import { ArchiveBrowser } from "./ArchiveBrowser.tsx";

import { ClipboardBar } from "./ClipboardBar.tsx";
import { useTranslation } from "react-i18next";
import { client } from "@/lib/api.ts";
import type { components } from "@/types/api.ts";
import { useToastStore } from "@fileuni/shared";
import { useNavigationStore } from "@/stores/navigation.ts";

import { FileManagerTabs } from "./FileManagerTabs.tsx";
import { FileManagerNavigationBar } from "./FileManagerNavigationBar.tsx";
import { FileManagerRecentStats } from "./FileManagerRecentStats.tsx";
import { FileManagerFavoriteFilter } from "./FileManagerFavoriteFilter.tsx";
import { FilePreviewPage } from "./FilePreviewPage.tsx";
import { OfficeLitePage } from "./officeLitePage.tsx";
import { OfficeOpenModal } from "./officeOpenModal.tsx";
import { getFileExtension, isOfficeExtension } from "../utils/officeLite.ts";

export const FileManagerView = () => {
  const { t } = useTranslation();
  const { params, navigate } = useNavigationStore();
  const {
    loadFiles, deleteFiles, downloadFile, restoreFiles, deletePermanent,
    clearRecycleBin, toggleFavorite, createFile, createDirectory, renameFile,
    clearHistory, removeFromHistory, cancelShare, previewFile, pasteItems,
    waitForTask, clearThumbnailCache, clearThumbnailCacheAllUsers, setThumbnailDisabled
  } = useFileActions();

  const store = useFileStore();
  const {
    setCurrentPath, files, showShareStatus, openActionModal, closeActionModal,
    fmMode, setFmMode, favoriteFilterColor, addToRecentFiles, pagination, actionModal
  } = store;

  const currentPath = store.getCurrentPath();
  const clipboard = store.getClipboard();
  const { addToast } = useToastStore();
  const { selectedIds, deselectAll, selectAll } = useSelectionStore();
  const { play: playAudio } = useAudioStore();

  const isArchive = (file: FileInfo | null) => {
    if (!file || file.is_dir) return false;
    const archives = ['.zip', '.7z', '.rar', '.tar.gz', '.gz', '.tar', '.bz2', '.xz'];
    const lowerName = file.name.toLowerCase();
    return archives.some(ext => lowerName.endsWith(ext));
  };

  const [archiveOpModal, setArchiveOpModal] = useState<{
    isOpen: boolean; mode: 'compress' | 'decompress'; paths: string[];
    defaultTargetPath: string; defaultArchiveName: string;
  }>({
    isOpen: false, mode: 'decompress', paths: [], defaultTargetPath: '/', defaultArchiveName: 'archive',
  });

  const [browsingArchivePath, setBrowsingArchivePath] = useState<string | null>(null);
  const [archivePassword, setArchivePassword] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FileInfo | null; } | null>(null);
  const [activeShareFile, setActiveShareFile] = useState<FileInfo | null>(null);
  const [pendingDeletePaths, setPendingDeletePaths] = useState<string[]>([]);
  const [propertiesFile, setPropertiesFile] = useState<FileInfo | null>(null);
  const isSyncingRef = useRef(false);

  // 1. 初始化加载同步 / Init and sync
  useEffect(() => {
    isSyncingRef.current = true;
    const page = params.page as FileManagerMode;
    const path = params.path;
    
    if (page && page !== useFileStore.getState().fmMode) {
      useFileStore.getState().setFmMode(page);
    } else if (!page) {
      useFileStore.getState().setFmMode('files');
    }
    
    if (path && path !== useFileStore.getState().getCurrentPath()) {
      useFileStore.getState().setCurrentPath(path);
    }
    
    setIsReady(true);
    setTimeout(() => { isSyncingRef.current = false; }, 100);
  }, [params.page, params.path]);


  // 2. Store -> URL 同步 / Store to URL sync
  useEffect(() => {
    if (!isReady || isSyncingRef.current) return;
    
    interface NavParams extends Record<string, string | number | undefined> {
      mod: string;
      page: FileManagerMode;
      path?: string;
    }

    const newParams: NavParams = { mod: 'file-manager', page: fmMode };
    if (fmMode === "files") newParams.path = currentPath;
    
    if (params.page !== newParams.page || params.path !== newParams.path) {
      navigate(newParams as unknown as Parameters<typeof navigate>[0]);
    }
  }, [fmMode, currentPath, isReady, navigate, params.page, params.path]);

  // 3. 数据加载 / Data loading
  const sortConfig = store.getSortConfig();
  const isSearchMode = store.getIsSearchMode();
  const searchKeyword = store.getSearchKeyword();
  const pageSize = store.getPageSize();

  useEffect(() => {
    if (!isReady) return;
    loadFiles(fmMode === 'files' ? currentPath : '');
  }, [
    fmMode, currentPath, showShareStatus, favoriteFilterColor, 
    sortConfig.field, sortConfig.order, isSearchMode, 
    searchKeyword, pageSize, isReady
  ]);

  // 4. 键盘快捷键 / Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isAnyModalOpen = actionModal.isOpen || activeShareFile || propertiesFile || browsingArchivePath || archiveOpModal.isOpen;
      const isMod = e.ctrlKey || e.metaKey;
      const paths = Array.from(selectedIds);

      if (e.key === 'Escape') { deselectAll(); setContextMenu(null); return; }
      if (isAnyModalOpen) return;

      if (isMod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(files.map(f => f.path)); }
      if (isMod && e.key.toLowerCase() === 'c' && paths.length > 0) {
        e.preventDefault();
        const copyItems: ClipboardItem[] = paths.map(p => {
          const f = files.find(file => file.path === p);
          return { path: p, type: 'copy', name: f?.name || p.split('/').pop() || '', is_dir: f?.is_dir || false };
        });
        store.addToClipboard(copyItems);
        addToast(t('filemanager.messages.addedToClipboardCopy'), "success");
        deselectAll();
      }
      if (isMod && e.key.toLowerCase() === 'x' && paths.length > 0) {
        e.preventDefault();
        const cutItems: ClipboardItem[] = paths.map(p => {
          const f = files.find(file => file.path === p);
          return { path: p, type: 'cut', name: f?.name || p.split('/').pop() || '', is_dir: f?.is_dir || false };
        });
        store.addToClipboard(cutItems);
        addToast(t('filemanager.messages.addedToClipboardCut'), "success");
        deselectAll();
      }
      if (isMod && e.key.toLowerCase() === 'v' && clipboard.length > 0 && fmMode === 'files') {
        e.preventDefault();
        handleAction("paste", null);
      }
      if (e.key === 'F2' && selectedIds.size === 1) {
        const path = Array.from(selectedIds)[0];
        const targetFile = files.find(f => f.path === path);
        if (targetFile) handleAction("rename", targetFile);
      }
      if ((e.key === 'Delete' || (e.key === 'Backspace' && isMod)) && paths.length > 0) {
        e.preventDefault();
        handleAction("delete", null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedIds, files, clipboard, currentPath, fmMode, 
    actionModal, activeShareFile, propertiesFile, browsingArchivePath, archiveOpModal,
    selectAll, deselectAll, addToast, t
  ]);

  const handleAction = (action: string, target: FileInfo | null) => {
    setContextMenu(null);
    const isShares = fmMode === "shares";
    const selectedList = selectedIds.size > 0 ? Array.from(selectedIds) : target ? [isShares && target.id ? target.id : target.path] : [];
    const paths = isShares ? (selectedIds.size > 0 ? (Array.from(selectedIds).map(id => files.find(f => f.id === id)?.path).filter(Boolean) as string[]) : (target ? [target.path] : [])) : selectedList;

    if (paths.length === 0 && !["refresh", "empty_trash", "new_file", "new_folder", "paste", "clear_history"].includes(action)) return;

    switch (action) {
      case "open":
      case "preview":
        if (target) {
          const ext = target.name.split('.').pop()?.toLowerCase() || '';
          const isAudio = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext);
          if (target.is_dir) { 
            setFmMode("files"); 
            setCurrentPath(target.path); 
          } 
          else if (isArchive(target) && action === "open") { 
            setBrowsingArchivePath(target.path); 
          }
          else if (isAudio && action === "open") {
            // 音频优先使用浮动播放器 / Audio prioritizes floating player
            playAudio(target, files);
            addToast(t('filemanager.audio.addedToPlaylist'), 'success');
          }
          else { 
            addToRecentFiles(target); 
            previewFile(target.path); 
          }
        }
        break;
      case "browse_archive": if (target) setBrowsingArchivePath(target.path); break;
      case "open_location":
        if (target) {
          const pathParts = target.path.split('/').filter(Boolean);
          pathParts.pop();
          const parentPath = '/' + pathParts.join('/');
          store.addTab(parentPath);
          store.setFmMode('files');
          store.setHighlightedPath(target.path);
        }
        break;
      case "properties": if (target) { addToRecentFiles(target); setPropertiesFile(target); } break;
      case "remove_from_history": removeFromHistory(paths); deselectAll(); break;
      case "clear_history": clearHistory(); break;
      case "download": if (target) downloadFile(target.path); break;
      case "share": if (target) setActiveShareFile(target); break;
      case "cancel_share": if (selectedIds.size > 0) { for (const id of Array.from(selectedIds)) cancelShare(id); deselectAll(); } else if (target?.id) cancelShare(target.id); break;
      case "copy": case "cut":
        const items: ClipboardItem[] = paths.map(p => {
          const f = files.find(file => file.path === p);
          return { path: p, type: action as 'copy' | 'cut', name: f?.name || p.split('/').pop() || '', is_dir: f?.is_dir || false };
        });
        store.addToClipboard(items);
        deselectAll();
        break;
      case "paste": if (fmMode === 'files') pasteItems(clipboard, currentPath); break;
      case "delete": 
        setPendingDeletePaths(paths);
        if (fmMode === 'files' || fmMode === 'trash') {
          openActionModal("delete_confirm", t("filemanager.actions.delete"), t("filemanager.messages.confirmDelete", { count: paths.length }));
        } else {
          openActionModal("mode_delete_confirm", t("filemanager.actions.delete"), t("filemanager.messages.confirmDelete", { count: paths.length }), undefined, fmMode);
        }
        break;
      case "restore": restoreFiles(paths); break;
      case "delete_permanent": deletePermanent(paths); break;
      case "empty_trash": clearRecycleBin(); break;
      case "compress": openArchiveOperationModal('compress', paths); break;
      case "extract": openArchiveOperationModal('decompress', paths); break;
      case "refresh": loadFiles(); break;
      case "rename": if (target) openActionModal("rename", t("filemanager.actions.rename"), target.name, target.path); break;
      case "new_file": openActionModal("create_file", t("filemanager.newFile"), "NewFile.md"); break;
      case "new_folder": openActionModal("create_dir", t("filemanager.newFolder"), "NewFolder"); break;
      case "thumb_clear_dir": if (target) clearThumbnailCache(target.path); break;
      case "thumb_clear_all": clearThumbnailCache(); break;
      case "thumb_clear_all_users": clearThumbnailCacheAllUsers(); break;
      case "thumb_disable": if (target) setThumbnailDisabled(target.path, true); break;
      case "thumb_enable": if (target) setThumbnailDisabled(target.path, false); break;
      case "toggle_favorite": if (target) toggleFavorite([target.path], target.favorite_color === 0 ? 1 : 0); break;
      default: if (action.startsWith("favorite_")) { const color = parseInt(action.split("_")[1]); toggleFavorite(paths, color); } break;
    }
  };

  const handleModalSubmit = (value: string) => {
    if (actionModal.type === "create_file") createFile(value);
    else if (actionModal.type === "create_dir") createDirectory(value);
    else if (actionModal.type === "rename" && actionModal.targetPath) renameFile(actionModal.targetPath, value);
  };

  const handleDestructiveSubmit = (type: 'physical_delete' | 'mode_remove') => {
    if (type === 'mode_remove') {
      const paths = pendingDeletePaths;
      if (actionModal.mode === 'favorites') toggleFavorite(paths, 0);
      else if (actionModal.mode === 'recent') removeFromHistory(paths);
      else if (actionModal.mode === 'shares') {
        const selectedIdsArray = Array.from(selectedIds);
        if (selectedIdsArray.length > 0) { for (const id of selectedIdsArray) cancelShare(id); } 
        else { const file = files.find(f => paths.includes(f.path)); if (file?.id) cancelShare(file.id); }
      }
      deselectAll();
    } else {
      deleteFiles(pendingDeletePaths);
    }
  };

  const openArchiveOperationModal = (mode: 'compress' | 'decompress', paths: string[]) => {
    setArchiveOpModal({ isOpen: true, mode, paths, defaultTargetPath: currentPath, defaultArchiveName: mode === 'compress' ? (paths.length === 1 ? paths[0].split('/').pop()?.replace(/\.[^.]+$/, '') || 'archive' : 'archive') : 'archive' });
  };

  const handleArchiveOperationSubmit = async (payload: ArchiveOperationSubmitPayload) => {
    const isBatch = payload.paths.length > 1;
    
    // 构造强类型 Body / Construct strongly typed Body
    const body: Record<string, unknown> = payload.mode === 'decompress' 
      ? { 
          paths: payload.paths, 
          archive_path: payload.paths[0], 
          target_path: payload.targetPath, 
          overwrite: payload.overwrite, 
          password: payload.password, 
          delete_archive: payload.deleteArchive 
        } 
      : { 
          paths: payload.paths, 
          source_path: payload.paths[0], 
          format: payload.format, 
          level: payload.level, 
          password: payload.password, 
          encrypt_filenames: payload.encryptFilenames, 
          delete_source: payload.deleteSource, 
          target_name: payload.targetName 
        };

    if (!isBatch) { 
      delete body.paths; 
    } else { 
      delete body.archive_path; 
      delete body.source_path; 
    }

    try {
      let response: { data?: unknown; error?: unknown };
      if (payload.mode === 'decompress') {
        if (isBatch) {
          response = await client.POST('/api/v1/file/batch-decompress', { 
            body: body as components["schemas"]["BatchDecompressRequest"] 
          });
        } else {
          response = await client.POST('/api/v1/file/decompress', { 
            body: body as components["schemas"]["DecompressRequest"] 
          });
        }
      } else {
        if (isBatch) {
          response = await client.POST('/api/v1/file/batch-compress', { 
            body: body as components["schemas"]["BatchCompressRequest"] 
          });
        } else {
          response = await client.POST('/api/v1/file/compress', { 
            body: body as components["schemas"]["CompressRequest"] 
          });
        }
      }
      
      const { data, error } = response;
      if (error) {
        const errObj = error as Record<string, unknown>;
        throw new Error((errObj.msg as string) || 'Operation failed');
      }

      // 安全提取 taskId / Safely extract taskId
      const resultData = (data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
      const taskId = resultData?.task_id as string | undefined;
      
      if (!taskId) throw new Error(t('filemanager.archive.taskIdMissing'));
      
      store.addTask({
        id: taskId,
        type: payload.mode,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString()
      });

      const expectedPath = payload.mode === 'compress' 
        ? `${currentPath}/${payload.targetName}.${payload.format}`.replace(/\/+/g, '/')
        : payload.targetPath;
      waitForTask(taskId, [expectedPath]);

      setArchiveOpModal(s => ({ ...s, isOpen: false }));
      addToast(t('filemanager.task.started'), "success");
    } catch (e: unknown) { 
      if (e instanceof Error) throw e;
      throw new Error(String(e));
    }
  };

  const isMinimal = ["favorites", "trash", "recent", "shares"].includes(fmMode);
  const officePath = params.office_path;
  const previewPath = params.preview_path;
  const isOfficePreview = previewPath ? isOfficeExtension(getFileExtension(previewPath)) : false;

  if (officePath) {
    return (
      <OfficeLitePage
        path={officePath}
        onClose={() => {
          const hash = window.location.hash.substring(1);
          const p = new URLSearchParams(hash);
          p.delete('office_path');
          p.delete('office_mode');
          window.location.hash = p.toString();
        }}
      />
    );
  }

  if (previewPath && isOfficePreview) {
    return (
      <OfficeOpenModal
        path={previewPath}
        onClose={() => {
          const hash = window.location.hash.substring(1);
          const p = new URLSearchParams(hash);
          p.delete('preview_path');
          window.location.hash = p.toString();
        }}
      />
    );
  }

  // 如果有预览路径，则显示预览页面 / If there's a preview path, show the preview page
  if (previewPath) {
    return (
      <FilePreviewPage 
        path={previewPath} 
        onClose={() => {
          const hash = window.location.hash.substring(1);
          const p = new URLSearchParams(hash);
          p.delete('preview_path');
          window.location.hash = p.toString();
        }} 
      />
    );
  }

  return (
    <div className="flex flex-col bg-background h-screen relative overflow-hidden" onClick={() => setContextMenu(null)}>
      {!isMinimal && <FileManagerTabs />}
      <div className="flex flex-col flex-1 overflow-hidden bg-background px-4">
        <FileManagerToolbar />
        {fmMode === "recent" && <FileManagerRecentStats onClear={() => handleAction("clear_history", null)} />}
        {fmMode === "files" && !isMinimal && <FileManagerNavigationBar />}
        {fmMode === "favorites" && <FileManagerFavoriteFilter />}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          <FileBrowser 
            onAction={handleAction}
            onContextMenu={(e, file) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, target: file }); }} 
          />
          {fmMode !== 'recent' && (
            <Pagination
              current={pagination.currentPage} total={pagination.total} pageSize={pagination.pageSize}
              onPageChange={(page) => loadFiles(undefined, page, pagination.pageSize)}
              onPageSizeChange={(size) => { store.setPageSize(size); loadFiles(undefined, 1, size); }}
              className="border-t bg-background/50 backdrop-blur-md"
            />
          )}
        </div>
        {contextMenu && <FileManagerContextMenu x={contextMenu.x} y={contextMenu.y} target={contextMenu.target} onClose={() => setContextMenu(null)} onAction={handleAction} />}
      </div>

      <FilePropertiesModal file={propertiesFile} onClose={() => setPropertiesFile(null)} />
      <ShareModal isOpen={!!activeShareFile} onClose={() => setActiveShareFile(null)} file={activeShareFile} />
      <FileActionModal onSubmit={handleModalSubmit} />
      <ConfirmDestructiveModal 
        isOpen={actionModal.isOpen && (actionModal.type === 'delete_confirm' || actionModal.type === 'mode_delete_confirm')}
        onClose={closeActionModal}
        onSubmit={handleDestructiveSubmit}
        title={actionModal.title}
        message={actionModal.defaultValue}
        confirmLabel={fmMode === 'files' ? t('filemanager.actions.delete') : t('filemanager.actions.deletePhysical')}
        mode={actionModal.mode}
        isModeSpecific={actionModal.type === 'mode_delete_confirm'}
      />
      <ArchiveOperationModal {...archiveOpModal} onClose={() => setArchiveOpModal(s => ({ ...s, isOpen: false }))} onSubmit={handleArchiveOperationSubmit} />
      {browsingArchivePath && (
        <ArchiveBrowser 
          archivePath={browsingArchivePath} 
          password={archivePassword}
          onClose={() => { setBrowsingArchivePath(null); setArchivePassword(undefined); }} 
        />
      )}
      <GlobalUploader />
      <ClipboardBar />
    </div>
  );
};
