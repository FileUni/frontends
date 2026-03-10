import React, { useEffect, useRef, useState } from 'react';
import { Download, Info, Play, Settings, Square, Trash2 } from 'lucide-react';
import { useResolvedTheme } from '../lib/theme';
import { cn } from '../lib/utils';

export type ServiceInstallLevel = 'system' | 'user';

interface ServiceControlPanelProps {
  isRunning: boolean;
  isLoading: boolean;
  supportService: boolean;
  statusLabel: string;
  title: string;
  description: string;
  startLabel: string;
  stopLabel: string;
  systemIntegrationLabel: string;
  installLabel: string;
  uninstallLabel: string;
  installLevelLabel: string;
  installLevelSystemLabel: string;
  installLevelUserLabel: string;
  installAutostartLabel: string;
  installLevel: ServiceInstallLevel;
  installAutostart: boolean;
  disableToggle?: boolean;
  disabledHint?: string;
  onToggleService: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onInstallLevelChange: (level: ServiceInstallLevel) => void;
  onInstallAutostartChange: (enabled: boolean) => void;
}

export const ServiceControlPanel: React.FC<ServiceControlPanelProps> = ({
  isRunning,
  isLoading,
  supportService,
  statusLabel,
  title,
  description,
  startLabel,
  stopLabel,
  systemIntegrationLabel,
  installLabel,
  uninstallLabel,
  installLevelLabel,
  installLevelSystemLabel,
  installLevelUserLabel,
  installAutostartLabel,
  installLevel,
  installAutostart,
  disableToggle = false,
  disabledHint,
  onToggleService,
  onInstall,
  onUninstall,
  onInstallLevelChange,
  onInstallAutostartChange,
}) => {
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  const serviceMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceMenuRef.current && !serviceMenuRef.current.contains(event.target as Node)) {
        setShowServiceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) return null;

  return (
    <div className={cn(
      "relative z-20 border rounded-[2rem] p-8 shadow-xl group transition-all duration-500",
      isDark ? "bg-slate-900 border-white/10 hover:border-blue-500/30" : "bg-white border-slate-200 hover:border-blue-500/30"
    )}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className={cn(
            "text-[10px] font-black uppercase tracking-[0.2em] mb-2",
            isDark ? "text-slate-500" : "text-slate-400"
          )}>{title}</h3>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-4 h-4 rounded-full shadow-lg",
              isRunning ? 'bg-emerald-500 animate-pulse shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'
            )} />
            <span className={cn(
              "text-2xl font-black tracking-tight",
              isDark ? "text-slate-100" : "text-slate-900"
            )}>{statusLabel}</span>
          </div>
          <p className={cn(
            "text-sm mt-4 leading-relaxed max-w-md font-medium",
            isDark ? "text-slate-400" : "text-slate-600"
          )}>{description}</p>
        </div>
        
        {supportService && (
          <div className="relative z-30" ref={serviceMenuRef}>
            <button
              onClick={() => setShowServiceMenu((prev) => !prev)}
              disabled={isLoading}
              className={cn(
                "p-4 rounded-2xl transition-all duration-300 border shadow-sm",
                showServiceMenu
                  ? 'bg-blue-600 border-transparent text-white shadow-lg shadow-blue-500/30 scale-105'
                  : isDark 
                    ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10' 
                    : 'bg-gray-50 border-gray-200 text-slate-500 hover:text-slate-900 hover:bg-gray-100'
              )}
              title={systemIntegrationLabel}
            >
              <Settings size={20} className={showServiceMenu ? 'rotate-90' : ''} />
            </button>

            {showServiceMenu && (
              <div className={cn(
                "absolute top-full right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] border rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[220]",
                isDark ? "bg-slate-950 border-white/10" : "bg-white border-slate-200"
              )}>
              <button
                onClick={() => {
                  onInstall();
                  setShowServiceMenu(false);
                }}
                disabled={isLoading}
                className={cn(
                  "w-full flex items-center gap-3.5 p-5 transition-all text-left group/item",
                  isDark ? "hover:bg-white/5 text-slate-200" : "hover:bg-gray-50 text-slate-800"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover/item:bg-blue-500 group-hover/item:text-white transition-all">
                  <Download size={18} />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider">{installLabel}</span>
              </button>
              <button
                onClick={() => {
                  onUninstall();
                  setShowServiceMenu(false);
                }}
                disabled={isLoading}
                className={cn(
                  "w-full flex items-center gap-3.5 p-5 border-t transition-all text-left group/item",
                  isDark ? "border-white/5 hover:bg-rose-500/10 text-slate-200 hover:text-rose-400" : "border-slate-100 hover:bg-rose-50 text-slate-800 hover:text-rose-600"
                )}
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover/item:bg-rose-500 group-hover/item:text-white transition-all">
                  <Trash2 size={18} />
                </div>
                <span className="text-sm font-bold uppercase tracking-wider">{uninstallLabel}</span>
              </button>

              <div className={cn(
                "border-t p-6 space-y-5",
                isDark ? "border-white/5 bg-white/[0.02]" : "border-slate-100 bg-gray-50/50"
              )}>
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em]",
                  isDark ? "text-slate-500" : "text-slate-400"
                )}>
                  {installLevelLabel}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onInstallLevelChange('system')}
                    className={cn(
                      "flex-1 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      installLevel === 'system'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : isDark ? 'bg-white/5 text-slate-500 hover:text-slate-300' : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-200'
                    )}
                  >
                    {installLevelSystemLabel}
                  </button>
                  <button
                    onClick={() => onInstallLevelChange('user')}
                    className={cn(
                      "flex-1 px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                      installLevel === 'user'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                        : isDark ? 'bg-white/5 text-slate-500 hover:text-slate-300' : 'bg-white text-slate-400 hover:text-slate-900 border border-slate-200'
                    )}
                  >
                    {installLevelUserLabel}
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 cursor-pointer group/label">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider transition-colors",
                    isDark ? "text-slate-500 group-hover/label:text-slate-200" : "text-slate-500 group-hover/label:text-slate-900"
                  )}>{installAutostartLabel}</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={installAutostart}
                      className="peer sr-only"
                      onChange={(event) => onInstallAutostartChange(event.target.checked)}
                    />
                    <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-500 transition-colors" />
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                  </div>
                </label>
              </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleService}
          disabled={isLoading || disableToggle}
          className={cn(
            "flex items-center justify-center gap-4 px-10 py-5 rounded-2xl transition-all duration-500 font-black shadow-2xl flex-1 text-base uppercase tracking-widest",
            isRunning
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-1 active:translate-y-0'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0',
            (isLoading || disableToggle) && "opacity-50 grayscale hover:translate-y-0 shadow-none"
          )}
        >
          {isRunning ? <Square fill="currentColor" size={24} className="animate-pulse" /> : <Play fill="currentColor" size={24} className="group-hover:scale-110 transition-transform" />}
          <span>{isRunning ? stopLabel : startLabel}</span>
        </button>
      </div>
      
      {disableToggle && disabledHint && (
        <div className={cn(
          "mt-6 p-4 rounded-2xl border flex gap-3 items-start animate-in fade-in slide-in-from-top-1",
          isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-800"
        )}>
          <Info size={18} className="shrink-0 mt-0.5" />
          <p className="text-xs font-black uppercase tracking-wider leading-relaxed">{disabledHint}</p>
        </div>
      )}
    </div>
  );
};
