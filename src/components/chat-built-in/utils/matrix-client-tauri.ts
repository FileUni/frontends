import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { IMatrixClient } from './matrix-client';
import type { MatrixCredentials, MatrixLoginParams, MatrixRoom, MatrixMessage, MatrixSyncState } from '../types/matrix';

type SyncStatusListener = (status: MatrixSyncState['status']) => void;
type NewMessageListener = (roomId: string, msg: MatrixMessage) => void;
type RoomsListener = (rooms: MatrixRoom[]) => void;
type MessagesListener = (roomId: string, messages: MatrixMessage[]) => void;
type TypingListener = (roomId: string, users: string[]) => void;

interface NewMessageEvent {
  room_id: string;
  event_id: string;
  sender: string;
  body: string;
  timestamp: number;
  msgtype: string;
}

interface TypingEvent {
  room_id: string;
  users: string[];
}

interface RoomUpdateEvent {
  id: string;
  last_message: string | null;
  last_message_timestamp: number | null;
  unread_count: number;
}

interface GetMessagesResult {
  messages: Array<{
    event_id: string;
    sender: string;
    body: string;
    timestamp: number;
    msgtype: string;
  }>;
  start: string;
  end: string | null;
}

export class TauriMatrixClient implements IMatrixClient {
  private rooms: MatrixRoom[] = [];
  private roomMessages: Record<string, MatrixMessage[]> = {};
  private lastTimestamps: Record<string, number> = {};
  private unlistenList: UnlistenFn[] = [];
  private syncing = false;

  private roomsCb: RoomsListener | null = null;
  private messagesCb: MessagesListener | null = null;
  private syncStateCb: SyncStatusListener | null = null;
  private newMessageCb: NewMessageListener | null = null;
  private typingCb: TypingListener | null = null;

  async login(params: MatrixLoginParams): Promise<MatrixCredentials> {
    const session = await invoke<{
      homeserver_url: string;
      access_token: string;
      user_id: string;
      device_id: string;
    }>('matrix_login', {
      homeserverUrl: params.homeserverUrl,
      username: params.username,
      password: params.password,
    });
    return {
      homeserverUrl: session.homeserver_url,
      accessToken: session.access_token,
      userId: session.user_id,
      deviceId: session.device_id,
    };
  }

