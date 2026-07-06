import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

export function getApiErrorMessage(error: unknown, fallback = '请求失败'): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

function isLoginRequest(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const url = String(error.config?.url || '');
  return url.includes('/auth/login');
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const msg = getApiErrorMessage(error);
    if (status === 401 && isLoginRequest(error)) {
      return Promise.reject(error);
    }
    if (status === 401) {
      localStorage.removeItem('token');
      if (location.pathname !== '/login') {
        location.href = '/login';
      }
    } else {
      message.error(msg);
    }
    return Promise.reject(error);
  },
);

export default api;
