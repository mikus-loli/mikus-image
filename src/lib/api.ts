import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (data: { name: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: { name?: string; oldPassword?: string; newPassword?: string }) =>
    api.patch('/auth/profile', data),
};

// Images
export const imagesApi = {
  upload: (formData: FormData, onProgress?: (percent: number) => void) =>
    api.post('/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }),
  uploadByUrl: (data: { url: string; album_id?: string; strategy_id?: string; permission?: string }) =>
    api.post('/images/url', data),
  getImages: (params?: { page?: number; limit?: number; album_id?: string; keyword?: string; permission?: string }) =>
    api.get('/images', { params }),
  getImage: (id: string) => api.get(`/images/${id}`),
  updateImage: (id: string, data: { album_id?: string; permission?: string; tags?: string[] }) =>
    api.patch(`/images/${id}`, data),
  deleteImage: (id: string) => api.delete(`/images/${id}`),
  batchOperation: (data: { ids: string[]; action: 'delete' | 'move' | 'permission'; album_id?: string; permission?: string }) =>
    api.post('/images/batch', data),
  getQrCode: (id: string) => api.get(`/images/${id}/qrcode`),
};

// Albums
export const albumsApi = {
  getAlbums: () => api.get('/albums'),
  createAlbum: (data: { name: string; description?: string; permission?: string }) =>
    api.post('/albums', data),
  getAlbum: (id: string) => api.get(`/albums/${id}`),
  updateAlbum: (id: string, data: { name?: string; description?: string; cover?: string; permission?: string }) =>
    api.put(`/albums/${id}`, data),
  deleteAlbum: (id: string) => api.delete(`/albums/${id}`),
};

// Strategies
export const strategiesApi = {
  getStrategies: () => api.get('/strategies'),
  createStrategy: (data: Record<string, unknown>) => api.post('/strategies', data),
  updateStrategy: (id: string, data: Record<string, unknown>) => api.put(`/strategies/${id}`, data),
  deleteStrategy: (id: string) => api.delete(`/strategies/${id}`),
};

// Users
export const usersApi = {
  getUsers: () => api.get('/users'),
  updateUser: (id: string, data: { role?: string; capacity?: number; status?: string }) =>
    api.put(`/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/users/${id}`),
};

// Settings
export const settingsApi = {
  getSettings: () => api.get('/settings'),
  getPublicSettings: () => api.get('/settings/public'),
  getPublicStats: () => api.get('/settings/stats'),
  updateSettings: (data: Record<string, unknown>) => api.patch('/settings', data),
};

// Dashboard
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getTrend: (params?: { days?: number }) => api.get('/dashboard/trend', { params }),
};

export default api;
