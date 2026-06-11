import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
import { albumsApi } from '@/lib/api';

interface Album {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  image_count?: number;
  imageCount?: number;
  permission: string;
  created_at: string;
  latest_thumbnail?: string;
}

export default function Albums() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editAlbum, setEditAlbum] = useState<Album | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchAlbums = async () => {
    setIsLoading(true);
    try {
      const res = await albumsApi.getAlbums();
      const data = res.data.data;
      setAlbums(Array.isArray(data) ? data : []);
    } catch {
      // silently fail
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchAlbums(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await albumsApi.createAlbum({ name: newName, description: newDesc || undefined });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      fetchAlbums();
    } catch {
      // silently fail
    }
  };

  const handleEdit = async () => {
    if (!editAlbum || !editName.trim()) return;
    try {
      await albumsApi.updateAlbum(editAlbum.id, { name: editName, description: editDesc || undefined });
      setEditAlbum(null);
      fetchAlbums();
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await albumsApi.deleteAlbum(id);
      setConfirmDelete(null);
      fetchAlbums();
    } catch {
      // silently fail
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">相册管理</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          新建相册
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && albums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
          <FolderOpen size={48} className="mb-4" />
          <p className="text-lg">暂无相册</p>
          <p className="mt-1 text-sm">创建你的第一个相册吧</p>
        </div>
      )}

      {/* Album grid */}
      {!isLoading && albums.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {albums.map((album) => (
            <div
              key={album.id}
              className="glass-card group cursor-pointer overflow-hidden"
              onClick={() => navigate(`/albums/${album.id}`)}
            >
              {/* Cover */}
              <div className="relative aspect-video overflow-hidden bg-th-bg-sec">
                {(album.cover || album.latest_thumbnail) ? (
                  <img
                    src={album.cover || album.latest_thumbnail}
                    alt={album.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FolderOpen size={32} className="text-th-text-ter" />
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditAlbum(album);
                      setEditName(album.name);
                      setEditDesc(album.description || '');
                    }}
                    className="rounded-md bg-th-bg-sec/80 p-1.5 text-th-text backdrop-blur-sm hover:text-th-accent"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(album.id);
                    }}
                    className="rounded-md bg-th-bg-sec/80 p-1.5 text-th-text backdrop-blur-sm hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-th-text">{album.name}</h3>
                {album.description && (
                  <p className="mt-1 text-sm text-th-text-ter line-clamp-2">{album.description}</p>
                )}
                <p className="mt-2 text-xs text-th-text-ter">{Number(album.image_count ?? album.imageCount ?? 0)} 张图片</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">新建相册</h3>
              <button onClick={() => setShowCreate(false)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">相册名称</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-dark"
                  placeholder="输入相册名称"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">描述（可选）</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input-dark min-h-[80px] resize-none"
                  placeholder="输入相册描述"
                />
              </div>
              <button onClick={handleCreate} className="btn-primary w-full">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editAlbum && (
        <div className="modal-overlay" onClick={() => setEditAlbum(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">编辑相册</h3>
              <button onClick={() => setEditAlbum(null)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">相册名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input-dark"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">描述</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input-dark min-h-[80px] resize-none"
                />
              </div>
              <button onClick={handleEdit} className="btn-primary w-full">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除这个相册吗？相册内的图片不会被删除。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary px-4">取消</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger px-4">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
