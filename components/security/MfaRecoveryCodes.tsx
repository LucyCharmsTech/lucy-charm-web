'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The one and only time the recovery codes are readable.
 *
 * The server stores hashes, so there is no endpoint that can show these again
 * — this screen has to say that plainly, and it has to make saving them easy
 * enough that people actually do. A recovery path nobody kept a copy of is a
 * recovery path that does not exist, and the failure only shows up months
 * later when someone is already locked out.
 *
 * The confirm checkbox is not ceremony: it is the difference between a person
 * who has saved these and a person who clicked past a wall of text. It gates
 * the button that dismisses the screen.
 */

type MfaRecoveryCodesProps = {
  codes: string[];
  onDone: () => void;
  /** Set when the codes replaced an earlier set that no longer works. */
  replacedPrevious?: boolean;
};

export function MfaRecoveryCodes({
  codes,
  onDone,
  replacedPrevious = false,
}: MfaRecoveryCodesProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const asText = codes.join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused outright — an insecure origin, a
      // permissions policy, a browser that simply says no. The codes are on
      // screen and downloadable, so this is a convenience failing, not the
      // feature failing, and an error banner here would suggest otherwise.
    }
  }

  function download() {
    const blob = new Blob(
      [
        'Lucy Charms Realty — two-step verification recovery codes\n',
        '\n',
        'Each code can be used once, in place of your authenticator app.\n',
        'Keep them somewhere you can reach without your phone.\n',
        '\n',
        asText,
        '\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lucy-charms-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
        <TriangleAlertIcon
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Save these now — they are shown once.</p>
          <p className="mt-0.5">
            We store them scrambled, so we cannot show them again. Each code
            works once, in place of your authenticator app.
            {replacedPrevious &&
              ' Your previous codes stopped working the moment these were created.'}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm sm:grid-cols-2 dark:border-zinc-700 dark:bg-zinc-900">
        {codes.map((code) => (
          <li key={code} className="text-zinc-800 dark:text-zinc-200">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy()}
          className="h-10 rounded-xl"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4" aria-hidden="true" />
              Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy all
            </span>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={download}
          className="h-10 rounded-xl"
        >
          <span className="inline-flex items-center gap-1.5">
            <DownloadIcon className="size-4" aria-hidden="true" />
            Download
          </span>
        </Button>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 rounded border-zinc-300 text-primarycolor-text focus:ring-primarycolor"
        />
        <span>
          I have saved these codes somewhere I can reach without my phone.
        </span>
      </label>

      <Button
        type="button"
        onClick={onDone}
        disabled={!confirmed}
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
      >
        Done
      </Button>
    </div>
  );
}
