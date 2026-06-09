import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Upload,
  Images,
  FolderOpen,
  Server,
  Settings,
  Users,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Search,
  Sun,
  Moon,
  UserCircle,
  Home,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/hooks/useTheme';

const navItems = [
  { to: '/upload', icon: Upload, label: '上传' },
  { to: '/images', icon: Images, label: '图片管理' },
  { to: '/albums', icon: FolderOpen, label: '相册' },
  { to: '/profile', icon: UserCircle, label: '个人设置' },
  { to: '/strategies', icon: Server, label: '存储策略', admin: true },
  { to: '/settings', icon: Settings, label: '系统设置', admin: true },
  { to: '/users', icon: Users, label: '用户管理', admin: true },
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘', admin: true },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => !item.admin || isAdmin);

  const usedPercent = user
    ? Math.min(Math.round((user.used_capacity / user.capacity) * 100), 100)
    : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-th-border bg-th-bg-sec/90 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--color-accent),#00b89c)]">
            <span className="font-outfit text-lg font-bold text-white">M</span>
          </div>
          <span className="font-outfit text-xl font-bold text-th-text">
            Mikus<span className="text-th-accent">图床</span>
          </span>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} className="text-th-text-ter" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Home size={20} />
            <span>首页</span>
          </NavLink>
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-th-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-th-accent-bg text-sm font-bold text-th-accent">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-th-text">
                {user?.name || '用户'}
              </p>
              <p className="truncate text-xs text-th-text-ter">
                {user?.email || ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-th-text-ter transition-colors hover:bg-th-bg-hover hover:text-th-accent"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-th-text-ter">
              <span>存储空间</span>
              <span>{usedPercent}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-th-border bg-th-bg-sec/50 px-4 backdrop-blur-sm lg:px-6">
          <button
            className="rounded-lg p-1.5 text-th-text-ter hover:bg-th-bg-hover hover:text-th-text lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-ter" />
            <input
              type="text"
              placeholder="搜索图片..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark py-2 pl-9 pr-4 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-th-border text-th-text-ter transition-all duration-300 hover:border-th-accent hover:text-th-accent"
              title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-th-accent-bg text-xs font-bold text-th-accent transition-colors hover:bg-th-accent hover:text-white"
              title="个人设置"
            >
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
