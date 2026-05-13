/**
 * Client-side service for the AI chat API.
 * Handles session creation and message sending.
 */

import api from '@/lib/axios';
import type {
  AiSession,
  ChatSendRequest,
  ChatSendResponse,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Creates an AI session on the backend.
 *
 * The backend enforces an XOR constraint:
 *   - Authenticated user  → pass `userId`  (session_token must be omitted)
 *   - Anonymous visitor   → pass `sessionToken` (user_id must be omitted)
 *
 * Sessions created with a user_id are tied to the account and survive across
 * devices/browsers.  Sessions created with a session_token are ephemeral and
 * scoped to this browser.
 */
export async function createAiSession(options: {
  userId?: string;
  sessionToken?: string;
}): Promise<AiSession> {
  const body = options.userId
    ? { user_id: options.userId }
    : { session_token: options.sessionToken };

  const res = await api.post<AiSession>('/ai_sessions/', body);
  return res.data;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * Sends one chat turn to the backend and returns the assistant reply.
 * The full orchestration (intent classification, escalation, persistence)
 * happens server-side.
 */
export async function sendChatMessage(
  payload: ChatSendRequest,
): Promise<ChatSendResponse> {
  // LLM round-trips routinely exceed the default 10s axios timeout; keep this
  // high enough for slow models / cold starts without blocking the UI forever.
  const res = await api.post<ChatSendResponse>('/chat/send', payload, {
    timeout: 120_000,
  });
  return res.data;
}

/**
 * Returns a URL for a Server-Sent Events stream for the given payload.
 * Use `EventSource` in client code for real-time streaming.
 *
 * NOTE: The backend /chat/stream endpoint accepts POST (not GET), so we
 * cannot use the native EventSource API directly.  Instead we use the
 * fetch streaming approach in the component.
 */
export async function streamChatMessage(
  payload: ChatSendRequest,
  onChunk: (chunk: string) => void,
  onDone: () => void,
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    // SSE format: "data: <json>\n\n"
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw) as { type: string; text?: string };
          if (parsed.type === 'chunk' && parsed.text) {
            onChunk(parsed.text);
          } else if (parsed.type === 'done') {
            onDone();
          }
        } catch {
          // Non-JSON line — ignore
        }
      }
    }
  }

  onDone();
}

// ---------------------------------------------------------------------------
// Anonymous session token helpers
// ---------------------------------------------------------------------------

/**
 * Returns a stable anonymous session token for the given listing, stored in
 * localStorage so it survives page reloads and new tabs.
 *
 * Format: `anon_<listingId>_<random-uuid>` — one token per listing so each
 * property has its own independent conversation thread.
 */
export function getOrCreateAnonToken(listingId: string): string {
  if (typeof window === 'undefined') return `anon_${listingId}_${crypto.randomUUID()}`;

  const key = `lucy_anon_session_${listingId}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = `anon_${listingId}_${crypto.randomUUID()}`;
    localStorage.setItem(key, token);
  }
  return token;
}
