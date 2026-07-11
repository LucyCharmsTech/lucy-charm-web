'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircleIcon } from 'lucide-react';
import { GoogleLoginButton } from '@/components/auth/GoogleAuthButton';
import { MagicLinkAuthForm } from '@/components/auth/MagicLinkAuthForm';

function LoginPageFallback() {
  return <div className="min-h-[calc(100vh-80px)] bg-[#fef6f9] dark:bg-zinc-950" />;
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const redirectParam = useMemo(() => searchParams.get('redirect'), [searchParams]);

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primarycolor/10">
              <span className="text-xl font-extrabold text-primarycolor">L</span>
            </div>
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in with Google or a secure email link
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Google OAuth */}
          <div className="mb-5">
            <GoogleLoginButton
              redirectParam={redirectParam}
              onStart={() => setError(null)}
              onError={(msg) => setError(msg)}
            />
          </div>

          {/* Divider */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-zinc-400 dark:bg-zinc-900/60 dark:text-zinc-500">
                or continue with magic link
              </span>
            </div>
          </div>

          <MagicLinkAuthForm redirectPath={redirectParam} />

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
