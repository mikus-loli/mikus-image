import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon, ArrowLeft, ArrowRight, Copy, Check,
  HardDrive, Maximize, Calendar, X, FolderOpen, Search,
  Grid3X3, LayoutGrid, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

interface PublicImage {
  id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  width: number;
  height: number;
  url: string;
  thumbnail_url: string;
  album_id: string | null;
  user_name: string;
  created_at: string;
}

interface PublicAlbum {
  id: string;
  name: string;
  description: string;
  cover: string;
  created_at: string;
  image_count: number;
  latest_thumbnail: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return window.location.origin + url;
}

export default function Gallery() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [albums, setAlbums] = useState<PublicAlbum[]>([]);
  const [images, setImages] = useState<PublicImage[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // View state: 'albums' | 'album-id' | 'unassigned'
  const [view, setView] = useState<'albums' | string>('albums');
  const [currentAlbum, setCurrentAlbum] = useState<PublicAlbum | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  // Preview
  const [previewImage, setPreviewImage] = useState<PublicImage | null>(null);
  const [copied, setCopied] = useState(false);

  // Unassigned count
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    fetchAlbums();
  }, []);

  useEffect(() => {
    if (view !== 'albums') {
      fetchImages();
    }
  }, [view, page, sort]);

  async function fetchAlbums() {
    try {
      const [albumRes, unassignedRes] = await Promise.all([
        api.get('/albums/public'),
        api.get('/images/public', { params: { unassigned: 1, limit: 1 } }),
      ]);
      setAlbums(albumRes.data.data || []);
      setUnassignedCount(unassignedRes.data.data?.pagination?.total || 0);
    } catch {
      setAlbums([]);
    }
  }

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 24, sort };
      if (view === 'unassigned') {
        params.unassigned = 1;
      } else {
        params.album_id = view;
      }
      if (search) params.search = search;

      const res = await api.get('/images/public', { params });
      const data = res.data.data;
      setImages(data.images || []);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  }, [view, page, sort, search]);

  useEffect(() => {
    if (view !== 'albums') {
      fetchImages();
    }
  }, [fetchImages]);

  function openAlbum(album: PublicAlbum) {
    setCurrentAlbum(album);
    setView(album.id);
    setPage(1);
    setImages([]);
  }

  function openUnassigned() {
    setCurrentAlbum(null);
    setView('unassigned');
    setPage(1);
    setImages([]);
  }

  function backToAlbums() {
    setView('albums');
    setCurrentAlbum(null);
    setImages([]);
    setSearch('');
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(getFullUrl(url));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchImages();
  }

  return (
    <div className="min-h-screen bg-th-bg">
      {/* Header */}
      <header className="border-b border-th-border/50 bg-th-bg-sec/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {view !== 'albums' && (
              <button onClick={backToAlbums} className="flex items-center gap-1 text-th-text-ter transition-colors hover:text-th-text">
                <ArrowLeft size={18} />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2 text-th-text-ter transition-colors hover:text-th-text">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, var(--color-accent), #00b89c)' }}>
                <span className="font-outfit text-sm font-bold text-white">M</span>
              </div>
            </Link>
            <h1 className="text-base font-semibold text-th-text">
              {view === 'albums' ? '公开图库' : currentAlbum ? currentAlbum.name : '未分类图片'}
            </h1>
            {view !== 'albums' && (
              <span className="rounded-full bg-th-accent-bg px-2 py-0.5 text-xs text-th-accent">{total} 张</span>
            )}
          </div>
          {isAuthenticated ? (
            <Link to="/" className="btn-primary text-xs">回到主页</Link>
          ) : (
            <Link to="/login" className="btn-primary text-xs">登录</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Album view */}
        {view === 'albums' && (
          <>
            {/* Stats bar */}
            <div className="mb-6 flex items-center gap-4 text-sm text-th-text-ter">
              <span>{albums.length} 个相册</span>
              <span>·</span>
              <span>{unassignedCount} 张未分类</span>
            </div>

            {/* Album grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {/* Unassigned images card */}
              {unassignedCount > 0 && (
                <div
                  onClick={openUnassigned}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-th-border/40 bg-th-bg-card transition-all hover:border-th-accent/50 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-th-bg-sec">
                    <div className="flex h-full items-center justify-center">
                      <Grid3X3 size={40} className="text-th-text-ter/30" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-th-text">未分类</p>
                    <p className="text-xs text-th-text-ter">{unassignedCount} 张图片</p>
                  </div>
                </div>
              )}

              {/* Album cards */}
              {albums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => openAlbum(album)}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-th-border/40 bg-th-bg-card transition-all hover:border-th-accent/50 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-th-bg-sec">
                    {album.latest_thumbnail || album.cover ? (
                      <img
                        src={album.latest_thumbnail || album.cover}
                        alt={album.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FolderOpen size={40} className="text-th-text-ter/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-th-text">{album.name}</p>
                    <p className="text-xs text-th-text-ter">{album.image_count} 张图片</p>
                  </div>
                </div>
              ))}

              {albums.length === 0 && unassignedCount === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-th-text-ter">
                  <ImageIcon size={48} className="mb-4 opacity-30" />
                  <p className="text-lg">暂无公开图片</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Image list view (album or unassigned) */}
        {view !== 'albums' && (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2 min-w-[200px] max-w-md">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索图片..."
                    className="input-dark w-full py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
                <button type="submit" className="btn-secondary text-xs px-3 py-1.5">搜索</button>
              </form>

              {/* Sort */}
              <select
                value={sort}
                onChange={e => { setSort(e.target.value as any); setPage(1); }}
                className="input-dark text-xs py-1.5"
              >
                <option value="newest">最新优先</option>
                <option value="oldest">最早优先</option>
              </select>

              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-xs text-th-text-ter">
                <button onClick={backToAlbums} className="hover:text-th-accent">图库</button>
                <ChevronRight size={12} />
                <span className="text-th-text">{currentAlbum ? currentAlbum.name : '未分类'}</span>
              </div>
            </div>

            {/* Images grid */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-square rounded-xl" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
                <ImageIcon size={48} className="mb-4 opacity-30" />
                <p className="text-lg">暂无图片</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-th-border/40 bg-th-bg-card transition-shadow hover:shadow-lg"
                      onClick={() => setPreviewImage(img)}
                    >
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={img.thumbnail_url || img.url}
                          alt={img.original_name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="w-full p-2.5">
                          <p className="truncate text-xs text-white">{img.original_name}</p>
                          <p className="text-xs text-white/60">{formatSize(img.size)} · {img.user_name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-30"
                    >
                      <ArrowLeft size={14} /> 上一页
                    </button>
                    <span className="text-sm text-th-text-ter">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-30"
                    >
                      下一页 <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-h-[90vh] max-w-5xl overflow-auto rounded-2xl bg-th-bg-sec shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
            >
              <X size={16} />
            </button>

            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="overflow-hidden rounded-xl border border-th-border/40 bg-th-bg-card">
                  <img
                    src={previewImage.url}
                    alt={previewImage.original_name}
                    className="mx-auto max-h-[500px] min-w-[200px] w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-card p-4 space-y-3">
                  <h3 className="text-sm font-medium text-th-text-sec">图片信息</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-th-text-ter">
                      <HardDrive size={14} />
                      <span>大小: {formatSize(previewImage.size)}</span>
                    </div>
                    {previewImage.width > 0 && (
                      <div className="flex items-center gap-2 text-th-text-ter">
                        <Maximize size={14} />
                        <span>尺寸: {previewImage.width} × {previewImage.height}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-th-text-ter">
                      <Calendar size={14} />
                      <span>上传: {new Date(previewImage.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="text-th-text-ter">类型: {previewImage.mime_type}</div>
                    <div className="text-th-text-ter">上传者: {previewImage.user_name}</div>
                  </div>
                </div>

                <div className="glass-card p-4 space-y-3">
                  <h3 className="text-sm font-medium text-th-text-sec">链接</h3>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={getFullUrl(previewImage.url)}
                      className="input-dark flex-1 bg-transparent py-1.5 text-xs"
                    />
                    <button
                      onClick={() => handleCopy(previewImage.url)}
                      className="shrink-0 rounded-md p-2 text-th-text-ter hover:bg-th-accent-bg hover:text-th-accent"
                    >
                      {copied ? <Check size={16} className="text-th-accent" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
