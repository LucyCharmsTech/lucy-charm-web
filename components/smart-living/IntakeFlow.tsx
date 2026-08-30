'use client';

/**
 * The four-question Smart Living intake (spec A2).
 *
 * ## The plan is created on the first answer, not the last
 *
 * This is the decision everything else follows from. The obvious build collects
 * four answers client-side and POSTs once at the end — fewer requests, simpler
 * state. It is wrong here for a reason that only shows up later: a Smart Living
 * plan has to be **claimed exactly once at sign-in**, and there is nothing to
 * claim if the only copy is in the browser. A buyer who answers two questions,
 * closes the tab, and comes back next week has a real server row waiting.
 *
 * `property_checkup` does keep signed-out state in localStorage and is right to
 * — it has nothing to claim. Copying that pattern here would break Phase 3.
 *
 * ## Each answer is saved as it is given
 *
 * So the flow is resumable at any point, which is why every field on
 * `SmartLivingPlanCreate` is optional server-side. Only the plan **id** is kept
 * in localStorage; the answers live on the server.
 *
 * ## The estimate is whatever the server said
 *
 * No arithmetic here. `estimated_benefit_cents === null` is a real and common
 * state — "Not sure", or an open-ended band with nothing typed — and it renders
 * as the non-dollar preview, never as $0. Those are different statements: one
 * says we do not know yet, the other says the benefit is nothing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { track } from '@/lib/analytics';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { useAuthStore } from '@/stores/authStore';
import PurchaseRangeSheet, {
  type PurchaseRangeSelection,
} from '@/components/smart-living/PurchaseRangeSheet';
import {
  createSmartLivingPlan,
  fetchSmartLivingPlan,
  fetchSmartLivingPublicConfig,
  getStoredSmartLivingPlanId,
  parseSmartLivingIntakeMessage,
  updateSmartLivingPlan,
} from '@/services/smartLivingService';
import type {
  SmartLivingHomeType,
  SmartLivingIntakeCandidate,
  SmartLivingPlan,
  SmartLivingPlanWriteRequest,
  SmartLivingPublicConfig,
} from '@/types/api';

type Step = 'location' | 'range' | 'timeline' | 'home' | 'preview';

const STEP_ORDER: Step[] = ['location', 'range', 'timeline', 'home', 'preview'];
const STEP_LABELS: Record<Step, string> = {
  location: 'Where',
  range: 'Budget',
  timeline: 'When',
  home: 'Home type',
  preview: 'Your preview',
};

/** Spec A2 question 3. Labels stay configurable-shaped — one array, one edit. */
const TIMELINES: { value: string; label: string }[] = [
  { value: '0_3_months', label: 'Next 3 months' },
  { value: '3_6_months', label: '3 – 6 months' },
  { value: '6_12_months', label: '6 – 12 months' },
  { value: '12_plus_months', label: '12+ months' },
  { value: 'exploring', label: 'Just exploring' },
];

/** Spec A2 question 4. Freehold vs condominium townhouse is deliberately not
 *  asked at intake — that distinction is a Phase 5 tenure question, and asking
 *  it here would make a buyer guess at something they often cannot know yet. */
const HOME_TYPES: { value: SmartLivingHomeType; label: string }[] = [
  { value: 'house', label: 'House' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'not_sure', label: 'Not sure' },
];

const LOCATION_SCHEMA = z.object({
  city: z
    .string()
    .trim()
    .min(2, 'Enter a city or area with at least 2 characters.')
    .max(128, 'City must be 128 characters or fewer.'),
  region: z
    .string()
    .trim()
    .max(128, 'Province must be 128 characters or fewer.'),
});

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** For echoing a limit a buyer *said* ("under $500K"), where cents would read
 *  as a precision they never claimed. */
