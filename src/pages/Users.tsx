import { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Edit3,
  Trash2,
  X,
  Save,
  Shield,
  User,
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
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editCapacity, setEditCapacity] = useState(0);
  const [editStatus, setEditStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
      fetchUsers();
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersApi.deleteUser(id);
      setConfirmDelete(null);
      fetchUsers();
    } catch {
      // silently fail
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">用户管理</h1>
        <span className="text-sm text-th-text-ter">共 {users.length} 位用户</span>
      </div>

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
                        u.role === 'admin' ? 'bg-th-badge-bg text-th-badge-text' : 'bg-th-badge-bg text-th-badge-text'
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
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-th-text-ter hover:text-th-accent">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => setConfirmDelete(u.id)} className="text-th-text-ter hover:text-red-400">
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

      {/* Edit modal */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">编辑用户</h3>
              <button onClick={() => setEditUser(null)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">角色</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="input-dark">
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">存储容量 (字节)</label>
                <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(Number(e.target.value))} className="input-dark" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">状态</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="input-dark">
                  <option value="active">正常</option>
                  <option value="disabled">禁用</option>
                </select>
              </div>
              <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2">
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除该用户吗？该用户的所有图片也将被删除。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary px-4">取消</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger px-4">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
