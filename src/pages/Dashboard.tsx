import { useEffect, useState, useMemo } from 'react';
import {
  Image, HardDrive, Upload, Users, TrendingUp,
  FolderOpen, Clock, ArrowUpRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '@/lib/api';

interface Stats {
  totalImages: number;
  totalStorage: number;
  todayUploads: number;
  activeUsers: number;
  totalUsers?: number;
  totalAlbums?: number;
}

interface TrendItem {
  date: string;
  count: number;
  size: number;
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// Custom tooltip for chart
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-th-border/50 bg-th-bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-th-text-ter">{label}</p>
      <p className="text-sm font-semibold text-th-accent">{data.count} 张</p>
      {data.size > 0 && <p className="text-xs text-th-text-ter">{formatSize(data.size)}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, trendRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getTrend({ days: 30 }),
        ]);
        setStats(statsRes.data.data);
        setTrend(Array.isArray(trendRes.data.data) ? trendRes.data.data : []);
      } catch {
        setTrend([]);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Compute summary stats from trend
  const trendSummary = useMemo(() => {
    if (trend.length === 0) return { weekTotal: 0, weekSize: 0, avgDaily: 0 };
    const last7 = trend.slice(-7);
    const weekTotal = last7.reduce((s, t) => s + t.count, 0);
    const weekSize = last7.reduce((s, t) => s + t.size, 0);
    const avgDaily = Math.round(weekTotal / last7.length);
    return { weekTotal, weekSize, avgDaily };
  }, [trend]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-accent border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    {
      icon: <Image size={20} />,
      label: '总图片数',
      value: formatNumber(stats?.totalImages || 0),
      detail: `${stats?.totalImages || 0} 张`,
      color: 'from-[#00b89c] to-[#00e5c3]',
      bg: 'bg-[rgba(0,184,156,0.08)]',
    },
    {
      icon: <HardDrive size={20} />,
      label: '总存储量',
      value: formatSize(stats?.totalStorage || 0),
      detail: stats?.totalStorage ? `${((stats.totalStorage / (1024 * 1024 * 1024)) || 0).toFixed(2)} GB` : '0 GB',
      color: 'from-[#6366f1] to-[#818cf8]',
      bg: 'bg-[rgba(99,102,241,0.08)]',
    },
    {
      icon: <Upload size={20} />,
      label: '今日上传',
      value: formatNumber(stats?.todayUploads || 0),
      detail: `${stats?.todayUploads || 0} 张`,
      color: 'from-[#f59e0b] to-[#fbbf24]',
      bg: 'bg-[rgba(245,158,11,0.08)]',
    },
    {
      icon: <Users size={20} />,
      label: '活跃用户',
      value: formatNumber(stats?.activeUsers || 0),
      detail: `共 ${stats?.totalUsers || 0} 人`,
      color: 'from-[#ec4899] to-[#f472b6]',
      bg: 'bg-[rgba(236,72,153,0.08)]',
    },
  ];

  const miniStats = [
    { icon: <FolderOpen size={14} />, label: '相册数', value: stats?.totalAlbums || 0 },
    { icon: <Activity size={14} />, label: '7日上传', value: trendSummary.weekTotal },
    { icon: <Clock size={14} />, label: '日均上传', value: trendSummary.avgDaily },
    { icon: <HardDrive size={14} />, label: '7日增量', value: formatSize(trendSummary.weekSize) },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">仪表盘</h1>
        <span className="text-xs text-th-text-ter">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card group relative overflow-hidden p-5 transition-all hover:shadow-lg">
            {/* Gradient accent line */}
            <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${card.color} opacity-60 transition-opacity group-hover:opacity-100`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-th-text-ter">{card.label}</p>
                <p className="mt-1 font-outfit text-2xl font-bold text-th-text">{card.value}</p>
                <p className="mt-1 text-xs text-th-text-ter">{card.detail}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.bg} text-th-text-ter transition-colors group-hover:text-th-text`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {miniStats.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-th-border/30 bg-th-bg-card/50 px-4 py-3">
            <div className="text-th-accent">{item.icon}</div>
            <div>
              <p className="text-xs text-th-text-ter">{item.label}</p>
              <p className="text-sm font-semibold text-th-text">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upload trend chart */}
      <div className="glass-card overflow-hidden p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-th-accent" />
            <h2 className="font-medium text-th-text">上传趋势</h2>
            <span className="rounded-full bg-th-accent-bg px-2 py-0.5 text-xs text-th-accent">近30天</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-th-text-ter">
            <ArrowUpRight size={12} className="text-th-accent" />
            <span>共 {trend.reduce((s, t) => s + t.count, 0)} 张</span>
          </div>
        </div>
        <div className="h-72">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-tertiary)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  stroke="var(--color-text-tertiary)"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#colorCount)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-accent)', stroke: 'var(--color-bg-card)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-th-text-ter">
              <Activity size={32} className="mb-2 opacity-30" />
              <p>暂无上传数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Storage overview */}
      <div className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <HardDrive size={18} className="text-th-accent" />
          <h2 className="font-medium text-th-text">存储概览</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-th-border/30 bg-th-bg-sec/50 p-4 text-center">
            <p className="text-xs text-th-text-ter">已用空间</p>
            <p className="mt-1 font-outfit text-xl font-bold text-th-text">{formatSize(stats?.totalStorage || 0)}</p>
          </div>
          <div className="rounded-xl border border-th-border/30 bg-th-bg-sec/50 p-4 text-center">
            <p className="text-xs text-th-text-ter">图片数量</p>
            <p className="mt-1 font-outfit text-xl font-bold text-th-text">{stats?.totalImages || 0}</p>
          </div>
          <div className="rounded-xl border border-th-border/30 bg-th-bg-sec/50 p-4 text-center">
            <p className="text-xs text-th-text-ter">平均大小</p>
            <p className="mt-1 font-outfit text-xl font-bold text-th-text">
              {stats?.totalImages ? formatSize(Math.round(stats.totalStorage / stats.totalImages)) : '0 B'}
            </p>
          </div>
        </div>
        {/* Storage bar */}
        {stats?.totalStorage && stats.totalImages ? (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-th-text-ter">
              <span>存储使用</span>
              <span>{formatSize(stats.totalStorage)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-th-bg-sec">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00b89c] to-[#00e5c3] transition-all"
                style={{ width: `${Math.min(100, (stats.totalStorage / (1024 * 1024 * 1024)) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
