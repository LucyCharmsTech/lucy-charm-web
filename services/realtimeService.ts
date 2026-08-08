/**
 * Realtime (WebSocket) API calls.
 * Authenticated: POST /ws/ticket
 */

import api from '@/lib/axios';
import type { WsTicketResponse } from '@/types/api';

/**
 * Mint a 30-second single-use handshake ticket. A browser cannot set an
 * Authorization header on a WebSocket upgrade, so the socket authenticates with
 * this instead of the access token. Mint a fresh one for every connection
 * attempt — a redeemed or expired ticket closes the handshake with 4401.
 */
export async function createWsTicket(): Promise<WsTicketResponse> {
  const res = await api.post<WsTicketResponse>('/ws/ticket');
  return res.data;
}
