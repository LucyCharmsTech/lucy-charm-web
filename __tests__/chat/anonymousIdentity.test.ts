import { ANONYMOUS_SESSION_HEADER } from '@/types/api';

/**
 * One anonymous visitor, one identity.
 *
 * The backend verifies this header twice on a seller-journey turn: once as the
 * owner of the AI session (`get_for_caller`) and once as the owner of the
 * journey (`get_journey_for_chat`). `sendChatMessage` used to substitute a
 * different token whenever `seller_journey_id` was present, so the session had
 * been created under one identity and the message arrived under another. Every
 * anonymous seller-journey message was rejected with a 404.
 *
 * These drive the real service against a mocked axios, because the bug was in
 * which value reached the header — exactly what a stubbed transport hides.
 */

const post = jest.fn().mockResolvedValue({ data: {} });
jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => post(...args) },
}));

import { getOrCreateAnonToken, sendChatMessage } from '@/services/chatService';
import { getOrCreateAnonymousSessionToken } from '@/lib/anonymousSession';

beforeEach(() => {
  post.mockClear();
  localStorage.clear();
});

const headerFrom = (call: unknown[]) =>
  (call[2] as { headers?: Record<string, string> })?.headers?.[ANONYMOUS_SESSION_HEADER];

test('a seller-journey message carries the token the session was created with', async () => {
  const sessionToken = getOrCreateAnonToken();

  await sendChatMessage(
    { session_id: 's-1', message_text: 'hello', seller_journey_id: 'j-1' },
    sessionToken,
  );

  expect(headerFrom(post.mock.calls[0])).toBe(sessionToken);
});

test('a plain message carries the same token', async () => {
  const sessionToken = getOrCreateAnonToken();

  await sendChatMessage({ session_id: 's-1', message_text: 'hello' }, sessionToken);

  expect(headerFrom(post.mock.calls[0])).toBe(sessionToken);
});

test('attaching a journey does not change the identity sent', async () => {
  // The regression in one assertion: the two calls differed only by
  // `seller_journey_id`, and that alone used to swap the token.
  const sessionToken = getOrCreateAnonToken();

  await sendChatMessage({ session_id: 's-1', message_text: 'a' }, sessionToken);
  await sendChatMessage(
    { session_id: 's-1', message_text: 'b', seller_journey_id: 'j-1' },
    sessionToken,
  );

  expect(headerFrom(post.mock.calls[1])).toBe(headerFrom(post.mock.calls[0]));
});

test('a signed-in caller sends no anonymous header at all', async () => {
  await sendChatMessage({ session_id: 's-1', message_text: 'hello' }, null);
  expect(headerFrom(post.mock.calls[0])).toBeUndefined();
});

// ── The identity itself ─────────────────────────────────────────────────────

test('chat uses the same anonymous identity as the rest of the app', () => {
  // Seller journeys, saved listings and lead capture all key off this one.
  // A per-listing token gave the same visitor a different identity on every
  // property, which is what allowed the session and the journey to disagree.
  expect(getOrCreateAnonToken()).toBe(getOrCreateAnonymousSessionToken());
});

test('the identity does not vary by surface', () => {
  // There is no per-listing token any more. The listing argument used to make
  // one identity per property, which is what let the session and the seller
  // journey disagree about who was asking.
  expect(getOrCreateAnonToken()).toBe(getOrCreateAnonToken());
});

test('the identity is stable across calls', () => {
  expect(getOrCreateAnonToken()).toBe(getOrCreateAnonToken());
});
