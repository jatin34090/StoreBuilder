import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// Attach the agent's bearer token to every request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// The API's refresh token is an HttpOnly cookie the mobile client can't read,
// so an expired/invalid access token (401) ends the session and the agent
// re-authenticates via OTP. Auth endpoints are exempt so login errors surface
// to the form instead of triggering a logout loop.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isAuthCall = url.includes('/auth/');
    if (error.response?.status === 401 && !isAuthCall) {
      const { isAuthenticated, logout } = useAuthStore.getState();
      if (isAuthenticated) {
        await logout();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
export { API_URL };
