'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { userMeToAuthUser } from '@/types/api';

/**
 * When a session exists, redirect away from guest-only pages (/login, /register).
 * Returns true while the user is signed in (hide guest UI immediately).
 */
export function useRedirectIfAuthenticated(): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (!accessToken) return;

    const redirectParam = searchParams.get('redirect');

    if (user?.role) {
      router.replace(getPostLoginPath(user.role, redirectParam));
      return;
    }

    let active = true;
    fetchCurrentUser()
      .then((me) => {
        if (!active) return;
        updateUser(userMeToAuthUser(me));
        router.replace(getPostLoginPath(me.role, redirectParam, me.onboarding_completed));
      })
      .catch(() => {
        if (!active) return;
        const fallback =
          redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
            ? redirectParam
            : '/';
        router.replace(fallback);
      });

    return () => {
      active = false;
    };
  }, [accessToken, user?.role, router, searchParams, updateUser]);

  return Boolean(accessToken);
}
