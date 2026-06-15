import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMqttStore } from '../store/mqttStore';
import type { MqttContact } from '../types/mqtt';

interface MqttContactInfoProps {
  contact: MqttContact;
  onClose: () => void;
}

export const MqttContactInfo: React.FC<MqttContactInfoProps> = ({ contact, onClose }) => {
  const { t } = useTranslation();
  const updateContact = useMqttStore((s) => s.updateContact);
  const removeContact = useMqttStore((s) => s.removeContact);
  const disconnectContact = useMqttStore((s) => s.disconnectContact);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newName, setNewName] = useState(contact.name);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const handleSaveName = () => {
    if (newName.trim()) {
      updateContact(contact.id, { name: newName.trim() });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    removeContact(contact.id);
    onClose();
  };

  const statusColor = contact.status === 'online' ? 'text-green-500' : contact.status === 'connecting' ? 'text-yellow-500' : 'text-[var(--color-text-tertiary)]';
  const statusLabels: Record<string, string> = {
    online: t('chatBuiltIn.mqtt.status.online'),
    connecting: t('chatBuiltIn.mqtt.status.connecting'),
    offline: t('chatBuiltIn.mqtt.status.offline'),
  };
  const statusText = statusLabels[contact.status] || statusLabels['offline'];

  return (
    <div className="h-full flex flex-col bg-[var(--color-sidebar)]">
      <div className="flex items-center justify-between px-4 h-[var(--header-height)] border-b border-[var(--color-divider)]">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          {t('chatBuiltIn.mqtt.contactInfo')}
        </h3>
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center text-[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-sidebar-item-hover)]"
          onClick={onClose}
          aria-label={t('chatBuiltIn.sidebar.close')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-xl font-semibold">
            {(contact.peerName || contact.name)[0]?.toUpperCase() || '?'}
          </div>
          {editing ? (
            <div className="flex gap-2">
              <input
                ref={editInputRef}
                type="text"
                className="px-2 py-1 text-sm rounded border border-[var(--color-divider)] bg-[var(--color-background)] text-[var(--color-text-primary)] outline-none"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button type="button" onClick={handleSaveName} className="text-xs text-[var(--color-accent)]">
                {t('chatBuiltIn.mqtt.save')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{contact.name}</span>
              <button
                type="button"
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
                onClick={() => setEditing(true)}
              >
                {t('chatBuiltIn.mqtt.edit')}
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-[var(--color-text-secondary)]">{statusText}</span>
        </div>

        {/* Connection info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-tertiary)]">{t('chatBuiltIn.mqtt.brokerUrl')}</span>
            <span className="text-[var(--color-text-primary)] truncate ml-2 max-w-[180px]">{contact.brokerUrl}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-tertiary)]">{t('chatBuiltIn.mqtt.topic')}</span>
            <span className="text-[var(--color-text-primary)] truncate ml-2 max-w-[180px]">{contact.topic}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-tertiary)]">{t('chatBuiltIn.mqtt.clientId')}</span>
            <span className="text-[var(--color-text-primary)] truncate ml-2 max-w-[180px]">{contact.clientId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-tertiary)]">{t('chatBuiltIn.mqtt.peerId')}</span>
            <span className="text-[var(--color-text-primary)] truncate ml-2 max-w-[180px]">{contact.peerId}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-2">
          <button
            type="button"
            className="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-left"
            onClick={() => disconnectContact(contact.id)}
          >
            {t('chatBuiltIn.mqtt.disconnect')}
          </button>
          {confirmingDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg text-center"
                onClick={handleDelete}
              >
                {t('chatBuiltIn.mqtt.confirmDelete')}
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-item-hover)] rounded-lg text-center"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('chatBuiltIn.sidebar.close')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-left"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('chatBuiltIn.mqtt.deleteContact')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