function formatCentsRounded(cents: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Copy the parsed answers onto a plan payload **field by field**.
 *
 * Not a spread of `candidate.prefill`. The server already excludes money from
 * that object, but a client that forwards whatever keys arrive is one server
 * change away from writing a field this flow never meant to write — and the
 * whole point of the prefill/confirm split is that the amount cannot travel by
 * accident. Naming the four fields keeps that guarantee on this side too.
 */
function prefillToWrite(
  prefill: SmartLivingIntakeCandidate['prefill'],
): SmartLivingPlanWriteRequest {
  const payload: SmartLivingPlanWriteRequest = {};
  const city = prefill.location_city;
  const region = prefill.location_region;

  if (city) {
    payload.location_city = city;
    payload.location_query = region ? `${city}, ${region}` : city;
  }
  if (region) payload.location_region = region;
  if (prefill.buying_timeline) payload.buying_timeline = prefill.buying_timeline;
  if (prefill.home_type) {
    payload.home_type = prefill.home_type as SmartLivingHomeType;
  }
  return payload;
}

export default function IntakeFlow() {
  const user = useAuthStore((state) => state.user);

  const [config, setConfig] = useState<SmartLivingPublicConfig | null>(null);
  const [plan, setPlan] = useState<SmartLivingPlan | null>(null);
  const [step, setStep] = useState<Step>('location');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('ON');
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // ── Natural-language intake ──────────────────────────────────────────────
  //
  // A parallel entrance to the same four questions, not a separate flow. What
  // Lucy hears is written to the plan through `save` like any tapped answer,
  // and the buyer lands on the first question she could not fill — so the
  // sentence saves them typing, and never saves them *confirming*.
  const [description, setDescription] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  /** Held only for the amount. The other three fields are already on the plan
   *  by the time this is set; the amount is the one that needs a yes. */
  const [candidate, setCandidate] = useState<SmartLivingIntakeCandidate | null>(null);

  // ── Bootstrap ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const publicConfig = await fetchSmartLivingPublicConfig();
        if (cancelled) return;
        setConfig(publicConfig);

        // Resume: a plan id in localStorage means this visitor already started.
        // A 404 here is ordinary — the plan may have been claimed by an account
        // on another device, or cleared — so it starts a fresh flow rather than
        // showing an error for something the buyer cannot act on.
        const storedId = getStoredSmartLivingPlanId();
        if (storedId) {
          try {
            const existing = await fetchSmartLivingPlan(storedId);
            if (cancelled) return;
            setPlan(existing);
            setCity(existing.location_city ?? '');
            setRegion(existing.location_region ?? 'ON');
            setStep(resumeStep(existing));
          } catch {
            /* fall through to a fresh flow */
          }
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    track('smart_living_intake_started');
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Create on the first answer, patch on every one after.
   *
   * Returns the saved plan so callers can advance on success only — advancing
   * first and saving in the background would let a buyer reach the preview
   * while their answer silently failed to persist.
   */
  const save = useCallback(
    async (payload: SmartLivingPlanWriteRequest): Promise<SmartLivingPlan | null> => {
      setSaving(true);
      setError(null);
      setFieldError(null);
      try {
        const saved = plan
          ? await updateSmartLivingPlan(plan.id, payload)
          : await createSmartLivingPlan(payload);
        setPlan(saved);
        return saved;
      } catch (err) {
        // The API's 422s are written to be read by a person — "Enter a purchase
        // amount in dollars, for example $750,000 or 750k." Surfacing them
        // directly beats a generic message that hides which field was wrong.
        setError(getApiErrorMessage(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [plan],
  );

  const advance = useCallback(
    (from: Step) => {
      const next = STEP_ORDER[STEP_ORDER.indexOf(from) + 1];
      if (next) setStep(next);
    },
    [],
  );

  // ── Steps ────────────────────────────────────────────────────────────────

  async function submitLocation() {
    const parsed = LOCATION_SCHEMA.safeParse({ city, region });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Check this field.');
      return;
    }
    const saved = await save({
      location_query: `${parsed.data.city}${parsed.data.region ? `, ${parsed.data.region}` : ''}`,
      location_city: parsed.data.city,
      location_region: parsed.data.region || null,
    });
    if (saved) {
      track('smart_living_question_answered', { question: 'location' });
      advance('location');
    }
  }

  /**
   * "Just tell us in your own words."
   *
   * Parsing writes nothing on the server, so the plan is only touched once
   * there is something to write — and only ever the three confirmable-by-sight
   * fields. The amount, if she heard one, is parked in `candidate` and asked
   * about on the range step.
   */
  async function submitDescription() {
    const message = description.trim();
    if (!message) return;

    setParsing(true);
    setError(null);
    setParseNote(null);
    try {
      const heard = await parseSmartLivingIntakeMessage(message);
      track('smart_living_intake_parsed', {
        fields: Object.keys(heard.prefill).length,
        heard_amount: heard.purchase_amount_cents !== null,
        needs_confirmation: heard.requires_amount_confirmation,
      });

      if (heard.is_empty) {
        // Not an error — she simply did not recognise anything. Saying so and
        // leaving the four questions in place beats a guess, and beats a red
        // banner for something the buyer did nothing wrong to cause.
        setParseNote(
          "I could not pick anything out of that — let's go through the questions instead. It takes about a minute.",
        );
        return;
      }

      const saved = await save(prefillToWrite(heard.prefill));
      if (!saved) return;

      setCity(saved.location_city ?? '');
      setRegion(saved.location_region ?? 'ON');
      setDescription('');
      // Only the amount half survives the write; the rest is on the plan now.
      setCandidate(
        heard.purchase_amount_cents !== null ? heard : null,
      );
      setStep(resumeStep(saved));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setParsing(false);
    }
  }

  /**
   * The buyer said yes to the amount Lucy heard.
   *
   * Sends the string they were shown, under the custom band — the same payload
   * the picker's "Enter my own amount" produces, and the same one the server's
   * `confirmed_amount_payload` builds. The text is never parsed here.
   */
  async function confirmHeardAmount(text: string) {
    const saved = await save({ purchase_range_key: 'custom', purchase_amount: text });
    if (!saved) return;

    setTypedAmount(text);
    setCandidate(null);
    track('smart_living_question_answered', {
      question: 'purchase_range',
      band: 'custom',
      custom_amount: true,
      source: 'lucy_confirmed',
      has_estimate: saved.estimated_benefit_cents !== null,
    });
    advance('range');
  }

  async function submitRange(selection: PurchaseRangeSelection) {
    /*
     * Sent exactly as the picker produced it. Two shapes are legal and mean
     * different things: a band key alone (the server takes its midpoint), or a
     * key plus the typed string (the server parses it). Never both a *closed*
     * band and an amount — the picker does not emit that, and the API rejects
     * it as contradictory rather than guessing which the buyer meant.
     */
    const saved = await save({
      purchase_range_key: selection.purchase_range_key,
      ...(selection.purchase_amount !== undefined
        ? { purchase_amount: selection.purchase_amount }
        : {}),
    });
    if (!saved) return;

    setTypedAmount(selection.purchase_amount ?? null);
    // Answering the question directly settles it; leaving the prompt up would
    // offer to overwrite an answer the buyer just gave.
    setCandidate(null);
    track('smart_living_question_answered', {
      question: 'purchase_range',
      band: selection.purchase_range_key,
      custom_amount: Boolean(selection.purchase_amount),
      // Whether the buyer got a figure or the non-dollar preview is the single
      // most useful funnel signal on this screen.
      has_estimate: saved.estimated_benefit_cents !== null,
    });
    advance('range');
  }

  async function submitTimeline(value: string) {
    const saved = await save({ buying_timeline: value });
    if (saved) {
      track('smart_living_question_answered', { question: 'timeline' });
      advance('timeline');
    }
  }

  async function submitHomeType(value: SmartLivingHomeType) {
    const saved = await save({ home_type: value });
    if (saved) {
      track('smart_living_question_answered', { question: 'home_type' });
      track('smart_living_preview_generated', {
        has_estimate: saved.estimated_benefit_cents !== null,
      });
      advance('home');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const stepIndex = STEP_ORDER.indexOf(step);
  const greeting = useMemo(
    () => (user?.first_name ? `${user.first_name}, ` : ''),
    [user],
  );

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Loading…
      </p>
    );
  }

  if (!config) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
      >
        {error ?? 'Smart Living is temporarily unavailable. Please try again.'}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <ol className="mb-8 grid grid-cols-5 gap-1 text-center text-[11px] font-semibold sm:text-xs">
        {STEP_ORDER.map((entry, index) => (
          <li
            key={entry}
            aria-current={entry === step ? 'step' : undefined}
            className={
              index <= stepIndex
                ? 'text-primarycolor'
                : 'text-zinc-400 dark:text-zinc-600'
            }
          >
            <span
              className={`mx-auto mb-2 block h-1 rounded-full ${
                index <= stepIndex
                  ? 'bg-primarycolor'
                  : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
            {STEP_LABELS[entry]}
          </li>
        ))}
      </ol>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      {step === 'location' ? (
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Where are you hoping to buy?
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label
                htmlFor="sl-city"
                className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                City or area
              </label>
              <input
                id="sl-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Vaughan"
                maxLength={128}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label
                htmlFor="sl-region"
                className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Province
              </label>
              <input
                id="sl-region"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                maxLength={128}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
          </div>
          {fieldError ? (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              {fieldError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={submitLocation}
            disabled={saving || parsing}
            className="mt-6 w-full rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-white hover:bg-primarycolor/90 disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>

          {/* The same four questions, entered by sentence. Offered as an
              alternative to the fields above rather than instead of them —
              a buyer who would rather tap four buttons should not have to
              compose a sentence to get past the first screen. */}
          <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <label
              htmlFor="sl-describe"
              className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Or just tell us in your own words
            </label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Lucy will fill in what she can. You will see every answer before
              it counts.
            </p>
            <textarea
              id="sl-describe"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Around $750K in Vaughan next spring, probably a condo"
              className="mt-3 w-full resize-y rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
            {parseNote ? (
              <p
                role="status"
                className="mt-2 text-sm text-zinc-600 dark:text-zinc-300"
              >
                {parseNote}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void submitDescription()}
              disabled={parsing || saving || description.trim().length === 0}
              className="mt-3 w-full rounded-full border border-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor hover:bg-primarycolor/5 disabled:opacity-50 sm:w-auto"
            >
              {parsing ? 'Reading…' : 'Fill this in for me'}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'range' ? (
        <div>
          {candidate ? (
            <div className="mb-6 rounded-2xl border border-primarycolor/30 bg-primarycolor/5 p-4">
              {candidate.purchase_amount_text ? (
                <>
                  <p className="text-sm text-zinc-800 dark:text-zinc-100">
                    You said{' '}
                    <strong>{candidate.purchase_amount_text}</strong>. Should we
                    use that as your purchase amount?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void confirmHeardAmount(candidate.purchase_amount_text as string)
                      }
                      className="rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-white hover:bg-primarycolor/90 disabled:opacity-50"
                    >
                      Yes, use {candidate.purchase_amount_text}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setCandidate(null)}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      Let me choose
                    </button>
                  </div>
                </>
              ) : (
                /* An upper bound is a ceiling the buyer named, not a price they
                   intend to pay. Proposing it would build their whole preview
                   on the one number they explicitly ruled out — so this branch
                   has no accept button at all, only the question. */
                <p className="text-sm text-zinc-800 dark:text-zinc-100">
                  You mentioned staying under{' '}
                  <strong>
                    {formatCentsRounded(candidate.purchase_amount_cents as number)}
                  </strong>
                  . That is a limit rather than an amount — pick the range that
                  fits, or enter what you would like us to use.
                </p>
              )}
            </div>
          ) : null}

          <PurchaseRangeSheet
            config={config}
            value={plan?.purchase_range_key ?? null}
            amountValue={typedAmount}
            onChange={(selection) => void submitRange(selection)}
            disabled={saving}
          />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            Want to use a rough amount just to preview your benefits? You can
            change it anytime.
          </p>
        </div>
      ) : null}

      {step === 'timeline' ? (
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            When are you thinking of buying?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TIMELINES.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => void submitTimeline(option.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm hover:border-primarycolor disabled:opacity-50 ${
                  plan?.buying_timeline === option.value
                    ? 'border-primarycolor bg-primarycolor/5 font-semibold text-primarycolor'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'home' ? (
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            What kind of home are you considering?
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {HOME_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => void submitHomeType(option.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm hover:border-primarycolor disabled:opacity-50 ${
                  plan?.home_type === option.value
                    ? 'border-primarycolor bg-primarycolor/5 font-semibold text-primarycolor'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'preview' && plan ? <Preview plan={plan} greeting={greeting} /> : null}
    </section>
  );
}

/**
 * The preview, in two shapes.
 *
 * A plan with a basis gets a figure. A plan without one gets a genuinely useful
 * non-dollar preview and an invitation to supply an amount — **not** a $0, and
 * not a dead end. "Not sure" is a legitimate answer to question 2, and a buyer
 * who gave it should still see what Smart Living is for.
 */
function Preview({ plan, greeting }: { plan: SmartLivingPlan; greeting: string }) {
  const hasEstimate = plan.estimated_benefit_cents !== null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor">
        Your Smart Living preview
      </p>

      {hasEstimate ? (
        <>
          <h2 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {greeting}your Smart Living Benefits are ready.
          </h2>
          <p className="mt-5 text-4xl font-extrabold tracking-tight text-primarycolor">
            {formatCents(plan.estimated_benefit_cents as number)}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Estimated value, based on the purchase range you shared.
          </p>
          {plan.cash_benefit_cents !== null ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              Prefer cash? You could take{' '}
              <strong>{formatCents(plan.cash_benefit_cents)}</strong> instead —
              the two cannot be combined.
            </p>
          ) : null}
          {/* Spec B2. An estimate presented without this line reads as a
              promise, and the figure moves once a real purchase price exists. */}
          <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            This is an estimate based on the purchase amount you shared, not a
            confirmed amount. It updates if your purchase amount changes, and is
            confirmed once your purchase is final.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {greeting}here is what Smart Living could cover.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            We do not have a purchase amount yet, so there is no dollar figure
            to show — we would rather show you nothing than a number you did not
            give us.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Want to use a rough amount just to preview your benefits? You can
            change it anytime.
          </p>
        </>
      )}

      {plan.last_calculated_at ? (
        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
          Last updated{' '}
          {new Date(plan.last_calculated_at).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Where a resumed plan picks up: the first unanswered question.
 *
 * Skip-known-fields, and it applies to anonymous returners as much as to
 * signed-in buyers — spec A1.6's "no repeated questions" is about not asking
 * twice, not about who is asking.
 */
function resumeStep(plan: SmartLivingPlan): Step {
  if (!plan.location_city) return 'location';
  // `purchase_basis_source === 'none'` covers "Not sure" too, which *is* an
  // answer — so the band key, not the basis, is what says whether they replied.
  if (!plan.purchase_range_key) return 'range';
  if (!plan.buying_timeline) return 'timeline';
  if (!plan.home_type) return 'home';
  return 'preview';
}
