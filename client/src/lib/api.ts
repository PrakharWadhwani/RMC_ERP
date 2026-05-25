import axios, { AxiosHeaders } from 'axios';

export const getApiBaseUrl = () => 
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

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

// FIX: Do not bundle a global 'Content-Type' header directly inside the root instance config
const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Request Interceptor: Injects context dynamically based on request type
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = AxiosHeaders.from(config.headers);
  
  // Only apply JSON definitions if we are sending data down the pipe (POST/PUT/PATCH)
  if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  config.headers = headers;
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