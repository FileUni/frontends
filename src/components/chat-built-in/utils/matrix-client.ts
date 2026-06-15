import type { MatrixCredentials, MatrixLoginParams, MatrixRoom, MatrixMessage, MatrixSyncState } from '../types/matrix';

export interface IMatrixClient {
  login(params: MatrixLoginParams): Promise<MatrixCredentials>;
  startSync(credentials: MatrixCredentials): Promise<void>;
  stopSync(): void;
  getRooms(): MatrixRoom[];
  getRoomMessages(roomId: string): Promise<MatrixMessage[]>;
  loadMoreMessages(roomId: string): Promise<MatrixMessage[]>;
  sendMessage(roomId: string, content: string, replyTo?: string): Promise<void>;
  sendMedia(roomId: string, file: File): Promise<void>;
  markAsRead(roomId: string): Promise<void>;
  setTyping(roomId: string, typing: boolean): Promise<void>;
  onRooms(cb: (rooms: MatrixRoom[]) => void): void;
  onMessages(cb: (roomId: string, messages: MatrixMessage[]) => void): void;
  onSyncState(cb: (status: MatrixSyncState['status']) => void): void;
  onNewMessage(cb: (roomId: string, msg: MatrixMessage) => void): void;
  onTyping(cb: (roomId: string, users: string[]) => void): void;
}

export async function createMatrixClient(): Promise<IMatrixClient> {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const { TauriMatrixClient } = await import('./matrix-client-tauri');
    return new TauriMatrixClient();
  }
  const { WebMatrixClient } = await import('./matrix-client-web');
  return new WebMatrixClient();
}
