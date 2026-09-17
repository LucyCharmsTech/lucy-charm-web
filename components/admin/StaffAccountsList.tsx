'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react';
import { MfaAdminReset } from '@/components/security/MfaAdminReset';
import { serverMessage } from '@/lib/formStates';
import { fetchStaffAccounts } from '@/services/userService';
import type { StaffAccount } from '@/types/api';

/**
 * Staff accounts, and the two-step verification state of each.
 *
 * ### Why this screen exists
 *
 * Two-step verification is required for every agent and administrator, and a
 * colleague who loses their phone **and** their recovery codes can only get
 * back in if an administrator resets them. That reset was built and tested —
 * and had **no screen**, so the only way to perform it was to call the API by
 * hand.
 *
 * That left the brokerage's own rule — *"never share privileged accounts"* —
 * without a workable alternative behind it, which is the exact situation the
 * reset was built to prevent. A rule with no alternative gets ignored.
 *
 * ### Why "locked" is the column that matters
 *
 * *Set up* and *stuck* look the same on a list that only shows whether
 * two-step is enabled. The person an administrator is looking for has it
 * enabled and cannot get past it. So a locked account sorts to the top and is
 * the only row that draws attention.
 */

type StaffState = 'locked' | 'not_enrolled' | 'enrolled' | 'inactive';

function stateOf(account: StaffAccount): StaffState {
  if (account.deactivated_at) return 'inactive';
  // Checked before `mfa_enabled`, because a locked account *is* enrolled —
  // and reporting it as merely "protected" would hide the one case that needs
  // acting on.
  if (account.mfa_locked_until && new Date(account.mfa_locked_until) > new Date()) {
    return 'locked';
  }
  return account.mfa_enabled ? 'enrolled' : 'not_enrolled';
}

const STATE_ORDER: Record<StaffState, number> = {
  locked: 0,
  not_enrolled: 1,
  enrolled: 2,
  inactive: 3,
};

export function StaffAccountsList() {
  const [accounts, setAccounts] = useState<StaffAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchStaffAccounts()
      .then((page) => {
        if (active) setAccounts(page.items);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(serverMessage(err, 'Could not load staff accounts.'));
        setAccounts([]);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (accounts === null) {
    return (
      <div
        role="status"
        aria-label="Loading staff accounts"
        className="flex items-center gap-2 p-6 text-sm text-zinc-500"
      >
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
        No staff accounts yet.
      </p>
    );
  }

  // Locked first, then unenrolled, then everyone who is fine. The list is a
  // worklist, so it is ordered by who needs attention rather than by name.
  const sorted = [...accounts].sort(
    (a, b) => STATE_ORDER[stateOf(a)] - STATE_ORDER[stateOf(b)],
  );
  const needingAttention = sorted.filter((a) =>
    ['locked', 'not_enrolled'].includes(stateOf(a)),
  ).length;

  return (
    <div className="space-y-4">
      {needingAttention > 0 && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <strong>
            {needingAttention} {needingAttention === 1 ? 'account needs' : 'accounts need'}{' '}
            attention.
          </strong>{' '}
          Anyone locked out, or not yet set up, cannot use the site.
        </p>
      )}

      <ul className="space-y-3">
        {sorted.map((account) => (
          <StaffRow
            key={account.id}
            account={account}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        ))}
      </ul>
    </div>
  );
}

function StaffRow({
  account,
  onChanged,
}: {
  account: StaffAccount;
  onChanged: () => void;
}) {
  const state = stateOf(account);
  const name = `${account.first_name} ${account.last_name}`.trim() || account.email;

  return (
    <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {name}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {account.email} · {account.role === 'superadmin' ? 'Administrator' : 'Agent'}
          </p>
        </div>
        <StateBadge state={state} lockedUntil={account.mfa_locked_until} />
      </div>

      {state === 'locked' && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          {/* Says what to try before the irreversible option. A recovery code
              still works while the app codes are paused, so a reset is not the
              first thing to reach for. */}
          Too many incorrect codes. Their app codes are paused, but{' '}
          <strong>a recovery code still works right now</strong> — ask them to
          try one before resetting.
        </p>
      )}

      {state === 'not_enrolled' && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          They can sign in, but nothing else works until they finish setting
          two-step verification up. Nothing to do here — they complete it
          themselves.
        </p>
      )}

      {/*
        The reset is offered only where it is the right answer.
        - Not enrolled: there is nothing to reset.
        - Inactive: the account cannot sign in at all, so two-step is not what
          is stopping them.
        Showing a destructive action that would achieve nothing invites
        someone to try it.
      */}
      {(state === 'locked' || state === 'enrolled') && (
        <div className="mt-3">
          <MfaAdminReset
            userId={account.id}
            userLabel={name}
            onReset={onChanged}
          />
        </div>
      )}
    </li>
  );
}

function StateBadge({
  state,
  lockedUntil,
}: {
  state: StaffState;
  lockedUntil: string | null;
}) {
  if (state === 'locked') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
        <ShieldAlertIcon className="size-3.5" aria-hidden="true" />
        Locked out
        {lockedUntil && (
          <span className="font-normal">
            until {new Date(lockedUntil).toLocaleTimeString()}
          </span>
        )}
      </span>
    );
  }
  if (state === 'not_enrolled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <ShieldOffIcon className="size-3.5" aria-hidden="true" />
        Not set up
      </span>
    );
  }
  if (state === 'inactive') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Account inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
      <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
      Two-step on
    </span>
  );
}
