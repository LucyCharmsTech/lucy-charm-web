'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, LoaderIcon, MailIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { getAccountStatusPath, getInactiveAccountDetails } from '@/lib/accountStatus';
import { seatSession } from '@/lib/seatSession';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { requestEmailCode, verifyEmailCode } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';
import { isMfaChallenge, type AuthToken } from '@/types/api';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { PrivacyLink } from '@/components/common/PrivacyLink';

/**
 * Email sign-in by one-time code.
 *
 * Control 2.4: "Use Continue with Google, Continue with Apple and Continue with
 * email. **Email uses a one-time code**; avoid customer-facing 'magic link'
 * jargon." This replaced `MagicLinkAuthForm`, which has been removed — the
 * form that issued links is exactly what Q1's "then stop issuing new links"
 * refers to.
 *
 * The link flow is not deleted — the client's Q1 requires links already issued
 * to be honoured until their original expiry, so `/auth/magic-link` and its
 * callback stay in place. Nothing sends a new one.
 *
 * Two steps, one component, because they are one task: the email step and the
 * code step share the address, and splitting them across components would mean
 * lifting that state somewhere just to pass it back down.
 */

type EmailCodeAuthFormProps = {
  redirectPath?: string | null;
  /** Sign-up asks for a name; sign-in is email only. */
  mode?: 'signin' | 'signup';
};

