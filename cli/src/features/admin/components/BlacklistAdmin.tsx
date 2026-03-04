import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Pagination } from '@/components/common/Pagination.tsx';
import { 
  ShieldX, UserX, MonitorOff, 
  Trash2, Plus, RefreshCw,
  Calendar, Info, ShieldCheck
} from 'lucide-react';
import { client, handleApiError } from '@/lib/api.ts';
import { cn } from '@/lib/utils.ts';
import type { components } from '@/types/api.ts';

type BlacklistItemResponse = components["schemas"]["BlacklistItemResponse"];

export const BlacklistAdmin = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BlacklistItemResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Filters
  const [guardType, setGuardType] = useState<string>('blacklist');
  const [blacklistType] = useState<string | null>(null);
  
  // Add Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newGuardType, setNewGuardType] = useState('blacklist');
  const [newBlacklistType, setNewBlacklistType] = useState('ip');
  const [newValue, setNewValue] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Delete State
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetchBlacklist();
  }, [page, pageSize, guardType, blacklistType]);

  const fetchBlacklist = async () => {
    setLoading(true);
    try {
      const { data: res } = await client.GET('/api/v1/users/admin/blacklist', {
        params: {
          query: {
            page,
            page_size: pageSize,
            guard_type: guardType || undefined,
            blacklist_type: blacklistType || undefined
          }
        }
      });
      
      if (res?.success && res.data) {
        setItems(res.data.items);
        setTotal(res.data.total);
      }
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setIsAdding(true);
    try {
      const { data: res } = await client.POST('/api/v1/users/admin/blacklist', {
        body: {
          guard_type: newGuardType,
          blacklist_type: newBlacklistType,
          value: newValue.trim(),
          reason: newReason.trim() || undefined,
          expires_at: newExpiresAt || undefined
        }
      });
      
      if (res?.success) {
        addToast(t('admin.blacklist.addSuccess') || 'Added successfully', 'success');
        setIsAddModalOpen(false);
        setNewValue('');
        setNewReason('');
        setNewExpiresAt('');
        fetchBlacklist();
      }
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (item: BlacklistItemResponse) => {
    setIsDeleting(item.id);
    try {
      const { data: res } = await client.DELETE('/api/v1/users/admin/blacklist', {
        body: {
          guard_type: item.guard_type,
          blacklist_type: item.blacklist_type,
          value: item.value
        }
      });
      
      if (res?.success) {
        addToast(t('admin.blacklist.removeSuccess') || 'Removed successfully', 'success');
        fetchBlacklist();
      }
    } catch (e) {
      addToast(handleApiError(e, t), 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ip': return <RefreshCw size={18} />;
      case 'user_id': return <UserX size={18} />;
      case 'client_id': return <MonitorOff size={18} />;
      default: return <Info size={18} />;
    }
  };

  const getGuardBadge = (type: string) => {
    if (type === 'high_risk') {
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 uppercase font-black text-[14px] tracking-widest">{t('admin.blacklist.highRisk') || 'High Risk'}</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 uppercase font-black text-[14px] tracking-widest">{t('admin.blacklist.blacklisted') || 'Blacklisted'}</Badge>;
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
            <ShieldX size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t('admin.blacklist.title') || 'Access Guard'}</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest">
                {total} {t('admin.blacklist.totalEntries') || 'Security Constraints Active'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setGuardType('blacklist')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all",
                guardType === 'blacklist' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "opacity-40 hover:opacity-100"
              )}
            >
              {t('admin.blacklist.tabBlacklist') || 'Blacklist'}
            </button>
            <button 
              onClick={() => setGuardType('high_risk')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-all",
                guardType === 'high_risk' ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "opacity-40 hover:opacity-100"
              )}
            >
              {t('admin.blacklist.tabHighRisk') || 'High Risk'}
            </button>
          </div>

          <div className="h-12 w-px bg-white/5 hidden md:block mx-2" />

          <Button 
            className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={18} className="mr-2" />
            <span className="font-bold">{t('admin.blacklist.addEntry') || 'Add Constraint'}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <RefreshCw size={20} />
          </div>
          <div>
            <div className="text-sm font-black opacity-30 uppercase tracking-widest">{t('admin.blacklist.stats.ipConstraints') || 'IP Constraints'}</div>
            <div className="text-xl font-bold">{items.filter(i => i.blacklist_type === 'ip').length}</div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <UserX size={20} />
          </div>
          <div>
            <div className="text-sm font-black opacity-30 uppercase tracking-widest">{t('admin.blacklist.stats.userBlocks') || 'User Blocks'}</div>
            <div className="text-xl font-bold">{items.filter(i => i.blacklist_type === 'user_id').length}</div>
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-sm font-black opacity-30 uppercase tracking-widest">{t('admin.blacklist.stats.expiringSoon') || 'Expiring Soon'}</div>
            <div className="text-xl font-bold">{items.filter(i => i.expires_at).length}</div>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.blacklist.table.type') || 'Subject Type'}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.blacklist.table.value') || 'Value / Identifier'}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.blacklist.table.status') || 'Level'}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.blacklist.table.reason') || 'Reason'}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.blacklist.table.expires') || 'Expires At'}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30 text-right">{t('admin.blacklist.table.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <RefreshCw className="animate-spin" size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.loading')}</p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <ShieldCheck size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.blacklist.noEntries') || 'No Security Constraints'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          item.blacklist_type === 'ip' ? "bg-blue-500/10 text-blue-500" :
                          item.blacklist_type === 'user_id' ? "bg-blue-500/10 text-blue-500" :
                          "bg-amber-500/10 text-amber-500"
                        )}>
                          {getTypeIcon(item.blacklist_type)}
                        </div>
                        <span className="text-sm font-black uppercase tracking-wider">{item.blacklist_type}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <code className="bg-black/40 px-3 py-1.5 rounded-xl font-mono text-sm border border-white/5">
                        {item.value}
                      </code>
                    </td>
                    <td className="px-8 py-6">
                      {getGuardBadge(item.guard_type)}
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm opacity-60 max-w-[200px] truncate" title={item.reason || ''}>
                        {item.reason || <span className="opacity-20 italic">{t('blacklist.noReason')}</span>}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold opacity-40 uppercase">
                        <Calendar size={18} />
                        {item.expires_at ? new Date(item.expires_at).toLocaleString() : 'Permanent'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting === item.id}
                        className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-inner disabled:opacity-50"
                      >
                        {isDeleting === item.id ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination 
          current={page}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="bg-black/20"
        />
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t('admin.blacklist.addTitle') || 'Add Security Constraint'}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.blacklist.form.guardLevel') || 'Guard Level'}</label>
              <select 
                value={newGuardType}
                onChange={e => setNewGuardType(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm focus:ring-2 ring-primary/20 outline-none transition-all"
              >
                <option value="blacklist">{t('admin.blacklist.guard.blacklist') || 'Blacklist (Deny Access)'}</option>
                <option value="high_risk">{t('admin.blacklist.guard.highRisk') || 'High Risk (Extra Checks)'}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.blacklist.form.subjectType') || 'Subject Type'}</label>
              <select 
                value={newBlacklistType}
                onChange={e => setNewBlacklistType(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm focus:ring-2 ring-primary/20 outline-none transition-all"
              >
                <option value="ip">{t('admin.blacklist.subjectType.ip') || 'IP Address'}</option>
                <option value="user_id">{t('admin.blacklist.subjectType.userId') || 'User ID (UUID)'}</option>
                <option value="client_id">{t('admin.blacklist.subjectType.clientId') || 'Client ID (Fingerprint)'}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.blacklist.form.identifierValue') || 'Identifier Value'}</label>
            <Input 
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder={t('admin.blacklist.form.identifierPlaceholder') || 'e.g. 192.168.1.1 or user-uuid'}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.blacklist.form.reason') || 'Reason / Note'}</label>
            <Input 
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              placeholder={t('admin.blacklist.form.reasonPlaceholder') || 'Why is this being blocked?'}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.blacklist.form.expiration') || 'Expiration (Optional)'}</label>
            <Input 
              type="datetime-local"
              value={newExpiresAt}
              onChange={e => setNewExpiresAt(e.target.value)}
              className="h-12"
            />
            <p className="text-[14px] opacity-30 italic">{t('admin.blacklist.form.permanentHint') || 'Leave empty for permanent constraint'}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>{t('common.cancel')}</Button>
            <Button 
              disabled={isAdding || !newValue.trim()}
              onClick={handleAdd}
              className="bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
            >
              {isAdding ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
              {t('admin.blacklist.confirmAdd') || 'Apply Constraint'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
