import axios, { AxiosHeaders } from 'axios';

export const getApiBaseUrl = () => (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export const resolveAssetUrl = (assetPath?: string | null) => {
  if (!assetPath) {
    return null;
  }

  const normalizedAssetPath = assetPath.replace(/\\/g, '/');

  if (/^https?:\/\//i.test(normalizedAssetPath)) {
    return normalizedAssetPath;
  }

  const normalizedPath = normalizedAssetPath.startsWith('/') ? normalizedAssetPath : `/${normalizedAssetPath}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};

const api = axios.create({
  // Point this to your father's local Docker IP or localhost
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    'localtonet-skip-warning': 'true', // Custom header to bypass local network warnings
  },
});

// This will automatically attach the JWT token once we build the login logic
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers = AxiosHeaders.from(config.headers).set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;