import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap,
  Server,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Trash2,
  Shield,
  Reply,
  Copy,
  ShieldCheck,
  FileIcon,
  Play,
  ArrowDownToLine,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useChat, type Message } from "@/hooks/ChatContext.tsx";
import { DecryptFailedBadge } from "@/components/chat/DecryptFailedBadge.tsx";
import { toast } from "@fileuni/shared";

interface ChatMessageListProps {
  filteredMessages: Message[];
  onRetry?: (msg: Message) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  filteredMessages,
  onRetry,
}) => {
  const { t } = useTranslation();
  const {
    selfId,
    nicknames,
    deleteMessage,
    openKeyModal,
    activeTarget,
    setQuotingMessage,
    messages,
  } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages]);

  const handleSetSessionKey = () => {
    if (!activeTarget) return;
    openKeyModal(activeTarget);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t("chat.copied"));
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const shouldShowDate = (currentMsg: Message, prevMsg?: Message) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.timestamp).toDateString();
    const prevDate = new Date(prevMsg.timestamp).toDateString();
    return currentDate !== prevDate;
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar"
    >
      {filteredMessages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <MessageSquare size={28} className="text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("chat.startConversation")}
          </p>
        </div>
      )}

      {filteredMessages.map((msg, idx) => {
        const isSelf = msg.from === selfId;
        const isSystem = msg.type === "system" || msg.from === "system";
        const isFile = msg.type === "file" || !!msg.fileInfo;
        const prevMsg = idx > 0 ? filteredMessages[idx - 1] : undefined;
        const showDate = shouldShowDate(msg, prevMsg);
        const showAvatar =
          idx === 0 || filteredMessages[idx - 1].from !== msg.from || showDate;

        if (isSystem) {
          const isTransportSwitch = msg.id.startsWith("trans_");
          const isP2PConnected = msg.content === "P2P_CONNECTED";
          const isP2PDisconnected = msg.content === "P2P_DISCONNECTED";

          if (isP2PConnected || isP2PDisconnected) {
            return (
              <div
                key={msg.id}
                className="flex justify-center py-2 animate-in zoom-in duration-500"
              >
                <div
                  className={cn(
                    "px-3 py-1 rounded-lg border flex items-center gap-2 text-sm font-bold uppercase tracking-wider shadow-sm",
                    isP2PConnected
                      ? "bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400",
                  )}
                >
                  <Zap
                    size={10}
                    className={cn(
                      isP2PConnected ? "fill-green-500" : "fill-red-500",
                    )}
                  />
                  {isP2PConnected
                    ? t("chat.p2p_connected") || "P2P Connection Established"
                    : t("chat.p2p_disconnected") || "P2P Connection Lost"}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-center py-3">
              <div className="px-4 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground flex items-center gap-2 border border-border/50 shadow-sm">
                {isTransportSwitch ? (
                  <Zap size={18} className="text-yellow-500" />
                ) : (
                  <ShieldCheck size={18} className="text-primary" />
                )}
                {msg.content}
              </div>
            </div>
          );
        }

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div className="flex justify-center py-2">
                <span className="text-sm text-muted-foreground/60">
                  {new Date(msg.timestamp).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
            <div
              id={`msg_${msg.id}`}
              className={cn(
                "flex gap-3 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                isSelf ? "self-end flex-row-reverse ml-auto" : "self-start",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 mt-0.5",
                  isSelf
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                  !showAvatar && "opacity-0",
                )}
              >
                {(nicknames[msg.from] || msg.from)[0].toUpperCase()}
              </div>

              <div
                className={cn(
                  "flex flex-col gap-0.5",
                  isSelf ? "items-end" : "items-start",
                )}
              >
                {showAvatar && (
                  <span className="text-sm text-muted-foreground px-1">
                    {nicknames[msg.from] || msg.from}
                    {msg.from.includes(":guest:") && (
                      <span className="ml-1.5 text-[14px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {t("chat.guest")}
                      </span>
                    )}
                  </span>
                )}

                <div
                  className={cn(
                    "relative group rounded-2xl px-4 py-2.5 text-sm shadow-sm min-w-[80px]",
                    isSelf
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm",
                  )}
                >
                  {/* 引用消息展示 / Quoted message display */}
                  {msg.replyTo && (
                    <div
                      onClick={() => {
                        const target = document.getElementById(
                          `msg_${msg.replyTo}`,
                        );
                        target?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        target?.classList.add(
                          "ring-2",
                          "ring-primary",
                          "transition-all",
                        );
                        setTimeout(
                          () =>
                            target?.classList.remove("ring-2", "ring-primary"),
                          2000,
                        );
                      }}
                      className={cn(
                        "mb-2 p-2 rounded-lg border-l-4 text-sm cursor-pointer hover:opacity-80 transition-all truncate max-w-full",
                        isSelf
                          ? "bg-black/10 border-white/30 text-white/80"
                          : "bg-primary/5 border-primary/30 text-muted-foreground",
                      )}
                    >
                      <p className="font-bold uppercase tracking-tighter opacity-60 mb-0.5">
                        {messages.find((m) => m.id === msg.replyTo)?.from ===
                        selfId
                          ? t("chat.youPrefix")
                          : nicknames[
                              messages.find((m) => m.id === msg.replyTo)
                                ?.from || ""
                            ] || "..."}
                      </p>
                      <div className="truncate opacity-90 italic">
                        {messages.find((m) => m.id === msg.replyTo)?.content ||
                          t("chat.noMessages")}
                      </div>
                    </div>
                  )}

                  {isFile ? (
                    <div className="flex flex-col gap-3 min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-background/20 flex items-center justify-center shrink-0">
                          <FileIcon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">
                            {msg.fileInfo?.name}
                          </p>
                          <p className="text-sm opacity-70">
                            {formatFileSize(msg.fileInfo?.size || 0)}
                          </p>
                        </div>
                      </div>

                      {msg.status === "sending" && (
                        <div className="w-full bg-background/20 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-current h-full transition-all duration-300"
                            style={{ width: `${msg.fileInfo?.progress || 0}%` }}
                          />
                        </div>
                      )}

                      {msg.fileInfo?.localUrl && (
                        <div className="flex justify-end gap-2">
                          {msg.fileInfo.mime.startsWith("audio/") ? (
                            <div className="flex items-center gap-2 w-full pt-1">
                              <button
                                onClick={() => {
                                  const audio = audioRefs.current[msg.id];
                                  if (audio) {
                                    if (audio.paused) audio.play();
                                    else audio.pause();
                                  }
                                }}
                                className="w-8 h-8 rounded-full bg-background/20 flex items-center justify-center hover:bg-background/30 transition-colors"
                              >
                                <Play size={18} className="ml-0.5" />
                              </button>
                              <audio
                                ref={(el) => {
                                  if (el) audioRefs.current[msg.id] = el;
                                }}
                                src={msg.fileInfo.localUrl}
                                className="hidden"
                              />
                              <div className="flex-1 h-1 bg-background/20 rounded-full" />
                            </div>
                          ) : (
                            <a
                              href={msg.fileInfo.localUrl}
                              download={msg.fileInfo.name}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/20 hover:bg-background/30 transition-colors text-sm font-bold"
                            >
                              <ArrowDownToLine size={18} />
                              {t("common.download")}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </div>
                  )}

                  {msg.decryptFailed && (
                    <div className="mt-2 pt-2 border-t border-white/20 flex flex-col gap-2">
                      <DecryptFailedBadge />
                      <button
                        onClick={handleSetSessionKey}
                        className="text-sm flex items-center gap-1 opacity-80 hover:opacity-100"
                      >
                        <Shield size={10} /> {t("chat.setKeyToDecrypt")}
                      </button>
                    </div>
                  )}

                  <div
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                      isSelf ? "-left-16" : "-right-16",
                    )}
                  >
                    <button
                      onClick={() => handleCopy(msg.content)}
                      className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg shadow-sm"
                      title={t("chat.copy")}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => setQuotingMessage(msg)}
                      className="p-1.5 bg-muted hover:bg-muted/80 rounded-lg shadow-sm"
                      title={t("chat.reply")}
                    >
                      <Reply size={18} />
                    </button>
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="p-1.5 bg-muted hover:bg-destructive/10 text-destructive rounded-lg shadow-sm"
                      title={t("chat.delete")}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                  <span>{formatTime(msg.timestamp)}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded",
                      msg.transport === "webrtc" &&
                        "bg-green-500/10 text-green-600",
                      msg.transport !== "webrtc" &&
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {msg.transport === "webrtc" ? (
                      <Zap size={8} />
                    ) : msg.transport.includes("mqtt") ? (
                      <Server size={8} className="text-orange-500" />
                    ) : (
                      <Server size={8} />
                    )}
                    {msg.transport === "webrtc"
                      ? "P2P"
                      : msg.transport === "mqtt-proxy"
                        ? "MQTT-Proxy"
                        : msg.transport === "mqtt-external"
                          ? "MQTT-Ext"
                          : msg.transport.toUpperCase()}
                  </span>
                  {isSelf && (
                    <span
                      className={cn(
                        "flex items-center",
                        msg.status === "read" && "text-green-500",
                        msg.status === "failed" && "text-destructive",
                      )}
                    >
                      {msg.status === "sending" && (
                        <Clock size={10} className="animate-spin" />
                      )}
                      {msg.status === "delivered" && <Check size={10} />}
                      {msg.status === "read" && <CheckCheck size={18} />}
                      {msg.status === "failed" && (
                        <button
                          onClick={() => onRetry?.(msg)}
                          className="flex items-center gap-1 hover:underline"
                        >
                          <AlertCircle size={10} />
                          {t("chat.retry")}
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
