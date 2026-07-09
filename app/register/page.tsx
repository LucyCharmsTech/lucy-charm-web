'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, LoaderIcon, AlertCircleIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { register, login } from '@/services/authService';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/api';
import { userMeToAuthUser } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { GoogleLoginButton } from '@/components/auth/GoogleAuthButton';

// Password strength helpers
function scorePassword(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0–4
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = [
  '',
  'bg-red-500',
  'bg-amber-400',
  'bg-yellow-400',
  'bg-emerald-500',
];

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwdScore = scorePassword(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Register
      const signupRes = await register({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      // 2. Auto-login immediately after registration
      const tokens = await login(email.trim(), password);

      const provisional: AuthUser = {
        user_id: signupRes.user_id,
        email: signupRes.email,
        first_name: signupRes.first_name,
        last_name: signupRes.last_name,
        role: 'client',
      };
      setAuth(tokens.access_token, tokens.refresh_token, provisional);

      const me = await fetchCurrentUser();
      setAuth(tokens.access_token, tokens.refresh_token, userMeToAuthUser(me));

      router.push(getPostLoginPath(me.role, null, me.onboarding_completed));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const requirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primarycolor/10">
              <span className="text-xl font-extrabold text-primarycolor">L</span>
            </div>
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Join Lucycharms — free forever
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
                or sign up with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="h-11 rounded-xl"
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="h-11 rounded-xl"
                  disabled={loading}
                />
              </div>
            </div>

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
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= pwdScore
                            ? STRENGTH_COLORS[pwdScore]
                            : 'bg-zinc-200 dark:bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Strength:{' '}
                    <span className="font-semibold">
                      {STRENGTH_LABELS[pwdScore] || 'Too short'}
                    </span>
                  </p>

                  {/* Requirements checklist */}
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {requirements.map((req) => (
                      <li
                        key={req.label}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          req.met
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        <CheckIcon className="size-3 shrink-0" aria-hidden="true" />
                        {req.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !firstName || !lastName || !email || pwdScore < 2}
              className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
            >
              {loading ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
