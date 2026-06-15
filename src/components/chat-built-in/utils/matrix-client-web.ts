import {
  createClient,
  type MatrixClient,
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  type MatrixEvent,
  type Room,
  type RoomMember,
  type SyncState,
  type IRoomTimelineData,
  Direction,
} from 'matrix-js-sdk';
import type { IMatrixClient } from './matrix-client';
import type { MatrixCredentials, MatrixLoginParams, MatrixRoom, MatrixMessage, MatrixSyncState } from '../types/matrix';

const MESSAGE_EVENT = 'm.room.message';

export class WebMatrixClient implements IMatrixClient {
  private client: MatrixClient | null = null;
  private rooms_: MatrixRoom[] = [];
  private roomMessages_: Record<string, MatrixMessage[]> = {};
  private credentials_: MatrixCredentials | null = null;

  private roomsCb: ((rooms: MatrixRoom[]) => void) | null = null;
  private messagesCb: ((roomId: string, messages: MatrixMessage[]) => void) | null = null;
  private syncStateCb: ((status: MatrixSyncState['status']) => void) | null = null;
  private newMessageCb: ((roomId: string, msg: MatrixMessage) => void) | null = null;
  private typingCb: ((roomId: string, users: string[]) => void) | null = null;

  async login(params: MatrixLoginParams): Promise<MatrixCredentials> {
    const client = createClient({ baseUrl: params.homeserverUrl });
    const response = await client.loginWithPassword(params.username, params.password);
    this.credentials_ = {
      homeserverUrl: params.homeserverUrl,
      accessToken: response.access_token!,
      userId: response.user_id!,
      deviceId: response.device_id ?? undefined,
    };
    this.client = client;
    return this.credentials_;
  }

  async startSync(credentials: MatrixCredentials): Promise<void> {
    this.credentials_ = credentials;
    this.client = createClient({
      baseUrl: credentials.homeserverUrl,
      accessToken: credentials.accessToken,
      userId: credentials.userId,
    });
    await this.client.startClient({ initialSyncLimit: 20 });
    this.registerListeners();
  }

  stopSync(): void {
    this.client?.stopClient();
    this.client = null;
    this.syncStateCb?.('disconnected');
  }

  private registerListeners(): void {
    if (!this.client) return;

    this.client.on(ClientEvent.Sync, (state: SyncState) => {
      const status: MatrixSyncState['status'] =
        state === 'PREPARED' ? 'synced'
        : state === 'SYNCING' ? 'syncing'
        : state === 'ERROR' ? 'error'
        : 'connecting';
      this.syncStateCb?.(status);
    });

    this.client.on(RoomEvent.Timeline, (
      event: MatrixEvent,
      room: Room | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean | undefined,
      _data: IRoomTimelineData | undefined,
    ) => {
      if (!room || event.getType() !== MESSAGE_EVENT) return;
      const msg = this.toMatrixMessage(event, room.roomId);
      if (!msg) return;
      const existing = this.roomMessages_[room.roomId] || [];
      this.roomMessages_[room.roomId] = [msg, ...existing];
      this.newMessageCb?.(room.roomId, msg);
      this.updateRoomFromTimeline(room.roomId);
    });

    this.client.on(RoomMemberEvent.Typing, (
      _event: MatrixEvent,
      member: RoomMember,
    ) => {
      if (member.roomId) {
        this.typingCb?.(member.roomId, member.typing ? [member.name || member.userId] : []);
      }
    });

    this.client.on(ClientEvent.Event, (event: MatrixEvent) => {
      const roomId = event.getRoomId();
      if (!roomId || event.getType() !== MESSAGE_EVENT) return;
      this.updateRoomFromTimeline(roomId);
    });
  }

  private updateRoomFromTimeline(roomId: string): void {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;

    const timeline = room.getLiveTimeline().getEvents();
    const lastEvent = timeline[timeline.length - 1];
    const lastMsg = lastEvent ? this.toMatrixMessage(lastEvent, roomId) : undefined;

    const existing = this.rooms_.find((r) => r.id === roomId);
    const updated: MatrixRoom = {
      id: roomId,
      name: room.name || roomId,
      unreadCount: existing?.unreadCount ?? 0,
      timestamp: lastEvent?.getTs() ?? existing?.timestamp ?? 0,
      isDirect: room.getMyMembership() === 'join' && room.getJoinedMemberCount() <= 2,
      memberCount: room.getJoinedMemberCount(),
      typingUsers: [],
    };
    if (lastMsg) updated.lastMessage = lastMsg;

    const idx = this.rooms_.findIndex((r) => r.id === roomId);
    if (idx >= 0) {
      this.rooms_[idx] = updated;
    } else {
      this.rooms_.push(updated);
    }
    this.rooms_.sort((a, b) => b.timestamp - a.timestamp);
    this.roomsCb?.(this.rooms_);

    const msgs = timeline
      .filter((e) => e.getType() === MESSAGE_EVENT)
      .map((e) => this.toMatrixMessage(e, roomId))
      .filter((m): m is MatrixMessage => m !== null);
    msgs.reverse();
    this.roomMessages_[roomId] = msgs;
    this.messagesCb?.(roomId, msgs);
  }

