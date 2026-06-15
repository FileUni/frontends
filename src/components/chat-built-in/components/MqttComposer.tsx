import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMqttStore } from '../store/mqttStore';

interface MqttComposerProps {
  contactId: string;
}

const EMOJI_LIST = [
  '😀', '😂', '🤣', '❤️', '🔥', '👍', '😊', '🎉', '😎', '🤔',
  '😢', '😡', '🥺', '😴', '🤗', '🙏', '💀', '👀', '💯', '✨',
  '⭐', '🌟', '💪', '👋', '✌️', '🤞', '🖖', '🐱', '🐶', '🐼',
  '🌸', '🌺', '🍕', '🎵', '📚', '💡', '🎯', '🔥', '💎', '🌈',
];

export const MqttComposer: React.FC<MqttComposerProps> = ({ contactId }) => {
  const { t } = useTranslation();
  const sendMessage = useMqttStore((s) => s.sendMessage);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(contactId, trimmed);
    setText('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--color-divider)] bg-[var(--color-surface)]">
      {/* Emoji panel */}
      {showEmoji && (
        <div className="border-b border-[var(--color-divider)] px-2 py-2">
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[var(--color-sidebar-item-hover)] rounded"
                onClick={() => insertEmoji(emoji)}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2">
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full flex-shrink-0 hover:bg-[var(--color-sidebar-item-hover)]"
          onClick={() => setShowEmoji(!showEmoji)}
          aria-label={t('chatBuiltIn.composer.emoji')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <textarea
          ref={inputRef}
          className="flex-1 resize-none bg-[var(--color-background)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none border border-[var(--color-divider)] focus:border-[var(--color-accent)] min-h-[40px] max-h-[120px]"
          placeholder={t('chatBuiltIn.composer.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center text-white bg-[var(--color-accent)] rounded-full flex-shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label={t('chatBuiltIn.composer.send')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};
