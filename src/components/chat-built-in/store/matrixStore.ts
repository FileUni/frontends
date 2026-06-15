import { create } from 'zustand';
import type { IMatrixClient } from '../utils/matrix-client';
import { createMatrixClient } from '../utils/matrix-client';
import { useNotificationStore } from './notificationStore';
import type {
  MatrixAccount, MatrixRoom, MatrixMessage,
  MatrixLoginParams,
} from '../types/matrix';
import { loadAccounts, saveAccounts, generateAccountId, credentialsLabel } from '../types/matrix';

export type ChatProtocol = 'matrix' | 'mqtt';

interface MatrixState {
  accounts: MatrixAccount[];
  activeAccountId: string | null;
  clients: Record<string, IMatrixClient>;
  searchQuery: string;
  chatType: ChatProtocol;

  tryRestoreSession: () => Promise<boolean>;
  login: (params: MatrixLoginParams) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: (id: string) => void;
  removeAccount: (id: string) => Promise<void>;
  selectRoom: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, replyTo?: string) => Promise<void>;
  sendMedia: (roomId: string, file: File) => Promise<void>;
  setSearchQuery: (query: string) => void;
  loadMoreMessages: (roomId: string) => Promise<void>;
  markAsRead: (roomId: string) => Promise<void>;
  setTyping: (roomId: string, typing: boolean) => Promise<void>;
  initAccountSync: (accountId: string) => Promise<void>;
  stopAccountSync: (accountId: string) => void;
  setRoomPin: (roomId: string, pinned: boolean) => void;
  setRoomMute: (roomId: string, muted: boolean) => void;
  setRoomArchive: (roomId: string, archived: boolean) => void;
  deleteRoom: (roomId: string) => void;
  setChatType: (type: ChatProtocol) => void;
}

