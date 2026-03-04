import React, { useEffect, useRef, useState, useCallback } from 'react';
import Player from 'xgplayer';
import FlvPlugin from 'xgplayer-flv';
import 'xgplayer/dist/index.min.css';
import type { FileInfo } from '../types/index.ts';
import { client, BASE_URL } from '@/lib/api.ts';
import {
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  ListOrdered,
  Subtitles,
  Play,
  Pause,
  Maximize2,
  Video
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/utils.ts';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';

type PlayMode = 'list' | 'loop' | 'shuffle' | 'single';

const PLAY_MODE_CONFIG: Record<PlayMode, { icon: React.ElementType; labelKey: string; next: PlayMode }> = {
  list: { icon: ListOrdered, labelKey: 'player.playMode.list', next: 'loop' },
  loop: { icon: Repeat, labelKey: 'player.playMode.loop', next: 'shuffle' },
  shuffle: { icon: Shuffle, labelKey: 'player.playMode.shuffle', next: 'single' },
  single: { icon: Repeat1, labelKey: 'player.playMode.single', next: 'list' },
};

interface Props {
  playlist: FileInfo[];
  initialIndex?: number;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

interface SubtitleInfo {
  file: FileInfo;
  url: string;
  isActive: boolean;
}

type SubtitleCapablePlayer = Player & {
  attachSubtitle?: (options: { url: string; type: 'vtt' | 'srt' | 'ass' }) => void;
  removeSubtitle?: () => void;
};

/**
 * 优化后的专业视频播放器 / Optimized Professional Video Player
 */
export const VideoPlayer = ({ playlist, initialIndex = 0, headerExtra, onClose }: Props) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [playMode, setPlayMode] = useState<PlayMode>('list');
  const activeFile = playlist[currentIndex];
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  
  const [showPlaylist] = useState(true);
  const [showSubtitlePanel, setShowSubtitlePanel] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState<SubtitleInfo[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const isFlv = activeFile?.name.toLowerCase().endsWith('.flv');

  const playNext = useCallback(() => {
    if (playMode === 'shuffle') {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }
  }, [playlist.length, playMode]);

  const playPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const loadSubtitles = useCallback(async () => {
    if (!activeFile) return;
    const baseName = activeFile.name.replace(/\.[^.]+$/, '');
    const subtitleFiles = playlist.filter(f => {
      const fBase = f.name.replace(/\.[^.]+$/, '');
      const fExt = f.name.split('.').pop()?.toLowerCase();
      return fBase.toLowerCase() === baseName.toLowerCase() && ['vtt', 'srt', 'ass'].includes(fExt || '');
    });

    const subs: SubtitleInfo[] = [];
    for (const f of subtitleFiles) {
      const { data } = await client.GET('/api/v1/file/get-file-download-token', { params: { query: { path: f.path } } });
      if (data?.data?.token) {
        subs.push({ file: f, url: `${BASE_URL}/api/v1/file/get-content?file_download_token=${data.data.token}&inline=true`, isActive: false });
      }
    }
    setAvailableSubtitles(subs);
  }, [activeFile, playlist]);

  useEffect(() => {
    if (!playerContainerRef.current || !activeFile) return undefined;
    let isMounted = true;

    const init = async () => {
      if (playerRef.current) playerRef.current.destroy();
      const { data } = await client.GET('/api/v1/file/get-file-download-token', { params: { query: { path: activeFile.path } } });
      if (!isMounted || !data?.data?.token) return;

      const videoUrl = `${BASE_URL}/api/v1/file/get-content?file_download_token=${data.data.token}&inline=true`;
      const player = new Player({
        el: playerContainerRef.current!,
        url: videoUrl,
        width: '100%', height: '100%', autoplay: true, controls: false,
        ignores: ['play', 'progress', 'time', 'volume', 'fullscreen', 'pip', 'playbackrate', 'definition', 'start', 'error', 'loading', 'poster', 'replay', 'mobile'],
        plugins: isFlv ? [FlvPlugin] : [],
      });

      player.on('ended', () => playMode === 'single' ? player.play() : playNext());
      player.on('play', () => setIsPlaying(true));
      player.on('pause', () => setIsPlaying(false));
      player.on('timeupdate', () => setCurrentTime(player.currentTime));
      player.on('durationchange', () => setDuration(player.duration));
      playerRef.current = player;
    };

    init();
    loadSubtitles();
    return () => { isMounted = false; playerRef.current?.destroy(); };
  }, [currentIndex, isFlv, playNext, playMode]);

  const handleSubtitleChange = (sub: SubtitleInfo) => {
    const player = playerRef.current as SubtitleCapablePlayer | null;
    if (!player) return;
    const ext = sub.file.name.split('.').pop()?.toLowerCase() || '';
    player.attachSubtitle?.({ 
      url: sub.url, 
      type: ext as 'vtt' | 'srt' | 'ass' 
    });
    setCurrentSubtitle(sub);
    setAvailableSubtitles(prev => prev.map(s => ({ ...s, isActive: s.file.path === sub.file.path })));
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const PlayModeIcon = PLAY_MODE_CONFIG[playMode].icon;

  return (
    <div className={cn("h-screen flex flex-col bg-background overflow-hidden relative")}>
      <FilePreviewHeader 
        path={activeFile?.path || ''}
        fileName={activeFile?.name}
        subtitle={t('filemanager.player.videoEngine')}
        icon={<Video size={20} />}
        onClose={onClose}
        extra={
          <div className="flex items-center gap-2">
            {headerExtra}
            <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0" onClick={() => setShowSubtitlePanel(!showSubtitlePanel)}><Subtitles size={18} /></Button>
            <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0" onClick={() => playerContainerRef.current?.requestFullscreen()}><Maximize2 size={18} /></Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div ref={playerContainerRef} className="flex-1 relative bg-black group min-h-0">
          {/* Center Play Button */}
          {!isPlaying && (
            <button onClick={() => playerRef.current?.play()} className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] z-10">
              <div className="w-20 h-20 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl"><Play size={32} className="text-white fill-white ml-1" /></div>
            </button>
          )}

          {/* Bottom UI */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <div className="mb-4 h-1 bg-white/20 rounded-full cursor-pointer"><div className="h-full bg-primary relative" style={{ width: `${(currentTime/duration)*100}%` }} /></div>
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button onClick={playPrev} className="hover:text-primary"><SkipBack size={20} /></button>
                <button onClick={() => isPlaying ? playerRef.current?.pause() : playerRef.current?.play()}>{isPlaying ? <Pause size={24} /> : <Play size={24} className="fill-white" />}</button>
                <button onClick={playNext} className="hover:text-primary"><SkipForward size={20} /></button>
                <span className="text-sm font-mono opacity-60">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
              <button onClick={() => setPlayMode(PLAY_MODE_CONFIG[playMode].next)} className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-sm font-black uppercase"><PlayModeIcon size={18} /> {t(PLAY_MODE_CONFIG[playMode].labelKey)}</button>
            </div>
          </div>

          {showSubtitlePanel && (
            <div className="absolute top-20 right-6 w-64 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl p-2 z-30">
              <button onClick={() => { (playerRef.current as SubtitleCapablePlayer | null)?.removeSubtitle?.(); setCurrentSubtitle(null); }} className={cn("w-full text-left px-4 py-2 rounded-xl text-sm font-bold", !currentSubtitle ? "bg-primary text-white" : "text-white/60 hover:bg-white/5")}>{t('player.subtitlesOff')}</button>
              {availableSubtitles.map(s => <button key={s.file.path} onClick={() => handleSubtitleChange(s)} className={cn("w-full text-left px-4 py-2 rounded-xl text-sm font-bold mt-1", s.isActive ? "bg-primary text-white" : "text-white/60 hover:bg-white/5")}>{s.file.name}</button>)}
            </div>
          )}
        </div>

        {/* Sidebar Playlist */}
        <div className={cn("w-80 border-l border-border bg-accent/5 flex flex-col transition-all duration-300", !showPlaylist && "w-0 opacity-0 hidden")}>
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">{t('player.playlist')}</h3>
            <span className="text-sm font-mono opacity-20 text-foreground">{currentIndex + 1} / {playlist.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            {playlist.map((f, i) => (
              <button key={f.path} onClick={() => setCurrentIndex(i)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-all", i === currentIndex ? "bg-primary/10 border border-primary/20" : "hover:bg-accent border border-transparent")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black", i === currentIndex ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground")}>{i + 1}</div>
                <div className="flex-1 min-w-0 text-left"><p className={cn("text-sm font-bold truncate", i === currentIndex ? "text-primary" : "text-muted-foreground")}>{f.name}</p></div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
