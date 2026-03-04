import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { useFileStore } from '../store/useFileStore.ts';

interface SortMenuProps {
  className?: string;
}

interface SortOption {
  field: string;
  label: string;
}

export const SortMenu = ({ className }: SortMenuProps) => {
  const { t } = useTranslation();
  const store = useFileStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sortConfig = store.getSortConfig();
  const fmMode = store.fmMode;

  const getSortOptions = (): SortOption[] => {
    if (fmMode === 'trash') {
      return [
        { field: 'trashed_at', label: t('filemanager.sort.deletedAt') || '删除时间' },
        { field: 'name', label: t('filemanager.sort.name') || '文件名' },
        { field: 'path', label: t('filemanager.sort.path') || '路径' },
        { field: 'original_path', label: t('filemanager.sort.originalPath') || '原始路径' },
        { field: 'size', label: t('filemanager.sort.size') || '大小' },
        { field: 'modified', label: t('filemanager.sort.modified') || '修改时间' },
      ];
    } else if (fmMode === 'shares') {
      return [
        { field: 'created_at', label: t('filemanager.sort.shareTime') || '分享时间' },
        { field: 'expire_at', label: t('filemanager.sort.expireTime') || '过期时间' },
        { field: 'view_count', label: t('filemanager.sort.viewCount') || '访问次数' },
        { field: 'name', label: t('filemanager.sort.name') || '文件名' },
        { field: 'path', label: t('filemanager.sort.path') || '路径' },
        { field: 'size', label: t('filemanager.sort.file_size') || '文件大小' },
      ];
    } else if (fmMode === 'recent') {
      return [
        { field: 'modified', label: t('filemanager.sort.accessedAt') || '访问时间' },
        { field: 'name', label: t('filemanager.sort.name') || '文件名' },
        { field: 'path', label: t('filemanager.sort.path') || '路径' },
        { field: 'size', label: t('filemanager.sort.size') || '大小' },
      ];
    } else {
      const options = [
        { field: 'name', label: t('filemanager.sort.name') || '文件名' },
        { field: 'size', label: t('filemanager.sort.size') || '大小' },
        { field: 'modified', label: t('filemanager.sort.modified') || '修改时间' },
      ];
      // 只有在搜索模式下，路径排序才有意义 / Only show path sorting in search mode
      if (store.getIsSearchMode()) {
        options.splice(1, 0, { field: 'path', label: t('filemanager.sort.path') || '路径' });
      }
      return options;
    }
  };

  const sortOptions = getSortOptions();
  const currentLabel = sortOptions.find(opt => opt.field === sortConfig.field)?.label || t('filemanager.sort.name');

  const handleSelectSort = (field: string) => {
    const currentOrder = sortConfig.field === field ? (sortConfig.order === 'asc' ? 'desc' : 'asc') : 'asc';
    store.setSortConfig({ field, order: currentOrder });
    setIsOpen(false);
  };

  // 点击外部关闭菜单 / Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 h-10 rounded-xl border border-white/5 bg-white/5 opacity-40 hover:opacity-100 transition-all"
      >
        <ArrowUpDown size={18} />
        <span className="text-sm font-black uppercase tracking-wider">
          {currentLabel}
        </span>
        <ChevronDown size={18} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {sortOptions.map((option) => (
            <button
              key={option.field}
              onClick={() => handleSelectSort(option.field)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2 text-sm font-bold hover:bg-white/5 text-left transition-colors",
                sortConfig.field === option.field && "bg-primary/20 text-primary"
              )}
            >
              <span>{option.label}</span>
              {sortConfig.field === option.field && (
                <span className="text-[14px] uppercase opacity-60">
                  {sortConfig.order === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};