'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import type { UserRole } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { useAuthStore } from '@/stores/authStore';

type RoleGateProps = {
  allowed: Extract<UserRole, 'agent' | 'superadmin'>;
  children: React.ReactNode;
};

/**
 * Client-side guard: only the given role may see child routes.
 * Others are redirected to their own home (or login if unauthenticated).
 */
export default function RoleGate({ allowed, children }: RoleGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, user } = useAuthStore(
    useShallow((s) => ({
      accessToken: s.accessToken,
      user: s.user,
    })),
  );
  useEffect(() => {
    if (!accessToken) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?redirect=${next}`);
      return;
    }
    if (!user?.role) {
      return;
    }
    if (user.role !== allowed) {
      router.replace(getPostLoginPath(user.role, null));
    }
  }, [accessToken, user, allowed, router, pathname]);

  if (!accessToken) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Redirecting…</p>
      </div>
    );
  }

  if (!user?.role) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your profile…</p>
      </div>
    );
  }

  if (user.role !== allowed) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
