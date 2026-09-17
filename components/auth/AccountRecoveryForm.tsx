'use client';

import { useState } from 'react';
import { LoaderIcon, MailIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { requestAccountRecovery } from '@/services/authService';

type AccountRecoveryFormProps = {
  initialEmail?: string;
};

export default function AccountRecoveryForm({ initialEmail = '' }: AccountRecoveryFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestAccountRecovery({ email: email.trim() });
      setSent(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not request account recovery. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        If your account is eligible, check your inbox for a recovery link. The link expires in 20 minutes.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="account-recovery-email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="account-recovery-email"
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
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!email.trim() || loading}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Sending link...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <MailIcon className="size-4" aria-hidden="true" />
            Send recovery link
          </span>
        )}
      </Button>
    </form>
  );
}
