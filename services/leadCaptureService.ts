/**
 * Public contact-form submission.
 *
 * The endpoint answers **201 with a reference, only once the CRM record is
 * saved** — the client's own instruction for the Contact page: "Confirm
 * receipt/reference only after the CRM record saves." It used to answer 202
 * immediately from a detached write, so there was no reference to show and no
 * failure to handle. Both now exist and the form has to render them.
 *
 * POST /lead_capture/contact_form
 */

import api from '@/lib/axios';
import { getOrCreateAnonymousSessionToken } from '@/lib/anonymousSession';
import { useAuthStore } from '@/stores/authStore';
import { ANONYMOUS_SESSION_HEADER } from '@/types/api';
import type { ContactFormSubmission, ContactFormReceipt } from '@/types/api';

/**
 * The four initial topics, exactly as the client specified them, and
 * deliberately data rather than markup — they were described as "initial
 * configurable topics", so the list is meant to move.
 */
export const CONTACT_TOPICS = [
  'Buying',
  'Selling/Home Value',
  'Existing request',
  'General question',
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Which lead type each topic captures. Sellers must not land as buyers. */
export const TOPIC_LEAD_TYPE: Record<ContactTopic, 'buyer' | 'seller'> = {
  Buying: 'buyer',
  'Selling/Home Value': 'seller',
  'Existing request': 'buyer',
  'General question': 'buyer',
};

function anonRequestHeaders(): Record<string, string> {
  // A signed-in submitter is identified by their JWT; only a visitor needs the
  // anonymous token, which is what lets their earlier activity be linked.
  if (useAuthStore.getState().accessToken) return {};
  const token = getOrCreateAnonymousSessionToken();
  return token ? { [ANONYMOUS_SESSION_HEADER]: token } : {};
}

export async function submitContactForm(
  submission: ContactFormSubmission,
): Promise<ContactFormReceipt> {
  const res = await api.post<ContactFormReceipt>(
    '/lead_capture/contact_form',
    submission,
    { headers: anonRequestHeaders() },
  );
  return res.data;
}
