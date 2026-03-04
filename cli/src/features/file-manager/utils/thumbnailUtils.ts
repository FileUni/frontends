import { OFFICE_DOCX_EXTS, OFFICE_XLSX_EXTS, OFFICE_PPTX_EXTS } from './officeLite.ts';

export type ThumbnailCategory = 'image' | 'video' | 'pdf' | 'office' | 'text' | 'tex';

export const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'svg'
]);

export const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', 'mpg', 'mpeg'
]);

export const PDF_EXTS = new Set(['pdf']);

export const TEX_EXTS = new Set(['tex', 'latex']);

export const TEXT_EXTS = new Set([
  'txt', 'md', 'markdown', 'log', 'json', 'yaml', 'yml', 'toml', 'ini',
  'csv', 'tsv', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'rs', 'py',
  'go', 'java', 'c', 'cpp', 'h', 'hpp', 'sh'
]);

export function getThumbnailCategory(ext: string): ThumbnailCategory | null {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (PDF_EXTS.has(ext)) return 'pdf';
  if (TEX_EXTS.has(ext)) return 'tex';
  if (OFFICE_DOCX_EXTS.has(ext) || OFFICE_XLSX_EXTS.has(ext) || OFFICE_PPTX_EXTS.has(ext)) return 'office';
  if (TEXT_EXTS.has(ext)) return 'text';
  return null;
}
