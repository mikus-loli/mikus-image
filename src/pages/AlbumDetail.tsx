import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  X,
  Save,
  FolderOpen,
} from 'lucide-react';
import { albumsApi } from '@/lib/api';

interface AlbumData {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  image_count: number;
  permission: string;
  created_at?: string;
  updated_at?: string;
}

interface ImageItem {
  id: string;
  original_name: string;
  url: string;
  thumbnail_url: string;
  size: number;
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await albumsApi.getAlbum(id);
      const albumData = res.data.data;
      setAlbum(albumData);
      setEditName(albumData.name);
      setEditDesc(albumData.description || '');
      // Use images from album API response directly (no separate fetch)
      setImages(albumData.images || []);
    } catch {
      // silently fail
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!id) return;
    try {
      await albumsApi.updateAlbum(id, { name: editName, description: editDesc || undefined });
      setIsEditing(false);
      fetchData();
    } catch {
      // silently fail
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await albumsApi.deleteAlbum(id);
      navigate('/albums');
    } catch {
      // silently fail
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-accent border-t-transparent" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
        <p>相册不存在</p>
        <button onClick={() => navigate('/albums')} className="btn-secondary mt-4 px-4">返回相册列表</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/albums')} className="rounded-lg p-2 text-th-text-ter hover:bg-th-bg-hover hover:text-th-text">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-outfit text-xl font-bold text-th-text">{album.name}</h1>
          {album.description && <p className="text-sm text-th-text-ter">{album.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(true)} className="btn-secondary flex items-center gap-2 px-4">
            <Edit3 size={16} />
            编辑
          </button>
          <button onClick={() => setConfirmDelete(true)} className="btn-danger flex items-center gap-2 px-4">
            <Trash2 size={16} />
            删除
          </button>
        </div>
      </div>

      {/* Stats */}


      {/* Images grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
          <FolderOpen size={48} className="mb-4" />
          <p className="text-lg">相册为空</p>
          <p className="mt-1 text-sm">上传图片时选择此相册即可添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
          {images.map((img) => (
            <div
              key={img.id}
              className="glass-card cursor-pointer overflow-hidden"
              onClick={() => navigate(`/images/${img.id}`)}
            >
              <div className="aspect-square overflow-hidden bg-th-bg-sec">
                <img
                  src={img.thumbnail_url || img.url}
                  alt={img.original_name}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-2">
                <p className="truncate text-xs text-th-text-ter">{img.original_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">编辑相册</h3>
              <button onClick={() => setIsEditing(false)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">相册名称</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-dark" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">描述</label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="input-dark min-h-[80px] resize-none" />
              </div>
              <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2">
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除这个相册吗？相册内的图片不会被删除。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary px-4">取消</button>
              <button onClick={handleDelete} className="btn-danger px-4">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
