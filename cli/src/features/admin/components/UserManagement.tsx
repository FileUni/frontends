import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useToastStore } from '@fileuni/shared';
import { Button } from '@/components/ui/Button.tsx';
import { Input } from '@/components/ui/Input.tsx';
import { Modal } from '@/components/ui/Modal.tsx';
import { Badge } from '@/components/ui/Badge.tsx';
import { Switch } from '@/components/ui/Switch.tsx';
import { Pagination } from '@/components/common/Pagination.tsx';
import { 
  Users, UserPlus, Search,
  Edit3, Trash2, ShieldAlert,
  Calendar, RefreshCw,
  RotateCcw, Key, Eye, EyeOff,
  AlertCircle
} from 'lucide-react';
import { client } from '@/lib/api.ts';
import type { components } from '@/types/api.ts';
import { cn } from '@/lib/utils.ts';
import { fetchRolesAndPermissions, type RolePermissionView } from './roleApi';

type UserResponse = components["schemas"]["UserResponse"];

export const UserManagement = () => {
  const { t } = useTranslation();
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [roles, setRoles] = useState<RolePermissionView[]>([]);

  // Modals state
  const [resetPwdUser, setResetPwdUser] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [deleteUser, setDeleteUser] = useState<UserResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPasswordMismatch = newPassword !== '' && confirmPassword !== '' && newPassword !== confirmPassword;

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, includeDeleted]);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchRolesAndPermissions();
        setRoles(data.roles);
      } catch (error) {
        console.error(error);
      }
    };
    void loadRoles();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: res } = await client.GET('/api/v1/users/admin/users', {
        params: {
          query: {
            page,
            page_size: pageSize,
            include_deleted: includeDeleted,
            keyword: search || undefined
          }
        }
      });
      // The response structure might vary depending on Resp<T> wrapper
      // Based on handler: { users: ..., total: ..., page: ... }
      if (res?.success && res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
      } else if (res?.users) {
        // Fallback if not wrapped or wrapped differently
        setUsers(res.users);
        setTotal(res.total || res.users.length);
      }
    } catch (e) { 
      console.error(e);
      addToast(t('admin.users.fetchError'), 'error');
    }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setIsDeleting(true);
    try {
      await client.DELETE('/api/v1/users/admin/users/{user_id}', {
        params: { path: { user_id: deleteUser.id } }
      });
      addToast(t('admin.users.deleteSuccess'), 'success');
      setDeleteUser(null);
      fetchUsers();
    } catch (e) {
      /* Handled by interceptor */
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (user: UserResponse) => {
    try {
      await client.POST('/api/v1/users/admin/users/{user_id}/restore', {
        params: { path: { user_id: user.id } }
      });
      addToast(t('admin.users.restoreSuccess'), 'success');
      fetchUsers();
    } catch (e) {
      /* Handled */
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdUser || newPassword !== confirmPassword || newPassword.length < 6) return;
    setIsResetting(true);
    try {
      await client.POST('/api/v1/users/admin/users/{user_id}/reset-password', {
        params: { path: { user_id: resetPwdUser.id } },
        body: { new_password: newPassword }
      });
      addToast(t('admin.users.resetPwdSuccess'), 'success');
      setResetPwdUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      /* Handled */
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusBadge = (user: UserResponse) => {
    // Determine status from user object
    // user.status might be an object or string depending on SeaORM serialize
    const status = typeof user.status === 'object' ? Object.keys(user.status)[0].toLowerCase() : String(user.status).toLowerCase();
    
    if (user.is_deleted) return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">{t('admin.users.status.deleted')}</Badge>;
    
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 whitespace-nowrap">{t('admin.users.status.active')}</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 whitespace-nowrap">{t('admin.users.status.inactive')}</Badge>;
      case 'banned':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">{t('admin.users.status.banned')}</Badge>;
      default:
        return <Badge variant="outline" className="whitespace-nowrap">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-4 min-w-0 w-full xl:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner shrink-0">
            <Users size={24} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight truncate">{t('admin.users.title')}</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0" />
              <p className="text-sm font-bold opacity-40 uppercase tracking-widest truncate">
                {total} {t('admin.users.table.user')} Total
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-80 min-w-[200px] group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-all" size={18} />
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder={t('admin.users.searchPlaceholder')} 
              className="pl-12 h-12"
            />
          </form>
          <div className="flex items-center gap-2 px-4 rounded-xl bg-white/5 border border-white/5 h-12 shrink-0">
            <span className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.users.showDeleted')}</span>
            <Switch checked={includeDeleted} onChange={setIncludeDeleted} />
          </div>
          <Button className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 shrink-0" onClick={() => window.location.hash = 'mod=admin&page=user-create'}>
            <UserPlus size={18} className="mr-2" />
            <span className="hidden sm:inline">{t('admin.users.addUser')}</span>
          </Button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.users.table.user')}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.users.table.role')}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.users.table.status')}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30">{t('admin.users.table.created')}</th>
                <th className="px-8 py-6 text-sm font-black uppercase tracking-widest opacity-30 text-right">{t('admin.users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <RefreshCw className="animate-spin" size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.loading')}</p>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <Users size={32} />
                      <p className="text-sm font-black uppercase tracking-widest">{t('admin.users.noUsers')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className={cn(
                    "border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group",
                    user.is_deleted && "opacity-60 grayscale-[0.5]"
                  )}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 font-black text-sm group-hover:border-primary/30 transition-colors">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{user.username}</p>
                          <p className="text-sm font-mono opacity-30 tracking-tighter">{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {(() => {
                        const roleName = roles.find((role) => role.role_id === user.role_id)?.name;
                        return (
                      <span className={cn(
                        "px-3 py-1 rounded-full text-sm font-black uppercase whitespace-nowrap border",
                        user.role_id === 0 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {roleName || (user.role_id === 0 ? t('admin.users.roles.admin') : `${t('admin.users.roles.user')} #${user.role_id}`)}
                      </span>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold opacity-40 uppercase">
                        <Calendar size={18} />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {user.is_deleted ? (
                          <button 
                            onClick={() => handleRestore(user)}
                            title={t('admin.users.restore')}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-green-500 hover:text-white transition-all hover:border-green-500 shadow-inner"
                          >
                            <RotateCcw size={16} />
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => setResetPwdUser(user)}
                              title={t('admin.users.resetPassword')}
                              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-yellow-500 hover:text-white transition-all hover:border-yellow-500 shadow-inner"
                            >
                              <Key size={16} />
                            </button>
                            <button 
                              onClick={() => window.location.hash = `mod=admin&page=user-edit&id=${user.id}`}
                              title={t('admin.users.edit')}
                              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-primary hover:text-white transition-all hover:border-primary shadow-inner"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => setDeleteUser(user)}
                              title={t('admin.users.delete')}
                              className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500 hover:text-white transition-all hover:border-red-500 shadow-inner"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
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
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          className="bg-background/50 backdrop-blur-md"
        />
      </div>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPwdUser}
        onClose={() => {
          setResetPwdUser(null);
          setShowPassword(false);
          setNewPassword('');
          setConfirmPassword('');
        }}
        title={t('admin.users.resetPassword')}
      >
        <div className="space-y-6">
          <p className="text-sm opacity-60">
            {t('admin.users.resetPwdConfirm', { username: resetPwdUser?.username })}
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.users.newPassword')}</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('common.passwordPlaceholder')}
                  className={cn(isPasswordMismatch && "border-red-500/50 focus:border-red-500")}
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-all"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black uppercase tracking-widest opacity-40">{t('admin.users.confirmPassword')}</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('common.passwordPlaceholder')}
                  className={cn(isPasswordMismatch && "border-red-500/50 focus:border-red-500")}
                />
              </div>
              {isPasswordMismatch && (
                <div className="flex items-center gap-2 text-red-500 mt-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">{t('common.passwordMismatch')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setResetPwdUser(null)}>{t('common.cancel')}</Button>
            <Button 
              disabled={isResetting || newPassword !== confirmPassword || newPassword.length < 6}
              onClick={handleResetPassword}
            >
              {isResetting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Key size={16} className="mr-2" />}
              {t('admin.users.resetPassword')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title={t('admin.users.deleteUser')}
      >
        <div className="space-y-6">
          {deleteUser?.role_id === 0 && (
            <div className="p-4 rounded-2xl bg-red-600/20 border border-red-500/50 text-red-500 animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={20} />
                <span className="font-black uppercase text-sm tracking-widest">{t('admin.users.roles.admin')}</span>
              </div>
              <p className="text-sm font-bold leading-relaxed">
                {t('admin.users.deleteAdminWarning')}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            <AlertCircle size={24} className="text-primary opacity-50" />
            <p className="text-sm font-bold">
              {t('admin.users.deleteConfirm', { username: deleteUser?.username })}
            </p>
          </div>
          
          <p className="text-sm opacity-40 uppercase tracking-widest font-black px-1">
            {t('admin.users.deleteWarning')}
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>{t('common.cancel')}</Button>
            <Button 
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
              className="shadow-lg shadow-red-500/20"
            >
              {isDeleting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Trash2 size={16} className="mr-2" />}
              {t('admin.users.confirmDelete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
