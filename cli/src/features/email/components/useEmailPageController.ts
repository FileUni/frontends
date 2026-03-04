import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@fileuni/shared";
import { BASE_URL, client, extractData, type BaseResponse } from "@/lib/api.ts";
import { storageHub } from "@fileuni/shared";
import { useAuthStore } from "@/stores/auth.ts";
import { createClientUniqueId, resolveAttachmentFileName, stripHtml } from "./emailUtils.tsx";
import type { ComposeAttachment, EmailAccount, EmailDraft, EmailFolder, EmailMessage, EmailMessageDetail, SendEmailResponse, UploadFileInfo } from "./emailTypes.ts";

type DraftSavePayload = { id?: string };
type SyncStatusPayload = { is_syncing: boolean };

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'msg' in error) {
    const message = (error as { msg?: unknown }).msg;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return error instanceof Error ? error.message : fallback;
};

interface UseEmailPageController {
  t: (key: string, options?: Record<string, unknown>) => string;
  accounts: EmailAccount[];
  folders: EmailFolder[];
  messages: EmailMessage[];
  drafts: EmailDraft[];
  selectedAccount: string | null;
  selectedFolder: string | null;
  selectedMessage: EmailMessage | null;
  messageDetail: EmailMessageDetail | null;
  loadingDetail: boolean;
  searchQuery: string;
  activeView: "accounts" | "folders" | "messages" | "detail";
  showAccountModal: boolean;
  setShowAccountModal: (open: boolean) => void;
  showComposeModal: boolean;
  setShowComposeModal: (open: boolean) => void;
  setShowFullContentModal: (open: boolean) => void;
  showSendSuccessModal: boolean;
  setShowSendSuccessModal: (open: boolean) => void;
  lastSendFromAddress: string;
  showExportModal: boolean;
  setShowExportModal: (open: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (open: boolean) => void;
  isDraftsView: boolean;
  currentDraftId: string | null;
  setCurrentDraftId: (value: string | null) => void;
  activeRefId: string | null;
  setActiveRefId: (value: string | null) => void;
  safeMode: boolean;
  setSafeMode: (value: boolean) => void;
  syncingAccountId: string | null;
  formEmail: string;
  setFormEmail: (value: string) => void;
  formPassword: string;
  setFormPassword: (value: string) => void;
  formImapHost: string;
  setFormImapHost: (value: string) => void;
  formImapPort: number;
  setFormImapPort: (value: number) => void;
  formImapSecurity: "None" | "SslTls" | "StartTls";
  setFormImapSecurity: (value: "None" | "SslTls" | "StartTls") => void;
  formSmtpHost: string;
  setFormSmtpHost: (value: string) => void;
  formSmtpPort: number;
  setFormSmtpPort: (value: number) => void;
  formSmtpSecurity: "None" | "SslTls" | "StartTls";
  setFormSmtpSecurity: (value: "None" | "SslTls" | "StartTls") => void;
  formDisplayName: string;
  setFormDisplayName: (value: string) => void;
  editingAccount: EmailAccount | null;
  setEditingAccount: (value: EmailAccount | null) => void;
  composeFromAccount: string;
  setComposeFromAccount: (value: string) => void;
  composeTo: string;
  setComposeTo: (value: string) => void;
  composeCc: string;
  setComposeCc: (value: string) => void;
  composeBcc: string;
  setComposeBcc: (value: string) => void;
  composeSubject: string;
  setComposeSubject: (value: string) => void;
  composeBody: string;
  setComposeBody: (value: string) => void;
  composeAttachments: ComposeAttachment[];
  setComposeAttachments: Dispatch<SetStateAction<ComposeAttachment[]>>;
  sending: boolean;
  exportPassword: string;
  setExportPassword: (value: string) => void;
  importPassword: string;
  setImportPassword: (value: string) => void;
  importData: string;
  setImportData: (value: string) => void;
  importMode: "text" | "file";
  setImportMode: (value: "text" | "file") => void;
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
  isImporting: boolean;
  setIsImporting: (value: boolean) => void;
  contacts: { name: string; addr: string }[];
  filteredMessages: EmailMessage[];
  setSelectedAccount: (value: string | null) => void;
  setSelectedFolder: (value: string | null) => void;
  setSelectedMessage: (value: EmailMessage | null) => void;
  setMessageDetail: (value: EmailMessageDetail | null) => void;
  setActiveView: (value: "accounts" | "folders" | "messages" | "detail") => void;
  setIsDraftsView: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  fetchMessageDetail: (messageId: string) => Promise<void>;
  handleSendEmail: () => Promise<void>;
  handleSaveAttachmentToVfs: (messageId: string, attachmentId: number, filename: string) => Promise<void>;
  handleDownloadAttachment: (messageId: string, attachmentId: number, fallbackName: string) => Promise<void>;
  handleSyncAccount: (id: string) => Promise<void>;
  handleEditAccount: (account: EmailAccount) => void;
  handleDeleteAccount: (id: string) => Promise<void>;
  resumeDraft: (draft: EmailDraft) => void;
  handleReply: (msg: EmailMessageDetail, all?: boolean) => void;
  openLastSentMailbox: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
}

export const useEmailPageController = (): UseEmailPageController => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [messageDetail, setMessageDetail] = useState<EmailMessageDetail | null>(null);
  const [pendingSentByFolder, setPendingSentByFolder] = useState<Record<string, EmailMessage[]>>({});

