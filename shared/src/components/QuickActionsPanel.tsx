import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FileCode, FolderOpen, Globe, Info, RefreshCcw, Rocket, Settings } from 'lucide-react';
import { useResolvedTheme } from '../lib/theme';
import { cn } from '../lib/utils';

interface QuickActionsPanelProps {
  title: string;
  openWebUiLabel: string;
  configLabel: string;
  openConfigDirLabel: string;
  editConfigLabel: string;
  helpLabel: string;
  aboutLabel?: string;
  setupWizardLabel?: string;
  setupLoading?: boolean;
  onOpenWebUi: () => void;
  onOpenConfigDir: () => void;
  onEditConfig: () => void;
  onOpenAbout?: () => void;
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
  aboutLabel,
  setupWizardLabel,
  setupLoading = false,
  onOpenWebUi,
  onOpenConfigDir,
  onEditConfig,
  onOpenAbout,
  onStartSetupWizard,
  onResetAdminPassword,
  resetAdminPasswordLabel,
  helpUrl = 'https://fileuni.eu.org/docs',
  showSetupWizardAction = true,
}) => {
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const configMenuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return (
    <div className={cn(
      "border rounded-[1.5rem] p-5 shadow-xl transition-all duration-300",
      isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
    )}>
      <h3 className={cn(
        "text-[10px] font-black uppercase tracking-[0.2em] mb-5",
        isDark ? "text-slate-500" : "text-slate-400"
      )}>
        {title}
      </h3>
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onOpenWebUi}
          className={cn(
            "flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 group border shadow-sm",
            isDark 
              ? "bg-white/5 border-white/5 hover:bg-blue-600 hover:text-white text-slate-300 hover:shadow-blue-500/25" 
              : "bg-gray-50 border-gray-100 hover:bg-blue-600 hover:text-white text-slate-700 hover:shadow-blue-500/25"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
            isDark ? "bg-blue-500/10 group-hover:bg-white/20" : "bg-blue-500/10 group-hover:bg-white/20"
          )}>
            <Globe size={18} className="group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-black tracking-tight uppercase tracking-wider">{openWebUiLabel}</span>
        </button>

        <div className="relative" ref={configMenuRef}>
          <button
            onClick={() => setShowConfigMenu((prev) => !prev)}
            className={cn(
              "w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 group border shadow-sm",
              showConfigMenu 
                ? 'bg-cyan-600 text-white border-transparent shadow-lg shadow-cyan-500/25' 
                : isDark
                  ? 'bg-white/5 border-white/5 hover:bg-cyan-600 hover:text-white text-slate-300'
                  : 'bg-gray-50 border-gray-100 hover:bg-cyan-600 hover:text-white text-slate-700'
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
              showConfigMenu ? 'bg-white/20' : 'bg-cyan-500/10 group-hover:bg-white/20'
            )}>
              <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
            </div>
            <span className="text-sm font-black tracking-tight uppercase tracking-wider">{configLabel}</span>
          </button>

          {showConfigMenu && (
            <div className={cn(
              "absolute top-full left-0 mt-2 w-full border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-[100]",
              isDark ? "bg-slate-950 border-white/10" : "bg-white border-slate-200"
            )}>
              <button
                onClick={() => {
                  onOpenConfigDir();
                  setShowConfigMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3.5 p-4 transition-all text-left group/item",
                  isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-gray-50 text-slate-700"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover/item:bg-blue-500 group-hover/item:text-white transition-all">
                  <FolderOpen size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">{openConfigDirLabel}</span>
              </button>
              <button
                onClick={() => {
                  onEditConfig();
                  setShowConfigMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3.5 p-4 border-t transition-all text-left group/item",
                  isDark ? "border-white/5 hover:bg-white/5 text-slate-300" : "border-slate-100 hover:bg-gray-50 text-slate-700"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover/item:bg-blue-500 group-hover/item:text-white transition-all">
                  <FileCode size={16} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">{editConfigLabel}</span>
              </button>
              {onResetAdminPassword && (
                <button
                  onClick={() => {
                    onResetAdminPassword();
                    setShowConfigMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3.5 p-4 border-t transition-all text-left group/item",
                    isDark ? "border-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400" : "border-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover/item:bg-rose-500 group-hover/item:text-white transition-all">
                    <RefreshCcw size={16} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">{resetAdminPasswordLabel || 'Reset Admin Password'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <a
          href={helpUrl}
          target="_blank"
          className={cn(
            "flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 group border shadow-sm",
            isDark
              ? "bg-white/5 border-white/5 hover:bg-amber-600 hover:text-white text-slate-300"
              : "bg-gray-50 border-gray-100 hover:bg-amber-600 hover:text-white text-slate-700"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
            isDark ? "bg-amber-500/10 group-hover:bg-white/20" : "bg-amber-500/10 group-hover:bg-white/20"
          )}>
            <BookOpen size={18} className="group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="text-sm font-black tracking-tight uppercase tracking-wider">{helpLabel}</span>
        </a>

        {onOpenAbout && aboutLabel && (
          <button
            onClick={onOpenAbout}
            className={cn(
              "flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 group border shadow-sm",
              isDark
                ? "bg-white/5 border-white/5 hover:bg-fuchsia-600 hover:text-white text-slate-300"
                : "bg-gray-50 border-gray-100 hover:bg-fuchsia-600 hover:text-white text-slate-700"
            )}
          >
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
              isDark ? "bg-fuchsia-500/10 group-hover:bg-white/20" : "bg-fuchsia-500/10 group-hover:bg-white/20"
            )}>
              <Info size={18} className="group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-sm font-black tracking-tight uppercase tracking-wider">{aboutLabel}</span>
          </button>
        )}

        {showSetupWizardAction && onStartSetupWizard && setupWizardLabel && (
          <div className={cn(
            "mt-3 pt-5 border-t",
            isDark ? "border-white/5" : "border-gray-100"
          )}>
            <button
              onClick={onStartSetupWizard}
              disabled={setupLoading}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0"
            >
              {setupLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Rocket size={18} className="group-hover:rotate-12 transition-transform" />
              )}
              <span>{setupWizardLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
