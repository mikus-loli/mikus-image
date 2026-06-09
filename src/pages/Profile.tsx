import { useState } from 'react';
import { User, Lock, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

export default function Profile() {
  const { user, updateProfile } = useAuthStore();
  const [newName, setNewName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setMessage({ type: 'error', text: '用户名不能为空' });
      return;
    }
    if (newName === user?.name) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await updateProfile({ name: newName.trim() });
      setMessage({ type: 'success', text: '用户名修改成功' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '修改失败' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '请填写所有密码字段' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '新密码至少6个字符' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次密码输入不一致' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await updateProfile({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: '密码修改成功' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '密码修改失败' });
    } finally {
      setIsSaving(false);
    }
  };

  const usedPercent = user
    ? Math.min(Math.round((user.used_capacity / user.capacity) * 100), 100)
    : 0;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <h1 className="font-outfit text-2xl font-bold text-th-text">个人设置</h1>

      {/* Message */}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-th-accent-shadow bg-th-accent-bg text-th-accent'
            : 'border-th-danger-border bg-th-danger-bg text-th-danger'
        }`}>
          {message.text}
        </div>
      )}

      {/* User info card */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-sm font-medium text-th-text-sec">账号信息</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-th-accent-bg text-2xl font-bold text-th-accent">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-lg font-medium text-th-text">{user?.name || '用户'}</p>
            <p className="text-sm text-th-text-ter">{user?.email || ''}</p>
            <span className="mt-1 inline-block rounded-full bg-th-badge-bg px-2 py-0.5 text-xs font-medium text-th-badge-text">
              {user?.role === 'admin' ? '管理员' : '普通用户'}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-th-text-ter">
            <span>存储空间</span>
            <span>{formatSize(user?.used_capacity || 0)} / {formatSize(user?.capacity || 0)} ({usedPercent}%)</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${usedPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Change username */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-sm font-medium text-th-text-sec">修改用户名</h2>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="输入新用户名"
              className="input-dark pl-10"
            />
          </div>
          <button
            onClick={handleUpdateName}
            disabled={isSaving || newName === user?.name}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            保存
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="glass-card p-6">
        <h2 className="mb-4 text-sm font-medium text-th-text-sec">修改密码</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">当前密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="输入当前密码"
                className="input-dark pl-10"
                autoComplete="current-password"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">新密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6个字符"
                className="input-dark pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">确认新密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className="input-dark pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>
          <button
            onClick={handleUpdatePassword}
            disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            修改密码
          </button>
        </div>
      </div>
    </div>
  );
}
