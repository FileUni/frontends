import { create } from 'zustand';

export interface UploadTask {
  id: string;
  file: File;
  targetPath: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMsg?: string;
}

interface UploadState {
  tasks: UploadTask[];
  isMinimized: boolean;
  isUploading: boolean;
  
  addTasks: (files: FileList | File[], targetPath: string) => void;
  updateTask: (id: string, updates: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  reorderTasks: (oldIndex: number, newIndex: number) => void;
  setMinimized: (minimized: boolean) => void;
  clearCompleted: () => void;
  setUploading: (uploading: boolean) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  tasks: [],
  isMinimized: false,
  isUploading: false,

  addTasks: (files, targetPath) => {
    const newTasks: UploadTask[] = Array.from(files).map(file => {
      // Preserve directory structure if available (from webkitdirectory or drag-and-drop)
      let finalPath = targetPath;
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      
      if (relativePath) {
        // Extract the directory part from relativePath and append to targetPath
        const parts = relativePath.split('/');
        parts.pop(); // Remove the filename
        if (parts.length > 0) {
          const subDir = parts.join('/');
          finalPath = `${targetPath}/${subDir}`.replace(/\/+/g, '/');
        }
      }

      return {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        file,
        targetPath: finalPath,
        progress: 0,
        status: 'pending'
      };
    });
    set(state => ({ tasks: [...state.tasks, ...newTasks], isMinimized: false }));
  },

  updateTask: (id, updates) => set(state => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  removeTask: (id) => set(state => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),

  reorderTasks: (oldIndex, newIndex) => set(state => {
    const newTasks = [...state.tasks];
    const [removed] = newTasks.splice(oldIndex, 1);
    newTasks.splice(newIndex, 0, removed);
    return { tasks: newTasks };
  }),

  setMinimized: (isMinimized) => set({ isMinimized }),
  
  clearCompleted: () => set(state => ({
    tasks: state.tasks.filter(t => t.status !== 'completed')
  })),

  setUploading: (isUploading) => set({ isUploading }),
}));
