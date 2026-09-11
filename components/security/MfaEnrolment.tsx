'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  LoaderIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MfaRecoveryCodes } from '@/components/security/MfaRecoveryCodes';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  regenerateRecoveryCodes,
  startMfaSetup,
} from '@/services/mfaService';
import type { MfaStatus } from '@/types/api';

/**
 * The enrolment screen — control 1.13 / C6's *"missing enrolment screen"*.
 *
 * Before this, turning MFA on required running `app/scripts/setup_mfa.py`
 * against production. A control that needs a shell script to adopt has an
 * adoption rate of zero, which is why the machinery could exist in full and
 * protect nobody.
 *
 * One component covers the whole lifecycle — set up, regenerate codes, turn
 * off — because they are one subject and a person arriving here wants to see
 * the current state before choosing. Splitting them across pages would mean
 * three routes that each have to re-answer "is it on?".
 */

type View = 'loading' | 'idle' | 'scanning' | 'codes' | 'disabling';

export function MfaEnrolment() {
  const [view, setView] = useState<View>('loading');
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Setup in progress
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  // Codes to show once
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesReplacedPrevious, setCodesReplacedPrevious] = useState(false);

  // Turning it off / regenerating both need a live code.
  const [confirmOtp, setConfirmOtp] = useState('');

  // `reloadKey` rather than calling `setStatus` from an effect that also
  // depends on it — a counter is what re-runs the load without the effect
  // writing to its own dependency.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchMfaStatus()
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setView('idle');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          getApiErrorMessage(err, 'Could not load your security settings.'),
        );
        setView('idle');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function beginSetup() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const setup = await startMfaSetup();
      setSecret(setup.secret);
      /*
       * The QR is rendered in the browser from the `otpauth://` URI rather
       * than fetched as an image. A remote QR service would be handed the
       * TOTP seed — the whole secret, to a third party, in a URL that lands
       * in their logs.
       */
      setQrDataUrl(
        await QRCode.toDataURL(setup.totp_uri, { width: 220, margin: 1 }),
      );
      setOtp('');
      setView('scanning');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not start setup. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    if (!secret || otp.replace(/\D/g, '').length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enableMfa(secret, otp.replace(/\D/g, ''));
      setCodes(result.recovery_codes);
      setCodesReplacedPrevious(false);
      // Drop the seed as soon as it is no longer needed. It is on the server
      // now, and holding it in component state past that point is a copy with
      // no purpose.
      setSecret(null);
      setQrDataUrl(null);
      setOtp('');
      setView('codes');
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          'That code did not match. Check your app is showing the Lucy Charms entry.',
        ),
      );
      setOtp('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(event: React.FormEvent) {
    event.preventDefault();
    const digits = confirmOtp.replace(/\D/g, '');
    if (digits.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await regenerateRecoveryCodes(digits);
      setCodes(result.recovery_codes);
      setCodesReplacedPrevious(true);
      setConfirmOtp('');
      setView('codes');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'That code was not correct.'));
      setConfirmOtp('');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: React.FormEvent) {
    event.preventDefault();
    const digits = confirmOtp.replace(/\D/g, '');
    if (digits.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await disableMfa(digits);
      setConfirmOtp('');
      setNotice(
        status?.required
          ? 'Two-step verification is off. You will need to set it up again before you can use your account — it is required for staff.'
          : 'Two-step verification is off. You have been signed out everywhere else.',
      );
      setView('idle');
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'That code was not correct.'));
      setConfirmOtp('');
    } finally {
      setBusy(false);
    }
  }

  if (view === 'loading') {
    return (
      <div
        role="status"
        aria-label="Loading security settings"
        className="flex items-center gap-2 p-6 text-sm text-zinc-500"
      >
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  // ── Show the codes ─────────────────────────────────────────────────────────
  if (view === 'codes' && codes) {
    return (
      <MfaRecoveryCodes
        codes={codes}
        replacedPrevious={codesReplacedPrevious}
        onDone={() => {
          setCodes(null);
          setView('idle');
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  // ── Scan and confirm ───────────────────────────────────────────────────────
  if (view === 'scanning' && secret) {
    return (
      <form onSubmit={confirmSetup} className="space-y-4" noValidate>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Scan this with your authenticator app
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            Use any authenticator app — Google Authenticator, 1Password, Authy
            or the one built into your password manager.
          </p>
        </div>

        {qrDataUrl && (
          <div className="flex justify-center rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              width={220}
              height={220}
              alt="QR code for setting up two-step verification"
            />
          </div>
        )}

        <details className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Can&apos;t scan it?
          </summary>
          {/*
            The plain seed matters more than it looks: someone setting this up
            on the same device as their password manager has no second camera
            to point at their own screen.
          */}
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Enter this key in your app instead:
          </p>
          <code className="mt-1.5 block break-all rounded-lg bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-800">
            {secret}
          </code>
        </details>

        <div className="space-y-1.5">
          <Label htmlFor="mfa-setup-otp" className="text-sm font-medium">
            Enter the 6-digit code your app shows
          </Label>
          <Input
            id="mfa-setup-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            maxLength={6}
            className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.4em]"
            disabled={busy}
            aria-describedby={error ? 'mfa-setup-error' : undefined}
          />
        </div>

        {error && (
          <p
            id="mfa-setup-error"
            role="alert"
            className="text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={busy || otp.replace(/\D/g, '').length !== 6}
            className="h-11 flex-1 rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
          >
            {busy ? 'Confirming…' : 'Turn on'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              // Nothing was saved server-side, so cancelling really does leave
              // the account untouched — see `startMfaSetup`.
              setSecret(null);
              setQrDataUrl(null);
              setOtp('');
              setError(null);
              setView('idle');
            }}
            className="h-11 rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ── Turning it off ─────────────────────────────────────────────────────────
  if (view === 'disabling') {
    return (
      <form onSubmit={handleDisable} className="space-y-4" noValidate>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Turn off two-step verification
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            Enter a code from your app to confirm it is you. Everything else
            signed in to this account will be signed out.
          </p>
          {status?.required && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Your account is staff, so two-step verification is required. You
              will be asked to set it up again before you can do anything else
              — use this if you are switching to a new authenticator app.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mfa-disable-otp" className="text-sm font-medium">
            6-digit code
          </Label>
          <Input
            id="mfa-disable-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={confirmOtp}
            onChange={(event) => setConfirmOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            maxLength={6}
            className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.4em]"
            disabled={busy}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={busy || confirmOtp.replace(/\D/g, '').length !== 6}
            className="h-11 flex-1 rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Turning off…' : 'Turn off'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirmOtp('');
              setError(null);
              setView('idle');
            }}
            className="h-11 rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ── The resting state ──────────────────────────────────────────────────────
  const enabled = status?.enabled ?? false;
  const required = status?.required ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        {enabled ? (
          <ShieldCheckIcon
            className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        ) : required ? (
          <ShieldAlertIcon
            className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        ) : (
          <ShieldOffIcon
            className="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400"
            aria-hidden="true"
          />
        )}
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Two-step verification
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {/*
              Three distinct states, deliberately not two. "Required and off"
              is not the same message as "optional and off": one is a task the
              person has to finish before they can work, the other is an offer.
            */}
            {enabled
              ? 'On. You are asked for a code from your app each time you sign in.'
              : required
                ? 'Your account has access to client records, so this is required. Set it up to continue.'
                : 'Add a second step at sign-in, so a stolen password or inbox is not enough on its own.'}
          </p>
        </div>
      </div>

      {enabled && status && (
        <dl className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500 dark:text-zinc-400">Recovery codes left</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {status.recovery_codes_remaining}
            </dd>
          </div>
          {status.recovery_codes_remaining <= 2 && (
            // Surfaced as a warning rather than a number alone: someone at one
            // code left is one lost phone from a support ticket, and they will
            // not notice a small number in a list.
            <p
              role="alert"
              className="mt-2 text-amber-700 dark:text-amber-400"
            >
              {status.recovery_codes_remaining === 0
                ? 'You have no recovery codes left. Create a new set now — without one, a lost phone means asking an administrator to reset this.'
                : 'You are nearly out of recovery codes. Create a new set.'}
            </p>
          )}
          {status.locked && (
            <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
              Too many incorrect codes were entered. Codes from your app are
              temporarily refused; a recovery code still works.
            </p>
          )}
        </dl>
      )}

      {notice && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!enabled && (
        <Button
          type="button"
          onClick={() => void beginSetup()}
          disabled={busy}
          className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
        >
          {busy ? 'Starting…' : 'Set up two-step verification'}
        </Button>
      )}

      {enabled && (
        <form onSubmit={handleRegenerate} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-manage-otp" className="text-sm font-medium">
              Enter a code from your app to make changes
            </Label>
            <Input
              id="mfa-manage-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={confirmOtp}
              onChange={(event) => setConfirmOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="h-11 rounded-xl text-center font-mono text-lg tracking-[0.4em]"
              disabled={busy}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {/* Says why, because "enter a code to do a thing you are already
                  signed in for" reads as friction until the reason is given. */}
              We ask for this so that someone who picks up your unlocked laptop
              cannot quietly remove it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={busy || confirmOtp.replace(/\D/g, '').length !== 6}
              className="h-10 rounded-xl"
            >
              New recovery codes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                setView('disabling');
              }}
              className="h-10 rounded-xl text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Turn off
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
