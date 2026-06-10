import { useEffect, useState } from 'react';
import {
  Image,
  HardDrive,
  Upload,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { dashboardApi } from '@/lib/api';

interface Stats {
  totalImages: number;
  totalStorage: number;
  todayUploads: number;
  activeUsers: number;
  totalUsers?: number;
  totalAlbums?: number;
  strategies?: { name: string; value: number }[];
}

interface TrendItem {
  date: string;
  count: number;
}

interface StorageItem {
  name: string;
  value: number;
}

const COLORS = ['#00e5c3', '#2d1b69', '#1a1a2e', '#e0e0e8', '#00b89c'];

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-th-text-ter">{label}</p>
          <p className="font-outfit text-2xl font-bold text-th-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [storage, setStorage] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, trendRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getTrend({ days: 30 }),
        ]);
        const statsData = statsRes.data.data;
        const trendData = trendRes.data.data;
        setStats(statsData);
        setTrend(Array.isArray(trendData) ? trendData : []);

        // Build storage distribution from stats if available
        if (statsData?.strategies) {
          setStorage(statsData.strategies);
        } else {
          setStorage([{ name: '默认存储', value: statsData?.totalStorage || 0 }]);
        }
      } catch {
        // Use default data on error
        setTrend([]);
        setStorage([{ name: '默认存储', value: 0 }]);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
      <h1 className="font-outfit text-2xl font-bold text-th-text">仪表盘</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Image size={20} className="text-th-accent" />}
          label="总图片数"
          value={stats?.totalImages || 0}
          color="bg-th-accent-bg"
        />
        <StatCard
          icon={<HardDrive size={20} className="text-th-accent" />}
          label="总存储量"
          value={formatSize(stats?.totalStorage || 0)}
          color="bg-th-accent-bg"
        />
        <StatCard
          icon={<Upload size={20} className="text-th-accent" />}
          label="今日上传"
          value={stats?.todayUploads || 0}
          color="bg-th-accent-bg"
        />
        <StatCard
          icon={<Users size={20} className="text-th-accent" />}
          label="活跃用户"
          value={stats?.activeUsers || 0}
          color="bg-th-accent-bg"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upload trend */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-th-accent" />
            <h2 className="font-medium text-th-text">上传趋势（近30天）</h2>
          </div>
          <div className="h-64">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                  <XAxis
                    dataKey="date"
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid #2a2a4a',
                      borderRadius: '8px',
                      color: '#e0e0e8',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#00e5c3"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#00e5c3' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-th-text-ter">
                暂无数据
              </div>
            )}
          </div>
        </div>

        {/* Storage distribution */}
        <div className="glass-card p-5">
          <h2 className="mb-4 font-medium text-th-text">存储分布</h2>
          <div className="h-64">
            {storage.length > 0 && storage.some((s) => s.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storage}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {storage.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid #2a2a4a',
                      borderRadius: '8px',
                      color: '#e0e0e8',
                    }}
                    formatter={(value: number) => formatSize(value)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#999' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-th-text-ter">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
