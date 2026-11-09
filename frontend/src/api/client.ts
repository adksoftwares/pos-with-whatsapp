import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
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
    console.error('API Error:', message);
    return Promise.reject(error.response?.data?.error || new Error(message));
  }
);
