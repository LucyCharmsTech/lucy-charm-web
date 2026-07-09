'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/services/authService';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/api';
import { userMeToAuthUser } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { GoogleLoginButton } from '@/components/auth/GoogleAuthButton';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return; // hard guard against double-submit edge cases
    setError(null);
    setLoading(true);

    try {
      const tokens = await login(email.trim(), password);

      // Persist tokens first so the Axios interceptor can call GET /users/me.
      const provisional: AuthUser = {
        user_id: '',
        email: email.trim(),
        first_name: '',
        last_name: '',
        role: 'client',
      };
      setAuth(tokens.access_token, tokens.refresh_token, provisional);

      const me = await fetchCurrentUser();
      const authUser = userMeToAuthUser(me);
      setAuth(tokens.access_token, tokens.refresh_token, authUser);

      const params = new URLSearchParams(window.location.search);
      router.push(getPostLoginPath(me.role, params.get('redirect'), me.onboarding_completed));
    } catch (err: unknown) {
      const anyErr = err as {
        code?: string;
        message?: string;
        response?: { data?: { detail?: string } };
      };
      const msg =
        anyErr.response?.data?.detail ??
        // Axios timeout often shows as client-side cancel in DevTools.
        (anyErr.code === 'ECONNABORTED' ? 'Login timed out. Please try again.' : null) ??
        (anyErr.message?.toLowerCase().includes('canceled')
          ? 'Login request was cancelled. Please try again.'
          : null) ??
        'Incorrect email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

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
              Sign in to your Lucycharms account
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
              redirectParam={
                typeof window !== 'undefined'
                  ? new URLSearchParams(window.location.search).get('redirect')
                  : null
              }
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
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-xl"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none dark:hover:text-zinc-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
            >
              {loading ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

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
