import { useEffect, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Server,
  Save,
  Check,
} from 'lucide-react';
import { strategiesApi } from '@/lib/api';

interface Strategy {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  file_count: number;
  used_space: number;
  config: Record<string, string>;
}

const strategyTypes = [
  { value: 'local', label: '本地存储' },
  { value: 's3', label: 'Amazon S3' },
  { value: 'oss', label: '阿里云 OSS' },
  { value: 'cos', label: '腾讯云 COS' },
];

function StrategyForm({
  data,
  onChange,
}: {
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <label className="mb-1 block text-xs text-th-text-ter">{key}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(key, e.target.value)}
            className="input-dark"
            placeholder={key}
          />
        </div>
      ))}
    </div>
  );
}

function getDefaultConfig(type: string): Record<string, string> {
  switch (type) {
    case 'local':
      return { path: '/uploads' };
    case 's3':
      return { bucket: '', region: '', access_key: '', secret_key: '', endpoint: '' };
    case 'oss':
      return { bucket: '', region: '', access_key_id: '', access_key_secret: '', endpoint: '' };
    case 'cos':
      return { bucket: '', region: '', secret_id: '', secret_key: '' };
    default:
      return {};
  }
}

export default function Strategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('local');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchStrategies = async () => {
    setIsLoading(true);
    try {
      const res = await strategiesApi.getStrategies();
      const data = res.data.data;
      setStrategies(Array.isArray(data) ? data : []);
    } catch {
      // silently fail
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchStrategies(); }, []);

  const openCreate = () => {
    setEditingStrategy(null);
    setFormName('');
    setFormType('local');
    setFormIsDefault(false);
    setFormConfig(getDefaultConfig('local'));
    setShowModal(true);
  };

  const openEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormName(strategy.name);
    setFormType(strategy.type);
    setFormIsDefault(strategy.is_default);
    setFormConfig(strategy.config || {});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (editingStrategy) {
        await strategiesApi.updateStrategy(editingStrategy.id, {
          name: formName,
          type: formType,
          is_default: formIsDefault,
          config: formConfig,
        });
      } else {
        await strategiesApi.createStrategy({
          name: formName,
          type: formType,
          is_default: formIsDefault,
          config: formConfig,
        });
      }
      setShowModal(false);
      fetchStrategies();
    } catch {
      // silently fail
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await strategiesApi.deleteStrategy(id);
      setConfirmDelete(null);
      fetchStrategies();
    } catch {
      // silently fail
    }
  };

  const formatSize = (bytes: number | undefined | null) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-outfit text-2xl font-bold text-th-text">存储策略</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          新建策略
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-th-text-ter">
          <Server size={48} className="mb-4" />
          <p className="text-lg">暂无存储策略</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-border text-left text-xs text-th-text-ter">
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">默认</th>
                <th className="px-4 py-3">文件数</th>
                <th className="px-4 py-3">已用空间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s) => (
                <tr key={s.id} className="border-b border-th-border/50 text-sm">
                  <td className="px-4 py-3 text-th-text">{s.name}</td>
                  <td className="px-4 py-3 text-th-text-ter">
                    {strategyTypes.find((t) => t.value === s.type)?.label || s.type}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_default && <Check size={16} className="text-th-accent" />}
                  </td>
                  <td className="px-4 py-3 text-th-text-ter">{s.file_count}</td>
                  <td className="px-4 py-3 text-th-text-ter">{formatSize(s.used_space)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="text-th-text-ter hover:text-th-accent">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => setConfirmDelete(s.id)} className="text-th-text-ter hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-th-text">
                {editingStrategy ? '编辑策略' : '新建策略'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-th-text-ter hover:text-th-text">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">策略名称</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="input-dark" placeholder="输入策略名称" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-th-text-sec">存储类型</label>
                <select
                  value={formType}
                  onChange={(e) => {
                    setFormType(e.target.value);
                    setFormConfig(getDefaultConfig(e.target.value));
                  }}
                  className="input-dark"
                  disabled={!!editingStrategy}
                >
                  {strategyTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-th-border bg-th-bg-sec accent-th-accent"
                />
                <label className="text-sm text-th-text-sec">设为默认策略</label>
              </div>
              <div>
                <label className="mb-2 block text-sm text-th-text-sec">配置</label>
                <StrategyForm
                  data={formConfig}
                  onChange={(key, value) => setFormConfig((prev) => ({ ...prev, [key]: value }))}
                />
              </div>
              <button onClick={handleSave} className="btn-primary flex w-full items-center justify-center gap-2">
                <Save size={16} />
                {editingStrategy ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-medium text-th-text">确认删除</h3>
            <p className="mb-4 text-sm text-th-text-ter">确定要删除这个存储策略吗？</p>
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
