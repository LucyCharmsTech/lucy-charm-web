'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PublishedSellerPlan, { type SellerPublicationState } from '@/components/seller/PublishedSellerPlan';
import ExploringSellerDocuments from '@/components/seller/ExploringSellerDocuments';
import SellerAppointments from '@/components/seller/SellerAppointments';
import { fetchSellerAppointment } from '@/services/sellerAppointmentService';
import { fetchSellerPlan, respondToSellerPlan, type SellerPlanSeller } from '@/services/sellerService';
import { fetchPublishedSellerPlan } from '@/services/sellerPlanPdfService';
import { rememberSellerReturn } from '@/lib/sellerReturn';
import { useAuthStore } from '@/stores/authStore';
import {
  createSellerJourney,
  clearStoredSellerJourneyId,
  fetchSellerJourney,
  getStoredSellerJourneyId,
  listMySellerJourneys,
  requestProfessionalReview,
  resumeSellerJourney,
  storeSellerJourneyId,
  updateSellerJourney,
  updateSellerJourneyStatus,
} from '@/services/sellerJourneyService';
import type {
  SellerJourney,
  SellerJourneySummary,
  SellerLeadStatus,
  SellerJourneyPropertyRelationship,
  SellerJourneyStatus,
  ProfessionalReviewCreateRequest,
  AuthUser,
} from '@/types/api';

type ExplorerStep = 'welcome' | 'property' | 'situation' | 'plan';
type PortalView = 'overview' | 'plan' | 'documents' | 'appointments';
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

const STEP_LABELS = ['Your home', 'Your situation', 'Your next steps'];

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

function hasSubmittedPlan(journey: SellerJourney | null): boolean {
  return Boolean(journey && (
    journey.professional_review_status ||
    ['professional_review_requested', 'professional_follow_up', 'converted_to_client'].includes(journey.status) ||
    (journey.status === 'paused_inactive' && Boolean(journey.professional_review_status))
  ));
}

function planStatusLabel(status: SellerLeadStatus | null | undefined): string {
  switch (status) {
    case 'qualified': return 'Staff review in progress';
    case 'converted': return 'Converted to client';
    case 'lost': return 'Request closed';
    case 'valuation_requested': return 'Valuation requested';
    case 'consultation_requested': return 'Consultation requested';
    default: return 'Request received';
  }
}

function planProgressLabel(status: SellerPlanSeller['status'] | null | undefined): string {
  switch (status) {
    case 'in_preparation': return 'In preparation';
    case 'needs_information': return 'Information requested';
    case 'ready': return 'Open to check PDF availability';
    default: return 'Request received';
  }
}

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return typeof detail === 'string'
    ? detail
    : 'We could not save that just now. Please try again.';
}

function subscribeAuthHydration(listener: () => void) {
  return useAuthStore.persist.onFinishHydration(listener);
}

function authHydrationSnapshot() {
  return useAuthStore.persist.hasHydrated();
}

