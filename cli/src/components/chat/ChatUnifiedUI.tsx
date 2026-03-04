import {
  X,
  Search,
  Settings,
  Plus,
  MoreVertical,
  Trash2,
  Lock,
  Unlock,
  Phone,
  PhoneOff,
  Video,
  UserPlus,
  Users,
  User,
  Zap,
  Globe,
  Wifi,
  ShieldAlert,
  Shield,
  MessageSquare,
  Menu,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useChat, type Message } from "@/hooks/ChatContext";
import { ChatSidebar } from "@/features/chat/components/ChatSidebar";
import { ChatMessageList } from "@/features/chat/components/ChatMessageList";
import { ChatInput } from "@/features/chat/components/ChatInput";
import { SessionKeyModal } from "./SessionKeyModal";
import { toast } from "@fileuni/shared";
import { client } from "@/lib/api";
import type { InviteInfo, GroupInfo, TransportBackend } from "@/hooks/ChatTypes";
import { Modal } from "@/components/ui/Modal.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Badge } from "@/components/ui/Badge.tsx";
import { Switch } from "@/components/ui/Switch.tsx";
import { useTranslation } from "react-i18next";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

type UserSearchResult = {
  user_id: string;
  nickname?: string;
  username: string;
};

const parseTransportBackend = (value: string): TransportBackend => {
  if (value === "mqtt-proxy" || value === "mqtt-external") return value;
  return "ws";
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return error instanceof Error ? error.message : fallback;
};

/**
 * P2P Help Modal Content
 */
const P2PHelpContent: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 py-2">
      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Zap size={24} className="text-primary" />
        </div>
        <div>
          <h4 className="font-bold text-sm mb-1">{t("chat.p2pHelpTitle")}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("chat.p2pHelpContent")}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Globe size={16} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            {t("chat.p2pHelpDetail1")}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <ShieldAlert size={16} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            {t("chat.p2pHelpDetail2")}
          </p>
        </div>
        <div className="flex gap-3 p-3 bg-green-500/5 rounded-xl border border-green-500/10">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <Wifi size={16} className="text-green-600" />
          </div>
          <p className="text-sm text-green-700 dark:text-green-400 font-medium pt-1">
            {t("chat.p2pHelpDetail3")}
          </p>
        </div>
      </div>

      <div className="p-3 bg-muted/30 rounded-xl flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-orange-500" />
        <p className="text-sm text-muted-foreground uppercase font-black tracking-widest">
          {t("chat.p2pHelpDetail4")}
        </p>
      </div>
    </div>
  );
};

/**
 * Video Call Preview Component
 */
