import { renderHook, waitFor } from '@testing-library/react';
import { useVisibleModules } from '@/lib/useVisibleModules';
import { fetchVisibleModules } from '@/services/journeyService';

/**
 * Which portal modules render — controls 6.4 and 6.19.
 *
 * Most of this file is about **what happens when the request fails**, because
 * both obvious answers are wrong:
 *
 * - Show everything, and a network blip reveals a module switched off precisely because it is unfinished.
 * - Show nothing, and a network blip empties somebody's portal — their saved homes appear to have vanished.
 */

jest.mock('@/services/journeyService', () => ({ fetchVisibleModules: jest.fn() }));
const mockFetch = fetchVisibleModules as jest.MockedFunction<typeof fetchVisibleModules>;

beforeEach(() => jest.clearAllMocks());

test('it renders exactly what the server allows', async () => {
  mockFetch.mockResolvedValue(['saved_homes', 'showings']);
  const { result } = renderHook(() => useVisibleModules('buyer'));

  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.isVisible('saved_homes')).toBe(true);
  expect(result.current.isVisible('showings')).toBe(true);
  expect(result.current.isVisible('seller_plan')).toBe(false);
});

test('a module the server withholds is hidden, even a common one', async () => {
  // 6.19's flag is the whole point: if a module is switched off because it is
  // incomplete, no amount of it being "normal" should bring it back.
  mockFetch.mockResolvedValue(['saved_homes']);
  const { result } = renderHook(() => useVisibleModules('buyer'));

  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.isVisible('saved_searches')).toBe(false);
  expect(result.current.isVisible('property_checkup')).toBe(false);
});

describe('when the request fails', () => {
  test('it does not show everything', async () => {
    // A blip must never expose a flagged module. `property_checkup` and
    // `saved_search_digest` both sit behind flags on the server.
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useVisibleModules('buyer'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isVisible('property_checkup')).toBe(false);
    expect(result.current.isVisible('saved_search_digest')).toBe(false);
  });

  test('it does not show nothing either', async () => {
    // A blip must never make an established account look empty.
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useVisibleModules('buyer'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    for (const key of ['saved_homes', 'saved_searches', 'showings', 'documents']) {
      expect(result.current.isVisible(key)).toBe(true);
    }
  });

  test('it also withholds modules gated on representation', async () => {
    // `transaction_tasks` has no feature flag but requires representation —
    // C4: "signing in or finishing a task does not create representation." So
    // it must not appear just because we could not ask.
    mockFetch.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useVisibleModules('buyer'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isVisible('transaction_tasks')).toBe(false);
  });
});

test('before the answer arrives, the always-on modules already show', async () => {
  // A portal that renders empty for a moment and then fills in reads as
  // broken. These are the modules almost certain to be in the answer.
  let resolve: (v: string[]) => void = () => {};
  mockFetch.mockReturnValue(new Promise((r) => { resolve = r; }));
  const { result } = renderHook(() => useVisibleModules('buyer'));

  expect(result.current.ready).toBe(false);
  expect(result.current.isVisible('saved_homes')).toBe(true);
  // But a flagged one is still held back while we wait.
  expect(result.current.isVisible('property_checkup')).toBe(false);

  resolve(['saved_homes', 'property_checkup']);
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.isVisible('property_checkup')).toBe(true);
});

test('the journey type is passed through, so a seller is not asked about buyer modules', async () => {
  mockFetch.mockResolvedValue(['seller_plan']);
  renderHook(() => useVisibleModules('seller'));
  await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('seller'));
});

test('the fallback list contains no flagged module', async () => {
  // The fallback is duplicated from the server on purpose — reading it from
  // the response that just failed is not an option. This asserts the
  // duplication has not drifted into including something flagged.
  mockFetch.mockRejectedValue(new Error('network'));
  const { result } = renderHook(() => useVisibleModules('buyer'));

  await waitFor(() => expect(result.current.ready).toBe(true));
  for (const flagged of ['property_checkup', 'saved_search_digest']) {
    expect(result.current.isVisible(flagged)).toBe(false);
  }
});
