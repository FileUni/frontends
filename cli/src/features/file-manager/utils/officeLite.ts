import { BASE_URL, client, extractData } from '@/lib/api.ts';

export const OFFICE_COMPLEX_SIZE_HINT = 2 * 1024 * 1024;

export const OFFICE_DOCX_EXTS = new Set([
  'docx',
  'dotx',
  'docm',
  'dotm'
]);

export const OFFICE_XLSX_EXTS = new Set([
  'xlsx',
  'xltx',
  'xlsm',
  'xltm',
  'csv',
  'tsv'
]);

export const OFFICE_PPTX_EXTS = new Set([
  'pptx',
  'potx',
  'pptm',
  'ppsx'
]);

export const OFFICE_MACRO_EXTS = new Set([
  'docm',
  'dotm',
  'xlsm',
  'xltm',
  'pptm'
]);

export function isOfficeExtension(ext: string): boolean {
  return OFFICE_DOCX_EXTS.has(ext) || OFFICE_XLSX_EXTS.has(ext) || OFFICE_PPTX_EXTS.has(ext);
}

export function isComplexOfficeFile(ext: string, size: number): boolean {
  if (OFFICE_MACRO_EXTS.has(ext)) return true;
  return size >= OFFICE_COMPLEX_SIZE_HINT;
}

export function getFileExtension(name: string): string {
  const parts = name.split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1]?.toLowerCase() || '';
}

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export function resolveLimitBytes(limitMb?: number, fallbackMb = 10): number {
  const safeMb = limitMb && limitMb > 0 ? limitMb : fallbackMb;
  return safeMb * 1024 * 1024;
}

export function normalizeCdnBase(base: string): string {
  return base.replace(/\/+$/, '');
}

export function buildJsdelivrNpmUrl(base: string, pkg: string): string {
  return `${normalizeCdnBase(base)}/npm/${pkg}`;
}

export function buildJsdelivrGhUrl(base: string, repo: string, ref: string): string {
  return `${normalizeCdnBase(base)}/gh/${repo}@${ref}`;
}

export function resolvePublicBaseUrl(): string {
  if (BASE_URL && ABSOLUTE_URL_PATTERN.test(BASE_URL)) {
    return BASE_URL;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return BASE_URL;
}

export async function fetchFileStatSize(path: string): Promise<number> {
  const { data } = await client.GET('/api/v1/file/stat', { params: { query: { path } } });
  if (data?.data?.size) return data.data.size as number;
  return 0;
}

export async function fetchFileArrayBuffer(path: string): Promise<ArrayBuffer> {
  const data = await extractData<{ token: string }>(
    client.GET('/api/v1/file/get-file-download-token', { params: { query: { path } } })
  );
  const url = `${BASE_URL}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.token)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

export async function fetchFileDownloadUrl(path: string, inline = true): Promise<string> {
  const data = await extractData<{ token: string }>(
    client.GET('/api/v1/file/get-file-download-token', { params: { query: { path } } })
  );
  const base = resolvePublicBaseUrl();
  const inlineParam = inline ? '&inline=true' : '';
  return `${base}/api/v1/file/get-content?file_download_token=${encodeURIComponent(data.token)}${inlineParam}`;
}

export async function uploadBase64File(path: string, base64: string): Promise<void> {
  const { data, error } = await client.PUT('/api/v1/file/content', {
    body: { path, content: base64, is_base64: true }
  });
  if (error) {
    const errObj = error as Record<string, unknown>;
    throw new Error((errObj.msg as string) || 'Upload failed');
  }
  if (!data?.success) {
    throw new Error(data?.msg || 'Upload failed');
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Invalid base64 result'));
        return;
      }
      const parts = result.split(',');
      resolve(parts[1] || '');
    };
    reader.onerror = () => reject(new Error('Base64 conversion failed'));
    reader.readAsDataURL(blob);
  });
}
