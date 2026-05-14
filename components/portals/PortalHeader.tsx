'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/authStore';
import { logout } from '@/services/authService';
import { Button } from '@/components/ui/button';

export default function PortalHeader({ title }: { title: string }) {
  const router = useRouter();
  const { user, refreshToken, clearAuth } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      refreshToken: s.refreshToken,
      clearAuth: s.clearAuth,
    })),
  );

  async function handleLogout() {
    try {
      if (refreshToken) await logout(refreshToken);
    } catch {
      /* ignore */
    }
    clearAuth();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-lg font-extrabold tracking-tight text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            Lucycharms
          </Link>
          <span className="hidden text-zinc-300 dark:text-zinc-600 sm:inline">|</span>
          <span className="hidden text-sm font-semibold text-zinc-700 dark:text-zinc-200 sm:inline">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden max-w-[200px] truncate text-sm text-zinc-600 dark:text-zinc-300 sm:block">
            {user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.email}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-zinc-200 dark:border-zinc-700"
            onClick={handleLogout}
          >
            <LogOutIcon className="mr-1.5 size-3.5" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
