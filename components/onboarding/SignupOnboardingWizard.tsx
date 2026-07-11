'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchCurrentUserOnboarding, submitCurrentUserOnboarding } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type {
  OnboardingFinancingStatus,
  OnboardingMainPriority,
  OnboardingPropertyType,
  OnboardingTimeline,
} from '@/types/api';

const TOTAL_STEPS = 3;

const timelineOptions: Array<{ value: OnboardingTimeline; label: string }> = [
  { value: 'asap', label: 'ASAP' },
  { value: '1_3_months', label: '1-3 months' },
  { value: '3_6_months', label: '3-6 months' },
  { value: '6_plus_months', label: '6+ months' },
];

const propertyTypeOptions: Array<{ value: OnboardingPropertyType; label: string }> = [
  { value: 'house', label: 'House' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhome', label: 'Townhome' },
  { value: 'multi_family', label: 'Multi-family' },
  { value: 'other', label: 'Other' },
];

const financingOptions: Array<{ value: OnboardingFinancingStatus; label: string }> = [
  { value: 'pre_approved', label: 'Pre-approved' },
  { value: 'not_yet', label: 'Not yet' },
  { value: 'cash', label: 'Paying cash' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const priorityOptions: Array<{ value: OnboardingMainPriority; label: string }> = [
  { value: 'price', label: 'Price and affordability' },
  { value: 'location', label: 'Location and commute' },
  { value: 'size', label: 'Layout and home size' },
  { value: 'schools', label: 'School district quality' },
  { value: 'investment', label: 'Long-term value' },
  { value: 'lifestyle', label: 'Lifestyle and amenities' },
];

export default function SignupOnboardingWizard() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [step, setStep] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<OnboardingTimeline | ''>('');
  const [preferredCountry, setPreferredCountry] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<OnboardingPropertyType[]>([]);
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minBathrooms, setMinBathrooms] = useState('');
  const [parkingPreference, setParkingPreference] = useState<'yes' | 'no' | 'either' | ''>('');
  const [financingStatus, setFinancingStatus] = useState<OnboardingFinancingStatus | ''>('');
  const [mainPriorities, setMainPriorities] = useState<OnboardingMainPriority[]>([]);
  const [wantsListingAlerts, setWantsListingAlerts] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login?redirect=%2Fonboarding');
      return;
    }

    let active = true;
    setInitialLoading(true);
    setError(null);

    fetchCurrentUserOnboarding()
      .then((result) => {
        if (!active) return;
        if (result.completed) {
          router.replace('/');
        }
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load onboarding state. Please refresh and try again.');
      })
      .finally(() => {
        if (!active) return;
        setInitialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, router]);

  const canContinue = useMemo(() => {
    const parsedBudgetMin = Number.parseInt(budgetMin, 10);
    const parsedBudgetMax = Number.parseInt(budgetMax, 10);

    if (step === 1) {
      return (
        Boolean(timeline) &&
        preferredCountry.trim().length >= 2 &&
        preferredCity.trim().length >= 1 &&
        Number.isFinite(parsedBudgetMin) &&
        Number.isFinite(parsedBudgetMax) &&
        parsedBudgetMin >= 0 &&
        parsedBudgetMax >= parsedBudgetMin
      );
    }
    if (step === 2) {
      return (
        propertyTypes.length >= 1 &&
        parkingPreference !== '' &&
        (minBedrooms === '' || Number.parseInt(minBedrooms, 10) >= 0) &&
        (minBathrooms === '' || Number.parseInt(minBathrooms, 10) >= 0)
      );
    }
    if (step === 3) {
      return Boolean(financingStatus) && mainPriorities.length >= 1;
    }
    return true;
  }, [
    budgetMax,
    budgetMin,
    financingStatus,
    mainPriorities.length,
    minBathrooms,
    minBedrooms,
    parkingPreference,
    preferredCity,
    preferredCountry,
    propertyTypes.length,
    step,
    timeline,
  ]);

  function togglePropertyType(value: OnboardingPropertyType) {
    setPropertyTypes((prev) => {
      if (prev.includes(value)) {
        return prev.filter((entry) => entry !== value);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, value];
    });
  }

  function togglePriority(value: OnboardingMainPriority) {
    setMainPriorities((prev) => {
      if (prev.includes(value)) {
        return prev.filter((entry) => entry !== value);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, value];
    });
  }

  async function handleSubmit() {
    if (!canContinue || !timeline || propertyTypes.length === 0 || !financingStatus) {
      setError('Please complete the required questions before finishing.');
      return;
    }

    const parsedBudgetMin = Number.parseInt(budgetMin, 10);
    const parsedBudgetMax = Number.parseInt(budgetMax, 10);
    const parsedMinBedrooms = minBedrooms === '' ? undefined : Number.parseInt(minBedrooms, 10);
    const parsedMinBathrooms = minBathrooms === '' ? undefined : Number.parseInt(minBathrooms, 10);
    const parkingRequired =
      parkingPreference === 'either' ? undefined : parkingPreference === 'yes' ? true : false;

    setSubmitting(true);
    setError(null);
    try {
      await submitCurrentUserOnboarding({
        primary_intent: 'exploring',
        timeline,
        preferred_country: preferredCountry.trim(),
        preferred_city: preferredCity.trim(),
        property_types: propertyTypes,
        budget_min: parsedBudgetMin,
        budget_max: parsedBudgetMax,
        min_bedrooms: parsedMinBedrooms,
        min_bathrooms: parsedMinBathrooms,
        parking_required: parkingRequired,
        financing_status: financingStatus,
        main_priorities: mainPriorities,
        wants_listing_alerts: wantsListingAlerts,
      });
      router.replace('/');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not save your onboarding profile. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
        <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          Loading onboarding...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primarycolor">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Personalize your experience
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            A few quick questions so Lucy can tailor listings and recommendations.
          </p>
          <div className="mt-4 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-primarycolor transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="preferred-country" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Preferred country
                </label>
                <Input
                  id="preferred-country"
                  value={preferredCountry}
                  onChange={(event) => setPreferredCountry(event.target.value)}
                  placeholder="Canada"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="preferred-city" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Preferred city
                </label>
                <Input
                  id="preferred-city"
                  value={preferredCity}
                  onChange={(event) => setPreferredCity(event.target.value)}
                  placeholder="Toronto"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="budget-min" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Budget minimum
                </label>
                <Input
                  id="budget-min"
                  inputMode="numeric"
                  value={budgetMin}
                  onChange={(event) => setBudgetMin(event.target.value)}
                  placeholder="500000"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="budget-max" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Budget maximum
                </label>
                <Input
                  id="budget-max"
                  inputMode="numeric"
                  value={budgetMax}
                  onChange={(event) => setBudgetMax(event.target.value)}
                  placeholder="900000"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Buying timeline
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {timelineOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor"
                  >
                    <input
                      type="radio"
                      name="timeline"
                      value={option.value}
                      checked={timeline === option.value}
                      onChange={() => setTimeline(option.value)}
                      className="size-4 accent-primarycolor"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Property types (choose up to 3)
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {propertyTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={propertyTypes.includes(option.value)}
                      onChange={() => togglePropertyType(option.value)}
                      className="size-4 accent-primarycolor"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="min-bedrooms" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Minimum bedrooms (optional)
                </label>
                <Input
                  id="min-bedrooms"
                  inputMode="numeric"
                  value={minBedrooms}
                  onChange={(event) => setMinBedrooms(event.target.value)}
                  placeholder="3"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="min-bathrooms" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Minimum bathrooms (optional)
                </label>
                <Input
                  id="min-bathrooms"
                  inputMode="numeric"
                  value={minBathrooms}
                  onChange={(event) => setMinBathrooms(event.target.value)}
                  placeholder="2"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Parking preference</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor">
                  <input
                    type="radio"
                    name="parking-preference"
                    value="yes"
                    checked={parkingPreference === 'yes'}
                    onChange={() => setParkingPreference('yes')}
                    className="size-4 accent-primarycolor"
                  />
                  Required
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor">
                  <input
                    type="radio"
                    name="parking-preference"
                    value="no"
                    checked={parkingPreference === 'no'}
                    onChange={() => setParkingPreference('no')}
                    className="size-4 accent-primarycolor"
                  />
                  Not needed
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor">
                  <input
                    type="radio"
                    name="parking-preference"
                    value="either"
                    checked={parkingPreference === 'either'}
                    onChange={() => setParkingPreference('either')}
                    className="size-4 accent-primarycolor"
                  />
                  Flexible
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pre-approval status
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {financingOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor"
                  >
                    <input
                      type="radio"
                      name="financing-status"
                      value={option.value}
                      checked={financingStatus === option.value}
                      onChange={() => setFinancingStatus(option.value)}
                      className="size-4 accent-primarycolor"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Main priorities (choose up to 4)
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {priorityOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={mainPriorities.includes(option.value)}
                      onChange={() => togglePriority(option.value)}
                      className="size-4 accent-primarycolor"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Alerts preference
              </legend>
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3 text-sm dark:border-zinc-700">
                <input
                  type="checkbox"
                  checked={wantsListingAlerts}
                  onChange={(event) => setWantsListingAlerts(event.target.checked)}
                  className="size-4 accent-primarycolor"
                />
                Send me instant alerts for matching homes and updates.
              </label>
            </fieldset>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={step === 1 || submitting}
            onClick={() => setStep((prev) => Math.max(1, prev - 1))}
          >
            Back
          </Button>
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              className="rounded-xl bg-primarycolor text-white hover:bg-primarycolor/90"
              disabled={!canContinue || submitting}
              onClick={() => setStep((prev) => Math.min(TOTAL_STEPS, prev + 1))}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              className="rounded-xl bg-primarycolor text-white hover:bg-primarycolor/90"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Saving preferences...
                </span>
              ) : (
                'Save and finish'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
