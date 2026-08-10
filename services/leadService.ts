/**
 * Staff lead API calls shared by the admin and agent panels.
 * Backend enforces access per lead: superadmin anywhere, the assigned agent on
 * their own leads only.
 * GET /leads/agent/:agentId, PATCH /leads/:id (status),
 * GET/POST/DELETE /leads/:id/tags
 */

import api from '@/lib/axios';
import type { LeadRead, LeadStage, LeadTagRead } from '@/types/api';

/** Leads assigned to an agent. Agents may only fetch their own list. */
export async function fetchLeadsByAgent(agentId: string): Promise<LeadRead[]> {
  const res = await api.get<LeadRead[]>(`/leads/agent/${agentId}`);
  return res.data;
}

/** Change a lead's pipeline stage. Admin any lead; assigned agent own leads. */
export async function updateLeadStage(leadId: string, status: LeadStage): Promise<LeadRead> {
  const res = await api.patch<LeadRead>(`/leads/${leadId}`, { status });
  return res.data;
}

export async function fetchLeadTags(leadId: string): Promise<LeadTagRead[]> {
  const res = await api.get<LeadTagRead[]>(`/leads/${leadId}/tags`);
  return res.data;
}

/** Tags are universal: visible to admin and the assigned agent alike. */
export async function addLeadTag(leadId: string, tagLabel: string): Promise<LeadTagRead> {
  const res = await api.post<LeadTagRead>(`/leads/${leadId}/tags`, { tag_label: tagLabel });
  return res.data;
}

export async function removeLeadTag(leadId: string, tagId: string): Promise<LeadTagRead> {
  const res = await api.delete<LeadTagRead>(`/leads/${leadId}/tags/${tagId}`);
  return res.data;
}
