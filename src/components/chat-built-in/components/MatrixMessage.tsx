import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixStore } from '../store/matrixStore';
import type { MatrixMessage as MatrixMessageType } from '../types/matrix';
import { getAvatarGradient, getSenderColor } from '../utils/avatar';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface MatrixMessageProps {
  message: MatrixMessageType;
  onReply?: (msg: MatrixMessageType) => void;
}

export const MatrixMessage: React.FC<MatrixMessageProps> = ({ message, onReply }) => {
  const { t } = useTranslation();
  const accounts = useMatrixStore((s) => s.accounts);
  const activeAccountId = useMatrixStore((s) => s.activeAccountId);
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const isOwn = activeAccount?.credentials?.userId === message.sender || message.status === 'sending';
  const time = formatTime(message.timestamp);
  const senderColor = getSenderColor(message.sender);
  const initials = message.senderName.charAt(0).toUpperCase();
  const [contextOpen, setContextOpen] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setContextOpen(true);
  }, []);

  const handleTouchHold = useCallback(() => {
    setContextPos({ x: 0, y: 0 });
    setContextOpen(true);
  }, []);

  return (
    <>
      <div
        className={cn('flex mb-1.5 group', isOwn ? 'justify-end' : 'justify-start')}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleContextMenu(e as unknown as React.MouseEvent); }}
      >
        {/* Avatar for others */}
        {!isOwn && (
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center text-white font-semibold text-[10px] select-none"
            style={{ background: getAvatarGradient(message.sender) }}
            aria-label={message.senderName}
          >
            {initials}
          </div>
        )}

        <div className={cn('max-w-[70%] min-w-[6rem] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
          {/* Sender name */}
          {!isOwn && (
            <div className="text-xs font-medium mb-0.5 ml-1" style={{ color: senderColor }}>
              {message.senderName}
            </div>
          )}

          {/* Reply quote */}
          {message.replyTo && (
            <ReplyQuote
              replyToId={message.replyTo}
              isOwn={isOwn}
              roomId={message.roomId}
            />
          )}

          {/* Bubble */}
          <div
            className={cn(
              'relative px-3 py-1.5 text-sm leading-5 whitespace-pre-wrap break-words',
              'rounded-[var(--border-radius-messages)]',
              isOwn
                ? 'bg-[var(--color-bubble-own)] text-white'
                : 'bg-[var(--color-bubble-other)] text-[var(--color-text-primary)]'
            )}
            onTouchStart={(e) => {
              const timer = setTimeout(handleTouchHold, 500);
              (e.currentTarget as HTMLElement).dataset['touchTimer'] = String(timer);
            }}
            onTouchEnd={(e) => {
              const timer = Number((e.currentTarget as HTMLElement).dataset['touchTimer']);
              clearTimeout(timer);
            }}
            onTouchMove={(e) => {
              const timer = Number((e.currentTarget as HTMLElement).dataset['touchTimer']);
              clearTimeout(timer);
            }}
          >
            {/* Media renderers */}
            {message.type === 'image' && message.mediaUrl && (
              <button type="button" className="block max-w-full p-0 border-0 bg-transparent cursor-pointer"
                onClick={() => window.open(message.mediaUrl!, '_blank')}
              >
                <img
                  src={message.mediaUrl}
                  alt={message.content}
                  className="max-w-full rounded-lg"
                  loading="lazy"
                />
              </button>
            )}

            {message.type === 'video' && message.mediaUrl && (
              <VideoPlayer url={message.mediaUrl} thumbnail={message.mediaThumbnailUrl} />
            )}

            {message.type === 'audio' && message.mediaUrl && (
              <AudioPlayer url={message.mediaUrl} fileName={message.fileName} />
            )}

            {message.type === 'file' && message.mediaUrl && (
              <FileDownload
                url={message.mediaUrl}
                fileName={message.fileName ?? message.content}
                fileSize={message.fileSize}
                mimeType={message.mediaMimeType}
              />
            )}

            {/* Emote styling */}
            {message.type === 'emote' && (
              <span className="italic" style={{ color: senderColor }}>
                * {message.senderName} {message.content}
              </span>
            )}

            {/* Text content */}
            {message.type !== 'emote' && (
              message.formattedContent ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(message.formattedContent),
                  }}
                />
              ) : (
                <span>{message.content}</span>
              )
            )}

            {/* Edited indicator */}
            {message.edited && (
              <span className={cn('text-[11px] italic ml-1', isOwn ? 'text-white/70' : 'text-[var(--color-text-secondary)]')}>
                {t('chatBuiltIn.room.edited')}
              </span>
            )}

            {/* Status + time row */}
            <div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
              <span className={cn('text-[11px] leading-none', isOwn ? 'text-white/70' : 'text-[var(--color-text-secondary)]')}>
                {time}
              </span>
              {isOwn && <StatusIcon status={message.status} isOwn />}
            </div>

            {/* Tail */}
            <div
              className={cn(
                'absolute top-3 w-0 h-0 border-[6px] border-transparent',
                isOwn
                  ? 'right-[-6px] border-l-[var(--color-bubble-own)]'
                  : 'left-[-6px] border-r-[var(--color-bubble-other)]'
              )}
            />
          </div>

          {/* Reactions row */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={cn('flex gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
              {message.reactions.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-background)] border border-[var(--color-divider)] hover:bg-[var(--color-sidebar-item-hover)]"
                  aria-label={r.key}
                >
                  {r.key} {r.count > 1 && <span className="ml-0.5 text-[11px]">{r.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextOpen && (
        <ContextMenu
          x={contextPos.x}
          y={contextPos.y}
          isOwn={isOwn}
          onClose={() => setContextOpen(false)}
          onReply={() => { onReply?.(message); setContextOpen(false); }}
          onCopy={() => {
            navigator.clipboard.writeText(message.content).catch(() => {});
            setContextOpen(false);
          }}
        />
      )}
    </>
  );
};

function VideoPlayer({ url, thumbnail }: { url: string; thumbnail?: string | undefined }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative mb-1 rounded-lg overflow-hidden max-w-full">
      {!playing ? (
        <div
          className="relative cursor-pointer"
          onClick={() => setPlaying(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPlaying(true); }}
        >
          {thumbnail ? (
            <img src={thumbnail} alt="" className="max-w-full h-auto max-h-64 object-cover" />
          ) : (
            <div className="w-48 h-32 flex items-center justify-center bg-[var(--color-background)]">
              <svg className="w-8 h-8 text-[var(--color-text-secondary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <video
          src={url}
          controls
          autoPlay
          className="max-w-full h-auto max-h-80 rounded-lg"
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}

function AudioPlayer({ url, fileName }: { url: string; fileName?: string | undefined }) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-1 p-1 rounded-lg bg-[var(--color-background)]">
      <button
        type="button"
        className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-accent)] text-white flex-shrink-0"
        onClick={togglePlay}
        aria-label={playing ? t('chatBuiltIn.room.pause') : t('chatBuiltIn.room.play')}
      >
        {playing ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate">{fileName || t('chatBuiltIn.room.audio')}</div>
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)}>
        <track kind="captions" />
      </audio>
    </div>
  );
}

