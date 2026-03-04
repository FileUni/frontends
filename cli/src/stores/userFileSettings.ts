import { create } from "zustand";
import { client } from "@/lib/api";

export interface UserFileSettings {
  pool_name?: string;
  storage_quota?: number;
  storage_used?: number;
  thumbnail_disable_text: boolean;
  thumbnail_disable_markdown: boolean;
  thumbnail_disable_pdf: boolean;
  thumbnail_disable_image: boolean;
  thumbnail_disable_video: boolean;
  thumbnail_disable_audio: boolean;
  thumbnail_disable_office: boolean;
  thumbnail_disable_tex: boolean;
}

export type UserFileSettingsUpdate = Partial<Pick<UserFileSettings,
  | "pool_name"
  | "storage_quota"
  | "thumbnail_disable_text"
  | "thumbnail_disable_markdown"
  | "thumbnail_disable_pdf"
  | "thumbnail_disable_image"
  | "thumbnail_disable_video"
  | "thumbnail_disable_audio"
  | "thumbnail_disable_office"
  | "thumbnail_disable_tex"
>>;

interface UserFileSettingsState {
  settings: UserFileSettings | null;
  isLoading: boolean;
  fetchSettings: (force?: boolean) => Promise<void>;
  updateSettings: (patch: UserFileSettingsUpdate) => Promise<void>;
}

export const useUserFileSettingsStore = create<UserFileSettingsState>((set, get) => ({
  settings: null,
  isLoading: false,
  fetchSettings: async (force = false) => {
    if (!force && get().settings) return;
    set({ isLoading: true });
    try {
      const { data, error } = await client.GET("/api/v1/file/user-settings");
      if (data?.success && data.data) {
        set({ settings: data.data as UserFileSettings });
      } else {
        console.error("Failed to fetch user file settings", error || data?.msg);
      }
    } catch (err) {
      console.error("Error fetching user file settings", err);
    } finally {
      set({ isLoading: false });
    }
  },
  updateSettings: async (patch) => {
    const previous = get().settings;
    set({ settings: previous ? { ...previous, ...patch } : (patch as UserFileSettings) });
    try {
      const { data, error } = await client.PUT("/api/v1/file/user-settings", { body: patch });
      if (!data?.success) {
        set({ settings: previous || null });
        console.error("Failed to update user file settings", error || data?.msg);
      }
    } catch (err) {
      set({ settings: previous || null });
      console.error("Error updating user file settings", err);
    }
  }
}));
