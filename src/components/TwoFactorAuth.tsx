import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Loader2, Lock, KeyRound, Smartphone, Check, X, AlertTriangle } from 'lucide-react';
import { twofaApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type View = 'status' | 'setup' | 'disable';

interface TwoFactorStatus {
  enabled: boolean;
  force_2fa: boolean;
}

interface SetupData {
  secret: string;
  qr_code: string;
  otpauth_uri: string;
  setup_token: string;
}

export default function TwoFactorAuth() {
  const { user } = useAuthStore();
  const [view, setView] = useState<View>('status');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Setup flow state
  const [setupStep, setSetupStep] = useState(1);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Disable flow state
  const [disablePassword, setDisablePassword] = useState('');

  // Messages
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await twofaApi.getStatus();
      setStatus(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '获取2FA状态失败' });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const resetSetupState = () => {
    setSetupStep(1);
    setSetupPassword('');
    setSetupData(null);
    setVerifyCode('');
  };

  const resetDisableState = () => {
    setDisablePassword('');
  };

  const handleStartSetup = () => {
    setMessage(null);
    resetSetupState();
    setView('setup');
  };

  const handleStartDisable = () => {
    setMessage(null);
    resetDisableState();
    setView('disable');
  };

  const handleCancel = () => {
    setMessage(null);
    resetSetupState();
    resetDisableState();
    setView('status');
  };

  // Step 1: Submit password to get setup data
  const handleSetupPassword = async () => {
    if (!setupPassword) {
      setMessage({ type: 'error', text: '请输入当前密码' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await twofaApi.setup(setupPassword);
      setSetupData(res.data.data);
      setSetupStep(2);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '设置失败' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Verify code to enable 2FA
  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setMessage({ type: 'error', text: '请输入6位验证码' });
      return;
    }
    if (!setupData) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      await twofaApi.verify(verifyCode, setupData.setup_token);
      setMessage({ type: 'success', text: '双因素认证已启用' });
      resetSetupState();
      setView('status');
      await fetchStatus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '验证失败' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disable 2FA
  const handleDisable = async () => {
    if (!disablePassword) {
      setMessage({ type: 'error', text: '请输入当前密码' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      await twofaApi.disable(disablePassword);
      setMessage({ type: 'success', text: '双因素认证已禁用' });
      resetDisableState();
      setView('status');
      await fetchStatus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg || '禁用失败' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canDisable = !status?.force_2fa || isAdmin;

  // Loading status skeleton
  if (isLoadingStatus) {
    return (
      <div className="glass-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield size={18} className="text-th-accent" />
          <h2 className="text-sm font-medium text-th-text-sec">双因素认证 (2FA)</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton h-3 w-48 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Shield size={18} className="text-th-accent" />
        <h2 className="text-sm font-medium text-th-text-sec">双因素认证 (2FA)</h2>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-th-accent-shadow bg-th-accent-bg text-th-accent'
            : 'border-th-danger-border bg-th-danger-bg text-th-danger'
        }`}>
          {message.text}
        </div>
      )}

      {/* Status view */}
      {view === 'status' && status && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              status.enabled ? 'bg-th-accent-bg' : 'bg-th-bg-ter'
            }`}>
              {status.enabled ? (
                <ShieldCheck size={24} className="text-th-accent" />
              ) : (
                <Shield size={24} className="text-th-text-ter" />
              )}
            </div>
            <div>
              <p className="text-base font-medium text-th-text">
                {status.enabled ? '已启用' : '未启用'}
              </p>
              <p className="text-sm text-th-text-ter">
                {status.enabled
                  ? '您的账号已开启双因素认证保护'
                  : '启用后登录时需要输入验证码，提升账号安全性'}
              </p>
            </div>
          </div>

          {status.enabled ? (
            <div className="space-y-2">
              <button
                onClick={handleStartDisable}
                disabled={!canDisable}
                title={!canDisable ? '管理员已全局强制启用2FA，无法禁用' : undefined}
                className="btn-danger flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock size={16} />
                禁用2FA
              </button>
              {!canDisable && (
                <p className="flex items-center gap-1.5 text-xs text-th-text-ter">
                  <AlertTriangle size={12} />
                  管理员已全局强制启用2FA，无法禁用
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartSetup}
              className="btn-primary flex items-center gap-2"
            >
              <ShieldCheck size={16} />
              启用2FA
            </button>
          )}
        </div>
      )}

      {/* Setup flow */}
      {view === 'setup' && (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  setupStep >= step
                    ? 'bg-th-accent text-white'
                    : 'bg-th-bg-ter text-th-text-ter'
                }`}>
                  {setupStep > step ? <Check size={14} /> : step}
                </div>
                {step < 3 && (
                  <div className={`h-0.5 w-8 ${setupStep > step ? 'bg-th-accent' : 'bg-th-bg-ter'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Password */}
          {setupStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-th-accent-shadow bg-th-accent-bg p-3">
                <KeyRound size={16} className="mt-0.5 shrink-0 text-th-accent" />
                <p className="text-sm text-th-text-sec">
                  为确认是您本人操作，请输入当前账号密码
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-th-text-sec">当前密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="输入当前密码"
                    className="input-dark pl-10"
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="btn-secondary flex items-center gap-2"
                >
                  <X size={16} />
                  取消
                </button>
                <button
                  onClick={handleSetupPassword}
                  disabled={isSubmitting || !setupPassword}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  下一步
                </button>
              </div>
            </div>
          )}

          {/* Step 2: QR code */}
          {setupStep === 2 && setupData && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-th-accent-shadow bg-th-accent-bg p-3">
                <Smartphone size={16} className="mt-0.5 shrink-0 text-th-accent" />
                <p className="text-sm text-th-text-sec">
                  使用 Google Authenticator / Microsoft Authenticator 扫描二维码，或手动输入密钥
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg border border-th-border bg-white p-3">
                  <img src={setupData.qr_code} alt="2FA QR Code" className="h-44 w-44" />
                </div>
                <div className="w-full">
                  <label className="mb-1.5 block text-sm font-medium text-th-text-sec">密钥</label>
                  <code className="block w-full break-all rounded-lg border border-th-border bg-th-bg-input px-4 py-2.5 text-sm text-th-text">
                    {setupData.secret}
                  </code>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="btn-secondary flex items-center gap-2"
                >
                  <X size={16} />
                  取消
                </button>
                <button
                  onClick={() => {
                    setMessage(null);
                    setSetupStep(3);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Check size={16} />
                  已扫描，下一步
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Verify */}
          {setupStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-th-accent-shadow bg-th-accent-bg p-3">
                <KeyRound size={16} className="mt-0.5 shrink-0 text-th-accent" />
                <p className="text-sm text-th-text-sec">
                  输入验证器应用中显示的6位验证码以完成启用
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-th-text-sec">验证码</label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入6位验证码"
                  className="input-dark text-center text-lg tracking-[0.5em]"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMessage(null);
                    setVerifyCode('');
                    setSetupStep(2);
                  }}
                  className="btn-secondary flex items-center gap-2"
                >
                  <X size={16} />
                  上一步
                </button>
                <button
                  onClick={handleVerify}
                  disabled={isSubmitting || verifyCode.length !== 6}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  确认启用
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disable flow */}
      {view === 'disable' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-th-danger-border bg-th-danger-bg p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-th-danger" />
            <p className="text-sm text-th-danger">
              禁用双因素认证将降低账号安全性，请输入当前密码以确认操作
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-th-text-sec">当前密码</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="输入当前密码"
                className="input-dark pl-10"
                autoComplete="current-password"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="btn-secondary flex items-center gap-2"
            >
              <X size={16} />
              取消
            </button>
            <button
              onClick={handleDisable}
              disabled={isSubmitting || !disablePassword}
              className="btn-danger flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              确认禁用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
