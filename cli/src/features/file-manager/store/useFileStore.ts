import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FileInfo, ViewMode, FileManagerMode, ClipboardItem } from '../types/index.ts';
import { useAuthStore } from '@/stores/auth.ts';
import { storageHub } from '@fileuni/shared';

export type { FileManagerMode };
export type FMMode = FileManagerMode;

export interface StorageStats {
  used: number;
  quota: number;
}

export interface Tab {
  id: string;
  path: string;
  title: string;
}

export interface TaskState {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'interrupted';
  progress: number;
  message?: string;
  createdAt: string;
}

// Data bucket for each user
interface UserFileData {
  currentPath: string;
  clipboard: ClipboardItem[];
  tabs: Tab[];
  activeTabId: string;
  recentFiles: FileInfo[];
  viewMode: ViewMode;
  sortConfig: { field: string; order: 'asc' | 'desc' }; // Sort configuration
  searchKeyword: string; // Search keyword
  isSearchMode: boolean; // Whether in search mode
  shareFilter: { hasPassword: boolean | null; enableDirect: boolean | null }; // Share filter
  pageSize: number;
  activeTasks: TaskState[]; // Active task queue
}

interface FileState {
  // Global runtime states
  files: FileInfo[];
  loading: boolean;
  fmMode: FileManagerMode;
  storageStats: StorageStats | null;
  showShareStatus: boolean;
  favoriteFilterColor: number | null;
  highlightedPath: string | null;

  // Pagination info
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };

  // User specific persisted data
  userStates: Record<string, UserFileData>;

  // Internal helpers
  _getUid: () => string;
  _ensureUser: (uid: string) => void;

  // Public getters
  getCurrentPath: () => string;
  getClipboard: () => ClipboardItem[];
  getTabs: () => Tab[];
  getActiveTabId: () => string;
  getRecentFiles: () => FileInfo[];
  getViewMode: () => ViewMode;
  getSortConfig: () => { field: string; order: 'asc' | 'desc' };
  getSearchKeyword: () => string;
  getIsSearchMode: () => boolean;
  getShareFilter: () => { hasPassword: boolean | null; enableDirect: boolean | null };
  getPageSize: () => number;
  getPagination: () => { total: number; totalPages: number; currentPage: number; pageSize: number };

  // Actions
  setCurrentPath: (path: string) => void;
  addToRecentFiles: (file: FileInfo) => void;
  clearRecentFiles: () => void;
  removeFromRecent: (paths: string[]) => void;
  setFiles: (files: FileInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setFmMode: (mode: FileManagerMode) => void;
  setStorageStats: (stats: StorageStats | null) => void;
  setShowShareStatus: (show: boolean) => void;
  setFavoriteFilterColor: (color: number | null) => void;
  setHighlightedPath: (path: string | null) => void;
  setPageSize: (size: number) => void;
  
  // Sorting and searching related
  setSortConfig: (config: { field: string; order: 'asc' | 'desc' }) => void;
  setSearchKeyword: (keyword: string) => void;
  setIsSearchMode: (isSearchMode: boolean) => void;
  setShareFilter: (filter: Partial<{ hasPassword: boolean | null; enableDirect: boolean | null }>) => void;
  setPagination: (total: number, totalPages: number, currentPage: number, pageSize: number) => void;

  // Tab/Selection Actions
  addTab: (path: string, title?: string) => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
  setTabs: (tabs: Tab[]) => void;
  closeOtherTabs: (id: string) => void;
  closeLeftTabs: (id: string) => void;
  closeRightTabs: (id: string) => void;
  
  // Clipboard Actions
  addToClipboard: (newItems: ClipboardItem[]) => void;
  clearClipboard: () => void;
  removeFromClipboard: (path: string) => void;
  reorderClipboard: (oldIndex: number, newIndex: number) => void;

  // Task Actions
  addTask: (task: TaskState) => void;
  updateTask: (id: string, updates: Partial<TaskState>) => void;
  removeTask: (id: string) => void;
  clearFinishedTasks: () => void;
  getActiveTasks: () => TaskState[];

  // Optimistic Updates
  appendFiles: (newFiles: FileInfo[]) => void;
  updateFile: (path: string, updates: Partial<FileInfo>) => void;
  removeFiles: (paths: string[]) => void;

  // Action Modal
  actionModal: { 
    isOpen: boolean; 
    type: 'create_file' | 'create_dir' | 'rename' | 'delete_confirm' | 'mode_delete_confirm'; 
    title: string;
    defaultValue: string;
    targetPath?: string;
    mode?: FileManagerMode;
  };
  openActionModal: (type: 'create_file' | 'create_dir' | 'rename' | 'delete_confirm' | 'mode_delete_confirm', title: string, defaultValue: string, targetPath?: string, mode?: FileManagerMode) => void;
  closeActionModal: () => void;
}

