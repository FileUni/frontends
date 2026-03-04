import { useCallback, useRef } from 'react';
import { useUploadStore, type UploadTask } from '../store/useUploadStore.ts';
import { useAuthStore } from '@/stores/auth.ts';
import { useFileStore } from '../store/useFileStore.ts';
import { useFileActions } from './useFileActions.ts';
import { BASE_URL } from '@/lib/api.ts';
import type { FileInfo } from '../types/index.ts';

export function useUploadActions() {
  const { updateTask, setUploading } = useUploadStore();
  const { appendFiles } = useFileStore();
  const { loadStorageStats } = useFileActions();
  const { currentUserData } = useAuthStore();
  
  // Track active XHR objects for potential cancellation (not yet exposed in UI)
  const activeRequests = useRef<Record<string, XMLHttpRequest>>({});

  const uploadFile = useCallback(async (task: UploadTask) => {
    if (task.status !== 'pending') return;

    updateTask(task.id, { status: 'uploading', progress: 0 });
    setUploading(true);

    const fullPath = (task.targetPath === '/' ? '' : task.targetPath) + '/' + task.file.name;
    const url = `${BASE_URL}/api/v1/file/upload-raw?path=${encodeURIComponent(fullPath)}`;

    const xhr = new XMLHttpRequest();
    activeRequests.current[task.id] = xhr;

    xhr.open('POST', url, true);
    
    // Set authorization header
    if (currentUserData?.access_token) {
      xhr.setRequestHeader('Authorization', `Bearer ${currentUserData.access_token}`);
    }

    // Listen for progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        updateTask(task.id, { progress: percent });
      }
    };

    xhr.onload = () => {
      delete activeRequests.current[task.id];
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            updateTask(task.id, { status: 'completed', progress: 100 });
            
            // Partial refresh: if target matches latest currentPath, append and highlight
            const latestStore = useFileStore.getState();
            const latestCurrentPath = latestStore.getCurrentPath();
            
            if (task.targetPath === latestCurrentPath && response.data) {
              const newFile = response.data as unknown as FileInfo;
              latestStore.appendFiles([newFile]);
              latestStore.setHighlightedPath(newFile.path);
            }
            
            loadStorageStats();
          } else {
            updateTask(task.id, { status: 'error', errorMsg: response.msg || 'Upload failed' });
          }
        } catch (e) {
          updateTask(task.id, { status: 'error', errorMsg: 'Invalid response from server' });
        }
      } else {
        updateTask(task.id, { status: 'error', errorMsg: `HTTP ${xhr.status}: ${xhr.statusText}` });
      }
      
      // Check if all tasks are completed
      const remaining = useUploadStore.getState().tasks.filter(t => t.status === 'uploading').length;
      if (remaining === 0) setUploading(false);
    };

    xhr.onerror = () => {
      delete activeRequests.current[task.id];
      updateTask(task.id, { status: 'error', errorMsg: 'Network error occurred' });
      
      const remaining = useUploadStore.getState().tasks.filter(t => t.status === 'uploading').length;
      if (remaining === 0) setUploading(false);
    };

    xhr.send(task.file);
  }, [updateTask, setUploading, appendFiles, loadStorageStats, currentUserData]);

  return { uploadFile };
}
