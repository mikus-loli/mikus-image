import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  Save,
  X,
  Calendar,
  HardDrive,
  Maximize,
} from 'lucide-react';
import { useImagesStore } from '@/stores/images';
import { albumsApi } from '@/lib/api';

type LinkTab = 'url' | 'markdown' | 'html' | 'bbcode';

function getFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return window.location.origin + url;
}

function generateLink(url: string, name: string, tab: LinkTab) {
  const fullUrl = getFullUrl(url);
  switch (tab) {
    case 'url': return fullUrl;
    case 'markdown': return `![${name}](${fullUrl})`;
    case 'html': return `<img src="${fullUrl}" alt="${name}" />`;
    case 'bbcode': return `[img]${fullUrl}[/img]`;
    default: return fullUrl;
  }
}

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentImage, isLoading, fetchImage, updateImage, deleteImage } = useImagesStore();
  const [activeTab, setActiveTab] = useState<LinkTab>('url');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [editAlbum, setEditAlbum] = useState('');
  const [editPermission, setEditPermission] = useState('');
  const [editTags, setEditTags] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (id) fetchImage(id);
    albumsApi.getAlbums().then((res) => {
      const data = res.data.data;
      setAlbums(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [id, fetchImage]);

  useEffect(() => {
    if (currentImage) {
      setEditAlbum(currentImage.album_id || '');
      setEditPermission(currentImage.permission);
      setEditTags(currentImage.tags?.join(', ') || '');
    }
  }, [currentImage]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaveError('');
    try {
      await updateImage(id, {
        album_id: editAlbum || undefined,
        permission: editPermission as 'public' | 'private',
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setHasChanges(false);
    } catch {
      setSaveError('保存失败，请刷新后重试');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteImage(id);
    navigate('/images');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-accent border-t-transparent" />
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
        <p>图片不存在</p>
        <button onClick={() => navigate('/images')} className="btn-secondary mt-4 px-4">
          返回图片列表
        </button>
      </div>
    );
  }

  const img = currentImage;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/images')} className="rounded-lg p-2 text-th-text-ter hover:bg-th-bg-hover hover:text-th-text">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-outfit text-xl font-bold text-th-text truncate">{img.original_name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Image preview */}
        <div className="lg:col-span-2">
          <div className="glass-card overflow-hidden">
            <img
              src={img.url}
              alt={img.original_name}
              className="mx-auto max-h-[600px] min-w-[200px] w-full object-contain"
            />
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          {/* Image info */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-th-text-sec">图片信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-th-text-ter">
                <HardDrive size={14} />
                <span>大小: {formatSize(img.size)}</span>
              </div>
              <div className="flex items-center gap-2 text-th-text-ter">
                <Maximize size={14} />
                <span>尺寸: {img.width} × {img.height}</span>
              </div>
              <div className="flex items-center gap-2 text-th-text-ter">
                <Calendar size={14} />
                <span>上传: {new Date(img.created_at).toLocaleDateString('zh-CN')}</span>
              </div>
              <div className="text-th-text-ter">
                类型: {img.mime_type}
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-th-text-sec">编辑信息</h3>
            <div>
              <label className="mb-1 block text-xs text-th-text-ter">相册</label>
              <select
                value={editAlbum}
                onChange={(e) => { setEditAlbum(e.target.value); setHasChanges(true); }}
                className="input-dark"
              >
                <option value="">不选择相册</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-th-text-ter">权限</label>
              <select
                value={editPermission}
                onChange={(e) => { setEditPermission(e.target.value); setHasChanges(true); }}
                className="input-dark"
              >
                <option value="public">公开</option>
                <option value="private">私有</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-th-text-ter">标签（逗号分隔）</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => { setEditTags(e.target.value); setHasChanges(true); }}
                className="input-dark"
                placeholder="风景, 旅行"
              />
            </div>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            {hasChanges && (
              <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2">
                <Save size={16} />
                保存修改
              </button>
            )}
          </div>

          {/* Link panel */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-th-text-sec">链接</h3>
            <div className="flex gap-1 rounded-lg bg-th-bg-sec/50 p-1">
              {(['url', 'markdown', 'html', 'bbcode'] as LinkTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeTab === tab ? 'bg-th-accent text-white' : 'text-th-text-ter hover:text-th-text'
                  }`}
                >
                  {tab === 'url' ? 'URL' : tab === 'markdown' ? 'MD' : tab === 'html' ? 'HTML' : 'BB'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generateLink(img.url, img.original_name, activeTab)}
                className="input-dark flex-1 bg-transparent py-1.5 text-xs"
              />
              <button
                onClick={() => handleCopy(generateLink(img.url, img.original_name, activeTab))}
                className="shrink-0 rounded-md p-2 text-th-text-ter hover:bg-th-accent-bg hover:text-th-accent"
              >
                {copied ? <Check size={16} className="text-th-accent" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            className="btn-danger flex w-full items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            删除图片
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除这张图片吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary px-4">
                取消
              </button>
              <button onClick={handleDelete} className="btn-danger px-4">
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
