import React from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Settings,
  UserPlus,
  Users,
  User,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useChat, type Room } from "@/hooks/ChatContext.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Badge } from "@/components/ui/Badge.tsx";

interface ChatSidebarProps {
  searchText: string;
  setSearchText: (v: string) => void;
  filteredRooms: Room[];
  onOpenUserSearch: () => void;
  onOpenSettings: () => void;
  onOpenGroupModal: () => void;
  onOpenHelp: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  searchText,
  setSearchText,
  filteredRooms,
  onOpenUserSearch,
  onOpenSettings,
  onOpenGroupModal,
  onOpenHelp,
}) => {
  const { t } = useTranslation();
  const {
    activeTarget,
    setActiveTarget,
    markConversationRead,
    selfId,
    nicknames,
    onlineUsers,
    auth,
  } = useChat();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50"
            size={16}
          />
          <Input
            placeholder={t("chat.searchPlaceholder")}
            className="pl-9 h-9 text-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-sm gap-1"
            onClick={onOpenUserSearch}
          >
            <UserPlus size={18} /> {t("chat.newChat")}
          </Button>
          {auth.type === "system" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-sm gap-1"
              onClick={onOpenGroupModal}
            >
              <Users size={18} /> {t("chat.groups")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 custom-scrollbar">
        {filteredRooms.length > 0 ? (
          filteredRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => {
                setActiveTarget(room.id);
                markConversationRead(room.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                activeTarget === room.id
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50 border border-transparent",
              )}
            >
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                    activeTarget === room.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {room.isGroup ? (
                    <Users size={18} />
                  ) : nicknames[room.id] ? (
                    nicknames[room.id][0].toUpperCase()
                  ) : (
                    <User size={18} />
                  )}
                </div>
                {!room.isGroup &&
                  onlineUsers.includes(room.id.toLowerCase()) && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                  )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-sm truncate">
                    {room.name}
                  </span>
                  {room.lastMessage && (
                    <span className="text-sm text-muted-foreground shrink-0">
                      {formatTime(room.lastMessage.timestamp)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate max-w-[80%]">
                    {room.lastMessage?.from === selfId ? (
                      <span className="text-primary/70">
                        {t("chat.youPrefix")}
                      </span>
                    ) : null}
                    {room.lastMessage?.content || t("chat.noMessages")}
                  </p>
                  {room.unreadCount > 0 && activeTarget !== room.id && (
                    <Badge
                      variant="default"
                      className="h-5 min-w-5 px-1.5 text-sm flex items-center justify-center shrink-0"
                    >
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquare size={24} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("chat.noConversations")}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border/50 bg-muted/20 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-9 text-sm gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onOpenSettings}
        >
          <Settings size={18} /> {t("chat.settings")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-10 h-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
          onClick={onOpenHelp}
          title={t("chat.p2pHelpButton")}
        >
          <HelpCircle size={16} />
        </Button>
      </div>
    </div>
  );
};
