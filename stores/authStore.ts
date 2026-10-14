/**
 * Global auth store — persists tokens and user info to localStorage so the
 * session survives page refreshes.  The Axios interceptor reads `accessToken`
 * from here on every request.
 */

import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/api';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;

  /** Store tokens + user after a successful login or register+auto-login. */
  setAuth: (
    accessToken: string,
    refreshToken: string,
    user: AuthUser,
  ) => void;

  /** Replace the token pair after a successful /auth/refresh (user unchanged). */
  setTokens: (accessToken: string, refreshToken: string) => void;

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
        hasHydrated: false,

        setAuth: (accessToken, refreshToken, user) =>
          set({ accessToken, refreshToken, user }, false, 'auth/setAuth'),

        setTokens: (accessToken, refreshToken) =>
          set({ accessToken, refreshToken }, false, 'auth/setTokens'),

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
        storage: createJSONStorage(() => {
          const browserStorage = () => {
            try {
              return typeof window === 'undefined' ? null : window.localStorage;
            } catch {
              return null;
            }
          };
          return {
            getItem: (name) => {
              try {
                const value = browserStorage()?.getItem(name) ?? null;
                if (value === null) return null;
                const saved = JSON.parse(value) as { state?: Partial<AuthState> };
                const state = saved?.state;
                if (!state || typeof state !== 'object' ||
                  (state.accessToken !== null && typeof state.accessToken !== 'string') ||
                  (state.refreshToken !== null && typeof state.refreshToken !== 'string') ||
                  (state.user !== null && (!state.user || typeof state.user.user_id !== 'string' ||
                    !['client', 'agent', 'superadmin'].includes(state.user.role ?? ''))) ||
                  Boolean(state.accessToken) !== Boolean(state.refreshToken) ||
                  // Staff MFA enrolment deliberately persists a token pair
                  // before /users/me is permitted to return a user. A reload
                  // on /security must retain that limited session; a user
                  // identity without a token pair is still invalid.
                  (Boolean(state.user) && !state.accessToken)) {
                  throw new Error('Invalid saved authentication');
                }
                return value;
              } catch {
                // A damaged saved session must fall back to signed-out, not
                // leave persist.hasHydrated() false and every role gate stuck.
                try { browserStorage()?.removeItem(name); } catch { /* storage is unavailable */ }
                return null;
              }
            },
            setItem: (name, value) => {
              try { browserStorage()?.setItem(name, value); } catch { /* runtime auth remains usable */ }
            },
            removeItem: (name) => {
              try { browserStorage()?.removeItem(name); } catch { /* runtime logout still clears state */ }
            },
          };
        }),
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
