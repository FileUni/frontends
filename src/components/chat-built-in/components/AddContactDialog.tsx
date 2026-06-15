import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMqttStore } from '../store/mqttStore';
import { useMatrixStore } from '../store/matrixStore';
import type { MqttContact } from '../types/mqtt';

interface AddContactDialogProps {
  onClose: () => void;
}

interface MqttConfig {
  name: string;
  brokerUrl: string;
  topic: string;
  clientId: string;
  peerId: string;
  peerName?: string;
}

function encodeConfig(config: MqttConfig): string {
  return btoa(JSON.stringify(config));
}

function decodeConfig(raw: string): MqttConfig | null {
  try {
    return JSON.parse(atob(raw)) as MqttConfig;
  } catch {
    try {
      return JSON.parse(raw) as MqttConfig;
    } catch {
      return null;
    }
  }
}

export const AddContactDialog: React.FC<AddContactDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const addContact = useMqttStore((s) => s.addContact);
  const setChatType = useMatrixStore((s) => s.setChatType);
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [name, setName] = useState('');
  const [brokerUrl, setBrokerUrl] = useState('ws://');
  const [topic, setTopic] = useState('');
  const [peerId, setPeerId] = useState('');
  const [peerName, setPeerName] = useState('');
  const [clientId, setClientId] = useState(() => `client_${Math.random().toString(36).slice(2, 10)}`);
  const [importRaw, setImportRaw] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentConfig: MqttConfig = { name, brokerUrl, topic, clientId, peerId, peerName };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !brokerUrl || !topic || !peerId) return;

    const contact: MqttContact = {
      id: `mqtt_${Date.now()}`,
      name,
      brokerUrl,
      topic,
      clientId,
      peerId,
      peerName: peerName || peerId,
      unreadCount: 0,
      status: 'offline',
      createdAt: Date.now(),
    };
    addContact(contact);
    setChatType('mqtt');
    onClose();
  };

  const handleImport = () => {
    if (!importRaw.trim()) return;
    const config = decodeConfig(importRaw.trim());
    if (!config) {
      setImportError(t('chatBuiltIn.mqtt.importError'));
      return;
    }
    setName(config.name || '');
    setBrokerUrl(config.brokerUrl || '');
    setTopic(config.topic || '');
    setClientId(config.clientId || `client_${Math.random().toString(36).slice(2, 10)}`);
    setPeerId(config.peerId || '');
    setPeerName(config.peerName || '');
    setImportError('');
    setMode('manual');
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(encodeConfig(currentConfig));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const handleExportFile = () => {
    const blob = new Blob([encodeConfig(currentConfig)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mqtt_config_${name || 'contact'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportRaw(reader.result as string);
      setMode('import');
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          {t('chatBuiltIn.mqtt.addContact')}
        </h2>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4 border-b border-[var(--color-divider)]">
          <button
            type="button"
            className={`pb-2 text-sm font-medium transition-colors ${mode === 'manual' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
            onClick={() => setMode('manual')}
          >
            {t('chatBuiltIn.mqtt.manual')}
          </button>
          <button
            type="button"
            className={`pb-2 text-sm font-medium transition-colors ${mode === 'import' ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
            onClick={() => setMode('import')}
          >
            {t('chatBuiltIn.mqtt.importConfig')}
          </button>
        </div>

        {mode === 'import' ? (
          <div className="space-y-3">
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] resize-none h-24"
              placeholder={t('chatBuiltIn.mqtt.importPlaceholder')}
              value={importRaw}
              onChange={(e) => { setImportRaw(e.target.value); setImportError(''); }}
            />
            {importError && (
              <p className="text-xs text-red-500">{importError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 text-sm text-white bg-[var(--color-accent)] rounded-lg hover:opacity-90"
                onClick={handleImport}
              >
                {t('chatBuiltIn.mqtt.parseAndFill')}
              </button>
              <label className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <span className="block text-center px-3 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-divider)] rounded-lg cursor-pointer hover:bg-[var(--color-sidebar-item-hover)]">
                  {t('chatBuiltIn.mqtt.importFromFile')}
                </span>
              </label>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.contactNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.brokerUrlPlaceholder')}
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.topicPlaceholder')}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.peerIdPlaceholder')}
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              required
            />
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.peerNamePlaceholder')}
              value={peerName}
              onChange={(e) => setPeerName(e.target.value)}
            />
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              placeholder={t('chatBuiltIn.mqtt.clientIdPlaceholder')}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 text-xs text-[var(--color-text-secondary)] border border-[var(--color-divider)] rounded-lg hover:bg-[var(--color-sidebar-item-hover)]"
                onClick={handleCopyConfig}
              >
                {copied ? t('chatBuiltIn.mqtt.copied') : t('chatBuiltIn.mqtt.copyConfig')}
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2 text-xs text-[var(--color-text-secondary)] border border-[var(--color-divider)] rounded-lg hover:bg-[var(--color-sidebar-item-hover)]"
                onClick={handleExportFile}
              >
                {t('chatBuiltIn.mqtt.exportFile')}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)] rounded-lg"
              >
                {t('chatBuiltIn.mqtt.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm text-white bg-[var(--color-accent)] rounded-lg hover:opacity-90"
              >
                {t('chatBuiltIn.mqtt.connect')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
