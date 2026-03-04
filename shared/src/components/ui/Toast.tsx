import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useToastStore,
  type ToastType,
  DURATION_MAP,
} from '../../stores/toast';
import { useThemeStore } from '../../stores/theme';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

// Toast i18n context
type ToastI18nContextType = {
  doNotShowAgain: string;
  viewDetails: string;
  hideDetails: string;
  copy: string;
};

const defaultI18n: ToastI18nContextType = {
  doNotShowAgain: 'Do not show again',
  viewDetails: 'View Details',
  hideDetails: 'Hide Details',
  copy: 'Copy',
};

export const ToastI18nContext = React.createContext<ToastI18nContextType>(defaultI18n);

// Get icon
const getIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />;
    case 'error':
      return <AlertCircle size={20} className="text-rose-500 shrink-0" />;
    case 'warning':
      return <AlertCircle size={20} className="text-amber-500 shrink-0" />;
    default:
      return <Info size={20} className="text-blue-500 shrink-0" />;
  }
};

// Get styles
const getToastStyles = (
  type: ToastType,
  isDark: boolean
): { container: string; border: string; bg: string } => {
  switch (type) {
    case 'success':
      return {
        container: isDark ? 'text-emerald-400' : 'text-emerald-600',
        border: isDark ? 'border-emerald-500/20' : 'border-emerald-200',
        bg: isDark ? 'bg-emerald-500/5' : 'bg-emerald-50',
      };
    case 'error':
      return {
        container: isDark ? 'text-rose-400' : 'text-rose-600',
        border: isDark ? 'border-rose-500/20' : 'border-rose-200',
        bg: isDark ? 'bg-rose-500/5' : 'bg-rose-50',
      };
    case 'warning':
      return {
        container: isDark ? 'text-amber-400' : 'text-amber-600',
        border: isDark ? 'border-amber-500/20' : 'border-amber-200',
        bg: isDark ? 'bg-amber-500/5' : 'bg-amber-50',
      };
    default:
      return {
        container: isDark ? 'text-blue-400' : 'text-blue-600',
        border: isDark ? 'border-blue-500/20' : 'border-blue-200',
        bg: isDark ? 'bg-blue-500/5' : 'bg-blue-50',
      };
  }
};

// Single Toast component
const ToastItem: React.FC<{ toastId: string }> = ({ toastId }) => {
  const { toasts, removeToast, toggleDetails, setDoNotShowAndClose } =
    useToastStore();
  const { theme } = useThemeStore();
  const i18n = useContext(ToastI18nContext);
  const toast = toasts.find((t) => t.id === toastId);

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (toast && toast.duration !== 'persistent') {
      const totalDuration = DURATION_MAP[toast.duration];
      const initialTime = Math.ceil(totalDuration / 1000);
      setTimeLeft(initialTime);

      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [toast?.id, toast?.duration]);

  if (!toast) return null;

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const styles = getToastStyles(toast.type, isDark);
  const isPersistent = toast.duration === 'persistent';

  // Copy details to clipboard
  const copyDetails = async () => {
    if (toast.details) {
      await navigator.clipboard.writeText(toast.details);
    }
  };

  // Close and save "do not show again" setting
  const handleClose = async () => {
    removeToast(toast.id);
  };

  return (
    <div
      className={`
        min-w-[360px] max-w-lg rounded-2xl shadow-2xl
        animate-in slide-in-from-right-4 duration-300 border
        ${styles.border}
      `}
      style={{
        backgroundColor: isDark ? '#18181b' : '#ffffff',
      }}
    >
      {/* Main content */}
      <div className="p-4 flex items-start gap-3">
        {getIcon(toast.type)}

        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-sm font-semibold leading-relaxed ${styles.container}`}>
            {toast.message}
          </p>

          {/* Details expansion area */}
          {toast.details && (
            <div className="mt-2">
              <button
                onClick={() => toggleDetails(toast.id)}
                className={`
                  flex items-center gap-1 text-sm font-medium
                  ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}
                  transition-colors
                `}
              >
                {toast.showDetails ? (
                  <>
                    <ChevronUp size={18} />
                    <span>{i18n.hideDetails}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={18} />
                    <span>{i18n.viewDetails}</span>
                  </>
                )}
              </button>

              {toast.showDetails && (
                <div className="mt-2 space-y-2">
                  <div
                    className="p-3 rounded-lg text-sm font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto"
                    style={{
                      backgroundColor: isDark ? '#020617' : '#f1f5f9',
                      color: isDark ? '#cbd5e1' : '#334155',
                    }}
                  >
                    {toast.details}
                  </div>
                  <button
                    onClick={copyDetails}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
                      transition-all hover:scale-105
                      ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}
                    `}
                  >
                    <Copy size={18} />
                    <span>{i18n.copy}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* "Do not show again" option */}
          {toast.showDoNotShowAgain && (
            <button
              onClick={() => setDoNotShowAndClose(toast.id)}
              className={`
                mt-3 text-sm underline underline-offset-2
                ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}
                transition-colors cursor-pointer
              `}
            >
              {i18n.doNotShowAgain}
            </button>
          )}
        </div>

        {/* Right action area */}
        <div className="flex flex-col items-end gap-2">
          {/* Close button */}
          <button
            onClick={handleClose}
            className={`
              p-1.5 rounded-lg transition-all hover:scale-110
              ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'}
            `}
            title="Close"
          >
            <X size={16} />
          </button>

          {/* Duration indicator */}
          <span
            className={`
              flex items-center gap-1 text-sm font-mono px-1.5 py-0.5 rounded
              ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'}
            `}
            title={isPersistent ? 'Will not auto-close' : 'Auto-close after'}
          >
            {!isPersistent && <Clock size={10} className="opacity-70" />}
            {isPersistent ? '∞' : `${timeLeft}s`}
          </span>
        </div>
      </div>
    </div>
  );
};

// Toast container component
export const ToastContainer: React.FC = () => {
  const { toasts } = useToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed right-6 flex flex-col gap-3 pointer-events-none"
      style={{
        top: 'calc(env(safe-area-inset-top) + 1rem)',
        zIndex: 2147483647,
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toastId={toast.id} />
        </div>
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
