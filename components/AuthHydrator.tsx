'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { fetchCurrentUser } from '@/services/userService';
import { userMeToAuthUser } from '@/types/api';

/**
 * On app load, refresh the persisted user from GET /users/me so the navbar
 * and other client UI reflect the latest profile (name, role, onboarding, etc.).
 */
export default function AuthHydrator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hydratedForToken = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!accessToken) {
      hydratedForToken.current = null;
      return;
    }
    if (hydratedForToken.current === accessToken) return;
    hydratedForToken.current = accessToken;

    fetchCurrentUser()
      .then((me) => updateUser(userMeToAuthUser(me)))
      .catch(() => {
        clearAuth();
      });
  }, [accessToken, updateUser, clearAuth]);

  return null;
}
