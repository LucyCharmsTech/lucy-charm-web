'use client';

import { useRef, useState } from 'react';
import { KeyRoundIcon, LoaderIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { verifyMfa, verifyMfaRecoveryCode } from '@/services/mfaService';
import type { AuthToken } from '@/types/api';

/**
 * The second step of sign-in — control 1.13 / C6.
 *
 * Reached after **any** first factor: Google, an emailed code, or a link
 * issued before the link route was retired. It is one component rather than
 * one per path, because the challenge is identical whatever proved the first
 * factor, and three copies would drift.
 *
 * The component does not seat the session itself. It hands the token pair back
 * through `onVerified`, so the caller keeps its own post-sign-in routing —
 * which differs between paths (a redirect param, an onboarding check) in ways
 * this form has no business knowing about.
 */

type MfaChallengeFormProps = {
  challengeToken: string;
  onVerified: (tokens: AuthToken) => void | Promise<void>;
  /** Back to the start of sign-in. */
  onCancel?: () => void;
};

export function MfaChallengeForm({
  challengeToken,
  onVerified,
  onCancel,
}: MfaChallengeFormProps) {
  // Two modes rather than two forms: someone reaching for a recovery code has
  // usually just failed with the app, and losing what they typed — or the page
  // they were on — would be the wrong moment to do it.
  const [mode, setMode] = useState<'app' | 'recovery'>('app');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRecovery = mode === 'recovery';
  const digits = value.replace(/\D/g, '');
  const canSubmit = isRecovery
    ? value.trim().length >= 8 && !loading
    : digits.length === 6 && !loading;

  function switchMode(next: 'app' | 'recovery') {
    setMode(next);
    setValue('');
    setError(null);
    // Focus after the label and input have swapped, so a screen reader
    // announces the field the user is now in rather than the one they left.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = isRecovery
        ? await verifyMfaRecoveryCode(challengeToken, value.trim())
        : await verifyMfa(challengeToken, digits);
      await onVerified(tokens);
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          isRecovery
            ? 'That recovery code is not valid or has already been used.'
            : 'That code was not correct. Please try again.',
        ),
      );
      // A rejected code is never right on a second submit, and a spent
      // recovery code never will be. Clearing stops the user pressing the
      // button again on the same value.
      setValue('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex items-start gap-2.5">
        <ShieldCheckIcon
          className="mt-0.5 size-5 shrink-0 text-primarycolor-text"
          aria-hidden="true"
        />
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Two-step verification
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {isRecovery
              ? 'Enter one of the recovery codes you saved when you set this up. Each code works once.'
              : 'Enter the 6-digit code from your authenticator app to finish signing in.'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mfa-code" className="text-sm font-medium">
          {isRecovery ? 'Recovery code' : '6-digit code'}
        </Label>
        <Input
          ref={inputRef}
          id="mfa-code"
          name={isRecovery ? 'recovery-code' : 'otp'}
          type="text"
          /*
           * `type="text"` with `inputMode="numeric"` rather than
           * `type="number"`, which strips leading zeros — and "012345" is a
           * valid code. `autoComplete="one-time-code"` lets a password manager
           * that stores the TOTP seed fill it directly.
           */
          inputMode={isRecovery ? 'text' : 'numeric'}
          autoComplete={isRecovery ? 'off' : 'one-time-code'}
          autoFocus
          required
          value={value}
          onChange={(event) =>
            setValue(
              // A recovery code is alphanumeric with separators; an authenticator
              // code is exactly six digits. Only the latter gets normalised.
              isRecovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6),
            )
          }
          placeholder={isRecovery ? 'abcd012345-6789abcdef' : '123456'}
          maxLength={isRecovery ? 40 : 6}
          aria-describedby={error ? 'mfa-code-error' : undefined}
          className={
            isRecovery
              ? 'h-11 rounded-xl font-mono'
              : 'h-11 rounded-xl text-center font-mono text-lg tracking-[0.4em]'
          }
          disabled={loading}
        />
      </div>

      {error && (
        <p
          id="mfa-code-error"
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Verifying...
          </span>
        ) : (
          'Verify and continue'
        )}
      </Button>

      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={() => switchMode(isRecovery ? 'app' : 'recovery')}
          disabled={loading}
          className="inline-flex items-center gap-1.5 font-semibold text-primarycolor-text hover:underline disabled:opacity-60"
        >
          <KeyRoundIcon className="size-3.5" aria-hidden="true" />
          {isRecovery ? 'Use my authenticator app' : "I can't use my app"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-zinc-500 hover:text-zinc-800 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Start over
          </button>
        )}
      </div>

      {isRecovery && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Out of recovery codes? An administrator can reset two-step
          verification for you — ask them rather than borrowing anyone&apos;s
          sign-in.
        </p>
      )}
    </form>
  );
}
