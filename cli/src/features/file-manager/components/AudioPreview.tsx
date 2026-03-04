import React, { useRef } from 'react';
import 'aplayer/dist/APlayer.min.css';
import { Music } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils.ts';
import { FilePreviewHeader } from './FilePreviewHeader.tsx';

interface AudioPreviewProps {
  path: string;
  isDark?: boolean;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
}

/**
 * 联动式音频预览器 / Synced Audio Previewer
 */
export const AudioPreview = ({ path, isDark, headerExtra, onClose }: AudioPreviewProps) => {
  const { t } = useTranslation();
  const playerRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className={cn("h-screen flex flex-col", isDark ? "dark bg-[#050505] text-white" : "bg-white text-zinc-900")}>
      <FilePreviewHeader 
        path={path}
        isDark={isDark}
        icon={<Music size={20} />}
        extra={headerExtra}
        onClose={onClose}
      />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-20 relative bg-gradient-to-b from-transparent to-primary/10">
        <div className="w-full max-w-2xl space-y-12 text-center animate-in zoom-in-95 duration-500">
          <div className="relative inline-block group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-1000" />
            <div className={cn(
              "w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center border-8 shadow-2xl relative transition-all duration-700 hover:rotate-6",
              isDark ? "bg-zinc-900 border-white/5" : "bg-white border-gray-100"
            )}>
              <div className="animate-[spin_10s_linear_infinite] p-8">
                <Music size={80} className="text-primary opacity-40" strokeWidth={1} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div ref={playerRef} className={cn("rounded-2xl overflow-hidden shadow-2xl transition-all", isDark ? "aplayer-dark" : "")} />
            <p className="text-sm font-black uppercase tracking-[0.3em] opacity-30">
              {t('filemanager.audio.highFidelity')}
            </p>
          </div>
        </div>
      </main>

      <style>{`
        .aplayer { background: transparent !important; box-shadow: none !important; margin: 0 !important; }
        .aplayer .aplayer-info { padding: 14px 15px !important; }
        .aplayer .aplayer-info .aplayer-music { margin-bottom: 8px !important; }
        .aplayer-dark .aplayer-info .aplayer-music .aplayer-title { color: #fff !important; }
        .aplayer-dark .aplayer-info .aplayer-music .aplayer-author { color: rgba(255,255,255,0.5) !important; }
        .aplayer-dark .aplayer-list ol li:hover { background: rgba(255,255,255,0.05) !important; }
        .aplayer-dark .aplayer-list ol li.aplayer-list-light { background: rgba(59,130,246,0.1) !important; }
      `}</style>
    </div>
  );
};
