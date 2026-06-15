import React, { useEffect, useRef, useState } from 'react';
import { useMatrixClient } from './hooks/useMatrixClient';
import { useMatrixSync } from './hooks/useMatrixSync';
import { useMatrixStore } from './store/matrixStore';
import { useMqttStore } from './store/mqttStore';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatView } from './components/ChatView';
import { ProfilePanel } from './components/ProfilePanel';
import { MqttContactInfo } from './components/MqttContactInfo';
import { useSwipe } from './hooks/useSwipe';
import { cn } from '@/lib/utils';
import './styles/variables.css';

export const ChatBuiltInApp: React.FC = () => {
  const { chatType, activeChat } = useMatrixClient();
  const tryRestoreSession = useMatrixStore((s) => s.tryRestoreSession);
  const mqttContacts = useMqttStore((s) => s.contacts);
  const activeContactId = useMqttStore((s) => s.activeContactId);
  const [restoring, setRestoring] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const swipeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tryRestoreSession().finally(() => setRestoring(false));
  }, [tryRestoreSession]);

  useSwipe(swipeContainerRef, {
    onSwipeRight: () => !sidebarOpen && setSidebarOpen(true),
    onSwipeLeft: () => !profileOpen && activeChat && setProfileOpen(true),
  });

  useMatrixSync();

  if (restoring) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--color-background)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]" />
      </div>
    );
  }

  const activeMqttContact = chatType === 'mqtt' ? mqttContacts.find((c) => c.id === activeContactId) : null;

  return (
    <div ref={swipeContainerRef} className="chat-app h-screen w-full flex bg-[var(--color-background)] overflow-hidden select-none">
      {/* Left column */}
      <div className={cn(
        'flex-shrink-0 h-full',
        'w-[var(--sidebar-width)] min-w-[var(--sidebar-min-width)]',
        'bg-[var(--color-sidebar)]',
        'max-md:fixed max-md:z-30 max-md:transition-transform max-md:duration-300',
        'max-md:data-[open=false]:-translate-x-full',
      )} data-open={sidebarOpen || undefined}>
        <ChatSidebar onSelectRoom={() => setSidebarOpen(false)} />
      </div>

      {/* Overlay backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          role="presentation"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
        />
      )}

      {/* Middle column */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0 h-full',
        'bg-[var(--color-surface)]',
        'max-md:relative max-md:z-10',
      )}>
        <ChatView
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleProfile={() => setProfileOpen(!profileOpen)}
        />
      </div>

      {/* Right column (overlay) */}
      {activeChat && (
        <>
          {profileOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/40 xl:hidden"
              role="presentation"
              onClick={() => setProfileOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setProfileOpen(false)}
            />
          )}
          <div className={cn(
            'h-full bg-[var(--color-sidebar)]',
            'w-[var(--right-column-width)]',
            'xl:relative xl:flex-shrink-0',
            'fixed right-0 top-0 z-30 transition-transform duration-300',
            'xl:translate-x-0',
            profileOpen ? 'translate-x-0' : 'translate-x-full',
          )}>
            {chatType === 'matrix' ? (
              <ProfilePanel onClose={() => setProfileOpen(false)} />
            ) : activeMqttContact ? (
              <MqttContactInfo
                contact={activeMqttContact}
                onClose={() => setProfileOpen(false)}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
