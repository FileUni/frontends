import React, { useEffect, useRef, useState } from 'react';
import { FileCode, FolderOpen, Globe, Info, RefreshCcw, Rocket, Settings } from 'lucide-react';

interface QuickActionsPanelProps {
  title: string;
  openWebUiLabel: string;
  configLabel: string;
  openConfigDirLabel: string;
  editConfigLabel: string;
  helpLabel: string;
  setupWizardLabel?: string;
  setupLoading?: boolean;
  onOpenWebUi: () => void;
  onOpenConfigDir: () => void;
  onEditConfig: () => void;
  onStartSetupWizard?: () => void;
  onResetAdminPassword?: () => void;
  resetAdminPasswordLabel?: string;
  helpUrl?: string;
  showSetupWizardAction?: boolean;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  title,
  openWebUiLabel,
  configLabel,
  openConfigDirLabel,
  editConfigLabel,
  helpLabel,
  setupWizardLabel,
  setupLoading = false,
  onOpenWebUi,
  onOpenConfigDir,
  onEditConfig,
  onStartSetupWizard,
  onResetAdminPassword,
  resetAdminPasswordLabel,
  helpUrl = 'https://fileuni.eu.org/docs',
  showSetupWizardAction = true,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const configMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target as Node)) {
        setShowConfigMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/40 rounded-[1.5rem] p-5 backdrop-blur-md">
      <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-slate-400 dark:text-slate-500">{title}</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={onOpenWebUi}
          className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/50 hover:bg-blue-500 dark:hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 transition-all duration-300 group shadow-sm hover:shadow-blue-500/25 border border-slate-200/50 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <Globe size={18} className="group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-bold tracking-tight">{openWebUiLabel}</span>
        </button>

        <div className="relative" ref={configMenuRef}>
          <button
            onClick={() => setShowConfigMenu((prev) => !prev)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group border ${
              showConfigMenu 
                ? 'bg-cyan-500 text-white border-transparent shadow-lg shadow-cyan-500/25' 
                : 'bg-white dark:bg-slate-800/50 hover:bg-cyan-500 dark:hover:bg-cyan-600 hover:text-white text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50 shadow-sm'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${showConfigMenu ? 'bg-white/20' : 'bg-cyan-500/10 group-hover:bg-white/20'}`}>
              <Settings size={18} className="group-hover:rotate-45 transition-transform duration-500" />
            </div>
            <span className="text-sm font-bold tracking-tight">{configLabel}</span>
          </button>

          {showConfigMenu && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <button
                onClick={() => {
                  onOpenConfigDir();
                  setShowConfigMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors text-left"
              >
                <FolderOpen size={16} className="text-blue-500 shrink-0" />
                <span>{openConfigDirLabel}</span>
              </button>
              <button
                onClick={() => {
                  onEditConfig();
                  setShowConfigMenu(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors border-t border-slate-100 dark:border-slate-700 text-left"
              >
                <FileCode size={16} className="text-blue-500 shrink-0" />
                <span>{editConfigLabel}</span>
              </button>
              {onResetAdminPassword && (
                <button
                  onClick={() => {
                    onResetAdminPassword();
                    setShowConfigMenu(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 text-sm font-semibold transition-colors border-t border-slate-100 dark:border-slate-700 text-left"
                >
                  <RefreshCcw size={16} className="shrink-0 opacity-70" />
                  <span>{resetAdminPasswordLabel || 'Reset Admin Password'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <a
          href={helpUrl}
          target="_blank"
          className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/50 hover:bg-amber-500 dark:hover:bg-amber-600 hover:text-white text-slate-600 dark:text-slate-300 transition-all duration-300 group shadow-sm hover:shadow-amber-500/25 border border-slate-200/50 dark:border-slate-700/50"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <Info size={18} className="group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-bold tracking-tight">{helpLabel}</span>
        </a>

        {showSetupWizardAction && onStartSetupWizard && setupWizardLabel && (
          <div className="mt-2 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
            <button
              onClick={onStartSetupWizard}
              disabled={setupLoading}
              className="w-full flex items-center justify-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Rocket size={16} className="group-hover:rotate-12 transition-transform" />
              <span>{setupWizardLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
