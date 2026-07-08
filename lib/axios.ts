import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // 10s was causing client-side aborts (often shown as "Canceled" in DevTools)
  // on slower dev machines / cold-start API. Keep this generous for a better UX.
  timeout: 30000,
});

// Request interceptor — attach Bearer token from the auth store when present.
// We import the store's getState directly (avoids React hook rules in plain TS).
api.interceptors.request.use(
  (config) => {
    // Dynamic import avoids circular-dependency issues at module load time
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require('@/stores/authStore');
      const token: string | null = useAuthStore.getState().accessToken;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — on 401 clear auth so the app redirects to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require('@/stores/authStore');
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

export default api;
