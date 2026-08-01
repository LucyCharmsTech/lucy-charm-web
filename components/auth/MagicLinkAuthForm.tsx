'use client';

import { useState } from 'react';
import { LoaderIcon, MailIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { requestMagicLink } from '@/services/authService';

type MagicLinkAuthFormProps = {
  redirectPath?: string | null;
  /** Signup shows a required name field; sign-in is email only. */
  mode?: 'signin' | 'signup';
};

export function MagicLinkAuthForm({ redirectPath, mode = 'signin' }: MagicLinkAuthFormProps) {
  const isSignup = mode === 'signup';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit =
    Boolean(email.trim()) && (!isSignup || Boolean(fullName.trim())) && !loading;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await requestMagicLink({
        email: email.trim(),
        redirect_path: redirectPath ?? undefined,
        ...(isSignup ? { full_name: fullName.trim() } : {}),
      });
      setSent(true);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not send magic link. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
        Check your inbox for a secure sign-in link.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {isSignup && (
        <div className="space-y-1.5">
          <Label htmlFor="magic-link-full-name" className="text-sm font-medium">
            Full name
          </Label>
          <Input
            id="magic-link-full-name"
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
        <Label htmlFor="magic-link-email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="magic-link-email"
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
        disabled={!canSubmit}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor disabled:opacity-60"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Sending link...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <MailIcon className="size-4" aria-hidden="true" />
            {isSignup ? 'Send sign-up link' : 'Send magic link'}
          </span>
        )}
      </Button>
    </form>
  );
}
