import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import {
  ScanSearch, ChevronLeft, ChevronRight, Search, ShieldAlert,
  CheckCircle, AlertTriangle, RefreshCw, Download, Loader2,
  ShieldX, Eye, ImageOff, ZapOff, FileSearch, ChevronDown, X,
  UploadCloud,
} from 'lucide-react';
import { imagesApi } from '@/lib/api';

interface NsfwLog {
  id: string;
  image_id: string | null;
  original_name: string;
  user_id: string;
  user_name: string;
  top_class: string;
  max_score: number;
  scores: Record<string, number>;
  is_nsfw: boolean;
  action: string;
  detail: string;
  created_at: string;
}

interface NsfwStatus {
  enabled: boolean;
  ready: boolean;
  error: string | null;
}

interface NsfwStats {
  total: number;
  nsfwCount: number;
  todayCount: number;
  allowed: number;
  rejected: number;
  flagged: number;
  blurred: number;
  degraded: number;
  uploadFailed: number;
}

interface ActionConfig {
  label: string;
  icon: typeof CheckCircle;
  badgeClass: string;
  dotClass: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  allow:   { label: '放行', icon: CheckCircle, badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dotClass: 'bg-emerald-400' },
  reject:  { label: '拒绝', icon: ShieldX,     badgeClass: 'bg-red-500/10 text-red-400 border-red-500/20',           dotClass: 'bg-red-400' },
  flag:    { label: '标记', icon: Eye,         badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',     dotClass: 'bg-amber-400' },
  blur:    { label: '模糊', icon: ImageOff,    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       dotClass: 'bg-blue-400' },
  degrade: { label: '降级', icon: ZapOff,      badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20', dotClass: 'bg-orange-400' },
  upload_failed: { label: '上传失败', icon: UploadCloud, badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dotClass: 'bg-rose-400' },
};

const CLASS_COLORS: Record<string, string> = {
  Porn: 'bg-red-500',
  Hentai: 'bg-red-400',
  Sexy: 'bg-amber-500',
  Neutral: 'bg-emerald-500',
  Drawing: 'bg-blue-500',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return formatTime(iso);
}

function scoreColor(score: number): string {
  if (score >= 0.8) return 'bg-red-500';
  if (score >= 0.5) return 'bg-amber-500';
  if (score >= 0.2) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

function scoreTextColor(score: number): string {
  if (score >= 0.8) return 'text-red-400';
  if (score >= 0.5) return 'text-amber-400';
  if (score >= 0.2) return 'text-yellow-400';
  return 'text-emerald-400';
}

export default function NsfwLogs() {
  const [logs, setLogs] = useState<NsfwLog[]>([]);
  const [status, setStatus] = useState<NsfwStatus | null>(null);
  const [stats, setStats] = useState<NsfwStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [nsfwFilter, setNsfwFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const fetchStatus = useCallback(async () => {
    try {
      const res = await imagesApi.getNsfwStatus();
      setStatus(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await imagesApi.getNsfwStats();
      setStats(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const handleReloadModel = useCallback(async () => {
    setIsReloading(true);
    try {
      const res = await imagesApi.reloadNsfwModel();
      setStatus(res.data.data);
    } catch { /* ignore */ }
    finally { setIsReloading(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await imagesApi.getNsfwLogs({
        page, limit,
        action: actionFilter || undefined,
        is_nsfw: nsfwFilter || undefined,
        search: search || undefined,
      });
      const data = res.data.data;
      setLogs(data.logs || []);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter, nsfwFilter, search]);

  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchStats();
    fetchLogs();
  }, [fetchStatus, fetchStats, fetchLogs]);

  useEffect(() => { fetchStatus(); fetchStats(); }, [fetchStatus, fetchStats]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setActionFilter('');
    setNsfwFilter('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const hasActiveFilters = actionFilter || nsfwFilter || search;

  const quickFilters = useMemo(() => [
    { key: 'nsfw', label: '仅 NSFW', active: nsfwFilter === '1', onClick: () => { setNsfwFilter(nsfwFilter === '1' ? '' : '1'); setPage(1); } },
    { key: 'reject', label: '已拒绝', active: actionFilter === 'reject', onClick: () => { setActionFilter(actionFilter === 'reject' ? '' : 'reject'); setPage(1); } },
    { key: 'failed', label: '上传失败', active: actionFilter === 'upload_failed', onClick: () => { setActionFilter(actionFilter === 'upload_failed' ? '' : 'upload_failed'); setPage(1); } },
    { key: 'flag', label: '已标记', active: actionFilter === 'flag', onClick: () => { setActionFilter(actionFilter === 'flag' ? '' : 'flag'); setPage(1); } },
    { key: 'degrade', label: '降级', active: actionFilter === 'degrade', onClick: () => { setActionFilter(actionFilter === 'degrade' ? '' : 'degrade'); setPage(1); } },
  ], [nsfwFilter, actionFilter]);

  const statCards = useMemo(() => {
    if (!stats) return [];
    const blockedCount = stats.rejected + stats.blurred;
    return [
      { icon: FileSearch, label: '总检测数', value: stats.total, sub: `今日 ${stats.todayCount}`, color: 'from-[#00b89c] to-[#00e5c3]', bg: 'bg-[rgba(0,184,156,0.08)]' },
      { icon: ShieldAlert, label: 'NSFW 命中', value: stats.nsfwCount, sub: stats.total ? `${((stats.nsfwCount / stats.total) * 100).toFixed(1)}%` : '0%', color: 'from-[#ef4444] to-[#f87171]', bg: 'bg-[rgba(239,68,68,0.08)]' },
      { icon: ShieldX, label: '已拦截/模糊', value: blockedCount, sub: `拒绝 ${stats.rejected} · 模糊 ${stats.blurred}`, color: 'from-[#f59e0b] to-[#fbbf24]', bg: 'bg-[rgba(245,158,11,0.08)]' },
      { icon: UploadCloud, label: '上传失败', value: stats.uploadFailed, sub: stats.uploadFailed > 0 ? '查看失败原因' : '无失败记录', color: 'from-[#e11d48] to-[#fb7185]', bg: 'bg-[rgba(225,29,72,0.08)]' },
      { icon: ZapOff, label: '服务降级', value: stats.degraded, sub: stats.degraded > 0 ? '需关注' : '正常', color: 'from-[#8b5cf6] to-[#a78bfa]', bg: 'bg-[rgba(139,92,246,0.08)]' },
    ];
  }, [stats]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-th-accent-bg p-2.5 text-th-accent">
            <ScanSearch size={24} />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-bold text-th-text">NSFW 检测日志</h1>
            <p className="mt-0.5 text-sm text-th-text-ter">图片内容安全检测结果与处理记录</p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          className="btn-secondary flex items-center gap-2 self-start text-sm sm:self-auto"
        >
          <RefreshCw size={16} />
          刷新
        </button>
      </div>

      {/* Summary stat cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="glass-card group relative overflow-hidden p-4 transition-all hover:shadow-lg sm:p-5">
                <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${card.color} opacity-60 transition-opacity group-hover:opacity-100`} />
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-th-text-ter sm:text-sm">{card.label}</p>
                    <p className="mt-1 font-outfit text-xl font-bold text-th-text sm:text-2xl">{card.value.toLocaleString()}</p>
                    <p className="mt-0.5 truncate text-xs text-th-text-ter">{card.sub}</p>
                  </div>
                  <div className={`shrink-0 rounded-xl p-2 ${card.bg} text-th-text-ter transition-colors group-hover:text-th-text`}>
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Service status */}
      <div className="glass-card relative overflow-hidden p-4 sm:p-5">
        <div className={`absolute left-0 top-0 h-full w-1 ${status?.ready ? 'bg-emerald-500' : status?.enabled ? 'bg-amber-500' : 'bg-th-text-ter'}`} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${status?.ready ? 'bg-emerald-500/10 text-emerald-400' : status?.enabled ? 'bg-amber-500/10 text-amber-400' : 'bg-th-bg-tertiary text-th-text-ter'}`}>
              <ScanSearch size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-th-text">NSFWJS 检测服务</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  status?.enabled
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-th-bg-tertiary text-th-text-ter'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status?.enabled ? 'bg-emerald-400' : 'bg-th-text-ter'}`} />
                  {status?.enabled ? '已启用' : '未启用'}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  status?.ready
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status?.ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {status?.ready ? '模型就绪' : '模型未加载'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-th-text-ter">
                {status?.ready
                  ? '服务运行正常，上传图片将自动进行内容检测'
                  : status?.enabled
                    ? '模型尚未加载，点击右侧按钮加载模型'
                    : '请在系统设置中启用 NSFW 内容检测'}
              </p>
            </div>
          </div>
          <button
            onClick={handleReloadModel}
            disabled={isReloading}
            className="btn-secondary flex shrink-0 items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
            title="手动加载或重新加载 NSFWJS 模型"
          >
            {isReloading ? (
              <><Loader2 size={14} className="animate-spin" />加载中…</>
            ) : (
              <><Download size={14} />{status?.ready ? '重新加载' : '加载模型'}</>
            )}
          </button>
        </div>
        {status?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span className="break-all">{status.error}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card space-y-3 p-4">
        {/* Quick filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-th-text-ter">快捷筛选</span>
          {quickFilters.map((f) => (
            <button
              key={f.key}
              onClick={f.onClick}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                f.active
                  ? 'border-th-accent bg-th-accent-bg text-th-accent'
                  : 'border-th-border bg-th-bg-tertiary text-th-text-ter hover:border-th-border-hover hover:text-th-text'
              }`}
            >
              {f.label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-th-text-ter transition-colors hover:text-red-400"
            >
              <X size={12} />清除筛选
            </button>
          )}
        </div>

        {/* Search + selects */}
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索文件名 / 用户 / 类别…"
              className="input-dark pl-9"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="input-dark w-auto min-w-[120px]"
            >
              <option value="">全部处理</option>
              <option value="allow">放行</option>
              <option value="reject">拒绝</option>
              <option value="flag">标记</option>
              <option value="blur">模糊</option>
              <option value="degrade">降级</option>
              <option value="upload_failed">上传失败</option>
            </select>
            <select
              value={nsfwFilter}
              onChange={(e) => { setNsfwFilter(e.target.value); setPage(1); }}
              className="input-dark w-auto min-w-[120px]"
            >
              <option value="">全部结果</option>
              <option value="1">仅 NSFW</option>
              <option value="0">仅正常</option>
            </select>
            <button type="submit" className="btn-primary shrink-0 px-5 text-sm">搜索</button>
          </div>
        </form>
      </div>

      {/* Logs table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-6 w-14 rounded-full" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
            <div className="rounded-2xl bg-th-bg-tertiary p-5">
              <FileSearch size={36} className="opacity-40" />
            </div>
            <p className="mt-4 text-sm font-medium">暂无检测记录</p>
            <p className="mt-1 text-xs text-th-text-ter">
              {hasActiveFilters ? '尝试调整筛选条件' : '上传图片后将在此显示检测结果'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-th-border bg-th-bg-tertiary/30 text-left text-xs text-th-text-ter">
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">文件名</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">用户</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">主要类别</th>
                  <th className="px-4 py-3 font-medium">置信度</th>
                  <th className="px-4 py-3 font-medium">结果</th>
                  <th className="px-4 py-3 font-medium">处理</th>
                  <th className="w-8 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: AlertTriangle, badgeClass: 'bg-th-bg-tertiary text-th-text-ter border-th-border', dotClass: 'bg-th-text-ter' };
                  const ActionIcon = cfg.icon;
                  const isExpanded = expandedId === log.id;
                  const scorePct = Math.round(log.max_score * 100);
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className={`cursor-pointer border-b border-th-border/40 transition-colors hover:bg-th-bg-hover/30 ${isExpanded ? 'bg-th-bg-hover/20' : ''}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="text-xs font-medium text-th-text-sec">{relativeTime(log.created_at)}</div>
                          <div className="text-xs text-th-text-ter">{formatTime(log.created_at)}</div>
                        </td>
                        <td className="max-w-[180px] px-4 py-3">
                          <div className="truncate text-th-text" title={log.original_name}>{log.original_name}</div>
                          <div className="text-xs text-th-text-ter md:hidden">{log.user_name || '-'}</div>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-th-text-sec md:table-cell">{log.user_name || '-'}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${CLASS_COLORS[log.top_class] || 'bg-th-text-ter'}`} />
                            <span className="text-th-text-sec">{log.top_class}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-th-bg-tertiary">
                              <div className={`h-full rounded-full transition-all ${scoreColor(log.max_score)}`} style={{ width: `${scorePct}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${scoreTextColor(log.max_score)}`}>{scorePct}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {log.is_nsfw ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                              <ShieldAlert size={12} />NSFW
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              <CheckCircle size={12} />正常
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.badgeClass}`}>
                            <ActionIcon size={12} />{cfg.label}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <ChevronDown size={16} className={`text-th-text-ter transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-th-border/40 bg-th-bg-tertiary/20">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              {/* Detail */}
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-th-text-ter">处理详情</p>
                                <p className="text-sm text-th-text-sec">{log.detail || '无附加信息'}</p>
                                <div className="mt-3 flex flex-wrap gap-4 text-xs text-th-text-ter">
                                  <span>记录 ID: <span className="font-mono text-th-text-sec">{log.id.slice(0, 8)}</span></span>
                                  {log.image_id && <span>图片 ID: <span className="font-mono text-th-text-sec">{log.image_id.slice(0, 8)}</span></span>}
                                  <span>用户 ID: <span className="font-mono text-th-text-sec">{log.user_id?.slice(0, 8) || '-'}</span></span>
                                </div>
                              </div>
                              {/* All class scores */}
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-th-text-ter">各类别评分</p>
                                <div className="space-y-1.5">
                                  {Object.entries(log.scores)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([cls, score]) => {
                                      const pct = Math.round(score * 100);
                                      return (
                                        <div key={cls} className="flex items-center gap-2">
                                          <span className="w-16 shrink-0 text-xs text-th-text-sec">{cls}</span>
                                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-th-bg-tertiary">
                                            <div className={`h-full rounded-full ${CLASS_COLORS[cls] || 'bg-th-text-ter'}`} style={{ width: `${pct}%` }} />
                                          </div>
                                          <span className={`w-10 shrink-0 text-right text-xs font-medium ${scoreTextColor(score)}`}>{pct}%</span>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-th-border px-4 py-3">
            <span className="text-xs text-th-text-ter">
              共 <span className="font-medium text-th-text-sec">{total}</span> 条
              {hasActiveFilters && <span className="ml-1">· 已筛选</span>}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-th-text-ter transition-colors hover:bg-th-bg-hover disabled:opacity-40"
              >
                <ChevronLeft size={14} />上一页
              </button>
              <span className="min-w-[60px] text-center text-sm text-th-text-sec">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-th-text-ter transition-colors hover:bg-th-bg-hover disabled:opacity-40"
              >
                下一页<ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