  const [, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"accounts" | "folders" | "messages" | "detail">("accounts");

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [, setShowFullContentModal] = useState(false);
  const [showSendSuccessModal, setShowSendSuccessModal] = useState(false);
  const [lastSendFromAddress, setLastSendFromAddress] = useState("");
  const [lastSentAccountId, setLastSentAccountId] = useState<string | null>(null);
  const [lastSentFolderId, setLastSentFolderId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [isDraftsView, setIsDraftsView] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [activeRefId, setActiveRefId] = useState<string | null>(null);
  const [lastSavedBody, setLastSavedBody] = useState("");
  const [safeMode, setSafeMode] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formImapHost, setFormImapHost] = useState("");
  const [formImapPort, setFormImapPort] = useState(993);
  const [formImapSecurity, setFormImapSecurity] = useState<"None" | "SslTls" | "StartTls">("SslTls");
  const [formSmtpHost, setFormSmtpHost] = useState("");
  const [formSmtpPort, setFormSmtpPort] = useState(465);
  const [formSmtpSecurity, setFormSmtpSecurity] = useState<"None" | "SslTls" | "StartTls">("SslTls");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  const [composeFromAccount, setComposeFromAccount] = useState<string>("");
  const [composeTo, setComposeTo] = useState<string>("");
  const [composeCc, setComposeCc] = useState<string>("");
  const [composeBcc, setComposeBcc] = useState<string>("");
  const [composeSubject, setComposeSubject] = useState<string>("");
  const [composeBody, setComposeBody] = useState<string>("");
  const [composeAttachments, setComposeAttachments] = useState<ComposeAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importData, setImportData] = useState("");
  const [importMode, setImportMode] = useState<"text" | "file">("text");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  interface ContactRecord {
    addr: string;
    aliases: string[];
    usage_count: number;
    last_used_at: number;
  }

  interface ContactStorageV2 {
    version: 2;
    records: ContactRecord[];
  }

  interface ContactEntryInput {
    addr: string;
    name?: string;
    seen_at?: number;
    usage_delta?: number;
  }

