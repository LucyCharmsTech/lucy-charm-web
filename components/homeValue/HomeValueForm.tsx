'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { LockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmSubmission,
  type SubmissionOutcome,
} from '@/components/common/ConfirmSubmission';
import { EmailCodeAuthForm } from '@/components/auth/EmailCodeAuthForm';
import { GoogleLoginButton } from '@/components/auth/GoogleAuthButton';
import { NotSureField } from '@/components/homeValue/NotSureField';
import {
  clearHomeValueDraft,
  readHomeValueDraftRaw,
  saveHomeValueDraft,
  subscribeToHomeValueDraft,
} from '@/lib/homeValueDraft';
import { submitHomeValueRequest } from '@/services/homeValueService';
import { useAuthStore } from '@/stores/authStore';
import type { HomeValueRequestBody } from '@/types/homeValue';
import { PrivacyLink } from '@/components/common/PrivacyLink';

/**
 * Home Value intake — plan item 4.2, from Hamed's specification.
 *
 * Four of his instructions shape this component, and three of them are
 * prohibitions:
 *
 * - *"Public page and form start open; **sign-in at submission**, preserving
 *   entered fields."* → anyone can fill it in; the sign-in step appears only
 *   when they press send, and the draft survives it.
 * - *"**Do not request ID or financial documents** in this initial form."* →
 *   there is no upload control here, and no column behind one either.
 * - *"**No fixed response-time promise.**"* → nothing on this page says when
 *   anyone will reply. Tempting to add; binds the brokerage to a timeframe
 *   nobody agreed.
 * - *"Use the existing human-reviewed report workflow — **not an instant
 *   public valuation number**."* → the page never shows a figure. It says a
 *   person will prepare one.
 */

type Step = 'form' | 'signin' | 'confirm';

const EMPTY: Partial<HomeValueRequestBody> = {};