const DEFAULT_TAB_ID = 'default';

const getInitialUserData = (): UserFileData => ({
  currentPath: '/',
  clipboard: [],
  tabs: [{ id: DEFAULT_TAB_ID, path: '/', title: 'Home' }],
  activeTabId: DEFAULT_TAB_ID,
  recentFiles: [],
  viewMode: 'grid',
  sortConfig: { field: 'name', order: 'asc' },
  searchKeyword: '',
  isSearchMode: false,
  shareFilter: { hasPassword: null, enableDirect: null },
  pageSize: 20,
  activeTasks: []
});

export const useFileStore = create<FileState>()(
  persist(
    (set, get) => ({
      files: [],
      loading: false,
      fmMode: 'files',
      storageStats: null,
      showShareStatus: false,
      favoriteFilterColor: null,
      highlightedPath: null,
      pagination: { total: 0, totalPages: 1, currentPage: 1, pageSize: 20 },
      userStates: {},

      _getUid: () => useAuthStore.getState().currentUserId || 'guest',

      _ensureUser: (uid) => {
        if (!get().userStates[uid]) {
          set(state => ({
            userStates: { ...state.userStates, [uid]: getInitialUserData() }
          }));
        }
      },

      getCurrentPath: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.currentPath || '/';
      },

      getClipboard: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.clipboard || [];
      },

      getTabs: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.tabs || [{ id: DEFAULT_TAB_ID, path: '/', title: 'Home' }];
      },

      getActiveTabId: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.activeTabId || DEFAULT_TAB_ID;
      },

      getRecentFiles: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.recentFiles || [];
      },

      getViewMode: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.viewMode || 'grid';
      },

      getSortConfig: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.sortConfig || { field: 'name', order: 'asc' };
      },

      getSearchKeyword: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.searchKeyword || '';
      },

      getIsSearchMode: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.isSearchMode || false;
      },

      getShareFilter: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.shareFilter || { hasPassword: null, enableDirect: null };
      },

      getPageSize: () => {
        const uid = get()._getUid();
        return get().userStates[uid]?.pageSize || 20;
      },

      getPagination: () => {
        return get().pagination;
      },

      actionModal: { isOpen: false, type: 'create_file', title: '', defaultValue: '' },
      openActionModal: (type, title, defaultValue, targetPath, mode) => set({ 
        actionModal: { isOpen: true, type, title, defaultValue, targetPath, mode } 
      }),
      closeActionModal: () => set((state) => ({ 
        actionModal: { ...state.actionModal, isOpen: false } 
      })),

      setCurrentPath: (path) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        
        const normalizedPath = path.replace(/\/+/g, '/').replace(/(.+)\/$/, '$1') || '/';
        if (normalizedPath === userData.currentPath) return;

        const updatedTabs = userData.tabs.map(tab => 
          tab.id === userData.activeTabId 
            ? { ...tab, path: normalizedPath, title: normalizedPath === '/' ? 'Home' : normalizedPath.split('/').pop() || 'Folder' } 
            : tab
        );

        // Record directory access to recent files
        const currentDirInfo = get().files.find(f => f.path === normalizedPath) || {
          name: normalizedPath.split('/').pop() || 'Root',
          path: normalizedPath,
          is_dir: true,
          size: 0,
          modified: new Date().toISOString(),
          favorite_color: 0
        };
        
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, currentPath: normalizedPath, tabs: updatedTabs } as UserFileData
          }
        }));

        if (normalizedPath !== '/') {
          get().addToRecentFiles(currentDirInfo as FileInfo);
        }
      },

      addToRecentFiles: (file) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];

        const existing = userData.recentFiles || [];
        const record = { ...file, accessed_at: new Date().toISOString() };
        let merged = [record, ...existing.filter(f => f.path !== file.path)];
        if (merged.length > 100) merged = merged.slice(0, 100);

        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, recentFiles: merged } as UserFileData
          }
        }));
      },

      clearRecentFiles: () => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, recentFiles: [] } as UserFileData
          }
        }));
      },

      removeFromRecent: (paths) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const pathSet = new Set(paths);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, recentFiles: (userData.recentFiles || []).filter(f => !pathSet.has(f.path)) } as UserFileData
          }
        }));
      },

      setFiles: (files) => set({ files }),
      setLoading: (loading) => set({ loading }),
      
      setViewMode: (mode) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, viewMode: mode } as UserFileData
          }
        }));
      },

      setFmMode: (mode) => set({ 
        fmMode: mode,
        files: [],
        favoriteFilterColor: null,
        pagination: { total: 0, totalPages: 1, currentPage: 1, pageSize: get().getPageSize() }
      }),

      setStorageStats: (storageStats) => set({ storageStats }),
      setShowShareStatus: (showShareStatus) => set({ showShareStatus }),
      setFavoriteFilterColor: (favoriteFilterColor) => set({ favoriteFilterColor }),
      setHighlightedPath: (highlightedPath) => set({ highlightedPath }),
      
      setPageSize: (pageSize) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, pageSize } as UserFileData
          }
        }));
      },

      setPagination: (total, totalPages, currentPage, pageSize) => set({ pagination: { total, totalPages, currentPage, pageSize } }),

      setSortConfig: (config) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, sortConfig: config } as UserFileData
          }
        }));
      },

      setSearchKeyword: (keyword) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, searchKeyword: keyword } as UserFileData
          }
        }));
      },

      setIsSearchMode: (isSearchMode) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, isSearchMode } as UserFileData
          }
        }));
      },

      setShareFilter: (filter) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { 
              ...userData, 
              shareFilter: { ...userData.shareFilter, ...filter } 
            } as UserFileData
          }
        }));
      },

      appendFiles: (newFiles) => set((state) => {
        const existingPaths = new Set(state.files.map(f => f.path));
        const filtered = newFiles.filter(f => !existingPaths.has(f.path));
        return { files: [...state.files, ...filtered] };
      }),
      updateFile: (path, updates) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, ...updates } : f)
      })),
      removeFiles: (paths) => set((state) => {
        const pathSet = new Set(paths);
        return { files: state.files.filter(f => !pathSet.has(f.path)) };
      }),

      addTab: (path, title) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const id = Math.random().toString(36).substring(2, 9);
        const newTab = { id, path, title: title || (path === '/' ? 'Home' : path.split('/').pop() || 'Folder') };
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, tabs: [...userData.tabs, newTab], activeTabId: id, currentPath: path } as UserFileData
          }
        }));
      },

      removeTab: (id) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        if (userData.tabs.length <= 1) return;
        const newTabs = userData.tabs.filter(t => t.id !== id);
        let newActiveId = userData.activeTabId;
        let newPath = userData.currentPath;
        if (userData.activeTabId === id) {
          const lastTab = newTabs[newTabs.length - 1];
          if (lastTab) { newActiveId = lastTab.id; newPath = lastTab.path; }
        }
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, tabs: newTabs, activeTabId: newActiveId, currentPath: newPath } as UserFileData
          }
        }));
      },

      setActiveTabId: (id) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const tab = userData.tabs.find(t => t.id === id);
        if (tab) {
          set(state => ({
            userStates: {
              ...state.userStates,
              [uid]: { ...userData, activeTabId: id, currentPath: tab.path } as UserFileData
            }
          }));
        }
      },

      setTabs: (newTabs) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, tabs: newTabs } as UserFileData
          }
        }));
      },

      closeOtherTabs: (id) => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        const tab = userData.tabs.find(t => t.id === id);
        if (!tab) return;
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, tabs: [tab], activeTabId: id, currentPath: tab.path } as UserFileData
          }
        }));
      },

      closeLeftTabs: (id) => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        const idx = userData.tabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        const newTabs = userData.tabs.slice(idx);
        const stillHasActive = newTabs.some(t => t.id === userData.activeTabId);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { 
              ...userData, 
              tabs: newTabs, 
              activeTabId: stillHasActive ? userData.activeTabId : id,
              currentPath: stillHasActive ? userData.currentPath : userData.tabs[idx].path
            } as UserFileData
          }
        }));
      },

      closeRightTabs: (id) => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        const idx = userData.tabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        const newTabs = userData.tabs.slice(0, idx + 1);
        const stillHasActive = newTabs.some(t => t.id === userData.activeTabId);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { 
              ...userData, 
              tabs: newTabs, 
              activeTabId: stillHasActive ? userData.activeTabId : id,
              currentPath: stillHasActive ? userData.currentPath : userData.tabs[idx].path
            } as UserFileData
          }
        }));
      },
      
      // Clipboard Actions
      addToClipboard: (newItems) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const existingPaths = new Set(userData.clipboard.map(i => i.path));
        let merged = [...userData.clipboard, ...newItems.filter(i => !existingPaths.has(i.path))];
        if (merged.length > 100) merged = merged.slice(-100);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, clipboard: merged } as UserFileData
          }
        }));
      },

      clearClipboard: () => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...state.userStates[uid], clipboard: [] } as UserFileData
          }
        }));
      },

      removeFromClipboard: (path) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { 
              ...state.userStates[uid], 
              clipboard: state.userStates[uid].clipboard.filter(i => i.path !== path) 
            } as UserFileData
          }
        }));
      },

      reorderClipboard: (oldIndex, newIndex) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const newClipboard = [...userData.clipboard];
        const [movedItem] = newClipboard.splice(oldIndex, 1);
        if (movedItem) newClipboard.splice(newIndex, 0, movedItem);
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: { ...userData, clipboard: newClipboard } as UserFileData
          }
        }));
      },

      addTask: (task) => {
        const uid = get()._getUid();
        get()._ensureUser(uid);
        const userData = get().userStates[uid];
        const tasks = userData.activeTasks || [];
        const updatedUser: UserFileData = { ...userData, activeTasks: [task, ...tasks] };
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: updatedUser
          }
        }));
      },

      updateTask: (id, updates) => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        if (!userData) return;
        const tasks = userData.activeTasks || [];
        const updatedUser: UserFileData = { 
          ...userData, 
          activeTasks: tasks.map(t => t.id === id ? { ...t, ...updates } : t)
        };
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: updatedUser
          }
        }));
      },

      removeTask: (id) => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        if (!userData) return;
        const tasks = userData.activeTasks || [];
        const updatedUser: UserFileData = { 
          ...userData, 
          activeTasks: tasks.filter(t => t.id !== id)
        };
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: updatedUser
          }
        }));
      },

      clearFinishedTasks: () => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        if (!userData) return;
        const tasks = userData.activeTasks || [];
        const updatedUser: UserFileData = { 
          ...userData, 
          activeTasks: tasks.filter(t => t.status === 'running' || t.status === 'pending')
        };
        set(state => ({
          userStates: {
            ...state.userStates,
            [uid]: updatedUser
          }
        }));
      },

      getActiveTasks: () => {
        const uid = get()._getUid();
        const userData = get().userStates[uid];
        return userData?.activeTasks || [];
      },
    }),
    {
      name: 'fileuni-file-manager-v5',
      storage: createJSONStorage(() => storageHub.createZustandStorage()),
      partialize: (state) => ({ 
        showShareStatus: state.showShareStatus,
        userStates: state.userStates 
      }),
    }
  )
);
