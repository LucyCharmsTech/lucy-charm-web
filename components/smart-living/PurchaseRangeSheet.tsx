'use client';

/**
 * Purchase-range picker: tap to open, bottom sheet on mobile, popover on desktop.
 *
 * Spec A3 is specific about the shape of this control, and each requirement is
 * there because of a way the obvious version fails:
 *
 * - **The full band list is never rendered inline.** There are seventeen closed
 *   bands across two branches. Inline, that is a wall of options above the
 *   fold and a scroll-hostile mobile page.
 * - **"Enter my own amount" is always one tap away** — top level *and* inside
 *   both branches. A buyer who knows their number should never have to guess a
 *   band first.
 * - **Branches are pushed, not expanded.** "Under $500K" opens a narrower list
 *   rather than unfolding in place, so the panel never grows past a phone
 *   screen.
 *
 * ## What this component must never do
 *
 * **It does not compute a purchase basis.** Not a midpoint, not for an
 * open-ended band, not "roughly". It sends the band key the buyer picked, or
 * the string they typed, and the server decides what figure that implies.
 *
 * The temptation is real: `min_cents` and `max_cents` are right there, and
 * averaging them would let the UI show a live estimate without a round trip.
 * Doing so would put a second copy of the benefit arithmetic on the client,
 * and the first time the two disagreed — a rounding rule, a config change, a
 * band edited by staff — the buyer would see one number in the picker and a
 * different one on their plan.
 *
 * `under_300k` and `3m_plus` make the point unmissable: they are `open_ended`
 * precisely because a midpoint needs two finite edges. Treating "under $300K"
 * as $0–$300K would hand back $150,000, a number nobody said, which would then
 * be multiplied through three rate steps and shown to them as their budget.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PurchaseRangeBand, SmartLivingPublicConfig } from '@/types/api';

export type PurchaseRangeSelection = {
  /** The band key, or null when the buyer typed a figure with no band chosen. */
  purchase_range_key: string | null;
  /** The raw string the buyer typed. Never parsed here — `money.py` is the
   *  only parser, and a second one would eventually disagree with it. */
  purchase_amount?: string | null;
};

type Props = {
  config: SmartLivingPublicConfig;
  /** The currently selected band key, for the trigger label. */
  value: string | null;
  /** The amount already on the plan, so reopening shows what they typed. */
  amountValue?: string | null;
  onChange: (selection: PurchaseRangeSelection) => void;
  disabled?: boolean;
  /** Rendered under the trigger — the API's 422 message, usually. */
  error?: string | null;
};

/**
 * Compact dollar label for a band edge.
 *
 * Display formatting of a figure the server sent, not money arithmetic: no
 * value produced here is ever sent back or used in a calculation.
 */
function edgeLabel(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    const millions = dollars / 1_000_000;
    // 1.0M reads worse than 1M; 1.2M must keep its decimal.
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  return `$${Math.round(dollars / 1000)}K`;
}

/** The label a band shows in the list. */
export function bandLabel(band: PurchaseRangeBand): string {
  switch (band.kind) {
    case 'closed':
      return band.min_cents !== null && band.max_cents !== null
        ? `${edgeLabel(band.min_cents)} – ${edgeLabel(band.max_cents)}`
        : band.key;
    case 'exact':
      return 'Enter my own amount';
    case 'no_basis':
      return 'Not sure yet';
    case 'branch':
      // Derived from the branch key rather than a lookup table, so a band added
      // by staff gets a readable label without a code change.
      return band.key === 'under_500k' ? 'Under $500K' : 'Over $1M';
    case 'open_ended':
      return band.key.startsWith('under_')
        ? `Under ${edgeLabel(upperBoundOf(band.key))}`
        : `${edgeLabel(lowerBoundOf(band.key))}+`;
    default:
      return band.key;
  }
}

/** `under_300k` -> 30000000 cents. Label text only. */
function upperBoundOf(key: string): number {
  const match = key.match(/under_(\d+)([km])/i);
  if (!match) return 0;
  const scale = match[2].toLowerCase() === 'm' ? 1_000_000 : 1_000;
  return Number(match[1]) * scale * 100;
}

/** `3m_plus` -> 300000000 cents. Label text only. */
function lowerBoundOf(key: string): number {
  const match = key.match(/^(\d+)([km])_plus/i);
  if (!match) return 0;
  const scale = match[2].toLowerCase() === 'm' ? 1_000_000 : 1_000;
  return Number(match[1]) * scale * 100;
}

/** Trigger text for the current selection, searching branches too. */
export function selectionLabel(
  config: SmartLivingPublicConfig,
  key: string | null,
  amount?: string | null,
): string {
  if (!key && !amount) return 'Select a price range';
  if (key === 'custom' || (!key && amount)) {
    return amount ? amount : 'Enter my own amount';
  }
  const all = [...config.bands, ...Object.values(config.branches).flat()];
  const band = all.find((entry) => entry.key === key);
  return band ? bandLabel(band) : 'Select a price range';
}

