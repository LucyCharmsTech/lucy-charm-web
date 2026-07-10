'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchCurrentUserOnboarding, submitCurrentUserOnboarding } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type {
  OnboardingFinancingStatus,
  OnboardingPrimaryIntent,
  OnboardingPropertyType,
  OnboardingTimeline,
} from '@/types/api';

const TOTAL_STEPS = 3;

const intentOptions: Array<{ value: OnboardingPrimaryIntent; label: string }> = [
  { value: 'buyer', label: 'Buy a home' },
  { value: 'seller', label: 'Sell a home' },
  { value: 'investor', label: 'Invest in property' },
  { value: 'exploring', label: 'Just exploring' },
];

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

export default function SignupOnboardingWizard() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [step, setStep] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [primaryIntent, setPrimaryIntent] = useState<OnboardingPrimaryIntent | ''>('');
  const [timeline, setTimeline] = useState<OnboardingTimeline | ''>('');
  const [preferredCountry, setPreferredCountry] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<OnboardingPropertyType[]>([]);
  const [financingStatus, setFinancingStatus] = useState<OnboardingFinancingStatus | ''>('');
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
    if (step === 1) {
      return Boolean(primaryIntent) && Boolean(timeline);
    }
    if (step === 2) {
      return preferredCountry.trim().length >= 2 && preferredCity.trim().length >= 1 && propertyTypes.length >= 1;
    }
    return true;
  }, [preferredCity, preferredCountry, primaryIntent, propertyTypes.length, step, timeline]);

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

  async function handleSubmit() {
    if (!primaryIntent || !timeline || propertyTypes.length === 0) {
      setError('Please complete the required questions before finishing.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submitCurrentUserOnboarding({
        primary_intent: primaryIntent,
        timeline,
        preferred_country: preferredCountry.trim(),
        preferred_city: preferredCity.trim(),
        property_types: propertyTypes,
        financing_status: financingStatus || undefined,
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
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                What brings you to Lucy Charm today?
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {intentOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm hover:border-primarycolor dark:border-zinc-700 dark:hover:border-primarycolor"
                  >
                    <input
                      type="radio"
                      name="primary-intent"
                      value={option.value}
                      checked={primaryIntent === option.value}
                      onChange={() => setPrimaryIntent(option.value)}
                      className="size-4 accent-primarycolor"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                How soon are you planning to move forward?
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="preferred-country" className="text-sm font-semibold">
                  Preferred country
                </Label>
                <Input
                  id="preferred-country"
                  value={preferredCountry}
                  onChange={(event) => setPreferredCountry(event.target.value)}
                  placeholder="Canada"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferred-city" className="text-sm font-semibold">
                  Preferred city
                </Label>
                <Input
                  id="preferred-city"
                  value={preferredCity}
                  onChange={(event) => setPreferredCity(event.target.value)}
                  placeholder="Toronto"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

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
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Financing status (optional)
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
                  Saving...
                </span>
              ) : (
                'Finish'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
