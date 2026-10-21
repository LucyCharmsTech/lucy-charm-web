import api from '@/lib/axios';
import type { FeedbackContext, ProblemCategory } from '@/lib/productFeedback';

export type FeedbackSubmission = {
  submission_id: string;
  feedback_type: 'helpful' | 'problem';
  context: FeedbackContext;
  helpful?: boolean;
  category?: ProblemCategory;
  description?: string;
};

export type FeedbackReceipt = { id: string; created: boolean };

export async function submitProductFeedback(payload: FeedbackSubmission): Promise<FeedbackReceipt> {
  const response = await api.post<FeedbackReceipt>('/product-feedback', payload);
  return response.data;
}

export type InternalFeedback = {
  id: string;
  created_at: string;
  feedback_type: 'helpful' | 'problem';
  context: FeedbackContext;
  helpful: boolean | null;
  category: ProblemCategory | null;
  description: string | null;
};

export async function fetchProductFeedback(page: number): Promise<{
  page: number; page_size: number; total: number; items: InternalFeedback[];
}> {
  const response = await api.get('/product-feedback', { params: { page, size: 25 } });
  return response.data;
}
