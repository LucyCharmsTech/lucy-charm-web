import api from '@/lib/axios';
import { track } from '@/lib/analytics';
import {
  analyticsAttributionHeaders,
  getOrCreateAnalyticsAnonymousId,
  linkAnalyticsAnonymousIdentity,
  registerAnalyticsAnonymousIdentity,
} from '@/lib/analyticsIdentity';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), put: jest.fn() },
}));
const mockedApi = api as jest.Mocked<typeof api>;
const analyticsId = '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c';

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('lucy-analytics-anonymous-id', analyticsId);
  mockedApi.post.mockResolvedValue({ data: undefined });
  mockedApi.put.mockResolvedValue({ data: undefined });
  window.history.replaceState({}, '', '/listings?utm_source=Google&utm_medium=CPC&utm_campaign=Spring%202026&token=never-store');
});

test('registers only the dedicated opaque analytics UUID and minimized landing context', async () => {
  await expect(registerAnalyticsAnonymousIdentity()).resolves.toBe('0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c');
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/anonymous-identities', {
    anonymous_id: '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c',
  });
  expect(mockedApi.put).toHaveBeenCalledWith('/analytics/anonymous-identities/attribution', {
    anonymous_id: '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c',
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'spring 2026',
    landing_path: '/listings',
  });
});

test('never reuses the chat/saves bearer token and normalizes dynamic landings', async () => {
  localStorage.setItem('lucy-anonymous-session-token', 'private-chat-bearer-token');
  window.history.replaceState({}, '', '/documents/private-document-id?access=secret#private');
  await registerAnalyticsAnonymousIdentity();
  expect(getOrCreateAnalyticsAnonymousId()).toBe(analyticsId);
  expect(mockedApi.put).toHaveBeenCalledWith('/analytics/anonymous-identities/attribution', {
    anonymous_id: analyticsId, landing_path: '/documents/[id]',
  });
  expect(JSON.stringify(mockedApi.put.mock.calls)).not.toContain('private-document-id');
  expect(JSON.stringify(mockedApi.post.mock.calls)).not.toContain('private-chat-bearer-token');
});

test('blocked storage yields no analytics identity or conversion header', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    expect(getOrCreateAnalyticsAnonymousId()).toBeNull();
    expect(analyticsAttributionHeaders(true)).toEqual({});
  } finally { spy.mockRestore(); }
});

test('linking is best-effort and happens only after registration', async () => {
  await expect(linkAnalyticsAnonymousIdentity()).resolves.toBeUndefined();
  expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/analytics/identity-links', {
    anonymous_id: '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c',
  });
});

test('conversion headers are absent without consent and contain no URL data', () => {
  expect(analyticsAttributionHeaders(false)).toEqual({});
  expect(analyticsAttributionHeaders(true)).toEqual({
    'X-Analytics-Anonymous-Id': '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c',
  });
});

test('same signed-in account keeps its analytics UUID across repeated links', async () => {
  await linkAnalyticsAnonymousIdentity();
  await linkAnalyticsAnonymousIdentity();
  expect(getOrCreateAnalyticsAnonymousId()).toBe(analyticsId);
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/identity-links', {
    anonymous_id: analyticsId,
  });
  expect(mockedApi.post).toHaveBeenCalledTimes(4);
});

test('temporary link failure does not rotate an analytics UUID', async () => {
  const original = '48873c4f-77a6-49f0-98cd-3424d2153243';
  localStorage.setItem('lucy-analytics-anonymous-id', original);
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce(new Error('network unavailable'));
  await linkAnalyticsAnonymousIdentity();
  expect(localStorage.getItem('lucy-analytics-anonymous-id')).toBe(original);
  expect(analyticsAttributionHeaders(true)).toEqual({});
  expect(mockedApi.post).toHaveBeenCalledTimes(2);
  localStorage.setItem('lucy-analytics-consent', 'accepted');
  track('property_checkup_opened', { listing_id: 'f64659eb-b16f-45b8-9dd6-a0e52388fe79' });
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/events', expect.not.objectContaining({
    anonymous_id: original,
  }));
  await linkAnalyticsAnonymousIdentity();
  expect(analyticsAttributionHeaders(true)).toEqual({ 'X-Analytics-Anonymous-Id': original });
});

