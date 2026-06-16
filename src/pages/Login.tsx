import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Sun, Moon, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';
import { settingsApi } from '@/lib/api';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginVerify2fa, isLoading } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registerEnabled, setRegisterEnabled] = useState(true);
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorSetupRequired, setTwoFactorSetupRequired] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (twoFactorRequired && totpInputRef.current) {
      totpInputRef.current.focus();
    }
  }, [twoFactorRequired]);

  useEffect(() => {
    settingsApi.getPublicSettings()
      .then((res) => {
        const data = res.data.data;
        if (data.register_enabled !== undefined) {
          setRegisterEnabled(data.register_enabled);
        }
      })
      .catch(() => {
        // 默认允许注册
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !password) {
      setError('请填写所有字段');
      return;
    }
    try {
      const result = await login(name, password);
      if (result.requires_2fa) {
        setTwoFactorRequired(true);
        setTempToken(result.temp_token || '');
        return;
      }
      if (result.requires_2fa_setup) {
        setTwoFactorSetupRequired(true);
        return;
      }
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '登录失败，请检查用户名和密码');
    }
  };

  const handle2faSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!totpCode || totpCode.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }
    try {
      await loginVerify2fa(tempToken, totpCode);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '验证失败，请检查验证码');
    }
  };

  const resetToPasswordStep = () => {
    setTwoFactorRequired(false);
    setTwoFactorSetupRequired(false);
    setTotpCode('');
    setTempToken('');
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg p-4">
      {/* Animated background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-blob-purple absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full blur-[120px]" />
        <div className="bg-blob-cyan absolute -bottom-1/4 -right-1/4 h-[500px] w-[500px] rounded-full blur-[100px]" />
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
          <p className="mt-2 text-sm text-th-text-ter">登录以继续使用</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-th-danger-border bg-th-danger-bg px-4 py-3 text-sm text-th-danger">
            {error}
          </div>
        )}

        {/* Password form - hidden when 2FA step is active */}
        {!twoFactorRequired && !twoFactorSetupRequired && (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="username"
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
                  placeholder="输入密码"
                  className="input-dark pl-10"
                  autoComplete="current-password"
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
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>
        )}

        {/* 2FA verification form */}
        {twoFactorRequired && (
          <form onSubmit={handle2faSubmit} className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-th-accent/10 text-th-accent">
                <Shield size={24} />
              </div>
              <h2 className="text-lg font-semibold text-th-text">双因素验证</h2>
              <p className="mt-1 text-sm text-th-text-ter">请输入身份验证器中的 6 位验证码</p>
            </div>

            <div>
              <input
                ref={totpInputRef}
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                className="input-dark text-center text-2xl font-semibold tracking-[0.5em]"
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  验证中...
                </>
              ) : (
                '验证'
              )}
            </button>

            <button
              type="button"
              onClick={resetToPasswordStep}
              className="w-full text-center text-sm text-th-text-ter transition-colors hover:text-th-text-sec"
            >
              返回
            </button>
          </form>
        )}

        {/* 2FA setup required message */}
        {twoFactorSetupRequired && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-th-danger-bg text-th-danger">
                <Shield size={24} />
              </div>
              <h2 className="text-lg font-semibold text-th-text">需要启用双因素认证</h2>
              <p className="mt-2 text-sm text-th-text-ter">
                管理员要求启用双因素认证，请联系管理员或在其他设备上登录后设置
              </p>
            </div>

            <button
              type="button"
              onClick={resetToPasswordStep}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              返回
            </button>
          </div>
        )}

        {/* Register link - only show if registration is enabled and not in 2FA step */}
        {registerEnabled && !twoFactorRequired && !twoFactorSetupRequired && (
          <p className="mt-6 text-center text-sm text-th-text-ter">
            还没有账号？{' '}
            <Link to="/register" className="text-th-accent hover:underline">
              立即注册
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}