import { useEffect, useState } from 'react';
import {
  Users as UsersIcon, Edit3, Trash2, X, Save, Shield, ShieldOff, User,
  KeyRound, UserPlus, Eye, EyeOff, CheckCircle, AlertCircle,
  ScrollText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { usersApi } from '@/lib/api';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  capacity: number;
  used_capacity: number;
  status: string;
  totp_enabled?: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  operator_id: string;
  operator_name: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  detail: string;
  created_at: string;
}

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: '弱', color: 'bg-red-500' };
  if (score <= 4) return { score, label: '中', color: 'bg-yellow-500' };
  return { score, label: '强', color: 'bg-green-500' };
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// Toast notification
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${
      type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
    }`}>
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Edit user
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editCapacity, setEditCapacity] = useState(0);
  const [editStatus, setEditStatus] = useState('');

  // Add user
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');

  // Reset password
  const [resetUser, setResetUser] = useState<UserData | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Audit logs
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getUsers();
      const data = res.data.data;
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch {
      // silently fail
    }
    setIsLoading(false);
  };

  const fetchLogs = async (page = 1) => {
    try {
      const res = await usersApi.getAuditLogs({ page, limit: 15 });
      const data = res.data.data;
      setLogs(data?.logs || []);
      setLogTotalPages(data?.pagination?.totalPages || 1);
      setLogPage(page);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openEdit = (user: UserData) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditCapacity(user.capacity);
    setEditStatus(user.status);
  };

  const handleSave = async () => {
    if (!editUser) return;
    try {
      await usersApi.updateUser(editUser.id, {
        role: editRole,
        capacity: editCapacity,
        status: editStatus,
      });
      setEditUser(null);
      setToast({ message: '用户信息已更新', type: 'success' });
      fetchUsers();
    } catch {
      setToast({ message: '更新失败', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersApi.deleteUser(id);
      setConfirmDelete(null);
      setToast({ message: '用户已删除', type: 'success' });
      fetchUsers();
    } catch {
      setToast({ message: '删除失败', type: 'error' });
    }
  };

  const handleAddUser = async () => {
    if (!newName || !newPassword) {
      setToast({ message: '用户名和密码为必填项', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ message: '密码至少需要8位字符', type: 'error' });
      return;
    }
    try {
      await usersApi.createUser({ name: newName, email: newEmail, password: newPassword, role: newRole });
      setShowAddUser(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setToast({ message: '用户创建成功', type: 'success' });
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || '创建失败';
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPassword.length < 8) {
      setToast({ message: '密码至少需要8位字符', type: 'error' });
      return;
    }
    if (resetPassword !== resetConfirm) {
      setToast({ message: '两次输入的密码不一致', type: 'error' });
      return;
    }
    try {
      await usersApi.resetPassword(resetUser.id, resetPassword);
      setResetUser(null);
      setResetPassword('');
      setResetConfirm('');
      setShowResetPw(false);
      setToast({ message: '密码重置成功', type: 'success' });
    } catch {
      setToast({ message: '重置密码失败', type: 'error' });
    }
  };

  const handleReset2fa = async (id: string) => {
    if (!confirm('确定要重置该用户的双因素认证吗？')) return;
    try {
      await usersApi.reset2fa(id);
      setToast({ message: '2FA已重置', type: 'success' });
      fetchUsers();
    } catch {
      setToast({ message: '重置2FA失败', type: 'error' });
    }
  };

  const openLogs = () => {
    setShowLogs(true);
    fetchLogs(1);
  };

  const actionLabel: Record<string, string> = {
    create_user: '创建用户',
    reset_password: '重置密码',
    reset_2fa: '重置2FA',
    update_user: '更新用户',
    delete_user: '删除用户',
  };

  const pwStrength = getPasswordStrength(resetPassword || newPassword);

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">用户管理</h1>
        <div className="flex items-center gap-2">
          <button onClick={openLogs} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ScrollText size={14} /> 操作日志
          </button>
          <button onClick={() => setShowAddUser(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <UserPlus size={14} /> 添加用户
          </button>
        </div>
      </div>

      {/* User table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
          <UsersIcon size={48} className="mb-4" />
          <p className="text-lg">暂无用户</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-border text-left text-xs text-th-text-ter">
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">存储用量</th>
                <th className="px-4 py-3">注册时间</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const usedPercent = u.capacity > 0 ? Math.min(Math.round((u.used_capacity / u.capacity) * 100), 100) : 0;
                return (
                  <tr key={u.id} className="border-b border-th-border/50 text-sm">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-th-accent-bg text-xs font-bold text-th-accent">
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-th-text">{u.name}</p>
                          <p className="text-xs text-th-text-ter">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        u.role === 'admin' ? 'bg-amber-500/10 text-amber-400' : 'bg-th-accent-bg text-th-accent'
                      }`}>
                        {u.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                        {u.role === 'admin' ? '管理员' : '用户'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="mb-1 flex justify-between text-xs text-th-text-ter">
                          <span>{formatSize(u.used_capacity)}</span>
                          <span>{formatSize(u.capacity)}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{ width: `${usedPercent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-th-text-ter">
                      {new Date(u.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        u.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {u.status === 'active' ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        u.totp_enabled ? 'bg-green-500/10 text-green-400' : 'bg-th-badge-bg text-th-text-ter'
                      }`}>
                        {u.totp_enabled ? '已启用' : '未启用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-th-text-ter hover:text-th-accent" title="编辑">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => { setResetUser(u); setShowResetPw(true); }} className="text-th-text-ter hover:text-amber-400" title="重置密码">
                          <KeyRound size={16} />
                        </button>
                        {u.totp_enabled && (
                          <button onClick={() => handleReset2fa(u.id)} className="text-th-text-ter hover:text-orange-400" title="重置2FA">
                            <ShieldOff size={16} />
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(u.id)} className="text-th-text-ter hover:text-red-400" title="删除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add user modal */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">添加用户</h3>
              <button onClick={() => setShowAddUser(false)} className="text-th-text-ter hover:text-th-text"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">用户名 <span className="text-red-400">*</span></label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="input-dark" placeholder="输入用户名" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">邮箱</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input-dark" placeholder="可选" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">密码 <span className="text-red-400">*</span></label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-dark" placeholder="至少8位字符" />
                {newPassword && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-th-text-ter">密码强度</span>
                      <span className={pwStrength.score >= 5 ? 'text-green-400' : pwStrength.score >= 3 ? 'text-yellow-400' : 'text-red-400'}>{pwStrength.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-th-bg-sec">
                      <div className={`h-full rounded-full transition-all ${pwStrength.color}`} style={{ width: `${(pwStrength.score / 6) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-th-text-ter">
                      <span className={newPassword.length >= 8 ? 'text-green-400' : ''}>8+字符</span>
                      <span className={/[a-z]/.test(newPassword) ? 'text-green-400' : ''}>小写字母</span>
                      <span className={/[A-Z]/.test(newPassword) ? 'text-green-400' : ''}>大写字母</span>
                      <span className={/[0-9]/.test(newPassword) ? 'text-green-400' : ''}>数字</span>
                      <span className={/[^a-zA-Z0-9]/.test(newPassword) ? 'text-green-400' : ''}>特殊符号</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">角色</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="input-dark">
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <button onClick={handleAddUser} className="btn-primary flex w-full items-center justify-center gap-2">
                <UserPlus size={16} /> 创建用户
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && showResetPw && (
        <div className="modal-overlay" onClick={() => { setResetUser(null); setShowResetPw(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">重置密码</h3>
              <button onClick={() => { setResetUser(null); setShowResetPw(false); }} className="text-th-text-ter hover:text-th-text"><X size={20} /></button>
            </div>
            <p className="mb-4 text-sm text-th-text-ter">
              为用户 <span className="font-medium text-th-text">{resetUser.name}</span> 设置新密码
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">新密码 <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    className="input-dark pr-10"
                    placeholder="至少8位字符"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPw(!showResetPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-th-text-ter hover:text-th-text"
                  >
                    {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {resetPassword && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-th-text-ter">密码强度</span>
                      <span className={pwStrength.score >= 5 ? 'text-green-400' : pwStrength.score >= 3 ? 'text-yellow-400' : 'text-red-400'}>{pwStrength.label}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-th-bg-sec">
                      <div className={`h-full rounded-full transition-all ${pwStrength.color}`} style={{ width: `${(pwStrength.score / 6) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-th-text-ter">
                      <span className={resetPassword.length >= 8 ? 'text-green-400' : ''}>8+字符</span>
                      <span className={/[a-z]/.test(resetPassword) ? 'text-green-400' : ''}>小写字母</span>
                      <span className={/[A-Z]/.test(resetPassword) ? 'text-green-400' : ''}>大写字母</span>
                      <span className={/[0-9]/.test(resetPassword) ? 'text-green-400' : ''}>数字</span>
                      <span className={/[^a-zA-Z0-9]/.test(resetPassword) ? 'text-green-400' : ''}>特殊符号</span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">确认密码 <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  className="input-dark"
                  placeholder="再次输入密码"
                />
                {resetConfirm && resetPassword !== resetConfirm && (
                  <p className="mt-1 text-xs text-red-400">两次输入的密码不一致</p>
                )}
              </div>
              <button
                onClick={handleResetPassword}
                disabled={!resetPassword || resetPassword.length < 8 || resetPassword !== resetConfirm}
                className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound size={16} /> 重置密码
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">编辑用户</h3>
              <button onClick={() => setEditUser(null)} className="text-th-text-ter hover:text-th-text"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">角色</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="input-dark">
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">存储容量 (字节)</label>
                <input type="number" value={editCapacity} onChange={e => setEditCapacity(Number(e.target.value))} className="input-dark" />
                <p className="mt-1 text-xs text-th-text-ter">当前: {formatSize(editCapacity)}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">状态</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="input-dark">
                  <option value="active">正常</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>
              <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2">
                <Save size={16} /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除该用户吗？该用户的所有图片也将被删除。此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary px-4">取消</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger px-4">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Audit logs modal */}
      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">操作日志</h3>
              <button onClick={() => setShowLogs(false)} className="text-th-text-ter hover:text-th-text"><X size={20} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="py-10 text-center text-th-text-ter">暂无操作日志</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-th-border text-left text-xs text-th-text-ter">
                      <th className="px-3 py-2">时间</th>
                      <th className="px-3 py-2">操作人</th>
                      <th className="px-3 py-2">操作</th>
                      <th className="px-3 py-2">对象</th>
                      <th className="px-3 py-2">详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-th-border/30 text-xs">
                        <td className="px-3 py-2 text-th-text-ter whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-3 py-2 text-th-text">{log.operator_name}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-th-accent-bg px-1.5 py-0.5 text-th-accent">
                            {actionLabel[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-th-text">{log.target_name}</td>
                        <td className="px-3 py-2 text-th-text-ter">{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {logTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => fetchLogs(logPage - 1)}
                  disabled={logPage <= 1}
                  className="btn-secondary text-xs disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-th-text-ter">{logPage} / {logTotalPages}</span>
                <button
                  onClick={() => fetchLogs(logPage + 1)}
                  disabled={logPage >= logTotalPages}
                  className="btn-secondary text-xs disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
