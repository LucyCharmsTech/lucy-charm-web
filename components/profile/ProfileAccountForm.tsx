'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCurrentUser } from '@/services/userService';
import type { UserMe } from '@/types/api';

type ProfileAccountFormProps = {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  /** Called after a successful PATCH so the parent can sync auth store. */
  onUpdated: (me: UserMe) => void;
};

export default function ProfileAccountForm({
  email,
  initialFirstName,
  initialLastName,
  onUpdated,
}: ProfileAccountFormProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const me = await updateCurrentUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      onUpdated(me);
      setMessage('Profile updated.');
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" value={email} disabled readOnly className="bg-zinc-50 dark:bg-zinc-900/50" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Email cannot be changed here.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-first">First name</Label>
          <Input
            id="profile-first"
            value={firstName}
            onChange={(ev) => setFirstName(ev.target.value)}
            autoComplete="given-name"
            required
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-last">Last name</Label>
          <Input
            id="profile-last"
            value={lastName}
            onChange={(ev) => setLastName(ev.target.value)}
            autoComplete="family-name"
            required
            maxLength={255}
          />
        </div>
      </div>
      {message && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