  const [contactRecords, setContactRecords] = useState<ContactRecord[]>([]);
  const currentUserData = useAuthStore((state) => state.currentUserData);
  const currentUserId = currentUserData?.user.id || "guest";
  const CONTACTS_KEY = `fileuni_email_contacts_${currentUserId}`;
  const normalizeMessageId = (rawValue?: string): string => rawValue?.trim().replace(/^<|>$/g, "").toLowerCase() || "";
  const normalizeSubject = (rawValue?: string): string => rawValue?.trim().replace(/\s+/g, " ").toLowerCase() || "";
  const NO_SUBJECT_KEYS = new Set(["nosubject", "无主题"]);
  const CONTACTS_LIMIT = 500;
  const CONTACT_ALIASES_LIMIT = 6;
  const CONTACT_ALIAS_NAME_MAX = 12;
  const trimAliasName = (rawValue: string): string => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (normalized.length <= CONTACT_ALIAS_NAME_MAX) {
      return normalized;
    }
    return `${normalized.slice(0, CONTACT_ALIAS_NAME_MAX)}...`;
  };
  const parseAddressWithOptionalName = (rawValue: string): { addr: string; name: string } => {
    const normalized = rawValue.trim();
    if (!normalized) {
      return { addr: "", name: "" };
    }
    const bracketMatch = normalized.match(/^(.*)<([^>]+)>$/);
    if (bracketMatch && bracketMatch[2]) {
      return {
        addr: bracketMatch[2].trim().toLowerCase(),
        name: bracketMatch[1].trim(),
      };
    }
    return {
      addr: normalized.trim().toLowerCase(),
      name: "",
    };
  };
  const composeContactLabel = (addr: string, aliases: string[]): string => {
    if (aliases.length === 0) {
      return `<${addr}>`;
    }
    return `${aliases.join("|")}<${addr}>`;
  };
  const toContactScore = (record: ContactRecord): number => {
    const frequencyWeight = record.usage_count * 3 * 24 * 60 * 60 * 1000;
    return record.last_used_at + frequencyWeight;
  };
  const toDisplayContacts = (records: ContactRecord[]): { name: string; addr: string }[] => {
    return [...records]
      .sort((left, right) => {
        const scoreDiff = toContactScore(right) - toContactScore(left);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        const timeDiff = right.last_used_at - left.last_used_at;
        if (timeDiff !== 0) {
          return timeDiff;
        }
        return right.usage_count - left.usage_count;
      })
      .slice(0, CONTACTS_LIMIT)
      .map((record) => ({
        addr: record.addr,
        name: composeContactLabel(record.addr, record.aliases),
      }));
  };
  const loadContactRecords = async (): Promise<ContactRecord[]> => {
    const rawValue = await storageHub.getItem(CONTACTS_KEY);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as ContactStorageV2;
      if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 2 && Array.isArray(parsed.records)) {
        return parsed.records
          .map((item) => ({
            addr: (item.addr || "").trim().toLowerCase(),
            aliases: Array.isArray(item.aliases) ? item.aliases.map((alias) => trimAliasName(alias)).filter((alias) => alias.length > 0).slice(-CONTACT_ALIASES_LIMIT) : [],
            usage_count: Math.max(1, Number(item.usage_count || 0)),
            last_used_at: Math.max(0, Number(item.last_used_at || 0)),
          }))
          .filter((item) => item.addr.length > 0);
      }
    } catch { }

    return [];
  };
  const persistContactRecords = async (records: ContactRecord[]): Promise<void> => {
    const payload: ContactStorageV2 = { version: 2, records: records.slice(0, CONTACTS_LIMIT) };
    await storageHub.setItem(CONTACTS_KEY, JSON.stringify(payload));
  };
  const mergeContactRecords = (previousRecords: ContactRecord[], incomingEntries: ContactEntryInput[]): ContactRecord[] => {
    if (incomingEntries.length === 0) {
      return previousRecords;
    }

    const nowTs = Date.now();
    const recordMap = new Map<string, ContactRecord>();
    previousRecords.forEach((item) => {
      const addr = item.addr.trim().toLowerCase();
      if (!addr) {
        return;
      }
      recordMap.set(addr, {
        addr,
        aliases: [...item.aliases].slice(-CONTACT_ALIASES_LIMIT),
        usage_count: Math.max(1, item.usage_count || 0),
        last_used_at: Math.max(0, item.last_used_at || 0),
      });
    });

    incomingEntries.forEach((entry) => {
      const addr = (entry.addr || "").trim().toLowerCase();
      if (!addr) {
        return;
      }
      const existing = recordMap.get(addr) || { addr, aliases: [], usage_count: 0, last_used_at: 0 };
      const incomingName = (entry.name || "").trim();
      if (incomingName) {
        const normalizedAlias = trimAliasName(incomingName);
        const aliases = existing.aliases.filter((item) => item !== normalizedAlias);
        aliases.push(normalizedAlias);
        existing.aliases = aliases.slice(-CONTACT_ALIASES_LIMIT);
      }
      existing.usage_count = Math.max(1, existing.usage_count + Math.max(0, entry.usage_delta || 0));
      const candidateTs = entry.seen_at && Number.isFinite(entry.seen_at) ? entry.seen_at : nowTs;
      existing.last_used_at = Math.max(existing.last_used_at, candidateTs);
      recordMap.set(addr, existing);
    });

    return [...recordMap.values()]
      .sort((left, right) => {
        const scoreDiff = toContactScore(right) - toContactScore(left);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return right.last_used_at - left.last_used_at;
      })
      .slice(0, CONTACTS_LIMIT);
  };
  const applyContactEntries = (incomingEntries: ContactEntryInput[]) => {
    if (incomingEntries.length === 0) {
      return;
    }
    setContactRecords((previous) => {
      const merged = mergeContactRecords(previous, incomingEntries);
      void persistContactRecords(merged);
      return merged;
    });
  };
  const extractMessageContactEntry = (fromName: string, fromAddr: string): { addr: string; name: string } | null => {
    const parsedAddr = parseAddressWithOptionalName(fromAddr);
    const parsedName = parseAddressWithOptionalName(fromName);
    const addr = parsedAddr.addr || parsedName.addr;
    if (!addr) {
      return null;
    }
    const candidateName = parsedName.name || parsedAddr.name;
    return { addr, name: candidateName };
  };
  const extractRecipientsFromComposeField = (rawValue: string): Array<{ addr: string; name: string }> => {
    if (!rawValue.trim()) {
      return [];
    }
    return rawValue
      .split(/[,\n;]+/)
      .map((token) => parseAddressWithOptionalName(token))
      .filter((entry) => entry.addr.length > 0);
  };
  const contacts = useMemo(() => toDisplayContacts(contactRecords), [contactRecords]);
  const buildSubjectKey = (rawValue?: string): string => {
    const normalized = normalizeSubject(rawValue);
    if (!normalized) {
      return "";
    }
    const key = normalized
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[^\p{L}\p{N}\p{Script=Han}]+/gu, "");
    if (!key || NO_SUBJECT_KEYS.has(key)) {
      return "";
    }
    return key;
  };
  const extractMailboxAddress = (rawValue?: string): string => {
    if (!rawValue) {
      return "";
    }
    const trimmedValue = rawValue.trim().toLowerCase();
    const bracketMatch = trimmedValue.match(/<([^>]+)>/);
    if (bracketMatch && bracketMatch[1]) {
      return bracketMatch[1].trim();
    }
    return trimmedValue;
  };
  const toTimestamp = (rawValue: string): number | null => {
    const timestamp = new Date(rawValue).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  };
  const isPendingMatchedByRemote = (localMessage: EmailMessage, remoteMessage: EmailMessage): boolean => {
    const localSmtpMessageId = normalizeMessageId(localMessage.smtp_message_id);
    const remoteMessageId = normalizeMessageId(remoteMessage.message_id);
    if (localSmtpMessageId && remoteMessageId && localSmtpMessageId === remoteMessageId) {
      return true;
    }

    const remoteSubjectKey = buildSubjectKey(remoteMessage.subject);
    const localSubjectKey = buildSubjectKey(localMessage.subject);
    const hasSubjectMatch = !!remoteSubjectKey && !!localSubjectKey && remoteSubjectKey === localSubjectKey;
    const localPreviewKey = buildSubjectKey(localMessage.preview_text);
    const remotePreviewKey = buildSubjectKey(remoteMessage.preview_text);
    const hasPreviewMatch = !!localPreviewKey && !!remotePreviewKey && localPreviewKey === remotePreviewKey;

    const remoteFrom = extractMailboxAddress(remoteMessage.from_addr);
    const localFrom = extractMailboxAddress(localMessage.from_addr);
    const localDate = toTimestamp(localMessage.date);
    const remoteDate = toTimestamp(remoteMessage.date);
    if (localDate === null || remoteDate === null) {
      return hasSubjectMatch || hasPreviewMatch;
    }
    const dateDiffMs = Math.abs(remoteDate - localDate);

    // Why: sent-folder backfill may rewrite sender display format; local pending should match on subject+time first
    if (localMessage.is_local_pending) {
      const pendingAliveMs = Date.now() - localDate;
      // Why: 先保证乐观占位可见，再启动启发式去重，避免被旧邮件瞬间误消
      if (pendingAliveMs >= 0 && pendingAliveMs < 12_000) {
        return false;
      }

      const newerEnough = remoteDate >= localDate - 2 * 60 * 1000;
      if (!newerEnough) {
        return false;
      }

      if (hasSubjectMatch) {
        return dateDiffMs <= 2 * 60 * 60 * 1000;
      }

      if (hasPreviewMatch) {
        if (remoteFrom && localFrom && remoteFrom !== localFrom) {
          return false;
        }
        return dateDiffMs <= 2 * 60 * 60 * 1000;
      }

      // Why: empty subject/preview fallback must be very strict to avoid matching old sent mails
      if (!remoteFrom || !localFrom || remoteFrom !== localFrom) {
        return false;
      }
      if (localMessage.has_attachments !== remoteMessage.has_attachments) {
        return false;
      }
      return dateDiffMs <= 24 * 60 * 60 * 1000;
    }

    if (!hasSubjectMatch && !hasPreviewMatch) {
      return false;
    }
    if (dateDiffMs <= 30 * 60 * 1000) {
      return true;
    }
    if (dateDiffMs <= 24 * 60 * 60 * 1000) {
      return !!(remoteFrom && localFrom && remoteFrom === localFrom);
    }
    return false;
  };
  const filterUnmatchedPending = (pendingList: EmailMessage[], remoteMessages: EmailMessage[]): EmailMessage[] => {
    if (pendingList.length === 0 || remoteMessages.length === 0) {
      return pendingList;
    }
    const remotePool = [...remoteMessages];
    const unmatched: EmailMessage[] = [];

    for (const localMessage of pendingList) {
      const matchedIndex = remotePool.findIndex((remoteMessage) => isPendingMatchedByRemote(localMessage, remoteMessage));
      if (matchedIndex >= 0) {
        remotePool.splice(matchedIndex, 1);
        continue;
      }
      unmatched.push(localMessage);
    }

    return unmatched;
  };

  const uploadAttachmentToTempVfs = async (attachment: ComposeAttachment): Promise<string> => {
    if (attachment.uploadedPath) {
      return attachment.uploadedPath;
    }

    const safeFilename = attachment.name.replace(/[\\/]/g, "_");
    const targetPath = `/.virtual/tmp/email_attachments/${createClientUniqueId()}_${safeFilename}`;
    const uploadUrl = `${BASE_URL}/api/v1/file/upload-raw?path=${encodeURIComponent(targetPath)}`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: currentUserData?.access_token ? { Authorization: `Bearer ${currentUserData.access_token}` } : undefined,
      body: attachment.file,
    });

    const payload = await response.json().catch(() => null) as BaseResponse<UploadFileInfo> | null;
    const uploadedPath = payload?.data?.path;
    if (!response.ok || !payload?.success || !uploadedPath) {
      throw new Error(payload?.msg || "Attachment upload failed");
    }

    setComposeAttachments((prev) =>
      prev.map((item) => (item.id === attachment.id ? { ...item, uploadedPath } : item)),
    );

    return uploadedPath;
  };

  const fetchAccounts = async () => {
    try {
      const data = await extractData<EmailAccount[]>(client.GET("/api/v1/email/accounts"));
      setAccounts(data || []);
    } catch { }
  };

  const fetchDrafts = async () => {
    try {
      const data = await extractData<EmailDraft[]>(client.GET("/api/v1/email/drafts"));
      setDrafts(data || []);
    } catch { }
  };

  const fetchFolders = async (accountId: string): Promise<EmailFolder[]> => {
    try {
      const data = await extractData<EmailFolder[]>(client.GET("/api/v1/email/accounts/{account_id}/folders", {
        params: { path: { account_id: accountId } }
      }));
      setFolders(data || []);
      return data || [];
    } catch { }
    return [];
  };

  const fetchMessages = async (folderId: string, retryCount: number = 0) => {
    setLoading(true);
    try {
      const data = await extractData<EmailMessage[]>(client.GET("/api/v1/email/folders/{folder_id}/messages", {
        params: { path: { folder_id: folderId }, query: { page: 1, per_page: 50 } }
      }));
      setMessages(data || []);
      setPendingSentByFolder((prev) => {
        const pending = prev[folderId] || [];
        if (pending.length === 0) return prev;
        const remaining = filterUnmatchedPending(pending, data || []);

        return { ...prev, [folderId]: remaining };
      });
      if (data && data.length > 0) {
        const incomingEntries = data
          .flatMap((message) => {
            const extracted = extractMessageContactEntry(message.from_name || "", message.from_addr || "");
            if (!extracted) {
              return [];
            }
            return [{
              addr: extracted.addr,
              name: extracted.name,
              seen_at: toTimestamp(message.date || "") || Date.now(),
              usage_delta: 0,
            } satisfies ContactEntryInput];
          });
        applyContactEntries(incomingEntries);
      }
    } catch {
      if (retryCount < 1) {
        window.setTimeout(() => {
          void fetchMessages(folderId, retryCount + 1);
        }, 1200);
      }
    }
    finally { setLoading(false); }
  };

  const fetchMessageDetail = async (messageId: string) => {
    if (messageId.startsWith("local-sent-")) {
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await extractData<EmailMessageDetail>(client.GET("/api/v1/email/messages/{id}", {
        params: { path: { id: messageId } }
      }));
      setMessageDetail(data);

      const targetMsg = messages.find(m => m.id === messageId);
      if (targetMsg && !targetMsg.is_read) {
        try {
          await extractData(client.PUT("/api/v1/email/messages/{id}/read", {
            params: { path: { id: messageId } },
            body: { is_read: true }
          }));
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: true } : m));
          setFolders(prev => prev.map(f => f.id === selectedFolder ? { ...f, unread_count: Math.max(0, f.unread_count - 1) } : f));
          fetchAccounts();
          window.dispatchEvent(new CustomEvent("fileuni:email-refresh"));
        } catch { }
      }
    } catch { toast.error(t("email.loadDetailFailed")); }
    finally { setLoadingDetail(false); }
  };

  const handleSaveDraft = async () => {
    if (!composeBody || composeBody === lastSavedBody || !showComposeModal) return;
    if (!currentUserData?.access_token) return;
    try {
      const saved = await extractData<DraftSavePayload>(client.POST("/api/v1/email/drafts", {
        body: {
          id: currentDraftId || undefined,
          account_id: composeFromAccount || undefined,
          to_addr: composeTo || undefined,
          cc_addr: composeCc || undefined,
          bcc_addr: composeBcc || undefined,
          subject: composeSubject || undefined,
          body_html: composeBody,
          context_type: activeRefId ? "reply" : "new",
          context_ref_id: activeRefId || undefined
        }
      }));
      if (saved.id) {
        setCurrentDraftId(saved.id);
        setLastSavedBody(composeBody);
        fetchDrafts();
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 401) return;
    }
  };

  useEffect(() => {
    if (!showComposeModal || !composeBody) return undefined;
    const timer = setTimeout(() => handleSaveDraft(), 3000);
    return () => clearTimeout(timer);
  }, [composeBody, composeTo, composeSubject, showComposeModal]);

  const resumeDraft = (d: EmailDraft) => {
    setCurrentDraftId(d.id);
    setActiveRefId(d.context_ref_id || null);
    setComposeFromAccount(d.account_id || "");
    setComposeTo(d.to_addr || "");
    setComposeCc(d.cc_addr || "");
    setComposeBcc(d.bcc_addr || "");
    setComposeSubject(d.subject || "");
    setComposeBody(d.body_html || "");
    setLastSavedBody(d.body_html || "");
    setShowComposeModal(true);
  };

  const handleReply = (msg: EmailMessageDetail, all: boolean = false) => {
    const existing = drafts.find(d => d.context_ref_id === msg.id);
    if (existing) { resumeDraft(existing); return; }

    setActiveRefId(msg.id);
    setComposeFromAccount(selectedAccount || "");
    setComposeTo(msg.from_addr);
    setComposeCc(all && msg.cc_addr ? msg.cc_addr : "");
    setComposeBcc("");
    setComposeSubject(msg.subject.startsWith("Re: ") ? msg.subject : `Re: ${msg.subject}`);
    const quoteHeader = `<br/><br/><blockquote>On ${msg.date}, ${msg.from_name || msg.from_addr} wrote:<br/>`;
    const quoteContent = msg.body_html || `<pre>${msg.body_text}</pre>`;
    setComposeBody(`${quoteHeader}${quoteContent}</blockquote>`);
    setCurrentDraftId(null);
    setShowComposeModal(true);
  };

  useEffect(() => {
    let cancelled = false;
    setContactRecords([]);
    const loadRecords = async () => {
      const loaded = await loadContactRecords();
      if (cancelled) {
        return;
      }
      setContactRecords(loaded);
      await persistContactRecords(loaded);
    };
    void loadRecords();
    fetchAccounts(); fetchDrafts();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (selectedAccount) {
      setFolders([]); setMessages([]); setSelectedFolder(null); setSelectedMessage(null); setMessageDetail(null);
      fetchFolders(selectedAccount); setIsDraftsView(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (selectedFolder) {
      setMessages([]); setSelectedMessage(null); setMessageDetail(null);
      fetchMessages(selectedFolder);
    }
  }, [selectedFolder]);

  useEffect(() => {
    if (isDraftsView) {
      setMessages([]); setSelectedMessage(null); setMessageDetail(null);
      fetchDrafts();
    }
  }, [isDraftsView]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      if (selectedFolder && !isDraftsView) {
        void fetchMessages(selectedFolder);
      }
    };
    window.addEventListener("fileuni:email-refresh", handleRefreshEvent as EventListener);
    return () => {
      window.removeEventListener("fileuni:email-refresh", handleRefreshEvent as EventListener);
    };
  }, [isDraftsView, selectedFolder]);

  useEffect(() => {
    if (!selectedFolder || isDraftsView) {
      return undefined;
    }
    if (activeView !== "messages" && activeView !== "detail") {
      return undefined;
    }

    const targetFolder = folders.find((folder) => folder.id === selectedFolder);
    const folderName = (targetFolder?.display_name || targetFolder?.name || "").toLowerCase();
    const isHotFolder = folderName.includes("inbox")
      || folderName.includes("sent")
      || folderName.includes("outbox")
      || folderName.includes("收件箱")
      || folderName.includes("已发送");

    let timer: number | null = null;
    let stopped = false;

    const getDelayMs = () => {
      if (document.visibilityState === "hidden") {
        return 60000;
      }
      return isHotFolder ? 12000 : 20000;
    };

    const scheduleNext = () => {
      if (stopped) {
        return;
      }
      timer = window.setTimeout(() => {
        void tick();
      }, getDelayMs());
    };

    const tick = async () => {
      if (stopped) {
        return;
      }
      await fetchMessages(selectedFolder);
      scheduleNext();
    };

    timer = window.setTimeout(() => {
      void tick();
    }, 4000);

    const handleWakeUp = () => {
      if (!stopped) {
        void fetchMessages(selectedFolder);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleWakeUp();
      }
    };

    window.addEventListener("focus", handleWakeUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener("focus", handleWakeUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeView, folders, isDraftsView, selectedFolder]);

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const attachment_vfs_paths: string[] = [];
      for (const attachment of composeAttachments) {
        const uploadedPath = await uploadAttachmentToTempVfs(attachment);
        attachment_vfs_paths.push(uploadedPath);
      }

      const sendResult = await extractData<SendEmailResponse>(client.POST("/api/v1/email/messages/send", {
        body: {
          from_account_id: composeFromAccount,
          to: composeTo.split(",").map(s => s.trim()).filter(Boolean),
          cc: composeCc ? composeCc.split(",").map(s => s.trim()).filter(Boolean) : undefined,
          bcc: composeBcc ? composeBcc.split(",").map(s => s.trim()).filter(Boolean) : undefined,
          subject: composeSubject, body_text: stripHtml(composeBody), body_html: composeBody,
          attachment_vfs_paths: attachment_vfs_paths.length > 0 ? attachment_vfs_paths : undefined
        }
      }));
      if (currentDraftId) await client.DELETE("/api/v1/email/drafts/{id}", { params: { path: { id: currentDraftId } } });
      toast.success(t("email.sentSuccess")); setShowComposeModal(false);
      setComposeAttachments([]); setComposeBody(""); fetchDrafts();

      if (composeFromAccount) {
        const recipientEntries = [
          ...extractRecipientsFromComposeField(composeTo),
          ...extractRecipientsFromComposeField(composeCc),
          ...extractRecipientsFromComposeField(composeBcc),
        ].map((entry) => ({
          addr: entry.addr,
          name: entry.name,
          usage_delta: 1,
          seen_at: Date.now(),
        }));
        applyContactEntries(recipientEntries);
        const senderAccount = accounts.find((item) => item.id === composeFromAccount);
        setLastSendFromAddress(senderAccount?.email_address || composeFromAccount);
        setLastSentAccountId(composeFromAccount);
        const loadedFolders = await fetchFolders(composeFromAccount);
        const sentFolder = loadedFolders.find((folder) => {
          const folderName = (folder.display_name || folder.name).toLowerCase();
          return folderName.includes("sent") || folderName.includes("outbox");
        });
        setLastSentFolderId(sentFolder?.id || null);

        setSelectedAccount(composeFromAccount);
        if (sentFolder) {
          const preview = stripHtml(composeBody).slice(0, 200);
          const localDate = new Date().toISOString();
          const baseMessage: Omit<EmailMessage, "id" | "subject"> = {
            from_name: senderAccount?.display_name || senderAccount?.email_address || "Me",
            from_addr: senderAccount?.email_address || "me@example.com",
            date: localDate,
            size: Math.max(1, preview.length),
            is_read: true,
            is_flagged: false,
            has_attachments: composeAttachments.length > 0,
            preview_text: preview || undefined,
            is_local_pending: true,
            sync_state: "smtp_accepted",
          };

          const optimisticMessages: EmailMessage[] = sendResult.chunked && sendResult.message_ids.length > 1
            ? sendResult.message_ids.map((smtpMessageId, index) => ({
                ...baseMessage,
                id: `local-sent-${createClientUniqueId()}`,
                subject: `${composeSubject} [part ${index + 1}/${sendResult.message_ids.length}]`,
                smtp_message_id: smtpMessageId,
              }))
            : [{ ...baseMessage, id: `local-sent-${createClientUniqueId()}`, subject: composeSubject, smtp_message_id: sendResult.message_id }];

          setPendingSentByFolder((prev) => ({ ...prev, [sentFolder.id]: [...optimisticMessages, ...(prev[sentFolder.id] || [])] }));
          setSelectedFolder(sentFolder.id);
          setIsDraftsView(false);
          setActiveView("messages");
          void fetchMessages(sentFolder.id);
          window.setTimeout(() => {
            void fetchMessages(sentFolder.id);
          }, 3500);
          window.setTimeout(() => {
            void fetchMessages(sentFolder.id);
          }, 12000);
        }
      }
      setShowSendSuccessModal(true);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t("email.sentFailed");
      toast.error(errMsg);
    }
    finally { setSending(false); }
  };

  const handleDownloadAttachment = async (messageId: string, attachmentId: number, fallbackName: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/email/messages/${encodeURIComponent(messageId)}/attachments/${attachmentId}`, {
        method: "GET",
        headers: currentUserData?.access_token ? { Authorization: `Bearer ${currentUserData.access_token}` } : undefined,
      });

      if (!response.ok) throw new Error("Attachment download failed");

      const blob = await response.blob();
      const filename = resolveAttachmentFileName(response.headers.get("content-disposition"), fallbackName);
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      toast.error(t("email.downloadAttachmentFailed"));
    }
  };

  const handleSaveAttachmentToVfs = async (messageId: string, attachmentId: number, filename: string) => {
    const inputPath = window.prompt(t("email.enterSavePath"), `/attachments/${filename}`);
    if (!inputPath) return;

    const targetPath = inputPath.startsWith("/") ? inputPath : `/${inputPath}`;

    try {
      await extractData(client.POST("/api/v1/email/messages/{id}/attachments/{index}/save", {
        params: { path: { id: messageId, index: attachmentId } },
        body: { target_path: targetPath },
      }));
      toast.success(t("email.savedToVfs"));
    } catch {
      toast.error(t("email.saveToVfsFailed"));
    }
  };

  const handleSyncAccount = async (id: string) => {
    if (syncingAccountId) return;
    try {
      await extractData(client.POST("/api/v1/email/accounts/{id}/sync", { params: { path: { id } } }));
      setSyncingAccountId(id); toast.info(t("email.syncStarted"));
      const poll = setInterval(async () => {
        try {
          const res = await extractData<SyncStatusPayload>(client.GET("/api/v1/email/accounts/{id}/sync-status", { params: { path: { id } } }));
          if (!res.is_syncing) {
            clearInterval(poll);
            setSyncingAccountId(null);
            fetchAccounts();
            if (selectedFolder && selectedAccount === id) {
              void fetchMessages(selectedFolder);
            }
          }
        } catch { clearInterval(poll); setSyncingAccountId(null); }
      }, 3000);
    } catch (err: unknown) { toast.error(getErrorMessage(err, t("email.syncFailed"))); }
  };

  const handleEditAccount = (account: EmailAccount) => {
    setEditingAccount(account); setFormEmail(account.email_address);
    setFormImapHost(account.imap_host); setFormImapPort(account.imap_port);
    setFormImapSecurity(account.imap_security); setFormSmtpHost(account.smtp_host);
    setFormSmtpPort(account.smtp_port); setFormSmtpSecurity(account.smtp_security);
    setFormDisplayName(account.display_name || ""); setFormPassword("");
    setShowAccountModal(true);
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm(t("email.confirmDeleteAccount"))) return;
    try {
      await extractData(client.DELETE("/api/v1/email/accounts/{id}", { params: { path: { id: id } } }));
      toast.success(t("email.accountDeleted")); fetchAccounts();
    } catch { toast.error(t("email.deleteFailed")); }
  };

  const openLastSentMailbox = async () => {
    if (!lastSentAccountId) {
      setShowSendSuccessModal(false);
      return;
    }

    setSelectedAccount(lastSentAccountId);
    setIsDraftsView(false);
    setActiveView("messages");

    if (lastSentFolderId) {
      setSelectedFolder(lastSentFolderId);
      setShowSendSuccessModal(false);
      return;
    }

    const loadedFolders = await fetchFolders(lastSentAccountId);
    const sentFolder = loadedFolders.find((folder) => {
      const folderName = (folder.display_name || folder.name).toLowerCase();
      return folderName.includes("sent") || folderName.includes("outbox");
    });
    if (sentFolder) {
      setSelectedFolder(sentFolder.id);
      setLastSentFolderId(sentFolder.id);
    }
    setShowSendSuccessModal(false);
  };

  const mergedMessages = useMemo(() => {
    if (!selectedFolder) return messages;
    const localPending = pendingSentByFolder[selectedFolder] || [];
    const dedupedPending = filterUnmatchedPending(localPending, messages);
    return [...dedupedPending, ...messages];
  }, [messages, pendingSentByFolder, selectedFolder]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return mergedMessages;
    const q = searchQuery.toLowerCase();
    return mergedMessages.filter(m => m.subject.toLowerCase().includes(q) || m.from_addr.toLowerCase().includes(q));
  }, [mergedMessages, searchQuery]);

  return {
    t,
    accounts,
    folders,
    messages,
    drafts,
    selectedAccount,
    selectedFolder,
    selectedMessage,
    messageDetail,
    loadingDetail,
    searchQuery,
    activeView,
    showAccountModal,
    setShowAccountModal,
    showComposeModal,
    setShowComposeModal,
    setShowFullContentModal,
    showSendSuccessModal,
    setShowSendSuccessModal,
    lastSendFromAddress,
    showExportModal,
    setShowExportModal,
    showImportModal,
    setShowImportModal,
    isDraftsView,
    currentDraftId,
    setCurrentDraftId,
    activeRefId,
    setActiveRefId,
    safeMode,
    setSafeMode,
    syncingAccountId,
    formEmail,
    setFormEmail,
    formPassword,
    setFormPassword,
    formImapHost,
    setFormImapHost,
    formImapPort,
    setFormImapPort,
    formImapSecurity,
    setFormImapSecurity,
    formSmtpHost,
    setFormSmtpHost,
    formSmtpPort,
    setFormSmtpPort,
    formSmtpSecurity,
    setFormSmtpSecurity,
    formDisplayName,
    setFormDisplayName,
    editingAccount,
    setEditingAccount,
    composeFromAccount,
    setComposeFromAccount,
    composeTo,
    setComposeTo,
    composeCc,
    setComposeCc,
    composeBcc,
    setComposeBcc,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeAttachments,
    setComposeAttachments,
    sending,
    exportPassword,
    setExportPassword,
    importPassword,
    setImportPassword,
    importData,
    setImportData,
    importMode,
    setImportMode,
    isExporting,
    setIsExporting,
    isImporting,
    setIsImporting,
    contacts,
    filteredMessages,
    setSelectedAccount,
    setSelectedFolder,
    setSelectedMessage,
    setMessageDetail,
    setActiveView,
    setIsDraftsView,
    setSearchQuery,
    fetchMessageDetail,
    handleSendEmail,
    handleSaveAttachmentToVfs,
    handleDownloadAttachment,
    handleSyncAccount,
    handleEditAccount,
    handleDeleteAccount,
    resumeDraft,
    handleReply,
    openLastSentMailbox,
    fetchAccounts,
  };
};
