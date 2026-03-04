import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useFileStore } from '../store/useFileStore.ts';
import { useThemeStore } from '@fileuni/shared';
import { useConfigStore } from '@/stores/config.ts';
import { useUserFileSettingsStore, type UserFileSettingsUpdate } from '@/stores/userFileSettings.ts';
import { useAuthzStore } from '@/stores/authz.ts';
import { 
  ChevronLeft, ChevronRight, RefreshCw, Grid, List, 
  Search, Share2, ChevronDown, RefreshCcw, 
  Lock, Zap, Globe, Plus, Upload, FilePlus, FolderPlus as FolderPlusIcon,
  HelpCircle, Image, Trash2, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { Switch } from '@/components/ui/Switch.tsx';
import { SearchModal } from './SearchModal.tsx';
import { UploadModal } from './UploadModal.tsx';
import { ShortcutsHelpModal } from './ShortcutsHelpModal.tsx';
import { SortMenu } from './SortMenu.tsx';
import { useFileActions } from '../hooks/useFileActions.ts';
import { cn } from '@/lib/utils.ts';

export const FileManagerToolbar = () => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const store = useFileStore();
  const { capabilities } = useConfigStore();
  const { settings, fetchSettings, updateSettings, isLoading: settingsLoading } = useUserFileSettingsStore();
  const { hasPermission } = useAuthzStore();
  const { 
    setViewMode, loading,
    showShareStatus, setShowShareStatus, fmMode,
    setShareFilter, openActionModal
  } = store;
  
  const viewMode = store.getViewMode();
  const currentPath = store.getCurrentPath();
  const shareFilter = store.getShareFilter();
  const { 
    loadFiles, forceSyncIndex, 
    clearRecycleBin, clearAllShares, clearAllFavorites,
    clearThumbnailCache, clearThumbnailCacheAllUsers
  } = useFileActions();
  
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showThumbnailSettings, setShowThumbnailSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && mounted && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isMinimal = ["favorites", "trash", "recent", "shares"].includes(fmMode);
  const canModify = fmMode === 'files';
  const enableThumbnails = capabilities?.thumbnail?.enabled === true;
  const isAdmin = hasPermission("admin.access");
  const thumbCaps = capabilities?.thumbnail;
  const toggleDisabled = settingsLoading || !settings;

  const handleRefresh = () => {
    loadFiles();
    setShowRefreshMenu(false);
  };
  
  const handleForceRefresh = () => {
    forceSyncIndex(currentPath);
    setShowRefreshMenu(false);
  };

  const toggleShareStatus = () => {
    const newVal = !showShareStatus;
    setShowShareStatus(newVal);
    loadFiles();
  };

  const togglePasswordFilter = () => {
    const newVal = shareFilter.hasPassword === null ? true : shareFilter.hasPassword === true ? false : null;
    setShareFilter({ hasPassword: newVal });
    loadFiles();
  };

  const toggleDirectFilter = () => {
    const newVal = shareFilter.enableDirect === null ? true : shareFilter.enableDirect === true ? false : null;
    setShareFilter({ enableDirect: newVal });
    loadFiles();
  };

  const handleBulkClear = () => {
    if (fmMode === 'trash') clearRecycleBin();
    else if (fmMode === 'shares') clearAllShares();
    else if (fmMode === 'favorites') clearAllFavorites();
  };

  const getBulkClearLabel = () => {
    if (fmMode === 'trash') return t('filemanager.actions.emptyTrash');
    if (fmMode === 'shares') return t('filemanager.actions.cancelAllShares');
    if (fmMode === 'favorites') return t('filemanager.actions.clearAllFavorites');
    return '';
  };

  const showBulkClear = ['trash', 'shares', 'favorites'].includes(fmMode);

  const dropdownClasses = cn(
    "absolute z-50 border shadow-2xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl rounded-2xl",
    isDark ? "bg-zinc-900/95 border-white/10" : "bg-white border-gray-200"
  );

  const menuItemClasses = cn(
    "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors text-left",
    isDark ? "text-white/80 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100"
  );

  const toggleItems: { key: keyof UserFileSettingsUpdate; label: string; enabled: boolean }[] = [
    { key: 'thumbnail_disable_image', label: t('filemanager.thumbnail.types.image') || 'Images', enabled: thumbCaps?.image === true },
    { key: 'thumbnail_disable_video', label: t('filemanager.thumbnail.types.video') || 'Videos', enabled: thumbCaps?.video === true },
    { key: 'thumbnail_disable_pdf', label: t('filemanager.thumbnail.types.pdf') || 'PDF', enabled: thumbCaps?.pdf === true },
    { key: 'thumbnail_disable_office', label: t('filemanager.thumbnail.types.office') || 'Office', enabled: thumbCaps?.office === true },
    { key: 'thumbnail_disable_text', label: t('filemanager.thumbnail.types.text') || 'Text', enabled: thumbCaps?.text === true },
    { key: 'thumbnail_disable_markdown', label: t('filemanager.thumbnail.types.markdown') || 'Markdown', enabled: thumbCaps?.text === true },
    { key: 'thumbnail_disable_tex', label: t('filemanager.thumbnail.types.tex') || 'LaTeX', enabled: thumbCaps?.tex === true },
  ];

  const visibleToggleItems = toggleItems.filter((item) => item.enabled);

  return (
    <>
      <div className="h-16 border-b border-white/5 bg-white/[0.01] flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          {fmMode === 'files' && (
            <>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="p-2 h-9 w-9 md:h-10 md:w-10 rounded-xl" onClick={() => window.history.back()}>
                  <ChevronLeft size={18} />
                </Button>
                <Button variant="ghost" className="hidden sm:flex p-2 h-10 w-10 rounded-xl" onClick={() => window.history.forward()}>
                  <ChevronRight size={18} />
                </Button>
              </div>
              <div className="divider divider-horizontal mx-0 h-6 border-white/10 hidden sm:block" />
            </>
          )}
          
          {canModify && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="bg-primary hover:bg-primary/90 text-white h-9 md:h-10 px-3 md:px-4 rounded-xl font-bold text-sm md:text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 shrink-0"
              >
                <Upload size={16} />
                <span className="hidden xs:inline">{t('filemanager.upload')}</span>
              </Button>

              <div className="relative">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowNewMenu(!showNewMenu)}
                  className="bg-white/5 border border-white/5 hover:bg-white/10 h-9 md:h-10 px-2 md:px-3 rounded-xl flex items-center gap-2 transition-all shrink-0"
                >
                  <Plus size={16} className="text-primary" />
                  <span className="text-sm font-bold uppercase opacity-60 hidden lg:inline">{t('common.new')}</span>
                  <ChevronDown size={18} className={cn("opacity-30 transition-transform", showNewMenu && "rotate-180")} />
                </Button>

                {showNewMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
                    <div className={cn(dropdownClasses, "left-0 top-12 w-44")}>
                      <button 
                        onClick={() => { openActionModal("create_file", t("filemanager.newFile"), "NewFile.md"); setShowNewMenu(false); }}
                        className={menuItemClasses}
                      >
                        <FilePlus size={16} className="text-blue-400" />
                        <span>{t('filemanager.newFile')}</span>
                      </button>
                      <button 
                        onClick={() => { openActionModal("create_dir", t("filemanager.newFolder"), "NewFolder"); setShowNewMenu(false); }}
                        className={menuItemClasses}
                      >
                        <FolderPlusIcon size={16} className="text-yellow-400" />
                        <span>{t('filemanager.newFolder')}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {isMinimal && (
            <h2 className="text-sm md:text-xl font-black tracking-tight truncate">
              {fmMode === 'favorites' ? t('filemanager.favorites') : 
               fmMode === 'trash' ? t('filemanager.trash') : 
               fmMode === 'shares' ? t('filemanager.shares.title') : 
               t('filemanager.recent')}
            </h2>
          )}
          
          <div className="flex-1" />
        </div>

        <div className="flex items-center gap-1.5 md:gap-3 ml-2">
          {showBulkClear && (
            <Button 
              variant="ghost" 
              onClick={handleBulkClear}
              className="h-9 px-3 rounded-xl text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all shrink-0 border border-red-500/20"
            >
              <RefreshCcw size={18} className="mr-2 opacity-50" />
              {getBulkClearLabel()}
            </Button>
          )}

          <Button 
            variant="ghost" 
            onClick={() => setShowHelpModal(true)}
            title={t('filemanager.actions.help') || "Shortcuts Help"}
            className="p-2 h-9 w-9 md:h-10 md:w-10 rounded-xl border border-white/5 transition-all opacity-40 hover:opacity-100 hidden sm:flex"
          >
            <HelpCircle size={18} />
          </Button>

          <Button 
            variant="ghost" 
            onClick={() => setShowSearchModal(true)}
            title={t('filemanager.search')}
            className="p-2 h-9 w-9 md:h-10 md:w-10 rounded-xl border border-white/5 transition-all opacity-40 hover:opacity-100"
          >
            <Search size={18} />
          </Button>

          {enableThumbnails && (
            <Button
              variant="ghost"
              onClick={() => { setShowThumbnailSettings(true); fetchSettings(); }}
              title={t('filemanager.thumbnail.settingsTitle') || 'Thumbnail Settings'}
              className="p-2 h-9 w-9 md:h-10 md:w-10 rounded-xl border border-white/5 transition-all opacity-40 hover:opacity-100"
            >
              <Settings size={18} />
            </Button>
          )}

          <div className="hidden md:flex"><SortMenu /></div>

          {fmMode === 'shares' && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 scale-90 md:scale-100">
              <Button 
                variant="ghost" 
                onClick={togglePasswordFilter}
                title={t('filemanager.shares.filterPassword')}
                className={cn(
                  "p-1.5 md:p-2 h-7 w-7 md:h-8 md:w-8 rounded-lg transition-all",
                  shareFilter.hasPassword === true ? "bg-primary text-white shadow-lg" : 
                  shareFilter.hasPassword === false ? "bg-red-500/20 text-red-500" : "opacity-40 hover:opacity-100"
                )}
              >
                {shareFilter.hasPassword === false ? <Globe size={18} /> : <Lock size={18} />}
              </Button>
              <Button 
                variant="ghost" 
                onClick={toggleDirectFilter}
                title={t('filemanager.shares.filterDirect')}
                className={cn(
                  "p-1.5 md:p-2 h-7 w-7 md:h-8 md:w-8 rounded-lg transition-all",
                  shareFilter.enableDirect === true ? "bg-yellow-500 text-black shadow-lg" : 
                  shareFilter.enableDirect === false ? "bg-blue-500/20 text-blue-500" : "opacity-40 hover:opacity-100"
                )}
              >
                <Zap size={18} fill={shareFilter.enableDirect === true ? "currentColor" : "none"} />
              </Button>
            </div>
          )}

          {fmMode === 'files' && (
            <Button 
              variant="ghost" 
              onClick={toggleShareStatus}
              title={t('filemanager.showShareStatus')}
              className={cn(
                "p-2 h-9 w-9 md:h-10 md:w-10 rounded-xl border border-white/5 transition-all",
                showShareStatus ? "bg-primary/20 text-primary border-primary/20" : "bg-white/5 opacity-40 hover:opacity-100 hidden xs:flex"
              )}
            >
              <Share2 size={18} />
            </Button>
          )}

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 scale-90 md:scale-100">
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 md:p-2 h-7 w-7 md:h-8 md:w-8 rounded-lg", viewMode === 'grid' ? 'bg-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100')}
              title={t('filemanager.gridView')}
            >
              <Grid size={18} />
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 md:p-2 h-7 w-7 md:h-8 md:w-8 rounded-lg", viewMode === 'list' ? 'bg-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100')}
              title={t('filemanager.listView')}
            >
              <List size={18} />
            </Button>
          </div>

          {fmMode !== 'recent' && (
            <div className="relative">
              <div className="flex items-center bg-white/5 rounded-xl border border-white/5 overflow-hidden scale-90 md:scale-100">
                <Button 
                  variant="ghost" 
                  className="p-2 h-9 w-9 md:h-10 md:w-10 rounded-none border-r border-white/5" 
                  onClick={handleRefresh}
                  title={t('filemanager.refresh')}
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : 'opacity-50'} />
                </Button>
                <Button 
                  variant="ghost" 
                  className="p-1 h-9 w-5 md:h-10 md:w-6 rounded-none opacity-30 hover:opacity-100"
                  onClick={() => setShowRefreshMenu(!showRefreshMenu)}
                >
                  <ChevronDown size={18} />
                </Button>
              </div>

              {showRefreshMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRefreshMenu(false)} />
                  <div className={cn(dropdownClasses, "right-0 top-12 w-48")}>
                    <button 
                      onClick={handleRefresh}
                      className={menuItemClasses}
                    >
                      <RefreshCw size={16} className="opacity-50" />
                      <span>{t('filemanager.refresh')}</span>
                    </button>
                    <button 
                      onClick={handleForceRefresh}
                      className={cn(menuItemClasses, "text-primary hover:bg-primary/10")}
                    >
                      <RefreshCcw size={16} />
                      <span>{t('filemanager.forceRefresh')}</span>
                    </button>
                    {enableThumbnails && (
                      <>
                        <div className={cn("h-px my-1 mx-2", isDark ? "bg-white/5" : "bg-gray-100")} />
                        <button 
                          onClick={() => { clearThumbnailCache(currentPath); setShowRefreshMenu(false); }}
                          className={menuItemClasses}
                        >
                          <Image size={16} className="opacity-60" />
                          <span>{t('filemanager.thumbnail.clearDir')}</span>
                        </button>
                        <button 
                          onClick={() => { clearThumbnailCache(); setShowRefreshMenu(false); }}
                          className={menuItemClasses}
                        >
                          <Trash2 size={16} className="opacity-60" />
                          <span>{t('filemanager.thumbnail.clearAll')}</span>
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => { clearThumbnailCacheAllUsers(); setShowRefreshMenu(false); }}
                            className={cn(menuItemClasses, "text-red-500 hover:bg-red-500/10")}
                          >
                            <Trash2 size={16} />
                            <span>{t('filemanager.thumbnail.clearAllUsers')}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <SearchModal 
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      <ShortcutsHelpModal 
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <Modal
        isOpen={showThumbnailSettings}
        onClose={() => setShowThumbnailSettings(false)}
        title={t('filemanager.thumbnail.settingsTitle') || 'Thumbnail Settings'}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm opacity-60">
            {t('filemanager.thumbnail.settingsDesc') || 'Enable or disable thumbnails by file type.'}
          </p>
          <div className="space-y-3">
            {visibleToggleItems.map((item) => {
              const rawValue = settings?.[item.key];
              const disabledValue = typeof rawValue === 'boolean' ? rawValue : false;
              const checked = !disabledValue;
              return (
                <div key={item.key as string} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 px-3 py-2">
                  <div className="text-sm font-bold uppercase tracking-widest opacity-70">
                    {item.label}
                  </div>
                  <Switch
                    checked={checked}
                    disabled={toggleDisabled}
                    onChange={(val) => updateSettings({ [item.key]: !val } as UserFileSettingsUpdate)}
                  />
                </div>
              );
            })}
            {visibleToggleItems.length === 0 && (
              <div className="text-sm opacity-50">{t('filemanager.thumbnail.noTypes') || 'No thumbnail types available.'}</div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};
