import { create } from 'zustand';
import i18next from 'i18next';
import type { MqttContact, MqttMessage } from '../types/mqtt';
import { MqttClient } from '../utils/mqtt-client';

const CONTACTS_KEY = 'mqtt_contacts';
const MESSAGES_PREFIX = 'mqtt_messages_';

function loadContacts(): MqttContact[] {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
  } catch { return []; }
}

function saveContacts(contacts: MqttContact[]): void {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)); } catch { /* noop */ }
}

function loadMessages(contactId: string): MqttMessage[] {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_PREFIX + contactId) || '[]');
  } catch { return []; }
}

function saveMessages(contactId: string, messages: MqttMessage[]): void {
  try {
    localStorage.setItem(MESSAGES_PREFIX + contactId, JSON.stringify(messages));
  } catch { /* noop */ }
}

interface MqttState {
  contacts: MqttContact[];
  activeContactId: string | null;
  messages: Record<string, MqttMessage[]>;
  connections: Record<string, MqttClient>;

  addContact: (contact: MqttContact) => void;
  removeContact: (contactId: string) => void;
  updateContact: (contactId: string, partial: Partial<MqttContact>) => void;
  setActiveContact: (contactId: string | null) => void;
  connectContact: (contactId: string) => void;
  disconnectContact: (contactId: string) => void;
  disconnectAll: () => void;
  sendMessage: (contactId: string, text: string) => MqttMessage | null;
  addMessage: (msg: MqttMessage) => void;
}

export const useMqttStore = create<MqttState>((set, get) => ({
  contacts: loadContacts(),
  activeContactId: null,
  messages: {},
  connections: {},

  addContact: (contact) => {
    const contacts = [...get().contacts, contact];
    set({ contacts });
    saveContacts(contacts);
    get().connectContact(contact.id);
    const client = get().connections[contact.id];
    client?.sendHandshake();
    const sysMsg: MqttMessage = {
      id: `mqtt_sys_${Date.now()}`,
      contactId: contact.id,
      senderId: contact.clientId,
      senderName: contact.name,
      content: i18next.t('chatBuiltIn.mqtt.systemConnected', { name: contact.peerName }),
      timestamp: Date.now(),
      type: 'system',
      status: 'sent',
    };
    get().addMessage(sysMsg);
  },

  removeContact: (contactId) => {
    get().disconnectContact(contactId);
    const contacts = get().contacts.filter((c) => c.id !== contactId);
    set({ contacts, activeContactId: get().activeContactId === contactId ? null : get().activeContactId });
    saveContacts(contacts);
    try { localStorage.removeItem(MESSAGES_PREFIX + contactId); } catch { /* noop */ }
  },

  updateContact: (contactId, partial) => {
    const contacts = get().contacts.map((c) => c.id === contactId ? { ...c, ...partial } : c);
    set({ contacts });
    saveContacts(contacts);
  },

  setActiveContact: (contactId) => {
    set({ activeContactId: contactId });
  },

  connectContact: (contactId) => {
    const contact = get().contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (get().connections[contactId]) return;

    const client = new MqttClient(contact);
    client.setEvents({
      onMessage: (msg) => get().addMessage(msg),
      onStatusChange: (status) => {
        get().updateContact(contactId, { status });
      },
      onError: () => {
        get().updateContact(contactId, { status: 'offline' });
      },
    });
    client.connect();
    set((s) => ({ connections: { ...s.connections, [contactId]: client } }));
  },

  disconnectContact: (contactId) => {
    const client = get().connections[contactId];
    client?.disconnect();
    set((s) => {
      const { [contactId]: _, ...rest } = s.connections;
      return { connections: rest };
    });
    get().updateContact(contactId, { status: 'offline' });
  },

  disconnectAll: () => {
    Object.values(get().connections).forEach((c) => c.disconnect());
    set({ connections: {}, contacts: get().contacts.map((c) => ({ ...c, status: 'offline' as const })) });
  },

  sendMessage: (contactId, text) => {
    const client = get().connections[contactId];
    if (!client) return null;
    const msg = client.sendText(text, (status) => {
      set((s) => {
        const existing = s.messages[contactId] || [];
        const updated = existing.map((m) =>
          m.id === msg!.id ? { ...m, status } : m
        );
        return { messages: { ...s.messages, [contactId]: updated } };
      });
      const current = get().messages[contactId];
      if (current) saveMessages(contactId, current);
    });
    if (msg) get().addMessage(msg);
    return msg;
  },

  addMessage: (msg) => {
    const contactId = msg.contactId;
    const existing = get().messages[contactId] || loadMessages(contactId);
    const messages = [...existing, msg];
    set((s) => ({ messages: { ...s.messages, [contactId]: messages } }));
    saveMessages(contactId, messages.slice(-200));

    get().updateContact(contactId, {
      lastMessage: msg.content,
      lastTimestamp: msg.timestamp,
      unreadCount: contactId !== get().activeContactId
        ? (get().contacts.find((c) => c.id === contactId)?.unreadCount || 0) + 1
        : 0,
    });
  },
}));
