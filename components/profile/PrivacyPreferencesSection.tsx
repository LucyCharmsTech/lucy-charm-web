'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  fetchPrivacyPreferences,
  updatePrivacyPreferences,
} from '@/services/userService';
import type { UserPrivacyPreferences } from '@/types/api';

export default function PrivacyPreferencesSection() {
  const [prefs, setPrefs] = useState<UserPrivacyPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPrivacyPreferences()
      .then((data) => {
        if (!active) return;
        setPrefs(data);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load privacy preferences.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePrivacyPreferences(prefs);
      setPrefs(updated);
      setSuccess('Privacy preferences saved.');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not save privacy preferences.'));
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof UserPrivacyPreferences) {
    setPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
    setSuccess(null);
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
      aria-labelledby="privacy-preferences-heading"
    >
      <h2 id="privacy-preferences-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Privacy & notifications
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Control how Lucy Charms contacts you and uses your preferences.
      </p>

      {loading && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          Loading preferences…
        </p>
      )}

      {!loading && prefs && (
        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primarycolor"
              checked={prefs.listing_alerts_enabled}
              onChange={() => toggle('listing_alerts_enabled')}
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Listing alerts
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Email me when new homes match my saved searches and preferences.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primarycolor"
              checked={prefs.marketing_emails_enabled}
              onChange={() => toggle('marketing_emails_enabled')}
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Marketing emails
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Product tips, market insights, and promotional updates.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primarycolor"
              checked={prefs.product_updates_enabled}
              onChange={() => toggle('product_updates_enabled')}
            />
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Product updates
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Important changes to features, policies, or your account.
              </span>
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
              {success}
            </p>
          )}

          <Button
            type="button"
            className="rounded-xl bg-primarycolor text-white hover:bg-primarycolor/90"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      )}
    </section>
  );
}
