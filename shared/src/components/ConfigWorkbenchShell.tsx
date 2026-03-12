import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResolvedTheme } from '../lib/theme';

interface ConfigWorkbenchShellProps {
  title: string;
  subtitle?: string;
  configPath?: string | null;
  onClose?: () => void;
  closeAriaLabel?: string;
  headerActions?: React.ReactNode;
  containerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const ConfigWorkbenchShell: React.FC<ConfigWorkbenchShellProps> = ({
  title,
  subtitle,
  configPath,
  onClose,
  closeAriaLabel = 'Close',
  headerActions,
  containerClassName,
  bodyClassName,
  children,
}) => {
  const resolvedTheme = useResolvedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <div className={cn(
      'h-full w-full rounded-2xl sm:rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-300',
      isDark ? 'border-white/10 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-900',
      containerClassName,
    )}>
      <div className={cn(
        "h-14 shrink-0 px-3 sm:px-5 border-b flex items-center justify-between gap-3",
        isDark ? "border-white/10 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"
      )}>
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-black uppercase tracking-wide truncate">{title}</div>
          {subtitle ? (
            <div className={cn("text-xs sm:text-sm truncate font-bold", isDark ? "text-slate-400" : "text-slate-500")}>{subtitle}</div>
          ) : configPath ? (
            <div className="text-xs sm:text-sm font-mono text-slate-400 truncate">{configPath}</div>
          ) : null}
        </div>
        {(headerActions || onClose) && (
          <div className="flex items-center gap-2">
            {headerActions}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "h-8 w-8 rounded-lg border inline-flex items-center justify-center transition-colors",
                  isDark ? "border-white/20 text-slate-300 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
                aria-label={closeAriaLabel}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 lg:p-6', bodyClassName)}>
        {children}
      </div>
    </div>
  );
};