function updateAccount(accounts: MatrixAccount[], id: string, patch: Partial<MatrixAccount>): MatrixAccount[] {
  return accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

export const useMatrixStore = create<MatrixState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  clients: {},
  searchQuery: '',
  chatType: 'matrix',

  tryRestoreSession: async () => {
    const saved = loadAccounts();
    if (saved.length === 0) return false;

    const accounts = saved.map((a) => ({
      ...a,
      syncState: { status: 'disconnected' as const },
      rooms: [] as MatrixRoom[],
      currentRoomId: null as string | null,
      messages: {} as Record<string, MatrixMessage[]>,
    }));
    const activeAccountId = accounts[0]!.id;
    set({ accounts, activeAccountId });

    for (const account of accounts) {
      get().initAccountSync(account.id).catch(() => {});
    }
    return true;
  },

  login: async (params) => {
    const client = await createMatrixClient();
    const credentials = await client.login(params);
    const id = generateAccountId();
    const label = credentialsLabel(credentials);
    const account: MatrixAccount = {
      id, label, credentials,
      syncState: { status: 'syncing' },
      rooms: [],
      currentRoomId: null,
      messages: {},
    };

    set((s) => {
      const accounts = [...s.accounts, account];
      saveAccounts(accounts);
      return { accounts, activeAccountId: id, clients: { ...s.clients, [id]: client } };
    });

    await get().initAccountSync(id);
  },

  logout: async () => {
    const { activeAccountId } = get();
    if (!activeAccountId) return;
    await get().removeAccount(activeAccountId);
  },

  switchAccount: (id) => {
    set({ activeAccountId: id });
  },

  removeAccount: async (id) => {
    get().stopAccountSync(id);
    set((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      saveAccounts(accounts);
      const { [id]: _, ...clients } = s.clients;
      const activeAccountId = s.activeAccountId === id
        ? (accounts[0]?.id ?? null)
        : s.activeAccountId;
      return { accounts, activeAccountId, clients, searchQuery: '' };
    });
  },

  selectRoom: async (roomId) => {
    const { activeAccountId, accounts, clients } = get();
    if (!activeAccountId) return;
    set({ accounts: updateAccount(accounts, activeAccountId, { currentRoomId: roomId }) });
    const client = clients[activeAccountId];
    if (!client) return;
    const messages = await client.getRoomMessages(roomId);
    set((s) => ({
      accounts: updateAccount(s.accounts, activeAccountId, {
        messages: { ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}), [roomId]: messages },
      }),
    }));
    await get().markAsRead(roomId);
  },

  sendMessage: async (roomId, content, replyTo) => {
    const { activeAccountId, clients, accounts } = get();
    if (!activeAccountId) return;
    const client = clients[activeAccountId];
    if (!client) return;
    const account = accounts.find((a) => a.id === activeAccountId);
    if (!account) return;

    const optimistic: MatrixMessage = {
      id: `optimistic_${Date.now()}`,
      roomId,
      sender: account.credentials.userId,
      senderName: account.label,
      content,
      timestamp: Date.now(),
      type: 'text',
      status: 'sending',
      ...(replyTo ? { replyTo } : {}),
    };

    set((s) => {
      const cur = s.accounts.find((a) => a.id === activeAccountId);
      const curMsgs = cur?.messages[roomId] || [];
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: { ...(cur?.messages || {}), [roomId]: [optimistic, ...curMsgs] },
        }),
      };
    });

    try {
      await client.sendMessage(roomId, content, replyTo);
      set((s) => ({
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: {
            ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}),
            [roomId]: (s.accounts.find((a) => a.id === activeAccountId)?.messages[roomId] || []).map((m) =>
              m.id === optimistic.id ? { ...m, status: 'sent' as const } : m
            ),
          },
        }),
      }));
    } catch {
      set((s) => ({
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: {
            ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}),
            [roomId]: (s.accounts.find((a) => a.id === activeAccountId)?.messages[roomId] || []).map((m) =>
              m.id === optimistic.id ? { ...m, status: 'failed' as const } : m
            ),
          },
        }),
      }));
    }
  },

  sendMedia: async (roomId, file) => {
    const { activeAccountId, clients, accounts } = get();
    if (!activeAccountId) return;
    const client = clients[activeAccountId];
    if (!client) return;
    const account = accounts.find((a) => a.id === activeAccountId);
    if (!account) return;

    const isImage = file.type.startsWith('image/');
    const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
    const optimistic: MatrixMessage = {
      id: `optimistic_media_${Date.now()}`,
      roomId,
      sender: account.credentials.userId,
      senderName: account.label,
      content: file.name,
      timestamp: Date.now(),
      type: isImage ? 'image' : 'file',
      status: 'sending',
      fileName: file.name,
      fileSize: file.size,
      mediaMimeType: file.type,
      ...(objectUrl ? { mediaUrl: objectUrl, mediaThumbnailUrl: objectUrl } : {}),
    };

    set((s) => {
      const cur = s.accounts.find((a) => a.id === activeAccountId);
      const curMsgs = cur?.messages[roomId] || [];
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: { ...(cur?.messages || {}), [roomId]: [optimistic, ...curMsgs] },
        }),
      };
    });

    try {
      await client.sendMedia(roomId, file);
      set((s) => ({
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: {
            ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}),
            [roomId]: (s.accounts.find((a) => a.id === activeAccountId)?.messages[roomId] || []).map((m) =>
              m.id === optimistic.id ? { ...m, status: 'sent' as const } : m
            ),
          },
        }),
      }));
    } catch {
      set((s) => ({
        accounts: updateAccount(s.accounts, activeAccountId, {
          messages: {
            ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}),
            [roomId]: (s.accounts.find((a) => a.id === activeAccountId)?.messages[roomId] || []).map((m) =>
              m.id === optimistic.id ? { ...m, status: 'failed' as const } : m
            ),
          },
        }),
      }));
    }

    if (isImage) {
      const url = optimistic.mediaUrl;
      if (url) setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  loadMoreMessages: async (roomId) => {
    const { activeAccountId, clients } = get();
    if (!activeAccountId) return;
    const client = clients[activeAccountId];
    if (!client) return;
    const older = await client.loadMoreMessages(roomId);
    set((s) => ({
      accounts: updateAccount(s.accounts, activeAccountId, {
        messages: {
          ...(s.accounts.find((a) => a.id === activeAccountId)?.messages || {}),
          [roomId]: [...(s.accounts.find((a) => a.id === activeAccountId)?.messages[roomId] || []), ...older],
        },
      }),
    }));
  },

  markAsRead: async (roomId) => {
    const { activeAccountId, clients } = get();
    if (!activeAccountId) return;
    const client = clients[activeAccountId];
    if (!client) return;
    await client.markAsRead(roomId);
    set((s) => ({
      accounts: updateAccount(s.accounts, activeAccountId, {
        rooms: (s.accounts.find((a) => a.id === activeAccountId)?.rooms || []).map((r) =>
          r.id === roomId ? { ...r, unreadCount: 0 } : r
        ),
      }),
    }));
  },

  setTyping: async (roomId, typing) => {
    const { activeAccountId, clients } = get();
    if (!activeAccountId) return;
    const client = clients[activeAccountId];
    if (!client) return;
    await client.setTyping(roomId, typing);
  },

  initAccountSync: async (accountId) => {
    const { clients } = get();
    let client = clients[accountId];
    if (!client) {
      client = await createMatrixClient();
    }

    const account = get().accounts.find((a) => a.id === accountId);
    if (!account) return;

    client.onRooms((rooms) => {
      set((s) => ({
        accounts: updateAccount(s.accounts, accountId, { rooms }),
      }));
    });

    client.onMessages((roomId, messages) => {
      set((s) => {
        const cur = s.accounts.find((a) => a.id === accountId);
        return {
          accounts: updateAccount(s.accounts, accountId, {
            messages: { ...(cur?.messages || {}), [roomId]: messages },
          }),
        };
      });
    });

    client.onSyncState((status) => {
      set((s) => ({
        accounts: updateAccount(s.accounts, accountId, { syncState: { status } }),
      }));
    });

    client.onNewMessage((roomId, msg) => {
      set((s) => {
        const cur = s.accounts.find((a) => a.id === accountId);
        const curRooms = cur?.rooms || [];
        const curMsgs = cur?.messages[roomId] || [];
        const updatedRooms = curRooms.map((r) =>
          r.id === roomId
            ? { ...r, lastMessage: msg, timestamp: msg.timestamp, unreadCount: r.unreadCount + (r.id !== cur?.currentRoomId ? 1 : 0) }
            : r
        );
        const updatedMsgs = { ...(cur?.messages || {}), [roomId]: [msg, ...curMsgs] };
        return {
          accounts: updateAccount(s.accounts, accountId, { rooms: updatedRooms, messages: updatedMsgs }),
        };
      });
      if (roomId !== get().accounts.find((a) => a.id === accountId)?.currentRoomId) {
        useNotificationStore.getState().addNotification({
          id: `${roomId}_${msg.timestamp}`,
          source: 'matrix',
          title: msg.senderName,
          body: msg.content,
          roomId,
          senderId: msg.sender,
          timestamp: msg.timestamp,
          read: false,
        });
      }
    });

    client.onTyping((roomId, users) => {
      set((s) => {
        const cur = s.accounts.find((a) => a.id === accountId);
        return {
          accounts: updateAccount(s.accounts, accountId, {
            rooms: (cur?.rooms || []).map((r) =>
              r.id === roomId ? { ...r, typingUsers: users } : r
            ),
          }),
        };
      });
    });

    set((s) => ({
      clients: { ...s.clients, [accountId]: client },
    }));

    await client.startSync(account.credentials);

    set((s) => ({
      accounts: updateAccount(s.accounts, accountId, { syncState: { status: 'synced' } }),
    }));
  },

  stopAccountSync: (accountId) => {
    const client = get().clients[accountId];
    if (client) {
      client.stopSync();
    }
    set((s) => {
      const { [accountId]: _, ...clients } = s.clients;
      return { clients };
    });
  },

  setRoomPin: (roomId, pinned) =>
    set((s) => {
      const { activeAccountId } = s;
      if (!activeAccountId) return s;
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          rooms: (s.accounts.find((a) => a.id === activeAccountId)?.rooms || []).map((r) =>
            r.id === roomId ? { ...r, pinned } : r
          ),
        }),
      };
    }),

  setRoomMute: (roomId, muted) =>
    set((s) => {
      const { activeAccountId } = s;
      if (!activeAccountId) return s;
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          rooms: (s.accounts.find((a) => a.id === activeAccountId)?.rooms || []).map((r) =>
            r.id === roomId ? { ...r, muted } : r
          ),
        }),
      };
    }),

  setRoomArchive: (roomId, archived) =>
    set((s) => {
      const { activeAccountId } = s;
      if (!activeAccountId) return s;
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          rooms: (s.accounts.find((a) => a.id === activeAccountId)?.rooms || []).map((r) =>
            r.id === roomId ? { ...r, archived } : r
          ),
        }),
      };
    }),

  setChatType: (type) => set({ chatType: type }),

  deleteRoom: (roomId) =>
    set((s) => {
      const { activeAccountId } = s;
      if (!activeAccountId) return s;
      const cur = s.accounts.find((a) => a.id === activeAccountId);
      return {
        accounts: updateAccount(s.accounts, activeAccountId, {
          rooms: (cur?.rooms || []).filter((r) => r.id !== roomId),
          currentRoomId: cur?.currentRoomId === roomId ? null : cur?.currentRoomId ?? null,
        }),
      };
    }),
}));