  async startSync(_credentials: MatrixCredentials): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    await this.setupListeners();
    await this.initialFetch();
  }

  stopSync(): void {
    this.syncing = false;
    for (const unlisten of this.unlistenList) {
      unlisten();
    }
    this.unlistenList = [];
    this.syncStateCb?.('disconnected');
    invoke('matrix_stop_sync').catch(() => {});
  }

  private async setupListeners(): Promise<void> {
    const u1 = await listen<RoomUpdateEvent[]>('matrix-rooms-updated', (event) => {
      this.applyRoomUpdates(event.payload);
    });

    const u2 = await listen<string>('matrix-sync-status', (event) => {
      const status: MatrixSyncState['status'] =
        event.payload === 'synced' ? 'synced' : 'connecting';
      this.syncStateCb?.(status);
    });

    const u3 = await listen<string>('matrix-error', () => {
      this.syncStateCb?.('error');
    });

    const u4 = await listen<NewMessageEvent>('matrix-new-message', (event) => {
      this.handleNewMessage(event.payload);
    });

    const u5 = await listen<TypingEvent>('matrix-typing', (event) => {
      this.typingCb?.(event.payload.room_id, event.payload.users);
    });

    this.unlistenList = [u1, u2, u3, u4, u5];
  }

  private handleNewMessage(payload: NewMessageEvent): void {
    const msg = this.toMatrixMessageFull(payload);
    const roomMsgs = this.roomMessages[payload.room_id] ?? [];
    const updated = [msg, ...roomMsgs];
    this.roomMessages[payload.room_id] = updated;
    this.messagesCb?.(payload.room_id, updated);
    this.newMessageCb?.(payload.room_id, msg);
  }

  private async initialFetch(): Promise<void> {
    try {
      const rooms = await invoke<Array<{
        id: string; name: string; topic: string;
        member_count: number; avatar_url: string | null;
        last_message: string | null; last_message_timestamp: number | null;
        unread_count: number;
      }>>('matrix_get_rooms');

      const newRooms: MatrixRoom[] = rooms.map((r) => {
        const room: MatrixRoom = {
          id: r.id,
          name: r.name,
          unreadCount: r.unread_count,
          timestamp: r.last_message_timestamp ?? 0,
          memberCount: r.member_count,
          isDirect: r.member_count <= 2,
          typingUsers: [],
        };
        if (r.last_message) {
          room.lastMessage = {
            id: `${r.id}_summary`,
            roomId: r.id,
            sender: '',
            senderName: '',
            content: r.last_message,
            timestamp: r.last_message_timestamp ?? 0,
            type: 'text',
            status: 'sent',
          };
        }
        return room;
      });

      for (const room of newRooms) {
        this.lastTimestamps[room.id] = room.timestamp;
      }
      this.rooms = newRooms;
      this.roomsCb?.(this.rooms);
    } catch {
      // initial fetch failed
    }
  }

  private applyRoomUpdates(updates: RoomUpdateEvent[]): void {
    for (const u of updates) {
      const existing = this.rooms.find((r) => r.id === u.id);

      if (existing) {
        existing.unreadCount = u.unread_count;
        existing.timestamp = u.last_message_timestamp ?? existing.timestamp;
      } else {
        this.rooms.push({
          id: u.id,
          name: u.id,
          unreadCount: u.unread_count,
          timestamp: u.last_message_timestamp ?? 0,
          memberCount: 0,
          isDirect: false,
          typingUsers: [],
        });
      }
      this.lastTimestamps[u.id] = u.last_message_timestamp ?? this.lastTimestamps[u.id] ?? 0;
    }
    this.roomsCb?.(this.rooms);
  }

  getRooms(): MatrixRoom[] {
    return this.rooms;
  }

  async getRoomMessages(roomId: string): Promise<MatrixMessage[]> {
    try {
      const result = await invoke<GetMessagesResult>('matrix_get_messages', {
        roomId,
        limit: 50,
        from: null,
      });
      const msgs = result.messages.map((m) => this.toMatrixMessage(m, roomId));
      this.roomMessages[roomId] = msgs;
      this.messagesCb?.(roomId, msgs);
      return msgs;
    } catch {
      return [];
    }
  }

  async loadMoreMessages(roomId: string): Promise<MatrixMessage[]> {
    const existing = this.roomMessages[roomId] || [];
    if (existing.length === 0) return [];

    const oldestEventId = existing[existing.length - 1]?.id;
    try {
      const result = await invoke<GetMessagesResult>('matrix_get_messages', {
        roomId,
        limit: 50,
        from: oldestEventId,
      });
      const olderMsgs = result.messages
        .filter((m) => !existing.some((e) => e.id === m.event_id))
        .map((m) => this.toMatrixMessage(m, roomId));
      this.roomMessages[roomId] = [...existing, ...olderMsgs];
      this.messagesCb?.(roomId, this.roomMessages[roomId]);
      return olderMsgs;
    } catch {
      return [];
    }
  }

  private toMatrixMessage(m: GetMessagesResult['messages'][0], roomId: string): MatrixMessage {
    const type = this.toMsgType(m.msgtype);
    return {
      id: m.event_id,
      roomId,
      sender: m.sender,
      senderName: m.sender.split(':')[0]?.replace('@', '') || m.sender,
      content: m.body,
      timestamp: m.timestamp,
      type,
      status: 'sent',
    };
  }

  private toMatrixMessageFull(m: NewMessageEvent): MatrixMessage {
    const type = this.toMsgType(m.msgtype);
    return {
      id: m.event_id,
      roomId: m.room_id,
      sender: m.sender,
      senderName: m.sender.split(':')[0]?.replace('@', '') || m.sender,
      content: m.body,
      timestamp: m.timestamp,
      type,
      status: 'sent',
    };
  }

  private toMsgType(msgtype: string): MatrixMessage['type'] {
    return msgtype === 'm.emote' ? 'emote'
      : msgtype === 'm.notice' ? 'notice'
      : msgtype.startsWith('m.image') ? 'image'
      : msgtype.startsWith('m.video') ? 'video'
      : msgtype.startsWith('m.audio') ? 'audio'
      : msgtype.startsWith('m.file') ? 'file'
      : 'text';
  }

  async sendMessage(roomId: string, content: string, replyTo?: string): Promise<void> {
    await invoke('matrix_send_message', { roomId, text: content, replyTo: replyTo ?? null });
  }

  async sendMedia(roomId: string, file: File): Promise<void> {
    const filePath = (file as unknown as { path?: string }).path;
    if (filePath) {
      await invoke('matrix_send_media', {
        roomId,
        filePath,
        filename: file.name,
        mimeType: file.type,
      });
    } else {
      const buffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));
      await invoke('matrix_send_media', {
        roomId,
        filePath: null,
        data,
        filename: file.name,
        mimeType: file.type,
      });
    }
  }

  async markAsRead(roomId: string): Promise<void> {
    const msgs = this.roomMessages[roomId];
    if (!msgs || msgs.length === 0) return;
    const lastEventId = msgs[0]?.id;
    if (!lastEventId) return;
    try {
      await invoke('matrix_mark_read', { roomId, eventId: lastEventId });
    } catch {
      // mark read failed
    }
  }

  async setTyping(roomId: string, typing: boolean): Promise<void> {
    try {
      await invoke('matrix_set_typing', { roomId, typing });
    } catch {
      // set typing failed
    }
  }

  onRooms(cb: RoomsListener): void { this.roomsCb = cb; }
  onMessages(cb: MessagesListener): void { this.messagesCb = cb; }
  onSyncState(cb: SyncStatusListener): void { this.syncStateCb = cb; }
  onNewMessage(cb: NewMessageListener): void { this.newMessageCb = cb; }
  onTyping(cb: TypingListener): void { this.typingCb = cb; }
}
