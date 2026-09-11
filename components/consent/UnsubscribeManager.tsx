'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  ALL_PROMOTIONAL,
  CONSENT_STREAMS,
  STREAM_DESCRIPTIONS,
  STREAM_LABELS,
  fetchUnsubscribeState,
  resubscribeStream,
  unsubscribeStream,
  type ConsentStream,
} from '@/services/unsubscribeService';
import type { UnsubscribeState } from '@/types/api';

/**
 * The whole unsubscribe experience, with no session.
 *
 * Three things here exist because the client asked for them specifically:
 *
 *   * every stream is listed separately, and each can be switched
 *     independently ("a separate choice per stream");
 *   * one control switches everything promotional off ("plus a stop-all");
 *   * the page shows what was turned off, and offers an undo — an accidental
 *     tap on a footer link must be recoverable, and re-enabling is one
 *     explicit choice at a time rather than a blanket "turn it all back on".
 */
export function UnsubscribeManager() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // The footer's second link carries `stop_all=1` so that line is a single click.
  const stopAllOnArrival = searchParams.get('stop_all') === '1';

  const [state, setState] = useState<UnsubscribeState | null>(null);
  // Starts false when there is no token: a link with nothing to look up is
  // decided at render time, not by an effect, so nothing sets state
  // synchronously inside one.
  const [loading, setLoading] = useState(Boolean(token));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    // Applying the stop-all on arrival rather than after a second click is
    // what makes the footer's "Stop all promotional emails" line honest.
    const request = stopAllOnArrival
      ? unsubscribeStream(token, ALL_PROMOTIONAL)
      : fetchUnsubscribeState(token);

    request
      .then((next) => {
        if (!active) return;
        setState(next);
        if (stopAllOnArrival) {
          setLastChange('All promotional emails are now switched off.');
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          getApiErrorMessage(
            err,
            'We could not open your email preferences. Please use the link in a recent email.',
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stopAllOnArrival, token]);

  async function change(
    stream: ConsentStream | typeof ALL_PROMOTIONAL,
    turnOn: boolean,
    label: string,
  ) {
    if (!token) return;
    setPending(stream);
    setError(null);
    setLastChange(null);
    try {
      const next = turnOn
        ? await resubscribeStream(token, stream as ConsentStream)
        : await unsubscribeStream(token, stream);
      setState(next);
      setLastChange(
        turnOn ? `${label} is switched back on.` : `${label} is switched off.`,
      );
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'We could not save that change. Please try again.'));
    } finally {
      setPending(null);
    }
  }

  if (!token) {
    return (
      <Card>
        <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
          We could not open this link
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          This link is missing its token. Please use the link in a recent email.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading your email preferences…
        </p>
      </Card>
    );
  }

  if (error && !state) {
    return (
      <Card>
        <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
          We could not open this link
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{error}</p>
      </Card>
    );
  }

  if (!state) return null;

  const everythingOff = CONSENT_STREAMS.every((s) => !state.streams[s]);

  return (
    <Card>
      <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
        Email preferences
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        These settings apply to <span className="font-semibold">{state.email}</span>. You do
        not need to sign in to change them.
      </p>

      {lastChange && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
        >
          <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{lastChange}</span>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
        {CONSENT_STREAMS.map((stream) => {
          const on = Boolean(state.streams[stream]);
          const label = STREAM_LABELS[stream];
          return (
            <li key={stream} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {STREAM_DESCRIPTIONS[stream]}
                </p>
                <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {on ? 'On' : 'Off'}
                </p>
              </div>
              <Button
                type="button"
                variant={on ? 'outline' : 'default'}
                disabled={pending !== null}
                onClick={() => void change(stream, !on, label)}
                className="shrink-0"
              >
                {pending === stream ? (
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                ) : on ? (
                  'Unsubscribe'
                ) : (
                  'Resubscribe'
                )}
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        {everythingOff ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You are not receiving any promotional emails from Lucy Charms Realty. You will
            still get service emails about requests you make, such as a showing confirmation.
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Stop all promotional emails
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Switches off everything above at once. Service emails about requests you make,
              such as a showing confirmation, are not affected.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() =>
                void change(ALL_PROMOTIONAL, false, 'All promotional email')
              }
              className="mt-3"
            >
              {pending === ALL_PROMOTIONAL ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                'Stop all promotional emails'
              )}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
      {children}
    </div>
  );
}
