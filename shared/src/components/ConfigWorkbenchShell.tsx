import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfigWorkbenchShellProps {
  title: string;
  subtitle?: string;
  configPath?: string | null;
  onClose?: () => void;
  closeAriaLabel?: string;
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
  containerClassName,
  bodyClassName,
  children,
}) => {
  return (
    <div className={cn(
      'h-full w-full rounded-2xl sm:rounded-3xl border border-white/15 bg-slate-950/95 text-slate-100 shadow-2xl flex flex-col overflow-hidden',
      containerClassName,
    )}>
      <div className="h-14 shrink-0 px-3 sm:px-5 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-black uppercase tracking-wide truncate">{title}</div>
          {subtitle ? (
            <div className="text-sm sm:text-sm text-slate-400 truncate">{subtitle}</div>
          ) : configPath ? (
            <div className="text-sm sm:text-sm font-mono text-slate-400 truncate">{configPath}</div>
          ) : null}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-white/20 text-slate-300 hover:bg-white/10 inline-flex items-center justify-center"
            aria-label={closeAriaLabel}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 lg:p-6', bodyClassName)}>
        {children}
      </div>
    </div>
  );
};
