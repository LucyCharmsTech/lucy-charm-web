'use client';

import { useState } from 'react';
import { ShieldOffIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { serverMessage } from '@/lib/formStates';
import { resetMfaForUser } from '@/services/mfaService';

/**
 * Superadmin: clear a colleague's two-step verification — control C6.
 *
 * *"Never share privileged accounts."*
 *
 * This is what makes that instruction **possible** rather than merely stated.
 * Without it, the answer to "my phone was replaced and I lost my recovery
 * codes" is for a colleague to hand over their own credentials — the exact
 * practice the control forbids. **Forbidding a thing while leaving no
 * alternative is how policies get ignored.**
 *
 * ### Why it asks for confirmation
 *
 * A reset removes someone's second factor and signs them out everywhere. It is
 * the single most powerful thing on the admin surface: done to the wrong
 * account, it strips protection from a colleague who has no idea. That is
 * worth one deliberate click, not a stray one.
 *
 * The server records who did it and when, at WARNING level, and refuses a
 * self-reset — a superadmin turning off their own MFA must use the normal
 * turn-off, which requires a live code.
 */
export function MfaAdminReset({
  userId,
  userLabel,
  onReset,
}: {
  userId: string;
  /** Shown in the confirmation, so nobody resets the wrong person. */
  userLabel: string;
  onReset?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      await resetMfaForUser(userId);
      setDone(true);
      setConfirming(false);
      onReset?.();
    } catch (err: unknown) {
      setError(
        serverMessage(err, 'Could not reset two-step verification for this account.'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        Two-step verification cleared for {userLabel}. They must set it up again
        before they can use their account, and their sessions have been signed
        out.
      </p>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
        <div className="flex items-start gap-2.5">
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">
              Clear two-step verification for {userLabel}?
            </p>
            {/* States every consequence, because a reset is irreversible from
                here — the codes and the secret are destroyed, not disabled. */}
            <p className="mt-0.5">
              Their authenticator setup and every recovery code will be
              destroyed, and they will be signed out everywhere. They cannot use
              their account again until they set it up afresh. This is recorded
              against your name.
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleReset()}
            className="h-9 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Clearing…' : 'Yes, clear it'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
            className="h-9 rounded-xl text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
        className="h-9 rounded-xl text-sm"
      >
        <span className="inline-flex items-center gap-1.5">
          <ShieldOffIcon className="size-3.5" aria-hidden="true" />
          Reset two-step verification
        </span>
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        For a colleague who has lost their phone and their recovery codes — so
        nobody has to share a sign-in.
      </p>
    </div>
  );
}
