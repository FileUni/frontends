import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useMatrixStore } from '../store/matrixStore';
import { useMqttStore } from '../store/mqttStore';
import { getAvatarGradient, getInitials } from '../utils/avatar';
import i18next from 'i18next';
import { cn } from '@/lib/utils';
import type { MatrixRoom } from '../types/matrix';
import type { MqttContact } from '../types/mqtt';
import { AddContactDialog } from './AddContactDialog';
import { AccountManagerModal } from './AccountManagerModal';

interface ChatSidebarProps {
  onSelectRoom?: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ onSelectRoom }) => {
  const { t } = useTranslation();
  const { rooms, currentRoomId, searchQuery, chatType, activeContactId, accounts, activeAccountId } = useMatrixClient();
  const { selectRoom, setSearchQuery, setChatType } = useMatrixStore();
  const mqttContacts = useMqttStore((s) => s.contacts);
  const setActiveContact = useMqttStore((s) => s.setActiveContact);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);

  const visibleRooms = rooms.filter((r) => !r.archived);
  const archivedRooms = rooms.filter((r) => r.archived);
  const sortedRooms = [...visibleRooms].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });
  const sortedArchived = [...archivedRooms].sort((a, b) => b.timestamp - a.timestamp);

  const filteredRooms = searchQuery
    ? sortedRooms.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedRooms;

  const filteredMqtt = searchQuery
    ? mqttContacts.filter((c) => c.peerName.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : mqttContacts;

  const handleSelectRoom = (roomId: string) => {
    setChatType('matrix');
    selectRoom(roomId);
    onSelectRoom?.();
  };

  const handleSelectMqtt = (contactId: string) => {
    setChatType('mqtt');
    setActiveContact(contactId);
    onSelectRoom?.();
  };

  const activeAccountLabel = accounts.find((a) => a.id === activeAccountId)?.label || null;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-[var(--color-background)] rounded-lg px-3 h-10">
          <svg className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="flex-1 bg-transparent outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
            placeholder={t('chatBuiltIn.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filteredRooms.length === 0 && filteredMqtt.length === 0 && archivedRooms.length === 0 && accounts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
            {searchQuery ? t('chatBuiltIn.room.noSearchResults') : t('chatBuiltIn.noConversations')}
          </div>
        ) : (
          <>
            {/* Matrix rooms */}
            {accounts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  {t('chatBuiltIn.sidebar.signInPrompt')}
                </p>
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg bg-[#40a7e3] text-white hover:bg-[#3899d0] transition-colors"
                  onClick={() => setShowAccountManager(true)}
                >
                  {t('chatBuiltIn.login.signIn')}
                </button>
              </div>
            ) : filteredRooms.length === 0 && !searchQuery ? (
              <div className="px-4 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                {t('chatBuiltIn.room.noRoomsYet')}
              </div>
            ) : (
              filteredRooms.map((room) => (
                <RoomItem
                  key={room.id}
                  room={room}
                  active={chatType === 'matrix' && room.id === currentRoomId}
                  onSelect={() => handleSelectRoom(room.id)}
                  onPin={() => useMatrixStore.getState().setRoomPin(room.id, !room.pinned)}
                  onMute={() => useMatrixStore.getState().setRoomMute(room.id, !room.muted)}
                  onArchive={() => useMatrixStore.getState().setRoomArchive(room.id, true)}
                  onDelete={() => useMatrixStore.getState().deleteRoom(room.id)}
                />
              ))
            )}

            {/* MQTT contacts */}
            {filteredMqtt.map((contact) => (
              <MqttContactItem
                key={contact.id}
                contact={contact}
                active={chatType === 'mqtt' && contact.id === activeContactId}
                onSelect={() => handleSelectMqtt(contact.id)}
              />
            ))}

            {/* Add MQTT contact button - always visible */}
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)] transition-colors"
              onClick={() => setShowAddContact(true)}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed border-[var(--color-divider)] text-[var(--color-text-tertiary)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span>{t('chatBuiltIn.mqtt.addContact')}</span>
            </button>

            {/* Archived rooms */}
            {archivedRooms.length > 0 && !searchQuery && (
              <>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)]"
                  onClick={() => setShowArchive(!showArchive)}
                >
                  <svg className={`w-3 h-3 transition-transform ${showArchive ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('chatBuiltIn.sidebar.archive')} ({archivedRooms.length})
                </button>
                {showArchive && sortedArchived.map((room) => (
                  <RoomItem
                    key={room.id}
                    room={room}
                    active={chatType === 'matrix' && room.id === currentRoomId}
                    onSelect={() => handleSelectRoom(room.id)}
                    onMute={() => useMatrixStore.getState().setRoomMute(room.id, !room.muted)}
                    onArchive={() => useMatrixStore.getState().setRoomArchive(room.id, false)}
                    onDelete={() => useMatrixStore.getState().deleteRoom(room.id)}
                    archived
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom: account button */}
      <div className="flex-shrink-0 border-t border-[var(--color-divider)]">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-item-hover)] transition-colors"
          onClick={() => setShowAccountManager(true)}
        >
          {activeAccountLabel ? (
            <>
              <div className="w-7 h-7 rounded-full bg-[#40a7e3] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {activeAccountLabel[0]?.toUpperCase() || '?'}
              </div>
              <span className="truncate flex-1 text-left">{activeAccountLabel}</span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-full bg-[var(--color-text-tertiary)] flex items-center justify-center text-white text-xs flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="truncate flex-1 text-left text-[var(--color-text-secondary)]">{t('chatBuiltIn.sidebar.manageAccounts')}</span>
            </>
          )}
          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Add Contact Dialog */}
      {showAddContact && <AddContactDialog onClose={() => setShowAddContact(false)} />}

      {/* Account Manager Modal */}
      {showAccountManager && (
        <AccountManagerModal onClose={() => setShowAccountManager(false)} />
      )}
    </div>
  );
};

interface RoomItemProps {
  room: MatrixRoom;
  active: boolean;
  onSelect: () => void;
  onPin?: (() => void) | undefined;
  onMute?: (() => void) | undefined;
  onArchive?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  archived?: boolean | undefined;
}

const RoomItem: React.FC<RoomItemProps> = ({ room, active, onSelect, onPin, onMute, onArchive, onDelete, archived }) => {
  const { t } = useTranslation();
  const gradient = getAvatarGradient(room.id);
  const initials = getInitials(room.name);
  const time = formatTime(room.timestamp);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative group">
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
          active
            ? 'bg-[var(--color-sidebar-item-active)]'
            : 'hover:bg-[var(--color-sidebar-item-hover)]'
        )}
        onClick={onSelect}
      >
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ background: gradient }}
          >
            {room.avatarUrl ? (
              <img src={room.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          {room.presence && (
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-sidebar)]',
                room.presence === 'online' ? 'bg-green-500' : 'bg-[var(--color-text-secondary)]'
              )}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
              {room.pinned && (
                <svg className="w-3 h-3 text-[var(--color-text-secondary)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
              )}
              {room.muted && (
                <svg className="w-3 h-3 text-[var(--color-text-secondary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
              {room.name}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0 ml-2">
              {time}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm text-[var(--color-text-secondary)] truncate">
              {room.typingUsers.length > 0 ? (
                <span className="text-[var(--color-accent)]">
                  {i18next.t('chatBuiltIn.room.typing', { users: room.typingUsers.join(', ') })}
                </span>
              ) : (
                room.lastMessage?.content || ''
              )}
            </span>
            {room.unreadCount > 0 && (
              <span className="flex-shrink-0 ml-2 bg-[var(--color-unread-badge)] text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 font-medium">
                {room.unreadCount > 99 ? '99+' : room.unreadCount}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)] rounded"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          aria-label={t('chatBuiltIn.room.options')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </button>

      {menuOpen && (
        <div
          className="absolute right-2 top-10 z-40 bg-[var(--color-sidebar)] border border-[var(--color-divider)] rounded-lg shadow-lg py-1 min-w-[140px]"
          onClick={() => setMenuOpen(false)}
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false); }}
        >
          {onPin && <MenuAction label={room.pinned ? t('chatBuiltIn.room.unpin') : t('chatBuiltIn.room.pin')} onClick={onPin} />}
          {onMute && <MenuAction label={room.muted ? t('chatBuiltIn.room.unmute') : t('chatBuiltIn.room.mute')} onClick={onMute} />}
          {onArchive && <MenuAction label={archived ? t('chatBuiltIn.room.unarchive') : t('chatBuiltIn.room.archiveRoom')} onClick={onArchive} />}
          <div className="border-t border-[var(--color-divider)] my-1" />
          {onDelete && <MenuAction label={t('chatBuiltIn.room.delete')} onClick={onDelete} danger />}
        </div>
      )}
    </div>
  );
};

interface MqttContactItemProps {
  contact: MqttContact;
  active: boolean;
  onSelect: () => void;
}

const MqttContactItem: React.FC<MqttContactItemProps> = ({ contact, active, onSelect }) => {
  const time = formatTime(contact.lastTimestamp || contact.createdAt);
  const statusColor = contact.status === 'online' ? 'bg-green-500' : contact.status === 'connecting' ? 'bg-yellow-500' : 'bg-[var(--color-text-secondary)]';

  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        active
          ? 'bg-[var(--color-sidebar-item-active)]'
          : 'hover:bg-[var(--color-sidebar-item-hover)]'
      )}
      onClick={onSelect}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-[var(--color-accent)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
          </svg>
        </div>
        <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-sidebar)]', statusColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-text-primary)] truncate">
            {contact.peerName}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0 ml-2">
            {time}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-[var(--color-text-secondary)] truncate">
            {contact.lastMessage || ''}
          </span>
          {contact.unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 bg-[var(--color-unread-badge)] text-white text-xs rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 font-medium">
              {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

function MenuAction({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${danger ? 'text-red-500' : 'text-[var(--color-text-primary)]'} hover:bg-[var(--color-sidebar-item-hover)]`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
    return i18next.t('chatBuiltIn.room.yesterday');
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