function FileDownload({ url, fileName, fileSize, mimeType }: {
  url: string; fileName: string; fileSize?: number | undefined; mimeType?: string | undefined;
}) {
  const icon = mimeType?.startsWith('image/') ? '🖼️'
    : mimeType?.startsWith('video/') ? '🎬'
    : mimeType?.startsWith('audio/') ? '🎵'
    : mimeType?.startsWith('text/') ? '📄'
    : mimeType?.startsWith('application/pdf') ? '📕'
    : mimeType?.includes('zip') || mimeType?.includes('rar') ? '📦'
    : '📎';

  const sizeStr = fileSize != null
    ? fileSize > 1048576
      ? `${(fileSize / 1048576).toFixed(1)} MB`
      : fileSize > 1024
        ? `${(fileSize / 1024).toFixed(0)} KB`
        : `${fileSize} B`
    : '';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mb-1 p-2 rounded-lg bg-[var(--color-background)] hover:bg-[var(--color-sidebar-item-hover)] no-underline"
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate text-[var(--color-text-primary)]">{fileName}</div>
        {sizeStr && (
          <div className="text-[11px] text-[var(--color-text-secondary)]">{sizeStr}</div>
        )}
      </div>
      <svg className="w-4 h-4 flex-shrink-0 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  );
}

function ReplyQuote({ replyToId, isOwn, roomId }: { replyToId: string; isOwn: boolean; roomId: string }) {
  const accounts = useMatrixStore((s) => s.accounts);
  const activeAccountId = useMatrixStore((s) => s.activeAccountId);
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const messages = activeAccount?.messages[roomId] ?? [];
  const replied = messages.find((m) => m.id === replyToId);
  if (!replied) return null;
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 mb-1 max-w-full',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div className={cn('w-0.5 h-full min-h-[1.5rem] rounded-full flex-shrink-0', isOwn ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-text-secondary)]')} />
      <div className="flex-1 min-w-0">
        <div className={cn('text-[11px] font-medium', isOwn ? 'text-right' : 'text-left')} style={{ color: getSenderColor(replied.sender) }}>
          {replied.senderName}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)] truncate">
          {replied.content}
        </div>
      </div>
    </div>
  );
}

function ContextMenu({ x, y, isOwn, onClose, onReply, onCopy }: {
  x: number; y: number; isOwn: boolean; onClose: () => void;
  onReply: () => void; onCopy: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  React.useEffect(() => {
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      let left = x;
      let top = y;
      if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
      if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
      setPos({ left: Math.max(8, left), top: Math.max(8, top) });
    }
  }, [x, y]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[var(--color-sidebar)] border border-[var(--color-divider)] rounded-xl shadow-lg py-1 min-w-[160px]"
      style={{ left: pos.left, top: pos.top }}
    >
      <ContextMenuItem label={t('chatBuiltIn.room.reply')} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>} onClick={onReply} />
      <ContextMenuItem label={t('chatBuiltIn.room.copy')} icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>} onClick={onCopy} />
      {isOwn && (
        <div className="border-t border-[var(--color-divider)] my-1" />
      )}
    </div>
  );
}

function ContextMenuItem({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-item-hover)]"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

export function StatusIcon({ status, isOwn }: { status: MatrixMessageType['status']; isOwn?: boolean }) {
  const color = isOwn ? 'text-white/70' : 'text-[var(--color-text-secondary)]';
  if (status === 'sending') {
    return (
      <svg className={`w-3.5 h-3.5 ${color}`} viewBox="0 0 12 12" aria-label="Sending">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" className="animate-spin origin-center" strokeDasharray="20" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'sent') {
    return (
      <svg className={`w-3.5 h-3.5 ${color}`} viewBox="0 0 12 12" aria-label="Sent">
        <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'delivered' || status === 'read') {
    const checkColor = isOwn ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)';
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" aria-label={status}>
        <path d="M2 6l2 2 4-4" stroke={status === 'read' ? '#3390ec' : checkColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 6l2 2 4-4" stroke={status === 'read' ? '#3390ec' : checkColor} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={`w-3.5 h-3.5 ${color}`} viewBox="0 0 12 12" aria-label="Failed">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
