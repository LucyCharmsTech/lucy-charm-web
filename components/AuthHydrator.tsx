'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { fetchCurrentUser } from '@/services/userService';
import { userMeToAuthUser } from '@/types/api';

/**
 * On first load, if we have a token but the persisted user predates `role`
 * (or is missing it), refresh profile from GET /users/me.
 */
export default function AuthHydrator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const ran = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!accessToken) {
      ran.current = false;
      return;
    }
    if (!user) return;
    if (user.role) return;
    if (ran.current) return;
    ran.current = true;

    fetchCurrentUser()
      .then((me) => updateUser(userMeToAuthUser(me)))
      .catch(() => {
        clearAuth();
      });
  }, [accessToken, user?.user_id, user?.role, updateUser, clearAuth]);

  return null;
}
