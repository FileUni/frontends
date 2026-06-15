export interface MatrixCredentials {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}

export function credentialsLabel(creds: MatrixCredentials): string {
  return creds.userId.split(':')[0]?.replace('@', '') || creds.userId;
}

export interface MatrixLoginParams {
  homeserverUrl: string;
  username: string;
  password: string;
}

export interface MatrixAccount {
  id: string;
  label: string;
  credentials: MatrixCredentials;
  syncState: MatrixSyncState;
  rooms: MatrixRoom[];
  currentRoomId: string | null;
  messages: Record<string, MatrixMessage[]>;
}

export interface MatrixRoom {
  id: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: MatrixMessage;
  unreadCount: number;
  timestamp: number;
  isDirect: boolean;
  memberCount: number;
  typingUsers: string[];
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  presence?: 'online' | 'offline';
}

export interface MatrixReaction {
  key: string;
  count: number;
  self: boolean;
}

export interface MatrixMessage {
  id: string;
  roomId: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  formattedContent?: string;
  timestamp: number;
  type: 'text' | 'image' | 'file' | 'video' | 'audio' | 'emote' | 'notice';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: string;
  replyMsg?: MatrixMessage;
  edited?: boolean;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaThumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  reactions?: MatrixReaction[];
}

export interface MatrixSyncState {
  status: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error';
  error?: string;
}

export interface MatrixSearchResult {
  roomId: string;
  roomName: string;
  message: MatrixMessage;
}

const ACCOUNTS_STORAGE_KEY = 'matrix_accounts';

export function loadAccounts(): MatrixAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function saveAccounts(accounts: MatrixAccount[]): void {
  try { localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts)); } catch { /* noop */ }
}

export function generateAccountId(): string {
  return `matrix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
