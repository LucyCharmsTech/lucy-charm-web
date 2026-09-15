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

import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import { googleLogin } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { isMfaChallenge, type AuthToken } from '@/types/api';
import { seatSession } from '@/lib/seatSession';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import {
  getAccountStatusPath,
  getInactiveAccountDetails,
} from '@/lib/accountStatus';

/** The range Google's rendered button accepts; outside it the width is ignored. */
const GOOGLE_MIN_WIDTH = 200;
const GOOGLE_MAX_WIDTH = 400;

/** How long to wait for Google's iframe before calling it unavailable. */
const GOOGLE_RENDER_GRACE_MS = 3500;

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

  // Google's button is rendered in an iframe that only accepts a pixel width —
  // percentages are ignored. A hardcoded 400 overflowed every phone: on a
  // 390px viewport it pushed the document to 449px, so `/login`, `/register`
  // and `/onboarding` all scrolled sideways. Measure the container instead and
  // clamp to the range Google accepts.
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(GOOGLE_MAX_WIDTH);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => {
      const available = node.clientWidth;
      if (!available) return;
      setButtonWidth(
        Math.max(
          GOOGLE_MIN_WIDTH,
          Math.min(GOOGLE_MAX_WIDTH, Math.floor(available)),
        ),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Google renders its button into an iframe it fetches itself. When the site's
  // origin is not on the client ID's authorised list, that fetch 403s and
  // nothing is drawn: no error, no callback, just an empty space where a button
  // should be. A client reported "signing up with Google" not working and then
  // hitting a wall on two-step verification, which is what that looks like from
  // the outside — they were never signed in at all.
  //
  // `onError` does not cover this; it fires for a failed credential, not for a
  // button that never appeared. So check whether anything actually rendered.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Generous, because this competes with a slow network rather than with
    // anything of ours. A late render clears the message on the next check.
    const timer = window.setTimeout(() => {
      setUnavailable(node.childElementCount === 0);
    }, GOOGLE_RENDER_GRACE_MS);

    return () => window.clearTimeout(timer);
  }, []);

  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  async function finishSignIn(tokens: AuthToken) {
    const me = await seatSession(tokens, setAuth);
    router.push(
      getPostLoginPath(me.role, redirectParam ?? null, me.onboarding_completed),
    );
  }

  async function handleCredential(credentialResponse: { credential?: string }) {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      onError?.('No credential received from Google. Please try again.');
      return;
    }

    onStart?.();
    setLoading(true);

    try {
      const result = await googleLogin(idToken);

      if (isMfaChallenge(result)) {
        setChallenge(result.mfa_challenge_token);
        return;
      }

      await finishSignIn(result);
    } catch (err: unknown) {
      const inactiveDetails = getInactiveAccountDetails(err);
      if (inactiveDetails) {
        router.push(getAccountStatusPath(inactiveDetails));
        return;
      }
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Google sign-in failed. Please try again.';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  if (challenge) {
    return (
      <MfaChallengeForm
        challengeToken={challenge}
        onVerified={finishSignIn}
        onCancel={() => setChallenge(null)}
      />
    );
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
    <>
      <div
        ref={containerRef}
        className="w-full [&>div]:w-full [&>div>div]:w-full"
      >
        <GoogleLogin
          onSuccess={handleCredential}
          onError={() => onError?.('Google sign-in was cancelled or failed.')}
          width={String(buttonWidth)}
          shape="rectangular"
          size="large"
          text="continue_with"
          theme="outline"
          logo_alignment="left"
        />
      </div>
      {unavailable && (
        <p
          role="status"
          className="mt-2 text-xs text-zinc-600 dark:text-zinc-400"
        >
          Google sign-in is unavailable right now. You can sign in with your
          email address below instead.
        </p>
      )}
    </>
  );
}
