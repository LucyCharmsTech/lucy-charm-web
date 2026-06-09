/**
 * Superadmin-only API calls (brokerage-wide leads, AI logs, insights).
 * Backend enforces `require_role(superadmin)` on these paths.
 */

import api from '@/lib/axios';
import type {
  AiMessageRecord,
  AiSession,
  ApiPaginated,
  LeadInternalNoteRead,
  LeadRead,
  LeadTagRead,
  SuperadminDashboardSummary,
} from '@/types/api';

const LONG_READ_MS = 60_000;

export async function fetchSuperadminDashboard(): Promise<SuperadminDashboardSummary> {
  const res = await api.get<SuperadminDashboardSummary>('/superadmin/insights/dashboard', {
    timeout: LONG_READ_MS,
  });
  return res.data;
}

export async function fetchLeadsAdmin(
  page = 1,
  size = 25,
): Promise<ApiPaginated<LeadRead>> {
  const res = await api.get<ApiPaginated<LeadRead>>('/leads/', {
    params: { page, size },
    timeout: LONG_READ_MS,
  });
  return res.data;
}

/** Single lead (superadmin portal; backend should tighten RBAC on this path). */
export async function fetchLeadById(leadId: string): Promise<LeadRead> {
  const res = await api.get<LeadRead>(`/leads/${leadId}`);
  return res.data;
}

export async function fetchAiSessionsAdmin(
  page = 1,
  size = 25,
): Promise<ApiPaginated<AiSession>> {
  const res = await api.get<ApiPaginated<AiSession>>('/ai_sessions/', {
    params: { page, size },
    timeout: LONG_READ_MS,
  });
  return res.data;
}

export async function fetchAiMessagesAdmin(
  page = 1,
  size = 40,
): Promise<ApiPaginated<AiMessageRecord>> {
  const res = await api.get<ApiPaginated<AiMessageRecord>>('/ai_messages/', {
    params: { page, size },
    timeout: LONG_READ_MS,
  });
  return res.data;
}

export async function fetchAiMessagesBySession(
  sessionId: string,
): Promise<AiMessageRecord[]> {
  const res = await api.get<AiMessageRecord[]>(`/ai_messages/session/${sessionId}`, {
    timeout: LONG_READ_MS,
  });
  return res.data;
}

export async function fetchLeadNotes(leadId: string): Promise<LeadInternalNoteRead[]> {
  const res = await api.get<LeadInternalNoteRead[]>(
    `/superadmin/leads/${leadId}/internal-notes`,
  );
  return res.data;
}

export async function createLeadNote(
  leadId: string,
  body: string,
): Promise<LeadInternalNoteRead> {
  const res = await api.post<LeadInternalNoteRead>(
    `/superadmin/leads/${leadId}/internal-notes`,
    { body },
  );
  return res.data;
}

export async function deleteLeadNote(leadId: string, noteId: string): Promise<LeadInternalNoteRead> {
  const res = await api.delete<LeadInternalNoteRead>(
    `/superadmin/leads/${leadId}/internal-notes/${noteId}`,
  );
  return res.data;
}

export async function fetchLeadTags(leadId: string): Promise<LeadTagRead[]> {
  const res = await api.get<LeadTagRead[]>(`/superadmin/leads/${leadId}/tags`);
  return res.data;
}

export async function createLeadTag(
  leadId: string,
  tag_label: string,
): Promise<LeadTagRead> {
  const res = await api.post<LeadTagRead>(`/superadmin/leads/${leadId}/tags`, {
    tag_label,
  });
  return res.data;
}

export async function deleteLeadTag(leadId: string, tagId: string): Promise<LeadTagRead> {
  const res = await api.delete<LeadTagRead>(`/superadmin/leads/${leadId}/tags/${tagId}`);
  return res.data;
}

/**
 * Trigger a browser CSV download for AI chat messages.
 * Pass sessionId to scope to one session; omit for a full platform export.
 * Uses a native fetch so the browser handles the file-save dialog.
 */
export async function downloadChatLogsCsv(sessionId?: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const token =
    typeof window !== 'undefined' ? (await import('@/stores/authStore')).useAuthStore.getState().accessToken : null;

  const url = new URL(`${baseUrl}/ai_messages/export`);
  if (sessionId) url.searchParams.set('session_id', sessionId);

  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error(`Export failed: ${res.status}`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = sessionId ? `chat-log-${sessionId}.csv` : 'chat-logs.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
