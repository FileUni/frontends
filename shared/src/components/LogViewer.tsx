import { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Trash2, 
  Copy, 
  Download, 
  Terminal, 
  X,
  Filter,
  Scroll,
  Pause,
  Play,
  Search,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useThemeStore } from '../stores/theme';
import { cn } from '../lib/utils';

/**
 * 日志级别定义 / Log level definitions
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';

/**
 * 日志条目结构 / Log entry structure
 */
export interface LogEntry {
  id: string;
  timestamp: Date | string;
  level: LogLevel;
  message: string;
  source?: string;
}

const LEVEL_CONFIG: Record<LogLevel, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: string;
}> = {
  INFO: { 
    color: 'text-blue-500 dark:text-blue-400', 
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/10', 
    borderColor: 'border-blue-500/20 dark:border-blue-500/30',
    icon: 'ℹ'
  },
  WARN: { 
    color: 'text-amber-600 dark:text-amber-400', 
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/10', 
    borderColor: 'border-amber-500/20 dark:border-amber-500/30',
    icon: '⚠'
  },
  ERROR: { 
    color: 'text-rose-600 dark:text-rose-400', 
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/10', 
    borderColor: 'border-rose-500/20 dark:border-rose-500/30',
    icon: '✖'
  },
  DEBUG: { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/10', 
    borderColor: 'border-emerald-500/20 dark:border-emerald-500/30',
    icon: '◆'
  },
  TRACE: { 
    color: 'text-slate-500 dark:text-slate-400', 
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/10', 
    borderColor: 'border-slate-500/20 dark:border-slate-500/30',
    icon: '→'
  }
};

interface LogViewerProps {
  logs: LogEntry[];
  maxHeight?: string;
  onClear?: () => void;
  className?: string;
  title?: string;
}

/**
 * 统一日志查看器组件 / Unified Log Viewer Component
 */
