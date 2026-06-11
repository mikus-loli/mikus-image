import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Trash2,
  Copy,
  ExternalLink,
  CheckSquare,
  Square,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Lock,
  Globe,
  X,
} from 'lucide-react';
import { useImagesStore } from '@/stores/images';
import { useAlbumsStore } from '@/stores/albums';

export default function Images() {
  const navigate = useNavigate();
  const {
    images, total, page, isLoading, selectedIds, filters,
    fetchImages, deleteImage, batchOperation, toggleSelect, clearSelection, setFilters,
  } = useImagesStore();

  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showBatchMove, setShowBatchMove] = useState(false);
  const [showBatchPermission, setShowBatchPermission] = useState(false);
  const [batchAlbumId, setBatchAlbumId] = useState('');
  const [batchPermission, setBatchPermission] = useState<'public' | 'private'>('public');
  const fetchAlbums = useAlbumsStore((s) => s.fetchAlbums);

  useEffect(() => {
    fetchImages(1);
    fetchAlbums().then((data) => setAlbums(data)).catch(() => {});
  }, [fetchImages, fetchAlbums]);

  const handleSearch = () => {
    setFilters({ ...filters, keyword: searchInput || undefined });
  };

  const handleDelete = async (id: string) => {
    await deleteImage(id);
    setConfirmDelete(null);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    await batchOperation([...selectedIds], 'delete');
  };

  const handleBatchMove = async () => {
    if (selectedIds.size === 0 || !batchAlbumId) return;
    await batchOperation([...selectedIds], 'move', { album_id: batchAlbumId });
    setShowBatchMove(false);
    setBatchAlbumId('');
  };

  const handleBatchPermission = async () => {
    if (selectedIds.size === 0) return;
    await batchOperation([...selectedIds], 'permission', { permission: batchPermission });
    setShowBatchPermission(false);
  };

  const handleSelectAll = () => {
    // Select all images on current page
    const allIds = images.map((img) => img.id);
    const newSelected = new Set(selectedIds);
    allIds.forEach((id) => newSelected.add(id));
    useImagesStore.setState({ selectedIds: newSelected });
  };

  const handleInvertSelection = () => {
    const allIds = images.map((img) => img.id);
    const newSelected = new Set<string>();
    allIds.forEach((id) => {
      if (!selectedIds.has(id)) {
        newSelected.add(id);
      }
    });
    useImagesStore.setState({ selectedIds: newSelected });
  };

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  const totalPages = Math.ceil(total / 20);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">图片管理</h1>
        <span className="text-sm text-th-text-ter">共 {total} 张</span>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索图片..."
            className="input-dark pl-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary flex items-center gap-2 px-4 ${showFilters ? 'border-th-accent text-th-accent' : ''}`}
        >
          <Filter size={16} />
          筛选
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="glass-card animate-slide-up p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs text-th-text-ter">相册</label>
              <select
                value={filters.album_id || ''}
                onChange={(e) => setFilters({ ...filters, album_id: e.target.value || undefined })}
                className="input-dark"
              >
                <option value="">全部相册</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-th-text-ter">权限</label>
              <select
                value={filters.permission || ''}
                onChange={(e) => setFilters({ ...filters, permission: e.target.value || undefined })}
                className="input-dark"
              >
                <option value="">全部</option>
                <option value="public">公开</option>
                <option value="private">私有</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-th-accent-bg px-4 py-2.5">
          <span className="text-sm text-th-accent">已选择 {selectedIds.size} 项</span>
          <div className="flex items-center gap-2">
            <button onClick={handleSelectAll} className="btn-secondary px-3 py-1.5 text-xs">
              全选当前页
            </button>
            <button onClick={handleInvertSelection} className="btn-secondary px-3 py-1.5 text-xs">
              反选
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBatchMove(true)} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
              <FolderOpen size={14} />
              移动到相册
            </button>
            <button onClick={() => setShowBatchPermission(true)} className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
              <Lock size={14} />
              修改权限
            </button>
            <button onClick={handleBatchDelete} className="btn-danger flex items-center gap-1 px-3 py-1.5 text-xs">
              <Trash2 size={14} />
              批量删除
            </button>
          </div>
          <button onClick={clearSelection} className="btn-secondary px-3 py-1.5 text-xs">
            取消选择
          </button>
        </div>
      )}

      {/* Batch move modal */}
      {showBatchMove && (
        <div className="modal-overlay" onClick={() => setShowBatchMove(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">批量移动到相册</h3>
              <button onClick={() => setShowBatchMove(false)} className="text-th-text-ter hover:text-th-text">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-th-text-ter">将 {selectedIds.size} 张图片移动到：</p>
            <select
              value={batchAlbumId}
              onChange={(e) => setBatchAlbumId(e.target.value)}
              className="input-dark w-full mb-4"
            >
              <option value="">选择相册...</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBatchMove(false)} className="btn-secondary px-4">
                取消
              </button>
              <button onClick={handleBatchMove} disabled={!batchAlbumId} className="btn-primary px-4 disabled:opacity-50">
                移动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch permission modal */}
      {showBatchPermission && (
        <div className="modal-overlay" onClick={() => setShowBatchPermission(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">批量修改权限</h3>
              <button onClick={() => setShowBatchPermission(false)} className="text-th-text-ter hover:text-th-text">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-th-text-ter">将 {selectedIds.size} 张图片设置为：</p>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setBatchPermission('public')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                  batchPermission === 'public'
                    ? 'border-th-accent bg-th-accent-bg text-th-accent'
                    : 'border-th-border text-th-text-ter hover:border-th-accent'
                }`}
              >
                <Globe size={18} />
                公开
              </button>
              <button
                onClick={() => setBatchPermission('private')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                  batchPermission === 'private'
                    ? 'border-th-accent bg-th-accent-bg text-th-accent'
                    : 'border-th-border text-th-text-ter hover:border-th-accent'
                }`}
              >
                <Lock size={18} />
                私有
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBatchPermission(false)} className="btn-secondary px-4">
                取消
              </button>
              <button onClick={handleBatchPermission} className="btn-primary px-4">
                修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && images.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
          <ImageOff size={48} className="mb-4" />
          <p className="text-lg">暂无图片</p>
          <p className="mt-1 text-sm">上传你的第一张图片吧</p>
        </div>
      )}

      {/* Image grid */}
      {!isLoading && images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
          {images.map((img) => (
            <div
              key={img.id}
              className={`glass-card group relative overflow-hidden cursor-pointer ${
                selectedIds.has(img.id) ? 'ring-2 ring-th-accent' : ''
              }`}
              onClick={() => navigate(`/images/${img.id}`)}
            >
              {/* Thumbnail */}
              <div className="aspect-square overflow-hidden bg-th-bg-sec">
                <img
                  src={img.thumbnail_url || img.url}
                  alt={img.original_name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Permission badge */}
              <div className={`absolute right-2 bottom-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                img.permission === 'public'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-orange-500/20 text-orange-400'
              }`}>
                {img.permission === 'public' ? '公开' : '私有'}
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div className="w-full p-3">
                  <p className="truncate text-xs text-white">{img.original_name}</p>
                  <p className="text-xs text-white/60">{formatSize(img.size)}</p>
                </div>
              </div>

              {/* Hover actions */}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLink(img.url); }}
                  className="rounded-md bg-th-bg-sec/80 p-1.5 text-th-text backdrop-blur-sm hover:text-th-accent"
                  title="复制链接"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/images/${img.id}`); }}
                  className="rounded-md bg-th-bg-sec/80 p-1.5 text-th-text backdrop-blur-sm hover:text-th-accent"
                  title="查看详情"
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(img.id); }}
                  className="rounded-md bg-th-bg-sec/80 p-1.5 text-th-text backdrop-blur-sm hover:text-red-400"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Checkbox */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(img.id); }}
                className="absolute left-2 top-2 rounded-md bg-th-bg-sec/80 p-1 backdrop-blur-sm"
              >
                {selectedIds.has(img.id) ? (
                  <CheckSquare size={14} className="text-th-accent" />
                ) : (
                  <Square size={14} className="text-th-text-ter" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => fetchImages(page - 1)}
            disabled={page <= 1}
            className="btn-secondary p-2 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-th-text-ter">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => fetchImages(page + 1)}
            disabled={page >= totalPages}
            className="btn-secondary p-2 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除这张图片吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary px-4">
                取消
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger px-4">
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}