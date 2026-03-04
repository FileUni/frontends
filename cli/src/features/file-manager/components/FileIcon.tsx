import { Folder, FileText, Image, FileVideo, Music, FileArchive, FileCode, FileQuestion, FileSpreadsheet, FileType, Presentation } from 'lucide-react';

export const FileIcon = ({ name, isDir, size = 20 }: { name: string, isDir: boolean, size?: number }) => {
  if (isDir) return <Folder size={size} className="text-yellow-500 fill-yellow-500/20" />;
  
  const ext = name.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico'].includes(ext)) return <Image size={size} className="text-blue-500" />;
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'].includes(ext)) return <FileVideo size={size} className="text-red-500" />;
  if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'].includes(ext)) return <Music size={size} className="text-pink-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'].includes(ext)) return <FileArchive size={size} className="text-orange-500" />;
  if (['pdf'].includes(ext)) return <FileText size={size} className="text-rose-500" />;
  if (['md', 'markdown'].includes(ext)) return <FileText size={size} className="text-blue-400" />;
  if (['tex', 'latex'].includes(ext)) return <FileType size={size} className="text-blue-600" />;
  if (['doc', 'docx', 'dot', 'dotx', 'docm', 'dotm', 'odt', 'rtf'].includes(ext)) return <FileText size={size} className="text-blue-500" />;
  if (['xls', 'xlsx', 'xltx', 'xlsm', 'xltm', 'csv', 'tsv', 'ods'].includes(ext)) return <FileSpreadsheet size={size} className="text-emerald-500" />;
  if (['ppt', 'pptx', 'potx', 'pptm', 'pps', 'ppsx', 'odp'].includes(ext)) return <Presentation size={size} className="text-amber-500" />;
  if (['txt', 'log', 'ini', 'conf'].includes(ext)) return <FileText size={size} className="text-slate-500" />;
  if (['js', 'ts', 'tsx', 'rs', 'py', 'json', 'html', 'css', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'sh', 'toml', 'yaml', 'yml', 'xml', 'sql'].includes(ext)) return <FileCode size={size} className="text-green-500" />;
  
  return <FileQuestion size={size} className="text-zinc-500" />;
};
