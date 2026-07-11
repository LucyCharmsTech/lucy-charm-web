import type {
  OnboardingMainPriority,
  OnboardingPropertyType,
  OnboardingTimeline,
} from '@/types/api';

export type UserPropertyPreferences = {
  preferredCountry: string;
  preferredCity: string;
  timeline: OnboardingTimeline | null;
  propertyTypes: OnboardingPropertyType[];
  budgetMin: number | null;
  budgetMax: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  parkingRequired: boolean | null;
  mainPriorities: OnboardingMainPriority[];
};

type RawOnboardingResponses = {
  preferred_country?: unknown;
  preferred_city?: unknown;
  timeline?: unknown;
  property_types?: unknown;
  budget_min?: unknown;
  budget_max?: unknown;
  min_bedrooms?: unknown;
  min_bathrooms?: unknown;
  parking_required?: unknown;
  main_priorities?: unknown;
};

export function emptyUserPropertyPreferences(): UserPropertyPreferences {
  return {
    preferredCountry: '',
    preferredCity: '',
    timeline: null,
    propertyTypes: [],
    budgetMin: null,
    budgetMax: null,
    minBedrooms: null,
    minBathrooms: null,
    parkingRequired: null,
    mainPriorities: [],
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function asBooleanOrNull(value: unknown): boolean | null {
  if (typeof value !== 'boolean') return null;
  return value;
}

function asPropertyTypes(value: unknown): OnboardingPropertyType[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is OnboardingPropertyType =>
    ['house', 'condo', 'townhome', 'multi_family', 'other'].includes(String(entry)),
  );
}

function asPriorities(value: unknown): OnboardingMainPriority[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is OnboardingMainPriority =>
    ['price', 'location', 'size', 'schools', 'investment', 'lifestyle'].includes(String(entry)),
  );
}

function asTimeline(value: unknown): OnboardingTimeline | null {
  const timeline = String(value ?? '');
  if (!['asap', '1_3_months', '3_6_months', '6_plus_months'].includes(timeline)) {
    return null;
  }
  return timeline as OnboardingTimeline;
}

export function normalizeUserPropertyPreferences(
  responses: Record<string, unknown> | null | undefined,
): UserPropertyPreferences {
  if (!responses) return emptyUserPropertyPreferences();

  const raw = responses as RawOnboardingResponses;
  return {
    preferredCountry: asString(raw.preferred_country),
    preferredCity: asString(raw.preferred_city),
    timeline: asTimeline(raw.timeline),
    propertyTypes: asPropertyTypes(raw.property_types),
    budgetMin: asNumberOrNull(raw.budget_min),
    budgetMax: asNumberOrNull(raw.budget_max),
    minBedrooms: asNumberOrNull(raw.min_bedrooms),
    minBathrooms: asNumberOrNull(raw.min_bathrooms),
    parkingRequired: asBooleanOrNull(raw.parking_required),
    mainPriorities: asPriorities(raw.main_priorities),
  };
}
