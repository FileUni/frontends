import { useMatrixStore } from '../store/matrixStore';
import { useMqttStore } from '../store/mqttStore';

export interface ActiveChat {
  type: 'matrix' | 'mqtt';
  id: string;
  name: string;
  avatarUrl?: string;
  unreadCount: number;
  timestamp: number;
  typingUsers?: string[];
  memberCount?: number;
  isDirect?: boolean;
  peerName?: string;
  status?: string;
}

export function useMatrixClient() {
  const { accounts, activeAccountId, searchQuery, chatType } = useMatrixStore();
  const mqtt = useMqttStore();

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null;
  const rooms = activeAccount?.rooms || [];
  const currentRoomId = activeAccount?.currentRoomId || null;
  const messages = activeAccount?.messages || {};
  const credentials = activeAccount?.credentials || null;
  const syncState = activeAccount?.syncState || { status: 'disconnected' as const };

  const matrixRoom = rooms.find((r) => r.id === currentRoomId) || null;
  const mqttContact = mqtt.contacts.find((c) => c.id === mqtt.activeContactId) || null;

  const activeChat: ActiveChat | null = (chatType === 'matrix' && matrixRoom
    ? {
        type: 'matrix' as const,
        id: matrixRoom.id,
        name: matrixRoom.name,
        avatarUrl: matrixRoom.avatarUrl,
        unreadCount: matrixRoom.unreadCount,
        timestamp: matrixRoom.timestamp,
        typingUsers: matrixRoom.typingUsers,
        memberCount: matrixRoom.memberCount,
        isDirect: matrixRoom.isDirect,
      }
    : chatType === 'mqtt' && mqttContact
    ? {
        type: 'mqtt' as const,
        id: mqttContact.id,
        name: mqttContact.peerName,
        unreadCount: mqttContact.unreadCount,
        timestamp: mqttContact.lastTimestamp || mqttContact.createdAt,
        peerName: mqttContact.peerName,
        status: mqttContact.status,
      }
    : null) as ActiveChat | null;

  const currentMessages = chatType === 'matrix' && currentRoomId
    ? (messages[currentRoomId] || [])
    : chatType === 'mqtt' && mqtt.activeContactId
    ? (mqtt.messages[mqtt.activeContactId] || [])
    : [];

  const filteredRooms = searchQuery
    ? rooms.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rooms;

  return {
    credentials,
    syncState,
    rooms: filteredRooms,
    allRooms: rooms,
    currentRoom: matrixRoom,
    currentRoomId,
    currentMessages,
    searchQuery,
    login: useMatrixStore.getState().login,
    logout: useMatrixStore.getState().logout,
    selectRoom: useMatrixStore.getState().selectRoom,
    sendMessage: useMatrixStore.getState().sendMessage,
    sendMedia: useMatrixStore.getState().sendMedia,
    setSearchQuery: useMatrixStore.getState().setSearchQuery,
    setTyping: useMatrixStore.getState().setTyping,
    chatType,
    activeChat,
    mqttContacts: mqtt.contacts,
    activeContactId: mqtt.activeContactId,
    setActiveContact: mqtt.setActiveContact,
    setChatType: useMatrixStore.getState().setChatType,
    accounts,
    activeAccountId,
    switchAccount: useMatrixStore.getState().switchAccount,
    removeAccount: useMatrixStore.getState().removeAccount,
  };
}
