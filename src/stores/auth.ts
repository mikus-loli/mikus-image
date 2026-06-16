import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  capacity: number;
  used_capacity: number;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (name: string, password: string) => Promise<{ requires_2fa?: boolean; requires_2fa_setup?: boolean; temp_token?: string }>;
  loginVerify2fa: (tempToken: string, code: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { name?: string; oldPassword?: string; newPassword?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (name, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login({ name, password });
      const data = res.data.data;
      // 2FA required - return info without setting authenticated
      if (data.requires_2fa || data.requires_2fa_setup) {
        set({ isLoading: false });
        return { requires_2fa: data.requires_2fa, requires_2fa_setup: data.requires_2fa_setup, temp_token: data.temp_token };
      }
      const { token, user } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
      return {};
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loginVerify2fa: async (tempToken, code) => {
    set({ isLoading: true });
    try {
      const res = await authApi.loginVerify2fa({ temp_token: tempToken, code });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register({ name, email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await authApi.getMe();
      const user = res.data.data;
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  updateProfile: async (data) => {
    const res = await authApi.updateProfile(data);
    const { user, token } = res.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
}));
