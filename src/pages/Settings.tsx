import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { settingsApi } from '@/lib/api';

interface SettingsData {
  site_name: string;
  site_description: string;
  max_file_size: number;
  allowed_types: string;
  naming_strategy: string;
  path_format: string;
  watermark_enabled: boolean;
  watermark_type: string;
  watermark_text: string;
  watermark_position: string;
  watermark_opacity: number;
  compression_enabled: boolean;
  compression_quality: number;
  allow_guest_upload: boolean;
  register_enabled: boolean;
  user_isolation: boolean;
  referer_whitelist: string;
}

const defaultSettings: SettingsData = {
  site_name: 'Mikus 图床',
  site_description: '',
  max_file_size: 10,
  allowed_types: 'jpg,jpeg,png,gif,webp,svg',
  naming_strategy: 'uuid',
  path_format: 'YYYY/MM/DD',
  watermark_enabled: false,
  watermark_type: 'text',
  watermark_text: '',
  watermark_position: 'bottom-right',
  watermark_opacity: 50,
  compression_enabled: false,
  compression_quality: 80,
  allow_guest_upload: false,
  register_enabled: true,
  user_isolation: true,
  referer_whitelist: '',
};

function SettingSection({
  title,
  icon,
  children,
  defaultOpen = true,
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

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await settingsApi.getSettings();
        setSettings({ ...defaultSettings, ...res.data.data });
      } catch {
        // silently fail
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsApi.updateSettings(settings as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silently fail
    }
    setIsSaving(false);
  };

  const update = (key: keyof SettingsData, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">系统设置</h1>
        <button onClick={handleSave} disabled={isSaving} className="btn-primary flex items-center gap-2">
          <Save size={18} />
          {isSaving ? '保存中...' : saved ? '已保存' : '保存设置'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Basic */}
        <SettingSection title="基本设置" icon={<SettingsIcon size={18} className="text-th-accent" />}>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">站点名称</label>
            <input type="text" value={settings.site_name} onChange={(e) => update('site_name', e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">站点描述</label>
            <textarea value={settings.site_description} onChange={(e) => update('site_description', e.target.value)} className="input-dark min-h-[60px] resize-none" />
          </div>
        </SettingSection>

        {/* Upload */}
        <SettingSection title="上传设置" icon={<SettingsIcon size={18} className="text-th-accent" />}>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">最大文件大小 (MB)</label>
            <input type="number" value={settings.max_file_size} onChange={(e) => update('max_file_size', Number(e.target.value))} className="input-dark" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">允许的文件类型（逗号分隔）</label>
            <input type="text" value={settings.allowed_types} onChange={(e) => update('allowed_types', e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">命名策略</label>
            <select value={settings.naming_strategy} onChange={(e) => update('naming_strategy', e.target.value)} className="input-dark">
              <option value="uuid">UUID</option>
              <option value="timestamp">时间戳</option>
              <option value="original">原始文件名</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">路径格式</label>
            <input type="text" value={settings.path_format} onChange={(e) => update('path_format', e.target.value)} className="input-dark" placeholder="YYYY/MM/DD" />
          </div>
        </SettingSection>

        {/* Watermark */}
        <SettingSection title="水印设置" icon={<SettingsIcon size={18} className="text-th-accent" />} defaultOpen={false}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.watermark_enabled} onChange={(e) => update('watermark_enabled', e.target.checked)} className="h-4 w-4 rounded accent-th-accent" />
            <label className="text-sm text-th-text-sec">启用水印</label>
          </div>
          {settings.watermark_enabled && (
            <>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">水印类型</label>
                <select value={settings.watermark_type} onChange={(e) => update('watermark_type', e.target.value)} className="input-dark">
                  <option value="text">文字水印</option>
                  <option value="image">图片水印</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">水印文字</label>
                <input type="text" value={settings.watermark_text} onChange={(e) => update('watermark_text', e.target.value)} className="input-dark" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">水印位置</label>
                <select value={settings.watermark_position} onChange={(e) => update('watermark_position', e.target.value)} className="input-dark">
                  <option value="top-left">左上</option>
                  <option value="top-right">右上</option>
                  <option value="bottom-left">左下</option>
                  <option value="bottom-right">右下</option>
                  <option value="center">居中</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">透明度 ({settings.watermark_opacity}%)</label>
                <input type="range" min="0" max="100" value={settings.watermark_opacity} onChange={(e) => update('watermark_opacity', Number(e.target.value))} className="w-full accent-th-accent" />
              </div>
            </>
          )}
        </SettingSection>

        {/* Compression */}
        <SettingSection title="压缩设置" icon={<SettingsIcon size={18} className="text-th-accent" />} defaultOpen={false}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.compression_enabled} onChange={(e) => update('compression_enabled', e.target.checked)} className="h-4 w-4 rounded accent-th-accent" />
            <label className="text-sm text-th-text-sec">启用压缩</label>
          </div>
          {settings.compression_enabled && (
            <div>
              <label className="mb-1 block text-sm text-th-text-sec">压缩质量 ({settings.compression_quality}%)</label>
              <input type="range" min="10" max="100" value={settings.compression_quality} onChange={(e) => update('compression_quality', Number(e.target.value))} className="w-full accent-th-accent" />
            </div>
          )}
        </SettingSection>

        {/* Security */}
        <SettingSection title="安全设置" icon={<SettingsIcon size={18} className="text-th-accent" />} defaultOpen={false}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.register_enabled} onChange={(e) => update('register_enabled', e.target.checked)} className="h-4 w-4 rounded accent-th-accent" />
            <label className="text-sm text-th-text-sec">开放注册</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.user_isolation} onChange={(e) => update('user_isolation', e.target.checked)} className="h-4 w-4 rounded accent-th-accent" />
            <label className="text-sm text-th-text-sec">用户隔离（普通用户只能看到自己的图片）</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.allow_guest_upload} onChange={(e) => update('allow_guest_upload', e.target.checked)} className="h-4 w-4 rounded accent-th-accent" />
            <label className="text-sm text-th-text-sec">允许访客上传</label>
          </div>
          <div>
            <label className="mb-1 block text-sm text-th-text-sec">Referer 白名单（每行一个）</label>
            <textarea value={settings.referer_whitelist} onChange={(e) => update('referer_whitelist', e.target.value)} className="input-dark min-h-[80px] resize-none" placeholder="example.com" />
          </div>
        </SettingSection>
      </div>
    </div>
  );
}
