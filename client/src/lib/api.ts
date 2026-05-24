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

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attaches both the authentication token and the tunnel bypass header securely
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  // Rebuild the headers container safely to retain our custom bypass configurations
  const headers = AxiosHeaders.from(config.headers);
  
  // Explicitly inject the Localtonet bypass command so the server skips the warning prompt
  headers.set('localtonet-skip-warning', 'true');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  config.headers = headers;
  return config;
});

// Response Interceptor: Automatically handles expired token configurations and clears user sessions
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