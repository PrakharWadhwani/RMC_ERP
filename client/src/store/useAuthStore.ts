import { create } from 'zustand';
import api from '../lib/api';

interface AuthStore {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, phone_no: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  username: null,
  isAdmin: false,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      // We extract the access_token and the confirmed username from the response
      const { access_token, username: confirmedUser, is_admin } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('username', confirmedUser || username);
      localStorage.setItem('is_admin', String(!!is_admin));

      set({
        token: access_token,
        username: confirmedUser || username,
        isAdmin: !!is_admin,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Login failed';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (username: string, phone_no: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', {
        username,
        phone_no,
        password,
      });

      set({ isLoading: false });
      return {
        success: true,
        message: response.data.message || "Request sent to Admin.",
      };
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Registration failed';
      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
    set({
      token: null,
      username: null,
      isAdmin: false,
      isAuthenticated: false,
      error: null,
    });
  },

  hydrate: () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    const isAdminString = typeof window !== 'undefined' ? localStorage.getItem('is_admin') : null;
    const isAdmin = isAdminString === 'true';
    const isAuthenticated = !!token;
    set({
      token,
      username,
      isAdmin,
      isAuthenticated,
    });
    return isAuthenticated;
  },
}));