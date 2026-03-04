import { create } from 'zustand';
import { client, extractData } from '@/lib/api.ts';

export interface Notification {
  id: string;
  title: string;
  content: string;
  msg_type: string;
  level: 'info' | 'warning' | 'error' | 'success';
  sender_id?: string;
  extra_data?: Record<string, unknown>;
  created_at: string;
  is_read: boolean;
  read_at?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (page?: number, pageSize?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotifications: (ids: string[]) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (page = 1, pageSize = 20) => {
    set({ loading: true });
    try {
      const data = await extractData<Notification[]>(client.GET('/api/v1/notifications', {
        params: { query: { page, page_size: pageSize } }
      }));
      if (data) {
        set({ notifications: data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await extractData<number>(client.GET('/api/v1/notifications/unread-count'));
      if (data !== undefined) {
        set({ unreadCount: Number(data) || 0 });
      }
    } catch (e) {
      console.error(e);
    }
  },

  markAsRead: async (ids: string[]) => {
    try {
      const data = await extractData<number>(client.POST('/api/v1/notifications/read', {
        body: { ids }
      }));
      set(state => ({
        notifications: state.notifications.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, state.unreadCount - (Number(data) || 0))
      }));
    } catch (e) {
      console.error(e);
    }
  },

  markAllAsRead: async () => {
    try {
      await extractData(client.POST('/api/v1/notifications/read-all'));
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (e) {
      console.error(e);
    }
  },

  deleteNotifications: async (ids: string[]) => {
    try {
      await extractData(client.DELETE('/api/v1/notifications', {
        body: { ids }
      }));
      set(state => ({
        notifications: state.notifications.filter(n => !ids.includes(n.id))
      }));
      get().fetchUnreadCount();
    } catch (e) {
      console.error(e);
    }
  }
}));
