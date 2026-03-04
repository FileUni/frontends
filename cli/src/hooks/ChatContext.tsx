import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import { toast } from "@fileuni/shared";
import { ChatCrypto } from "./ChatCrypto";
import { useLocalStorage } from "./useLocalStorage";
import { useAuthStore } from "@/stores/auth";
import { client } from "@/lib/api";
import { storageHub } from "@fileuni/shared";
import { resolveTopic } from "./ChatTypes";
import type {
  Message,
  Room,
  ChatUserConfig,
  TransportBackend,
  TransportType,
  WireMessage,
  WireTextPayload,
  WireAckPayload,
  WireSignalPayload,
  ChatAuth,
  UserSearchInfo,
  GroupInfo,
} from "./ChatTypes";
import { useChatWebRTC } from "./useChatWebRTC";

export type {
  Message,
  Room,
  ChatUserConfig,
  TransportBackend,
  TransportType,
  WireMessage,
  WireTextPayload,
  WireAckPayload,
  WireSignalPayload,
  ChatAuth,
  UserSearchInfo,
  GroupInfo,
};

// Chat system capabilities (fetched dynamically)
interface ChatCapabilities {
  enabled: boolean;
  enable_mqtt_proxy_broker?: boolean;
  stun_servers: string[];
  turn_servers: { url: string; username?: string; credential?: string }[];
  max_message_size_bytes: number;
  max_groups_per_user: number;
  max_members_per_group: number;
  max_groups_joined_per_user: number;
  rate_limit_window_secs: number;
  rate_limit_messages_per_window: number;
  chat_default_key?: string;
}

const isChatCapabilities = (value: unknown): value is ChatCapabilities => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ChatCapabilities>;
  return (
    typeof candidate.enabled === 'boolean' &&
    Array.isArray(candidate.stun_servers) &&
    Array.isArray(candidate.turn_servers)
  );
};

export interface ChatContextProps {
  messages: Message[];
  rooms: Room[];
  nicknames: Record<string, string>;
  isConnected: boolean;
  transport: TransportType;
  selfId: string;
  inviterId: string;
  sendMessage: (
    to: string,
    content: string,
    isGroup?: boolean,
  ) => Promise<void>;
  recallMessage: (
    msgId: string,
    to: string,
    isGroup?: boolean,
  ) => Promise<void>;
  startVoiceCall: (targetId: string) => Promise<void>;
  startVideoCall: (targetId: string) => Promise<void>;
  stopMediaCall: (targetId?: string) => void;
  sendFile: (targetId: string, file: File) => Promise<void>;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  clearHistory: (targetId?: string) => void;
  deleteMessage: (id: string) => void;
  markConversationRead: (targetId: string) => void;
  activeTarget: string;
  setActiveTarget: (targetId: string) => void;
  chatConfig: ChatUserConfig;
  updateChatConfig: (config: Partial<ChatUserConfig>) => void;
  sessionKeys: Record<string, string>;
  setSessionKey: (targetId: string, key: string) => void;
  showFloating: boolean;
  setShowFloating: (value: boolean) => void;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  updateNickname: (id: string, name: string) => void;
  capabilities: ChatCapabilities | null;
  refreshGroups: () => Promise<void>;
  onlineUsers: string[];
  quotingMessage: Message | null;
  setQuotingMessage: (msg: Message | null) => void;
  isKeyModalOpen: boolean;
  keyTargetId: string;
  openKeyModal: (targetId: string) => void;
  closeKeyModal: () => void;
  auth: ChatAuth;
  pendingGuests: Array<{
    guestId: string;
    nickname: string;
    inviteCode: string;
  }>;
  addPendingGuest: (
    guestId: string,
    nickname: string,
    inviteCode: string,
  ) => void;
  removePendingGuest: (guestId: string) => void;
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined);
const MAX_HISTORY_COUNT = 500;
const MAX_HISTORY_BYTES = 300 * 1024;

import i18next from "@/lib/i18n";

/**
 * Chat Error Boundary
 * When chat tree crashes, it handles the failure gracefully.
 */
export class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Chat] UNCAUGHT ERROR:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback !== undefined ? this.props.fallback : null;
    }
    return this.props.children;
  }
}