export default function PurchaseRangeSheet({
  config,
  value,
  amountValue,
  onChange,
  disabled = false,
  error = null,
}: Props) {
  const [open, setOpen] = useState(false);
  /** null = top level; otherwise the branch key being shown. */
  const [branch, setBranch] = useState<string | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState(amountValue ?? '');
  const containerRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const bands = useMemo(
    () => (branch ? (config.branches[branch] ?? []) : config.bands),
    [config, branch],
  );

  /**
   * Open at the top level, showing whatever amount is already on the plan.
   *
   * The reset lives here rather than in an effect keyed on `open`. Syncing
   * state to props in an effect causes a second render pass on every change,
   * and — worse for a picker — it fights the user: an effect that copies
   * `amountValue` into local state would overwrite what they are mid-way
   * through typing the moment a parent re-render arrived.
   */
  function openPanel() {
    setAmount(amountValue ?? '');
    setBranch(null);
    setAmountOpen(false);
    setOpen(true);
  }

  /** Resuming inside a branch the buyer navigated to three sessions ago is
   *  disorienting, and the trigger already shows what they picked. */
  function closePanel() {
    setBranch(null);
    setAmountOpen(false);
    setOpen(false);
  }

  useEffect(() => {
    if (amountOpen) amountInputRef.current?.focus();
  }, [amountOpen]);

  // Dismiss on outside click and on Escape. Escape first closes the amount
  // field, then the panel, so a buyer who opened it by mistake is not thrown
  // all the way out of a selection they were mid-way through.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) closePanel();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (amountOpen) setAmountOpen(false);
      else if (branch) setBranch(null);
      else closePanel();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, branch, amountOpen]);

  function choose(band: PurchaseRangeBand) {
    switch (band.kind) {
      case 'branch':
        setBranch(band.branch ?? band.key);
        return;
      case 'exact':
        setAmountOpen(true);
        return;
      case 'open_ended':
        // No basis, but the contract is "invite an amount" — distinct from
        // "Not sure", which deliberately does not nag for one.
        onChange({ purchase_range_key: band.key });
        setAmountOpen(true);
        return;
      default:
        // `closed` and `no_basis`. The server resolves the midpoint, or
        // records the honest absence of one.
        onChange({ purchase_range_key: band.key, purchase_amount: null });
        closePanel();
    }
  }

  function submitAmount() {
    const typed = amount.trim();
    if (!typed) return;
    // Sent with `custom` when there is no open-ended band in play. The server
    // rejects an amount alongside a *closed* band as contradictory, but takes
    // it happily for `custom` and for open-ended bands.
    onChange({
      purchase_range_key: value && isOpenEnded(config, value) ? value : 'custom',
      purchase_amount: typed,
    });
    closePanel();
  }

  const trigger = selectionLabel(config, value, amountValue);
  const hasSelection = Boolean(value || amountValue);

  return (
    <div className="relative" ref={containerRef}>
      <label
        className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        id="purchase-range-label"
      >
        What price range are you considering?
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Both ids, in this order. `aria-labelledby` *replaces* the element's
        // content as its accessible name, so pointing it at the field label
        // alone would announce "What price range are you considering?" and
        // never say what is currently selected — the one thing a screen-reader
        // user needs before deciding whether to reopen it.
        aria-labelledby="purchase-range-label purchase-range-value"
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition disabled:opacity-50 ${
          error
            ? 'border-red-300 dark:border-red-800'
            : 'border-zinc-200 dark:border-zinc-800'
        } bg-white hover:border-primarycolor dark:bg-zinc-900`}
      >
        <span
          id="purchase-range-value"
          className={
            hasSelection
              ? 'font-semibold text-zinc-900 dark:text-zinc-50'
              : 'text-zinc-500 dark:text-zinc-400'
          }
        >
          {trigger}
        </span>
        <span aria-hidden className="ml-3 text-zinc-400">
          ▾
        </span>
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {open ? (
        <>
          {/* Mobile scrim. Hidden from assistive tech — Escape and the outside
              click handler already provide the dismiss affordance. */}
          <div
            aria-hidden
            onClick={closePanel}
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          />
          <div
            role="dialog"
            aria-label="Choose a price range"
            className={
              // Bottom sheet under `sm`, anchored popover above it. `max-h`
              // plus `overflow-y-auto` is what keeps seventeen bands scrollable
              // instead of overflowing the viewport.
              'fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-2xl ' +
              'dark:border-zinc-800 dark:bg-zinc-900 ' +
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:z-30 sm:mt-2 sm:max-h-80 sm:w-full sm:rounded-xl sm:shadow-lg'
            }
          >
            {branch ? (
              <button
                type="button"
                onClick={() => setBranch(null)}
                className="mb-2 text-sm font-semibold text-primarycolor hover:underline"
              >
                ← All ranges
              </button>
            ) : null}

            {amountOpen ? (
              <div className="p-1">
                <label
                  htmlFor="purchase-amount"
                  className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Enter your amount
                </label>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  A rough figure is fine — you can change it anytime.
                </p>
                <input
                  id="purchase-amount"
                  ref={amountInputRef}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitAmount();
                    }
                  }}
                  // `inputMode` rather than `type="number"`: the server accepts
                  // "$750,000" and "750k", and a number input would strip the
                  // dollar sign, the separators and the suffix.
                  inputMode="decimal"
                  placeholder="$750,000"
                  maxLength={32}
                  className="mt-3 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={submitAmount}
                    disabled={!amount.trim()}
                    className="flex-1 rounded-full bg-primarycolor px-4 py-2.5 text-sm font-semibold text-white hover:bg-primarycolor/90 disabled:opacity-50"
                  >
                    Use this amount
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountOpen(false)}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <ul className="space-y-1">
                {bands.map((band) => (
                  <li key={`${branch ?? 'root'}-${band.key}`}>
                    <button
                      type="button"
                      onClick={() => choose(band)}
                      aria-current={band.key === value ? 'true' : undefined}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                        band.key === value
                          ? 'bg-primarycolor/5 font-semibold text-primarycolor'
                          : 'text-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      <span>{bandLabel(band)}</span>
                      {band.kind === 'branch' ? (
                        <span aria-hidden className="text-zinc-400">
                          ›
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function isOpenEnded(config: SmartLivingPublicConfig, key: string): boolean {
  const all = [...config.bands, ...Object.values(config.branches).flat()];
  return all.find((band) => band.key === key)?.kind === 'open_ended';
}
