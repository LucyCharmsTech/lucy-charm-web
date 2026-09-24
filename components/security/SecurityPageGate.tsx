'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MfaEnrolment } from '@/components/security/MfaEnrolment';
import { useAuthStore } from '@/stores/authStore';
import { useAuthHydrated } from '@/lib/useAuthHydrated';

/**
 * Keeps signed-out visitors off the two-step verification screen.
 *
 * `MfaEnrolment` asks the API for the caller's MFA status the moment it mounts.
 * With no session that request has no `Authorization` header, the API answers
 * FastAPI's stock `401 {"detail": "Not authenticated"}`, and the component
 * rendered that string in red. A client hit exactly this: their Google sign-up
 * had failed, so they were never signed in, and the page told them "Not
 * authenticated" instead of "you need to sign in" — which reads like two-step
 * verification is broken rather than like they are logged out.
 *
 * Signing in is the answer, so ask for it and come back here afterwards.
 */
export default function SecurityPageGate() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (!hydrated || accessToken) return;
    // `replace`, not `push`: a signed-out visit to this page is not a step
    // worth putting in history for the back button to return to.
    router.replace(`/login?redirect=${encodeURIComponent('/security')}`);
  }, [hydrated, accessToken, router]);

  if (!hydrated) {
    return (
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        Loading…
      </p>
    );
  }

  if (!accessToken) {
    return (
      <p
        role="status"
        className="text-sm text-zinc-600 dark:text-zinc-400"
      >
        Taking you to sign in…
      </p>
    );
  }

  return <MfaEnrolment />;
}
