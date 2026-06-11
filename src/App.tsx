import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '@/stores/auth';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Upload from '@/pages/Upload';
import Images from '@/pages/Images';
import ImageDetail from '@/pages/ImageDetail';
import Albums from '@/pages/Albums';
import AlbumDetail from '@/pages/AlbumDetail';
import Strategies from '@/pages/Strategies';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import Profile from '@/pages/Profile';
import Home from '@/pages/Home';
import Gallery from '@/pages/Gallery';

// Lazy load Dashboard (heavy: includes recharts)
const Dashboard = lazy(() => import('@/pages/Dashboard'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-accent border-t-transparent" />
    </div>
  );
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/images" element={<Images />} />
          <Route path="/images/:id" element={<ImageDetail />} />
          <Route path="/albums" element={<Albums />} />
          <Route path="/albums/:id" element={<AlbumDetail />} />
          <Route
            path="/strategies"
            element={
              <ProtectedRoute requireAdmin>
                <Strategies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requireAdmin>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requireAdmin>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireAdmin>
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
