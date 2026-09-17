'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import {
  createSellerJourney,
  fetchSellerJourney,
  getStoredSellerJourneyId,
  requestProfessionalReview,
  resumeSellerJourney,
  updateSellerJourney,
  updateSellerJourneyStatus,
} from '@/services/sellerJourneyService';
import type {
  SellerJourney,
  SellerJourneyPropertyRelationship,
  SellerJourneyStatus,
  ProfessionalReviewCreateRequest,
  AuthUser,
} from '@/types/api';

type ExplorerStep = 'welcome' | 'property' | 'situation' | 'plan';
type ExplorerForm = {
  address: string;
  unit: string;
  city: string;
  region: string;
  postalCode: string;
  relationship: SellerJourneyPropertyRelationship | '';
  timeline: string;
  condition: string;
  renovations: string;
  goal: string;
};

type ReviewForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  request: string;
};

const EMPTY_FORM: ExplorerForm = {
  address: '',
  unit: '',
  city: '',
  region: '',
  postalCode: '',
  relationship: '',
  timeline: '',
  condition: '',
  renovations: '',
  goal: '',
};

const EMPTY_REVIEW_FORM: ReviewForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  request: '',
};

const STEP_LABELS = ['Your home', 'Your situation', 'Your snapshot'];

const PROPERTY_SCHEMA = z.object({
  address: z
    .string()
    .trim()
    .min(3, 'Enter a street address with at least 3 characters.')
    .max(255, 'Street address must be 255 characters or fewer.'),
  unit: z.string().trim().max(64, 'Unit must be 64 characters or fewer.'),
  city: z
    .string()
    .trim()
    .min(2, 'Enter a city with at least 2 characters.')
    .max(255, 'City must be 255 characters or fewer.'),
  region: z
    .string()
    .trim()
    .min(2, 'Enter a province or state with at least 2 characters.')
    .max(128, 'Province or state must be 128 characters or fewer.'),
  postalCode: z
    .string()
    .trim()
    .min(3, 'Enter a complete postal or ZIP code (at least 3 characters).')
    .max(32, 'Postal or ZIP code must be 32 characters or fewer.')
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 -]{1,14}$/,
      'Enter a valid postal or ZIP code.',
    ),
  relationship: z.enum(['owner', 'researching', 'curious'], {
    error: 'Choose how this home relates to you.',
  }),
});

const SITUATION_SCHEMA = z.object({
  timeline: z
    .string()
    .trim()
    .max(128, 'Timeline must be 128 characters or fewer.'),
  condition: z
    .string()
    .trim()
    .max(128, 'Condition must be 128 characters or fewer.'),
  renovations: z
    .string()
    .trim()
    .max(5000, 'Keep renovations under 5,000 characters.'),
  goal: z.string().trim().max(5000, 'Keep your goal under 5,000 characters.'),
});

function formFromJourney(journey: SellerJourney): ExplorerForm {
  return {
    address: journey.property_address ?? '',
    unit: journey.property_unit ?? '',
    city: journey.property_city ?? '',
    region: journey.property_region ?? '',
    postalCode: journey.property_postal_code ?? '',
    relationship: journey.relationship_to_property ?? '',
    timeline: journey.selling_timeline ?? '',
    condition: journey.property_condition ?? '',
    renovations: journey.renovations_upgrades ?? '',
    goal: journey.primary_goal ?? '',
  };
}

function stepFromStatus(status: SellerJourneyStatus): ExplorerStep {
  if (status === 'exploring') return 'property';
  if (status === 'details_in_progress') return 'situation';
  return 'plan';
}

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return typeof detail === 'string'
    ? detail
    : 'We could not save that just now. Please try again.';
}

