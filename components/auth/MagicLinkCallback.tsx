'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import { verifyMagicLink } from '@/services/authService';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { userMeToAuthUser } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';

export function MagicLinkCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const token = useMemo(() => searchParams.get('token'), [searchParams]);
  const redirectParam = useMemo(() => searchParams.get('redirect'), [searchParams]);
  const missingToken = !token;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (missingToken) {
      return;
    }

    let active = true;
    verifyMagicLink({ token })
      .then(async (tokens) => {
        if (!active) return;
        setAuth(tokens.access_token, tokens.refresh_token, {
          user_id: '',
          email: '',
          first_name: '',
          last_name: '',
          role: 'client',
        });
        const me = await fetchCurrentUser();
        if (!active) return;
        setAuth(tokens.access_token, tokens.refresh_token, userMeToAuthUser(me));
        router.replace(getPostLoginPath(me.role, redirectParam, me.onboarding_completed));
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Magic link is invalid or expired. Please request a new one.';
        setError(msg);
      });

    return () => {
      active = false;
    };
  }, [missingToken, redirectParam, router, setAuth, token]);

  if (missingToken || error) {
    const message = missingToken
      ? 'Magic link token is missing.'
      : error;
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">Sign-in link problem</h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-primarycolor hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Verifying secure sign-in link...
      </div>
    </div>
  );
}
