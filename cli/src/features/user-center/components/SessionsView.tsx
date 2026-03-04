import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { Button } from '@/components/ui/Button.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { 
  Laptop, Smartphone, Tablet, Monitor, Globe, 
  XCircle, Clock, ShieldCheck, Trash2, CheckSquare, Square
} from 'lucide-react';
import { client } from '@/lib/api.ts';
import { cn } from '@/lib/utils.ts';

import type { components } from '@/types/api.ts';

type Session = components["schemas"]["UserSession"];
type SessionListData = components["schemas"]["SessionListResponse"];

export const SessionsView = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [limitInfo, setLimitInfo] = useState({ total: 0, max: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const { data: res } = await client.GET('/api/v1/users/auth/sessions');
      if (res?.success && res.data) {
        const sessionData = res.data as SessionListData;
        setSessions(sessionData.sessions || []);
        setLimitInfo({ total: sessionData.total, max: sessionData.max_devices });
      }
    } catch (e: unknown) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleLogout = async (id: string) => {
    if (!confirm(t('sessions.revokeConfirm'))) return;
    try {
      await client.DELETE('/api/v1/users/auth/sessions/{session_id}', {
        params: { path: { session_id: id } }
      });
      fetchSessions();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const handleBatchLogout = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${t('sessions.revokeConfirm')} (${selectedIds.size})`)) return;
    
    try {
      await client.POST('/api/v1/users/auth/sessions/batch-delete', {
        body: { session_ids: Array.from(selectedIds) }
      });
      setSelectedIds(new Set());
      fetchSessions();
    } catch (e) { console.error(e); }
  };

  const getDeviceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('phone') || n.includes('iphone') || n.includes('android')) return <Smartphone size={20} />;
    if (n.includes('pad') || n.includes('tablet')) return <Tablet size={20} />;
    if (n.includes('window') || n.includes('linux') || n.includes('mac')) return <Monitor size={20} />;
    return <Laptop size={20} />;
  };

  const usagePercent = useMemo(() => {
    if (limitInfo.max === 0) return 0;
    return Math.min(Math.round((limitInfo.total / limitInfo.max) * 100), 100);
  }, [limitInfo]);

  if (loading) return <div className="h-64 flex items-center justify-center opacity-50 font-black tracking-widest">{t('sessions.loading')}</div>;

  return (
    <div className="space-y-10">
      {/* Session Stats Header */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-xl overflow-hidden relative group">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shadow-inner">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">{t('sessions.activeDeviceStatus')}</h3>
            </div>
            <div className="space-y-2 max-w-md">
              <div className="flex justify-between text-sm font-black uppercase tracking-widest opacity-40">
                <span>{t('sessions.slotsOccupied')}</span>
                <span className={cn(usagePercent > 80 ? "text-red-500" : "text-primary")}>{limitInfo.total} / {limitInfo.max}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000", usagePercent > 80 ? "bg-red-500" : "bg-primary")} 
                  style={{ width: `${usagePercent}%` }} 
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 shrink-0">
            <Button 
              variant="outline" 
              className={cn("h-14 px-8 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all", selectedIds.size === 0 && "opacity-20 pointer-events-none")}
              onClick={handleBatchLogout}
            >
              <Trash2 size={18} className="mr-2" /> {t('sessions.revokeAccess')} ({selectedIds.size})
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sessions.map(session => (
          <div 
            key={session.id} 
            className={cn(
              "flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] border transition-all cursor-pointer group",
              session.is_current ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]',
              selectedIds.has(session.id) && "border-primary bg-primary/5"
            )}
            onClick={() => !session.is_current && toggleSelect(session.id)}
          >
            <div className="flex items-center gap-6 mb-4 md:mb-0">
              <div className="relative">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                  session.is_current ? 'bg-primary text-white' : 'bg-white/5 group-hover:bg-white/10'
                )}>
                  {getDeviceIcon(session.device_name || '')}
                </div>
                {!session.is_current && (
                  <div className="absolute -top-2 -left-2 bg-zinc-900 rounded-lg p-1 border border-white/10">
                    {selectedIds.has(session.id) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="opacity-20" />}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-bold">{session.device_name || t('sessions.unknownDevice')}</h4>
                  {session.is_current && <Badge variant="success">{t('sessions.current')}</Badge>}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm font-mono font-black opacity-40 uppercase tracking-tighter">
                  <span className="flex items-center gap-1"><Globe size={18} /> {session.ip_address}</span>
                  <span className="flex items-center gap-1"><Clock size={18} /> {t('sessions.lastActive')}: {mounted ? new Date(session.last_accessed_at).toLocaleString() : '...'}</span>
                </div>
              </div>
            </div>

            {!session.is_current && (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="text-red-500/40 hover:text-red-500 hover:bg-red-500/10 p-2 h-12 w-12 rounded-xl"
                  onClick={(e) => { e.stopPropagation(); handleLogout(session.id); }}
                >
                  <XCircle size={20} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] mt-10 flex items-start gap-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h5 className="text-blue-400 font-black text-sm uppercase tracking-[0.2em] mb-2">{t('sessions.adviceTitle')}</h5>
          <p className="text-sm font-medium opacity-60 leading-relaxed italic">
            {t('sessions.adviceDesc')}
          </p>
        </div>
      </div>
    </div>
  );
};
