export type ToolKind = 'service' | 'task' | 'both';

export type ToolInfo = {
  name: string;
  kind: ToolKind;
  executable_path: string;
  install_dir: string;
  bin_path: string;
  installed: boolean;
  homepage: string;
  description_zh: string;
  description_en: string;
};

export type ServiceStatus = {
  tool: string;
  kind: ToolKind;
  running: boolean;
  pid?: number | null;
  follow_start: boolean;
};

export type InstallBody = {
  version?: string;
  download_url?: string;
  download_link?: string;
  github_proxy?: string;
  archive_kind?: string;
  bin_path?: string;
  target_bin_dir?: string;
  os?: string;
  arch?: string;
};

export type CmdResult = {
  code: number;
  stdout: string;
  stderr: string;
};
