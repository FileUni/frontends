import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { client, BASE_URL } from '@/lib/api.ts';
import { 
  ChevronLeft, ChevronRight, 
  ZoomIn, ZoomOut, RotateCw, Maximize2, RotateCcw, 
  FlipHorizontal, Layers, List, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/utils.ts';
import type { FileInfo } from '../types/index.ts';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';

interface Props {
  playlist: FileInfo[];
  initialIndex: number;
  isDark?: boolean;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

/**
 * Image Preview Component
 * Simplified logic: Get token -> Build URL -> Display image
 */
export const ImagePreview = ({ playlist, initialIndex, isDark, headerExtra, onClose }: Props) => {
  const { t } = useTranslation();
  // Playlist State
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const activeFile = playlist[currentIndex];

  // Image State
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  
  // UI State
  const [showList, setShowList] = useState(true);
  const [transform, setTransform] = useState({ scale: 1, rotate: 0, flipH: false });

  // 1. When index changes, fetch Token and set image URL
  useEffect(() => {
    if (!activeFile) return;

    // Clear current image first
    setImgSrc('');
    
    const fetchToken = async () => {
      const { data } = await client.GET('/api/v1/file/get-file-download-token', {
        params: { query: { path: activeFile.path } }
      });

      if (data?.data?.token) {
        // Construct full URL
        const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.data.token)}&inline=true`;
        setImgSrc(url);
      }
    };

    fetchToken();
    document.title = `${activeFile.name} - FileUni`;
    setTransform({ scale: 1, rotate: 0, flipH: false });
  }, [currentIndex]); // Only depend on currentIndex since activeFile is derived

  // 2. Navigation Handler
  const handleNavigate = (idx: number) => {
    if (idx >= 0 && idx < playlist.length && idx !== currentIndex) {
      setCurrentIndex(idx);
      // Update URL hash for SPA
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      params.set('preview_path', playlist[idx].path);
      window.location.hash = params.toString();
    }
  };

  // 3. Keyboard Navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight') handleNavigate(currentIndex + 1);
      if (e.key === 'Escape') {
        if (onClose) onClose();
        else {
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          params.delete('preview_path');
          window.location.hash = params.toString();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, playlist.length, onClose]);

  return (
    <div className={cn("h-screen flex flex-col", isDark ? "dark bg-[#050505] text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader 
        path={activeFile?.path || ''}
        fileName={activeFile?.name}
        subtitle={`Gallery ${currentIndex + 1}/${playlist.length}`}
        icon={<ImageIcon size={20} />}
        isDark={isDark}
        extra={
          <div className="flex items-center gap-2">
            {headerExtra}
            {playlist.length > 1 && (
              <div className="flex items-center mr-2 border-r border-border pr-2 gap-1">
                <Button variant="ghost" className="h-10 w-10 rounded-xl bg-accent/30 hover:bg-accent" onClick={() => handleNavigate(currentIndex - 1)} disabled={currentIndex <= 0}>
                    <ChevronLeft size={16} />
                </Button>
                <Button variant="ghost" className="h-10 w-10 rounded-xl bg-accent/30 hover:bg-accent" onClick={() => handleNavigate(currentIndex + 1)} disabled={currentIndex >= playlist.length - 1}>
                    <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        {playlist.length > 1 && showList && (
          <div className="w-64 border-r border-border bg-accent/5 flex flex-col shrink-0 z-40 animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/40">{t('filemanager.previewModal.playlist')}</span>
              <Layers size={18} className="text-primary opacity-40" />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {playlist.map((f, i) => (
                <button 
                    key={f.path} 
                    onClick={() => handleNavigate(i)} 
                    className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border", 
                        i === currentIndex ? "bg-primary/10 border-primary/20 shadow-inner" : "border-transparent hover:bg-accent"
                    )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[14px] font-black uppercase bg-accent", i === currentIndex ? "bg-primary text-primary-foreground" : "text-muted-foreground/40")}>
                      {f.name.split('.').pop()}
                  </div>
                  <p className={cn("text-sm font-bold truncate flex-1", i === currentIndex ? "text-primary" : "text-muted-foreground")}>
                      {f.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Display Area */}
        <div className="flex-1 relative flex flex-col group min-w-0 bg-checkerboard">
          {/* Toolbar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-background/80 backdrop-blur-2xl px-4 py-2 rounded-2xl border border-border shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setShowList(!showList)}><List size={18} className={showList ? "text-primary" : ""} /></Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setTransform(t => ({ ...t, scale: t.scale + 0.2 }))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale - 0.2) }))}><ZoomOut size={18} /></Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setTransform(t => ({ ...t, rotate: t.rotate + 90 }))}><RotateCw size={18} /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setTransform(t => ({ ...t, flipH: !t.flipH }))}><FlipHorizontal size={18} /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => setTransform({ scale: 1, rotate: 0, flipH: false })}><RotateCcw size={18} /></Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl text-primary" onClick={() => imgRef.current?.requestFullscreen()}><Maximize2 size={18} /></Button>
          </div>

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative p-4 select-none">
            {/* Left Navigation Area */}
            {playlist.length > 1 && currentIndex > 0 && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-10"
                onClick={() => handleNavigate(currentIndex - 1)}
              >
                <div className="bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-black/60 transition-colors">
                  <ChevronLeft size={32} className="text-white" />
                </div>
              </div>
            )}

            {/* Right Navigation Area */}
            {playlist.length > 1 && currentIndex < playlist.length - 1 && (
              <div 
                className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-10"
                onClick={() => handleNavigate(currentIndex + 1)}
              >
                <div className="bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-black/60 transition-colors">
                  <ChevronRight size={32} className="text-white" />
                </div>
              </div>
            )}

            {/* Image */}
            {imgSrc && (
              <img
                ref={imgRef}
                src={imgSrc}
                alt={activeFile.name}
                className="max-w-[95%] max-h-[95%] shadow-2xl object-contain"
                style={{
                  transform: `scale(${transform.scale}) rotate(${transform.rotate}deg) scaleX(${transform.flipH ? -1 : 1})`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
