//! Chat system type definitions

export type TransportBackend = "ws" | "mqtt-proxy" | "mqtt-external";
export type TransportType = TransportBackend | "webrtc";

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  rawContent?: string; // Original encrypted text for re-decryption
  isEncrypted: boolean;
  isGroup: boolean;
  replyTo?: string; // Quoted message ID
  timestamp: number;
  transport: TransportType;
  status: "sending" | "delivered" | "read" | "failed" | "recalled";
  type: "text" | "system" | "file";
  decryptFailed?: boolean;
  fileInfo?: {
    name: string;
    size: number;
    mime: string;
    progress?: number;
    localUrl?: string;
  };
}

export interface Room {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount: number;
  isPending?: boolean;
  inviteCode?: string;
  lastMessage?: Message;
}

export interface ChatUserConfig {
  enabled: boolean;
  saveHistory: boolean;
  encryptionKey: string;
  transportBackend: TransportBackend;
  enableWebRTC: boolean;
  groupEncryptionKeys: Record<string, string>;
  mqttProxy: { topicPrefix: string };
  mqttExternal: {
    brokerUrl: string;
    username: string;
    password: string;
    topicPrefix: string;
  };
}

export type WireTextPayload = {
  id: string;
  from: string;
  to: string;
  content: string;
  is_group: boolean;
  reply_to?: string;
  timestamp: number;
  file_info?: Message["fileInfo"];
};
export type WireSignalPayload = {
  from: string;
  to: string;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
};
export type WireAckPayload = {
  id: string;
  msg_id: string;
  status: string;
  from: string;
  to: string;
  is_group: boolean;
  timestamp: number;
};
export type WireSystemPayload = { content: string; timestamp: number };
export type WireRecallPayload = {
  id: string;
  msg_id: string;
  from: string;
  to: string;
  is_group: boolean;
  timestamp: number;
};
export type WireReadPayload = {
  msg_ids: string[];
  from: string;
  to: string;
  is_group: boolean;
  timestamp: number;
};

export type WireMessage =
  | { type: "Text"; payload: WireTextPayload }
  | { type: "Signal"; payload: WireSignalPayload }
  | { type: "Ack"; payload: WireAckPayload }
  | { type: "Recall"; payload: WireRecallPayload }
  | { type: "Read"; payload: WireReadPayload }
  | { type: "System"; payload: WireSystemPayload };

export type ChatAuth =
  | { type: "system"; userId: string }
  | { type: "guest"; inviteCode: string };

export interface UserSearchInfo {
  user_id: string;
  nickname: string | null;
  username: string;
}

export interface GroupInfo {
  group_id: string;
  name: string;
  owner_uid: string;
  created_at: string;
}

export interface InviteInfo {
  id: string;
  nickname: string;
  code: string;
  expires_at: string;
  guest_count: number;
  default_nickname?: string | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  created_at: string;
}

export function resolveTopic(p: string, t: string, g: boolean) {
  return `${p || ""}${g ? "group" : "user"}/${t}`;
}
