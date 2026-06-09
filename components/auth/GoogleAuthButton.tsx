'use client';

/**
 * GoogleLoginButton — renders the official Google "Continue with Google" button.
 *
 * Uses `@react-oauth/google`'s <GoogleLogin> component which returns a signed
 * Google ID token (credential) in its onSuccess callback.  That credential is
 * forwarded to POST /auth/google on the API, which verifies it and returns a
 * standard Lucy Charms token pair.
 *
 * Requirements:
 *   - The component tree must be wrapped in <GoogleOAuthProvider> — done in
 *     components/Providers.tsx (rendered from app/layout.tsx).
 *   - NEXT_PUBLIC_GOOGLE_CLIENT_ID must be set in .env.
 */


import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import { googleLogin } from '@/services/authService';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import { userMeToAuthUser } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';

interface GoogleLoginButtonProps {
  /** Optional ?redirect= param to honour after successful login */
  redirectParam?: string | null;
  /** Called just before the API call starts — use to reset parent error state */
  onStart?: () => void;
  /** Called with a human-readable error message when the flow fails */
  onError?: (message: string) => void;
}

export function GoogleLoginButton({
  redirectParam,
  onStart,
  onError,
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  async function handleCredential(credentialResponse: { credential?: string }) {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      onError?.('No credential received from Google. Please try again.');
      return;
    }

    onStart?.();
    setLoading(true);

    try {
      const tokens = await googleLogin(idToken);

      // Set a provisional user so the Axios interceptor can attach Bearer for GET /users/me
      setAuth(tokens.access_token, tokens.refresh_token, {
        user_id: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'client',
      });

      const me = await fetchCurrentUser();
      setAuth(tokens.access_token, tokens.refresh_token, userMeToAuthUser(me));

      router.push(getPostLoginPath(me.role, redirectParam ?? null));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Google sign-in failed. Please try again.';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Signing in with Google"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
      >
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Signing in…
      </div>
    );
  }

  return (
    <div className="w-full [&>div]:w-full [&>div>div]:w-full">
      <GoogleLogin
        onSuccess={handleCredential}
        onError={() => onError?.('Google sign-in was cancelled or failed.')}
        width="400"
        shape="rectangular"
        size="large"
        text="continue_with"
        theme="outline"
        logo_alignment="left"
      />
    </div>
  );
}