test('a persisted pending-link marker suppresses identity after a page reload', () => {
  localStorage.setItem('lucy-analytics-pending-link-id', analyticsId);
  expect(getOrCreateAnalyticsAnonymousId()).toBeNull();
  expect(analyticsAttributionHeaders(true)).toEqual({});
});

test('an unrelated forbidden response does not rotate identity', async () => {
  const original = '99278744-30af-4b6d-a183-4c81eec694a3';
  localStorage.setItem('lucy-analytics-anonymous-id', original);
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'forbidden' } } });
  await linkAnalyticsAnonymousIdentity();
  expect(localStorage.getItem('lucy-analytics-anonymous-id')).toBe(original);
  expect(analyticsAttributionHeaders(true)).toEqual({});
  expect(mockedApi.post).toHaveBeenCalledTimes(2);
});

test('a different-account conflict replaces the UUID for conversions and subsequent events', async () => {
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce({
    response: { status: 403, data: { detail: { code: 'analytics_identity_conflict' } } },
  });
  await linkAnalyticsAnonymousIdentity();
  const replacement = getOrCreateAnalyticsAnonymousId();
  expect(replacement).toBeTruthy();
  expect(replacement).not.toBe(analyticsId);
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/anonymous-identities', {
    anonymous_id: replacement,
  });
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/identity-links', {
    anonymous_id: replacement,
  });
  expect(analyticsAttributionHeaders(true)).toEqual({ 'X-Analytics-Anonymous-Id': replacement });
  localStorage.setItem('lucy-analytics-consent', 'accepted');
  track('property_checkup_opened', { listing_id: 'f64659eb-b16f-45b8-9dd6-a0e52388fe79' });
  expect(mockedApi.post).toHaveBeenCalledWith('/analytics/events', expect.objectContaining({
    anonymous_id: replacement,
  }));
});

test('storage failure after a confirmed conflict cannot reuse the old UUID', async () => {
  const original = '7ca1ccbe-06ed-44f8-9041-adb117109980';
  localStorage.setItem('lucy-analytics-anonymous-id', original);
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce({
    response: { status: 403, data: { detail: { code: 'analytics_identity_conflict' } } },
  });
  const originalSetItem = Storage.prototype.setItem;
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'lucy-analytics-anonymous-id') throw new Error('storage unavailable');
    return originalSetItem.call(this, key, value);
  });
  try {
    await linkAnalyticsAnonymousIdentity();
    expect(analyticsAttributionHeaders(true)).toEqual({});
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  } finally {
    spy.mockRestore();
  }
});

test('failed replacement registration stops after one attempt and keeps old UUID retired', async () => {
  const original = '386ba6c7-b31a-46d4-a898-3167f9c42300';
  localStorage.setItem('lucy-analytics-anonymous-id', original);
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce({
    response: { status: 403, data: { detail: { code: 'analytics_identity_conflict' } } },
  });
  mockedApi.post.mockRejectedValueOnce(new Error('registration unavailable'));
  await linkAnalyticsAnonymousIdentity();
  expect(mockedApi.post).toHaveBeenCalledTimes(3);
  expect(getOrCreateAnalyticsAnonymousId()).not.toBe(original);
  expect(analyticsAttributionHeaders(true)['X-Analytics-Anonymous-Id']).not.toBe(original);
});

test('a conflicting replacement UUID is also retired without another retry', async () => {
  const original = 'ccfced62-1ed0-46d4-bbdd-8739e60a90cb';
  localStorage.setItem('lucy-analytics-anonymous-id', original);
  const conflict = { response: { status: 403, data: { detail: { code: 'analytics_identity_conflict' } } } };
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce(conflict);
  mockedApi.post.mockResolvedValueOnce({ data: undefined });
  mockedApi.post.mockRejectedValueOnce(conflict);
  await linkAnalyticsAnonymousIdentity();
  expect(mockedApi.post).toHaveBeenCalledTimes(4);
  expect(analyticsAttributionHeaders(true)).toEqual({});
});
