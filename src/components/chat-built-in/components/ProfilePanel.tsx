import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { getAvatarGradient, getInitials } from '../utils/avatar';
import { cn } from '@/lib/utils';
import type { MatrixMessage } from '../types/matrix';

interface ProfilePanelProps {
  onClose: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { currentRoom, currentMessages } = useMatrixClient();
  const msgs = currentMessages as MatrixMessage[];
  const [tab, setTab] = useState<'media' | 'links'>('media');

  if (!currentRoom) return null;

  const gradient = getAvatarGradient(currentRoom.id);
  const initials = getInitials(currentRoom.name);

  const sharedMedia = msgs.filter((m) => m.type === 'image' || m.type === 'video' || m.type === 'file');
  const images = sharedMedia.filter((m) => m.type === 'image');
  const links = msgs.filter((m) => m.content.match(/https?:\/\/[^\s]+/));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 h-[var(--header-height)] flex items-center gap-3 px-3 border-b border-[var(--color-divider)]">
        <button
          type="button"
          className="xl:hidden w-10 h-10 flex items-center justify-center text-[var(--color-text-primary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]"
          onClick={onClose}
          aria-label={t('chatBuiltIn.sidebar.close')}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('chatBuiltIn.room.members', { count: currentRoom.memberCount })}
        </span>
      </div>

      {/* Profile card */}
      <div className="flex flex-col items-center py-6 px-6 border-b border-[var(--color-divider)]">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white font-semibold text-xl mb-3"
          style={{ background: gradient }}
        >
          {currentRoom.avatarUrl ? (
            <img src={currentRoom.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="text-base font-medium text-[var(--color-text-primary)] text-center">
          {currentRoom.name}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
          {t('chatBuiltIn.room.members', { count: currentRoom.memberCount })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[var(--color-divider)]">
        <button
          type="button"
          className={cn(
            'flex-1 h-9 text-xs font-medium',
            tab === 'media' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'
          )}
          onClick={() => setTab('media')}
        >
          {t('chatBuiltIn.room.sharedMedia')} ({images.length})
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 h-9 text-xs font-medium',
            tab === 'links' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'
          )}
          onClick={() => setTab('links')}
        >
          {t('chatBuiltIn.room.links')} ({links.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'media' ? (
          <div className="grid grid-cols-3 gap-0.5 p-1">
            {images.length === 0 ? (
              <div className="col-span-3 text-center text-xs text-[var(--color-text-secondary)] py-8">
                {t('chatBuiltIn.room.noSharedMedia')}
              </div>
            ) : (
              images.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  className="w-full aspect-square rounded overflow-hidden bg-[var(--color-background)] p-0 border-0 cursor-pointer"
                  onClick={() => msg.mediaUrl && window.open(msg.mediaUrl, '_blank')}
                  aria-label={msg.content}
                >
                  {msg.mediaThumbnailUrl || msg.mediaUrl ? (
                    <img
                      src={msg.mediaThumbnailUrl || msg.mediaUrl}
                      alt=""
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">
                      {msg.fileName?.match(/\.(pdf|doc|zip|rar)$/i) ? '📄' : '📎'}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="px-4 py-2">
            {links.length === 0 ? (
              <div className="text-center text-xs text-[var(--color-text-secondary)] py-8">{t('chatBuiltIn.room.noSharedLinks')}</div>
            ) : (
              links.map((msg) => {
                const urls = msg.content.match(/https?:\/\/[^\s]+/);
                if (!urls) return null;
                return (
                  <div key={msg.id} className="py-1.5">
                    <a
                      href={urls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-accent)] truncate block hover:underline"
                    >
                      {urls[0]}
                    </a>
                    <div className="text-[11px] text-[var(--color-text-secondary)] truncate">
                      {msg.senderName} - {new Date(msg.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
