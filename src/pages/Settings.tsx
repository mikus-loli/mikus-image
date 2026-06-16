import { useEffect, useState, useCallback } from 'react';
import {
  Settings as SettingsIcon, Save, RotateCcw, Globe, Upload, Droplets,
  Minimize2, Shield, Image as ImageIcon, Check, AlertCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { settingsApi } from '@/lib/api';

interface SettingsData {
  site_name: string;
  site_description: string;
  base_url: string;
  max_file_size: number;
  allowed_types: string;
  default_capacity: number;
  enable_compress: boolean;
  compress_quality: number;
  enable_watermark: boolean;
  watermark_text: string;
  watermark_position: string;
  watermark_opacity: number;
  enable_thumbnail: boolean;
  thumbnail_max_width: number;
  register_enabled: boolean;
  user_isolation: boolean;
  force_2fa: boolean;
}

const defaultSettings: SettingsData = {
  site_name: 'Mikus 图床',
  site_description: '',
  base_url: '',
  max_file_size: 10485760,
  allowed_types: 'jpg,jpeg,png,gif,webp,svg,bmp,ico',
  default_capacity: 104857600,
  enable_compress: true,
  compress_quality: 80,
  enable_watermark: false,
  watermark_text: 'Mikus图床',
  watermark_position: 'bottom-right',
  watermark_opacity: 30,
  enable_thumbnail: true,
  thumbnail_max_width: 300,
  register_enabled: true,
  user_isolation: true,
  force_2fa: false,
};

/** Toggle switch component */
function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1">
        <label className="text-sm font-medium text-th-text-sec">{label}</label>
        {description && <p className="mt-0.5 text-xs text-th-text-ter">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-th-accent' : 'bg-th-border'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

/** Labeled field wrapper */
function Field({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-th-text-sec">{label}</label>
      {description && <p className="mb-1.5 text-xs text-th-text-ter">{description}</p>}
      {children}
    </div>
  );
}

function SettingSection({
  title, icon, children, defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-th-bg-hover/30"
      >
        {icon}
        <span className="flex-1 font-medium text-th-text">{title}</span>
        {open ? <ChevronDown size={18} className="text-th-text-ter" /> : <ChevronRight size={18} className="text-th-text-ter" />}
      </button>
      {open && <div className="border-t border-th-border px-5 py-4 space-y-4">{children}</div>}
    </div>
  );
}

const bytesToMB = (bytes: number) => Math.round(bytes / 1048576);
const mbToBytes = (mb: number) => mb * 1048576;

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsApi.getSettings();
        const data = { ...defaultSettings, ...res.data.data };
        setSettings(data);
        setOriginalSettings(data);
      } catch {
        setToast({ type: 'error', text: '加载设置失败' });
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const update = useCallback(<K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.updateSettings(settings as unknown as Record<string, unknown>);
      setOriginalSettings(settings);
      setToast({ type: 'success', text: '设置已保存' });
    } catch {
      setToast({ type: 'error', text: '保存失败，请重试' });
    }
    setIsSaving(false);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setToast({ type: 'success', text: '已还原未保存的更改' });
    setTimeout(() => setToast(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-th-text">系统设置</h1>
          <p className="mt-1 text-sm text-th-text-ter">配置站点、上传、安全等全局参数</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw size={16} />
              还原
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <><SettingsIcon size={18} className="animate-spin" />保存中...</>
            ) : (
              <><Save size={18} />保存设置</>
            )}
          </button>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {hasChanges && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          <AlertCircle size={16} />
          您有未保存的更改
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
          toast.type === 'success'
            ? 'border-th-accent-shadow bg-th-accent-bg text-th-accent'
            : 'border-th-danger-border bg-th-danger-bg text-th-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Basic */}
        <SettingSection title="基本设置" icon={<Globe size={18} className="text-th-accent" />}>
          <Field label="站点名称" description="显示在浏览器标题栏和首页">
            <input type="text" value={settings.site_name} onChange={(e) => update('site_name', e.target.value)} className="input-dark" />
          </Field>
          <Field label="站点描述" description="用于 SEO 和社交媒体分享">
            <textarea value={settings.site_description} onChange={(e) => update('site_description', e.target.value)} className="input-dark min-h-[60px] resize-none" />
          </Field>
          <Field label="站点 URL" description="图片链接的基础地址，如 https://img.example.com">
            <input type="text" value={settings.base_url} onChange={(e) => update('base_url', e.target.value)} className="input-dark" placeholder="https://img.example.com" />
          </Field>
        </SettingSection>

        {/* Upload */}
        <SettingSection title="上传设置" icon={<Upload size={18} className="text-th-accent" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="最大文件大小 (MB)" description="单个文件的上传限制">
              <input
                type="number"
                min="1"
                max="100"
                value={bytesToMB(settings.max_file_size)}
                onChange={(e) => update('max_file_size', mbToBytes(Number(e.target.value) || 10))}
                className="input-dark"
              />
            </Field>
            <Field label="默认用户容量 (MB)" description="新注册用户的存储配额">
              <input
                type="number"
                min="1"
                value={bytesToMB(settings.default_capacity)}
                onChange={(e) => update('default_capacity', mbToBytes(Number(e.target.value) || 100))}
                className="input-dark"
              />
            </Field>
          </div>
          <Field label="允许的文件类型" description="逗号分隔的扩展名列表">
            <input type="text" value={settings.allowed_types} onChange={(e) => update('allowed_types', e.target.value)} className="input-dark" />
          </Field>
        </SettingSection>

        {/* Compression */}
        <SettingSection title="压缩设置" icon={<Minimize2 size={18} className="text-th-accent" />} defaultOpen={false}>
          <Toggle
            checked={settings.enable_compress}
            onChange={(v) => update('enable_compress', v)}
            label="启用压缩"
            description="上传时自动将图片转换为 WebP 格式以减小体积"
          />
          {settings.enable_compress && (
            <Field label={`压缩质量 (${settings.compress_quality}%)`} description="越高画质越好，越低体积越小">
              <input type="range" min="10" max="100" value={settings.compress_quality} onChange={(e) => update('compress_quality', Number(e.target.value))} className="w-full accent-th-accent" />
            </Field>
          )}
        </SettingSection>

        {/* Watermark */}
        <SettingSection title="水印设置" icon={<Droplets size={18} className="text-th-accent" />} defaultOpen={false}>
          <Toggle
            checked={settings.enable_watermark}
            onChange={(v) => update('enable_watermark', v)}
            label="启用水印"
            description="上传时在图片上添加文字水印"
          />
          {settings.enable_watermark && (
            <>
              <Field label="水印文字">
                <input type="text" value={settings.watermark_text} onChange={(e) => update('watermark_text', e.target.value)} className="input-dark" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="水印位置">
                  <select value={settings.watermark_position} onChange={(e) => update('watermark_position', e.target.value)} className="input-dark">
                    <option value="top-left">左上</option>
                    <option value="top-right">右上</option>
                    <option value="bottom-left">左下</option>
                    <option value="bottom-right">右下</option>
                    <option value="center">居中</option>
                  </select>
                </Field>
                <Field label={`透明度 (${settings.watermark_opacity}%)`}>
                  <input type="range" min="5" max="100" value={settings.watermark_opacity} onChange={(e) => update('watermark_opacity', Number(e.target.value))} className="w-full accent-th-accent" />
                </Field>
              </div>
            </>
          )}
        </SettingSection>

        {/* Thumbnail */}
        <SettingSection title="缩略图设置" icon={<ImageIcon size={18} className="text-th-accent" />} defaultOpen={false}>
          <Toggle
            checked={settings.enable_thumbnail}
            onChange={(v) => update('enable_thumbnail', v)}
            label="启用缩略图"
            description="上传时自动生成小尺寸预览图，提升相册加载速度"
          />
          {settings.enable_thumbnail && (
            <Field label={`缩略图最大宽度 (${settings.thumbnail_max_width}px)`} description="缩略图按此宽度等比缩放">
              <input type="range" min="100" max="800" step="50" value={settings.thumbnail_max_width} onChange={(e) => update('thumbnail_max_width', Number(e.target.value))} className="w-full accent-th-accent" />
            </Field>
          )}
        </SettingSection>

        {/* Security */}
        <SettingSection title="安全设置" icon={<Shield size={18} className="text-th-accent" />} defaultOpen={false}>
          <Toggle
            checked={settings.register_enabled}
            onChange={(v) => update('register_enabled', v)}
            label="开放注册"
            description="允许新用户自行注册账号"
          />
          <Toggle
            checked={settings.user_isolation}
            onChange={(v) => update('user_isolation', v)}
            label="用户隔离"
            description="普通用户只能看到自己的图片"
          />
          <Toggle
            checked={settings.force_2fa}
            onChange={(v) => update('force_2fa', v)}
            label="强制双因素认证"
            description="所有用户必须启用 2FA 才能登录"
          />
        </SettingSection>
      </div>

      {/* Sticky save bar (mobile) */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-th-border bg-th-bg-sec px-5 py-3 shadow-lg">
          <span className="text-sm text-th-text-ter">有未保存的更改</span>
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn-secondary text-sm">取消</button>
            <button onClick={handleSave} disabled={isSaving} className="btn-primary text-sm">
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
