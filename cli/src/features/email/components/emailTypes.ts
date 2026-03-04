export interface EmailAccount {
  id: string;
  email_address: string;
  display_name?: string;
  imap_host: string;
  imap_port: number;
  imap_security: "None" | "SslTls" | "StartTls";
  smtp_host: string;
  smtp_port: number;
  smtp_security: "None" | "SslTls" | "StartTls";
  is_active: boolean;
  sync_enabled: boolean;
  last_sync_at?: string;
  unread_count?: number;
}

export interface EmailFolder {
  id: string;
  name: string;
  display_name?: string;
  message_count: number;
  unread_count: number;
  is_system: boolean;
}

export type EmailSyncState = "smtp_accepted" | "syncing";

export interface EmailMessage {
  id: string;
  message_id?: string;
  subject: string;
  from_name: string;
  from_addr: string;
  date: string;
  size: number;
  is_read: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  preview_text?: string;
  is_local_pending?: boolean;
  sync_state?: EmailSyncState;
  smtp_message_id?: string;
}

export interface EmailAttachmentInfo {
  id: number;
  filename: string;
  size: number;
  content_type: string;
}

export interface EmailMessageDetail extends EmailMessage {
  to_addr: string | string[];
  cc_addr?: string;
  bcc_addr?: string;
  body_text?: string;
  body_html?: string;
  attachments?: EmailAttachmentInfo[];
}

export interface ComposeAttachment {
  id: string;
  name: string;
  size: number;
  file: File;
  uploadedPath?: string;
}

export interface UploadFileInfo {
  path?: string;
}

export interface EmailDraft {
  id: string;
  account_id?: string;
  to_addr?: string;
  cc_addr?: string;
  bcc_addr?: string;
  subject?: string;
  body_html?: string;
  context_type: string;
  context_ref_id?: string;
  updated_at: string;
}

export interface SendEmailResponse {
  message_id: string;
  message_ids: string[];
  chunked: boolean;
}

export interface EmailPageProps {
  initialView?: "inbox" | "compose" | "account";
  initialAccountId?: string;
  initialFolderName?: string;
}