  private toMatrixMessage(event: MatrixEvent, roomId: string): MatrixMessage | null {
    const content: Record<string, unknown> = event.getContent();
    if (!content) return null;
    const sender: string = event.getSender() ?? '';
    const ts = event.getTs();
    const msgtype = (content['msgtype'] as string) || 'm.text';
    const room = this.client?.getRoom(roomId);
    const member = room?.getMember(sender);

    const sName = member?.name || member?.rawDisplayName || sender.split(':')[0]?.replace('@', '') || 'Unknown';

    const base: MatrixMessage = {
      id: event.getId() || `${roomId}_${ts}`,
      roomId,
      sender,
      senderName: sName,
      content: (content['body'] as string) || '',
      timestamp: ts,
      type: msgtype === 'm.emote' ? 'emote' : msgtype === 'm.notice' ? 'notice' : 'text',
      status: event.status === null ? 'sent' : 'sending',
    };

    const avatarUrl = member?.getAvatarUrl(this.credentials_!.homeserverUrl, 48, 48, 'crop', false, false);
    if (avatarUrl) base.senderAvatar = avatarUrl;

    const formattedBody = content['formatted_body'] as string | undefined;
    if (formattedBody) base.formattedContent = formattedBody;

    const relatesTo = content['m.relates_to'] as Record<string, string> | undefined;
    if (relatesTo?.['rel_type'] === 'm.replace') base.edited = true;
    if (relatesTo?.['rel_type'] === 'm.annotation') return null;

    const url = content['url'] as string | undefined;
    if (url) {
      const info = content['info'] as Record<string, unknown> | undefined;
      const mimeType = info?.['mimetype'] as string | undefined;
      const isImage = mimeType?.startsWith('image/');
      const isVideo = mimeType?.startsWith('video/');
      const isAudio = mimeType?.startsWith('audio/');
      base.type = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file';
      base.mediaUrl = this.credentials_!.homeserverUrl + '/_matrix/media/v3/download/' + url.replace('mxc://', '');
      if (mimeType) base.mediaMimeType = mimeType;
      const body = content['body'] as string | undefined;
      if (body) base.fileName = body;
      const size = info?.['size'] as number | undefined;
      if (size) base.fileSize = size;
      if (isImage) base.mediaThumbnailUrl = base.mediaUrl;
    }

    return base;
  }

  getRooms(): MatrixRoom[] { return this.rooms_; }
  async getRoomMessages(roomId: string): Promise<MatrixMessage[]> { return this.roomMessages_[roomId] || []; }
  async loadMoreMessages(roomId: string): Promise<MatrixMessage[]> {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const timeline = room.getLiveTimeline();
    const paginationToken = timeline.getPaginationToken(Direction.Backward);
    if (!paginationToken) return [];
    try {
      await this.client.paginateEventTimeline(timeline, { backwards: true, limit: 50 });
      const events = timeline.getEvents();
      const older = events
        .filter((e) => e.getType() === MESSAGE_EVENT)
        .map((e) => this.toMatrixMessage(e, roomId))
        .filter((m): m is MatrixMessage => m !== null);
      const existing = this.roomMessages_[roomId] || [];
      const newMsgs = older.filter((m) => !existing.some((e) => e.id === m.id));
      this.roomMessages_[roomId] = [...existing, ...newMsgs];
      this.messagesCb?.(roomId, this.roomMessages_[roomId]);
      return newMsgs;
    } catch {
      return [];
    }
  }

  async sendMessage(roomId: string, content: string, replyTo?: string): Promise<void> {
    if (!this.client) return;
    if (replyTo) {
      const contentWithReply: Record<string, unknown> = {
        body: content,
        msgtype: 'm.text',
        'm.relates_to': { 'm.in_reply_to': { event_id: replyTo } },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK overload is too complex to type precisely
      await this.client.sendMessage(roomId, contentWithReply as any);
    } else {
      await this.client.sendTextMessage(roomId, content);
    }
  }

  async sendMedia(roomId: string, file: File): Promise<void> {
    if (!this.client) return;
    const uploadResp = await this.client.uploadContent(file);
    const content = {
      msgtype: file.type.startsWith('image/') ? 'm.image' : 'm.file',
      body: file.name,
      url: uploadResp.content_uri,
      info: {
        size: file.size,
        mimetype: file.type,
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK overload is too complex to type precisely
    await this.client.sendEvent(roomId, 'm.room.message' as any, content);
  }

  async markAsRead(roomId: string): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    const events = room.getLiveTimeline().getEvents();
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      await this.client.sendReadReceipt(lastEvent).catch(() => {});
    }
  }

  async setTyping(roomId: string, typing: boolean): Promise<void> {
    if (!this.client) return;
    await this.client.sendTyping(roomId, typing, 10000).catch(() => {});
  }

  onRooms(cb: (rooms: MatrixRoom[]) => void): void { this.roomsCb = cb; }
  onMessages(cb: (roomId: string, messages: MatrixMessage[]) => void): void { this.messagesCb = cb; }
  onSyncState(cb: (status: MatrixSyncState['status']) => void): void { this.syncStateCb = cb; }
  onNewMessage(cb: (roomId: string, msg: MatrixMessage) => void): void { this.newMessageCb = cb; }
  onTyping(cb: (roomId: string, users: string[]) => void): void { this.typingCb = cb; }
}
