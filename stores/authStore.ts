/**
 * Global auth store — persists tokens and user info to localStorage so the
 * session survives page refreshes.  The Axios interceptor reads `accessToken`
 * from here on every request.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/api';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;

  /** Store tokens + user after a successful login or register+auto-login. */
  setAuth: (
    accessToken: string,
    refreshToken: string,
    user: AuthUser,
  ) => void;

  /** Update persisted user fields (e.g. after GET /users/me on refresh). */
  updateUser: (user: AuthUser) => void;

  /** Wipe everything (called on logout or 401 that can't be refreshed). */
  clearAuth: () => void;

  /** Convenience selector — true when a valid access token is present. */
  isAuthenticated: () => boolean;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        accessToken: null,
        refreshToken: null,
        user: null,

        setAuth: (accessToken, refreshToken, user) =>
          set({ accessToken, refreshToken, user }, false, 'auth/setAuth'),

        updateUser: (user) =>
          set({ user }, false, 'auth/updateUser'),

        clearAuth: () =>
          set(
            { accessToken: null, refreshToken: null, user: null },
            false,
            'auth/clearAuth',
          ),

        isAuthenticated: () => Boolean(get().accessToken),
      }),
      {
        name: 'lucy-auth', // localStorage key
        // Only persist the token fields; derived methods are re-created on load
        partialize: (state) => ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
        }),
      },
    ),
    { name: 'authStore' },
  ),
);
