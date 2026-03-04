import { useState, useEffect } from 'react';
import type { Message } from './ChatContext';

export const useChatNotifications = (messages: Message[], selfId: string) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);

  useEffect(() => {
    const unread = messages.filter(msg => msg.from !== selfId && msg.status !== 'read' && msg.type === 'text');
    setUnreadCount(unread.length);
    if (unread.length > 0) {
      const latest = unread[unread.length - 1];
      setLastMessage(latest);
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(`New message from ${latest.from}`, {
          body: latest.content,
          icon: 'https://fileuni.com/favicon.svg'
        });
      }
    }
  }, [messages, selfId]);

  const resetUnread = () => setUnreadCount(0);

  return { unreadCount, lastMessage, resetUnread };
};
