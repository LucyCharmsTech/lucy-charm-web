/**
 * Failed-delivery queue — controls 2.10 and 5.10.
 *
 * *"Create an idempotent CRM request, return a reference/confirmation, retry
 * temporary delivery failures and **alert staff when recovery fails**."*
 *
 * The contact form records a failed submission to `system_logs` so the enquiry
 * can still be honoured by hand. Until now nothing read them, so "alert staff"
 * ended at a database row.
 *
 * Superadmin-only server-side. These rows hold a submitter's name, email and
 * phone.
 */

import api from '@/lib/axios';
import type { SystemLog } from '@/types/api';

/** The `source` the contact-form failure path writes under. */
export const CONTACT_FORM_FAILURE_SOURCE = 'lead_capture.contact_form';

export async function fetchLogsBySource(source: string): Promise<SystemLog[]> {
  const res = await api.get<SystemLog[]>(`/system_logs/source/${source}`);
  return res.data;
}

export async function fetchFailedContactSubmissions(): Promise<SystemLog[]> {
  return fetchLogsBySource(CONTACT_FORM_FAILURE_SOURCE);
}

/**
 * Mark one as dealt with. The API soft-deletes, which is the right shape here:
 * the evidence that a submission was lost is worth keeping even once the
 * enquiry has been honoured.
 */
export async function dismissLog(logId: string): Promise<SystemLog> {
  const res = await api.delete<SystemLog>(`/system_logs/${logId}`);
  return res.data;
}
