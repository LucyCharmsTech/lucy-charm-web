const MOCK_SAVED_IDS_KEY = 'lucy_mock_saved_listing_ids_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readIds(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(MOCK_SAVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(MOCK_SAVED_IDS_KEY, JSON.stringify(ids));
}

export async function listMockSavedListingIds(): Promise<string[]> {
  return readIds();
}

export async function isMockListingSaved(listingId: string): Promise<boolean> {
  return readIds().includes(listingId);
}

export async function saveMockListing(listingId: string): Promise<void> {
  const ids = readIds();
  if (ids.includes(listingId)) return;
  writeIds([...ids, listingId]);
}

export async function unsaveMockListing(listingId: string): Promise<void> {
  const ids = readIds();
  writeIds(ids.filter((id) => id !== listingId));
}