const VideoCallOverlay: React.FC<{
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onClose: () => void;
}> = ({ localStream, remoteStream, onClose }) => {
  const { t } = useTranslation();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream)
      localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream)
      remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl aspect-video bg-muted/10 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Remote Video */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Video size={40} className="text-primary" />
            </div>
            <p className="text-white/60 font-medium animate-pulse">
              {t("chat.waitingForRemoteStream")}
            </p>
          </div>
        )}

        {/* Local Video (PIP) */}
        <div className="absolute bottom-6 right-6 w-32 sm:w-48 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl z-10">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onClose}
              className="w-14 h-14 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg hover:bg-destructive/90"
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-sm text-white/60 font-black uppercase tracking-widest">
              {t("chat.endCall")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChatUnifiedUI: React.FC = () => {
  const { t } = useTranslation();
  const {
    messages,
    rooms,
    nicknames,
    transport,
    selfId,
    activeTarget,
    setActiveTarget,
    sendMessage,
    startVoiceCall,
    startVideoCall,
    stopMediaCall,
    localStream,
    remoteStreams,
    clearHistory,
    sessionKeys,
    openKeyModal,
    quotingMessage,
    setQuotingMessage,
    auth,
    updateNickname,
    markConversationRead,
    chatConfig,
    updateChatConfig,
    capabilities,
    setIsOpen,
    isOpen,
    onlineUsers,
  } = useChat();

  const [inputDraft, setInputDraft] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSideTab, setActiveSideTab] = useState<
    "chats" | "invites" | "groups" | "profile" | "settings"
  >("chats");
  const [searchText, setSearchText] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingInvite, setEditingInvite] = useState<InviteInfo | null>(null);
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteDefaultNickname, setInviteDefaultNickname] = useState("");
  const [invites, setInvites] = useState<InviteInfo[]>([]);

  const [showUserSearch, setShowUserSearch] = useState(false);
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [groups, setGroups] = useState<GroupInfo[]>([]);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isUpdatingNickname, setIsUpdatingNickname] = useState(false);

  const isP2P = transport === "webrtc";

  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(searchText.toLowerCase()) ||
        r.id.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [rooms, searchText]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeTarget),
    [rooms, activeTarget],
  );

  const handleMediaCall = async (type: "voice" | "video") => {
    if (!activeTarget) return;
    if (!isP2P) {
      toast.info(t("chat.p2pRequiredToast"));
      return;
    }
    try {
      if (type === "voice") await startVoiceCall(activeTarget);
      else await startVideoCall(activeTarget);
      setCallType(type);
      setIsCalling(true);
    } catch {
      toast.error(t("chat.callFailed"));
    }
  };

  const handleSend = (text: string) => {
    if (activeTarget) {
      sendMessage(activeTarget, text, activeRoom?.isGroup);
    }
  };

  const handleEndCall = () => {
    stopMediaCall(activeTarget);
    setIsCalling(false);
  };

  const handleRetry = useCallback((msg: Message) => {
    setInputDraft(msg.content);
  }, []);

  const fetchInvites = useCallback(async () => {
    const { data } = await client.GET("/api/v1/chat/invites");
    if (data?.success) {
      setInvites(
        (data.data as InviteInfo[]).sort((a, b) => {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }),
      );
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    const { data } = await client.GET("/api/v1/chat/groups");
    if (data?.success) {
      setGroups(data.data as GroupInfo[]);
    }
  }, []);

  const handleSaveInvite = useCallback(async () => {
    const expiresAt = new Date(
      Date.now() + inviteDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    if (editingInvite) {
      const { data } = await client.PUT("/api/v1/chat/invites/{id}", {
        params: { path: { id: editingInvite.id } },
        body: {
          expires_at: expiresAt,
          nickname: inviteDefaultNickname || undefined,
        },
      });
      if (data?.success) {
        toast.success(t("chat.inviteUpdated"));
        setInviteModalOpen(false);
        fetchInvites();
      }
    } else {
      const { data } = await client.POST("/api/v1/chat/invites", {
        body: {
          expires_at: expiresAt,
          nickname: inviteDefaultNickname || undefined,
        },
      });
      if (data?.success) {
        const inviteId = data.data as string;
        navigator.clipboard.writeText(inviteUrl(inviteId));
        toast.success(t("chat.inviteCreatedAndCopied"));
        setInviteModalOpen(false);
        setInviteDefaultNickname("");
        fetchInvites();
      }
    }
  }, [editingInvite, inviteDays, inviteDefaultNickname, fetchInvites, t]);

  const handleSoftDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t("chat.confirmDeleteInvite"))) return;
      const { data } = await client.DELETE("/api/v1/chat/invites/{id}", {
        params: { path: { id } },
      });
      if (data?.success) {
        toast.success(t("chat.inviteDeleted"));
        fetchInvites();
      }
    },
    [fetchInvites, t],
  );

  const handleUpdateNickname = useCallback(async () => {
    if (!nicknameInput.trim() || selfId === "guest" || isUpdatingNickname)
      return;
    setIsUpdatingNickname(true);
    try {
      const { data, error } = await client.PUT("/api/v1/chat/guests/nickname", {
        body: { id: selfId, nickname: nicknameInput.trim() },
      });
      if (data?.success) {
        updateNickname(selfId, nicknameInput.trim());
        setNicknameInput("");
        toast.success(t("chat.nicknameUpdated"));
      } else if (error) {
        toast.error(getErrorMessage(error, t("common.error")));
      }
    } finally {
      setIsUpdatingNickname(false);
    }
  }, [nicknameInput, selfId, isUpdatingNickname, updateNickname, t]);

  const handleSearchUsers = useCallback(async () => {
    if (!userSearchKeyword.trim()) return;
    const { data } = await client.GET("/api/v1/chat/users/search", {
      params: { query: { keyword: userSearchKeyword } },
    });
    if (data?.success) {
      setUserSearchResults(data.data as UserSearchResult[]);
    }
  }, [userSearchKeyword]);

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim()) {
      toast.error(t("chat.groupNameRequired"));
      return;
    }
    const members = groupMembers
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const { data, error } = await client.POST("/api/v1/chat/groups", {
      body: { name: groupName, member_ids: members },
    });
    if (data?.success) {
      setGroupName("");
      setGroupMembers("");
      fetchGroups();
      setShowGroupModal(false);
      toast.success(t("chat.groupCreated"));
    } else if (error) {
      toast.error(getErrorMessage(error, t("common.error")));
    }
  }, [groupName, groupMembers, fetchGroups, t]);

  const handleDisbandGroup = useCallback(
    async (groupId: string) => {
      const { data } = await client.DELETE("/api/v1/chat/groups/{group_id}", {
        params: { path: { group_id: groupId } },
      });
      if (data?.success) {
        fetchGroups();
        if (activeTarget === groupId) setActiveTarget("");
        toast.success(t("chat.groupDisbanded"));
      }
    },
    [activeTarget, setActiveTarget, fetchGroups, t],
  );

  const inviteUrl = useCallback((id: string) => {
    return `${window.location.origin}/ui/#mod=chat&page=guest&invite=${encodeURIComponent(id)}`;
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, setIsOpen, isMobileMenuOpen]);

  useEffect(() => {
    if (isOpen) {
      if (activeSideTab === "invites" && auth.type === "system") fetchInvites();
      if (activeSideTab === "groups") fetchGroups();
    }
  }, [isOpen, activeSideTab, auth.type, fetchInvites, fetchGroups]);

  useEffect(() => {
    if (!activeTarget || !isOpen) return;
    markConversationRead(activeTarget);
  }, [markConversationRead, activeTarget, messages.length, isOpen]);

  useEffect(() => {
    if (activeTarget && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [activeTarget]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-2 md:p-4 lg:p-6">
      <div className="bg-background border-0 sm:border-2 border-border rounded-none sm:rounded-2xl lg:rounded-3xl shadow-2xl w-full sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-6xl xl:max-w-7xl h-[100dvh] sm:h-[90vh] lg:h-[92vh] flex overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="hidden lg:flex w-20 flex-col items-center py-6 gap-3 bg-slate-900 dark:bg-slate-950 border-r border-slate-800 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-2 ring-2 ring-primary/20">
            <MessageSquare size={22} />
          </div>

          <div className="w-10 h-px bg-slate-700 my-2" />

          <nav className="flex flex-col gap-2 flex-1 w-full px-3">
            <NavIcon
              active={activeSideTab === "chats"}
              onClick={() => setActiveSideTab("chats")}
              icon={<MessageSquare size={20} />}
            />

            {auth.type === "system" && (
              <>
                <NavIcon
                  active={activeSideTab === "invites"}
                  onClick={() => setActiveSideTab("invites")}
                  icon={<UserPlus size={20} />}
                />
                <NavIcon
                  active={activeSideTab === "groups"}
                  onClick={() => setActiveSideTab("groups")}
                  icon={<Users size={20} />}
                />
              </>
            )}

            {auth.type === "guest" && (
              <NavIcon
                active={activeSideTab === "profile"}
                onClick={() => setActiveSideTab("profile")}
                icon={<User size={20} />}
              />
            )}
          </nav>

          <div className="flex flex-col gap-2 w-full px-3 mt-auto">
            <NavIcon
              active={activeSideTab === "settings"}
              onClick={() => setActiveSideTab("settings")}
              icon={<Settings size={20} />}
            />
            {auth.type !== "guest" && (
              <button
                onClick={() => setIsOpen(false)}
                className="w-full aspect-square rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 transition-all mt-2"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            "w-full md:w-[340px] lg:w-[380px] border-r border-border flex flex-col bg-muted/30 transition-all duration-300",
            activeTarget && "hidden md:flex",
            !showSidebar &&
              "md:w-0 md:opacity-0 md:-translate-x-full overflow-hidden",
          )}
        >
          <div className="h-16 lg:h-18 border-b border-border flex items-center justify-between px-4 lg:px-5 bg-background shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors"
              >
                <Menu size={20} />
              </button>

              <h2 className="text-base lg:text-lg font-semibold">
                {t(`chat.tabs.${activeSideTab}`)}
              </h2>
              {activeSideTab === "chats" && (
                <Badge
                  variant="secondary"
                  className="text-sm hidden sm:inline-flex"
                >
                  {filteredRooms.length}
                </Badge>
              )}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 hover:bg-muted rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="lg:hidden border-b border-border bg-background p-2 space-y-1 animate-in slide-in-from-top-2">
              <MobileNavItem
                active={activeSideTab === "chats"}
                onClick={() => {
                  setActiveSideTab("chats");
                  setIsMobileMenuOpen(false);
                }}
                icon={<MessageSquare size={18} />}
                label={t("chat.chats")}
              />
              {auth.type === "system" && (
                <>
                  <MobileNavItem
                    active={activeSideTab === "invites"}
                    onClick={() => {
                      setActiveSideTab("invites");
                      setIsMobileMenuOpen(false);
                    }}
                    icon={<UserPlus size={18} />}
                    label={t("chat.invites")}
                  />
                  <MobileNavItem
                    active={activeSideTab === "groups"}
                    onClick={() => {
                      setActiveSideTab("groups");
                      setIsMobileMenuOpen(false);
                    }}
                    icon={<Users size={18} />}
                    label={t("chat.groups")}
                  />
                </>
              )}
              {auth.type === "guest" && (
                <MobileNavItem
                  active={activeSideTab === "profile"}
                  onClick={() => {
                    setActiveSideTab("profile");
                    setIsMobileMenuOpen(false);
                  }}
                  icon={<User size={18} />}
                  label={t("chat.profile")}
                />
              )}
              <MobileNavItem
                active={activeSideTab === "settings"}
                onClick={() => {
                  setActiveSideTab("settings");
                  setIsMobileMenuOpen(false);
                }}
                icon={<Settings size={18} />}
                label={t("chat.settings")}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeSideTab === "chats" && (
              <ChatSidebar
                searchText={searchText}
                setSearchText={setSearchText}
                filteredRooms={filteredRooms}
                onOpenUserSearch={() => setShowUserSearch(true)}
                onOpenSettings={() => setShowSettingsModal(true)}
                onOpenGroupModal={() => setShowGroupModal(true)}
                onOpenHelp={() => setShowHelpModal(true)}
              />
            )}

            {activeSideTab === "profile" && auth.type === "guest" && (
              <div className="p-4 lg:p-5 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t("chat.yourNickname")}
                  </label>
                  <div className="relative">
                    <Input
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder={nicknames[selfId] || selfId.split(":").pop()}
                      className="h-11 pr-12"
                    />
                    <button
                      onClick={handleUpdateNickname}
                      disabled={isUpdatingNickname || !nicknameInput.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-lg disabled:opacity-30 transition-all"
                    >
                      {isUpdatingNickname ? (
                        <Clock size={16} className="animate-spin" />
                      ) : (
                        <Check size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("chat.guestNote")}
                  </p>
                </div>
              </div>
            )}

            {activeSideTab === "invites" && auth.type === "system" && (
              <div className="p-3 lg:p-4 space-y-4">
                <Button
                  onClick={() => {
                    setEditingInvite(null);
                    setInviteDays(7);
                    setInviteDefaultNickname("");
                    setInviteModalOpen(true);
                  }}
                  className="w-full h-11 gap-2"
                >
                  <Plus size={16} /> {t("chat.addInvite")}
                </Button>

                <div className="space-y-3">
                  {invites.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Info size={28} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("chat.noInvites")}
                      </p>
                    </div>
                  )}
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className={cn(
                        "p-4 bg-background border rounded-xl space-y-3 relative group transition-all border-border hover:border-primary/30 shadow-sm",
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate mb-1">
                            {inv.nickname}
                          </p>
                          <p className="text-sm font-mono text-muted-foreground mb-2 truncate">
                            {inv.id}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-sm">
                              {new Date(inv.expires_at).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <ActionBtn
                            onClick={() => {
                              setEditingInvite(inv);
                              setInviteDays(
                                Math.max(
                                  1,
                                  Math.ceil(
                                    (new Date(inv.expires_at).getTime() -
                                      Date.now()) /
                                      (24 * 60 * 60 * 1000),
                                  ),
                                ),
                              );
                              setInviteDefaultNickname(inv.nickname);
                              setInviteModalOpen(true);
                            }}
                            icon={<Settings size={18} />}
                          />
                          <ActionBtn
                            onClick={() => handleSoftDelete(inv.id)}
                            icon={<Trash2 size={18} />}
                            variant="danger"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl(inv.id));
                          toast.success(t("chat.copied"));
                        }}
                        className="w-full py-2.5 bg-primary/5 text-primary rounded-lg text-sm hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2 font-medium"
                      >
                        <Copy size={18} />
                        {t("chat.copyLink")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSideTab === "groups" && (
              <div className="p-3 lg:p-4 space-y-4">
                <Button
                  onClick={() => setShowGroupModal(true)}
                  className="w-full h-11 gap-2"
                >
                  <Plus size={16} /> {t("chat.createGroup")}
                </Button>

                <div className="space-y-3">
                  {groups.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Users size={28} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("chat.noGroups")}
                      </p>
                    </div>
                  )}
                  {groups.map((group) => (
                    <div
                      key={group.group_id}
                      className="p-4 bg-background border border-border rounded-xl flex items-center gap-4 group hover:border-primary/30 transition-all shadow-sm"
                    >
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-semibold text-lg shrink-0 ring-1 ring-primary/10">
                        {group.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ID: {group.group_id.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <ActionBtn
                          onClick={() => {
                            setActiveTarget(group.group_id);
                            markConversationRead(group.group_id);
                          }}
                          icon={<MessageSquare size={18} />}
                        />
                        {group.owner_uid === selfId && (
                          <ActionBtn
                            onClick={() => handleDisbandGroup(group.group_id)}
                            icon={<Trash2 size={18} />}
                            variant="danger"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSideTab === "settings" && (
              <div className="p-4 lg:p-5 space-y-8">
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex gap-3">
                  <AlertCircle size={18} className="text-orange-600 shrink-0" />
                  <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                    {t("chat.noPersistenceWarning")}
                  </p>
                </div>
                <section className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("chat.generalSettings")}
                  </h4>
                  <div className="space-y-3">
                    <SettingCard
                      label={t("chat.saveHistory")}
                      desc={t("chat.saveHistoryDesc")}
                      checked={chatConfig.saveHistory}
                      onChange={(v) => updateChatConfig({ saveHistory: v })}
                    />
                    <SettingCard
                      label={t("chat.enableWebRTC")}
                      desc={t("chat.enableWebRTCDesc")}
                      checked={chatConfig.enableWebRTC}
                      onChange={(v) => updateChatConfig({ enableWebRTC: v })}
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t("chat.networkSettings")}
                  </h4>
                  <div className="p-4 rounded-xl bg-muted border border-border space-y-3">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("chat.transportBackend")}
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary transition-all"
                      value={chatConfig.transportBackend}
                      onChange={(e) =>
                        updateChatConfig({
                          transportBackend: parseTransportBackend(e.target.value),
                        })
                      }
                    >
                      {capabilities?.enabled !== false && (
                        <option value="ws">{t("chat.transport.ws")}</option>
                      )}
                      {capabilities?.enable_mqtt_proxy_broker !== false && (
                        <option value="mqtt-proxy">
                          {t("chat.transport.mqttProxy")}
                        </option>
                      )}
                      <option value="mqtt-external">
                        {t("chat.transport.mqttExternal")}
                      </option>
                    </select>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 bg-background",
            !activeTarget && "hidden md:flex",
          )}
        >
          {!activeTarget ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-8 text-center bg-muted/20">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full" />
                <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-3xl bg-gradient-to-br from-primary/30 via-primary/10 to-background flex items-center justify-center text-primary shadow-xl ring-1 ring-primary/20">
                  <MessageSquare size={48} strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-xl lg:text-2xl font-semibold mb-3">
                {t("chat.welcomeTitle")}
              </h3>
              <p className="text-muted-foreground text-sm lg:text-base max-w-xs lg:max-w-sm mb-10">
                {t("chat.welcomeDesc")}
              </p>

              <div className="flex flex-wrap justify-center gap-4 lg:gap-5">
                <FeatureCard
                  icon={<Shield size={24} />}
                  label={t("chat.e2eEncryption")}
                />
                <FeatureCard
                  icon={<Zap size={24} />}
                  label={t("chat.p2pTransport")}
                />
                <FeatureCard
                  icon={<Globe size={24} />}
                  label={t("chat.multiBackend")}
                />
                <FeatureCard
                  icon={<AlertCircle size={24} className="text-orange-500" />}
                  label={t("chat.noPersistence")}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="h-14 sm:h-16 border-b border-border px-3 sm:px-5 flex items-center justify-between bg-background shrink-0">
                <div className="flex items-center gap-2 sm:gap-4">
                  <button
                    onClick={() => setActiveTarget("")}
                    className="md:hidden p-2 -ml-1 hover:bg-muted rounded-xl transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="hidden md:flex p-2 hover:bg-muted rounded-xl transition-colors"
                  >
                    <ChevronLeft
                      size={18}
                      className={cn(!showSidebar && "rotate-180")}
                    />
                  </button>

                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shrink-0 ring-1 ring-primary/10">
                    {activeRoom?.isGroup ? (
                      <Users size={18} />
                    ) : (
                      <span className="text-sm sm:text-base font-semibold">
                        {(nicknames[activeTarget] ||
                          activeTarget)[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate">
                      {activeRoom?.name ||
                        nicknames[activeTarget] ||
                        activeTarget}
                    </h3>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          onlineUsers.includes(activeTarget.toLowerCase())
                            ? "bg-green-500"
                            : "bg-muted-foreground/30",
                        )}
                      />
                      <span className="hidden sm:inline">
                        {onlineUsers.includes(activeTarget.toLowerCase())
                          ? t("chat.statusOnline")
                          : t("chat.statusOffline")}
                      </span>
                      <span className="sm:hidden">
                        {onlineUsers.includes(activeTarget.toLowerCase())
                          ? t("chat.statusOnline")
                          : t("chat.statusOffline")}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-sm font-medium",
                          transport === "webrtc"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {transport === "webrtc"
                          ? "P2P"
                          : transport.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={() => openKeyModal(activeTarget)}
                    className={cn(
                      "p-2 sm:p-2.5 rounded-xl transition-all",
                      sessionKeys[activeTarget]
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    title={t("chat.sessionKey")}
                  >
                    {sessionKeys[activeTarget] ? (
                      <Lock size={16} />
                    ) : (
                      <Unlock size={16} />
                    )}
                  </button>

                  {!activeRoom?.isGroup && (
                    <>
                      <button
                        onClick={() => handleMediaCall("voice")}
                        disabled={isCalling}
                        className={cn(
                          "p-2 sm:p-2.5 rounded-xl transition-all",
                          !isP2P
                            ? "text-muted-foreground/40 hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted",
                          isCalling &&
                            callType === "voice" &&
                            "text-primary bg-primary/10 animate-pulse",
                        )}
                        title={
                          isP2P
                            ? t("chat.startVoiceCall")
                            : t("chat.p2pRequired")
                        }
                      >
                        <Phone size={16} />
                      </button>

                      <button
                        onClick={() => handleMediaCall("video")}
                        disabled={isCalling}
                        className={cn(
                          "p-2 sm:p-2.5 rounded-xl transition-all",
                          !isP2P
                            ? "text-muted-foreground/40 hover:bg-muted"
                            : "text-muted-foreground hover:bg-muted",
                          isCalling &&
                            callType === "video" &&
                            "text-primary bg-primary/10 animate-pulse",
                        )}
                        title={
                          isP2P
                            ? t("chat.startVideoCall")
                            : t("chat.p2pRequired")
                        }
                      >
                        <Video size={16} />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm(t("chat.confirmClearTargetHistory"))) {
                        clearHistory(activeTarget);
                      }
                    }}
                    className="p-2 sm:p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all hidden sm:flex"
                    title={t("chat.clearHistory")}
                  >
                    <Trash2 size={16} />
                  </button>

                  <button className="p-2 sm:p-2.5 text-muted-foreground hover:bg-muted rounded-xl transition-all">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>

              <ChatMessageList
                filteredMessages={messages.filter(
                  (m) => m.to === activeTarget || m.from === activeTarget,
                )}
                onRetry={handleRetry}
              />

              <div className="border-t border-border p-3 sm:p-4 bg-muted/30">
                {quotingMessage && (
                  <div className="max-w-3xl mx-auto mb-3 p-3 bg-background rounded-xl border border-border flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1 h-8 bg-primary rounded-full" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          {nicknames[quotingMessage.from] ||
                            quotingMessage.from}
                        </p>
                        <p className="text-sm truncate">
                          {quotingMessage.content}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setQuotingMessage(null)}
                      className="p-1.5 hover:bg-muted rounded-lg shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div className="max-w-3xl mx-auto">
                  <ChatInput
                    onSend={handleSend}
                    disabled={false}
                    externalValue={inputDraft}
                    onValueChange={setInputDraft}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <SessionKeyModal />

      {isCalling && callType === "video" && (
        <VideoCallOverlay
          localStream={localStream}
          remoteStream={remoteStreams[activeTarget] || null}
          onClose={handleEndCall}
        />
      )}

      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title={editingInvite ? t("chat.editInvite") : t("chat.addInvite")}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("chat.defaultNickname")}
            </label>
            <Input
              value={inviteDefaultNickname}
              onChange={(e) => setInviteDefaultNickname(e.target.value)}
              placeholder={t("chat.defaultNicknamePlaceholder")}
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">
              {t("chat.defaultNicknameDesc")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("chat.daysValid")}</label>
            <Input
              type="number"
              value={inviteDays}
              onChange={(e) => setInviteDays(parseInt(e.target.value) || 0)}
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">
              {t("chat.daysValidDesc")}
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setInviteModalOpen(false)}
              className="flex-1 h-11"
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveInvite} className="flex-1 h-11">
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={t("chat.p2pHelpButton")}
        maxWidth="max-w-lg"
      >
        <P2PHelpContent />
      </Modal>

      <Modal
        isOpen={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        title={t("chat.searchUser")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input
              placeholder={t("chat.searchUserPlaceholder")}
              value={userSearchKeyword}
              onChange={(e) => setUserSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
              className="h-11 flex-1"
            />
            <Button onClick={handleSearchUsers} className="h-11 w-11 p-0">
              <Search size={18} />
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {userSearchResults.map((u) => (
              <button
                key={u.user_id}
                onClick={() => {
                  setActiveTarget(u.user_id);
                  updateNickname(u.user_id, u.nickname || u.username);
                  setShowUserSearch(false);
                }}
                className="w-full p-4 border border-border rounded-xl flex items-center justify-between hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-semibold text-base ring-1 ring-primary/10">
                    {(u.nickname || u.username)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{u.nickname || u.username}</p>
                    <p className="text-sm text-muted-foreground">
                      ID: {u.user_id}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
            {userSearchKeyword && userSearchResults.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <AlertCircle size={28} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("common.noResults")}</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        title={t("chat.groups")}
        maxWidth="max-w-md"
      >
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("chat.groupName")}</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("chat.groupNamePlaceholder")}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("chat.groupMembers")}
            </label>
            <Input
              value={groupMembers}
              onChange={(e) => setGroupMembers(e.target.value)}
              placeholder={t("chat.groupMembersPlaceholder")}
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">
              {t("chat.groupMembersDesc")}
            </p>
          </div>
          <Button onClick={handleCreateGroup} className="w-full h-11">
            <UserPlus size={18} className="mr-2" />
            {t("chat.createGroup")}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title={t("chat.settings")}
        maxWidth="max-w-md"
      >
        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">
              {t("chat.generalSettings")}
            </h4>
            <div className="space-y-2">
              <SettingCard
                label={t("chat.enableChat")}
                desc={t("chat.enableChatDesc")}
                checked={chatConfig.enabled}
                onChange={(v) => updateChatConfig({ enabled: v })}
              />
              <SettingCard
                label={t("chat.saveHistory")}
                desc={t("chat.saveHistoryDesc")}
                checked={chatConfig.saveHistory}
                onChange={(v) => updateChatConfig({ saveHistory: v })}
              />
              <SettingCard
                label={t("chat.enableWebRTC")}
                desc={t("chat.enableWebRTCDesc")}
                checked={chatConfig.enableWebRTC}
                onChange={(v) => updateChatConfig({ enableWebRTC: v })}
              />
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
};

interface NavIconProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const NavIcon: React.FC<NavIconProps> = ({ active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
      active
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
        : "text-slate-400 hover:bg-slate-800 hover:text-white",
    )}
  >
    {icon}
  </button>
);

interface MobileNavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const MobileNavItem: React.FC<MobileNavItemProps> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
    )}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

interface ActionBtnProps {
  onClick: () => void;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

const ActionBtn: React.FC<ActionBtnProps> = ({
  onClick,
  icon,
  variant = "default",
}) => {
  const variantStyles = {
    default: "text-muted-foreground hover:bg-primary/10 hover:text-primary",
    success: "text-green-500 hover:bg-green-500/10",
    warning: "text-orange-500 hover:bg-orange-500/10",
    danger: "text-destructive hover:bg-destructive/10",
  };

  return (
    <button
      onClick={onClick}
      className={cn("p-2 rounded-lg transition-all", variantStyles[variant])}
    >
      {icon}
    </button>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  label: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, label }) => (
  <div className="flex flex-col items-center gap-2 p-4 lg:p-5 rounded-2xl bg-background border border-border shadow-sm hover:shadow-md transition-shadow">
    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
      {icon}
    </div>
    <span className="text-sm text-muted-foreground font-medium text-center">
      {label}
    </span>
  </div>
);

interface SettingCardProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const SettingCard: React.FC<SettingCardProps> = ({
  label,
  desc,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border hover:border-primary/20 transition-colors">
    <div className="space-y-0.5">
      <p className="font-medium">{label}</p>
      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
    </div>
    <Switch checked={checked} onChange={onChange} />
  </div>
);
