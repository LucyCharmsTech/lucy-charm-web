export type SavedSearchItem = {
  id: string;
  name: string;
  query: string;
  created_at: string;
};

export type ClientDocumentStatus = 'needed' | 'uploaded' | 'verified';

export type ClientDocumentItem = {
  id: string;
  title: string;
  status: ClientDocumentStatus;
  notes: string;
  updated_at: string;
};

export type NextStepItem = {
  id: string;
  label: string;
  done: boolean;
};

const SAVED_SEARCHES_KEY = 'lucy_client_saved_searches_v1';
const DOCS_KEY = 'lucy_client_docs_v1';
const NEXT_STEPS_KEY = 'lucy_client_next_steps_v1';
export const MAX_SAVED_SEARCHES = 3;

const DEFAULT_DOCS: ClientDocumentItem[] = [
  {
    id: 'doc-id',
    title: 'Government-issued ID',
    status: 'needed',
    notes: '',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'doc-preapproval',
    title: 'Mortgage pre-approval letter',
    status: 'needed',
    notes: '',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'doc-proof-funds',
    title: 'Proof of funds',
    status: 'needed',
    notes: '',
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_NEXT_STEPS: NextStepItem[] = [
  { id: 'step-finance', label: 'Finalize financing strategy', done: false },
  { id: 'step-listings', label: 'Shortlist top properties', done: false },
  { id: 'step-showings', label: 'Book showing appointments', done: false },
  { id: 'step-offer', label: 'Prepare offer documents', done: false },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readArray<T>(key: string, fallback: T[]): T[] {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    return parsed as T[];
  } catch {
    return fallback;
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function listSavedSearches(): SavedSearchItem[] {
  return readArray<SavedSearchItem>(SAVED_SEARCHES_KEY, []);
}

export function saveSearch(item: SavedSearchItem): SavedSearchItem[] {
  const current = listSavedSearches();
  if (current.length >= MAX_SAVED_SEARCHES) {
    return current;
  }
  const next = [item, ...current];
  writeArray(SAVED_SEARCHES_KEY, next);
  return next;
}

export function removeSavedSearch(id: string): SavedSearchItem[] {
  const next = listSavedSearches().filter((entry) => entry.id !== id);
  writeArray(SAVED_SEARCHES_KEY, next);
  return next;
}

export function listClientDocuments(): ClientDocumentItem[] {
  return readArray<ClientDocumentItem>(DOCS_KEY, DEFAULT_DOCS);
}

export function upsertClientDocument(item: ClientDocumentItem): ClientDocumentItem[] {
  const current = listClientDocuments();
  const next = current.map((entry) => (entry.id === item.id ? item : entry));
  writeArray(DOCS_KEY, next);
  return next;
}

export function listNextSteps(): NextStepItem[] {
  return readArray<NextStepItem>(NEXT_STEPS_KEY, DEFAULT_NEXT_STEPS);
}

export function setNextStepDone(id: string, done: boolean): NextStepItem[] {
  const next = listNextSteps().map((step) =>
    step.id === id ? { ...step, done } : step,
  );
  writeArray(NEXT_STEPS_KEY, next);
  return next;
}
