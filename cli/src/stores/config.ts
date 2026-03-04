import { create } from "zustand";
import { client, extractData } from "@/lib/api";

export interface SystemCapabilities {
  enable_registration: boolean;
  enable_mobile_auth: boolean;
  enable_email_auth: boolean;
  enable_webdav: boolean;
  enable_sftp: boolean;
  enable_ftp: boolean;
  enable_s3: boolean;
  s3_port?: number | null;
  s3_use_https?: boolean | null;
  enable_api: boolean;
  enable_captcha: boolean;
  enable_quota: boolean;
  enable_chat: boolean;
  enable_email_manager: boolean;
  enable_embedded_websocket: boolean;
  enable_mqtt_proxy_broker: boolean;
  chat_default_key: string;
  chat_stun_servers: string[];
  chat_turn_servers: { url: string; username?: string; credential?: string }[];
  chat_max_message_size_bytes: number;
  chat_max_groups_per_user: number;
  chat_max_members_per_group: number;
  chat_max_groups_joined_per_user: number;
  enable_wopi: boolean;
  enable_microsoft_viewer: boolean;
  enable_google_viewer: boolean;
  enable_markdown_vditor: boolean;
  jsdelivr_mirror_base: string;
  latex_preview_mode: string;
  enable_latexmk: boolean;
  enable_latexjs: boolean;
  enable_monaco: boolean;
  preview_size_limits: {
    default_mb: number;
    text_mb: number;
    markdown_mb: number;
    pdf_mb: number;
    image_mb: number;
    tex_mb: number;
    office_mb: number;
  };
  preview: {
    text: boolean;
    markdown: boolean;
    pdf: boolean;
    image: boolean;
    video: boolean;
    audio: boolean;
    office: boolean;
    tex: boolean;
  };
  thumbnail: {
    enabled: boolean;
    cache_mode: string;
    image: boolean;
    video: boolean;
    pdf: boolean;
    office: boolean;
    text: boolean;
    tex: boolean;
    thumb_size_px: number;
    thumb_format: string;
  };
  compression_max_level?: number;
  default_compression_format?: string;
  decompression_formats?: string[];
  enable_archive_browser?: boolean;
  has_7z?: boolean;
  runtime_os?: string;
  runtime_arch?: string;
  runtime_bits?: number;
  is_config_set_mode?: boolean;
  config_set_reason?: string;
}

interface ConfigState {
  capabilities: SystemCapabilities | null;
  isLoading: boolean;
  fetchCapabilities: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  capabilities: null,
  isLoading: false,
  fetchCapabilities: async () => {
    set({ isLoading: true });
    try {
      const data = await extractData<SystemCapabilities>(client.GET("/api/v1/system/backend-capabilities-handshake"));
      if (data) {
        set({ capabilities: data });
      }
    } catch (err) {
      console.error("Error fetching capabilities:", err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
