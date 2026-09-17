/**
 * Staff AI escalation queue — control 4.17.
 *
 * *"Authorized staff can review flagged conversations, feedback,
 * source/version context and failed actions without exposing internal content
 * to clients."*
 *
 * The API for all of this already existed; nothing called it, so escalations
 * accumulated unread. These are the reads and the one write the queue needs.
 *
 * Superadmin-gated server-side (`require_role`), so a client's token gets a
 * 403 here — the "without exposing internal content to clients" half.
 */

import api from '@/lib/axios';
import type {
  AiEscalation,
  AiMessage,
  ApiPaginated,
  EscalationStatus,
} from '@/types/api';

/** The lifecycle, in order. Matches `EscalationStatus` on the API. */
export const ESCALATION_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
] as const;

export const ESCALATION_STATUS_LABELS: Record<EscalationStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

/**
 * Why the AI handed over. Every one of these is a topic control 4.8 and C5
 * route to a licensed human, so the label says what is needed, not just what
 * happened.
 */
export const ESCALATION_REASON_LABELS: Record<string, string> = {
  legal: 'Legal or title question',
  pricing: 'Pricing question',
  negotiation: 'Negotiation',
  missing_data: 'Data unavailable',
  showing: 'Showing request',
  valuation: 'Valuation',
  mortgage_tax: 'Mortgage or tax question',
  offer: 'Offer',
  sensitive_document: 'Sensitive document',
  human_verification: 'Asked to speak to a person',
};

export function escalationReasonLabel(reason: string): string {
  return ESCALATION_REASON_LABELS[reason] ?? reason;
}

export async function fetchEscalations(
  page = 1,
  size = 20,
): Promise<ApiPaginated<AiEscalation>> {
  const res = await api.get<ApiPaginated<AiEscalation>>('/ai_escalations/', {
    params: { page, size },
  });
  return res.data;
}

/** The conversation behind one escalation — 4.17's "flagged conversations". */
export async function fetchEscalationConversation(
  sessionId: string,
): Promise<AiMessage[]> {
  const res = await api.get<AiMessage[]>(`/ai_messages/session/${sessionId}`);
  return res.data;
}

export async function updateEscalationStatus(
  escalationId: string,
  status: EscalationStatus,
): Promise<AiEscalation> {
  const res = await api.patch<AiEscalation>(`/ai_escalations/${escalationId}`, {
    status,
  });
  return res.data;
}
