import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixStore } from '../store/matrixStore';
import type { MatrixMessage as MatrixMessageType } from '../types/matrix';

interface MatrixComposerProps {
  roomId: string;
  replyTo?: MatrixMessageType | null;
  onClearReply?: () => void;
}

const EMOJI_CATEGORIES = [
  { name: 'Smileys & Emotion', emojis: ['😀', '😂', '🤣', '❤️', '🔥', '👍', '😊', '🎉', '😎', '🤔', '😢', '😡', '🥺', '😴', '🤗', '🙏', '💀', '☠️', '👀', '💯', '✨', '⭐', '🌟', '💪', '👋', '✌️', '🤞', '🖖'] },
  { name: 'Animals & Nature', emojis: ['🐱', '🐶', '🐼', '🌸', '🐻', '🦊', '🐰', '🐭', '🐹', '🐸', '🦁', '🐮', '🦄', '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋'] },
  { name: 'Food & Drink', emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐'] },
  { name: 'Activities', emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷'] },
];

export const MatrixComposer: React.FC<MatrixComposerProps> = ({ roomId, replyTo, onClearReply }) => {
  const { t } = useTranslation();
  const { sendMessage, sendMedia, setTyping } = useMatrixStore();
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(`matrix_draft_${roomId}`) ?? ''; } catch { return ''; }
  });
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [formatBold, setFormatBold] = useState(false);
  const [formatItalic, setFormatItalic] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Draft persistence
  useEffect(() => {
    try { localStorage.setItem(`matrix_draft_${roomId}`, text); } catch { /* noop */ }
  }, [text, roomId]);

  // Reset draft on room change
  useEffect(() => {
    setText(() => {
      try { return localStorage.getItem(`matrix_draft_${roomId}`) ?? ''; } catch { return ''; }
    });
  }, [roomId]);

  const hasText = text.trim().length > 0;

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    clearTimeout(typingTimerRef.current);
    await setTyping(roomId, false);
    if (replyTo) {
      await sendMessage(roomId, text.trim(), replyTo.id);
    } else {
      await sendMessage(roomId, text.trim());
    }
    setText('');
    onClearReply?.();
    inputRef.current?.focus();
  }, [roomId, text, sendMessage, setTyping, replyTo, onClearReply]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    clearTimeout(typingTimerRef.current);
    setTyping(roomId, true);
    typingTimerRef.current = setTimeout(() => setTyping(roomId, false), 3000);
  };

  const handleAttach = () => {
    setShowAttach(!showAttach);
  };

  const handleFilePick = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await sendMedia(roomId, file);
    };
    input.click();
    setShowAttach(false);
  };

  const handleEmojiClick = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const wrapSelection = (before: string, after: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    setText(newText);
    setShowFormat(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await sendMedia(roomId, file);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(250);
      setRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setMicError(t('chatBuiltIn.composer.microphoneDenied'));
      setTimeout(() => setMicError(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false);
    setRecordingDuration(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    chunksRef.current = [];
    setRecording(false);
    setRecordingDuration(0);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--color-divider)] bg-[var(--color-surface)]">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-background)] border-b border-[var(--color-divider)]">
          <div className="w-0.5 h-full min-h-[1.5rem] rounded-full bg-[var(--color-accent)]" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-[var(--color-accent)]">
              {replyTo.senderName}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {replyTo.content}
            </div>
          </div>
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={onClearReply}
            aria-label={t('chatBuiltIn.composer.cancelReply')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="px-3 py-2">
        <div className="flex items-end gap-2">
          {/* Emoji button */}
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)] flex-shrink-0"
            onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); setShowFormat(false); }}
            aria-label={t('chatBuiltIn.composer.emoji')}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Format button */}
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)] flex-shrink-0"
            onClick={() => { setShowFormat(!showFormat); setShowEmoji(false); setShowAttach(false); }}
            aria-label={t('chatBuiltIn.composer.formatText')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>

          {/* Input */}
          <textarea
            ref={inputRef}
            className="flex-1 resize-none outline-none text-sm text-[var(--color-text-primary)] bg-transparent max-h-24 py-2 placeholder:text-[var(--color-text-secondary)]"
            placeholder={t('chatBuiltIn.composer.placeholder')}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          {/* Attach */}
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)] flex-shrink-0"
            onClick={handleAttach}
            aria-label={t('chatBuiltIn.composer.attach')}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Send or mic */}
          {hasText || replyTo ? (
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center text-white bg-[var(--color-accent)] rounded-full flex-shrink-0 hover:opacity-90 transition-opacity"
              onClick={handleSend}
              aria-label={t('chatBuiltIn.composer.send')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          ) : recording ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                {formatDuration(recordingDuration)}
              </span>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center text-red-500 rounded-full flex-shrink-0 hover:bg-red-100 dark:hover:bg-red-900/30 animate-pulse"
                onClick={stopRecording}
                aria-label={t('chatBuiltIn.composer.stopRecording')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full flex-shrink-0 hover:bg-[var(--color-sidebar-item-hover)]"
                onClick={cancelRecording}
                aria-label={t('chatBuiltIn.composer.cancelRecording')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full flex-shrink-0 hover:bg-[var(--color-sidebar-item-hover)]"
                onClick={startRecording}
                aria-label={t('chatBuiltIn.composer.voice')}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              {micError && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-xs px-2 py-1 rounded-lg shadow-lg">
                  {micError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      {showFormat && (
        <div className="border-t border-[var(--color-divider)] px-3 py-2 flex gap-1">
          <FormatButton label={t('chatBuiltIn.composer.bold')} active={formatBold} onClick={() => { setFormatBold(!formatBold); wrapSelection('**', '**'); }} />
          <FormatButton label={t('chatBuiltIn.composer.italic')} active={formatItalic} onClick={() => { setFormatItalic(!formatItalic); wrapSelection('_', '_'); }} />
          <FormatButton label={t('chatBuiltIn.composer.strikethrough')} active={false} onClick={() => wrapSelection('~~', '~~')} />
          <FormatButton label={t('chatBuiltIn.composer.monospace')} active={false} onClick={() => wrapSelection('`', '`')} />
        </div>
      )}

      {/* Attachment panel */}
      {showAttach && (
        <div className="border-t border-[var(--color-divider)] px-3 py-2">
          <div className="flex gap-2">
            <AttachButton label={t('chatBuiltIn.composer.photo')} icon="🖼️" onClick={() => handleFilePick('image/*')} />
            <AttachButton label={t('chatBuiltIn.composer.file')} icon="📎" onClick={() => handleFilePick('')} />
            <AttachButton label={t('chatBuiltIn.composer.camera')} icon="📷" onClick={() => handleFilePick('image/*')} />
          </div>
        </div>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <div className="border-t border-[var(--color-divider)]">
          <div className="flex gap-1 px-3 pt-2 pb-1 overflow-x-auto">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.name}
                type="button"
                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${i === emojiCategory ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)]'}`}
                onClick={() => setEmojiCategory(i)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1 p-2 text-lg max-h-40 overflow-y-auto">
            {EMOJI_CATEGORIES[emojiCategory]?.emojis.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-sidebar-item-hover)] rounded"
                onClick={() => handleEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function FormatButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`w-8 h-8 flex items-center justify-center text-sm rounded ${active ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)]'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AttachButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-[var(--color-sidebar-item-hover)]"
      onClick={onClick}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
    </button>
  );
}