export default function SellPage() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const authHydrated = useSyncExternalStore(
    subscribeAuthHydration,
    authHydrationSnapshot,
    () => false,
  );
  const [step, setStep] = useState<ExplorerStep>('welcome');
  const [portalView, setPortalView] = useState<PortalView>('plan');
  const [loadedJourney, setLoadedJourney] = useState<{
    value: SellerJourney;
    accessToken: string | null;
  } | null>(null);
  const journey = loadedJourney?.accessToken === accessToken ? loadedJourney.value : null;
  const [form, setForm] = useState<ExplorerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signInPrompt, setSignInPrompt] = useState<'save' | 'plan' | null>(null);
  const [myJourneys, setMyJourneys] = useState<SellerJourneySummary[]>([]);
  const [myJourneysTotal, setMyJourneysTotal] = useState(0);
  const [loadedPage, setLoadedPage] = useState(1);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  const [loadedPlanProgress, setLoadedPlanProgress] = useState<{
    journeyId: string; accessToken: string; value: SellerPlanSeller;
  } | null>(null);
  const planProgress = loadedPlanProgress && loadedPlanProgress.journeyId === journey?.id && loadedPlanProgress.accessToken === accessToken
    ? loadedPlanProgress.value : null;
  const [planProgressError, setPlanProgressError] = useState(false);
  const [loadedPublication, setLoadedPublication] = useState<{
    journeyId: string; accessToken: string; value: SellerPublicationState;
  } | null>(null);
  const [publicationRetry, setPublicationRetry] = useState(0);
  const publicationRequestId = useRef(0);
  const lastPublicationFocusRefresh = useRef(0);
  const [publicationNotice, setPublicationNotice] = useState<{
    journeyId: string; accessToken: string; message: string;
  } | null>(null);
  const [planResponse, setPlanResponse] = useState('');
  const [responding, setResponding] = useState(false);
  const planJourneyId = journey?.id;
  const planRequested = hasSubmittedPlan(journey);
  const publication: SellerPublicationState = loadedPublication && loadedPublication.journeyId === journey?.id && loadedPublication.accessToken === accessToken
    ? loadedPublication.value : { kind: 'loading' };
  const visibleStep: ExplorerStep | 'loading' | 'recovery' =
    !authHydrated || discoveryLoading ||
    (loadedJourney !== null && loadedJourney.accessToken !== accessToken)
      ? 'loading'
      : discoveryFailed ? 'recovery' : step;

  function applyJourney(nextJourney: SellerJourney) {
    setLoadedJourney({ value: nextJourney, accessToken });
    setForm(formFromJourney(nextJourney));
    setMyJourneys((current) => current.map((item) => item.id === nextJourney.id ? {
      ...item,
      property_id: nextJourney.property_id,
      property_address: nextJourney.property_address,
      property_unit: nextJourney.property_unit,
      property_city: nextJourney.property_city,
      property_region: nextJourney.property_region,
      status: nextJourney.status,
      professional_review_status: nextJourney.professional_review_status ?? null,
      updated_at: nextJourney.updated_at,
    } : item));
  }

  function signInToSaveJourney() {
    rememberSellerReturn();
    setSignInPrompt(null);
    router.push('/login?redirect=%2Fsell');
  }

  useEffect(() => {
    const journeyId = planJourneyId;
    if (!accessToken || !journeyId || !planRequested) return;
    let active = true;
    fetchSellerPlan(journeyId).then((result) => {
      if (active) { setLoadedPlanProgress({ journeyId, accessToken, value: result }); setPlanResponse(result.information_response ?? ''); setPlanProgressError(false); }
    }).catch(() => { if (active) { setLoadedPlanProgress(null); setPlanProgressError(true); } });
    return () => { active = false; };
  }, [accessToken, planJourneyId, planRequested, publicationRetry]);

  useEffect(() => {
    const journeyId = planJourneyId;
    if (!accessToken || !journeyId || !planRequested) return;
    let active = true;
    const requestId = ++publicationRequestId.current;
    fetchPublishedSellerPlan(journeyId).then((result) => {
      if (active && requestId === publicationRequestId.current) setLoadedPublication({ journeyId, accessToken, value: { kind: 'available', value: result } });
    }).catch((failure) => {
      if (!active || requestId !== publicationRequestId.current) return;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      setLoadedPublication({ journeyId, accessToken, value: status === 404 ? { kind: 'unavailable' } : { kind: 'error' } });
    });
    return () => { active = false; };
  }, [accessToken, planJourneyId, planRequested, publicationRetry]);

  useEffect(() => {
    if (!accessToken || !planJourneyId || !planRequested) return;
    const revalidate = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastPublicationFocusRefresh.current < 500) return;
      lastPublicationFocusRefresh.current = now;
      publicationRequestId.current += 1;
      setLoadedPublication(null);
      setPublicationNotice(null);
      setPublicationRetry((current) => current + 1);
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [accessToken, planJourneyId, planRequested]);

  function refreshPublication(message?: string) {
    publicationRequestId.current += 1;
    setLoadedPublication(null);
    setPublicationNotice(message && accessToken && planJourneyId
      ? { journeyId: planJourneyId, accessToken, message } : null);
    setPublicationRetry((current) => current + 1);
  }

  async function submitPlanResponse() {
    if (!journey || !planProgress || responding || !planResponse.trim()) return;
    setResponding(true);
    setError(null);
    try {
      const result = await respondToSellerPlan(journey.id, planProgress.revision, planResponse.trim());
      setLoadedPlanProgress({ journeyId: journey.id, accessToken: accessToken!, value: result });
      setNotice('Your response has been sent to the Plan team.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setResponding(false);
    }
  }

  useEffect(() => {
    if (!authHydrated) return;
    let active = true;
    const load = async () => {
      setDiscoveryLoading(true);
      setDiscoveryFailed(false);
      setError(null);
      try {
        const owned = accessToken ? await listMySellerJourneys() : null;
        if (!active) return;
        setMyJourneys(owned?.items ?? []);
        setMyJourneysTotal(owned?.total ?? 0);
        setLoadedPage(1);
        const linkedAppointmentId = accessToken ? new URLSearchParams(window.location.search).get('appointment') : null;
        if (linkedAppointmentId) {
          try {
            const linkedAppointment = await fetchSellerAppointment(linkedAppointmentId);
            if (linkedAppointment.journey_id) {
              const linkedJourney = await fetchSellerJourney(linkedAppointment.journey_id);
              if (!active) return;
              if (linkedJourney.user_id !== user?.user_id) throw new Error('Journey ownership changed');
              storeSellerJourneyId(linkedJourney.id);
              setLoadedJourney({ value: linkedJourney, accessToken });
              setForm(formFromJourney(linkedJourney));
              setStep(stepFromStatus(linkedJourney.status));
              setPortalView('appointments');
              return;
            }
          } catch {
            if (!active) return;
            setError('That appointment could not be opened for this account. Review your saved explorations.');
          }
        }
        const journeyId = getStoredSellerJourneyId();
        if (!journeyId) {
          setLoadedJourney(null);
          setForm(EMPTY_FORM);
          setStep('welcome');
          return;
        }
        try {
          const restored = accessToken
            ? await resumeSellerJourney(journeyId)
            : await fetchSellerJourney(journeyId);
          if (!active) return;
          setLoadedJourney({ value: restored, accessToken });
          setForm(formFromJourney(restored));
          setStep(stepFromStatus(restored.status));
          setPortalView(new URLSearchParams(window.location.search).has('appointment') ? 'appointments' : 'plan');
          if (accessToken && !owned?.items.some((item) => item.id === restored.id)) {
            const refreshed = await listMySellerJourneys();
            if (!active) return;
            setMyJourneys(refreshed.items);
            setMyJourneysTotal(refreshed.total);
            setLoadedPage(1);
          }
        } catch (restoreError) {
          if (!active) return;
          const status = (restoreError as { response?: { status?: number } })?.response?.status;
          if (status === 403 || status === 404) clearStoredSellerJourneyId();
          setLoadedJourney(null);
          setForm(EMPTY_FORM);
          setStep('welcome');
          setSignInPrompt(null);
          setNotice(null);
          setError(accessToken
            ? 'This device could not reopen its saved exploration. Choose one of your account explorations below, or start another property.'
            : 'We could not open that saved exploration on this device. Start a new exploration below or try again later.');
        }
      } catch {
        if (active) {
          setMyJourneys([]);
          setMyJourneysTotal(0);
          setLoadedPage(1);
          setLoadedJourney(null);
          setForm(EMPTY_FORM);
          setDiscoveryFailed(true);
          setSignInPrompt(null);
          setNotice(null);
          setError('We could not check your saved explorations. Retry before starting another property.');
        }
      } finally {
        if (active) setDiscoveryLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [accessToken, authHydrated, discoveryRetry, user?.user_id]);

  async function openJourney(summary: SellerJourneySummary) {
    setSaving(true);
    setError(null);
    try {
      let restored = await fetchSellerJourney(summary.id);
      if (restored.user_id !== user?.user_id) throw new Error('Journey ownership changed');
      if (restored.status === 'paused_inactive') restored = await resumeSellerJourney(summary.id);
      else storeSellerJourneyId(summary.id);
      applyJourney(restored);
      setStep(stepFromStatus(restored.status));
      setPortalView(new URLSearchParams(window.location.search).has('appointment') ? 'appointments' : 'plan');
    } catch {
      setError('We could not open that exploration. Refresh and try again.');
    } finally {
      setSaving(false);
    }
  }

  function startNewExploration() {
    clearStoredSellerJourneyId();
    setLoadedJourney(null);
    setForm(EMPTY_FORM);
    setError(null);
    setNotice(null);
    setStep('property');
    setPortalView('plan');
  }

  async function loadMoreJourneys() {
    setSaving(true);
    try {
      const nextPage = loadedPage + 1;
      const next = await listMySellerJourneys(nextPage);
      setMyJourneys((current) => [...current, ...next.items.filter(
        (item) => !current.some((existing) => existing.id === item.id),
      )]);
      setMyJourneysTotal(next.total);
      setLoadedPage(nextPage);
      setError(null);
    } catch {
      setError('We could not load more explorations. Please retry.');
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof ExplorerForm>(
    field: K,
    value: ExplorerForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasSubmittedPlan(journey)) {
      setStep('situation');
      return;
    }
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
      // Keep the new record in memory even if the following status update fails;
      // a retry must update this journey, not create a second one.
      if (!journey) applyJourney(saved);
      if (saved.status === 'exploring') {
        saved = await updateSellerJourneyStatus(
          saved.id,
          'details_in_progress',
        );
      }
      if (!journey && accessToken && saved.user_id === user?.user_id) {
        setMyJourneys((current) => [{
          id: saved.id,
          property_id: saved.property_id,
          property_address: saved.property_address,
          property_unit: saved.property_unit,
          property_city: saved.property_city,
          property_region: saved.property_region,
          status: saved.status,
          professional_review_status: saved.professional_review_status ?? null,
          created_at: saved.created_at,
          updated_at: saved.updated_at,
        }, ...current]);
        setMyJourneysTotal((total) => total + 1);
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
    if (hasSubmittedPlan(journey)) return;
    setSaving(true);
    setError(null);
    try {
      let current = journey;
      if (step === 'property') {
        const validated = PROPERTY_SCHEMA.safeParse(form);
        if (!validated.success) {
          setError(validated.error.issues[0]?.message ?? 'Check your property details.');
          return;
        }
        current = await updateSellerJourney(journey.id, {
          property_address: validated.data.address,
          property_unit: validated.data.unit || undefined,
          property_city: validated.data.city,
          property_region: validated.data.region,
          property_postal_code: validated.data.postalCode.toUpperCase(),
          relationship_to_property: validated.data.relationship,
        });
      } else if (step === 'situation') {
        const validated = SITUATION_SCHEMA.safeParse(form);
        if (!validated.success) {
          setError(validated.error.issues[0]?.message ?? 'Check your situation details.');
          return;
        }
        current = await updateSellerJourney(journey.id, {
          selling_timeline: validated.data.timeline || undefined,
          property_condition: validated.data.condition || undefined,
          renovations_upgrades: validated.data.renovations || undefined,
          primary_goal: validated.data.goal || undefined,
        });
      }
      const saved =
        current.status === 'paused_inactive'
          ? current
          : await updateSellerJourneyStatus(current.id, 'paused_inactive');
      applyJourney(saved);
      setNotice(
        accessToken
          ? 'Your private exploration is saved. You can return whenever you are ready.'
          : 'Your progress is saved on this device. Sign in to attach it to your account and continue on another device.',
      );
      if (!accessToken) setSignInPrompt('save');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function requestReview(payload: ProfessionalReviewCreateRequest) {
    if (!journey) return;
    if (!accessToken || !user) {
      setSignInPrompt('plan');
      return;
    }
    if (journey.user_id !== user.user_id) {
      setError('Your exploration must be attached to this account before you can request a Seller Plan. Please refresh and try again.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const review = await requestProfessionalReview(journey.id, payload);
      applyJourney({ ...journey, status: 'professional_review_requested', professional_review_status: review.status as SellerLeadStatus });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  const currentProgress =
    visibleStep === 'property' ? 0 : visibleStep === 'situation' ? 1 : 2;
  const portalActive = Boolean(accessToken && journey && journey.user_id === user?.user_id &&
    visibleStep !== 'welcome' && visibleStep !== 'loading' && visibleStep !== 'recovery');
  const showExplorerProgress = !portalActive || portalView === 'plan';
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-semibold text-primarycolor-text hover:underline"
          >
            ← Lucycharms
          </Link>
          {journey && !hasSubmittedPlan(journey) && (
            <button
              type="button"
              onClick={saveForLater}
              disabled={saving}
              className="text-sm font-semibold text-primarycolor-text hover:underline disabled:opacity-50"
            >
              Save and continue later
            </button>
          )}
          {accessToken && myJourneys.length > 0 && visibleStep !== 'welcome' && visibleStep !== 'loading' && visibleStep !== 'recovery' && (
            <button type="button" onClick={() => setStep('welcome')} className="text-sm font-semibold text-primarycolor-text hover:underline">
              My explorations
            </button>
          )}
          <Link href="/contact?from=sell" className="text-sm font-semibold text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">
            Contact the team
          </Link>
        </div>

        {showExplorerProgress && visibleStep !== 'welcome' && visibleStep !== 'loading' && visibleStep !== 'recovery' && (
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
          {portalActive && <nav aria-label="Seller portal" className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
            {([['overview', 'Overview'], ['plan', 'My Seller Plan'], ['documents', 'Documents'], ['appointments', 'Appointments']] as const).map(([view, label]) =>
              <button key={view} type="button" aria-current={portalView === view ? 'page' : undefined}
                onClick={() => setPortalView(view)}
                className={portalView === view
                  ? 'min-h-10 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground'
                  : 'min-h-10 rounded-full px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100'}>{label}</button>)}
          </nav>}
          {visibleStep === 'loading' && (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-300">
              Checking your saved exploration…
            </p>
          )}
          {visibleStep === 'recovery' && (
            <button type="button" onClick={() => setDiscoveryRetry((value) => value + 1)} className="rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground">
              Retry saved explorations
            </button>
          )}
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
                  onClick={signInToSaveJourney}
                  className="ml-2 font-semibold text-primarycolor-text hover:underline"
                >
                  Sign in to save to your account
                </button>
              )}
            </div>
          )}

          {visibleStep === 'welcome' && (
            <Welcome
              onStart={startNewExploration}
              onResume={() =>
                journey && setStep(stepFromStatus(journey.status))
              }
              hasJourney={Boolean(journey)}
              journeys={myJourneys}
              totalJourneys={myJourneysTotal}
              loading={saving}
              onOpen={(summary) => void openJourney(summary)}
              onLoadMore={() => void loadMoreJourneys()}
            />
          )}
          {portalActive && portalView === 'overview' && journey && <section aria-label="Seller overview" className="space-y-5">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-primarycolor-text">Your home</p>
              <h1 className="mt-2 text-2xl font-bold text-zinc-900">{journey.property_address || 'Saved exploration'}</h1>
              <p className="mt-1 text-sm text-zinc-600">{[journey.property_unit, journey.property_city, journey.property_region].filter(Boolean).join(', ')}</p></div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <h2 className="text-base font-semibold">Seller Plan status</h2>
              <p className="mt-2 text-sm text-zinc-700">{!planRequested ? 'Exploration saved. No Seller Plan has been requested.'
                : publication.kind === 'available' ? 'Ready — your published PDF is available.'
                  : planProgressError ? 'We could not check current progress right now.'
                    : planProgress ? planProgressLabel(planProgress.status) : 'Checking current Plan progress…'}</p>
            </div>
            <div className="border-t border-zinc-200 pt-4"><h2 className="text-sm font-semibold">Next step</h2>
              <p className="mt-1 text-sm text-zinc-600">{!planRequested ? 'Continue your details, then decide whether to request a free Seller Plan.'
                : planProgress?.status === 'needs_information' && planProgress.information_request ? 'Staff has requested information for this Plan.'
                  : publication.kind === 'available' ? 'Your current Seller Plan is ready to view.' : 'Review the latest Plan status and your saved details.'}</p>
              <button type="button" onClick={() => setPortalView('plan')} className="mt-3 min-h-10 rounded-full bg-primarycolor px-5 py-2 text-sm font-semibold text-primarycolor-foreground">
                {!planRequested ? 'Continue exploring' : publication.kind === 'available' ? 'View Seller Plan' : 'View Plan status'}
              </button></div>
            <p className="text-xs text-zinc-500">Exploring or requesting a Plan does not create a representation agreement.</p>
          </section>}
          {portalActive && portalView === 'documents' && journey && <ExploringSellerDocuments
            key={`${journey.id}:${accessToken}`} journeyId={journey.id} publication={publication} onPublicationRefresh={refreshPublication} />}
          {portalActive && portalView === 'appointments' && journey && <SellerAppointments
            key={`${journey.id}:${accessToken}`} scope={{ journeyId: journey.id }} contactHref="/contact?from=sell" />}
          {(!portalActive || portalView === 'plan') && visibleStep === 'property' && (
            <PropertyStep
              form={form}
              saving={saving}
              propertyLocked={hasSubmittedPlan(journey)}
              setField={setField}
              onSubmit={saveProperty}
            />
          )}
          {(!portalActive || portalView === 'plan') && visibleStep === 'situation' && (
            <SituationStep
              form={form}
              saving={saving}
              setField={setField}
              onSubmit={saveSituation}
              onBack={() => setStep('property')}
            />
          )}
          {(!portalActive || portalView === 'plan') && visibleStep === 'plan' && (
            <PlanStep
              journey={journey}
              planProgress={planProgress}
              planProgressError={planProgressError}
              publication={publication}
              onPublicationRefresh={refreshPublication}
              publicationNotice={publicationNotice?.journeyId === journey?.id && publicationNotice?.accessToken === accessToken ? publicationNotice.message : null}
              accessToken={accessToken}
              planResponse={planResponse}
              onPlanResponseChange={setPlanResponse}
              onPlanResponse={() => void submitPlanResponse()}
              responding={responding}
              form={form}
              saving={saving}
              onReview={requestReview}
              onSignInRequired={() => setSignInPrompt('plan')}
              user={user}
              onEdit={() => setStep('property')}
            />
          )}
        </section>
        <ConfirmDialog
          open={signInPrompt !== null}
          layout="mobile-sheet"
          title={signInPrompt === 'plan' ? 'Sign in to request your free Seller Plan' : 'Save your progress to your account'}
          description={signInPrompt === 'plan'
            ? 'Your answers will stay on this device while you sign in. Return here to review and explicitly submit your request. Signing in does not start representation.'
            : 'You can keep exploring on this device without signing in. Sign in to attach your saved answers to your account.'}
          confirmLabel="Sign in"
          cancelLabel="Keep exploring"
          onCancel={() => setSignInPrompt(null)}
          onConfirm={signInToSaveJourney}
        />
      </div>
    </main>
  );
}

function Welcome({
  onStart,
  onResume,
  hasJourney,
  journeys,
  totalJourneys,
  loading,
  onOpen,
  onLoadMore,
}: {
  onStart: () => void;
  onResume: () => void;
  hasJourney: boolean;
  journeys: SellerJourneySummary[];
  totalJourneys: number;
  loading: boolean;
  onOpen: (journey: SellerJourneySummary) => void;
  onLoadMore: () => void;
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
      {journeys.length > 0 && (
        <section aria-label="Your saved explorations" className="mt-7 rounded-xl border border-primarycolor/20 bg-primarycolor/5 p-4">
          <h2 className="text-lg font-bold">Your saved explorations</h2>
          <div className="mt-3 space-y-3">
            {journeys.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="font-semibold">{item.property_address}{item.property_unit ? `, ${item.property_unit}` : ''}, {item.property_city}, {item.property_region}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {item.professional_review_status
                    ? `Seller Plan: ${item.seller_plan_status ? planProgressLabel(item.seller_plan_status) : planStatusLabel(item.professional_review_status)}`
                    : 'Exploration saved — no Seller Plan request submitted'}
                </p>
                <button type="button" disabled={loading} onClick={() => onOpen(item)} className="mt-3 text-sm font-semibold text-primarycolor-text hover:underline disabled:opacity-50">
                  Review or continue
                </button>
              </div>
            ))}
          </div>
          {journeys.length < totalJourneys && (
            <button type="button" disabled={loading} onClick={onLoadMore} className="mt-4 text-sm font-semibold text-primarycolor-text hover:underline disabled:opacity-50">
              Load more explorations
            </button>
          )}
        </section>
      )}
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
        {journeys.length > 0 || hasJourney ? 'Explore another property' : 'Start exploring'}
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
  propertyLocked,
}: {
  form: ExplorerForm;
  setField: <K extends keyof ExplorerForm>(
    field: K,
    value: ExplorerForm[K],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  propertyLocked: boolean;
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
      {propertyLocked && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="note">
          This property is linked to a submitted Seller Plan request. Contact staff to correct its identity; you can still update your situation answers on the next step.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          label="Street address *"
          value={form.address}
          onChange={(v) => setField('address', v)}
          disabled={propertyLocked}
          wide
        />
        <Input
          label="Unit"
          value={form.unit}
          onChange={(v) => setField('unit', v)}
          disabled={propertyLocked}
        />
        <Input
          label="City *"
          value={form.city}
          onChange={(v) => setField('city', v)}
          disabled={propertyLocked}
        />
        <Input
          label="Province / state *"
          value={form.region}
          onChange={(v) => setField('region', v)}
          disabled={propertyLocked}
        />
        <Input
          label="Postal / ZIP code *"
          value={form.postalCode}
          onChange={(v) => setField('postalCode', v)}
          disabled={propertyLocked}
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
                disabled={propertyLocked}
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
          {saving ? 'Saving…' : 'See my next steps'}
        </button>
      </div>
    </form>
  );
}

function PlanStep({
  journey,
  planProgress,
  planProgressError,
  publication,
  publicationNotice,
  onPublicationRefresh,
  accessToken,
  planResponse,
  onPlanResponseChange,
  onPlanResponse,
  responding,
  form,
  saving,
  onReview,
  onSignInRequired,
  user,
  onEdit,
}: {
  journey: SellerJourney | null;
  planProgress: SellerPlanSeller | null;
  planProgressError: boolean;
  publication: SellerPublicationState;
  publicationNotice: string | null;
  onPublicationRefresh: (message?: string) => void;
  accessToken: string | null;
  planResponse: string;
  onPlanResponseChange: (value: string) => void;
  onPlanResponse: () => void;
  responding: boolean;
  form: ExplorerForm;
  saving: boolean;
  onReview: (payload: ProfessionalReviewCreateRequest) => Promise<void>;
  onSignInRequired: () => void;
  user: AuthUser | null;
  onEdit: () => void;
}) {
  const [handoffOpen, setHandoffOpen] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const planRequested = hasSubmittedPlan(journey);
  const visiblePlanStatus = publication.kind === 'available' ? 'Ready — PDF published'
    : planProgressError ? 'Unavailable'
      : !planProgress || publication.kind === 'loading' ? 'Checking current Plan status…'
        : planProgress.status === 'ready' ? 'Published PDF unavailable'
          : planProgressLabel(planProgress.status);
  const planSummary = publication.kind === 'available'
    ? 'Your completed Seller Plan is available below.'
    : planProgress?.status === 'needs_information'
      ? 'Staff needs a little more information to continue preparing your Seller Plan.'
      : planProgress?.status === 'in_preparation'
        ? 'Staff is preparing your free Seller Plan and will follow up.'
        : planProgress?.status === 'ready'
          ? 'Your request remains on file, but no published PDF is currently available.'
          : 'Your free Seller Plan request is already submitted. Staff will review it and follow up.';

  useEffect(() => {
    if (planRequested) {
      confirmationRef.current?.scrollIntoView?.({ block: 'center' });
      confirmationRef.current?.focus({ preventScroll: true });
    }
  }, [planRequested]);

  const homeValue = journey?.home_value_result_id
    ? 'A Home Value result is connected to this exploration.'
    : journey?.home_value_request_id
      ? 'Your Home Value request is in progress.'
      : 'A personalized valuation is optional. Staff will include property-specific advice only after the required review and compliance checks.';
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor-text">
        Your Seller Explorer summary
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
      {planRequested ? (
        <div
          ref={confirmationRef}
          role="status"
          tabIndex={-1}
          className="mt-7 rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-50 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primarycolor-text">Seller Explorer</p>
              <h2 className="mt-1 text-xl font-bold">Your Seller Plan</h2>
            </div>
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-primarycolor/20 bg-primarycolor/5 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primarycolor" />
              Current status: {visiblePlanStatus}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
            {planSummary}
          </p>
          {planProgressError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Current Plan progress could not be loaded. Refresh to try again.</p>}
          {publicationNotice && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{publicationNotice}</p>}
          {planProgress?.status === 'needs_information' && planProgress.information_request && <section aria-label="Information requested" className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
            <h3 className="font-semibold">Staff requested information</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{planProgress.information_request}</p>
            <label className="mt-4 block text-sm font-semibold">Your response
              <textarea className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-normal text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50" rows={3} maxLength={1000} value={planResponse} onChange={(event) => onPlanResponseChange(event.target.value)} />
            </label>
            <button type="button" disabled={responding || !planResponse.trim()} onClick={onPlanResponse} className="mt-3 min-h-11 rounded-full bg-primarycolor px-5 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50">{responding ? 'Sending…' : 'Send response'}</button>
            {planProgress.information_response && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Your latest response is saved. You can update it while the request remains open.</p>}
          </section>}
          {journey && user && accessToken && journey.user_id === user.user_id && (
            <PublishedSellerPlan key={`${journey.id}:${accessToken}:${publication.kind === 'available' ? publication.value.version_id : publication.kind}`} journeyId={journey.id} publication={publication} onRefresh={onPublicationRefresh} />
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="max-w-md text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">Requesting a Seller Plan does not create a listing or representation agreement.</p>
            <button type="button" onClick={onEdit} className="min-h-10 rounded-full px-4 py-2 text-sm font-semibold text-primarycolor-text hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor">Update my details</button>
          </div>
        </div>
      ) : handoffOpen && journey ? (
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
                disabled={saving || (Boolean(user) && journey.user_id !== user?.user_id)}
                onClick={() => {
                  if (!user) onSignInRequired();
                  else setHandoffOpen(true);
                }}
                className="rounded-full bg-primarycolor px-5 py-3 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-50"
              >
                Request a free Seller Plan
              </button>
            </>
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
        Free Seller Plan
      </p>
      <h2 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Request a staff-prepared Seller Plan
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
          {saving ? 'Sending…' : 'Submit Seller Plan request'}
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
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
