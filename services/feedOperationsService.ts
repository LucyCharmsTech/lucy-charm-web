/**
 * IDX/PropTx feed operations — control 3.4.
 *
 * Our 1 September report: *"There are fifteen functions for running a sync,
 * checking job history, reviewing failed records and reading reconciliation
 * reports. **Only one has a screen.** The reports your checklist asks for are
 * being produced and nobody can read them."*
 *
 * Every route here is superadmin-only server-side.
 *
 * The API returns untyped `dict[str, object]`, so the types below describe
 * what the service actually builds rather than a schema it enforces. The UI
 * reads them defensively — a shape change should degrade the panel, not break
 * the page.
 */

import api from '@/lib/axios';
import type {
  IdxFailuresReport,
  IdxHealthReport,
  IdxJobsStatus,
  IdxSchedulerStatus,
} from '@/types/api';

/**
 * The resources that can be synced on demand, in the order they are shown.
 *
 * `properties` first because it is the one that changes by the minute and the
 * one whose silence matters — the others are directory data that legitimately
 * goes weeks without an edit.
 */
export const IDX_SYNC_JOBS = [
  { path: '', label: 'Properties', hint: 'Listings — the main feed' },
  { path: '/media', label: 'Listing media', hint: 'Photos for listings' },
  { path: '/rooms', label: 'Rooms', hint: 'Room-level detail' },
  { path: '/open-houses', label: 'Open houses', hint: 'Scheduled open houses' },
  { path: '/members', label: 'Members', hint: 'Agents in the board directory' },
  { path: '/offices', label: 'Offices', hint: 'Brokerages in the directory' },
  { path: '/member-media', label: 'Member photos', hint: 'Agent headshots' },
  { path: '/office-media', label: 'Office photos', hint: 'Brokerage logos' },
] as const;

export async function fetchIdxHealth(): Promise<IdxHealthReport> {
  const res = await api.get<IdxHealthReport>('/idx/health');
  return res.data;
}

export async function fetchIdxJobs(): Promise<IdxJobsStatus> {
  const res = await api.get<IdxJobsStatus>('/idx/jobs');
  return res.data;
}

export async function fetchIdxScheduler(): Promise<IdxSchedulerStatus> {
  const res = await api.get<IdxSchedulerStatus>('/idx/scheduler');
  return res.data;
}

export async function fetchIdxFailures(
  unresolvedOnly = true,
  limit = 50,
): Promise<IdxFailuresReport> {
  const res = await api.get<IdxFailuresReport>('/idx/failures', {
    params: { unresolved_only: unresolvedOnly, limit },
  });
  return res.data;
}

/**
 * Start one sync. The API answers 202 and runs it in the background, and
 * refuses with `already_running` rather than starting a second — so the button
 * is safe to press twice.
 */
export async function triggerIdxSync(path: string): Promise<Record<string, unknown>> {
  const res = await api.post<Record<string, unknown>>(`/idx/sync${path}`, {});
  return res.data;
}

/** Retire listings the board no longer carries. Also background, also 202. */
export async function triggerIdxReconcile(): Promise<Record<string, unknown>> {
  const res = await api.post<Record<string, unknown>>('/idx/reconcile', {});
  return res.data;
}
