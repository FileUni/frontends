import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Keyboard, Info
} from 'lucide-react';
import { Button } from '@/components/ui/Button.tsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 专业集成 i18n 的快捷键说明模态框 / Professional i18n-integrated Shortcuts Modal
 */
export const ShortcutsHelpModal = ({ isOpen, onClose }: Props) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const sections = [
    {
      title: t('filemanager.help.sections.selection.title'),
      items: [
        { keys: ["Ctrl", "A"], desc: t('filemanager.help.sections.selection.selectAll') },
        { keys: ["Shift", "Click"], desc: t('filemanager.help.sections.selection.rangeSelect') },
        { keys: ["Ctrl", "Click"], desc: t('filemanager.help.sections.selection.multiSelect') },
        { keys: ["Esc"], desc: t('filemanager.help.sections.selection.escape') },
      ]
    },
    {
      title: t('filemanager.help.sections.fileOps.title'),
      items: [
        { keys: ["Ctrl", "C"], desc: t('filemanager.help.sections.fileOps.copy') },
        { keys: ["Ctrl", "X"], desc: t('filemanager.help.sections.fileOps.cut') },
        { keys: ["Ctrl", "V"], desc: t('filemanager.help.sections.fileOps.paste') },
        { keys: ["F2"], desc: t('filemanager.help.sections.fileOps.rename') },
        { keys: ["Delete"], desc: t('filemanager.help.sections.fileOps.delete') },
      ]
    },
    {
      title: t('filemanager.help.sections.mouse.title'),
      items: [
        { keys: ["Double Click"], desc: t('filemanager.help.sections.mouse.doubleClick') },
        { keys: ["Right Click"], desc: t('filemanager.help.sections.mouse.rightClick') },
        { keys: ["Long Press"], desc: t('filemanager.help.sections.mouse.longPress') },
        { keys: ["Drag & Drop"], desc: t('filemanager.help.sections.mouse.dragDrop') },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <Keyboard size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight uppercase">{t('filemanager.help.title')}</h3>
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest mt-1">{t('filemanager.help.subtitle')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-2xl h-12 w-12 p-0 hover:bg-white/5">
            <X size={24} className="opacity-40" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-primary/60 border-b border-white/5 pb-2">
                {section.title}
              </h4>
              <div className="space-y-3">
                {section.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 group">
                    <p className="text-sm text-white/60 group-hover:text-white/90 transition-colors leading-tight py-1">
                      {item.desc}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          <kbd className="min-w-[32px] h-6 px-1.5 flex items-center justify-center bg-white/5 border border-white/10 rounded-md text-sm font-black font-mono text-white/40 group-hover:text-primary transition-colors">
                            {key}
                          </kbd>
                          {ki < item.keys.length - 1 && <span className="text-sm opacity-20">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-8 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 opacity-30 italic max-w-[70%]">
            <Info size={18} className="shrink-0" />
            <span className="text-sm font-medium leading-tight">{t('filemanager.help.tip')}</span>
          </div>
          <Button onClick={onClose} className="rounded-2xl px-8 h-12 font-black uppercase text-sm shadow-xl shadow-primary/20">
            {t('filemanager.help.gotIt')}
          </Button>
        </div>
      </div>
    </div>
  );
};