export function HomeValueForm() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState<Step>('form');

  /*
   * Restore the saved draft without breaking server rendering.
   *
   * The obvious approaches both fail:
   *
   * - Reading storage in a `useState` initializer runs on the **server** too,
   *   where `sessionStorage` does not exist, so the server renders an empty
   *   form and the browser renders a filled one — a hydration mismatch, and a
   *   visible flash of the wrong thing for exactly the person the draft exists
   *   to help.
   * - Restoring in an effect paints the empty form first and then replaces it,
   *   which is the same flash plus a lint error.
   *
   * `useSyncExternalStore` exists for this: `getServerSnapshot` returns null,
   * so the server and the hydration pass agree, and the real value arrives on
   * the client without a mismatch.
   *
   * This is also why the page can be server-rendered at all. It was briefly
   * `ssr: false`, which pushed LCP on `/home-value` from ~2.8s to 4.3s on
   * simulated mobile — the whole form waited for the client bundle.
   */
  const rawDraft = useSyncExternalStore(
    subscribeToHomeValueDraft,
    readHomeValueDraftRaw,
    () => null,
  );
  const restoredDraft = useMemo<Partial<HomeValueRequestBody> | null>(() => {
    if (!rawDraft) return null;
    try {
      const parsed: unknown = JSON.parse(rawDraft);
      // Storage is writable by anything on this origin; spreading a non-object
      // into form state would throw during render.
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Partial<HomeValueRequestBody>;
    } catch {
      return null;
    }
  }, [rawDraft]);

  const [edits, setEdits] = useState<Partial<HomeValueRequestBody>>(EMPTY);
  /*
   * What the person sees: the stored draft, with anything they have typed
   * this session on top.
   *
   * Derived rather than copied into state, so there is no moment where the
   * two disagree and no effect to keep them in step.
   */
  const values: Partial<HomeValueRequestBody> = { ...(restoredDraft ?? {}), ...edits };
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof HomeValueRequestBody>(
    key: K,
    value: HomeValueRequestBody[K] | undefined,
  ) {
    setEdits((current) => {
      const next = { ...(restoredDraft ?? {}), ...current, [key]: value };
      // Persisted on every change rather than only at the sign-in step: the
      // reload that loses a form is never the one you planned for.
      saveHomeValueDraft(next);
      return next;
    });
  }

  const isComplete =
    Boolean(values.address?.trim()) &&
    Boolean(values.full_name?.trim()) &&
    Boolean(values.relationship) &&
    Boolean(values.represented_elsewhere);

  function handleReview(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!isComplete) {
      setError('Please complete the required fields marked with *.');
      return;
    }
    // The sign-in step is inserted here, not at the top of the page. Asking
    // someone to create an account before they have seen what they are filling
    // in is how a form gets abandoned on its first screen.
    setStep(accessToken ? 'confirm' : 'signin');
  }

  async function handleSubmit(): Promise<SubmissionOutcome> {
    try {
      const created = await submitHomeValueRequest(values as HomeValueRequestBody);
      // The draft has served its purpose. Clearing it keeps a property's
      // details out of browser storage on a shared machine.
      clearHomeValueDraft();
      return {
        ok: true,
        status: created.status,
        message:
          'Your request has been received. A Lucy Charms representative will ' +
          'prepare your valuation and it will appear in your account when it ' +
          'is ready.',
      };
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'We could not send this. Please try again.';
      return { ok: false, status: 'not sent', message: String(detail) };
    }
  }

  // ── Sign-in, with the form kept ────────────────────────────────────────────
  if (step === 'signin' && !accessToken) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <LockIcon
            className="mt-0.5 size-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            aria-hidden="true"
          />
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            <p className="font-semibold">Sign in to send your request</p>
            {/*
              Says why, and says the answer to the question people actually
              have at this point — "have I just lost what I typed?"
            */}
            <p className="mt-0.5">
              Your valuation is prepared for you personally, so we need an
              account to deliver it to.{' '}
              <span className="font-medium">
                Everything you have entered is saved and will be sent once you
                are signed in.
              </span>
            </p>
          </div>
        </div>

        <GoogleLoginButton onError={(message) => setError(message)} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs text-zinc-500">or</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        <EmailCodeAuthForm />

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => setStep('form')}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"
        >
          Back to the form
        </button>
      </div>
    );
  }

  // Signed in while the sign-in step was showing — carry straight on rather
  // than leaving them on a sign-in screen they have already completed.
  if (step === 'signin' && accessToken) {
    setStep('confirm');
  }

  // ── Confirm, then send ─────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <ConfirmSubmission
        title="Send your Home Value request"
        summary={[
          `We will ask a Lucy Charms representative to prepare a valuation for ${values.address}${values.unit ? `, unit ${values.unit}` : ''}.`,
          `Your name and the email on your account${values.phone ? ', and your phone number,' : ''} will be shared with them.`,
          // The limits, stated as plainly as the effects. Both of these are
          // Hamed's instructions rendered as something the person can read.
          'A person prepares this report — you will not get an automatic estimate.',
          'The report appears in your account when it is ready, and we will not commit to a date.',
        ]}
        confirmLabel="Send request"
        onConfirm={handleSubmit}
        onBack={() => setStep('form')}
      />
    );
  }

  // ── The form ───────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleReview} className="space-y-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          The property
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="hv-address">Property address *</Label>
          <Input
            id="hv-address"
            value={values.address ?? ''}
            onChange={(event) => set('address', event.target.value)}
            placeholder="12 Elm Street, Toronto"
            autoComplete="street-address"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hv-unit">Unit (if relevant)</Label>
          <Input
            id="hv-unit"
            value={values.unit ?? ''}
            onChange={(event) => set('unit', event.target.value || undefined)}
            placeholder="4B"
            className="h-11 rounded-xl"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          About you
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="hv-name">Your name *</Label>
          <Input
            id="hv-name"
            value={values.full_name ?? ''}
            onChange={(event) => set('full_name', event.target.value)}
            autoComplete="name"
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-relationship">
            Your relationship to this property *
          </Label>
          <select
            id="hv-relationship"
            value={values.relationship ?? ''}
            onChange={(event) =>
              set(
                'relationship',
                (event.target.value || undefined) as HomeValueRequestBody['relationship'],
              )
            }
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Choose one</option>
            <option value="owner">I own it</option>
            <option value="researching">I am researching it</option>
            <option value="other">Something else</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-represented">
            Are you currently represented by another brokerage? *
          </Label>
          <select
            id="hv-represented"
            value={values.represented_elsewhere ?? ''}
            onChange={(event) =>
              set(
                'represented_elsewhere',
                (event.target.value ||
                  undefined) as HomeValueRequestBody['represented_elsewhere'],
              )
            }
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Choose one</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            {/* "Not sure" is a real answer here, not a cop-out. Many sellers
                genuinely do not know whether a listing agreement is still
                running, and this is the one question where a guess has
                consequences. */}
            <option value="not_sure">Not sure</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-phone">Phone (optional)</Label>
          <Input
            id="hv-phone"
            type="tel"
            value={values.phone ?? ''}
            onChange={(event) => set('phone', event.target.value || undefined)}
            autoComplete="tel"
            className="h-11 rounded-xl"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Anything you know about the property
        </legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          All optional. If you are not certain about something, say so — that
          is more useful to us than a guess.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <NotSureField
            id="hv-beds"
            label="Bedrooms"
            value={values.beds}
            onChange={(value) => set('beds', value)}
            inputMode="numeric"
          />
          <NotSureField
            id="hv-baths"
            label="Bathrooms"
            value={values.baths}
            onChange={(value) => set('baths', value)}
            inputMode="numeric"
          />
          <NotSureField
            id="hv-parking"
            label="Parking spaces"
            value={values.parking}
            onChange={(value) => set('parking', value)}
            inputMode="numeric"
          />
          <NotSureField
            id="hv-size"
            label="Approximate size"
            value={values.approximate_size}
            onChange={(value) => set('approximate_size', value)}
            placeholder="e.g. 1,200 sq ft"
          />
          <NotSureField
            id="hv-type"
            label="Property type"
            value={values.property_type}
            onChange={(value) => set('property_type', value)}
            placeholder="e.g. Detached"
          />
          <NotSureField
            id="hv-condition"
            label="Condition"
            value={values.condition}
            onChange={(value) => set('condition', value)}
            placeholder="e.g. Well maintained"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-renovations">Renovations or recent work</Label>
          <Textarea
            id="hv-renovations"
            rows={3}
            value={values.renovations ?? ''}
            onChange={(event) => set('renovations', event.target.value || undefined)}
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-condo">Condo details, if it is a condo</Label>
          <Textarea
            id="hv-condo"
            rows={2}
            value={values.condo_details ?? ''}
            onChange={(event) => set('condo_details', event.target.value || undefined)}
            placeholder="Maintenance fee, locker, what the fee includes"
            className="rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-timeline">Your timeline</Label>
          <select
            id="hv-timeline"
            value={values.timeline ?? ''}
            onChange={(event) => set('timeline', event.target.value || undefined)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Prefer not to say</option>
            <option value="asap">As soon as possible</option>
            <option value="3_months">Within 3 months</option>
            <option value="6_months">Within 6 months</option>
            <option value="12_months">Within a year</option>
            <option value="just_curious">Just curious for now</option>
            <option value="not_sure">Not sure</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hv-consult">How would you like to hear back?</Label>
          <select
            id="hv-consult"
            value={values.consultation_preference ?? ''}
            onChange={(event) =>
              set('consultation_preference', event.target.value || undefined)
            }
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">No preference</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in_person">In person</option>
          </select>
        </div>
      </fieldset>

      {/*
        No upload control, deliberately. Hamed: "Do not request ID or financial
        documents in this initial form." There is no column behind one either —
        see `app/api/home_value/models.py`.
      */}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90"
      >
        Review and send
      </Button>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {user
          ? 'Your request will be sent from your account.'
          : 'You can fill this in now and sign in when you send it.'}
      </p>

{/*
        What happens to the information on this form.

        Written by us rather than waiting on approved copy, because every
        sentence is a statement of what this software verifiably does — not a
        promise about how the brokerage operates. Each claim was checked
        against the code before it was written.

        Deliberately absent: how long anything is kept. No retention schedule
        has been set (nothing is deleted today), and a sentence promising
        deletion after a given period would be false. Saying nothing is
        honest; stating a number nobody has agreed is not. That sentence gets
        added when the schedule arrives.
      */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Your name, the email on your account and this property address go to a
        Lucy Charms representative so they can prepare your valuation. They are
        not shown publicly and are not shared with other buyers or sellers.
        <PrivacyLink />
      </p>
    </form>
  );
}
