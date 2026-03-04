import { create } from 'zustand';
import type { FileInfo } from '@/features/file-manager/types';

interface AudioTrack {
  name: string;
  path: string;
  artist?: string;
  cover?: string;
}

interface AudioState {
  isOpen: boolean;
  isMinimized: boolean;
  currentTrack: AudioTrack | null;
  playlist: AudioTrack[];
  currentIndex: number;

  // Actions
  play: (track: FileInfo, folderFiles: FileInfo[]) => void;
  close: () => void;
  setMinimized: (minimized: boolean) => void;
  next: () => void;
  prev: () => void;
  setPlaylist: (tracks: FileInfo[]) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  currentTrack: null,
  playlist: [],
  currentIndex: -1,

  play: (file, folderFiles) => {
    // Filter out audio files
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
    const audioFiles = folderFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return audioExtensions.includes(ext);
    });

    const tracks: AudioTrack[] = audioFiles.map(f => ({
      name: f.name,
      path: f.path,
      artist: 'FileUni VFS',
      cover: '/assets/audio-cover.svg'
    }));

    const index = tracks.findIndex(t => t.path === file.path);

    set({
      isOpen: true,
      isMinimized: false,
      currentTrack: tracks[index] || {
        name: file.name,
        path: file.path,
        artist: 'FileUni VFS',
        cover: '/assets/audio-cover.svg'
      },
      playlist: tracks,
      currentIndex: index >= 0 ? index : 0
    });
  },

  close: () => set({ isOpen: false, currentTrack: null, playlist: [], currentIndex: -1 }),
  
  setMinimized: (minimized) => set({ isMinimized: minimized }),

  next: () => {
    const { playlist, currentIndex } = get();
    if (playlist.length === 0) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    set({ currentIndex: nextIndex, currentTrack: playlist[nextIndex] });
  },

  prev: () => {
    const { playlist, currentIndex } = get();
    if (playlist.length === 0) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    set({ currentIndex: prevIndex, currentTrack: playlist[prevIndex] });
  },

  setPlaylist: (files) => {
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
    const tracks: AudioTrack[] = files
      .filter(f => audioExtensions.includes(f.name.split('.').pop()?.toLowerCase() || ''))
      .map(f => ({
        name: f.name,
        path: f.path,
        artist: 'FileUni VFS',
        cover: '/assets/audio-cover.svg'
      }));
    set({ playlist: tracks });
  }
}));
