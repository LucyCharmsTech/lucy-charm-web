import api from '@/lib/axios';

export type ShowingFeedbackStatus = 'draft' | 'pending_review' | 'published' | 'withdrawn';

export type StaffShowingFeedback = {
  id: string;
  transaction_id: string;
  source?: 'seller_appointment' | 'buyer_request';
  appointment_id: string | null;
  buyer_showing_association_id?: string | null;
  summary: string;
  status: ShowingFeedbackStatus;
  revision: number;
  content_revision: number;
  approved_content_revision: number | null;
  approved_buyer_share_revision?: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
};

export type ShowingFeedbackHistory = {
  action: string;
  status: ShowingFeedbackStatus;
  revision: number;
  content_revision: number;
  summary: string;
  actor_user_id: string;
  created_at: string;
};

export type PublishedShowingFeedback = {
  id: string;
  summary: string;
  showing_at: string;
  published_at: string;
};

const base = (transactionId: string) =>
  `/seller-transactions/${transactionId}/showing-feedback`;

export async function listStaffShowingFeedback(transactionId: string): Promise<StaffShowingFeedback[]> {
  return (await api.get<StaffShowingFeedback[]>(`${base(transactionId)}/staff`)).data;
}

export async function listShowingFeedbackHistory(transactionId: string, feedbackId: string): Promise<ShowingFeedbackHistory[]> {
  return (await api.get<ShowingFeedbackHistory[]>(`${base(transactionId)}/staff/${feedbackId}/history`)).data;
}

export type ShowingFeedbackSource = { appointment_id: string; buyer_showing_association_id?: never }
  | { buyer_showing_association_id: string; appointment_id?: never };

export async function createShowingFeedback(transactionId: string, source: string | ShowingFeedbackSource, summary: string): Promise<StaffShowingFeedback> {
  return (await api.post<StaffShowingFeedback>(`${base(transactionId)}/staff`, {
    ...(typeof source === 'string' ? { appointment_id: source } : source), summary,
  })).data;
}

export async function editShowingFeedback(transactionId: string, feedbackId: string, expectedRevision: number, summary: string): Promise<StaffShowingFeedback> {
  return (await api.patch<StaffShowingFeedback>(`${base(transactionId)}/staff/${feedbackId}`, {
    expected_revision: expectedRevision, summary,
  })).data;
}

export async function actOnShowingFeedback(transactionId: string, feedbackId: string,
  action: 'submit' | 'publish' | 'withdraw', expectedRevision: number): Promise<StaffShowingFeedback> {
  return (await api.post<StaffShowingFeedback>(`${base(transactionId)}/staff/${feedbackId}/${action}`, {
    expected_revision: expectedRevision,
  })).data;
}

export async function listPublishedShowingFeedback(transactionId: string): Promise<PublishedShowingFeedback[]> {
  return (await api.get<PublishedShowingFeedback[]>(base(transactionId))).data;
}

export function showingFeedbackError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const status = response?.status;
  if (typeof response?.data?.detail === 'string' && response.data.detail.trim()) return response.data.detail;
  if (status === 409) return 'Feedback changed. The latest version has been loaded; review it before trying again.';
  if (status === 401 || status === 403 || status === 404) return 'Showing feedback is no longer available to this account.';
  if (status === 422) return 'This showing or summary is not eligible. Check that the exact showing is completed and seller visible.';
  return 'Showing feedback could not be loaded or saved. Please try again.';
}
