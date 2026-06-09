import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Sparkles,
  Upload,
  Camera,
  Zap,
  Shield,
  Layers,
  CloudUpload,
  Link2,
  QrCode,
  Image,
  FolderOpen,
  Globe,
  ChevronRight,
  Users,
  ImageIcon,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { settingsApi } from '@/lib/api';

const highlights = [
  { icon: Zap, label: '极速上传', desc: '拖拽 / 粘贴 / URL' },
  { icon: Shield, label: '权限控制', desc: '公开 / 私密' },
  { icon: Layers, label: '相册管理', desc: '分类整理' },
  { icon: CloudUpload, label: '多存储策略', desc: '本地 / 云端' },
];

const linkFormats = [
  { icon: Link2, label: '直链' },
  { icon: Image, label: 'Markdown' },
  { icon: Globe, label: 'HTML' },
  { icon: QrCode, label: '二维码' },
];

interface SiteStats {
  users: number;
  images: number;
  days: number;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [stats, setStats] = useState<SiteStats>({ users: 0, images: 0, days: 0 });

  useEffect(() => {
    settingsApi.getPublicStats()
      .then((res) => {
        const d = res.data.data;
        if (d) setStats({ users: d.users || 0, images: d.images || 0, days: d.days || 0 });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,229,195,0.12),transparent),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(45,27,105,0.08),transparent),var(--color-bg-primary)] text-th-text">
      {/* Ambient light effects */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,229,195,0.06)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)]" />

      {/* Header */}
      <header className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--color-accent),#00b89c)] shadow-lg shadow-th-accent-shadow/40 transition-transform duration-300 group-hover:scale-105">
              <Camera className="text-white" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-outfit text-lg font-bold leading-tight">Mikus</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-th-text-ter">Image Host</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full bg-th-accent-bg px-3 py-1.5 text-sm text-th-accent sm:flex">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-th-accent" />
                  {user?.name}
                </div>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                >
                  进入后台
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-5 py-2 text-sm font-medium text-th-text-sec transition-colors hover:text-th-text">
                  登录
                </Link>
                <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-sm">
                  免费注册
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-th-border/80 bg-th-bg-glass-card/80 px-5 py-2 text-sm text-th-text-sec shadow-sm backdrop-blur-xl">
            <Sparkles size={15} className="text-th-accent" />
            <span>开源免费 · 轻量部署 · 现代体验</span>
          </div>

          {/* Title */}
          <h1 className="max-w-3xl font-outfit text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
            高效优雅的
            <br />
            <span className="mt-2 inline-block bg-[linear-gradient(135deg,var(--color-accent),#7cf7e3,#00b89c)] bg-clip-text text-transparent">图片托管与管理</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-xl text-base leading-8 text-th-text-sec sm:text-lg sm:leading-9">
            为个人与团队打造，支持多种上传方式、智能链接生成、相册整理与权限控制，开箱即用。
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/upload' : '/register')}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base"
            >
              <Upload size={18} />
              {isAuthenticated ? '开始上传' : '立即开始'}
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-th-border px-8 py-3 text-base font-medium text-th-text-sec transition-all duration-300 hover:border-th-accent hover:text-th-accent"
            >
              了解更多
              <ChevronRight size={16} />
            </Link>
          </div>


        </div>
      </section>

      {/* Preview card */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-th-border/60 bg-th-bg-glass-card/60 shadow-2xl shadow-black/5 backdrop-blur-2xl">
          {/* Toolbar mock */}
          <div className="flex items-center gap-2 border-b border-th-border/50 px-5 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" />
            </div>
            <div className="mx-auto rounded-md bg-th-bg-tertiary/60 px-4 py-1 text-xs text-th-text-ter">
              mikus.image.host
            </div>
          </div>
          {/* Content mock */}
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            {/* Upload zone mock */}
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-th-border/60 bg-th-bg-upload/40 py-10 sm:col-span-2">
              <div className="mb-3 rounded-full bg-th-accent-bg p-3">
                <Upload size={24} className="text-th-accent" />
              </div>
              <div className="text-sm font-medium text-th-text">拖拽图片到此处上传</div>
              <div className="mt-1 text-xs text-th-text-ter">或点击选择 · Ctrl+V 粘贴 · URL 导入</div>
            </div>
            {/* Link formats mock */}
            <div className="flex flex-col gap-3">
              {linkFormats.map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <div key={fmt.label} className="flex items-center gap-3 rounded-xl border border-th-border/50 bg-th-bg-card/60 px-4 py-3">
                    <Icon size={16} className="text-th-accent" />
                    <span className="text-sm text-th-text-sec">{fmt.label}</span>
                    <Copy size={12} className="ml-auto text-th-text-ter" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="group rounded-2xl border border-th-border/50 bg-th-bg-glass-card/50 p-6 backdrop-blur-xl transition-all duration-300 hover:border-th-accent/40 hover:shadow-lg hover:shadow-th-accent-shadow/10"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-th-accent-bg text-th-accent transition-colors duration-300 group-hover:bg-th-accent group-hover:text-white">
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-semibold text-th-text">{item.label}</h3>
                <p className="mt-1 text-sm text-th-text-ter">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Two-column features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Upload & Share */}
          <div className="rounded-2xl border border-th-border/50 bg-th-bg-glass-card/50 p-8 backdrop-blur-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-th-accent-bg px-3 py-1 text-xs font-medium text-th-accent">
              <Upload size={12} />
              上传与分享
            </div>
            <h2 className="mt-4 font-outfit text-2xl font-bold text-th-text">一键上传，多格式链接</h2>
            <p className="mt-3 text-sm leading-7 text-th-text-sec">
              支持拖拽、点击、剪贴板粘贴和 URL 导入四种上传方式。上传完成后自动生成直链、Markdown、HTML 和二维码，一键复制即可分享。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['拖拽上传', '批量上传', 'URL 导入', '剪贴板粘贴', '自动缩略图'].map((tag) => (
                <span key={tag} className="rounded-full border border-th-border/50 bg-th-bg-tertiary/40 px-3 py-1 text-xs text-th-text-ter">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Manage & Control */}
          <div className="rounded-2xl border border-th-border/50 bg-th-bg-glass-card/50 p-8 backdrop-blur-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-th-accent-bg px-3 py-1 text-xs font-medium text-th-accent">
              <FolderOpen size={12} />
              管理与控制
            </div>
            <h2 className="mt-4 font-outfit text-2xl font-bold text-th-text">灵活管理，安全可控</h2>
            <p className="mt-3 text-sm leading-7 text-th-text-sec">
              通过相册和标签对图片进行分类整理，支持公开与私密权限控制。用户数据隔离，管理员可统一管理存储策略与系统配置。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['相册管理', '标签分类', '权限控制', '用户隔离', '批量操作'].map((tag) => (
                <span key={tag} className="rounded-full border border-th-border/50 bg-th-bg-tertiary/40 px-3 py-1 text-xs text-th-text-ter">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-th-border/50 bg-[linear-gradient(135deg,rgba(0,229,195,0.06),rgba(45,27,105,0.04))] p-10 text-center backdrop-blur-xl sm:p-14">
          <h2 className="font-outfit text-2xl font-bold text-th-text sm:text-3xl">准备好开始了吗？</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-th-text-sec sm:text-base">
            免费注册即可使用全部功能，私有化部署数据自主可控。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/upload' : '/register')}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3"
            >
              {isAuthenticated ? '进入上传' : '免费注册'}
              <ArrowRight size={16} />
            </button>
            {!isAuthenticated && (
              <Link to="/login" className="inline-flex items-center gap-2 rounded-full border border-th-border px-8 py-3 font-medium text-th-text-sec transition-all duration-300 hover:border-th-accent hover:text-th-accent">
                已有账号？登录
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-th-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-th-text-ter">
            <Camera size={14} className="text-th-accent" />
            <span>Mikus Image Host</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-th-text-ter">
            <span>开源免费</span>
            <span>·</span>
            <span>私有化部署</span>
            <span>·</span>
            <span>现代化体验</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
