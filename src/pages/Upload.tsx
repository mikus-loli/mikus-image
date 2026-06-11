import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload as UploadIcon,
  Link as LinkIcon,
  Clipboard,
  X,
  Check,
  FileImage,
  QrCode,
} from 'lucide-react';
import { useImagesStore } from '@/stores/images';
import { useAlbumsStore } from '@/stores/albums';
import { imagesApi } from '@/lib/api';

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: { id: string; url: string; thumbnail_url: string };
  error?: string;
}

type LinkTab = 'url' | 'markdown' | 'html' | 'bbcode';

function getFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return window.location.origin + url;
}

function generateLink(url: string, filename: string, tab: LinkTab) {
  const fullUrl = getFullUrl(url);
  switch (tab) {
    case 'url':
      return fullUrl;
    case 'markdown':
      return `![${filename}](${fullUrl})`;
    case 'html':
      return `<img src="${fullUrl}" alt="${filename}" />`;
    case 'bbcode':
      return `[img]${fullUrl}[/img]`;
    default:
      return fullUrl;
  }
}

export default function Upload() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [permission, setPermission] = useState<'public' | 'private'>('public');
  const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
  const [linkResults, setLinkResults] = useState<{ url: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<LinkTab>('url');
  const [showQrCode, setShowQrCode] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIndexRef = useRef(0);
  const uploadingRef = useRef<Set<string>>(new Set());
  const fetchAlbums = useAlbumsStore((s) => s.fetchAlbums);
  const fetchImages = useImagesStore((s) => s.fetchImages);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced refresh — coalesces multiple upload completions into one refresh */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      fetchImages(1);
      useAlbumsStore.getState().invalidate();
    }, 500);
  }, [fetchImages]);

  useEffect(() => {
    fetchAlbums().then((data) => setAlbums(data)).catch(() => {});
  }, [fetchAlbums]);

  const uploadFile = async (file: File, index: number) => {
    // Prevent duplicate uploads for the same file
    const fileId = `${file.name}-${file.size}-${index}`;
    if (uploadingRef.current.has(fileId)) return;
    uploadingRef.current.add(fileId);

    setUploadItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'uploading' };
      return next;
    });

    const formData = new FormData();
    formData.append('image', file);
    if (selectedAlbum) formData.append('album_id', selectedAlbum);
    if (selectedStrategy) formData.append('strategy_id', selectedStrategy);
    formData.append('permission', permission);

    try {
      const result = await useImagesStore.getState().uploadImages(formData, (percent) => {
        setUploadItems((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], progress: percent };
          return next;
        });
      });

      setUploadItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          status: 'done',
          progress: 100,
          result: result as { id: string; url: string; thumbnail_url: string },
        };
        return next;
      });

      setLinkResults((prev) => [
        ...prev,
        { url: (result as { url: string }).url, name: file.name },
      ]);

      scheduleRefresh();
    } catch {
      setUploadItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], status: 'error', error: '上传失败' };
        return next;
      });
    } finally {
      uploadingRef.current.delete(fileId);
    }
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) return;

    const startIndex = uploadIndexRef.current;
    uploadIndexRef.current += imageFiles.length;

    const newItems: UploadItem[] = imageFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadItems((prev) => [...prev, ...newItems]);

    // Upload files one by one to avoid race conditions
    newItems.forEach((item, index) => {
      uploadFile(item.file, startIndex + index);
    });
  }, [selectedAlbum, selectedStrategy, permission]);

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;
    try {
      const result = await imagesApi.uploadByUrl({
        url: urlInput,
        album_id: selectedAlbum || undefined,
        strategy_id: selectedStrategy || undefined,
        permission,
      });
      setLinkResults((prev) => [
        ...prev,
        { url: result.data.url, name: result.data.original_name || 'url-image' },
      ]);
      setUrlInput('');
      scheduleRefresh();
    } catch {
      // error handled silently
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleQrCode = async (imageId: string) => {
    try {
      const res = await imagesApi.getQrCode(imageId);
      setShowQrCode(res.data.data?.qrcode || '');
    } catch {
      // silently fail
    }
  };

  const removeItem = (index: number) => {
    setUploadItems((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="font-outfit text-2xl font-bold text-th-text">上传图片</h1>

      {/* Upload zone */}
      <div
        className={`upload-zone flex cursor-pointer flex-col items-center justify-center py-16 ${
          isDragOver ? 'drag-over' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="mb-4 rounded-full bg-th-accent-bg p-4">
          <UploadIcon size={32} className="text-th-accent" />
        </div>
        <p className="mb-1 text-lg font-medium text-th-text">
          拖拽图片到此处上传
        </p>
        <p className="text-sm text-th-text-ter">
          或点击选择文件 · 支持 Ctrl+V 粘贴
        </p>
      </div>

      {/* URL upload */}
      <div className="glass-card p-4">
        <label className="mb-2 block text-sm font-medium text-th-text-sec">
          通过 URL 上传
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="输入图片 URL"
              className="input-dark pl-10"
              onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
            />
          </div>
          <button onClick={handleUrlUpload} className="btn-primary px-4">
            上传
          </button>
        </div>
      </div>

      {/* Upload settings */}
      <div className="glass-card p-4">
        <h3 className="mb-3 text-sm font-medium text-th-text-sec">上传设置</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-th-text-ter">相册</label>
            <select
              value={selectedAlbum}
              onChange={(e) => setSelectedAlbum(e.target.value)}
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
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'public' | 'private')}
              className="input-dark"
            >
              <option value="public">公开</option>
              <option value="private">私有</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-th-text-ter">存储策略</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="input-dark"
            >
              <option value="">默认策略</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload queue */}
      {uploadItems.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-sm font-medium text-th-text-sec">上传队列</h3>
          <div className="space-y-2">
            {uploadItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg bg-th-bg-sec/50 p-3"
              >
                <FileImage size={20} className="shrink-0 text-th-text-ter" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-th-text">{item.file.name}</p>
                  <p className="text-xs text-th-text-ter">{formatSize(item.file.size)}</p>
                  {item.status === 'uploading' && (
                    <div className="progress-bar mt-1.5">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <p className="mt-1 text-xs text-red-400">{item.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'done' && (
                    <Check size={16} className="text-th-accent" />
                  )}
                  <button
                    onClick={() => removeItem(index)}
                    className="text-th-text-ter hover:text-red-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link results */}
      {linkResults.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-sm font-medium text-th-text-sec">上传结果</h3>

          {/* Tabs */}
          <div className="mb-3 flex gap-1 rounded-lg bg-th-bg-sec/50 p-1">
            {(['url', 'markdown', 'html', 'bbcode'] as LinkTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-th-accent text-white'
                    : 'text-th-text-ter hover:text-th-text'
                }`}
              >
                {tab === 'url' ? 'URL' : tab === 'markdown' ? 'Markdown' : tab === 'html' ? 'HTML' : 'BBCode'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {linkResults.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-th-bg-sec/50 p-2.5"
              >
                <input
                  readOnly
                  value={generateLink(item.url, item.name, activeTab)}
                  className="input-dark flex-1 bg-transparent py-1 text-xs"
                />
                <button
                  onClick={() => handleCopy(generateLink(item.url, item.name, activeTab), index)}
                  className="shrink-0 rounded-md p-1.5 text-th-text-ter transition-colors hover:bg-th-accent-bg hover:text-th-accent"
                  title="复制"
                >
                  {copiedIndex === index ? (
                    <Check size={14} className="text-th-accent" />
                  ) : (
                    <Clipboard size={14} />
                  )}
                </button>
                <button
                  onClick={() => handleQrCode('')}
                  className="shrink-0 rounded-md p-1.5 text-th-text-ter transition-colors hover:bg-th-accent-bg hover:text-th-accent"
                  title="二维码"
                >
                  <QrCode size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrCode && (
        <div className="modal-overlay" onClick={() => setShowQrCode(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">二维码</h3>
              <button onClick={() => setShowQrCode(null)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="flex justify-center">
              {showQrCode.startsWith('data:') ? (
                <img src={showQrCode} alt="QR Code" className="h-48 w-48" />
              ) : (
                <p className="text-sm text-th-text-ter">{showQrCode}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
