import type { ListingItem } from '@/components/listings/data';
import type { UserPropertyPreferences } from '@/lib/userPreferences';

function parsePrice(priceText: string): number | null {
  const numeric = Number.parseFloat(priceText.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseMetric(text: string): number | null {
  const numeric = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function matchesText(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

function scoreByPriority(item: ListingItem, preferences: UserPropertyPreferences): number {
  let score = 0;
  const price = parsePrice(item.priceText);
  const beds = parseMetric(item.bedsText);
  const baths = parseMetric(item.bathsText);

  for (const priority of preferences.mainPriorities) {
    if (priority === 'location' && preferences.preferredCity) {
      if (matchesText(item.locationText, preferences.preferredCity)) score += 30;
    }
    if (priority === 'price' && price !== null && preferences.budgetMax !== null) {
      if (price <= preferences.budgetMax) score += 30;
      if (preferences.budgetMin !== null && price >= preferences.budgetMin) score += 20;
    }
    if (priority === 'size') {
      if (preferences.minBedrooms !== null && beds !== null && beds >= preferences.minBedrooms) score += 20;
      if (preferences.minBathrooms !== null && baths !== null && baths >= preferences.minBathrooms) score += 20;
    }
    if (priority === 'schools' || priority === 'investment' || priority === 'lifestyle') {
      // Mock cards do not yet include rich school/investment/lifestyle metadata.
      score += 5;
    }
  }

  if (preferences.propertyTypes.length > 0) {
    const normalizedType = item.typeLabel.toLowerCase();
    const typeAlias: Record<string, string> = {
      detached: 'house',
      semi_detached: 'house',
      condo: 'condo',
      townhome: 'townhome',
      multi_family: 'multi_family',
      house: 'house',
      other: 'other',
    };
    const mappedType = typeAlias[normalizedType] ?? 'other';
    if (preferences.propertyTypes.includes(mappedType as (typeof preferences.propertyTypes)[number])) {
      score += 25;
    }
  }

  return score;
}

export function matchListingsToPreferences(
  items: ListingItem[],
  preferences: UserPropertyPreferences | null,
): ListingItem[] {
  if (!preferences) return items;

  return [...items]
    .map((item) => ({
      item,
      score:
        scoreByPriority(item, preferences) +
        (matchesText(item.locationText, preferences.preferredCity) ? 15 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
