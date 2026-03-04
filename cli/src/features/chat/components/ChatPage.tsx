import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Zap,
  Trash2,
  Users,
  UserPlus,
  User,
  MoreVertical,
  Shield,
  Globe,
  Phone,
  PhoneOff,
  Copy,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useChat } from "@/hooks/ChatContext.tsx";
import { client } from "@/lib/api.ts";
import { useConfigStore } from "@/stores/config.ts";
import type { TransportBackend } from "@/hooks/ChatTypes";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Modal } from "@/components/ui/Modal.tsx";
import { Badge } from "@/components/ui/Badge.tsx";
import { Switch } from "@/components/ui/Switch.tsx";
import { toast } from "@fileuni/shared";

// Sub-components
import { ChatSidebar } from "./ChatSidebar";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

type InviteInfo = {
  id: string;
  creator_uid: string;
  nickname: string;
  expires_at: string;
  created_at: string;
};

type GroupInfo = {
  group_id: string;
  name: string;
  owner_uid: string;
  created_at: string;
};

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

export const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    messages,
    rooms,
    nicknames,
    sendMessage,
    isConnected,
    transport,
    chatConfig,
    updateChatConfig,
    clearHistory,
    setActiveTarget,
    markConversationRead,
    activeTarget,
    startVoiceCall,
    stopMediaCall,
    updateNickname,
  } = useChat();
  const { capabilities } = useConfigStore();

  const [searchText, setSearchText] = useState("");
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<
    UserSearchResult[]
  >([]);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Data states
  const [inviteList, setInviteList] = useState<InviteInfo[]>([]);
  const [groupList, setGroupList] = useState<GroupInfo[]>([]);
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteNickname, setInviteNickname] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [inputDraft, setInputDraft] = useState("");

  const generalSettingItems: Array<{
    label: string;
    desc: string;
    key: "saveHistory" | "enableWebRTC";
  }> = [
    {
      label: t("chat.saveHistory"),
      desc: t("chat.saveHistoryDesc"),
      key: "saveHistory",
    },
    {
      label: t("chat.enableWebRTC"),
      desc: t("chat.enableWebRTCDesc"),
      key: "enableWebRTC",
    },
  ];

  const filteredRooms = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(searchText.toLowerCase()) ||
        r.id.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [rooms, searchText]);

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) =>
      activeTarget
        ? msg.to === activeTarget || msg.from === activeTarget
        : false,
    );
  }, [messages, activeTarget]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeTarget),
    [rooms, activeTarget],
  );

  const refreshInvites = async () => {
    try {
      const { data } = await client.GET("/api/v1/chat/invites");
      if (data?.success) {
        setInviteList(
          (data.data as InviteInfo[]).sort((a, b) => {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshGroups = async () => {
    try {
      const { data } = await client.GET("/api/v1/chat/groups");
      if (data?.success) {
        setGroupList(data.data as GroupInfo[]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshInvites();
    refreshGroups();
  }, []);

  useEffect(() => {
    if (!activeTarget) return;
    markConversationRead(activeTarget);
  }, [markConversationRead, activeTarget, messages.length]);

  const handleSearchUsers = async () => {
    if (!userSearchKeyword.trim()) return;
    const { data } = await client.GET("/api/v1/chat/users/search", {
      params: { query: { keyword: userSearchKeyword } },
    });
    if (data?.success) {
      setUserSearchResults(data.data as UserSearchResult[]);
    }
  };

  const handleCreateInvite = async () => {
    const expiresAt = new Date(
      Date.now() + inviteDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data } = await client.POST("/api/v1/chat/invites", {
      body: { nickname: inviteNickname || undefined, expires_at: expiresAt },
    });
    if (data?.success) {
      refreshInvites();
      toast.success(t("chat.inviteCreated"));
      setInviteNickname("");
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!window.confirm(t("chat.confirmDeleteInvite"))) return;
    const { data } = await client.DELETE("/api/v1/chat/invites/{id}", {
      params: { path: { id } },
    });
    if (data?.success) {
      refreshInvites();
      toast.success(t("chat.inviteDeleted"));
    }
  };

  const handleCreateGroup = async () => {
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
      refreshGroups();
      setShowGroupModal(false);
      toast.success(t("chat.groupCreated"));
    } else if (error) {
      toast.error(getErrorMessage(error, t("common.error")));
    }
  };

  const handleDisbandGroup = async (groupId: string) => {
    const { data } = await client.DELETE("/api/v1/chat/groups/{group_id}", {
      params: { path: { group_id: groupId } },
    });
    if (data?.success) {
      refreshGroups();
      if (activeTarget === groupId) setActiveTarget("");
      toast.success(t("chat.groupDisbanded"));
    }
  };

  const handleSend = async (content: string) => {
    if (!activeTarget) return;
    await sendMessage(activeTarget, content, activeRoom?.isGroup || false);
  };

  const handleCall = async () => {
    if (!activeTarget || activeRoom?.isGroup) return;
    if (isCalling) {
      stopMediaCall(activeTarget);
      setIsCalling(false);
    } else {
      try {
        await startVoiceCall(activeTarget);
        setIsCalling(true);
      } catch (err) {
        toast.error(t("chat.callFailed"));
      }
    }
  };

  const inviteUrl = (id: string) =>
    `${window.location.origin}/ui/#mod=chat&page=guest&invite=${encodeURIComponent(id)}`;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-background border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-700">
      <ChatSidebar
        searchText={searchText}
        setSearchText={setSearchText}
        filteredRooms={filteredRooms}
        onOpenUserSearch={() => setShowUserSearch(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenGroupModal={() => setShowGroupModal(true)}
        onOpenHelp={() => {}}
      />

      <div className="flex-1 flex flex-col bg-background relative min-w-0">
        {activeTarget ? (
          <>
            {/* Header */}
            <div className="h-24 border-b border-border px-8 flex items-center justify-between bg-background/40 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-4 group cursor-pointer">
                <div className="w-12 h-12 rounded-[1.3rem] bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner transition-transform group-hover:scale-105">
                  {activeRoom?.isGroup ? (
                    <Users size={24} />
                  ) : nicknames[activeTarget] ? (
                    nicknames[activeTarget][0].toUpperCase()
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg tracking-tight leading-none">
                      {activeRoom?.name ||
                        nicknames[activeTarget] ||
                        activeTarget}
                    </h3>
                    {activeRoom?.isGroup && (
                      <Badge
                        variant="outline"
                        className="text-[14px] font-black uppercase tracking-widest h-4 bg-muted/50 border-none"
                      >
                        {t("chat.group")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected
                          ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                          : "bg-zinc-400",
                      )}
                    />
                    <span className="text-sm font-black uppercase opacity-40 tracking-[0.15em] flex items-center gap-1.5">
                      {isConnected
                        ? t("chat.statusOnline")
                        : t("chat.statusOffline")}
                      <span className="opacity-20">•</span>
                      <span
                        className={cn(
                          transport === "webrtc" ? "text-green-500" : "",
                        )}
                      >
                        {transport === "webrtc" ? (
                          <Zap size={10} className="inline mr-1" />
                        ) : (
                          <Globe size={10} className="inline mr-1" />
                        )}
                        {transport.toUpperCase()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!activeRoom?.isGroup && (
                  <Button
                    size="icon"
                    variant={isCalling ? "destructive" : "ghost"}
                    onClick={handleCall}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      isCalling &&
                        "animate-pulse shadow-lg shadow-destructive/20",
                    )}
                  >
                    {isCalling ? <PhoneOff size={20} /> : <Phone size={20} />}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-xl"
                  onClick={() => {
                    if (window.confirm(t("chat.confirmClearTargetHistory")))
                      clearHistory(activeTarget);
                  }}
                >
                  <Trash2
                    size={20}
                    className="text-destructive/60 hover:text-destructive transition-colors"
                  />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-10 h-10 rounded-xl"
                >
                  <MoreVertical size={20} />
                </Button>
              </div>
            </div>

            <ChatMessageList
              filteredMessages={filteredMessages}
              onRetry={(msg) => setInputDraft(msg.content)}
            />

            <ChatInput
              onSend={handleSend}
              disabled={!isConnected}
              externalValue={inputDraft}
              onValueChange={setInputDraft}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/5 select-none overflow-hidden">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
              <div className="relative w-32 h-32 rounded-[3rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-2xl border border-white/10">
                <MessageSquare size={64} className="drop-shadow-lg" />
              </div>
            </div>
            <h3 className="text-4xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/40">
              {t("chat.welcomeTitle")}
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed font-medium opacity-60">
              {t("chat.welcomeDesc")}
            </p>
            <div className="mt-16 flex flex-wrap justify-center gap-6 animate-in slide-in-from-bottom-10 duration-1000">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center text-primary/60">
                  <Shield size={28} />
                </div>
                <span className="text-sm font-black uppercase opacity-40 tracking-[0.2em]">
                  {t("chat.e2eEncryption")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center text-green-500/60">
                  <Zap size={28} />
                </div>
                <span className="text-sm font-black uppercase opacity-40 tracking-[0.2em]">
                  {t("chat.p2pTransport")}
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center text-blue-500/60">
                  <Globe size={28} />
                </div>
                <span className="text-sm font-black uppercase opacity-40 tracking-[0.2em]">
                  {t("chat.multiBackend")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Search */}
      <Modal
        isOpen={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        title={t("chat.searchUser")}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              placeholder={t("chat.searchUserPlaceholder")}
              value={userSearchKeyword}
              className="h-12 rounded-2xl px-4"
              onChange={(e) => setUserSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
            />
            <Button
              onClick={handleSearchUsers}
              className="h-12 w-12 rounded-2xl shadow-lg"
            >
              <Search size={18} />
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {userSearchResults.map((u) => (
              <div
                key={u.user_id}
                className="p-4 border border-border rounded-2xl flex items-center justify-between hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer group"
                onClick={() => {
                  setActiveTarget(u.user_id);
                  updateNickname(u.user_id, u.nickname || u.username);
                  setShowUserSearch(false);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black group-hover:scale-110 transition-transform shadow-sm">
                    {(u.nickname || u.username)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-sm tracking-tight">
                      {u.nickname || u.username}
                    </p>
                    <p className="text-sm opacity-40 uppercase font-black">
                      ID: {u.user_id}
                    </p>
                  </div>
                </div>
                <MessageSquare
                  size={16}
                  className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Settings */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title={t("chat.settings")}
        maxWidth="max-w-xl"
      >
        <div className="space-y-8 py-2">
          <section className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 ml-1">
              {t("chat.generalSettings")}
            </h4>
            <div className="grid gap-3">
              {generalSettingItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-5 rounded-3xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-black tracking-tight">
                      {item.label}
                    </p>
                    <p className="text-sm opacity-50 font-medium leading-relaxed max-w-[280px]">
                      {item.desc}
                    </p>
                  </div>
                  <Switch
                    checked={chatConfig[item.key]}
                    onChange={(val) => updateChatConfig({ [item.key]: val })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 ml-1">
              {t("chat.networkSettings")}
            </h4>
            <div className="p-5 rounded-3xl bg-muted/20 border border-border/50 space-y-3">
              <label className="text-sm font-black uppercase opacity-60 ml-1">
                {t("chat.transportBackend")}
              </label>
              <select
                className="w-full h-12 px-4 rounded-2xl bg-background border-none shadow-inner outline-none transition-all font-bold text-sm"
                value={chatConfig.transportBackend}
                onChange={(e) =>
                  updateChatConfig({ transportBackend: parseTransportBackend(e.target.value) })
                }
              >
                {capabilities?.enable_chat !== false && (
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
      </Modal>

      {/* Invites */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={t("chat.invites")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 p-6 rounded-3xl bg-primary/5 border border-primary/10 items-end shadow-inner">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60 ml-1">
                {t("chat.nickname")}
              </label>
              <Input
                value={inviteNickname}
                placeholder={t('chat.nicknameOptional')}
                className="rounded-2xl h-11 border-none shadow-sm"
                onChange={(e) => setInviteNickname(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase opacity-60 ml-1">
                {t("chat.inviteDays")}
              </label>
              <Input
                type="number"
                value={inviteDays}
                className="rounded-2xl h-11 border-none shadow-sm"
                onChange={(e) => setInviteDays(Number(e.target.value))}
              />
            </div>
            <Button
              onClick={handleCreateInvite}
              className="h-11 rounded-2xl shadow-lg shadow-primary/20 font-black uppercase tracking-widest text-sm"
            >
              {t("chat.createInvite")}
            </Button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {inviteList.map((invite) => (
              <div
                key={invite.id}
                className="p-5 border border-border rounded-3xl bg-background flex items-center justify-between group transition-all hover:border-primary/20"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-xl tracking-tight truncate">
                      {invite.nickname}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm opacity-40 font-black uppercase tracking-[0.1em]">
                    <span className="font-mono truncate">{invite.id}</span>
                    <span className="w-1 h-1 bg-current rounded-full shrink-0" />
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock size={10} />{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteUrl(invite.id));
                      toast.success(t("chat.copied"));
                    }}
                  >
                    <Copy size={18} className="text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-xl hover:bg-red-50"
                    onClick={() => handleDeleteInvite(invite.id)}
                  >
                    <Trash2 size={18} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {inviteList.length === 0 && (
              <div className="py-20 text-center opacity-10 font-black uppercase tracking-[0.5em] text-sm">
                {t("chat.noInvites")}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Group Management */}
      <Modal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        title={t("chat.groups")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-8">
          <div className="space-y-4 p-6 rounded-3xl bg-muted/30 border border-border/50">
            <h4 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 ml-1">
              {t("chat.createGroup")}
            </h4>
            <div className="space-y-4">
              <Input
                placeholder={t("chat.groupName")}
                value={groupName}
                className="h-12 rounded-2xl border-none shadow-sm"
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className="space-y-2">
                <label className="text-sm font-black uppercase opacity-40 ml-1">
                  {t("chat.groupMembers")}
                </label>
                <Input
                  placeholder={t("chat.groupMembersPlaceholder")}
                  value={groupMembers}
                  className="h-12 rounded-2xl border-none shadow-sm"
                  onChange={(e) => setGroupMembers(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateGroup}
                className="w-full h-12 rounded-2xl gap-2 font-black uppercase tracking-widest text-sm shadow-lg shadow-primary/20"
              >
                <UserPlus size={18} /> {t("chat.createGroup")}
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
            {groupList.map((group) => (
              <div
                key={group.group_id}
                className="p-5 border border-border rounded-3xl bg-background flex items-center justify-between group hover:border-primary/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[1.3rem] bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner group-hover:scale-105 transition-transform">
                    {group.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black tracking-tight">{group.name}</p>
                    <p className="text-sm opacity-40 font-black uppercase tracking-wider">
                      ID: {group.group_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-xl"
                    onClick={() => {
                      setActiveTarget(group.group_id);
                      setShowGroupModal(false);
                    }}
                  >
                    <MessageSquare size={18} className="text-primary" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10 rounded-xl hover:bg-red-50"
                    onClick={() => handleDisbandGroup(group.group_id)}
                  >
                    <Trash2 size={18} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
