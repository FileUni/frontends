import { useState, useEffect, useMemo } from "react";
import {
  useFileStore,
  type TaskState,
} from "@/features/file-manager/store/useFileStore.ts";
import {
  useNotificationStore,
  type Notification,
} from "@/stores/notification.ts";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Check,
  ExternalLink,
  Info,
  Inbox,
  RefreshCw,
  MessageSquare,
  Users,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { client, extractData } from "@/lib/api.ts";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@fileuni/shared";
import { zhCN, enUS } from "date-fns/locale";
import { useLanguageStore } from "@fileuni/shared";
import { useChat, type ChatContextProps } from "@/hooks/ChatContext.tsx";
import { useConfigStore } from "@/stores/config.ts";
import { useAuthzStore } from "@/stores/authz.ts";
import type { Room } from "@/hooks/ChatContext.tsx";

export const StatusIndicator = ({ isDark }: { isDark: boolean }) => {
  const { t } = useTranslation();
  const { capabilities } = useConfigStore();
  const { hasPermission } = useAuthzStore();
  const getActiveTasks = useFileStore((state) => state.getActiveTasks);
  const tasks = getActiveTasks();

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotifications,
  } = useNotificationStore();

  // Chat integration
  let chat: ChatContextProps | null = null;
  try {
    chat = useChat();
  } catch (e) {
    // Chat context not available (e.g. during login/logout)
  }
  const chatRooms = chat?.rooms || [];
  const totalChatUnread = chatRooms.reduce(
    (sum: number, r: Room) => sum + r.unreadCount,
    0,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "tasks" | "notifications" | "chat" | "emails"
  >("tasks");

  // Email unread state for global badge
  const [totalEmailUnread, setTotalEmailUnread] = useState(0);

  const runningCount = useMemo(
    () =>
      tasks.filter((t) => t.status === "running" || t.status === "pending")
        .length,
    [tasks],
  );

  // Sync total unread count across all modules
  const totalAlerts = runningCount + unreadCount + totalChatUnread + totalEmailUnread;

  const fetchEmailUnread = async () => {
    if (capabilities?.enable_email_manager === false || !hasPermission("feature.email_manager.use")) {
      setTotalEmailUnread(0);
      return;
    }
    try {
      const data = await extractData<EmailAccount[]>(client.GET("/api/v1/email/accounts"));
      const count = data.reduce((sum, a) => sum + (a.unread_count || 0), 0);
      
      // If unread count increased, show a toast notification
      if (count > totalEmailUnread && totalEmailUnread > 0) {
        toast.info(t("email.newMessagesArrived", { count: count - totalEmailUnread, defaultValue: "You have new emails" }));
      }
      
      setTotalEmailUnread(count);
    } catch (e) { console.error("Email count fetch failed", e); }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUnreadCount();
      fetchNotifications();
    }
  }, [isOpen, fetchUnreadCount, fetchNotifications]);

  // Initial and Periodic refresh for global numbers
  useEffect(() => {
    if (capabilities?.enable_email_manager === false || !hasPermission("feature.email_manager.use")) {
      setTotalEmailUnread(0);
      return () => undefined;
    }

    fetchEmailUnread(); // Initial fetch
    
    // Listen for manual updates from EmailPage
    const handleRefresh = () => fetchEmailUnread();
    window.addEventListener('fileuni:email-refresh', handleRefresh);

    const timer = setInterval(() => {
      fetchUnreadCount();
      fetchEmailUnread();
    }, 60000);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('fileuni:email-refresh', handleRefresh);
    };
  }, [fetchUnreadCount, capabilities?.enable_email_manager, hasPermission]);

  const enableChat = capabilities?.enable_chat !== false && hasPermission("feature.chat.use");
  const enableEmail = capabilities?.enable_email_manager !== false && hasPermission("feature.email_manager.use");

  useEffect(() => {
    if (activeTab === "chat" && !enableChat) {
      setActiveTab("tasks");
    }
    if (activeTab === "emails" && !enableEmail) {
      setActiveTab("tasks");
    }
  }, [activeTab, enableChat, enableEmail]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-xl transition-all relative flex items-center justify-center border",
          isDark
            ? "bg-white/5 border-white/10 hover:bg-white/10 text-primary"
            : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-primary",
          totalAlerts > 0 && "animate-pulse-subtle",
        )}
      >
        {runningCount > 0 ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Bell size={20} />
        )}

        {totalAlerts > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-lg ring-2 ring-background">
            {totalAlerts > 99 ? "99+" : totalAlerts}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[120]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={cn(
              "absolute top-full right-0 mt-2 w-80 md:w-96 max-h-[80vh] flex flex-col z-[130] rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
              isDark
                ? "bg-zinc-950 border-white/10"
                : "bg-white border-gray-200",
            )}
          >
            {/* Header / Tabs */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => setActiveTab("tasks")}
                className={cn(
                  "flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all relative",
                  activeTab === "tasks"
                    ? "text-primary"
                    : "opacity-40 hover:opacity-100",
                )}
              >
                {t("filemanager.task.center")}
                {tasks.length > 0 && (
                  <span className="ml-1 opacity-60">({tasks.length})</span>
                )}
                {activeTab === "tasks" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all relative",
                  activeTab === "notifications"
                    ? "text-primary"
                    : "opacity-40 hover:opacity-100",
                )}
              >
                {t("common.notifications", { defaultValue: "Notifications" })}
                {unreadCount > 0 && (
                  <span className="ml-1 opacity-60">({unreadCount})</span>
                )}
                {activeTab === "notifications" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              {enableChat && (
                <button
                  onClick={() => setActiveTab("chat")}
                  className={cn(
                    "flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all relative",
                    activeTab === "chat"
                      ? "text-primary"
                      : "opacity-40 hover:opacity-100",
                  )}
                >
                  {t("chat.title", { defaultValue: "Chat" })}
                  {totalChatUnread > 0 && (
                    <span className="ml-1 opacity-60">({totalChatUnread})</span>
                  )}
                  {activeTab === "chat" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              )}
              {enableEmail && (
                <button
                  onClick={() => setActiveTab("emails")}
                  className={cn(
                    "flex-1 py-3 text-sm font-black uppercase tracking-widest transition-all relative",
                    activeTab === "emails"
                      ? "text-primary"
                      : "opacity-40 hover:opacity-100",
                  )}
                >
                  {t("email.title", { defaultValue: "Emails" })}
                  {totalEmailUnread > 0 && (
                    <span className="ml-1 opacity-60">({totalEmailUnread})</span>
                  )}
                  {activeTab === "emails" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-2">
              {activeTab === "tasks" ? (
                <TaskList tasks={tasks} isDark={isDark} />
              ) : activeTab === "notifications" ? (
                <NotificationList
                  notifications={notifications}
                  isDark={isDark}
                  onMarkRead={markAsRead}
                  onMarkAllRead={markAllAsRead}
                  onDelete={deleteNotifications}
                />
              ) : activeTab === "chat" ? (
                <ChatList
                  chat={chat!}
                  isDark={isDark}
                  onClose={() => setIsOpen(false)}
                />
              ) : (
                <EmailTabContent
                  isDark={isDark}
                  onOpenEmail={() => {
                    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
                    params.set("modalPage", "email");
                    window.location.hash = params.toString();
                    setIsOpen(false);
                  }}
                  externalTotalUnread={totalEmailUnread}
                />
              )}
            </div>

            {/* Footer */}
            {activeTab === "notifications" && notifications.length > 0 && (
              <div className="p-2 border-t flex justify-between bg-muted/30">
                <button
                  onClick={() => markAllAsRead()}
                  className="text-sm font-black uppercase opacity-40 hover:opacity-100 transition-all flex items-center gap-1"
                >
                  <Check size={18} />
                  {t("common.markAllRead", {
                    defaultValue: "Mark all as read",
                  })}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ChatList = ({
  chat,
  isDark,
  onClose,
}: {
  chat: ChatContextProps;
  isDark: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const rooms = chat?.rooms || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-1">
        {rooms.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center opacity-20 gap-3">
            <MessageSquare size={40} />
            <p className="text-sm font-black uppercase tracking-widest">
              {t("chat.noConversations")}
            </p>
          </div>
        ) : (
          rooms.map((room: Room) => (
            <button
              key={room.id}
              onClick={() => {
                chat.setActiveTarget(room.id);
                chat.setIsOpen(true);
                chat.markConversationRead(room.id);
                onClose();
              }}
              className={cn(
                "w-full p-3 rounded-xl border flex gap-3 transition-all text-left",
                isDark
                  ? "bg-white/5 border-white/5 hover:bg-white/10"
                  : "bg-gray-50 border-gray-100 hover:bg-gray-100",
                room.unreadCount > 0 &&
                  (isDark
                    ? "ring-1 ring-primary/30 bg-primary/5"
                    : "ring-1 ring-primary/20 bg-primary/5"),
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {room.isGroup ? <Users size={18} /> : <MessageSquare size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-black truncate">{room.name}</p>
                  {room.lastMessage && (
                    <span className="text-[14px] font-black uppercase opacity-30 whitespace-nowrap">
                      {formatDistanceToNow(new Date(room.lastMessage.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-60 mt-1 truncate">
                  {room.lastMessage?.content || "..."}
                </p>
              </div>
              {room.unreadCount > 0 && (
                <div className="bg-primary text-white text-[14px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 self-center">
                  {room.unreadCount}
                </div>
              )}
            </button>
          ))
        )}
      </div>
      
      {/* Chat Tab Footer */}
      <div className="p-3 border-t flex items-center justify-between mt-2">
        <button
          onClick={() => {
            chat.setIsOpen(true);
            onClose();
          }}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold transition-all ml-auto",
            isDark
              ? "bg-primary/20 hover:bg-primary/30 text-primary"
              : "bg-primary/10 hover:bg-primary/20 text-primary"
          )}
        >
          {t("chat.openFull", { defaultValue: "Open Chat" })}
        </button>
      </div>
    </div>
  );
};

const TaskItem = ({ task, isDark }: { task: TaskState; isDark: boolean }) => {
  const { t } = useTranslation();
  const { updateTask, removeTask } = useFileStore();

  useEffect(() => {
    if (
      task.status === "success" ||
      task.status === "failed" ||
      task.status === "interrupted"
    ) {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const { data, error } = await client.GET("/api/v1/file/task/{id}", {
          params: { path: { id: task.id } },
        });

        if (!error && data?.success) {
          const tData = data.data as unknown as {
            status: TaskState["status"];
            progress: number;
            message?: string;
          };
          updateTask(task.id, {
            status: tData.status,
            progress: tData.progress,
            message: tData.message || undefined,
          });
        }
      } catch (e) {
        console.error("Poll error:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [task.id, task.status, updateTask]);

  return (
    <div
      className={cn(
        "p-3 rounded-xl border group transition-all",
        isDark
          ? "bg-white/5 border-white/5 hover:bg-white/10"
          : "bg-gray-50 border-gray-100 hover:bg-gray-100",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black truncate">
            {t(`filemanager.task.type.${task.type}`, {
              defaultValue: task.type,
            })}
          </p>
          <p className="text-sm opacity-40 mt-0.5 truncate">
            {task.message ||
              (task.status === "running" ? "Processing..." : "Pending...")}
          </p>
        </div>
        {(task.status === "success" || task.status === "failed") && (
          <button
            onClick={() => removeTask(task.id)}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[14px] font-black uppercase tracking-tight">
          <span
            className={cn(
              task.status === "success"
                ? "text-green-500"
                : task.status === "failed"
                  ? "text-red-500"
                  : "opacity-40",
            )}
          >
            {task.status}
          </span>
          <span className="opacity-60">{task.progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              task.status === "failed"
                ? "bg-red-500"
                : task.status === "success"
                  ? "bg-green-500"
                  : "bg-primary",
            )}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const TaskList = ({
  tasks,
  isDark,
}: {
  tasks: TaskState[];
  isDark: boolean;
}) => {
  const { t } = useTranslation();
  const clearFinishedTasks = useFileStore((state) => state.clearFinishedTasks);

  if (tasks.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center opacity-20 gap-3">
        <RefreshCw size={40} className="animate-spin-slow" />
        <p className="text-sm font-black uppercase tracking-widest">
          {t("filemanager.task.allFinished")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center px-2 mb-2">
        <span className="text-sm font-black opacity-30 uppercase tracking-widest">
          Active Tasks
        </span>
        <button
          onClick={clearFinishedTasks}
          className="text-sm text-destructive font-black uppercase opacity-40 hover:opacity-100"
        >
          Clear
        </button>
      </div>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} isDark={isDark} />
      ))}
    </div>
  );
};

interface NotificationListProps {
  notifications: Notification[];
  isDark: boolean;
  onMarkRead: (ids: string[]) => void;
  onMarkAllRead: () => void;
  onDelete: (ids: string[]) => void;
}

const NotificationList = ({
  notifications,
  isDark,
  onMarkRead,
  onDelete,
}: NotificationListProps) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = language === "zh" ? zhCN : enUS;

  if (notifications.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center opacity-20 gap-3">
        <Inbox size={40} />
        <p className="text-sm font-black uppercase tracking-widest">
          {t("common.noNotifications", { defaultValue: "No notifications" })}
        </p>
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "success":
        return "text-green-500 bg-green-500/10";
      case "warning":
        return "text-yellow-500 bg-yellow-500/10";
      case "error":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-blue-500 bg-blue-500/10";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success":
        return <CheckCircle2 size={18} />;
      case "warning":
        return <AlertCircle size={18} />;
      case "error":
        return <AlertCircle size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  return (
    <div className="space-y-1">
      {notifications.map((n: Notification) => (
        <div
          key={n.id}
          className={cn(
            "p-3 rounded-xl border group transition-all relative overflow-hidden",
            isDark
              ? "bg-white/5 border-white/5 hover:bg-white/10"
              : "bg-gray-50 border-gray-100 hover:bg-gray-100",
            !n.is_read &&
              (isDark
                ? "ring-1 ring-primary/30 bg-primary/5"
                : "ring-1 ring-primary/20 bg-primary/5"),
          )}
          onClick={() => !n.is_read && onMarkRead([n.id])}
        >
          {!n.is_read && (
            <div className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-bl-lg" />
          )}

          <div className="flex gap-3">
            <div
              className={cn(
                "mt-0.5 p-1.5 rounded-lg shrink-0",
                getLevelColor(n.level),
              )}
            >
              {getLevelIcon(n.level)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-black truncate">{n.title}</p>
                <span className="text-[14px] font-black uppercase opacity-30 whitespace-nowrap">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                    locale: dateLocale,
                  })}
                </span>
              </div>
              <p className="text-sm opacity-60 mt-1 leading-relaxed line-clamp-2">
                {n.content}
              </p>

              <div className="mt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete([n.id]);
                  }}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 size={18} />
                </button>
                {n.extra_data?.task_id && (
                  <button className="p-1 rounded hover:bg-primary/10 text-primary">
                    <ExternalLink size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Email account type
interface EmailAccount {
  id: string;
  email_address: string;
  display_name?: string;
  unread_count?: number;
}

interface EmailSyncStatus {
  is_syncing: boolean;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'msg' in error) {
    const message = (error as { msg?: unknown }).msg;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return error instanceof Error ? error.message : fallback;
};

// Email tab content component
const EmailTabContent = ({
  isDark,
  onOpenEmail,
  externalTotalUnread,
}: {
  isDark: boolean;
  onOpenEmail: () => void;
  externalTotalUnread: number;
}) => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  // Fetch email accounts
  const fetchAccounts = async () => {
    try {
      const data = await extractData<EmailAccount[]>(client.GET("/api/v1/email/accounts"));
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed to fetch email accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSyncAccount = async (id: string) => {
    if (syncingAccountId) return;
    try {
      await extractData(client.POST("/api/v1/email/accounts/{id}/sync", {
        params: { path: { id } }
      }));
      setSyncingAccountId(id);
      toast.info(t("email.syncStarted"));
      
      const poll = setInterval(async () => {
        try {
          const res = await extractData<EmailSyncStatus>(client.GET("/api/v1/email/accounts/{id}/sync-status", {
            params: { path: { id } }
          }));
          if (!res.is_syncing) {
            clearInterval(poll);
            setSyncingAccountId(null);
            toast.success(t("email.syncSuccess", { defaultValue: "Sync Completed" }));
            fetchAccounts();
          }
        } catch { 
          clearInterval(poll); 
          setSyncingAccountId(null); 
        }
      }, 3000);
    } catch (err: unknown) { 
      // Handle frequency limiting
      const msg = getErrorMessage(err, t("email.syncFailed"));
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Account list with unread count / 账号列表带未读计数 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary opacity-50" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
            <Mail size={40} />
            <p className="text-sm font-black uppercase tracking-widest">{t("email.noAccounts")}</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                "group w-full p-3 rounded-xl border flex items-center justify-between gap-2 transition-all text-left relative",
                isDark
                  ? "bg-white/5 border-white/5 hover:bg-white/10"
                  : "bg-gray-50 border-gray-100 hover:bg-gray-100",
                account.unread_count && account.unread_count > 0 && (isDark ? "ring-1 ring-primary/30 bg-primary/5" : "ring-1 ring-primary/20 bg-primary/5")
              )}
            >
              <div 
                className="min-w-0 flex-1 cursor-pointer"
                onClick={onOpenEmail}
              >
                <p className="text-sm font-bold truncate">
                  {account.display_name || account.email_address}
                </p>
                <p className="text-sm opacity-60 truncate">{account.email_address}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncAccount(account.id);
                  }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary",
                    syncingAccountId === account.id && "opacity-100 animate-spin"
                  )}
                >
                  <RefreshCw size={18} />
                </button>
                {account.unread_count && account.unread_count > 0 && (
                  <span className="bg-primary text-white text-sm font-black px-2 py-0.5 rounded-full">
                    {account.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with total unread / 底部显示总未读数 */}
      <div className="p-3 border-t flex items-center justify-between mt-2">
        <div className="flex flex-col">
          {externalTotalUnread > 0 && (
            <span className="text-sm font-black uppercase text-primary tracking-tighter">
              {externalTotalUnread} {t("email.unreadMessages")}
            </span>
          )}
        </div>
        <button
          onClick={onOpenEmail}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold transition-all ml-auto",
            isDark
              ? "bg-primary/20 hover:bg-primary/30 text-primary"
              : "bg-primary/10 hover:bg-primary/20 text-primary"
          )}
        >
          {t("email.openFull")}
        </button>
      </div>
    </div>
  );
};
