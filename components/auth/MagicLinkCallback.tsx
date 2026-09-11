'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { getAccountStatusPath, getInactiveAccountDetails } from '@/lib/accountStatus';
import { verifyAccountRecovery, verifyMagicLink } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { isMfaChallenge, type AuthToken } from '@/types/api';
import { seatSession } from '@/lib/seatSession';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { getPostLoginPath } from '@/lib/postLoginRedirect';

export function MagicLinkCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const token = useMemo(() => searchParams.get('token'), [searchParams]);
  const redirectParam = useMemo(() => searchParams.get('redirect'), [searchParams]);
  const isRecovery = searchParams.get('flow') === 'recovery';
  const missingToken = !token;
  const [error, setError] = useState<string | null>(null);
  const [recoveryComplete, setRecoveryComplete] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  useEffect(() => {
    if (missingToken) {
      return;
    }

    let active = true;
    (isRecovery ? verifyAccountRecovery({ token }) : verifyMagicLink({ token }))
      .then(async (result) => {
        if (!active) return;
        if (isMfaChallenge(result)) {
          setChallenge(result.mfa_challenge_token);
          return;
        }
        const me = await seatSession(result, setAuth);
        if (!active) return;
        if (isRecovery) {
          setRecoveryComplete(true);
        } else {
          router.replace(getPostLoginPath(me.role, redirectParam, me.onboarding_completed));
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const inactiveDetails = getInactiveAccountDetails(err);
        if (inactiveDetails) {
          router.replace(getAccountStatusPath(inactiveDetails));
          return;
        }
        setError(getApiErrorMessage(err, 'This link is invalid or expired. Please request a new one.'));
      });

    return () => {
      active = false;
    };
  }, [isRecovery, missingToken, redirectParam, router, setAuth, token]);

  async function finishSignIn(tokens: AuthToken) {
    const me = await seatSession(tokens, setAuth);
    if (isRecovery) {
      setRecoveryComplete(true);
      return;
    }
    router.replace(getPostLoginPath(me.role, redirectParam, me.onboarding_completed));
  }

  if (challenge) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
          <MfaChallengeForm challengeToken={challenge} onVerified={finishSignIn} />
        </div>
      </div>
    );
  }

  if (recoveryComplete) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
        <ConfirmDialog
          open
          title="Your account has been recovered successfully"
          description="Your account and saved data are available again. Continue to your profile to check your data."
          confirmLabel="Continue to your profile to check your data"
          cancelLabel="Close"
          onConfirm={() => router.replace('/profile')}
          onCancel={() => router.replace('/profile')}
        />
      </div>
    );
  }

  if (missingToken || error) {
    const message = missingToken
      ? 'This link is missing its token.'
      : error;
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
            {isRecovery ? 'Recovery link problem' : 'Sign-in link problem'}
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>
          <Link
            href="/login"
            className="mt-5 inline-block text-sm font-semibold text-primarycolor-text hover:underline"
          >
            {isRecovery ? 'Back to account recovery' : 'Back to sign in'}
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
