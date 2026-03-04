import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/stores/audio.ts';
import { useThemeStore } from '@fileuni/shared';
import { client, BASE_URL } from '@/lib/api.ts';
import { 
  Music, X, ChevronDown, Download, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { Button } from '@/components/ui/Button.tsx';
import { useTranslation } from 'react-i18next';
import 'aplayer/dist/APlayer.min.css';

interface APlayerAudio {
  name: string;
  artist: string;
  url: string;
  cover: string;
  theme?: string;
  _path: string;
}

type APlayerInstance = InstanceType<typeof import('aplayer').default>;
type APlayerRuntimeInstance = APlayerInstance & {
  list?: {
    audios: APlayerAudio[];
    index: number;
    switch: (index: number) => void;
  };
  audio?: HTMLAudioElement;
  seek?: (time: number) => void;
};

/**
 * Global Floating Audio Player
 */
export const GlobalAudioPlayer = () => {
  const { t } = useTranslation();
  const { 
    isOpen, isMinimized, currentTrack, playlist, currentIndex,
    close, setMinimized
  } = useAudioStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const playerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<APlayerRuntimeInstance | null>(null);

  // Initialize APlayer
  useEffect(() => {
    if (!isOpen || !playerRef.current || !currentTrack) return undefined;

    let aplayerInstance: APlayerRuntimeInstance | null = null;

    const init = async () => {
      const APlayerClass = (await import('aplayer')).default;
      
      const getTrackUrl = async (path: string) => {
        try {
          const { data } = await client.GET('/api/v1/file/get-file-download-token', {
            params: { query: { path } }
          });
          if (data?.data?.token) {
            return `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}&inline=true`;
          }
        } catch (e) {
          console.error("Failed to get token for", path, e);
        }
        return '';
      };

      // Fetch first 3 tokens initially, remaining tokens are fetched on playback
      const initialTracksCount = 3;
      const tracks: APlayerAudio[] = await Promise.all(playlist.map(async (t, i) => {
        const url = i < initialTracksCount ? await getTrackUrl(t.path) : '';
        return {
          name: t.name,
          artist: t.artist || 'FileUni VFS',
          url: url,
          cover: t.cover || '/assets/audio-cover.svg',
          theme: '#3b82f6',
          _path: t.path
        };
      }));

      if (instanceRef.current) {
        instanceRef.current.destroy();
      }

      const rawInstance = new APlayerClass({
        container: playerRef.current,
        audio: tracks,
        listMaxHeight: '200px',
        autoplay: true,
        loop: 'all',
        order: 'list',
        theme: '#3b82f6'
      });
      aplayerInstance = rawInstance as APlayerRuntimeInstance;

      if (!aplayerInstance) return;

      aplayerInstance.on?.('listswitch', async ({ index }: { index: number }) => {
        if (!aplayerInstance) return;
        const playerList = aplayerInstance.list;
        if (!playerList) return;
        const audio = playerList.audios[index] as (APlayerAudio | undefined);
        if (!audio) return;
        if (!audio.url) {
            const realUrl = await getTrackUrl(audio._path);
            audio.url = realUrl;
            if (playerList.index === index && aplayerInstance.audio) {
                const currentTime = aplayerInstance.audio.currentTime;
                aplayerInstance.pause();
                aplayerInstance.play();
                if (currentTime > 0) aplayerInstance.seek?.(currentTime);
            }
        }
        useAudioStore.setState({ currentIndex: index, currentTrack: playlist[index] });
      });

      aplayerInstance.list?.switch(currentIndex);
      instanceRef.current = aplayerInstance;
    };

    init();

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [isOpen, playlist.length]);

  useEffect(() => {
    if (instanceRef.current && currentIndex !== -1) {
      const playerList = instanceRef.current.list;
      if (playerList && playerList.index !== currentIndex) {
        playerList.switch(currentIndex);
      }
    }
  }, [currentIndex]);

  const handleDownload = async () => {
    if (!currentTrack) return;
    try {
      const { data } = await client.GET('/api/v1/file/get-file-download-token', {
        params: { query: { path: currentTrack.path } }
      });
      if (data?.data?.token) {
        const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = currentTrack.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleOpenStandalone = () => {
    if (currentTrack) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      params.set('preview_path', currentTrack.path);
      window.location.hash = params.toString();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 z-[100] transition-all duration-500 ease-in-out flex flex-col shadow-2xl overflow-hidden border",
        isDark ? "border-white/10 bg-[#1a1a1a]/90" : "border-black/5 bg-white/90",
        "backdrop-blur-xl",
        isMinimized 
          ? "w-14 h-14 rounded-full" 
          : "w-[360px] md:w-[400px] rounded-3xl"
      )}
    >
      {/* Minimize Toggle Button */}
      <button 
        onClick={() => setMinimized(false)}
        className={cn(
          "absolute inset-0 w-full h-full flex items-center justify-center bg-primary text-white hover:scale-110 transition-all shadow-lg shadow-primary/20 z-10",
          !isMinimized && "opacity-0 pointer-events-none"
        )}
      >
        <Music size={24} className="animate-pulse" />
      </button>

      {/* Main Player Panel */}
      <div className={cn(
        "flex flex-col transition-opacity duration-300",
        isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        <div className={cn(
          "flex items-center justify-between px-5 py-4 border-b",
          isDark ? "border-white/5 bg-white/5" : "border-black/5 bg-black/5"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <Music size={18} />
            </div>
            <div className="min-w-0">
              <h4 className={cn("text-sm font-bold truncate pr-2", isDark ? "text-white" : "text-zinc-900")}>
                {currentTrack?.name}
              </h4>
              <p className="text-sm font-black opacity-30 uppercase tracking-widest text-primary">
                {t('player.nowPlaying')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" size="sm" 
              className="h-8 w-8 rounded-lg"
              onClick={handleDownload}
              title={t('common.download')}
            >
              <Download size={18} />
            </Button>
            <Button 
              variant="ghost" size="sm" 
              className="h-8 w-8 rounded-lg"
              onClick={handleOpenStandalone}
              title={t('filemanager.actions.preview') || "Open in New Window"}
            >
              <ExternalLink size={18} />
            </Button>
            <Button 
              variant="ghost" size="sm" 
              className="h-8 w-8 rounded-lg"
              onClick={() => setMinimized(true)}
              title={t('common.minimize') || "Minimize"}
            >
              <ChevronDown size={16} />
            </Button>
            <Button 
              variant="ghost" size="sm" 
              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
              onClick={close}
              title={t('common.close')}
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <div 
            ref={playerRef} 
            className={cn(
              "rounded-2xl overflow-hidden transition-all", 
              isDark ? "aplayer-dark" : ""
            )} 
          />
        </div>
      </div>

      <style>{`
        .aplayer { background: transparent !important; box-shadow: none !important; margin: 0 !important; }
        .aplayer .aplayer-info { padding: 10px 10px !important; border-bottom: none !important; }
        .aplayer .aplayer-info .aplayer-music { margin: 0 0 10px 10px !important; }
        .aplayer .aplayer-list { margin-top: 10px; border-top: 1px solid rgba(128,128,128,0.1); }
        .aplayer-dark .aplayer-info .aplayer-music .aplayer-title { color: #fff !important; }
        .aplayer-dark .aplayer-info .aplayer-music .aplayer-author { color: rgba(255,255,255,0.5) !important; }
        .aplayer-dark .aplayer-list ol li { border-top: 1px solid rgba(255,255,255,0.05) !important; color: #ccc !important; }
        .aplayer-dark .aplayer-list ol li:hover { background: rgba(255,255,255,0.05) !important; }
        .aplayer-dark .aplayer-list ol li.aplayer-list-light { background: rgba(59,130,246,0.1) !important; color: #fff !important; }
        .aplayer .aplayer-info .aplayer-controller .aplayer-time .aplayer-icon path { fill: #666; }
        .aplayer-dark .aplayer-info .aplayer-controller .aplayer-time .aplayer-icon path { fill: #999; }
      `}</style>
    </div>
  );
};
