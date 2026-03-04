export interface FileInfo {
  id?: string; // Unique identifier, share ID for shares
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  favorite_color: number;
  has_active_share?: boolean;
  has_active_direct?: boolean;
  trashed_at?: string;
  original_path?: string;
  accessed_at?: string; // Browser access timestamp

  // Share specific fields (optional)
  view_count?: number;
  max_downloads?: number;
  expire_at?: string;
  has_password?: boolean;
  enable_direct?: boolean;
  can_upload?: boolean;
  can_update_no_create?: boolean;
  can_delete?: boolean;
  created_at?: string; // For shares, this is the start of sharing
}

export type ViewMode = 'grid' | 'list';
export type FileManagerMode = 'files' | 'recent' | 'trash' | 'favorites' | 'shares';

export interface StorageStats {
  used: number;
  quota: number;
}

export interface ClipboardItem {
  path: string;
  name: string;
  is_dir: boolean;
  type: 'copy' | 'cut';
}
