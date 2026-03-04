import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  maxWidth?: string;
  hideCloseButton?: boolean;
}

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className, 
  bodyClassName,
  maxWidth = "max-w-md",
  hideCloseButton = false
}: ModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hideCloseButton) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, hideCloseButton]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !hideCloseButton && onClose()} />
       <div className={cn(
         "relative w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border-2 bg-background text-foreground border-border",
         maxWidth,
         className
       )}>
        <div className={cn(
          "p-4 px-6 border-b flex items-center justify-between border-border bg-muted/30"
        )}>
          <h3 className="text-lg font-black tracking-tight">{title}</h3>
          {!hideCloseButton && (
            <button 
              onClick={onClose} 
              className="p-2 rounded-full transition-all opacity-50 hover:opacity-100 hover:bg-muted"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className={cn("p-4 px-6 bg-background", bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
};
