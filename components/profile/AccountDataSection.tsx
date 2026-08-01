'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadIcon, LoaderIcon, ShieldAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  deactivateCurrentAccount,
  deleteCurrentAccount,
  exportCurrentUserData,
  submitDataRequest,
} from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';

const DATA_REQUEST_TYPES = [
  { value: 'access', label: 'Access my data' },
  { value: 'correction', label: 'Correct my data' },
  { value: 'portability', label: 'Portability request' },
  { value: 'deletion', label: 'Deletion request (human review)' },
] as const;

export default function AccountDataSection() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [exporting, setExporting] = useState(false);
  const [requestType, setRequestType] = useState<(typeof DATA_REQUEST_TYPES)[number]['value']>('access');
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const data = await exportCurrentUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lucy-charms-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export download has started.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not export your data.'));
    } finally {
      setExporting(false);
    }
  }

  async function handleDataRequest() {
    setSubmittingRequest(true);
    setError(null);
    setMessage(null);
    try {
      const res = await submitDataRequest({
        request_type: requestType,
        notes: requestNotes.trim() || undefined,
      });
      setMessage(res.detail);
      setRequestNotes('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not submit your privacy request.'));
    } finally {
      setSubmittingRequest(false);
    }
  }

  async function handleDeactivate() {
    const confirmed = window.confirm(
      'Deactivate your account? You will be signed out and will need support to reactivate.',
    );
    if (!confirmed) return;
    setDeactivating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await deactivateCurrentAccount();
      clearAuth();
      router.replace('/');
      setMessage(res.detail);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not deactivate your account.'));
    } finally {
      setDeactivating(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Permanently delete your account? This soft-deletes your profile, revokes sessions, and disables notifications.',
    );
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await deleteCurrentAccount();
      clearAuth();
      router.replace('/');
      setMessage(res.detail);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not delete your account.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
      aria-labelledby="account-data-heading"
    >
      <div className="flex items-start gap-3">
        <ShieldAlertIcon className="mt-0.5 size-5 text-primarycolor" aria-hidden="true" />
        <div>
          <h2 id="account-data-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Data & account controls
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Export a copy of your data, submit a privacy request, deactivate, or delete your account.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <span className="inline-flex items-center gap-2">
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                Preparing export…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <DownloadIcon className="size-4" aria-hidden="true" />
                Download my data (JSON)
              </span>
            )}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <Label htmlFor="data-request-type" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Privacy request
          </Label>
          <select
            id="data-request-type"
            value={requestType}
            onChange={(event) =>
              setRequestType(event.target.value as (typeof DATA_REQUEST_TYPES)[number]['value'])
            }
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {DATA_REQUEST_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={requestNotes}
            onChange={(event) => setRequestNotes(event.target.value)}
            placeholder="Optional notes for our privacy team"
            rows={3}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={submittingRequest}
            onClick={() => void handleDataRequest()}
          >
            {submittingRequest ? 'Submitting…' : 'Submit privacy request'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
            disabled={deactivating}
            onClick={() => void handleDeactivate()}
          >
            {deactivating ? 'Deactivating…' : 'Deactivate account'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