export const ChatProvider: React.FC<{
  children: React.ReactNode;
  auth: ChatAuth;
}> = ({ children, auth }) => {
  const [capabilities, setCapabilities] = useState<ChatCapabilities | null>(
    null,
  );

  // In guest mode, inviteCode is the new invite_id
  const storageKey =
    auth.type === "system"
      ? `chat_config_${auth.userId}`
      : `chat_config_guest_${auth.inviteCode}`;
  const historyKey =
    auth.type === "system"
      ? `chat_history_${auth.userId}`
      : `chat_history_guest_${auth.inviteCode}`;
  const nicknamesKey =
    auth.type === "system"
      ? `chat_nicknames_${auth.userId}`
      : `chat_nicknames_guest_${auth.inviteCode}`;

  const [sessionKeys, setSessionKeys] = useState<Record<string, string>>({});
  const setSessionKey = useCallback((targetId: string, key: string) => {
    setSessionKeys((prev) => ({ ...prev, [targetId]: key }));
  }, []);

  const [chatConfig, setChatConfig] = useLocalStorage<ChatUserConfig>(
    storageKey,
    {
      enabled: true,
      saveHistory: true,
      encryptionKey: "", // Keep field for compat but ignore in logic
      transportBackend: "ws",
      enableWebRTC: true,
      groupEncryptionKeys: {},
      mqttProxy: { topicPrefix: "yh_chat/" },
      mqttExternal: {
        brokerUrl: "",
        username: "",
        password: "",
        topicPrefix: "",
      },
    },
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryHydrated, setIsHistoryHydrated] = useState(false);

  const trimHistory = useCallback((next: Message[]) => {
    let trimmed = [...next];
    const encoder = new TextEncoder();
    while (trimmed.length > MAX_HISTORY_COUNT) trimmed.shift();
    while (trimmed.length > 0) {
      const bytes = trimmed.reduce(
        (sum, msg) => sum + encoder.encode(JSON.stringify(msg)).length,
        0,
      );
      if (bytes <= MAX_HISTORY_BYTES) break;
      trimmed.shift();
    }
    return trimmed;
  }, []);

  const addMessage = useCallback(
    (msg: Message) => {
      setMessages((prev) => trimHistory([...prev, msg]));
    },
    [trimHistory],
  );

  const updateMessageStatus = useCallback(
    (id: string, status: Message["status"], transport?: TransportType) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id !== id
            ? msg
            : { ...msg, status, transport: transport || msg.transport },
        ),
      );
    },
    [],
  );

  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [isNicknamesHydrated, setIsNicknamesHydrated] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState<TransportType>("ws");

  const prevTransportRef = useRef<TransportType>(transport);
  useEffect(() => {
    if (prevTransportRef.current !== transport) {
      const msg: Message = {
        id: `trans_${Date.now()}`,
        from: "system",
        to: "me",
        content: i18next.t("chat.transportSwitched", {
          from: prevTransportRef.current.toUpperCase(),
          to: transport.toUpperCase(),
          defaultValue: `Transport switched: ${prevTransportRef.current.toUpperCase()} ➔ ${transport.toUpperCase()}`,
        }),
        isEncrypted: false,
        isGroup: false,
        timestamp: Date.now(),
        transport: transport,
        status: "delivered",
        type: "system",
      };
      setMessages((prev) => trimHistory([...prev, msg]));
      prevTransportRef.current = transport;
    }
  }, [transport, trimHistory]);

  // selfId: guest mode uses auth.inviteCode (invite_id) directly
  const selfId = useMemo(() => {
    return auth.type === "system" ? auth.userId : auth.inviteCode;
  }, [auth]);

  const inviterIdKey =
    auth.type === "guest" ? `chat_inviter_id_${auth.inviteCode}` : "";
  const [inviterId, setInviterId] = useState(() => {
    if (inviterIdKey) {
      return storageHub.getLocalItem(inviterIdKey) || "";
    }
    return "";
  });

  useEffect(() => {
    if (inviterId && inviterIdKey) {
      storageHub.setLocalItem(inviterIdKey, inviterId);
    }
  }, [inviterId, inviterIdKey]);

  const [isOpen, setIsOpenInternal] = useState(false);
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      // Legacy support for OpenChat=true, primary use modalPage=chat
      const shouldOpen = params.get("modalPage") === "chat" || params.get("OpenChat") === "true";
      setIsOpenInternal(shouldOpen);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If there are other modals open (role="dialog"), let them handle it
        if (document.querySelector('[role="dialog"]')) return;
        
        // Otherwise close the chat
        setIsOpen(false);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("keydown", handleEsc, true);
    
    handleHashChange();
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("keydown", handleEsc, true);
    };
  }, []);

  const setIsOpen = useCallback((open: boolean) => {
    if (typeof window === "undefined") return;
    setIsOpenInternal(open);
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (open) {
      if (params.get("modalPage") !== "chat") {
        params.set("modalPage", "chat");
        params.delete("OpenChat"); // Clean legacy
        window.location.hash = params.toString();
      }
    } else {
      let changed = false;
      if (params.get("modalPage") === "chat") {
        params.delete("modalPage");
        changed = true;
      }
      if (params.has("OpenChat")) {
        params.delete("OpenChat");
        changed = true;
      }
      if (changed) {
        const newHash = params.toString();
        window.location.hash = newHash ? `#${newHash}` : "";
      }
    }
  }, []);

  const [activeTarget, setActiveTarget] = useState("");
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [quotingMessage, setQuotingMessage] = useState<Message | null>(null);

  const pendingGuestsKey =
    auth.type === "system"
      ? `chat_pending_guests_${auth.userId}`
      : `chat_pending_guests_guest_${auth.inviteCode}`;
  const [pendingGuests, setPendingGuests] = useState<
    Array<{ guestId: string; nickname: string; inviteCode: string }>
  >([]);
  const [isPendingGuestsHydrated, setIsPendingGuestsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    setIsHistoryHydrated(false);
    setMessages([]);
    const hydrateHistory = async () => {
      const rawValue = await storageHub.getItem(historyKey);
      if (!active) {
        return;
      }
      if (!rawValue) {
        setIsHistoryHydrated(true);
        return;
      }
      try {
        const parsed = JSON.parse(rawValue) as Message[];
        setMessages(Array.isArray(parsed) ? parsed : []);
      } catch {
        setMessages([]);
      } finally {
        setIsHistoryHydrated(true);
      }
    };
    void hydrateHistory();
    return () => {
      active = false;
    };
  }, [historyKey]);

  useEffect(() => {
    let active = true;
    setIsNicknamesHydrated(false);
    setNicknames({});
    const hydrateNicknames = async () => {
      const rawValue = await storageHub.getItem(nicknamesKey);
      if (!active) {
        return;
      }
      if (!rawValue) {
        setIsNicknamesHydrated(true);
        return;
      }
      try {
        const parsed = JSON.parse(rawValue) as Record<string, string>;
        setNicknames(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        setNicknames({});
      } finally {
        setIsNicknamesHydrated(true);
      }
    };
    void hydrateNicknames();
    return () => {
      active = false;
    };
  }, [nicknamesKey]);

  useEffect(() => {
    let active = true;
    setIsPendingGuestsHydrated(false);
    setPendingGuests([]);
    const hydratePendingGuests = async () => {
      const rawValue = await storageHub.getItem(pendingGuestsKey);
      if (!active) {
        return;
      }
      if (!rawValue) {
        setIsPendingGuestsHydrated(true);
        return;
      }
      try {
        const parsed = JSON.parse(rawValue) as Array<{ guestId: string; nickname: string; inviteCode: string }>;
        setPendingGuests(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPendingGuests([]);
      } finally {
        setIsPendingGuestsHydrated(true);
      }
    };
    void hydratePendingGuests();
    return () => {
      active = false;
    };
  }, [pendingGuestsKey]);

  const addPendingGuest = useCallback(
    (guestId: string, nickname: string, inviteCode: string) => {
      setPendingGuests((prev) => {
        if (prev.some((g) => g.guestId === guestId)) return prev;
        return [...prev, { guestId, nickname, inviteCode }];
      });
    },
    [],
  );

  const removePendingGuest = useCallback((guestId: string) => {
    setPendingGuests((prev) => prev.filter((g) => g.guestId !== guestId));
  }, []);

  const systemDefaultKey = capabilities?.chat_default_key || "";

  // Distinguish "enabled", "disabled", and "initializing"
  // Only consider disabled if server explicitly returns enabled: false
  const isChatActuallyDisabled =
    capabilities !== null && capabilities.enabled === false;
  const isChatEnabled = !isChatActuallyDisabled;
  const isInitializing = capabilities === null;

  const fetchOnlineUsers = useCallback(async () => {
    if (isChatEnabled && !isInitializing) {
      try {
        const queryParams: Record<string, string> = {};
        if (auth.type === "guest") {
          queryParams.invite_id = auth.inviteCode;
        } else {
          const token = useAuthStore.getState().currentUserData?.access_token;
          if (token) queryParams.token = token;
        }
        const { data } = await client.GET("/api/v1/chat/users/online", {
          params: { query: queryParams },
        });
        if (data?.success && Array.isArray(data.data)) {
          const uids = (data.data as string[]).map((id) => id.toLowerCase());
          console.log("[Chat] Online users synced:", uids);
          setOnlineUsers(uids);
        } else if (data?.biz_code === "UNAUTHORIZED") {
          setOnlineUsers([]);
        }
      } catch (err) {
        console.error("[Chat] Failed to refresh online users:", err);
      }
    }
  }, [auth, isChatEnabled, isInitializing]);

  useEffect(() => {
    if (isOpen) {
      fetchOnlineUsers();
      const timer = setInterval(fetchOnlineUsers, 10000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [isOpen, fetchOnlineUsers]);

  const clearHistory = useCallback(
    (targetId?: string) => {
      if (targetId) {
        setMessages((prev) =>
          prev.filter((m) => {
            const mTarget = m.isGroup
              ? m.to
              : m.from === selfId
                ? m.to
                : m.from;
            return mTarget !== targetId;
          }),
        );
      } else {
        setMessages([]);
        void storageHub.removeItem(historyKey);
      }
    },
    [historyKey, selfId],
  );

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [keyTargetId, setKeyTargetId] = useState("");
  const openKeyModal = useCallback((targetId: string) => {
    setKeyTargetId(targetId);
    setIsKeyModalOpen(true);
  }, []);
  const closeKeyModal = useCallback(() => {
    setIsKeyModalOpen(false);
    setKeyTargetId("");
  }, []);

  const wsRef = useRef<WebSocket | null>(null);

  const mqttRef = useRef<MqttClient | null>(null);

  const handleWireMessageRef = useRef<
    ((raw: string, source: TransportType) => Promise<void>) | null
  >(null);

  const pendingMessagesRef = useRef<string[]>([]);

  const sendWireMessage = useCallback(
    (message: WireMessage) => {
      const json = JSON.stringify(message);
      if (chatConfig.transportBackend === "ws") {
        const ws = wsRef.current;
        if (!ws) {
          pendingMessagesRef.current.push(json);
          return;
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(json);
        } else if (ws.readyState === WebSocket.CONNECTING) {
          pendingMessagesRef.current.push(json);
        } else {
          setupWebSocket();
          pendingMessagesRef.current.push(json);
        }
      } else if (mqttRef.current?.connected) {
        const prefix =
          chatConfig.transportBackend === "mqtt-proxy"
            ? chatConfig.mqttProxy.topicPrefix
            : chatConfig.mqttExternal.topicPrefix;
        if (message.type === "Text")
          mqttRef.current.publish(
            resolveTopic(prefix, message.payload.to, message.payload.is_group),
            json,
          );
        else if (message.type === "Ack" || message.type === "Signal")
          mqttRef.current.publish(
            resolveTopic(prefix, message.payload.to, false),
            json,
          );
      }
    },
    [chatConfig],
  );

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const rtc = useChatWebRTC({
    selfId,
    stunServers: capabilities?.stun_servers || [],
    turnServers: capabilities?.turn_servers || [],
    enableWebRTC: chatConfig.enableWebRTC,
    transportBackend: chatConfig.transportBackend,
    nicknames,
    sendWireMessage,
    onMessage: async (raw, source) => {
      if (handleWireMessageRef.current)
        await handleWireMessageRef.current(raw, source);
    },
    onTransportChange: setTransport,
    onConnectionStatus: (targetId, status) => {
      const isConnected = status === "connected";
      const msg: Message = {
        id: `rtc_stat_${targetId}_${Date.now()}`,
        from: "system",
        to: targetId,
        content: isConnected ? "P2P_CONNECTED" : "P2P_DISCONNECTED",
        isEncrypted: false,
        isGroup: false,
        timestamp: Date.now(),
        transport: "webrtc",
        status: "delivered",
        type: "system",
      };
      setMessages((prev) => trimHistory([...prev, msg]));
    },
    onRemoteStream: (targetId, stream) => {
      setRemoteStreams((prev) => {
        if (stream) return { ...prev, [targetId]: stream };
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    },
  });

  const startVoiceCall = useCallback(
    async (targetId: string) => {
      const stream = await rtc.startMediaCall(targetId, false);
      if (stream) setLocalStream(stream);
    },
    [rtc],
  );

  const startVideoCall = useCallback(
    async (targetId: string) => {
      const stream = await rtc.startMediaCall(targetId, true);
      if (stream) setLocalStream(stream);
    },
    [rtc],
  );

  const stopMediaCall = useCallback(
    (targetId?: string) => {
      rtc.stopMediaCall(targetId);
      setLocalStream(null);
    },
    [rtc],
  );

  const sendFile = useCallback(
    async (targetId: string, file: File) => {
      const msgId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      addMessage({
        id: msgId,
        from: selfId,
        to: targetId,
        content: `Sending file: ${file.name}`,
        isEncrypted: false,
        isGroup: false,
        timestamp: Date.now(),
        transport: "webrtc",
        status: "sending",
        type: "file",
        fileInfo: {
          name: file.name,
          size: file.size,
          mime: file.type,
          progress: 0,
        },
      });

      try {
        await rtc.sendFile(targetId, file, (progress) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? { ...m, fileInfo: { ...m.fileInfo!, progress } }
                : m,
            ),
          );
        });
        updateMessageStatus(msgId, "delivered", "webrtc");
      } catch (err) {
        updateMessageStatus(msgId, "failed");
        console.error("[Chat] File transfer failed:", err);
      }
    },
    [rtc, selfId, addMessage, updateMessageStatus],
  );

  const refreshGroups = useCallback(async () => {
    if (auth.type === "system" && isChatEnabled) {
      try {
        const { data } = await client.GET("/api/v1/chat/groups");
        if (data?.success && Array.isArray(data.data)) {
          const ids = (data.data as GroupInfo[]).map((g) => g.group_id);
          setUserGroups(ids);
        }
      } catch (err) {
        console.error("[Chat] Failed to refresh groups:", err);
      }
    }
  }, [auth.type, isChatEnabled]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const fetchCapabilities = useCallback(async (retryCount = 0) => {
    try {
      const { data, error } = await (client.GET as (path: string) => Promise<{ data?: unknown; error?: unknown }>)("/api/v1/chat/public/capabilities");
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success?: boolean }).success === true &&
        'data' in data &&
        isChatCapabilities((data as { data?: unknown }).data)
      ) {
        setCapabilities((data as { data: ChatCapabilities }).data);
        console.log("[Chat] Capabilities loaded successfully");
      } else {
        throw new Error(error ? JSON.stringify(error) : "Success false");
      }
    } catch (err) {
      console.error(`[Chat] Failed to fetch capabilities (attempt ${retryCount + 1}):`, err);
      if (retryCount < 3) {
        setTimeout(() => fetchCapabilities(retryCount + 1), 2000);
      }
    }
  }, []);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  /**
   * Auto-retry failed decryptions
   * Triggered when keys, capabilities config, or message list changes
   */
  useEffect(() => {
    let active = true;
    const retryAll = async () => {
      let changed = false;
      const nextMessages = await Promise.all(
        messages.map(async (msg) => {
          if (!msg.decryptFailed || !msg.rawContent) return msg;
          
          // If content no longer looks encrypted, clear the failure badge
          if (!ChatCrypto.isEncrypted(msg.rawContent)) {
            changed = true;
            return { ...msg, decryptFailed: false, rawContent: undefined };
          }

          const targetId = msg.isGroup
            ? msg.to
            : msg.from === selfId
              ? msg.to
              : msg.from;
          
          const sessionKey = sessionKeys[targetId];
          const groupKey = msg.isGroup ? chatConfig.groupEncryptionKeys[msg.to] : undefined;
          const keysToTry = [sessionKey, groupKey, systemDefaultKey].filter(Boolean) as string[];
          
          if (keysToTry.length === 0) return msg;

          for (const key of keysToTry) {
            try {
              const decrypted = await ChatCrypto.decrypt(msg.rawContent, key);
              if (decrypted !== msg.rawContent) { 
                changed = true;
                return { ...msg, content: decrypted, decryptFailed: false, rawContent: undefined };
              }
            } catch {
              continue;
            }
          }
          return msg;
        }),
      );
      if (active && changed) {
        setMessages(nextMessages);
      }
    };
    
    // Only run if there are failed messages
    if (messages.some(m => m.decryptFailed)) {
      retryAll();
    }

    return () => {
      active = false;
    };
  }, [sessionKeys, systemDefaultKey, chatConfig.groupEncryptionKeys, selfId, messages]);

  const rooms = useMemo(() => {
    const roomMap: Record<string, Room> = {};
    if (inviterId && inviterId !== selfId && inviterId !== "system") {
      roomMap[inviterId] = {
        id: inviterId,
        name: nicknames[inviterId] || inviterId.slice(0, 8),
        isGroup: false,
        unreadCount: 0,
        lastMessage: undefined,
      };
    }
    messages.forEach((msg) => {
      const targetId = msg.isGroup
        ? msg.to
        : msg.from === selfId
          ? msg.to
          : msg.from;
      if (targetId === "system" || targetId === "me" || targetId === selfId)
        return;
      if (!roomMap[targetId]) {
        const isGuest = targetId.includes(":");
        const rawName =
          nicknames[targetId] || targetId.split(":").pop() || targetId;
        roomMap[targetId] = {
          id: targetId,
          name: isGuest ? `${rawName} [Guest]` : rawName,
          isGroup: msg.isGroup,
          unreadCount: 0,
          lastMessage: msg,
        };
      }
      const room = roomMap[targetId];
      if (!room.lastMessage || msg.timestamp > room.lastMessage.timestamp)
        room.lastMessage = msg;
      if (msg.from !== selfId && msg.status !== "read") room.unreadCount++;
    });
    if (auth.type === "system") {
      onlineUsers.forEach((uid) => {
        if (uid === selfId || uid === "system") return;
        if (!roomMap[uid]) {
          const isGuest = uid.includes(":");
          const rawName = nicknames[uid] || uid.split(":").pop() || uid;
          roomMap[uid] = {
            id: uid,
            name: isGuest ? `${rawName} [Guest]` : rawName,
            isGroup: false,
            unreadCount: 0,
            lastMessage: undefined,
          };
        }
      });
      pendingGuests.forEach((guest) => {
        if (!roomMap[guest.guestId]) {
          roomMap[guest.guestId] = {
            id: guest.guestId,
            name: `${guest.nickname} [Pending]`,
            isGroup: false,
            unreadCount: 0,
            lastMessage: undefined,
            isPending: true,
            inviteCode: guest.inviteCode,
          };
        }
      });
    }
    return Object.values(roomMap).sort(
      (a, b) =>
        (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0),
    );
  }, [
    messages,
    selfId,
    nicknames,
    inviterId,
    onlineUsers,
    auth.type,
    pendingGuests,
  ]);

  useEffect(() => {
    if (auth.type === "guest" && inviterId && !activeTarget)
      setActiveTarget(inviterId);
  }, [auth.type, inviterId, activeTarget]);

  const fetchNickname = useCallback(
    async (id: string) => {
      if (nicknames[id] || id === "system" || id === "me" || id === selfId)
        return;
      if (auth.type === "system") {
        try {
        const { data } = await client.GET("/api/v1/chat/users/search", {
          params: { query: { keyword: id } },
        });
        if (data?.success && Array.isArray(data.data)) {
          const users = data.data as UserSearchInfo[];
          const user = users.find((u) => u.user_id === id);
          if (user) {
            setNicknames((prev) => ({
              ...prev,
                [id]: user.nickname || user.username,
              }));
              return;
            }
          }
        } catch {}
      }
      setNicknames((prev) => ({ ...prev, [id]: id.slice(0, 8) }));
    },
    [auth.type, nicknames, selfId],
  );

  useEffect(() => {
    const unknownIds = new Set<string>();
    messages.forEach((m) => {
      if (!nicknames[m.from]) unknownIds.add(m.from);
    });
    rooms.forEach((r) => {
      if (!nicknames[r.id]) unknownIds.add(r.id);
    });
    unknownIds.forEach((id) => fetchNickname(id));
  }, [messages, rooms, nicknames, fetchNickname]);

  useEffect(() => {
    if (!isNicknamesHydrated) {
      return;
    }
    void storageHub.setItem(nicknamesKey, JSON.stringify(nicknames));
  }, [isNicknamesHydrated, nicknames, nicknamesKey]);
  useEffect(() => {
    if (!isPendingGuestsHydrated) {
      return;
    }
    void storageHub.setItem(
      pendingGuestsKey,
      JSON.stringify(pendingGuests),
    );
  }, [isPendingGuestsHydrated, pendingGuests, pendingGuestsKey]);

  useEffect(() => {
    if (!isHistoryHydrated) {
      return;
    }
    if (chatConfig.saveHistory) {
      void storageHub.setItem(historyKey, JSON.stringify(messages));
    } else {
      void storageHub.removeItem(historyKey);
    }
  }, [chatConfig.saveHistory, historyKey, isHistoryHydrated, messages]);

  const handleAck = useCallback((payload: WireAckPayload) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id !== payload.msg_id
          ? msg
          : { ...msg, status: payload.status as Message["status"] },
      ),
    );
  }, []);

  const handleRecall = useCallback((payload: { msg_id: string }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id !== payload.msg_id
          ? msg
          : {
              ...msg,
              content: i18next.t("chat.message_recalled"),
              status: "recalled",
              type: "system",
            },
      ),
    );
  }, []);

  const handleRead = useCallback((payload: { msg_ids: string[] }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        payload.msg_ids.includes(msg.id) ? { ...msg, status: "read" } : msg,
      ),
    );
  }, []);

  const handleIncomingText = useCallback(
    async (payload: WireTextPayload, source: TransportType) => {
      let content = payload.content;
      let decryptFailed = false;
      const isEncrypted = ChatCrypto.isEncrypted(payload.content);
      const targetId = payload.is_group ? payload.to : payload.from;
      const sessionKey = sessionKeys[targetId];
      const persistedGroupKey = payload.is_group
        ? chatConfig.groupEncryptionKeys[payload.to]
        : undefined;
      const keysToTry = [sessionKey, persistedGroupKey, systemDefaultKey].filter(
        Boolean,
      ) as string[];
      
      let success = false;
      if (isEncrypted) {
        if (keysToTry.length > 0) {
          for (const key of keysToTry) {
            try {
              const decrypted = await ChatCrypto.decrypt(payload.content, key);
              if (decrypted !== payload.content) {
                content = decrypted;
                success = true;
                break;
              }
            } catch {
              continue;
            }
          }
          if (!success) decryptFailed = true;
        } else {
          // If encrypted but no keys available
          decryptFailed = true;
        }
      }

      addMessage({
        id: payload.id,
        from: payload.from,
        to: payload.to,
        content,
        rawContent: decryptFailed ? payload.content : undefined,
        isEncrypted: isEncrypted,
        isGroup: payload.is_group,
        replyTo: payload.reply_to,
        timestamp: payload.timestamp,
        transport: source,
        status: "delivered",
        type: payload.file_info ? "file" : "text",
        fileInfo: payload.file_info,
        decryptFailed,
      });
    },
    [
      addMessage,
      chatConfig.groupEncryptionKeys,
      systemDefaultKey,
      sessionKeys,
      selfId,
    ],
  );

  const handleWireMessage = useCallback(
    async (raw: string, source: TransportType) => {
      let parsed: WireMessage;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (parsed.type === "Text")
        await handleIncomingText(parsed.payload, source);
      else if (parsed.type === "Ack") handleAck(parsed.payload);
      else if (parsed.type === "Recall") handleRecall(parsed.payload);
      else if (parsed.type === "Read") handleRead(parsed.payload);
      else if (parsed.type === "Signal") await rtc.handleSignal(parsed.payload);
      else if (parsed.type === "System") {
        const content = parsed.payload.content;
        if (content.startsWith("Welcome, ")) {
          const welcomeText = content.replace("Welcome, ", "").trim();

          // 1. Parse own nickname and ID
          // Format A: Welcome, {nickname} (ID: {id} | Inviter: {iid} | Name: {iname})
          // Format B: Welcome, {nickname}
          const ownMatch = welcomeText.match(/^(.*?) \(ID: (.*?) \|/);
          if (ownMatch) {
            const myNickname = ownMatch[1].trim();
            const myId = ownMatch[2].trim();
            if (myNickname && myId)
              setNicknames((prev) => ({ ...prev, [myId]: myNickname }));
          } else if (!welcomeText.includes("(")) {
            // Simple format
            setNicknames((prev) => ({ ...prev, [selfId]: welcomeText }));
          }

          // 2. Parse inviter info
          const inviterMatch = welcomeText.match(
            /Inviter: (.*?) \| Name: (.*?)\)/,
          );
          if (inviterMatch) {
            const iId = inviterMatch[1].trim().toLowerCase();
            const iName = inviterMatch[2].trim();
            if (iId) setInviterId(iId);
            if (iId && iName)
              setNicknames((prev) => ({ ...prev, [iId]: iName }));
          }

          addMessage({
            id: `sys_${parsed.payload.timestamp}`,
            from: "system",
            to: "me",
            content,
            isEncrypted: false,
            isGroup: false,
            timestamp: parsed.payload.timestamp,
            transport: source,
            status: "delivered",
            type: "system",
          });
        } else if (content.startsWith("JSON:")) {
          try {
            const data = JSON.parse(content.substring(5));
            if (data.action === "NICKNAME_UPDATE")
              setNicknames((prev) => ({
                ...prev,
                [data.guest_id]: data.nickname,
              }));
          } catch {}
        } else {
          toast.info(content);
          addMessage({
            id: `sys_${parsed.payload.timestamp}`,
            from: "system",
            to: "me",
            content,
            isEncrypted: false,
            isGroup: false,
            timestamp: parsed.payload.timestamp,
            transport: source,
            status: "delivered",
            type: "system",
          });
        }
      }
    },
    [addMessage, handleAck, handleIncomingText, rtc],
  );

  useEffect(() => {
    handleWireMessageRef.current = handleWireMessage;
  });

  const { currentUserData } = useAuthStore();
  const accessToken = currentUserData?.access_token;

  const setupWebSocket = useCallback(() => {
    if (!isChatEnabled) return;

    // Don't connect if system user has no token yet
    const token = auth.type === "system" ? accessToken : "";
    if (auth.type === "system" && !token) {
      console.log("[Chat] WS: System user has no token yet, skipping...");
      return;
    }

    const inviteId = auth.type === "guest" ? auth.inviteCode : "";
    const url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/chat/ws?${auth.type === "guest" ? `invite_id=${inviteId}` : `token=${token}`}`;

    // If already connecting/open, don't recreate
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      // Check if URL is different, reconnect if so
      if (wsRef.current.url === new URL(url, window.location.href).href) {
        return;
      }
      console.log("[Chat] WS: URL changed, reconnecting...");
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    console.log("[Chat] WS: Connecting to", url.split("?")[0]);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log(
        "[Chat] WebSocket connected, flushing queue:",
        pendingMessagesRef.current.length,
      );
      setIsConnected(true);
      // Flush pending messages
      while (pendingMessagesRef.current.length > 0) {
        const msg = pendingMessagesRef.current.shift();
        if (msg) ws.send(msg);
      }
    };
    ws.onclose = (e) => {
      console.log("[Chat] WebSocket closed:", e.code, e.reason);
      setIsConnected(false);
      // Attempt auto-reconnect
      if (e.code !== 1000 && e.code !== 1001) {
        console.log("[Chat] WS: Unexpected close, scheduling reconnect...");
        setTimeout(() => {
          if (wsRef.current === ws) setupWebSocket();
        }, 3000);
      }
    };
    ws.onmessage = (e) => {
      if (handleWireMessageRef.current)
        handleWireMessageRef.current(e.data, "ws");
    };
    ws.onerror = (err) => {
      console.error("[Chat] WebSocket error:", err);
    };
  }, [auth, isChatEnabled, accessToken]);

  const setupMqtt = useCallback(() => {
    if (
      !isChatEnabled ||
      (chatConfig.transportBackend !== "mqtt-proxy" &&
        chatConfig.transportBackend !== "mqtt-external")
    )
      return;

    const token = auth.type === "system" ? accessToken : "";
    if (auth.type === "system" && !token) return;

    let url = "";
    const authId = auth.type === "system" ? auth.userId : auth.inviteCode;
    if (chatConfig.transportBackend === "mqtt-proxy") {
      const token = auth.type === "system" ? accessToken : "";
      const inviteId = auth.type === "guest" ? auth.inviteCode : "";
      const query =
        auth.type === "guest" ? `invite_id=${inviteId}` : `token=${token}`;
      url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/chat/mqtt-proxy?${query}`;
    } else {
      url = chatConfig.mqttExternal.brokerUrl;
    }
    if (!url) return;

    // If already connected and backend is same, don't reconnect
    if (mqttRef.current?.connected) {
      return;
    }

    const prefix =
      chatConfig.transportBackend === "mqtt-proxy"
        ? chatConfig.mqttProxy.topicPrefix
        : chatConfig.mqttExternal.topicPrefix;
    
    console.log("[Chat] MQTT: Connecting to", url.split("?")[0]);
    const c = mqtt.connect(url, {
      username: chatConfig.mqttExternal.username,
      password: chatConfig.mqttExternal.password,
      clientId: `rs-chat-${authId}-${Math.random().toString(36).slice(2, 6)}`,
    });
    mqttRef.current = c;
    c.on("connect", () => {
      console.log("[Chat] MQTT connected");
      setIsConnected(true);
      c.subscribe(resolveTopic(prefix, authId, false));
      userGroups.forEach((groupId) => {
        c.subscribe(resolveTopic(prefix, groupId, true));
      });
    });
    c.on("message", (_, p) => {
      if (handleWireMessageRef.current)
        handleWireMessageRef.current(p.toString(), chatConfig.transportBackend);
    });
    c.on("close", () => setIsConnected(false));
  }, [auth, chatConfig, isChatEnabled, userGroups, accessToken]);

  useEffect(() => {
    if (isChatActuallyDisabled) {
      console.log("[Chat] Chat is disabled, cleaning up connections...");
      setIsConnected(false);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mqttRef.current) {
        mqttRef.current.end();
        mqttRef.current = null;
      }
      return;
    }

    // If initializing or enabled, try to setup connections
    if (isChatEnabled) {
      if (chatConfig.transportBackend === "ws") {
        setupWebSocket();
      } else if (
        chatConfig.transportBackend === "mqtt-proxy" ||
        chatConfig.transportBackend === "mqtt-external"
      ) {
        setupMqtt();
      }
    }
  }, [
    chatConfig.transportBackend,
    isChatEnabled,
    isChatActuallyDisabled,
    setupMqtt,
    setupWebSocket,
  ]);

  useEffect(() => {
    return () => {
      // Cleanup all connections on unmount
      console.log("[Chat] ChatProvider unmounting, closing connections...");
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (mqttRef.current) {
        mqttRef.current.end();
        mqttRef.current = null;
      }
    };
  }, []);

  // Cleanup old connections when transportBackend switches
  useEffect(() => {
    if (chatConfig.transportBackend !== "ws" && wsRef.current) {
      console.log("[Chat] Switching away from WS, closing...");
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (chatConfig.transportBackend === "ws" && mqttRef.current) {
      console.log("[Chat] Switching away from MQTT, closing...");
      mqttRef.current.end();
      mqttRef.current = null;
    }
  }, [chatConfig.transportBackend]);

  const sendMessage = useCallback(
    async (to: string, content: string, isGroup: boolean = false) => {
      if (!isChatEnabled || !to.trim()) return;
      
      const wsReadyState = wsRef.current?.readyState;
      const isActuallyConnected =
        chatConfig.transportBackend === "ws"
          ? wsReadyState === WebSocket.OPEN
          : isConnected;

      if (isInitializing && !isActuallyConnected) {
        toast.warning(i18next.t("chat.initializing") || "Initializing chat...");
        return;
      }
      const dc = rtc.dcMapRef.current.get(to);
      const isP2P =
        !isGroup && chatConfig.enableWebRTC && dc?.readyState === "open";
      if (!isGroup && chatConfig.enableWebRTC && !dc && to !== "system") {
        rtc.ensurePeerConnection(to);
      }
      
      const sessionKey = sessionKeys[to];
      const groupKey = isGroup ? chatConfig.groupEncryptionKeys[to] : undefined;
      const encryptionKey = sessionKey || groupKey || systemDefaultKey;

      const finalContent = encryptionKey
        ? await ChatCrypto.encrypt(content, encryptionKey)
        : content;
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const wire: WireMessage = {
        type: "Text",
        payload: {
          id: msgId,
          from: selfId,
          to,
          content: finalContent,
          is_group: isGroup,
          reply_to: quotingMessage?.id || undefined,
          timestamp: Date.now(),
        },
      };
      addMessage({
        id: msgId,
        from: selfId,
        to,
        content,
        isEncrypted: !!encryptionKey,
        isGroup,
        replyTo: quotingMessage?.id || undefined,
        timestamp: Date.now(),
        transport: isP2P ? "webrtc" : chatConfig.transportBackend,
        status: "sending",
        type: "text",
      });
      setQuotingMessage(null);
      try {
        if (isP2P && dc) {
          dc.send(JSON.stringify(wire));
        } else {
          const wsReadyState = wsRef.current?.readyState;
          const isActuallyConnected =
            chatConfig.transportBackend === "ws"
              ? wsReadyState === WebSocket.OPEN
              : isConnected;

          const isConnecting =
            chatConfig.transportBackend === "ws" &&
            wsReadyState === WebSocket.CONNECTING;

          if (!isActuallyConnected && !isConnecting) {
            throw new Error("Not connected");
          }
          sendWireMessage(wire);
        }
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId && m.status === "sending"
                ? { ...m, status: "failed" }
                : m,
            ),
          );
        }, 10000);
      } catch (err: unknown) {
        updateMessageStatus(msgId, "failed");
        const wsReadyState = wsRef.current?.readyState;
        const isConnecting =
          chatConfig.transportBackend === "ws" &&
          wsReadyState === WebSocket.CONNECTING;

        if (isConnecting) {
          toast.warning(
            i18next.t("chat.connecting_please_wait") ||
              "Connecting, please wait...",
          );
        } else {
          console.error("[Chat] Failed to send message:", err);
          toast.error(
            i18next.t("chat.failed_to_send") || "Failed to send message.",
          );
        }
      }
    },
    [
      addMessage,
      chatConfig,
      systemDefaultKey,
      rtc,
      isChatEnabled,
      sendWireMessage,
      selfId,
      isConnected,
      updateMessageStatus,
      sessionKeys,
      quotingMessage,
    ],
  );

  const recallMessage = useCallback(
    async (msgId: string, to: string, isGroup: boolean = false) => {
      const wire: WireMessage = {
        type: "Recall",
        payload: {
          id: `recall_${Date.now()}`,
          msg_id: msgId,
          from: selfId,
          to,
          is_group: isGroup,
          timestamp: Date.now(),
        },
      };
      sendWireMessage(wire);
      handleRecall({ msg_id: msgId });
    },
    [selfId, sendWireMessage, handleRecall],
  );

  const markConversationRead = useCallback(
    (targetId: string) => {
      const toMark = messages.filter(
        (m) => m.from === targetId && m.status !== "read",
      );
      if (toMark.length === 0) return;
      setMessages((prev) =>
        prev.map((m) => (m.from === targetId ? { ...m, status: "read" } : m)),
      );
      const msgIds = toMark.map((m) => m.id);
      const readReceipt: WireMessage = {
        type: "Read",
        payload: {
          msg_ids: msgIds,
          from: selfId,
          to: targetId,
          is_group: false,
          timestamp: Date.now(),
        },
      };
      const dc = rtc.dcMapRef.current.get(targetId);
      if (dc?.readyState === "open") dc.send(JSON.stringify(readReceipt));
      else sendWireMessage(readReceipt);
    },
    [messages, selfId, sendWireMessage, rtc.dcMapRef],
  );

  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (auth.type === "system") {
      client.GET("/api/v1/chat/settings").then(({ data }) => {
        if (data?.success && data.data.settings_json) {
          try {
            const p = JSON.parse(data.data.settings_json);
            isFirstLoad.current = true;
            setChatConfig((prev: ChatUserConfig) => ({
              ...prev,
              ...p,
              enabled: data.data.is_enabled ?? prev.enabled,
            }));
          } catch {}
        }
      });
    }
  }, [auth.type, setChatConfig]);

  useEffect(() => {
    if (auth.type === "system") {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        return;
      }
      client.PUT("/api/v1/chat/settings", {
        body: {
          is_enabled: chatConfig.enabled,
          settings_json: JSON.stringify(chatConfig),
        },
      });
    }
  }, [auth.type, chatConfig]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        rooms,
        nicknames,
        isConnected,
        transport,
        selfId,
        inviterId,
        sendMessage,
        recallMessage,
        startVoiceCall,
        startVideoCall,
        stopMediaCall,
        sendFile,
        localStream,
        remoteStreams,
        clearHistory,
        deleteMessage: (id) =>
          setMessages((prev) => prev.filter((m) => m.id !== id)),
        markConversationRead,
        activeTarget,
        setActiveTarget,
        chatConfig,
        updateChatConfig: (c) =>
          setChatConfig((prev: ChatUserConfig) => ({ ...prev, ...c })),
        sessionKeys,
        setSessionKey,
        showFloating: isOpen,
        setShowFloating: setIsOpen,
        isOpen,
        setIsOpen,
        updateNickname: (id, name) =>
          setNicknames((prev) => ({ ...prev, [id]: name })),
        capabilities,
        refreshGroups,
        onlineUsers,
        quotingMessage,
        setQuotingMessage,
        isKeyModalOpen,
        keyTargetId,
        openKeyModal,
        closeKeyModal,
        auth,
        pendingGuests,
        addPendingGuest,
        removePendingGuest,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const c = useContext(ChatContext);
  if (!c) throw new Error("useChat fail");
  return c;
};
