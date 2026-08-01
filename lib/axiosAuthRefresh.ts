/**
 * Axios response interceptor: on 401, rotate tokens via /auth/refresh and
 * retry the original request. Concurrent 401s share a single in-flight refresh.
 */

import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type QueueEntry = {
  resolve: (accessToken: string) => void;
  reject: (error: unknown) => void;
};

const SKIP_REFRESH_PATHS = [
  '/auth/refresh',
  '/auth/login',
  '/auth/signup',
  '/auth/google',
  '/auth/magic-link',
  '/auth/mfa',
];

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

export function attachAuthRefreshInterceptor(api: AxiosInstance): void {
  let isRefreshing = false;
  let queue: QueueEntry[] = [];

  const flushQueue = (error: unknown, accessToken: string | null) => {
    queue.forEach((entry) => {
      if (error || !accessToken) entry.reject(error);
      else entry.resolve(accessToken);
    });
    queue = [];
  };

  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as RetriableConfig | undefined;

      if (
        error.response?.status !== 401 ||
        typeof window === 'undefined' ||
        !originalRequest ||
        originalRequest._retry ||
        shouldSkipRefresh(originalRequest.url)
      ) {
        return Promise.reject(error);
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require('@/stores/authStore') as typeof import('@/stores/authStore');
      const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();

      if (!refreshToken) {
        clearAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((accessToken) => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requestTokenRefresh } = require('@/lib/tokenRefresh') as typeof import('@/lib/tokenRefresh');
        const tokens = await requestTokenRefresh(refreshToken);
        setTokens(tokens.access_token, tokens.refresh_token);
        flushQueue(null, tokens.access_token);
        originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    },
  );
}
