export interface MqttContact {
  id: string;
  name: string;
  brokerUrl: string;
  topic: string;
  clientId: string;
  peerId: string;
  peerName: string;
  lastMessage?: string;
  lastTimestamp?: number;
  unreadCount: number;
  status: MqttConnectionStatus;
  createdAt: number;
}

export type MqttConnectionStatus = 'offline' | 'connecting' | 'online';

export interface MqttMessage {
  id: string;
  contactId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'text' | 'handshake' | 'system';
  status: 'sending' | 'sent' | 'failed';
}
