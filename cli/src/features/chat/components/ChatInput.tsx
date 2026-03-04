import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Smile,
  Paperclip,
  Mic,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button.tsx";
import { cn } from "@/lib/utils.ts";
import { useChat } from "@/hooks/ChatContext.tsx";
import { toast } from "@fileuni/shared";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  externalValue?: string;
  onValueChange?: (value: string) => void;
}

const COMMON_EMOJIS = [
  "😊",
  "😂",
  "🤣",
  "😍",
  "😒",
  "😭",
  "😘",
  "😩",
  "😔",
  "👌",
  "👍",
  "🙌",
  "🔥",
  "✨",
  "🎉",
  "❤️",
  "🤔",
  "🙄",
  "🤨",
  "😐",
  "😑",
  "😶",
  "😏",
  "😬",
  "😮",
  "😴",
  "🤤",
  "😝",
  "😜",
  "😇",
  "🥳",
  "😎",
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  externalValue,
  onValueChange,
}) => {
  const { t } = useTranslation();
  const { transport, sendFile, activeTarget } = useChat();
  const [inputText, setInputText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsInitializing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isP2P = transport === "webrtc";

  useEffect(() => {
    if (externalValue !== undefined && externalValue !== null) {
      setInputText(externalValue);
      adjustHeight();
    }
  }, [externalValue]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || disabled) return;
    onSend(inputText.trim());
    setInputText("");
    onValueChange?.("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setShowEmoji(false);
  };

  const handleFileClick = () => {
    if (!isP2P) {
      toast.info(t("chat.p2pRequiredToast"));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleMicClick = () => {
    if (!isP2P) {
      toast.info(t("chat.p2pRequiredToast"));
      return;
    }
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTarget) return;

    if (file.size > 50 * 1024 * 1024) {
      // 50MB
      toast.info(
        t("chat.largeFileTip") ||
          "For large files (>50MB), it is recommended to use the sharing function of this system's file management for better performance.",
      );
    }

    try {
      await sendFile(activeTarget, file);
      toast.success(t("chat.fileSending") || "File transfer started...");
    } catch (err) {
      toast.error(t("chat.fileSendFailed") || "Failed to send file");
    }
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        if (activeTarget) await sendFile(activeTarget, file);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsInitializing(true);
    } catch (err) {
      toast.error(t("chat.micAccessFailed"));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsInitializing(false);
  };

  const handleEmojiClick = (emoji: string) => {
    const next = inputText + emoji;
    setInputText(next);
    onValueChange?.(next);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    onValueChange?.(newValue);
    adjustHeight();
  };

  const canSend = inputText.trim().length > 0 && !disabled;

  return (
    <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full relative">
      {showEmoji && (
        <div className="absolute bottom-full left-0 mb-3 w-[320px] bg-background border border-border rounded-2xl p-3 shadow-2xl flex flex-wrap gap-1 animate-in slide-in-from-bottom-2 duration-200 z-[10]">
          <div className="flex flex-wrap gap-1 max-h-[160px] overflow-y-auto custom-scrollbar">
            {COMMON_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => handleEmojiClick(e)}
                className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-lg text-lg transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-background border border-border rounded-2xl p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-0.5 pb-1 pl-1">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "w-9 h-9 rounded-xl",
              isP2P
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground/40 hover:text-muted-foreground/60",
            )}
            disabled={disabled}
            onClick={handleFileClick}
            title={isP2P ? t("chat.sendFile") : t("chat.p2pRequired")}
          >
            <Paperclip size={20} />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "w-9 h-9 rounded-xl",
              isRecording
                ? "text-destructive bg-destructive/10"
                : isP2P
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground/40 hover:text-muted-foreground/60",
            )}
            disabled={disabled}
            onClick={handleMicClick}
            title={isP2P ? t("chat.voiceMessage") : t("chat.p2pRequired")}
          >
            {isRecording ? (
              <StopCircle size={20} className="animate-pulse" />
            ) : (
              <Mic size={20} />
            )}
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled ? t("chat.offline") : t("chat.inputPlaceholder")
          }
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none py-3 px-1 text-sm min-h-[44px] max-h-[120px] resize-none custom-scrollbar placeholder:text-muted-foreground/50"
          rows={1}
        />

        <div className="flex items-center gap-1 pr-1 pb-1">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "w-9 h-9 rounded-xl",
              showEmoji
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setShowEmoji(!showEmoji)}
            disabled={disabled}
          >
            <Smile size={20} />
          </Button>

          <Button
            size="icon"
            className={cn(
              "w-10 h-10 rounded-xl shrink-0 transition-all",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md scale-105 active:scale-95"
                : "bg-muted text-muted-foreground",
            )}
            onClick={handleSend}
            disabled={!canSend}
          >
            <Send size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};
