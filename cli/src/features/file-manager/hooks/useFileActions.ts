import { useCallback } from 'react';
import { client, BASE_URL, extractData } from '@/lib/api.ts';
import { useFileStore, type StorageStats, type TaskState, type FileManagerMode } from '../store/useFileStore.ts';
import { useSelectionStore } from '../store/useSelectionStore.ts';
import { useTranslation } from 'react-i18next';
import type { FileInfo, ClipboardItem } from '../types/index.ts';
import { useToastStore } from '@fileuni/shared';

interface TaskData {
  status: TaskState['status'];
  message?: string;
  progress?: number;
  task_id?: string;
}

interface FileListResponse {
  items?: FileInfo[];
  data?: FileInfo[];
  pagination?: {
    total?: number;
    total_pages?: number;
  };
  total?: number;
}

export function useFileActions() {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const store = useFileStore();
  
  const currentPath = store.getCurrentPath();
  const showShareStatus = store.showShareStatus;
  const favoriteFilterColor = store.favoriteFilterColor;
  const fmMode = store.fmMode;
  const sortConfig = store.getSortConfig();
  const isSearchMode = store.getIsSearchMode();
  const searchKeyword = store.getSearchKeyword();
  const pageSize = store.getPageSize();

  const setFiles = store.setFiles;
  const setLoading = store.setLoading;
  const setStorageStats = store.setStorageStats;
  const appendFiles = store.appendFiles;
  const removeFiles = store.removeFiles;
  const updateFile = store.updateFile;
  
  const { deselectAll } = useSelectionStore();

  const loadStorageStats = useCallback(async () => {
    try {
      const stats = await extractData(client.GET("/api/v1/file/storage-stats"));
      setStorageStats(stats as StorageStats);
    } catch (e) {
      console.error('Failed to load storage stats:', e);
    }
  }, [setStorageStats]);

  const loadFiles = useCallback(async (path: string = currentPath, page: number = 1, overridePageSize: number = pageSize, mode?: FileManagerMode) => {
    const activeMode = mode || fmMode;
    
    if (activeMode === 'recent') {
      setFiles([...store.getRecentFiles()]);
      deselectAll();
      return;
    }

    setLoading(true);
    try {
      type FileListEndpoint = 
        | "/api/v1/file/list" 
        | "/api/v1/file/favorites/list" 
        | "/api/v1/file/recycle-bin/list" 
        | "/api/v1/file/shares/my";

      let endpoint: FileListEndpoint = "/api/v1/file/list";
      
      // Query parameters aggregate possible fields from multiple interfaces
      const query: Record<string, string | number | boolean | null | undefined> = { 
        path, 
        page: page, 
        page_size: overridePageSize, 
        check_share: showShareStatus 
      };

      if (sortConfig.field) {
        query.sort_by = sortConfig.field;
        query.order = sortConfig.order;
      }

      if (isSearchMode && searchKeyword) {
        query.keyword = searchKeyword;
      }

      if (activeMode === 'favorites') {
        endpoint = "/api/v1/file/favorites/list";
        if (favoriteFilterColor !== null) query.color = favoriteFilterColor ?? null;
      } else if (activeMode === 'trash') {
        endpoint = "/api/v1/file/recycle-bin/list";
        delete query.path;
      } else if (activeMode === 'shares') {
        endpoint = "/api/v1/file/shares/my";
        delete query.path;
        const shareFilter = store.getShareFilter();
        if (shareFilter.hasPassword !== null) query.has_password = shareFilter.hasPassword ?? null;
        if (shareFilter.enableDirect !== null) query.enable_direct = shareFilter.enableDirect ?? null;
      }

      const result = await extractData<FileInfo[] | FileListResponse>(
        client.GET(endpoint, {
          params: { query: query as unknown as never }
        })
      );

      let filesArray: FileInfo[] = [];
      
      // Intelligently extract files array
      if (Array.isArray(result)) {
        filesArray = result;
        store.setPagination(filesArray.length, 1, 1, overridePageSize);
      } else if (result && typeof result === 'object') {
        // Compatible with items or data wrapped structures
        filesArray = (result.items || result.data || []) as FileInfo[];
        
        if (result.pagination) {
          const p = result.pagination;
          store.setPagination(p.total || 0, p.total_pages || 1, page, overridePageSize);
        } else if (result.total !== undefined) {
          const total = Number(result.total) || 0;
          const totalPages = Math.ceil(total / overridePageSize);
          store.setPagination(total, totalPages || 1, page, overridePageSize);
        } else {
          store.setPagination(filesArray.length, 1, 1, overridePageSize);
        }
      }
      
      setFiles(filesArray);
      deselectAll();
    } catch (e) {
      console.error('Failed to load files:', e);
    } finally {
      setLoading(false);
    }
  }, [
    currentPath, setFiles, setLoading, deselectAll, showShareStatus, fmMode, 
    favoriteFilterColor, sortConfig.field, sortConfig.order, isSearchMode, 
    searchKeyword, pageSize, store.setPagination, store.getShareFilter
  ]);

  const toggleFavorite = async (paths: string[], color: number) => {
    try {
      for (const path of paths) {
        const { data } = await client.POST("/api/v1/file/favorites/set-color", {
          body: { path, color }
        });
        if (data?.success) {
          updateFile(path, { favorite_color: color });
          
          // If in favorites mode and unfavoriting, remove item after animation
          if (fmMode === 'favorites' && color === 0) {
            setTimeout(() => {
              removeFiles([path]);
            }, 600); // Wait for animation
          }
        }
      }
      addToast(color > 0 ? t('filemanager.messages.favoriteAdded') : t('filemanager.messages.favoriteRemoved'), "success");
    } catch (e) { console.error(e); }
  };

  const searchFiles = useCallback(async (keyword: string) => {
    store.setSearchKeyword(keyword.trim());
    store.setIsSearchMode(!!keyword.trim());
  }, [store]);

  const clearHistory = useCallback(() => {
    if (confirm(t('filemanager.messages.confirmClearHistory') || "Clear all browsing history?")) {
      store.clearRecentFiles();
      if (fmMode === 'recent') setFiles([]);
    }
  }, [store, fmMode, setFiles, t]);

  const removeFromHistory = useCallback((paths: string[]) => {
    store.removeFromRecent(paths);
    if (fmMode === 'recent') {
      const recent = store.getRecentFiles();
      setFiles(recent.filter(f => !paths.includes(f.path)));
    }
  }, [store, fmMode, setFiles]);

  const waitForTask = async (taskId: string, expectedPaths?: string[]) => {
    const poll = async () => {
      try {
        const task = await extractData<TaskData>(client.GET("/api/v1/file/task/{id}", {
          params: { path: { id: taskId } }
        }));

        if (task.status === 'success') {
          await loadFiles();
          if (expectedPaths && expectedPaths.length > 0) {
            // Give some time for list to load
            setTimeout(() => {
              store.setHighlightedPath(expectedPaths[0]);
            }, 100);
          }
          return true;
        } else if (task.status === 'failed' || task.status === 'interrupted') {
          addToast(`Task failed: ${task.message || 'Unknown error'}`, "error");
          loadFiles();
          return true;
        }
        return false;
      } catch (e) {
        console.error("Polling error:", e);
        return true; 
      }
    };

    const interval = setInterval(async () => {
      if (await poll()) {
        clearInterval(interval);
      }
    }, 2000);
  };

  /**
   * 辅助函数：从 API 响应中提取 Task ID / Helper: Extract Task ID from API response
   */
  const extractTaskId = (data: unknown): string | undefined => {
    if (!data) return undefined;
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      const obj = data as TaskData;
      return obj.task_id;
    }
    return undefined;
  };

  const deleteFiles = async (paths: string[], skipConfirm: boolean = false) => {
    if (paths.length === 0 || !paths[0]) return;
    if (!skipConfirm && !confirm(t('filemanager.messages.confirmDelete', { count: paths.length }))) return;

    try {
      if (paths.length === 1) {
        const { data } = await client.DELETE("/api/v1/file/delete", {
          body: { path: paths[0] }
        });
        if (data?.success) {
          removeFiles(paths);
          loadStorageStats();
        }
      } else {
        const { data } = await client.POST("/api/v1/file/batch-delete", {
          body: { paths }
        });
        if (data?.success) {
          const taskId = extractTaskId(data.data);
          if (taskId) {
            store.addTask({
              id: taskId,
              type: 'batch_delete',
              status: 'pending',
              progress: 0,
              createdAt: new Date().toISOString()
            });
            waitForTask(taskId);
          } else {
            removeFiles(paths);
            loadStorageStats();
          }
        }
      }
    } catch (e) { /* handled */ }
  };

  const batchMove = async (paths: string[], targetDir: string) => {
    try {
      const { data } = await client.POST("/api/v1/file/batch-move", {
        body: { paths, target_path: targetDir }
      });
      const expectedPaths = paths.map(p => `${targetDir}/${p.split('/').pop()}`.replace(/\/+/g, '/'));
      if (data?.success) {
        const taskId = extractTaskId(data.data);
        if (taskId) {
          store.addTask({
            id: taskId,
            type: 'batch_move',
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString()
          });
          waitForTask(taskId, expectedPaths);
        } else {
          removeFiles(paths);
          // If target is current directory, refresh
          if (targetDir === currentPath) await loadFiles();
          if (expectedPaths.length > 0) store.setHighlightedPath(expectedPaths[0]);
        }
      }
    } catch (e) { /* handled */ }
  };

  const batchCopy = async (paths: string[], targetDir: string) => {
    try {
      const { data } = await client.POST("/api/v1/file/batch-copy", {
        body: { paths, target_path: targetDir }
      });
      const expectedPaths = paths.map(p => `${targetDir}/${p.split('/').pop()}`.replace(/\/+/g, '/'));
      if (data?.success) {
        const taskId = extractTaskId(data.data);
        if (taskId) {
          store.addTask({
            id: taskId,
            type: 'batch_copy',
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString()
          });
          waitForTask(taskId, expectedPaths);
        } else {
          await loadFiles();
          if (expectedPaths.length > 0) store.setHighlightedPath(expectedPaths[0]);
        }
      }
    } catch (e) { /* handled */ }
  };

  const batchCompress = async (paths: string[], targetName: string) => {
    try {
      const { data } = await client.POST("/api/v1/file/batch-compress", {
        body: { paths, format: 'zip', target_name: targetName }
      });
      const expectedPath = `${currentPath}/${targetName}`.replace(/\/+/g, '/');
      if (data?.success) {
        const taskId = extractTaskId(data.data);
        if (taskId) {
          store.addTask({
            id: taskId,
            type: 'compress',
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString()
          });
          waitForTask(taskId, [expectedPath]);
        } else {
          await loadFiles();
          store.setHighlightedPath(expectedPath);
        }
      }
    } catch (e) { /* handled */ }
  };

  const renameFile = async (oldPath: string, newName: string) => {
    try {
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      const { data, error } = await client.POST("/api/v1/file/rename", {
        body: { old_path: oldPath, new_path: newPath }
      });
      if (error) throw error;
      if (data?.success) {
        updateFile(oldPath, { name: newName, path: newPath });
        // Ensure it's highlighted after rename
        store.setHighlightedPath(newPath);
      }
    } catch (e) {
      console.error('Rename failed:', e);
    }
  };

  const downloadFile = async (path: string) => {
    try {
      const file = store.files.find(f => f.path === path);
      if (file) store.addToRecentFiles(file);

      const { data } = await client.GET('/api/v1/file/get-file-download-token', {
        params: { query: { path } }
      });

      if (data?.data?.token) {
        const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}`;
        
        // Create hidden link and trigger download, more reliable than window.open
        const link = document.createElement('a');
        link.href = url;
        const fileName = path.split('/').pop() || 'file';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error("Failed to get download token");
      }
    } catch (e) {
      console.error('Download failed:', e);
      addToast(t('common.error') || "Download failed", "error");
    }
  };

  const previewFile = (path: string) => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    params.set('preview_path', path);
    window.location.hash = params.toString();
  };

  const restoreFiles = async (paths: string[]) => {
    try {
      await client.POST("/api/v1/file/recycle-bin/restore", { body: { paths } });
      removeFiles(paths);
      deselectAll();
    } catch (e) { /* handled */ }
  };

  const deletePermanent = async (paths: string[]) => {
    if (!confirm(t('filemanager.messages.confirmDeletePermanent', { count: paths.length }) || `Permanently delete ${paths.length} items?`)) return;
    try {
      await client.POST("/api/v1/file/recycle-bin/delete-permanent", { body: { paths } });
      removeFiles(paths);
      deselectAll();
    } catch (e) { /* handled */ }
  };

  const clearRecycleBin = async () => {
    if (!confirm(t('filemanager.messages.confirmClearTrash') || "Clear recycle bin?")) return;
    try {
      await client.POST("/api/v1/file/recycle-bin/clear-all", {});
      loadFiles();
      loadStorageStats();
    } catch (e) { /* handled */ }
  };

  const clearAllShares = async () => {
    if (!confirm(t('filemanager.messages.confirmClearShares') || "Are you sure you want to cancel all your shares?")) return;
    try {
      const { data } = await client.POST("/api/v1/file/shares/clear-all", {});
      if (data?.success) {
        setFiles([]);
        addToast(t('filemanager.messages.deleted'), "success");
      }
    } catch (e) { console.error(e); }
  };

  const clearAllFavorites = async () => {
    if (!confirm(t('filemanager.messages.confirmClearFavorites') || "Are you sure you want to remove all favorites?")) return;
    try {
      const { data } = await client.POST("/api/v1/file/favorites/clear-all", {});
      if (data?.success) {
        setFiles([]);
        addToast(t('filemanager.messages.favoriteRemoved'), "success");
      }
    } catch (e) { console.error(e); }
  };

  const clearThumbnailCache = async (path?: string) => {
    const confirmKey = path ? 'filemanager.thumbnail.confirmClearDir' : 'filemanager.thumbnail.confirmClearAll';
    const defaultMsg = path ? 'Clear thumbnails in this folder?' : 'Clear all thumbnails?';
    if (!confirm(t(confirmKey) || defaultMsg)) return;
    try {
      const body = path ? { path } : {};
      const { data } = await client.POST("/api/v1/file/thumbnail/clear", { body });
      if (data?.success) {
        addToast(t('filemanager.thumbnail.cleared') || 'Thumbnail cache cleared', "success");
      }
    } catch (e) { console.error(e); }
  };

  const clearThumbnailCacheAllUsers = async () => {
    if (!confirm(t('filemanager.thumbnail.confirmClearAllUsers') || 'Clear all users thumbnail cache?')) return;
    try {
      const { data } = await client.POST("/api/v1/file/admin/thumbnail/clear-all", {});
      if (data?.success) {
        addToast(t('filemanager.thumbnail.cleared') || 'Thumbnail cache cleared', "success");
      }
    } catch (e) { console.error(e); }
  };

  const setThumbnailDisabled = async (path: string, disabled: boolean) => {
    const confirmKey = disabled ? 'filemanager.thumbnail.confirmDisable' : 'filemanager.thumbnail.confirmEnable';
    const defaultMsg = disabled ? 'Disable thumbnails in this folder?' : 'Enable thumbnails in this folder?';
    if (!confirm(t(confirmKey) || defaultMsg)) return;
    try {
      const { data } = await client.POST("/api/v1/file/thumbnail/disable", { body: { path, disabled } });
      if (data?.success) {
        addToast(disabled ? (t('filemanager.thumbnail.disabled') || 'Thumbnails disabled') : (t('filemanager.thumbnail.enabled') || 'Thumbnails enabled'), "success");
      }
    } catch (e) { console.error(e); }
  };

  const decompressFile = async (path: string, targetPath?: string) => {
    try {
      const file = store.files.find(f => f.path === path);
      if (file) store.addToRecentFiles(file);
      const { data } = await client.POST("/api/v1/file/decompress", { 
        body: { archive_path: path, target_path: targetPath || currentPath } 
      });
      if (data?.success) {
        const taskId = extractTaskId(data.data);
        if (taskId) {
          store.addTask({
            id: taskId,
            type: 'decompress',
            status: 'pending',
            progress: 0,
            createdAt: new Date().toISOString()
          });
          waitForTask(taskId);
        } else {
          loadFiles();
        }
      }
    } catch (e) { /* handled */ }
  };

  const forceSyncIndex = async (path: string = currentPath) => {
    setLoading(true);
    try {
      const data = await extractData<FileInfo[]>(client.POST("/api/v1/file/sync-index", {
        body: { path }
      }));
      setFiles(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const createDirectory = async (name: string) => {
    if (!name) return;
    try {
      const newItem = await extractData<FileInfo>(client.POST("/api/v1/file/create-dir", {
        body: { path: `${currentPath}/${name}`.replace(/\/+/g, '/') }
      }));
      appendFiles([newItem]);
      store.setHighlightedPath(newItem.path);
      loadStorageStats();
    } catch (e) { loadFiles(); }
  };

  const createFile = async (name: string) => {
    if (!name) return;
    try {
      const newItem = await extractData<FileInfo>(client.POST("/api/v1/file/create", {
        body: { path: `${currentPath}/${name}`.replace(/\/+/g, '/'), content: '' }
      }));
      appendFiles([newItem]);
      store.setHighlightedPath(newItem.path);
      loadStorageStats();
    } catch (e) { loadFiles(); }
  };

  const cancelShare = async (shareId: string) => {
    if (!shareId) return;
    try {
      const { data } = await client.DELETE("/api/v1/file/shares/{id}", {
        params: { path: { id: shareId } }
      });
      if (data?.success) {
        store.setFiles(store.files.filter(f => f.id !== shareId));
        addToast(t('filemanager.messages.deleted'), "success");
      }
    } catch (e) {
      console.error('Failed to cancel share:', e);
    }
  };

  const pasteItems = async (items: ClipboardItem[], targetPath: string) => {
    if (items.length === 0) return;
    
    const copyPaths = items.filter(i => i.type === 'copy').map(i => i.path);
    const movePaths = items.filter(i => i.type === 'cut').map(i => i.path);

    if (copyPaths.length > 0) {
      await batchCopy(copyPaths, targetPath);
    }

    if (movePaths.length > 0) {
      await batchMove(movePaths, targetPath);
      movePaths.forEach(p => store.removeFromClipboard(p));
    }
  };

  const pasteSingleItem = async (item: ClipboardItem, targetPath: string, overrideType?: 'copy' | 'cut') => {
    const actionType = overrideType || item.type;
    if (actionType === 'copy') {
      await batchCopy([item.path], targetPath);
    } else {
      await batchMove([item.path], targetPath);
      store.removeFromClipboard(item.path);
    }
  };

  return { 
    loadFiles, loadStorageStats, deleteFiles, renameFile, downloadFile, previewFile, searchFiles, 
    batchMove, batchCopy, batchCompress,
    restoreFiles, deletePermanent, clearRecycleBin, clearAllShares, clearAllFavorites,
    clearThumbnailCache, clearThumbnailCacheAllUsers, setThumbnailDisabled,
    decompressFile, toggleFavorite,
    createDirectory, createFile, forceSyncIndex,
    clearHistory, removeFromHistory,
    cancelShare, pasteItems, pasteSingleItem, waitForTask
  };
}
