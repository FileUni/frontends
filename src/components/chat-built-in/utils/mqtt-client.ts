import mqtt from 'mqtt';
const { connect: mqttConnect } = mqtt;
import type { MqttClient as MqttJsClient, IClientOptions } from 'mqtt';
import i18next from 'i18next';
import type { MqttContact, MqttMessage, MqttConnectionStatus } from '../types/mqtt';

export interface MqttClientEvents {
  onMessage?: (msg: MqttMessage) => void;
  onStatusChange?: (status: MqttConnectionStatus) => void;
  onError?: (err: Error) => void;
}

export class MqttClient {
  private client: MqttJsClient | null = null;
  private contact: MqttContact;
  private events: MqttClientEvents = {};

  constructor(contact: MqttContact) {
    this.contact = contact;
  }

  setEvents(events: MqttClientEvents): void {
    this.events = events;
  }

  connect(): void {
    if (this.client?.connected) return;
    this.events.onStatusChange?.('connecting');

    const opts: IClientOptions = {
      clientId: this.contact.clientId,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };

    this.client = mqttConnect(this.contact.brokerUrl, opts);

    this.client.on('connect', () => {
      this.client?.subscribe(this.contact.topic, { qos: 1 });
      this.events.onStatusChange?.('online');
    });

    this.client.on('message', (topic, payload) => {
      if (topic !== this.contact.topic) return;
      try {
        const parsed = JSON.parse(payload.toString());
        this.handleIncoming(parsed);
      } catch { /* ignore malformed */ }
    });

    this.client.on('close', () => {
      this.events.onStatusChange?.('offline');
    });

    this.client.on('error', (err) => {
      this.events.onError?.(err);
      this.events.onStatusChange?.('offline');
    });

    this.client.on('offline', () => {
      this.events.onStatusChange?.('offline');
    });
  }

  disconnect(): void {
    this.client?.end(true);
    this.client = null;
    this.events.onStatusChange?.('offline');
  }

  get connected(): boolean {
    return this.client?.connected ?? false;
  }

  sendText(text: string, onStatus?: (status: 'sending' | 'sent' | 'failed') => void): MqttMessage | null {
    if (!this.client?.connected) return null;
    const msg: MqttMessage = {
      id: `mqtt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      contactId: this.contact.id,
      senderId: this.contact.clientId,
      senderName: this.contact.name,
      content: text,
      timestamp: Date.now(),
      type: 'text',
      status: 'sending',
    };
    onStatus?.('sending');
    const payload = JSON.stringify(msg);
    this.client.publish(this.contact.topic, payload, { qos: 1 }, (err) => {
      onStatus?.(err ? 'failed' : 'sent');
    });
    return msg;
  }

  sendHandshake(): void {
    if (!this.client?.connected) return;
    const payload = JSON.stringify({
      type: 'handshake',
      senderId: this.contact.clientId,
      senderName: this.contact.name,
      timestamp: Date.now(),
    });
    this.client.publish(this.contact.topic, payload, { qos: 1 });
  }

  private handleIncoming(parsed: Record<string, unknown>): void {
    const now = Date.now();
    if (parsed['type'] === 'handshake') {
      const msg: MqttMessage = {
        id: `mqtt_${now}_${Math.random().toString(36).slice(2, 8)}`,
        contactId: this.contact.id,
        senderId: (parsed['senderId'] as string) || '',
        senderName: (parsed['senderName'] as string) || 'Unknown',
        content: i18next.t('chatBuiltIn.mqtt.systemHandshake', { name: parsed['senderName'] || 'Unknown' }),
        timestamp: now,
        type: 'handshake',
        status: 'sent',
      };
      this.events.onMessage?.(msg);
      return;
    }
    if (parsed['type'] === 'text' || !parsed['type']) {
      const msg: MqttMessage = {
        id: `mqtt_${now}_${Math.random().toString(36).slice(2, 8)}`,
        contactId: this.contact.id,
        senderId: (parsed['senderId'] as string) || '',
        senderName: (parsed['senderName'] as string) || 'Unknown',
        content: (parsed['content'] as string) || '',
        timestamp: (parsed['timestamp'] as number) || now,
        type: 'text',
        status: 'sent',
      };
      this.events.onMessage?.(msg);
    }
  }
}