export function EmailCodeAuthForm({
  redirectPath,
  mode = 'signin',
}: EmailCodeAuthFormProps) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isSignup = mode === 'signup';

  // 'mfa' is the second factor — control 1.13 requires it on every sign-in
  // path, and a correct emailed code is only the first one.
  const [step, setStep] = useState<'email' | 'code' | 'mfa'>('email');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Distinct from `error` so the offer to register appears only for the one
  // cause it answers, and not for a network failure or a rate limit.
  const [noAccount, setNoAccount] = useState(false);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Move focus to the code box when it appears, so the user can type straight
  // away rather than hunting for it after switching apps to read the email.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  const canRequest =
    Boolean(email.trim()) && (!isSignup || Boolean(fullName.trim())) && !loading;
  // Six digits, after stripping whatever separators were pasted.
  const digits = code.replace(/\D/g, '');
  const canVerify = digits.length === 6 && !loading;

  function handleInactiveAccount(err: unknown): boolean {
    const details = getInactiveAccountDetails(err);
    if (!details) return false;
    router.push(getAccountStatusPath(details, email.trim()));
    return true;
  }

  async function sendCode({ resend = false }: { resend?: boolean } = {}) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setNoAccount(false);
    try {
      const result = await requestEmailCode({
        email: email.trim(),
        redirect_path: redirectPath ?? undefined,
        ...(isSignup ? { full_name: fullName.trim() } : {}),
      });
      setExpiresInMinutes(result.expires_in_minutes);
      setStep('code');
      // Requesting a new code retires the previous one server-side, so the
      // box is cleared rather than left holding a value that no longer works.
      setCode('');
      if (resend) setNotice('A new code is on its way.');
    } catch (err: unknown) {
      if (handleInactiveAccount(err)) return;
      // 404 is the API saying this address has no account. Stay on this step —
      // advancing to the code screen would ask for a code that was never sent.
      setNoAccount(
        (err as { response?: { status?: number } })?.response?.status === 404,
      );
      setError(
        getApiErrorMessage(err, 'Could not send the code. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!canRequest) return;
    await sendCode();
  }

  async function finishSignIn(tokens: AuthToken) {
    const me = await seatSession(tokens, setAuth);
    router.replace(
      getPostLoginPath(me.role, redirectPath ?? null, me.onboarding_completed),
    );
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!canVerify) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await verifyEmailCode({ email: email.trim(), code: digits });
      // A staff account gets a challenge here rather than a session. Reading
      // `access_token` off that would seat a broken session — which is why the
      // API type is a union and this branch is not optional.
      if (isMfaChallenge(result)) {
        setChallengeToken(result.mfa_challenge_token);
        setStep('mfa');
        return;
      }
      await finishSignIn(result);
    } catch (err: unknown) {
      if (handleInactiveAccount(err)) return;
      setError(
        getApiErrorMessage(err, 'That code is not valid. Please try again.'),
      );
      // Clear on failure: a rejected code is never right on a second submit,
      // and leaving it invites the user to press the button again.
      setCode('');
      codeInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: the second factor ──────────────────────────────────────────────
  if (step === 'mfa' && challengeToken) {
    return (
      <MfaChallengeForm
        challengeToken={challengeToken}
        onVerified={finishSignIn}
        onCancel={() => {
          // Back to the address, not to the code box: the emailed code was
          // spent by the request that produced this challenge, so offering it
          // again would just fail.
          setStep('email');
          setChallengeToken(null);
          setCode('');
          setError(null);
          setNotice(null);
        }}
      />
    );
  }

  // ── Step 2: enter the code ─────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="space-y-4" noValidate>
        <div>
          {/*
            A definite claim, and true on both paths: sign-up has just created
            the account, and sign-in for an address with no account is refused
            before this step, so reaching it means the code really was sent.
          */}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {email.trim()}
            </span>
            .
          </p>
          {expiresInMinutes !== null && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              It expires in {expiresInMinutes} minutes and can only be used once.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-code" className="text-sm font-medium">
            6-digit code
          </Label>
          <Input
            ref={codeInputRef}
            id="email-code"
            name="code"
            /*
             * `inputMode="numeric"` gives a number pad without `type="number"`,
             * which would strip leading zeros — and "012345" is a valid code.
             * `autoComplete="one-time-code"` is what lets iOS and Android
             * offer the code straight from the notification.
             */
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            /*
             * Exactly six, because the code is exactly six. This was 7 to let a
             * pasted "123 456" through, but that also let someone type a
             * seventh digit — which silently left the submit button disabled
             * with nothing on screen explaining why. Stripping separators in
             * `onChange` instead keeps paste working and makes the limit honest.
             */
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            aria-describedby={error ? 'email-code-error' : undefined}
            className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.4em]"
            disabled={loading}
          />
        </div>

        {notice && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {notice}
          </p>
        )}

        {error && (
          <p
            id="email-code-error"
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={!canVerify}
          className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Verifying...
            </span>
          ) : (
            'Continue'
          )}
        </Button>

        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
              setNotice(null);
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-800 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            Use a different email
          </button>
          <button
            type="button"
            onClick={() => void sendCode({ resend: true })}
            disabled={loading}
            className="font-semibold text-primarycolor-text hover:underline disabled:opacity-60"
          >
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  // ── Step 1: enter the email ────────────────────────────────────────────────
  return (
    <form onSubmit={handleRequest} className="space-y-4" noValidate>
      {isSignup && (
        <div className="space-y-1.5">
          <Label htmlFor="email-code-full-name" className="text-sm font-medium">
            Full name
          </Label>
          <Input
            id="email-code-full-name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Smith"
            className="h-11 rounded-xl"
            disabled={loading}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email-code-email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="email-code-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-xl"
          disabled={loading}
        />
      </div>

      {error && (
        <div role="alert" className="space-y-1">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          {noAccount && !isSignup && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Check the spelling, or{' '}
              <Link
                href="/register"
                className="font-semibold text-primarycolor-text hover:underline"
              >
                create an account
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        disabled={!canRequest}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Sending code...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <MailIcon className="size-4" aria-hidden="true" />
            {isSignup ? 'Send sign-up code' : 'Send sign-in code'}
          </span>
        )}
      </Button>

      {/*
        What creating an account actually does with the address.
        A statement about this software, checked against the code — not a
        promise about how the brokerage operates.

        No retention sentence: nothing is deleted today because no schedule
        has been set, and promising a deletion date nobody has agreed would
        be false.
      */}
      {isSignup && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          We use your email address to sign you in and to keep your saved homes
          and searches with your account. Saving a search does not sign you up
          for emails — that is a separate choice you make, and you can change
          it at any time.
          <PrivacyLink />
        </p>
      )}
    </form>
  );
}
