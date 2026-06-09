import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '注册失败，请稍后重试');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg p-4">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-blob-purple absolute -right-1/4 -top-1/4 h-[600px] w-[600px] rounded-full blur-[120px]" />
        <div className="bg-blob-cyan absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full blur-[100px]" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-th-border text-th-text-ter transition-all duration-300 hover:border-th-accent hover:text-th-accent"
        title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="glass-card relative w-full max-w-md animate-fade-in p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-th-accent-shadow" style={{ background: 'linear-gradient(135deg, var(--color-accent), #00b89c)' }}>
            <span className="font-outfit text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="font-outfit text-3xl font-bold text-th-text">
            Miku<span className="text-th-accent">s</span> 图床
          </h1>
          <p className="mt-2 text-sm text-th-text-ter">创建新账号</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-th-danger-border bg-th-danger-bg px-4 py-3 text-sm text-th-danger">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">用户名</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入用户名"
                className="input-dark pl-10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">邮箱</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-dark pl-10"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少6个字符"
                className="input-dark pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">确认密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="input-dark pl-10"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                注册中...
              </>
            ) : (
              '注册'
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-th-text-ter">
          已有账号？{' '}
          <Link to="/login" className="text-th-accent hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
