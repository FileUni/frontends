import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useMqttStore } from '../store/mqttStore';
import { MatrixMessage } from './MatrixMessage';
import { MatrixComposer } from './MatrixComposer';
import { MqttComposer } from './MqttComposer';
import { getAvatarGradient, getInitials } from '../utils/avatar';
import { cn } from '@/lib/utils';
import type { MatrixMessage as MatrixMessageType } from '../types/matrix';
import type { MqttMessage } from '../types/mqtt';

interface ChatViewProps {
  onToggleSidebar: () => void;
  onToggleProfile: () => void;
}

type AnyMessage = MatrixMessageType | MqttMessage;

function hasSender(m: AnyMessage): m is MatrixMessageType {
  return 'sender' in m;
}

export const ChatView: React.FC<ChatViewProps> = ({ onToggleSidebar, onToggleProfile }) => {
  const { t } = useTranslation();
  const { chatType, activeChat, currentMessages, currentRoom } = useMatrixClient();
  const mqttContact = useMqttStore((s) =>
    chatType === 'mqtt' ? s.contacts.find((c) => c.id === s.activeContactId) ?? null : null
  );
  const matrixRoom = chatType === 'matrix' ? currentRoom : null;

  const bottomRef = useRef<HTMLDivElement>(null);
  const replyToKey = `${activeChat?.id ?? ''}_replyTo`;
  const [replyTo, setReplyTo] = useState<MatrixMessageType | null>(() => {
    try {
      const stored = sessionStorage.getItem(replyToKey);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  useEffect(() => {
    if (replyTo) {
      try { sessionStorage.setItem(replyToKey, JSON.stringify(replyTo)); } catch { /* noop */ }
    } else {
      try { sessionStorage.removeItem(replyToKey); } catch { /* noop */ }
    }
  }, [replyTo, replyToKey]);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return currentMessages;
    const q = searchQuery.toLowerCase();
    return currentMessages.filter((m: AnyMessage) =>
      m.content.toLowerCase().includes(q) ||
      (hasSender(m) && (m as MatrixMessageType).senderName.toLowerCase().includes(q))
    );
  }, [currentMessages, searchQuery]);

  const typingText = matrixRoom && matrixRoom.typingUsers.length > 0
    ? t('chatBuiltIn.room.typing', { users: matrixRoom.typingUsers.join(', ') })
    : null;

  const handleClearReply = () => {
    setReplyTo(null);
    try { sessionStorage.removeItem(replyToKey); } catch { /* noop */ }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)] text-sm select-none">
        {t('chatBuiltIn.room.selectChat')}
      </div>
    );
  }

  const gradient = chatType === 'matrix' && matrixRoom
    ? getAvatarGradient(matrixRoom.id)
    : 'var(--color-accent)';
  const initials = chatType === 'matrix' && matrixRoom
    ? getInitials(matrixRoom.name)
    : (activeChat.peerName?.[0]?.toUpperCase() || activeChat.name[0]?.toUpperCase() || '?');

  const statusDot = mqttContact
    ? mqttContact.status === 'online' ? 'bg-green-500'
      : mqttContact.status === 'connecting' ? 'bg-yellow-500'
      : 'bg-[var(--color-text-tertiary)]'
    : null;
  const statusLabels: Record<string, string> = {
    online: t('chatBuiltIn.mqtt.status.online'),
    connecting: t('chatBuiltIn.mqtt.status.connecting'),
    offline: t('chatBuiltIn.mqtt.status.offline'),
  };
  const statusText = mqttContact ? statusLabels[mqttContact.status] || statusLabels['offline'] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header - unified for both Matrix and MQTT */}
      <div className="flex-shrink-0 h-[var(--header-height)] flex items-center gap-3 px-3 border-b border-[var(--color-divider)] bg-[var(--color-surface)]">
        <button
          type="button"
          className="xl:hidden w-10 h-10 flex items-center justify-center text-[var(--color-text-primary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]"
          onClick={onToggleSidebar}
          aria-label={t('chatBuiltIn.sidebar.toggle')}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {chatType === 'matrix' && showSearch ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              placeholder={t('chatBuiltIn.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setShowSearch(false)}
            />
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]"
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                aria-label={t('chatBuiltIn.room.closeSearch')}
              >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex items-center gap-3 min-w-0 flex-1"
              onClick={onToggleProfile}
            >
              <div className="relative flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                  style={{ background: gradient }}
                >
                  {activeChat.avatarUrl ? (
                    <img src={activeChat.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                {chatType === 'mqtt' && statusDot && (
                  <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface)]', statusDot)} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {activeChat.name}
                </div>
                {chatType === 'matrix' && typingText && (
                  <div className="text-xs text-[var(--color-accent)] truncate">{typingText}</div>
                )}
                {chatType === 'mqtt' && statusText && (
                  <div className="text-xs text-[var(--color-text-tertiary)] truncate">{statusText}</div>
                )}
              </div>
            </button>

            <div className="flex items-center gap-1">
              {chatType === 'matrix' && (
                <>
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]"
                      onClick={() => setShowSearch(true)}
                      aria-label={t('chatBuiltIn.room.searchMessages')}
                    >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  <button type="button" className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]" aria-label={t('chatBuiltIn.room.call')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button type="button" className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]" aria-label={t('chatBuiltIn.room.videoCall')}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </>
              )}
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)] max-xl:hidden"
                onClick={onToggleProfile}
                aria-label={t('chatBuiltIn.room.info')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {searchQuery && filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
            {t('chatBuiltIn.room.noSearchResults')}
          </div>
        ) : filteredMessages.length === 0 ? null : (
          <>
            {searchQuery && (
              <div className="text-xs text-[var(--color-text-tertiary)] px-1 py-2">
                {t('chatBuiltIn.room.searchResults', { count: filteredMessages.length })}
              </div>
            )}
            {groupByDay(filteredMessages as AnyMessage[]).map(({ date, messages }) => (
              <div key={date}>
                <div className="flex justify-center my-3">
                  <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-background)] px-3 py-1 rounded-full">
                    {formatDateLabel(date)}
                  </span>
                </div>
                {messages.map((msg) => (
                  chatType === 'matrix' ? (
                    <MatrixMessage key={msg.id} message={msg as MatrixMessageType} onReply={setReplyTo} />
                  ) : (
                    <MqttMessageBubble key={msg.id} message={msg as MqttMessage} isOwn={(msg as MqttMessage).senderId === mqttContact?.clientId} />
                  )
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      {chatType === 'matrix' ? (
        activeChat && (
          <MatrixComposer roomId={activeChat.id} replyTo={replyTo} onClearReply={handleClearReply} />
        )
      ) : (
        mqttContact && <MqttComposer contactId={mqttContact.id} />
      )}
    </div>
  );
};

const MqttMessageBubble: React.FC<{ message: MqttMessage; isOwn: boolean }> = ({ message, isOwn }) => {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-[var(--color-text-tertiary)] italic">{message.content}</span>
      </div>
    );
  }

  if (message.type === 'handshake') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-[var(--color-accent)]">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-1.5', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words',
          isOwn
            ? 'bg-[var(--color-bubble-own)] text-white rounded-br-md'
            : 'bg-[var(--color-bubble-other)] text-[var(--color-text-primary)] rounded-bl-md'
        )}
      >
        <div>{message.content}</div>
        <div className={cn('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px]', isOwn ? 'text-white/70' : 'text-[var(--color-text-tertiary)]')}>
            {time}
          </span>
          {isOwn && (
            <svg className="w-3.5 h-3.5 text-white/70" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

function groupByDay(msgs: AnyMessage[]) {
  const groups: { date: string; messages: typeof msgs }[] = [];
  for (const msg of msgs) {
    const date = new Date(msg.timestamp).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
  }
  return groups;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return i18next.t('chatBuiltIn.room.today');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) return i18next.t('chatBuiltIn.room.yesterday');
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