export const LogViewer = ({ 
  logs, 
  maxHeight = '320px',
  onClear,
  className = '',
  title = 'System Logs'
}: LogViewerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLogs = logs.filter(log => {
    const levelMatch = filterLevel === 'ALL' || log.level === filterLevel;
    const searchMatch = !searchQuery || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source?.toLowerCase().includes(searchQuery.toLowerCase());
    return levelMatch && searchMatch;
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, isPaused]);

  const handleCopy = useCallback(() => {
    const text = filteredLogs.map(log => 
      `[${formatTime(log.timestamp)}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [filteredLogs]);

  const handleDownload = useCallback(() => {
    const text = filteredLogs.map(log => 
      `[${formatTime(log.timestamp)}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fileuni-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  function formatTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    return dateObj.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  const levelCounts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<LogLevel, number>);

  if (!mounted) return null;

  return (
    <div className={cn(
      "flex flex-col border rounded-2xl overflow-hidden shadow-2xl",
      isDark ? "bg-[#0d1117] border-slate-800/60" : "bg-white border-slate-200",
      className
    )}>
      <div className={cn(
        "flex items-center justify-between px-5 py-3 border-b",
        isDark ? "bg-gradient-to-r from-slate-900/90 to-slate-800/60 border-slate-800/60" : "bg-slate-50 border-slate-200"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Terminal size={18} className="text-white" />
          </div>
          <div>
            <h3 className={cn("text-sm font-bold", isDark ? "text-slate-100" : "text-slate-900")}>{title}</h3>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={isDark ? "text-slate-500" : "text-slate-500"}>{logs.length} entries</span>
              {logs.length > 0 && (
                <>
                  <span className={cn("font-black", isDark ? "text-slate-700" : "text-slate-300")}>•</span>
                  <span className="text-blue-500 dark:text-blue-400">{levelCounts.INFO || 0} info</span>
                  <span className="text-amber-600 dark:text-amber-400">{levelCounts.WARN || 0} warn</span>
                  <span className="text-rose-600 dark:text-rose-400">{levelCounts.ERROR || 0} error</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSearch(!showSearch)} className={cn("p-2 rounded-lg transition-all", 
            showSearch ? (isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700') : (isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'))}>
            <Search size={18} />
          </button>
          <button onClick={() => setAutoScroll(!autoScroll)} className={cn("p-2 rounded-lg transition-all", 
            autoScroll ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'))}>
            <Scroll size={18} />
          </button>
          <button onClick={() => setIsPaused(!isPaused)} className={cn("p-2 rounded-lg transition-all", 
            isPaused ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') : (isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'))}>
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button onClick={handleCopy} className={cn("p-2 rounded-lg transition-all relative", isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800')}>
            <Copy size={18} />
            {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-emerald-500 text-white text-sm font-bold rounded shadow-lg whitespace-nowrap">Copied!</span>}
          </button>
          <button onClick={handleDownload} className={cn("p-2 rounded-lg transition-all", isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800')}><Download size={18} /></button>
          {onClear && <button onClick={onClear} className={cn("p-2 rounded-lg transition-all", isDark ? 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-500 hover:text-rose-600')}><Trash2 size={18} /></button>}
          <button onClick={() => setIsExpanded(!isExpanded)} className={cn("p-2 rounded-lg transition-all", isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800')}>
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className={cn("px-5 py-2.5 border-b", isDark ? "bg-slate-900/50 border-slate-800/60" : "bg-slate-50 border-slate-200")}>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search logs..." 
              className={cn(
                "w-full border rounded-lg pl-10 pr-9 py-2 text-sm focus:outline-none transition-colors",
                isDark ? "bg-slate-950 border-slate-800 text-slate-300 placeholder:text-slate-600 focus:border-cyan-500/50" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-cyan-500"
              )} 
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><X size={18} /></button>}
          </div>
        </div>
      )}

      <div className={cn("flex items-center gap-1 px-4 py-2 border-b overflow-x-auto", isDark ? "bg-slate-900/30 border-slate-800/60" : "bg-slate-50/50 border-slate-200")}>
        <Filter size={18} className="text-slate-500 mr-1.5 shrink-0" />
        {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'] as const).map((level) => (
          <button 
            key={level} 
            onClick={() => setFilterLevel(level)} 
            className={cn(
              "px-2.5 py-1 rounded-md text-sm font-bold transition-all tracking-wide",
              filterLevel === level 
                ? level === 'ALL' 
                  ? (isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-800')
                  : `${LEVEL_CONFIG[level].bgColor} ${LEVEL_CONFIG[level].color}` 
                : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')
            )}
          >
            {level}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "overflow-auto font-mono text-sm leading-relaxed",
          isDark ? "text-slate-300" : "text-slate-800",
          isExpanded ? 'h-[600px]' : ''
        )}
        style={{ 
          backgroundColor: isDark ? '#0d1117' : '#ffffff', 
          ...(isExpanded ? {} : { maxHeight }) 
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
            <Terminal size={40} className="mb-3 opacity-20" />
            <span className="text-sm font-medium">{searchQuery ? 'No matching logs' : 'No logs yet'}</span>
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {filteredLogs.map((log) => {
              const config = LEVEL_CONFIG[log.level];
              return (
                <div key={log.id} className={cn("group flex items-start gap-2.5 py-1 px-2.5 rounded transition-colors", isDark ? "hover:bg-white/5" : "hover:bg-slate-100")}>
                  <span className={cn("shrink-0 select-none font-medium", isDark ? "text-slate-600" : "text-slate-400")}>{formatTime(log.timestamp)}</span>
                  <span className={cn(
                    "shrink-0 px-1.5 py-0 rounded text-sm font-black tracking-tighter min-w-[44px] text-center border",
                    config.bgColor, config.color, config.borderColor
                  )}>
                    {log.level}
                  </span>
                  {log.source && <span className="text-cyan-600 dark:text-cyan-400/80 shrink-0 max-w-[100px] truncate font-bold">[{log.source}]</span>}
                  <span className={cn(
                    "break-all font-medium",
                    log.level === 'ERROR' ? 'text-rose-600 dark:text-rose-300' : 
                    log.level === 'WARN' ? 'text-amber-600 dark:text-amber-300' : 
                    isDark ? 'text-slate-300' : 'text-slate-800'
                  )}>
                    {log.message}
                  </span>
                </div>
              );
            })}
            {isPaused && <div className="sticky bottom-3 left-0 right-0 flex justify-center"><span className="px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-bold rounded-full shadow-lg backdrop-blur-md border border-amber-500/30">⏸ Log updates paused</span></div>}
          </div>
        )}
      </div>

      <div className={cn("flex items-center justify-between px-5 py-2.5 border-t text-sm font-medium", isDark ? "bg-slate-900/50 border-slate-800/60 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-600")}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse')} />{isPaused ? 'Paused' : 'Live'}</span>
          <span className={isDark ? "text-slate-800" : "text-slate-300"}>|</span>
          <span>Showing {filteredLogs.length} of {logs.length}</span>
        </div>
      </div>
    </div>
  );
}
