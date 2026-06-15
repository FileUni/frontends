export interface ChatNotification {
  id: string;
  source: 'matrix';
  title: string;
  body: string;
  icon?: string;
  roomId?: string;
  senderId?: string;
  timestamp: number;
  read: boolean;
}
