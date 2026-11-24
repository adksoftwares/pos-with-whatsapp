import axios, { type AxiosAdapter } from 'axios';
import { handleStandaloneRequest } from './standaloneAdapter';

export function isCloudEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('vercel.app') || 
         host.includes('netlify.app') || 
         host.includes('github.io') ||
         (host !== 'localhost' && host !== '127.0.0.1');
}

export function shouldUseStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const manualBackend = localStorage.getItem('pos_backend_url');
  if (manualBackend) return false;
  if (import.meta.env.VITE_API_URL) return false;
  return isCloudEnvironment();
}

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const manual = localStorage.getItem('pos_backend_url');
    if (manual) return manual;
  }
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (shouldUseStandaloneMode()) return '/api/v1';
  return 'http://localhost:5000/api/v1';
};

const defaultAdapter = (axios.getAdapter && axios.getAdapter(axios.defaults.adapter as any)) || axios.defaults.adapter;

const resilientAdapter: AxiosAdapter = async (config) => {
  // If running in cloud demo environment without custom backend URL, bypass network entirely
  if (shouldUseStandaloneMode()) {
    return handleStandaloneRequest(config);
  }

  try {
    if (typeof defaultAdapter === 'function') {
      return await defaultAdapter(config);
    }
  } catch (error: any) {
    // If backend refused connection or network failed, gracefully resolve locally
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
    if (isNetworkError) {
      console.warn(`[POS Resilient Engine] Backend unreachable (${config.url}). Handled locally via Standalone Engine.`);
      return handleStandaloneRequest(config);
    }
    throw error;
  }
  return handleStandaloneRequest(config);
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  adapter: resilientAdapter,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const businessId = localStorage.getItem('activeBusinessId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (businessId) {
    config.headers['X-Business-Id'] = businessId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle 401 Unauthorized globally
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('activeBusinessId');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    
    const message = error.response?.data?.error?.message || error.message || 'An unexpected error occurred';
    if (error.response) {
      console.error('API Error:', message);
    } else {
      console.warn('Network unreachable / using offline mode:', message);
    }
    return Promise.reject(error.response?.data?.error || new Error(message));
  }
);
