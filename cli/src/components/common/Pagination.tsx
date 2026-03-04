import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button.tsx';
import { 
  ChevronLeft, ChevronRight,
  ArrowRight, MoreVertical, Settings2, Hash, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils.ts';

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

/**
 * Pro Unified Pagination Component
 * Optimized for mobile and PC, supports dynamic page numbers and aggregated menus.
 */
export const Pagination = ({
  current,
  total,
  pageSize,
  pageSizeOptions = [20, 50, 100, 200],
  onPageChange,
  onPageSizeChange,
  className
}: PaginationProps) => {
  const { t } = useTranslation();
  const totalPages = Math.ceil(total / pageSize) || 1;
  const [jumpPage, setJumpPage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setShowOptions(false);
        setShowAllPages(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleJump = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const page = parseInt(jumpPage);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpPage('');
      setShowOptions(false);
    }
  };

  // Calculate visible page numbers
  const getPageRange = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    for (let i = Math.max(2, current - delta); i <= Math.min(totalPages - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) range.unshift('...');
    if (current + delta < totalPages - 1) range.push('...');

    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);
    return range;
  };

  if (total <= 0) {
    return (
      <div className={cn("h-14 border-t border-white/5 bg-white/[0.01] backdrop-blur-xl shrink-0 flex items-center justify-center opacity-20", className)}>
        <span className="text-sm font-black uppercase tracking-[0.2em]">{t('filemanager.emptyFolder')}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-16 md:h-20 border-t border-white/5 bg-black/40 backdrop-blur-2xl px-4 md:px-8 flex items-center justify-between relative z-50",
      className
    )}>
      {/* PC: Stats & Page Size */}
      <div className="hidden md:flex items-center gap-6">
        <p className="text-sm font-black uppercase tracking-widest opacity-30">
          {t('common.pagination.showing', { 
            start: (current - 1) * pageSize + 1, 
            end: Math.min(current * pageSize, total), 
            total 
          })}
        </p>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold opacity-20 uppercase tracking-tighter">{t('common.pagination.limit')}:</span>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              {pageSizeOptions.slice(0, 3).map(size => (
                <button
                  key={size}
                  onClick={() => onPageSizeChange(size)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-sm font-black transition-all",
                    pageSize === size ? "bg-primary text-white shadow-lg shadow-primary/20" : "opacity-40 hover:opacity-100"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Core Controls */}
      <div className="flex items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-end">
        
        {/* Page Switcher */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" size="sm" onClick={() => onPageChange(current - 1)} disabled={current === 1}
            className="h-9 w-9 p-0 rounded-xl hover:bg-white/10 disabled:opacity-10"
          >
            <ChevronLeft size={18} />
          </Button>
          
          {/* PC: Dynamic Page Numbers */}
          <div className="hidden lg:flex items-center gap-1 mx-2">
            {getPageRange().map((p, i) => (
              p === '...' ? (
                <span key={`sep-${i}`} className="w-8 text-center text-sm font-black opacity-20">•••</span>
              ) : (
                <button
                  key={`page-${p}`}
                  onClick={() => onPageChange(p as number)}
                  className={cn(
                    "w-8 h-8 rounded-xl text-sm font-black transition-all",
                    current === p ? "bg-primary text-white shadow-lg" : "hover:bg-white/5 opacity-40 hover:opacity-100"
                  )}
                >
                  {p}
                </button>
              )
            ))}
          </div>

          {/* Mobile: Compact Indicator */}
          <div className="lg:hidden flex items-center px-3 bg-white/5 h-9 rounded-xl border border-white/5 gap-2">
             <span className="text-sm font-black text-primary">{current}</span>
             <span className="text-sm font-black opacity-10">/</span>
             <span className="text-sm font-black opacity-40">{totalPages}</span>
          </div>

          <Button 
            variant="ghost" size="sm" onClick={() => onPageChange(current + 1)} disabled={current >= totalPages}
            className="h-9 w-9 p-0 rounded-xl hover:bg-white/10 disabled:opacity-10"
          >
            <ChevronRight size={18} />
          </Button>
        </div>

        {/* Options Button (Mobile & PC) */}
        <div className="relative" ref={optionsRef}>
          <Button 
            variant="ghost" 
            onClick={() => setShowOptions(!showOptions)}
            className={cn(
              "h-9 w-9 md:h-10 md:w-10 p-0 rounded-xl border border-white/5 transition-all",
              showOptions ? "bg-primary text-white border-primary" : "bg-white/5 opacity-60 hover:opacity-100"
            )}
          >
            <MoreVertical size={18} />
          </Button>

          {/* Options Popover */}
          {showOptions && (
            <div className="absolute bottom-full right-0 mb-3 w-64 bg-zinc-900/95 border border-white/10 rounded-[2rem] shadow-2xl backdrop-blur-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden">
              <div className="space-y-5">
                {/* Quick Jump */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Hash size={18} className="text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest opacity-40">{t('common.pagination.jumpTo')}</span>
                  </div>
                  <form onSubmit={handleJump} className="flex gap-2">
                    <input 
                      autoFocus
                      value={jumpPage}
                      onChange={e => setJumpPage(e.target.value)}
                      placeholder={`1 - ${totalPages}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary/50 transition-all"
                    />
                    <button type="submit" className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                      <ArrowRight size={16} strokeWidth={3} />
                    </button>
                  </form>
                </div>

                {/* Page Size */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Settings2 size={18} className="text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest opacity-40">{t('common.pagination.itemsPerPage')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {pageSizeOptions.map(size => (
                      <button
                        key={size}
                        onClick={() => { onPageSizeChange?.(size); setShowOptions(false); }}
                        className={cn(
                          "py-2 rounded-xl text-sm font-black transition-all border",
                          pageSize === size ? "bg-primary text-white border-primary" : "bg-white/5 border-white/5 opacity-40 hover:opacity-100"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select All Pages */}
                <button 
                  onClick={() => setShowAllPages(!showAllPages)}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center gap-3 transition-all group"
                >
                  <Layers size={16} className="text-primary transition-transform group-hover:scale-110" />
                  <span className="text-sm font-black uppercase tracking-widest">{t('common.pagination.browseAll', { count: totalPages })}</span>
                </button>
              </div>

              {/* Full Page Grid */}
              {showAllPages && (
                <div className="mt-4 pt-4 border-t border-white/5 max-h-48 overflow-y-auto no-scrollbar grid grid-cols-5 gap-1.5 animate-in fade-in slide-in-from-top-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={`grid-page-${p}`}
                      onClick={() => { onPageChange(p); setShowOptions(false); }}
                      className={cn(
                        "aspect-square rounded-lg flex items-center justify-center text-sm font-black transition-all",
                        current === p ? "bg-primary text-white shadow-lg" : "bg-white/5 opacity-40 hover:opacity-100"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
