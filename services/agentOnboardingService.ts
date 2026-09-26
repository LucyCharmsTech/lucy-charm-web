import api from '@/lib/axios';
import type { AgentOnboarding, AgentProfileOptions, ApiPaginated } from '@/types/api';

export type AgentInvitationPayload = {
  legal_name: string;
  email: string;
  phone: string;
  registration_category: string;
  registration_title: string;
  reco_registration_id: string;
  system_role: 'agent';
};

export type AgentProfilePayload = {
  legal_name: string;
  phone: string;
  registration_category: string;
  registration_title: string;
  reco_registration_id: string;
  trade_name: string | null;
  service_area: string | null;
  languages: string[] | null;
  office_branch: string | null;
  public_profile_details: string | null;
};

export async function fetchAgentProfileOptions(): Promise<AgentProfileOptions> {
  const res = await api.get<AgentProfileOptions>('/agents/onboarding/options');
  return res.data;
}

export async function createAgentInvitation(
  payload: AgentInvitationPayload,
): Promise<AgentOnboarding> {
  const res = await api.post<AgentOnboarding>('/agents/onboarding/invitations', payload);
  return res.data;
}

export async function fetchAgentOnboarding(
  page = 1,
  size = 50,
): Promise<ApiPaginated<AgentOnboarding>> {
  const res = await api.get<ApiPaginated<AgentOnboarding>>('/agents/onboarding', {
    params: { page, size },
  });
  return res.data;
}

export async function fetchMyAgentOnboarding(): Promise<AgentOnboarding> {
  const res = await api.get<AgentOnboarding>('/agents/onboarding/me');
  return res.data;
}

export async function completeAgentProfile(
  payload: AgentProfilePayload,
): Promise<AgentOnboarding> {
  const res = await api.patch<AgentOnboarding>('/agents/onboarding/me', payload);
  return res.data;
}

export async function activateAgent(agentId: string): Promise<AgentOnboarding> {
  const res = await api.post<AgentOnboarding>(`/agents/onboarding/${agentId}/activate`);
  return res.data;
}

export async function resendAgentInvitation(agentId: string): Promise<AgentOnboarding> {
  const res = await api.post<AgentOnboarding>(`/agents/onboarding/${agentId}/resend`);
  return res.data;
}