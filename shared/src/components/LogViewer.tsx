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
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/10', 
    borderColor: 'border-blue-500/30',
    icon: 'ℹ'
  },
  WARN: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/10', 
    borderColor: 'border-amber-500/30',
    icon: '⚠'
  },
  ERROR: { 
    color: 'text-rose-400', 
    bgColor: 'bg-rose-500/10', 
    borderColor: 'border-rose-500/30',
    icon: '✖'
  },
  DEBUG: { 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/10', 
    borderColor: 'border-emerald-500/30',
    icon: '◆'
  },
  TRACE: { 
    color: 'text-slate-400', 
    bgColor: 'bg-slate-500/10', 
    borderColor: 'border-slate-500/30',
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

  return (
    <div className={`flex flex-col bg-[#0d1117] border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-900/90 to-slate-800/60 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Terminal size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
              <span>{logs.length} entries</span>
              {logs.length > 0 && (
                <>
                  <span className="text-slate-700 font-black">•</span>
                  <span className="text-blue-400">{levelCounts.INFO || 0} info</span>
                  <span className="text-amber-400">{levelCounts.WARN || 0} warn</span>
                  <span className="text-rose-400">{levelCounts.ERROR || 0} error</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSearch(!showSearch)} className={`p-2 rounded-lg transition-all ${showSearch ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <Search size={18} />
          </button>
          <button onClick={() => setAutoScroll(!autoScroll)} className={`p-2 rounded-lg transition-all ${autoScroll ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            <Scroll size={18} />
          </button>
          <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded-lg transition-all ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all relative">
            <Copy size={18} />
            {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-emerald-500 text-white text-sm font-bold rounded shadow-lg whitespace-nowrap">Copied!</span>}
          </button>
          <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"><Download size={18} /></button>
          {onClear && <button onClick={onClear} className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"><Trash2 size={18} /></button>}
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all">
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="px-5 py-2.5 bg-slate-900/50 border-b border-slate-800/60">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-9 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><X size={18} /></button>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-4 py-2 bg-slate-900/30 border-b border-slate-800/60 overflow-x-auto">
        <Filter size={18} className="text-slate-600 mr-1.5 shrink-0" />
        {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'] as const).map((level) => (
          <button key={level} onClick={() => setFilterLevel(level)} className={`px-2.5 py-1 rounded-md text-sm font-bold transition-all tracking-wide ${filterLevel === level ? level === 'ALL' ? 'bg-slate-700 text-slate-200' : `${LEVEL_CONFIG[level].bgColor} ${LEVEL_CONFIG[level].color}` : 'text-slate-500 hover:text-slate-300'}`}>{level}</button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={`overflow-auto font-mono text-sm leading-relaxed ${isExpanded ? 'h-[600px]' : ''}`}
        style={{ background: '#0d1117', ...(isExpanded ? {} : { maxHeight }) }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 py-8">
            <Terminal size={40} className="mb-3 opacity-20" />
            <span className="text-sm font-medium">{searchQuery ? 'No matching logs' : 'No logs yet'}</span>
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {filteredLogs.map((log) => {
              const config = LEVEL_CONFIG[log.level];
              return (
                <div key={log.id} className="group flex items-start gap-2.5 py-1 px-2.5 rounded hover:bg-white/5 transition-colors">
                  <span className="text-slate-600 shrink-0 select-none font-medium">{formatTime(log.timestamp)}</span>
                  <span className={`shrink-0 px-1.5 py-0 rounded text-sm font-black tracking-tighter ${config.bgColor} ${config.color} min-w-[44px] text-center border ${config.borderColor}`}>{log.level}</span>
                  {log.source && <span className="text-cyan-400/80 shrink-0 max-w-[100px] truncate font-bold">[{log.source}]</span>}
                  <span className={`break-all ${log.level === 'ERROR' ? 'text-rose-300' : log.level === 'WARN' ? 'text-amber-300' : 'text-slate-300'} font-medium`}>{log.message}</span>
                </div>
              );
            })}
            {isPaused && <div className="sticky bottom-3 left-0 right-0 flex justify-center"><span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-bold rounded-full shadow-lg backdrop-blur-md border border-amber-500/30">⏸ Log updates paused</span></div>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/50 border-t border-slate-800/60 text-sm text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />{isPaused ? 'Paused' : 'Live'}</span>
          <span className="text-slate-800">|</span>
          <span>Showing {filteredLogs.length} of {logs.length}</span>
        </div>
      </div>
    </div>
  );
}