export default function SellPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = useState<ExplorerStep>('welcome');
  const [journey, setJourney] = useState<SellerJourney | null>(null);
  const [form, setForm] = useState<ExplorerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function applyJourney(nextJourney: SellerJourney) {
    setJourney(nextJourney);
    setForm(formFromJourney(nextJourney));
  }

  useEffect(() => {
    const journeyId = getStoredSellerJourneyId();
    if (!journeyId) {
      return;
    }

    const load = async () => {
      try {
        const restored = accessToken
          ? await resumeSellerJourney(journeyId)
          : await fetchSellerJourney(journeyId);
        applyJourney(restored);
        setStep(stepFromStatus(restored.status));
      } catch {
        // A new session should still be able to start a private exploration.
      }
    };
    void load();
  }, [accessToken]);

  function setField<K extends keyof ExplorerForm>(
    field: K,
    value: ExplorerForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = PROPERTY_SCHEMA.safeParse(form);
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ?? 'Check your property details.',
      );
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        property_address: validation.data.address,
        property_unit: validation.data.unit || undefined,
        property_city: validation.data.city,
        property_region: validation.data.region,
        property_postal_code: validation.data.postalCode.toUpperCase(),
        property_country: 'CA' as const,
        relationship_to_property: validation.data.relationship,
      };
      let saved = journey
        ? await updateSellerJourney(journey.id, payload)
        : await createSellerJourney(payload);
      if (saved.status === 'exploring') {
        saved = await updateSellerJourneyStatus(
          saved.id,
          'details_in_progress',
        );
      }
      applyJourney(saved);
      setStep('situation');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveSituation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journey) return;
    const validation = SITUATION_SCHEMA.safeParse(form);
    if (!validation.success) {
      setError(
        validation.error.issues[0]?.message ?? 'Check your situation details.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let saved = await updateSellerJourney(journey.id, {
        selling_timeline: validation.data.timeline || undefined,
        property_condition: validation.data.condition || undefined,
        renovations_upgrades: validation.data.renovations || undefined,
        primary_goal: validation.data.goal || undefined,
      });
      if (saved.status === 'details_in_progress') {
        saved = await updateSellerJourneyStatus(saved.id, 'plan_ready');
      }
      applyJourney(saved);
      setStep('plan');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function saveForLater() {
    if (!journey) {
      setStep('welcome');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved =
        journey.status === 'paused_inactive'
          ? journey
          : await updateSellerJourneyStatus(journey.id, 'paused_inactive');
      applyJourney(saved);
      setNotice(
        accessToken
          ? 'Your private exploration is saved. You can return whenever you are ready.'
          : 'Your progress is saved on this device. Sign in to attach it to your account and continue on another device.',
      );
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function requestReview(payload: ProfessionalReviewCreateRequest) {
    if (!journey) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const review = await requestProfessionalReview(journey.id, payload);
      applyJourney({ ...journey, status: 'professional_review_requested' });
      setNotice(
        review.assigned_agent_id
          ? 'Your request was routed to your Lucy Charms agent. This is not a listing or representation agreement.'
          : 'Your request was sent to the Lucy Charms seller team. This is not a listing or representation agreement.',
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const currentProgress =
    step === 'property' ? 0 : step === 'situation' ? 1 : 2;
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold text-primarycolor-text hover:underline"
          >
            ← Lucycharms
          </Link>
          {journey && (
            <button
              type="button"
              onClick={saveForLater}
              disabled={saving}
              className="text-sm font-semibold text-primarycolor-text hover:underline disabled:opacity-50"
            >
              Save and continue later
            </button>
          )}
        </div>

        {step !== 'welcome' && (
          <ol
            aria-label="Seller Explorer progress"
            className="mt-8 grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:text-sm"
          >
            {STEP_LABELS.map((label, index) => (
              <li
                key={label}
                className={
                  index <= currentProgress
                    ? 'text-primarycolor-text'
                    : 'text-zinc-500 dark:text-zinc-400'
                }
              >
                <span className="mx-auto mb-2 flex size-6 items-center justify-center rounded-full border border-current">
                  {index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        )}

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
            >
              {error}
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-primarycolor/20 bg-primarycolor/5 p-3 text-sm text-zinc-700 dark:text-zinc-200"
            >
              {notice}
              {!accessToken && (
                <button
                  onClick={() => router.push('/login?redirect=/sell')}
                  className="ml-2 font-semibold text-primarycolor-text hover:underline"
                >
                  Sign in to save to your account
                </button>
              )}
            </div>
          )}

          {step === 'welcome' && (
            <Welcome
              onStart={() => setStep('property')}
              onResume={() =>
                journey && setStep(stepFromStatus(journey.status))
              }
              hasJourney={Boolean(journey)}
            />
          )}
          {step === 'property' && (
            <PropertyStep
              form={form}
              saving={saving}
              setField={setField}
              onSubmit={saveProperty}
            />
          )}
          {step === 'situation' && (
            <SituationStep
              form={form}
              saving={saving}
              setField={setField}
              onSubmit={saveSituation}
              onBack={() => setStep('property')}
            />
          )}
          {step === 'plan' && (
            <PlanStep
              journey={journey}
              form={form}
              saving={saving}
              onReview={requestReview}
              user={user}
              onEdit={() => setStep('property')}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Welcome({
  onStart,
  onResume,
  hasJourney,
}: {
  onStart: () => void;
  onResume: () => void;
  hasJourney: boolean;
}) {
  return (
    <div className="py-4 sm:py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor-text">
        Seller Explorer
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
        What if you sold your home?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
        Explore your options privately, at your pace. There is no obligation,
        and you are not submitting or publishing a listing.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          'Add the home you are considering',
          'Share only the basics that help you plan',
          'See a simple path and decide your next step',
        ].map((item, i) => (
          <div
            key={item}
            className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <span className="mb-2 block font-bold text-primarycolor-text">
              0{i + 1}
            </span>
            {item}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-8 inline-flex w-full justify-center rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 sm:w-auto"
      >
        Start exploring
      </button>
      {hasJourney && (
        <button
          type="button"
          onClick={onResume}
          className="mt-3 block text-sm font-semibold text-primarycolor-text hover:underline sm:ml-4 sm:mt-0 sm:inline"
        >
          Resume my exploration
        </button>
      )}
    </div>
  );
}

function PropertyStep({
  form,
  setField,
  onSubmit,
  saving,
}: {
  form: ExplorerForm;
  setField: <K extends keyof ExplorerForm>(
    field: K,
    value: ExplorerForm[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  return (
    <form onSubmit={onSubmit}>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor-text">
        Step 1
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Which home are you exploring?
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        This creates a private property record for your Seller Journey. It does
        not create an MLS listing.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          label="Street address *"
          value={form.address}
          onChange={(v) => setField('address', v)}
          wide
        />
        <Input
          label="Unit"
          value={form.unit}
          onChange={(v) => setField('unit', v)}
        />
        <Input
          label="City *"
          value={form.city}
          onChange={(v) => setField('city', v)}
        />
        <Input
          label="Province / state *"
          value={form.region}
          onChange={(v) => setField('region', v)}
        />
        <Input
          label="Postal / ZIP code *"
          value={form.postalCode}
          onChange={(v) => setField('postalCode', v)}
        />
      </div>
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          This home is… *
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['owner', 'My home'],
              ['researching', 'A home I am researching'],
              ['curious', 'Just curious'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700"
            >
              <input
                className="mr-2 accent-primarycolor"
                type="radio"
                name="relationship"
                checked={form.relationship === value}
                onChange={() => setField('relationship', value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        disabled={saving}
        className="mt-7 w-full rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}

function SituationStep({
  form,
  setField,
  onSubmit,
  onBack,
  saving,
}: {
  form: ExplorerForm;
  setField: <K extends keyof ExplorerForm>(
    field: K,
    value: ExplorerForm[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <form onSubmit={onSubmit}>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor-text">
        Step 2
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        A little about your situation
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        You can keep this high-level. It is here to make your plan more useful,
        not to commit you to selling.
      </p>
      <div className="mt-6 grid gap-5">
        <Select
          label="When might you sell?"
          value={form.timeline}
          onChange={(v) => setField('timeline', v)}
          options={[
            'Just exploring',
            'Within 3 months',
            '3–6 months',
            '6–12 months',
            'More than a year',
          ]}
        />
        <Select
          label="How would you describe the home’s condition?"
          value={form.condition}
          onChange={(v) => setField('condition', v)}
          options={[
            'Move-in ready',
            'Well maintained',
            'Could use some updates',
            'Needs significant work',
          ]}
        />
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Major renovations or upgrades
          <textarea
            value={form.renovations}
            onChange={(e) => setField('renovations', e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="For example: kitchen update, roof replacement, or none"
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>
        <Input
          label="What matters most about selling?"
          value={form.goal}
          onChange={(v) => setField('goal', v)}
          placeholder="For example: timing a move, understanding value, or making the process easier"
        />
      </div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-5 py-3 text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5"
        >
          Back
        </button>
        <button
          disabled={saving}
          className="rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'View my seller snapshot'}
        </button>
      </div>
    </form>
  );
}

function PlanStep({
  journey,
  form,
  saving,
  onReview,
  user,
  onEdit,
}: {
  journey: SellerJourney | null;
  form: ExplorerForm;
  saving: boolean;
  onReview: (payload: ProfessionalReviewCreateRequest) => Promise<void>;
  user: AuthUser | null;
  onEdit: () => void;
}) {
  const [handoffOpen, setHandoffOpen] = useState(false);
  const homeValue = journey?.home_value_result_id
    ? 'A Home Value result is connected to this exploration.'
    : journey?.home_value_request_id
      ? 'Your Home Value request is in progress.'
      : 'A Home Value request or result will appear here when it is available through Lucycharms’ existing Home Value workflow.';
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor-text">
        Your Seller Snapshot
      </p>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        A calm place to start
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Your exploration is private. Nothing here creates or publishes a
        listing.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-primarycolor/20 bg-primarycolor/5 p-4">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
            Home Value
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            {homeValue}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
            Home readiness
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
            <li>
              {form.timeline ? '✓ Timing noted' : '• Add a timeline when ready'}
            </li>
            <li>
              {form.condition
                ? '✓ Condition noted'
                : '• Add a condition when ready'}
            </li>
            <li>
              {form.renovations
                ? '✓ Upgrades noted'
                : '• Add upgrades when ready'}
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
          A simple selling path
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <span>Preparation</span>
          <span aria-hidden="true">→</span>
          <span>Listing</span>
          <span aria-hidden="true">→</span>
          <span>Offers</span>
          <span aria-hidden="true">→</span>
          <span>Closing</span>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Consider gathering recent upgrade records, deciding what timing would
          feel comfortable, and noting questions you want answered.
        </p>
      </div>
      {handoffOpen && journey ? (
        <ProfessionalReviewForm
          journey={journey}
          user={user}
          saving={saving}
          onCancel={() => setHandoffOpen(false)}
          onSubmit={onReview}
        />
      ) : (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={
              journey
                ? `/chat?q=${encodeURIComponent('I have a question about selling my home')}&sellerJourneyId=${journey.id}`
                : '/chat?q=I%20have%20a%20question%20about%20selling%20my%20home'
            }
            className="rounded-full border border-primarycolor px-5 py-3 text-center text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5"
          >
            Ask Lucy
          </Link>
          {journey?.status === 'plan_ready' ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => setHandoffOpen(true)}
                className="rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
              >
                Request Professional Review
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setHandoffOpen(true)}
                className="rounded-full px-5 py-3 text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5"
              >
                I’m Ready to Discuss Selling
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setHandoffOpen(true)}
                className="rounded-full px-5 py-3 text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5"
              >
                Talk to a Professional
              </button>
            </>
          ) : journey?.status === 'professional_review_requested' ? (
            <p className="text-sm font-semibold text-primarycolor-text">
              Professional review requested — the seller team will follow up.
            </p>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Update my details
          </button>
        </div>
      )}
    </div>
  );
}

function ProfessionalReviewForm({
  journey,
  user,
  saving,
  onCancel,
  onSubmit,
}: {
  journey: SellerJourney;
  user: AuthUser | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: ProfessionalReviewCreateRequest) => Promise<void>;
}) {
  const [form, setForm] = useState<ReviewForm>(EMPTY_REVIEW_FORM);
  const [error, setError] = useState<string | null>(null);
  const knownFirstName = user?.first_name ?? '';
  const knownLastName = user?.last_name ?? '';
  const knownEmail = user?.email ?? '';

  function setField<K extends keyof ReviewForm>(
    field: K,
    value: ReviewForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstName = (knownFirstName || form.firstName).trim();
    const lastName = (knownLastName || form.lastName).trim();
    const email = (knownEmail || form.email).trim();
    const phone = form.phone.trim();
    if (!firstName || !form.request.trim()) {
      setError('Add your first name and what you would like help with.');
      return;
    }
    if (!email && !phone) {
      setError(
        'Add an email address or phone number so the seller team can reply.',
      );
      return;
    }
    setError(null);
    await onSubmit({
      first_name: knownFirstName ? undefined : firstName,
      last_name: knownLastName ? undefined : lastName || undefined,
      email: knownEmail ? undefined : email || undefined,
      phone: phone || undefined,
      request: form.request.trim(),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-7 rounded-xl border border-primarycolor/20 bg-primarycolor/5 p-4 sm:p-5"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primarycolor-text">
        Professional Review
      </p>
      <h2 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Talk with the seller team
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        We already have the property at {journey.property_address},{' '}
        {journey.property_city}. This is a request for help, not a listing or
        representation agreement.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {!knownFirstName && (
          <Input
            label="First name *"
            value={form.firstName}
            onChange={(value) => setField('firstName', value)}
          />
        )}
        {!knownLastName && (
          <Input
            label="Last name"
            value={form.lastName}
            onChange={(value) => setField('lastName', value)}
          />
        )}
        {!knownEmail && (
          <Input
            label="Email"
            value={form.email}
            onChange={(value) => setField('email', value)}
          />
        )}
        {!knownEmail && (
          <Input
            label="Phone"
            value={form.phone}
            onChange={(value) => setField('phone', value)}
          />
        )}
      </div>
      <label className="mt-4 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        What would you like help with? *
        <textarea
          value={form.request}
          onChange={(event) => setField('request', event.target.value)}
          maxLength={5000}
          rows={4}
          placeholder="For example: I would like to discuss timing, preparation, or next steps."
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-3 text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5"
        >
          Cancel
        </button>
        <button
          disabled={saving}
          className="rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
        >
          {saving ? 'Sending…' : 'Request Professional Review'}
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label
      className={`block text-sm font-semibold text-zinc-800 dark:text-zinc-100 ${wide ? 'sm:col-span-2' : ''}`}
    >
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={255}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      >
        <option value="">Choose one (optional)</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
