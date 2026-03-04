import React, { useEffect, useRef, useState } from 'react';
import { Download, Info, Play, Settings, Square, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceMenuRef.current && !serviceMenuRef.current.contains(event.target as Node)) {
        setShowServiceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-20 bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 rounded-[2rem] p-8 backdrop-blur-md shadow-sm group hover:border-blue-500/30 transition-all duration-500">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2">{title}</h3>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'} shadow-lg ${isRunning ? 'shadow-emerald-500/50' : 'shadow-amber-500/50'}`} />
            <span className="text-xl font-black tracking-tight text-slate-700 dark:text-slate-200">{statusLabel}</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed max-w-md">{description}</p>
        </div>
        
        <div className="relative z-30" ref={serviceMenuRef}>
          <button
            onClick={() => setShowServiceMenu((prev) => !prev)}
            disabled={isLoading || !supportService}
            className={`p-4 rounded-2xl transition-all duration-300 border ${
              showServiceMenu
                ? 'bg-blue-500 border-transparent text-white shadow-lg shadow-blue-500/30 scale-105'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200/50 dark:border-slate-700/50'
            } disabled:opacity-30 active:scale-95`}
            title={systemIntegrationLabel}
          >
            <Settings size={20} className={showServiceMenu ? 'rotate-90' : ''} />
          </button>

          {showServiceMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[220]">
              <button
                onClick={() => {
                  onInstall();
                  setShowServiceMenu(false);
                }}
                disabled={isLoading || !supportService}
                className="w-full flex items-center gap-3.5 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors text-left disabled:opacity-30"
              >
                <Download size={18} className="text-blue-500 shrink-0" /> <span>{installLabel}</span>
              </button>
              <button
                onClick={() => {
                  onUninstall();
                  setShowServiceMenu(false);
                }}
                disabled={isLoading || !supportService}
                className="w-full flex items-center gap-3.5 p-4 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 text-sm font-semibold transition-colors border-t border-slate-100 dark:border-slate-700 text-left disabled:opacity-30"
              >
                <Trash2 size={18} className="shrink-0" /> <span>{uninstallLabel}</span>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-4">
                <div className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  {installLevelLabel}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onInstallLevelChange('system')}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                      installLevel === 'system'
                        ? 'bg-blue-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {installLevelSystemLabel}
                  </button>
                  <button
                    onClick={() => onInstallLevelChange('user')}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                      installLevel === 'user'
                        ? 'bg-blue-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {installLevelUserLabel}
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400 font-bold cursor-pointer group/label">
                  <span className="group-hover/label:text-slate-900 dark:group-hover/label:text-slate-200 transition-colors">{installAutostartLabel}</span>
                  <input
                    type="checkbox"
                    checked={installAutostart}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
                    onChange={(event) => onInstallAutostartChange(event.target.checked)}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onToggleService}
          disabled={isLoading || disableToggle}
          className={`flex items-center justify-center gap-4 px-10 py-5 rounded-2xl transition-all duration-500 font-black shadow-2xl flex-1 text-base uppercase tracking-widest ${
            isRunning
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-rose-500/25 hover:shadow-rose-500/40 hover:-translate-y-1 active:translate-y-0'
              : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0'
          } disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none`}
        >
          {isRunning ? <Square fill="currentColor" size={24} className="animate-pulse" /> : <Play fill="currentColor" size={24} className="group-hover:scale-110 transition-transform" />}
          <span>{isRunning ? stopLabel : startLabel}</span>
        </button>
      </div>
      
      {disableToggle && disabledHint && (
        <p className="mt-6 text-sm text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 animate-in fade-in slide-in-from-top-1">
          <Info size={18} className="inline-block mr-2 -mt-0.5" />
          {disabledHint}
        </p>
      )}
    </div>
  );
};
